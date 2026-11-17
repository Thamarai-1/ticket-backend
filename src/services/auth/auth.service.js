/**
 * auth.service.js
 * Authentication business logic: registration, credential validation, session handling.
 */

const crypto = require('crypto');
const tokenService = require('./token.service');
const { UnauthorizedError, ValidationError, ConflictError } = require('../../utils/errors');
const logger = require('../../config/logger');

// In-memory user store for demo/development with seeded default admin/analyst
const inMemoryUsers = new Map([
  [
    'analyst@corp.com',
    {
      userId: 'usr-analyst-01',
      email: 'analyst@corp.com',
      name: 'Senior Triage Analyst',
      role: 'analyst',
      accessLevel: 'internal',
      passwordHash: hashPassword('AnalystPass123!')
    }
  ],
  [
    'admin@corp.com',
    {
      userId: 'usr-admin-01',
      email: 'admin@corp.com',
      name: 'System Administrator',
      role: 'admin',
      accessLevel: 'restricted',
      passwordHash: hashPassword('AdminPass123!')
    }
  ]
]);

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = inMemoryUsers.get(cleanEmail);

    if (!user || user.passwordHash !== hashPassword(password)) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = tokenService.generateToken({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      accessLevel: user.accessLevel
    });

    logger.info(`User ${user.email} logged in successfully.`);

    return {
      token,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        accessLevel: user.accessLevel
      }
    };
  }

  async register({ email, name, password, role = 'analyst', accessLevel = 'internal' }) {
    if (!email || !password || !name) {
      throw new ValidationError('Email, name, and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    if (inMemoryUsers.has(cleanEmail)) {
      throw new ConflictError(`User with email '${cleanEmail}' already exists`);
    }

    const newUser = {
      userId: `usr-${Date.now()}`,
      email: cleanEmail,
      name: name.trim(),
      role,
      accessLevel,
      passwordHash: hashPassword(password)
    };

    inMemoryUsers.set(cleanEmail, newUser);
    logger.info(`New user registered: ${cleanEmail}`);

    const token = tokenService.generateToken({
      userId: newUser.userId,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      accessLevel: newUser.accessLevel
    });

    return {
      token,
      user: {
        userId: newUser.userId,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        accessLevel: newUser.accessLevel
      }
    };
  }

  async getCurrentUser(userId) {
    for (const u of inMemoryUsers.values()) {
      if (u.userId === userId) {
        return {
          userId: u.userId,
          email: u.email,
          name: u.name,
          role: u.role,
          accessLevel: u.accessLevel
        };
      }
    }
    return {
      userId: userId || 'anonymous-analyst',
      email: 'analyst@corp.com',
      name: 'Default Analyst',
      role: 'analyst',
      accessLevel: 'internal'
    };
  }
}

const authService = new AuthService();

module.exports = authService;
