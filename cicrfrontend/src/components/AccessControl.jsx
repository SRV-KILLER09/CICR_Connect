import React from 'react';
import { Navigate } from 'react-router-dom';

const parseYear = (year) => {
  const y = Number(year);
  return Number.isFinite(y) ? y : 0;
};

const isAdminOrHead = (role) => ['admin', 'head'].includes(String(role || '').toLowerCase());

// eslint-disable-next-line react-refresh/only-export-components
export const checkPermission = (action, user, context = {}) => {
  if (!user) return false;
  if (isAdminOrHead(user.role)) return true;

  const year = parseYear(user.year);

  switch (action) {
    case 'ASSIGN_HIERARCHY':
    case 'SCHEDULE_MEETING':
    case 'CREATE_PROJECT':
    case 'MANAGE_TEAM':
      return year >= 2;
    case 'ACCESS_LEARNING_HUB_TRACK':
      if (context.trackYear) {
        return year >= context.trackYear;
      }
      return true;
    case 'MANAGE_EVENTS':
    case 'MANAGE_USERS':
      return false; // Already handled by isAdminOrHead
    default:
      return false;
  }
};

/**
 * RequirePermission Component
 * Wraps children and only renders them if the user has the required permission.
 * If fallback is provided (e.g. a Navigate component), it renders that instead.
 */
export const RequirePermission = ({ action, user, context, fallback = null, children }) => {
  if (checkPermission(action, user, context)) {
    return <>{children}</>;
  }
  return fallback;
};

export const RequireRole = ({ roles, user, fallback = null, children }) => {
  if (!user) return fallback;
  const hasRole = roles.map(r => r.toLowerCase()).includes(String(user.role).toLowerCase());
  if (hasRole) {
    return <>{children}</>;
  }
  return fallback;
};
