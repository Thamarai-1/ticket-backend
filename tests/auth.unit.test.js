/**
 * auth.unit.test.js
 * Unit tests for AuthService, TokenService, and AuthMiddleware without network sockets.
 */

const authService = require('../src/services/auth/auth.service');
const tokenService = require('../src/services/auth/token.service');
const { authenticate, requireRole } = require('../src/middlewares/auth.middleware');
const { validateRegister, validateLogin } = require('../src/validators/auth.validator');

describe('Authentication Unit Tests', () => {
  const sampleUser = {
    email: `unit-analyst-${Date.now()}@corp.com`,
    password: 'SecurePassword123!',
    name: 'Unit Analyst',
    role: 'analyst',
    accessLevel: 'internal'
  };

  let token = null;

  describe('AuthValidator', () => {
    it('validates correct registration payload', () => {
      const res = validateRegister(sampleUser);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects passwords shorter than 8 chars', () => {
      const res = validateRegister({ ...sampleUser, password: 'short' });
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toMatch(/at least 8 characters/);
    });

    it('rejects malformed email', () => {
      const res = validateRegister({ ...sampleUser, email: 'invalid-email' });
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toMatch(/valid email/);
    });

    it('validates correct login payload', () => {
      const res = validateLogin({ email: 'analyst@corp.com', password: 'secret' });
      expect(res.isValid).toBe(true);
    });
  });

  describe('TokenService', () => {
    it('generates and verifies HS256 tokens', () => {
      const payload = { userId: 'usr-123', email: 'test@corp.com', role: 'analyst' };
      const generated = tokenService.generateToken(payload);
      expect(generated).toBeDefined();

      const decoded = tokenService.verifyToken(generated);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('rejects expired tokens', () => {
      const payload = { userId: 'usr-123' };
      const expiredToken = tokenService.generateToken(payload, -1000); // expired 1s ago
      expect(() => tokenService.verifyToken(expiredToken)).toThrow(/expired/);
    });

    it('rejects invalid or tampered signatures', () => {
      const valid = tokenService.generateToken({ userId: 'usr-123' });
      const parts = valid.split('.');
      const tampered = `${parts[0]}.${parts[1]}.tampered_sig`;
      expect(() => tokenService.verifyToken(tampered)).toThrow(/signature/);
    });
  });

  describe('AuthService', () => {
    it('registers a new user and returns token', async () => {
      const res = await authService.register(sampleUser);
      expect(res.token).toBeDefined();
      expect(res.user.email).toBe(sampleUser.email.toLowerCase());
      expect(res.user.password).toBeUndefined();
      expect(res.user.password_hash).toBeUndefined();
      token = res.token;
    });

    it('rejects duplicate email registration with ConflictError', async () => {
      await expect(authService.register(sampleUser)).rejects.toThrow(/already exists/);
    });

    it('authenticates user with correct credentials', async () => {
      const res = await authService.login(sampleUser.email, sampleUser.password);
      expect(res.token).toBeDefined();
      expect(res.user.email).toBe(sampleUser.email.toLowerCase());
    });

    it('rejects invalid password with UnauthorizedError', async () => {
      await expect(
        authService.login(sampleUser.email, 'WrongPassword!')
      ).rejects.toThrow(/Invalid email or password/);
    });

    it('rejects unknown user with UnauthorizedError', async () => {
      await expect(
        authService.login('unknown@corp.com', 'SomePass123!')
      ).rejects.toThrow(/Invalid email or password/);
    });

    it('authenticates pre-seeded analyst user', async () => {
      const res = await authService.login('analyst@corp.com', 'AnalystPass123!');
      expect(res.token).toBeDefined();
      expect(res.user.role).toBe('analyst');
    });

    it('authenticates pre-seeded admin user', async () => {
      const res = await authService.login('admin@corp.com', 'AdminPass123!');
      expect(res.token).toBeDefined();
      expect(res.user.role).toBe('admin');
    });

    it('retrieves user profile via getCurrentUser', async () => {
      const loginRes = await authService.login(sampleUser.email, sampleUser.password);
      const user = await authService.getCurrentUser(loginRes.user.userId);
      expect(user.email).toBe(sampleUser.email.toLowerCase());
      expect(user.name).toBe(sampleUser.name);
    });
  });

  describe('AuthMiddleware', () => {
    it('rejects missing Authorization header with 401', () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/Authentication required/)
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects invalid Bearer token with 401', () => {
      const req = { headers: { authorization: 'Bearer malformed.token.value' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('accepts valid Bearer token and populates req.user', () => {
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authenticate(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.userId).toBeDefined();
      expect(req.userRole).toBe('analyst');
    });

    it('requireRole grants access to matching role and blocks non-matching', () => {
      const req = { user: { role: 'analyst' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const nextAllowed = jest.fn();
      const nextBlocked = jest.fn();

      // Allowed
      requireRole('analyst', 'admin')(req, res, nextAllowed);
      expect(nextAllowed).toHaveBeenCalled();

      // Blocked
      requireRole('admin')(req, res, nextBlocked);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(nextBlocked).not.toHaveBeenCalled();
    });
  });
});
