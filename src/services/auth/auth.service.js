/**
 * auth.service.js
 * Authentication business logic: registration, credential validation, session handling.
 * Utilizes memory-hard scrypt hashing with cryptographic per-user salts, timing-safe comparison,
 * and user repository database integration.
 */

const crypto = require('crypto');
const tokenService = require('./token.service');
const { userRepository } = require('../../repositories/user.repository');
const { UnauthorizedError, ValidationError, ConflictError, NotFoundError } = require('../../utils/errors');
const logger = require('../../config/logger');

// Generate cryptographically secure random salt
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// Memory-hard password hashing using scrypt
function hashPassword(password, salt) {
  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'hex');
  const derivedKey = crypto.scryptSync(password, saltBuf, 64);
  return derivedKey.toString('hex');
}

// Timing-safe verification supporting scrypt and SHA-256 fallback
function verifyPassword(password, salt, storedHash) {
  try {
    if (salt) {
      const computedHash = hashPassword(password, salt);
      const hashBuf = Buffer.from(computedHash, 'hex');
      const storedBuf = Buffer.from(storedHash, 'hex');

      if (hashBuf.length === storedBuf.length && crypto.timingSafeEqual(hashBuf, storedBuf)) {
        return true;
      }
    }

    // Fallback: SHA-256
    const shaHash = crypto.createHash('sha256').update(password).digest('hex');
    if (shaHash === storedHash) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

class AuthService {
  /**
   * Authenticate a user with email and password
   */
  async login(email, password) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await userRepository.findByEmail(cleanEmail);

    if (!user) {
      // Intentionally generic error message to prevent account enumeration
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = verifyPassword(password, user.salt, user.password_hash);
    if (!isMatch) {
      logger.warn(`Failed login attempt for user: ${cleanEmail}`);
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = tokenService.generateToken({
      userId: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessLevel: user.access_level
    });

    logger.info(`User ${user.email} authenticated successfully.`);

    return {
      token,
      token_type: 'Bearer',
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role,
        accessLevel: user.access_level
      }
    };
  }

  /**
   * Register a new user with password and email
   */
  async register({ email, name, password, role = 'analyst', accessLevel = 'internal' }) {
    if (!email || !password || !name) {
      throw new ValidationError('Email, name, and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await userRepository.findByEmail(cleanEmail);
    if (existing) {
      throw new ConflictError(`User with email '${cleanEmail}' already exists`);
    }

    // Minimum 8 characters password policy
    if (typeof password !== 'string' || password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);
    const userId = `usr-${crypto.randomBytes(6).toString('hex')}`;

    const newUser = await userRepository.createUser({
      user_id: userId,
      email: cleanEmail,
      name: name.trim(),
      password_hash: passwordHash,
      salt,
      role,
      access_level: accessLevel
    });

    logger.info(`New user registered: ${cleanEmail}`);

    const token = tokenService.generateToken({
      userId: newUser.user_id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      accessLevel: newUser.access_level
    });

    return {
      token,
      token_type: 'Bearer',
      user: {
        userId: newUser.user_id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        accessLevel: newUser.access_level
      }
    };
  }

  /**
   * Fetch current authenticated user profile
   */
  async getCurrentUser(userId) {
    if (!userId) {
      throw new UnauthorizedError('User ID not provided');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }

    return {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessLevel: user.access_level,
      createdAt: user.created_at
    };
  }

  /**
   * Log out user session
   */
  async logout(userId) {
    logger.info(`User logged out: ${userId}`);
    return {
      logged_out: true,
      timestamp: new Date().toISOString()
    };
  }
}

const authService = new AuthService();

module.exports = authService;
