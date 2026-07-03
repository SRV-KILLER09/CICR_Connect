const User = require('../models/User');
const InviteCode = require('../models/InviteCode');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const {
  normalizeEmail,
  normalizeCollegeId,
} = require('../utils/fieldCrypto');
const {
  YEAR_MIN,
  YEAR_MAX,
  normalizeAlumniProfile,
  validateTenures,
} = require('../utils/alumniProfile');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/auditLogger');

const catchAsync = require('../utils/catchAsync');
const authService = require('../services/authService');

const registerUser = async (req, res) => {
  const { name, email, password, collegeId, inviteCode, joinedAt } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);
  const normalizedInviteCode = String(inviteCode || '').trim().toUpperCase();

  if (!normalizedName || !normalizedEmail || !password || !normalizedCollegeId || !normalizedInviteCode) {
    return res.status(400).json({ message: 'All fields required' });
  }

  const emailHashes = typeof User.computeBlindIndexVariants === 'function'
    ? User.computeBlindIndexVariants(normalizedEmail, normalizeEmail)
    : [User.computeBlindIndex(normalizedEmail, normalizeEmail)].filter(Boolean);
  const collegeIdHashes = typeof User.computeBlindIndexVariants === 'function'
    ? User.computeBlindIndexVariants(normalizedCollegeId, normalizeCollegeId)
    : [User.computeBlindIndex(normalizedCollegeId, normalizeCollegeId)].filter(Boolean);
  const userExists = await User.findOne({
    $or: [
      ...(emailHashes.length ? [{ emailHash: { $in: emailHashes } }] : []),
      ...(collegeIdHashes.length ? [{ collegeIdHash: { $in: collegeIdHashes } }] : []),
      { email: normalizedEmail },
      { collegeId: normalizedCollegeId },
    ],
  });
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const now = new Date();
  const code = await InviteCode.findOne({ code: normalizedInviteCode });
  if (!code) {
    return res.status(400).json({ message: 'Invalid invite code' });
  }

  if (code.expiresAt && new Date(code.expiresAt) <= now) {
    return res.status(400).json({ message: 'Invite code expired' });
  }

  const maxUsesRaw = Number(code.maxUses);
  const maxUses = Number.isInteger(maxUsesRaw) && maxUsesRaw > 0 ? maxUsesRaw : 1;
  const currentUsesRaw = Number(code.currentUses);
  const currentUses = Number.isInteger(currentUsesRaw) && currentUsesRaw >= 0
    ? currentUsesRaw
    : (code.isUsed ? maxUses : 0);

  if (currentUses >= maxUses || code.isUsed) {
    return res.status(400).json({ message: 'Invite code usage limit reached' });
  }

  const consumedCode = await InviteCode.findOneAndUpdate(
    {
      _id: code._id,
      expiresAt: { $gt: now },
      $or: [
        { currentUses: { $lt: maxUses } },
        { currentUses: { $exists: false } },
      ],
      isUsed: { $ne: true },
    },
    {
      $inc: { currentUses: 1 },
      $set: { lastUsedAt: now },
    },
    { new: true }
  );

  if (!consumedCode) {
    return res.status(400).json({ message: 'Invite code usage limit reached' });
  }

  const consumedMaxUsesRaw = Number(consumedCode.maxUses);
  const consumedMaxUses = Number.isInteger(consumedMaxUsesRaw) && consumedMaxUsesRaw > 0
    ? consumedMaxUsesRaw
    : 1;

  if (Number(consumedCode.currentUses || 0) >= consumedMaxUses && !consumedCode.isUsed) {
    consumedCode.isUsed = true;
    await consumedCode.save({ validateBeforeSave: false });
  }

  let createdUser;
  try {
    createdUser = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password,
      collegeId: normalizedCollegeId,
      joinedAt: joinedAt ? new Date(joinedAt) : undefined,
      isVerified: false,
      approvalStatus: 'Pending',
    });
  } catch (err) {
    // Best-effort rollback for invite usage count if user creation fails.
    try {
      const rollbackCode = await InviteCode.findById(consumedCode._id);
      if (rollbackCode) {
        const rollbackMaxUses = Number.isInteger(Number(rollbackCode.maxUses)) && Number(rollbackCode.maxUses) > 0
          ? Number(rollbackCode.maxUses)
          : 1;
        rollbackCode.currentUses = Math.max(0, Number(rollbackCode.currentUses || 0) - 1);
        rollbackCode.isUsed = rollbackCode.currentUses >= rollbackMaxUses;
        if (rollbackCode.currentUses === 0) {
          rollbackCode.lastUsedAt = null;
        }
        await rollbackCode.save({ validateBeforeSave: false });
      }
    } catch {
      // Ignore rollback failures.
    }
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'User already exists' });
    }
    return res.status(500).json({ message: 'Registration failed. Please try again.' });
  }

  // --- SEND SIGNUP OTP ---
  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  createdUser.signupOtp = hashedOtp;
  createdUser.signupOtpExpires = Date.now() + 15 * 60 * 1000;
  await createdUser.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: normalizedEmail,
      subject: 'Verify your CICR Account',
      message: `
        <p>Welcome to CICR Connect! Your signup verification OTP is:</p>
        <h2 style="letter-spacing: 4px; color: #10B981;">${otp}</h2>
        <p>This OTP is valid for 15 minutes.</p>
      `,
    });
  } catch (err) {
    logger.warn('Failed to send signup OTP email', { userId: createdUser._id, err: err.message });
  }

  res.status(201).json({
    success: true,
    message: 'OTP sent to your email. Please verify to proceed.'
  });
};

const verifySignupOtp = async (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  const hashedOtp = crypto.createHash('sha256').update(String(otp)).digest('hex');
  
  const user = await User.findOneByEmail(normalizedEmail);
  if (!user || user.signupOtp !== hashedOtp || user.signupOtpExpires < Date.now()) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  user.isVerified = true;
  user.signupOtp = undefined;
  user.signupOtpExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: 'Email verified! Please wait for admin approval to log in.' });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const identifier = String(email || '').trim();
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedCollegeId = normalizeCollegeId(identifier);

  let user = null;
  if (identifier.includes('@')) {
    user = await User.findOneByEmail(normalizedEmail);
  } else {
    user = await User.findOneByCollegeId(normalizedCollegeId);
  }
  if (!user) {
    // Compatibility fallback: try both paths in case identifier format is ambiguous.
    user = (await User.findOneByEmail(normalizedEmail)) || (await User.findOneByCollegeId(normalizedCollegeId));
  }
  if (!user) {
    // Recovery fallback for old/misaligned encrypted hash records.
    user = await authService.findUserByIdentifierRecovery({ normalizedEmail, normalizedCollegeId });
  }
  if (user) {
    await authService.repairIdentityHashesIfNeeded(user);
  }

  const nowMs = Date.now();
  if (user?.lockUntil && new Date(user.lockUntil).getTime() > nowMs) {
    const retryAfterSec = Math.max(1, Math.ceil((new Date(user.lockUntil).getTime() - nowMs) / 1000));
    return res.status(423).json({
      code: 'ACCOUNT_TEMP_LOCKED',
      message: 'Account temporarily locked due to repeated failed logins.',
      retryAfterSec,
    });
  }

  const isPasswordCorrect = user ? await user.matchPassword(password) : false;
  if (!user || !isPasswordCorrect) {
    if (user) {
      const nextAttempts = Number(user.failedLoginAttempts || 0) + 1;
      const shouldLock = nextAttempts >= env.auth.maxFailedAttempts;
      user.failedLoginAttempts = shouldLock ? 0 : nextAttempts;
      user.lockUntil = shouldLock
        ? new Date(Date.now() + env.auth.lockMinutes * 60 * 1000)
        : null;
      try {
        await user.save({ validateBeforeSave: false });
      } catch (error) {
        logger.warn('auth_failed_attempt_persist_error', {
          requestId: req.requestId,
          userId: user._id ? String(user._id) : null,
          error: error.message,
        });
      }
    }
    return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  user.lastLoginIp = String(req.ip || '').trim();
  await user.save({ validateBeforeSave: false });

  const approval = String(user.approvalStatus || '').trim().toLowerCase();

  if (approval === 'rejected') {
    await logAudit({
      actor: user._id,
      action: 'AUTH_LOGIN_REJECTED_ACCOUNT',
      entityType: 'User',
      entityId: user._id,
      req,
    });
    return res.status(403).json({ message: 'Your registration has been rejected. Contact admin.' });
  }

  const isApproved = user.isVerified || approval === 'approved';
  const temporaryAccess = authService.buildTemporaryAccessSnapshot(user);
  const isTemporarySession = !isApproved && temporaryAccess.isActive;

  if (!isApproved && !isTemporarySession) {
    await logAudit({
      actor: user._id,
      action: 'AUTH_LOGIN_PENDING_APPROVAL',
      entityType: 'User',
      entityId: user._id,
      req,
    });
    return res.status(401).json({
      code: 'ACCOUNT_PENDING_APPROVAL',
      message: 'Account pending admin approval',
    });
  }

  if (isTemporarySession) {
    await logAudit({
      actor: user._id,
      action: 'AUTH_LOGIN_TEMP_ACCESS_GRANTED',
      entityType: 'User',
      entityId: user._id,
      after: {
        mode: temporaryAccess.mode,
        expiresAt: temporaryAccess.expiresAt,
        remainingMinutes: temporaryAccess.remainingMinutes,
      },
      req,
    });
  }

  await logAudit({
    actor: user._id,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user._id,
    after: {
      lastLoginAt: user.lastLoginAt,
      role: user.role,
      year: user.year,
    },
    req,
  });

  const token = generateToken(user._id);
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  const profile = {
    _id: user._id,
    name: user.name,
    email: user.email,
    collegeId: user.collegeId,
    role: user.role,
    approvalStatus: user.approvalStatus,
    isVerified: user.isVerified,
    warningCount: user.warningCount || 0,
    hasUnreadWarning: !!user.hasUnreadWarning,
    temporaryAccess: {
      ...temporaryAccess,
      isTemporarySession,
    },
  };

  // Return flat fields (web compat) + nested `result` (mobile compat)
  res.json({ ...profile, token, result: { ...profile, token } });
};

const requestMagicLink = async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const user = await User.findOneByEmail(normalizedEmail);
  if (!user) {
    return res.status(404).json({ message: 'No account found with this email.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  user.magicLinkToken = hashedToken;
  user.magicLinkExpires = Date.now() + 15 * 60 * 1000; // 15 mins
  await user.save({ validateBeforeSave: false });

  const baseUrl = env.frontendUrls && env.frontendUrls.length > 0 ? env.frontendUrls[0] : 'http://localhost:3000';
  const magicLink = `${baseUrl.replace(/\/$/, '')}/auth/magic-link?token=${token}`;

  try {
    await sendEmail({
      email: normalizedEmail,
      subject: 'Login to CICR Connect',
      message: `
        <p>Click the secure button below to magically log in to CICR Connect (Valid for 15 mins):</p>
        <a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">Login Instantly</a>
      `,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send magic link. Try again.' });
  }

  res.json({ success: true, message: 'Magic link sent to your email.' });
};

const verifyMagicLink = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    magicLinkToken: hashedToken,
    magicLinkExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: 'Magic link is invalid or expired.' });
  }

  user.magicLinkToken = undefined;
  user.magicLinkExpires = undefined;
  user.lastLoginAt = new Date();
  user.lastLoginIp = String(req.ip || '').trim();
  await user.save({ validateBeforeSave: false });

  const approval = String(user.approvalStatus || '').trim().toLowerCase();

  if (approval === 'rejected') {
    return res.status(403).json({ message: 'Your registration has been rejected.' });
  }

  const isApproved = user.isVerified || approval === 'approved';
  const temporaryAccess = authService.buildTemporaryAccessSnapshot(user);
  const isTemporarySession = !isApproved && temporaryAccess.isActive;

  if (!isApproved && !isTemporarySession) {
    return res.status(401).json({
      code: 'ACCOUNT_PENDING_APPROVAL',
      message: 'Account pending admin approval',
    });
  }

  const jwtToken = generateToken(user._id);

  res.cookie('token', jwtToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  const profile = {
    _id: user._id,
    name: user.name,
    email: user.email,
    collegeId: user.collegeId,
    role: user.role,
    approvalStatus: user.approvalStatus,
    isVerified: user.isVerified,
    warningCount: user.warningCount || 0,
    hasUnreadWarning: !!user.hasUnreadWarning,
    temporaryAccess: {
      ...temporaryAccess,
      isTemporarySession,
    },
  };

  res.json({ ...profile, token: jwtToken, result: { ...profile, token: jwtToken } });
};

const resetPasswordWithCode = async (req, res) => {
  const { collegeId, resetCode, newPassword } = req.body;
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedCollegeId || !resetCode || !newPassword) {
    return res.status(400).json({ message: 'College ID, reset code, and new password are required' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedCode = crypto.createHash('sha256').update(String(resetCode)).digest('hex');

  const candidates = await User.find({
    passwordResetOtp: hashedCode,
    passwordResetOtpExpires: { $gt: Date.now() },
  }).limit(20);
  const user = candidates.find(
    (row) => normalizeCollegeId(row.collegeId) === normalizedCollegeId
  );

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset code' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  return res.json({ success: true, message: 'Password changed successfully. Please sign in.' });
};

const changePassword = async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from current password.' });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const matches = await user.matchPassword(currentPassword);
  if (!matches) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  await logAudit({
    actor: user._id,
    action: 'AUTH_PASSWORD_CHANGED',
    entityType: 'User',
    entityId: user._id,
    req,
  });

  return res.json({ success: true, message: 'Password updated successfully.' });
};

const logoutUser = async (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    
    await logAudit({
      actor: req.user.id,
      action: 'AUTH_LOGOUT',
      entityType: 'User',
      entityId: req.user.id,
      req,
    });
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to logout right now.' });
  }
};

const sendPasswordResetOtp = async (req, res) => {
  const { email, collegeId } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedEmail || !normalizedCollegeId) {
    return res.status(400).json({ message: 'Email and college ID are required' });
  }

  const user = await User.findOneByEmailAndCollegeId(normalizedEmail, normalizedCollegeId);
  const resolvedUser =
    user ||
    (await authService.findUserByEmailAndCollegeIdRecovery({
      normalizedEmail,
      normalizedCollegeId,
    }));

  if (!resolvedUser) {
    return res.status(404).json({ success: false, message: 'User not found with provided email and college ID' });
  }

  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  resolvedUser.passwordResetOtp = hashedOtp;
  resolvedUser.passwordResetOtpExpires = Date.now() + 10 * 60 * 1000;
  await authService.repairIdentityHashesIfNeeded(resolvedUser);
  await resolvedUser.save({ validateBeforeSave: false });

  await sendEmail({
    email: resolvedUser.email,
    subject: 'CICR Password Reset OTP',
    message: `
      <p>Your password reset OTP is:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>This OTP is valid for 10 minutes.</p>
    `,
  });

  res.json({ success: true, message: 'OTP sent to your email.' });
};

const resetPasswordWithOtp = async (req, res) => {
  const { email, collegeId, otp, newPassword } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedCollegeId = normalizeCollegeId(collegeId);

  if (!normalizedEmail || !normalizedCollegeId || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, college ID, OTP, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const hashedOtp = crypto.createHash('sha256').update(String(otp)).digest('hex');

  const candidates = await User.find({
    passwordResetOtp: hashedOtp,
    passwordResetOtpExpires: { $gt: Date.now() },
  }).limit(20);
  const user = candidates.find(
    (row) =>
      normalizeEmail(row.email) === normalizedEmail &&
      normalizeCollegeId(row.collegeId) === normalizedCollegeId
  );

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  user.password = newPassword;
  user.passwordResetOtp = undefined;
  user.passwordResetOtpExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password changed successfully. Please log in.' });
};

const getMe = async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('-password')
    .populate('warnings.issuedBy', 'name role');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const userResponse = user.toObject();
  userResponse.temporaryAccess = authService.buildTemporaryAccessSnapshot(userResponse, {
    isTemporarySession: Boolean(req.user?.temporaryAccessContext?.isTemporarySession),
  });

  res.json(userResponse);
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const before = {
      name: user.name,
      phone: user.phone,
      year: user.year,
      branch: user.branch,
      batch: user.batch,
      avatarUrl: user.avatarUrl,
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Name is required.' });
      }
      user.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
      user.phone = String(req.body.phone || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'year')) {
      const rawYear = String(req.body.year ?? '').trim();
      if (!rawYear) {
        user.year = undefined;
      } else {
        const parsedYear = Number(rawYear);
        if (!Number.isFinite(parsedYear) || parsedYear < 1 || parsedYear > 6) {
          return res.status(400).json({ message: 'Year must be a number between 1 and 6.' });
        }
        user.year = parsedYear;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'branch')) {
      user.branch = String(req.body.branch || '').trim().toUpperCase();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'batch')) {
      user.batch = String(req.body.batch || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'joinedAt')) {
      const rawJoinedAt = req.body.joinedAt;
      if (!rawJoinedAt) {
        user.joinedAt = user.joinedAt || Date.now();
      } else {
        const parsedDate = new Date(rawJoinedAt);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: 'Invalid joined date.' });
        }
        user.joinedAt = parsedDate;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'projectIdeas')) {
      user.projectIdeas = Array.isArray(req.body.projectIdeas)
        ? req.body.projectIdeas.map((v) => String(v || '').trim()).filter(Boolean)
        : user.projectIdeas;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'bio')) {
      user.bio = String(req.body.bio || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'avatarUrl')) {
      const avatarUrl = authService.normalizeAvatarUrl(req.body.avatarUrl);
      if (avatarUrl === null) {
        return res.status(400).json({ message: 'Profile picture must be a valid http/https URL or uploaded image file.' });
      }
      user.avatarUrl = avatarUrl;
    }

    if (Array.isArray(req.body.achievements)) {
      user.achievements = req.body.achievements.map((v) => String(v || '').trim()).filter(Boolean);
    }

    if (Array.isArray(req.body.skills)) {
      user.skills = req.body.skills.map((v) => String(v || '').trim()).filter(Boolean);
    }

    user.social = {
      linkedin: String(req.body.social?.linkedin ?? user.social?.linkedin ?? '').trim(),
      github: String(req.body.social?.github ?? user.social?.github ?? '').trim(),
      portfolio: String(req.body.social?.portfolio ?? user.social?.portfolio ?? '').trim(),
      instagram: authService.normalizeHandle(req.body.social?.instagram ?? user.social?.instagram ?? ''),
      facebook: authService.normalizeHandle(req.body.social?.facebook ?? user.social?.facebook ?? ''),
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'alumniProfile')) {
      const normalizedAlumniProfile = normalizeAlumniProfile(req.body.alumniProfile, user.alumniProfile || {});
      const tenureValidation = validateTenures(normalizedAlumniProfile.tenures);
      if (!tenureValidation.ok) {
        return res.status(400).json({ message: tenureValidation.message });
      }
      if (
        Number.isFinite(normalizedAlumniProfile.graduationYear) &&
        (normalizedAlumniProfile.graduationYear < YEAR_MIN || normalizedAlumniProfile.graduationYear > YEAR_MAX)
      ) {
        return res
          .status(400)
          .json({ message: `Graduation year must be between ${YEAR_MIN} and ${YEAR_MAX}.` });
      }
      user.alumniProfile = normalizedAlumniProfile;
    }

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    await logAudit({
      actor: updatedUser._id,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'User',
      entityId: updatedUser._id,
      before,
      after: {
        name: updatedUser.name,
        phone: updatedUser.phone,
        year: updatedUser.year,
        branch: updatedUser.branch,
        batch: updatedUser.batch,
        avatarUrl: updatedUser.avatarUrl,
      },
      req,
    });

    return res.json(userResponse);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to update profile.' });
  }
};

module.exports = {
  registerUser: catchAsync(registerUser),
  verifySignupOtp: catchAsync(verifySignupOtp),
  loginUser: catchAsync(loginUser),
  requestMagicLink: catchAsync(requestMagicLink),
  verifyMagicLink: catchAsync(verifyMagicLink),
  resetPasswordWithCode: catchAsync(resetPasswordWithCode),
  sendPasswordResetOtp: catchAsync(sendPasswordResetOtp),
  resetPasswordWithOtp: catchAsync(resetPasswordWithOtp),
  changePassword: catchAsync(changePassword),
  logoutUser: catchAsync(logoutUser),
  getMe: catchAsync(getMe),
  updateProfile: catchAsync(updateProfile),
};
