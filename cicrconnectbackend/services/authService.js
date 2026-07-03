const User = require('../models/User');
const { normalizeEmail, normalizeCollegeId } = require('../utils/fieldCrypto');

const AUTH_RECOVERY_SELECT =
  'name email collegeId password role warningCount hasUnreadWarning approvalStatus isVerified +emailHash +collegeIdHash';

const findUserByIdentifierRecovery = async ({ normalizedEmail, normalizedCollegeId }) => {
  const cursor = User.find({}).select(AUTH_RECOVERY_SELECT).cursor();
  for await (const row of cursor) {
    const rowEmail = normalizeEmail(row.get('email'));
    const rowCollegeId = normalizeCollegeId(row.get('collegeId'));
    if (normalizedEmail && rowEmail && rowEmail === normalizedEmail) {
      return row;
    }
    if (normalizedCollegeId && rowCollegeId && rowCollegeId === normalizedCollegeId) {
      return row;
    }
  }
  return null;
};

const findUserByEmailAndCollegeIdRecovery = async ({ normalizedEmail, normalizedCollegeId }) => {
  const cursor = User.find({}).select(AUTH_RECOVERY_SELECT).cursor();
  for await (const row of cursor) {
    const rowEmail = normalizeEmail(row.get('email'));
    const rowCollegeId = normalizeCollegeId(row.get('collegeId'));
    if (
      normalizedEmail &&
      normalizedCollegeId &&
      rowEmail === normalizedEmail &&
      rowCollegeId === normalizedCollegeId
    ) {
      return row;
    }
  }
  return null;
};

const repairIdentityHashesIfNeeded = async (user) => {
  if (!user) return;
  const email = normalizeEmail(user.get('email'));
  const collegeId = normalizeCollegeId(user.get('collegeId'));

  const emailHashes =
    typeof User.computeBlindIndexVariants === 'function'
      ? User.computeBlindIndexVariants(email, normalizeEmail)
      : [User.computeBlindIndex(email, normalizeEmail)].filter(Boolean);
  const collegeIdHashes =
    typeof User.computeBlindIndexVariants === 'function'
      ? User.computeBlindIndexVariants(collegeId, normalizeCollegeId)
      : [User.computeBlindIndex(collegeId, normalizeCollegeId)].filter(Boolean);

  const expectedEmailHash = emailHashes[0] || undefined;
  const expectedCollegeIdHash = collegeIdHashes[0] || undefined;

  let changed = false;
  if ((user.emailHash || undefined) !== expectedEmailHash) {
    user.emailHash = expectedEmailHash;
    changed = true;
  }
  if ((user.collegeIdHash || undefined) !== expectedCollegeIdHash) {
    user.collegeIdHash = expectedCollegeIdHash;
    changed = true;
  }
  if (!changed) return;

  try {
    await user.save({ validateBeforeSave: false });
  } catch {
    // Do not block login/reset flow if self-heal fails.
  }
};

const normalizeHandle = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      return path.split('/')[0] || '';
    } catch {
      return raw.replace(/^@+/, '');
    }
  }

  return raw.replace(/^@+/, '');
};

const normalizeAvatarUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const isDataImage = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(raw);
  if (isDataImage) {
    if (raw.length > 180000) return null;
    return raw;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString().slice(0, 600);
  } catch {
    return null;
  }
};

const normalizeAllowedSections = (sections) => {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
};

const buildTemporaryAccessSnapshot = (user, { isTemporarySession = false } = {}) => {
  const pass = user?.temporaryAccess || {};
  const expiresAtRaw = pass.expiresAt ? new Date(pass.expiresAt) : null;
  const expiresAt = expiresAtRaw && !Number.isNaN(expiresAtRaw.getTime()) ? expiresAtRaw : null;
  const isActive = Boolean(pass.enabled) && Boolean(expiresAt) && expiresAt.getTime() > Date.now();
  const remainingMinutes = isActive
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60000))
    : 0;

  return {
    enabled: Boolean(pass.enabled),
    isActive,
    isTemporarySession: Boolean(isTemporarySession),
    mode: String(pass.mode || 'read-only').toLowerCase() === 'read-only' ? 'read-only' : 'read-only',
    expiresAt,
    grantedAt: pass.grantedAt || null,
    remainingMinutes,
    restrictions: {
      readOnly: pass?.restrictions?.readOnly !== false,
      allowedSections: normalizeAllowedSections(pass?.restrictions?.allowedSections),
      writeOperationsBlocked: true,
      adminBlocked: true,
    },
  };
};

module.exports = {
  findUserByIdentifierRecovery,
  findUserByEmailAndCollegeIdRecovery,
  repairIdentityHashesIfNeeded,
  normalizeHandle,
  normalizeAvatarUrl,
  normalizeAllowedSections,
  buildTemporaryAccessSnapshot
};
