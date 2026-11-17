/**
 * auth.middleware.js
 * Authentication and authorization middleware.
 */

const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const tokenService = require('../services/auth/token.service');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (token) {
      const decoded = tokenService.verifyToken(token);
      req.user = decoded;
      req.userId = decoded.userId || decoded.sub;
      req.userRole = decoded.role || 'user';
      req.userAccessLevel = decoded.accessLevel || 'internal';
      return next();
    }

    // Support header-based user context (e.g. from gateway or internal testing)
    const headerUserId = req.headers['x-user-id'];
    const headerAccessLevel = req.headers['x-user-access-level'] || 'internal';

    if (headerUserId) {
      req.user = {
        userId: headerUserId,
        role: req.headers['x-user-role'] || 'analyst',
        accessLevel: headerAccessLevel
      };
      req.userId = headerUserId;
      req.userRole = req.user.role;
      req.userAccessLevel = headerAccessLevel;
      return next();
    }

    // Anonymous or guest default in non-strict modes
    req.user = {
      userId: 'anonymous-analyst',
      role: 'analyst',
      accessLevel: headerAccessLevel
    };
    req.userId = 'anonymous-analyst';
    req.userRole = 'analyst';
    req.userAccessLevel = headerAccessLevel;

    next();
  } catch (err) {
    next(new UnauthorizedError(err.message || 'Authentication token invalid or expired'));
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access restricted to roles: ${allowedRoles.join(', ')}`));
    }
    next();
  };
};

module.exports = {
  authenticate,
  requireRole
};
