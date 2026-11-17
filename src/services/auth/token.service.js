/**
 * token.service.js
 * Cryptographic Token Service for authentication and authorization.
 * Implements HMAC-SHA256 based tokens with expiration and signature verification.
 */

const crypto = require('crypto');
const env = require('../../config/env');

class TokenService {
  constructor() {
    this.secret = env.JWT_SECRET || 'it-ticket-default-secret-key-change-in-prod';
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

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      throw new Error('Invalid token signature');
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    if (payload.exp && Date.now() > payload.exp) {
      throw new Error('Token has expired');
    }

    return payload;
  }
}

const tokenService = new TokenService();

module.exports = tokenService;
