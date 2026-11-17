/**
 * auth.api.test.js
 * End-to-end integration tests for Authentication Routes and Middleware Protection.
 */

const { Readable } = require('stream');
const app = require('../src/config/app');

function invokeApp({ method, url, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = new Readable({
      read() {
        if (payload) {
          this.push(payload);
        }
        this.push(null);
      }
    });

    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    if (body) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = Buffer.byteLength(payload).toString();
    }
    const mockSocket = {
      remoteAddress: '127.0.0.1',
      destroy: () => {},
      end: () => {}
    };
    req.socket = mockSocket;
    req.connection = mockSocket;
    req.destroy = () => {};

    let statusCode = 200;
    const resHeaders = {};

    const res = {
      statusCode: 200,
      setHeader: (key, val) => {
        resHeaders[key.toLowerCase()] = val;
      },
      getHeader: (key) => resHeaders[key.toLowerCase()],
      status: (code) => {
        statusCode = code;
        res.statusCode = code;
        return res;
      },
      json: (data) => {
        resHeaders['content-type'] = 'application/json';
        resolve({ status: statusCode, headers: resHeaders, body: data });
      },
      send: (data) => {
        resolve({ status: statusCode, headers: resHeaders, body: data });
      },
      end: (data) => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: statusCode, headers: resHeaders, body: parsed });
      }
    };

    app.handle(req, res);
  });
}

describe('Authentication & Route Protection Integration Tests', () => {
  const testUser = {
    email: `test-${Date.now()}@corp.com`,
    password: 'ValidPassword123!',
    name: 'Test Analyst',
    role: 'analyst',
    accessLevel: 'internal'
  };

  let authToken = null;

  describe('Public Health Endpoints', () => {
    it('GET /health should be public and return UP', async () => {
      const res = await invokeApp({ method: 'GET', url: '/health' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });

    it('GET /api/health should be public and return UP', async () => {
      const res = await invokeApp({ method: 'GET', url: '/api/health' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully with valid email and password', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/register',
        body: testUser
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.data.user.name).toBe(testUser.name);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.salt).toBeUndefined();
    });

    it('should reject registration if email already exists with 409 Conflict', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/register',
        body: testUser
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('should reject registration if password is shorter than 8 characters', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          email: 'shortpass@corp.com',
          password: 'short',
          name: 'Short Pass User'
        }
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.stringMatching(/at least 8 characters/i)])
      );
    });

    it('should reject registration if email format is invalid', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          email: 'invalid-email-format',
          password: 'ValidPassword123!',
          name: 'Invalid Email User'
        }
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.stringMatching(/valid email address/i)])
      );
    });

    it('should reject registration if name is missing', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          email: 'noname@corp.com',
          password: 'ValidPassword123!'
        }
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate pre-seeded default analyst user', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: 'analyst@corp.com',
          password: 'AnalystPass123!'
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('analyst@corp.com');
      authToken = res.body.data.token;
    });

    it('should authenticate newly registered user', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testUser.email,
          password: testUser.password
        }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject login with wrong password (401 Unauthorized)', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testUser.email,
          password: 'WrongPassword999!'
        }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('should reject login with non-existent email (401 Unauthorized)', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: 'doesnotexist@corp.com',
          password: 'AnyPassword123!'
        }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 Unauthorized when no token is provided', async () => {
      const res = await invokeApp({ method: 'GET', url: '/api/auth/me' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('should return 401 Unauthorized when an invalid token is provided', async () => {
      const res = await invokeApp({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer invalid.token.signature' }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 and user profile when a valid Bearer token is provided', async () => {
      const res = await invokeApp({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('analyst@corp.com');
      expect(res.body.data.role).toBe('analyst');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 200 on logout when authenticated', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logged_out).toBe(true);
    });

    it('should return 401 on logout when unauthenticated', async () => {
      const res = await invokeApp({ method: 'POST', url: '/api/auth/logout' });
      expect(res.status).toBe(401);
    });
  });

  describe('Mandatory Route Protection Middleware for All Downstream Routes', () => {
    it('should reject unauthenticated GET /api/tickets with 401', async () => {
      const res = await invokeApp({ method: 'GET', url: '/api/tickets' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('should reject unauthenticated POST /api/analyze with 401', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/analyze',
        body: { title: 'Test Ticket', description: 'Test ticket description' }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('should reject unauthenticated POST /api/classify with 401', async () => {
      const res = await invokeApp({
        method: 'POST',
        url: '/api/classify',
        body: { title: 'Test Classification', description: 'Sample issue' }
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('should reject unauthenticated GET /api/audit with 401', async () => {
      const res = await invokeApp({ method: 'GET', url: '/api/audit' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('should allow authenticated request through middleware when valid Bearer token is supplied', async () => {
      const res = await invokeApp({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${authToken}` }
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
