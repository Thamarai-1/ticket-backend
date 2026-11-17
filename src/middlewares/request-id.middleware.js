/**
 * request-id.middleware.js
 * Generates and propagates request correlation IDs for end-to-end tracing.
 */

const crypto = require('crypto');

const requestIdMiddleware = (req, res, next) => {
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    `REQ-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  req.correlationId = correlationId;
  req.id = correlationId;

  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', correlationId);

  next();
};

module.exports = requestIdMiddleware;
