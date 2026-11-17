/**
 * auth.middleware.js
 * Mandatory authentication and authorization middleware.
 * Verifies Bearer JWT token from Authorization header and protects downstream routes.
 */

const { ForbiddenError } = require('../utils/errors');
const tokenService = require('../services/auth/token.service');

/**
 * Mandatory authentication middleware.
 * Requires a valid Bearer token in the Authorization header.
 * Rejects unauthenticated requests with HTTP 401 Unauthorized.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.trim().split(' ');
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please provide a valid Bearer token in the Authorization header.',
        timestamp: new Date().toISOString()
      });
    }

    const decoded = tokenService.verifyToken(token);
    req.user = decoded;
    req.userId = decoded.userId || decoded.sub;
    req.userRole = decoded.role || 'user';
    req.userAccessLevel = decoded.accessLevel || 'internal';
    req.userEmail = decoded.email || null;

    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access restricted to roles: ${allowedRoles.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

module.exports = {
  authenticate,
  requireRole
};
