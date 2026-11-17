/**
 * token.service.js
 * Cryptographic Token Service for authentication and authorization.
 * Implements HMAC-SHA256 based tokens with expiration and constant-time signature verification.
 */

const crypto = require('crypto');
const env = require('../../config/env');
const logger = require('../../config/logger');

class TokenService {
  constructor() {
    this.secret = this._resolveSecret();
  }

  _resolveSecret() {
    if (env.JWT_SECRET && env.JWT_SECRET !== 'it-ticket-default-secret-key-change-in-prod') {
      return env.JWT_SECRET;
    }
    if (process.env.JWT_SECRET_KEY) {
      return process.env.JWT_SECRET_KEY;
    }
    if (env.isProduction) {
      throw new Error('FATAL: JWT_SECRET must be explicitly configured in production environment');
    }
    logger.warn('Using ephemeral cryptographic secret for token service (instance-isolated).');
    return crypto.randomBytes(32).toString('hex');
  }

  generateToken(payload, expiresInMs = 24 * 60 * 60 * 1000) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Date.now() + expiresInMs;
    const claims = { ...payload, exp, iat: Date.now() };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token is required');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token structure');
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    let header;
    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Malformed token header');
    }

    // Reject 'none' algorithm and enforce HS256
    if (!header || header.alg !== 'HS256') {
      throw new Error('Unsupported or rejected algorithm: only HS256 is accepted');
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new Error('Invalid token signature');
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Malformed token payload');
    }

    if (payload.exp && Date.now() > payload.exp) {
      throw new Error('Token has expired');
    }

    return payload;
  }
}

const tokenService = new TokenService();

module.exports = tokenService;
