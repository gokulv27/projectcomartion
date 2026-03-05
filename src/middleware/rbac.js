'use strict';

const ROLE_HIERARCHY = { viewer: 0, analyst: 1, manager: 2, admin: 3 };

function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;
    const reqLevel  = ROLE_HIERARCHY[minRole] ?? 999;
    if (userLevel < reqLevel) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Requires ${minRole} role or higher` } });
    }
    next();
  };
}

module.exports = { requireRole, ROLE_HIERARCHY };
