const parseYear = (year) => {
  const y = Number(year);
  return Number.isFinite(y) ? y : 0; // 0 means undetermined
};

const isAdminOrHead = (role) => ['admin', 'head'].includes(String(role || '').toLowerCase());
const isStrictAdmin = (role) => ['admin'].includes(String(role || '').toLowerCase());
const isAlumni = (role) => ['alumni'].includes(String(role || '').toLowerCase());

const isSeniorTo = (user, targetYear) => {
  if (isAdminOrHead(user.role)) return true;
  if (isAlumni(user.role)) return true;
  const uYear = parseYear(user.year);
  const tYear = parseYear(targetYear);
  if (!uYear || !tYear) return false;
  return uYear > tYear;
};

const POLICIES = {
  ASSIGN_HIERARCHY: (user, context) => {
    if (isAdminOrHead(user.role)) return { allowed: true };
    const year = parseYear(user.year);
    if (year < 2 && !isAlumni(user.role)) return { allowed: false, reason: 'Only seniors can assign hierarchy tasks.' };
    
    if (context?.targetYear) {
      if (!isSeniorTo(user, context.targetYear) && year !== parseYear(context.targetYear)) {
         return { allowed: false, reason: 'You can assign tasks only to your year or junior members.' };
      }
    }
    return { allowed: true };
  },
  
  SCHEDULE_MEETING: (user) => {
    if (isAdminOrHead(user.role)) return { allowed: true };
    const year = parseYear(user.year);
    if (year < 2) return { allowed: false, reason: 'Only seniors (2nd year and above) can schedule meetings.' };
    return { allowed: true };
  },

  MANAGE_TEAM: (user, context) => {
    if (isAdminOrHead(user.role)) return { allowed: true };
    const year = parseYear(user.year);
    if (year < 2) return { allowed: false, reason: 'Only seniors (2nd year and above) can manage teams or schedule meetings.' };

    if (Array.isArray(context?.members)) {
      const invalid = context.members.find((m) => {
        const memberYear = parseYear(m?.year);
        if (!memberYear) return true; // Undetermined year is treated as invalid for hierarchy
        return memberYear > year;
      });
      if (invalid) {
        return { allowed: false, reason: 'You can only include members from your year or junior years.' };
      }
    }
    return { allowed: true };
  },

  CREATE_PROJECT: (user) => {
    if (isAdminOrHead(user.role)) return { allowed: true };
    const year = parseYear(user.year);
    // Let's say 2nd year and above can create projects
    if (year < 2) return { allowed: false, reason: 'Project creation is restricted to seniors (2nd year and above).' };
    return { allowed: true };
  },
  
  ACCESS_LEARNING_HUB_TRACK: (user, context) => {
    if (isAdminOrHead(user.role)) return { allowed: true };
    const userYear = parseYear(user.year);
    
    // Access denied if the user's year is lower than the track's required year
    if (context?.trackYear && userYear < context.trackYear) {
      return { allowed: false, reason: `This learning track requires at least year ${context.trackYear}.` };
    }
    return { allowed: true };
  },

  MANAGE_EVENTS: (user) => {
    if (isAdminOrHead(user.role)) return { allowed: true };
    return { allowed: false, reason: 'Only Admin or Head can manage events.' };
  },

  MANAGE_USERS: (user) => {
    if (isStrictAdmin(user.role)) return { allowed: true };
    return { allowed: false, reason: 'Only Admin can manage users.' };
  },

  INVESTIGATE_USER: (user, context) => {
    if (isAdminOrHead(user.role)) return { allowed: true };
    if (context?.targetYear && isSeniorTo(user, context.targetYear)) return { allowed: true };
    return { allowed: false, reason: 'You can only investigate junior students.' };
  },

  REVIEW_QUESTS: (user, context) => {
    if (isAdminOrHead(user.role)) return { allowed: true };
    if (context?.targetYear && isSeniorTo(user, context.targetYear)) return { allowed: true };
    return { allowed: false, reason: 'You can only review submissions from junior students.' };
  }
};

/**
 * Evaluates whether a user can perform a specific action based on their roles, year, and contextual data.
 * @param {string} action - The action identifier (e.g. ASSIGN_HIERARCHY)
 * @param {object} user - The user object containing role and year
 * @param {object} context - Additional context (e.g. targetUserYear, trackYear)
 * @returns {object} { allowed: boolean, reason?: string }
 */
const authorizeAction = (action, user, context = {}) => {
  if (!user) return { allowed: false, reason: 'User not authenticated.' };
  
  // Strict Admins bypass practically everything, but we let individual policies decide for fine-grained control
  if (!POLICIES[action]) {
    return { allowed: false, reason: `Unknown action policy: ${action}` };
  }
  
  return POLICIES[action](user, context);
};

module.exports = {
  authorizeAction,
  parseYear,
  isAdminOrHead,
  isStrictAdmin,
  isAlumni,
  isSeniorTo
};
