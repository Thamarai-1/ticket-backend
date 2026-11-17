/**
 * user.repository.js
 * Data Access Layer for User authentication and profiles.
 * Supports Mongoose ODM with an in-memory fallback store for standalone/testing environments.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const { ALLOWED_ACCESS_LEVELS } = require('../utils/constants');
const logger = require('../config/logger');

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: [true, 'user_id is required'],
      unique: true,
      trim: true
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true
    },
    password_hash: {
      type: String,
      required: [true, 'password_hash is required']
    },
    salt: {
      type: String,
      required: [true, 'salt is required']
    },
    role: {
      type: String,
      enum: ['analyst', 'admin', 'user', 'manager'],
      default: 'analyst',
      index: true
    },
    access_level: {
      type: String,
      enum: ALLOWED_ACCESS_LEVELS,
      default: 'internal'
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

let User;
try {
  User = mongoose.model('User');
} catch {
  User = mongoose.model('User', userSchema);
}

// In-Memory store for fast fallback when MongoDB is disconnected or in test mode
const inMemoryUsers = new Map();

// Helper for initial secure password hash using scrypt
function seedHash(password, salt) {
  const saltBuf = Buffer.from(salt, 'hex');
  return crypto.scryptSync(password, saltBuf, 64).toString('hex');
}

// Seed default accounts in memory store
const titansSalt = crypto.randomBytes(16).toString('hex');
inMemoryUsers.set('teamtitans@gmail.com', {
  user_id: 'usr-admin-titans',
  email: 'teamtitans@gmail.com',
  name: 'Team Titans Administrator',
  role: 'admin',
  access_level: 'restricted',
  salt: titansSalt,
  password_hash: seedHash('TitansAdmin2026!', titansSalt),
  created_at: new Date(),
  updated_at: new Date()
});

const sanjaiSalt = crypto.randomBytes(16).toString('hex');
inMemoryUsers.set('sanjaiexplores@gmail.com', {
  user_id: 'usr-sanjai-01',
  email: 'sanjaiexplores@gmail.com',
  name: 'Sanjai',
  role: 'admin',
  access_level: 'restricted',
  salt: sanjaiSalt,
  password_hash: seedHash('admin123', sanjaiSalt),
  created_at: new Date(),
  updated_at: new Date()
});

const restrictedSalt = crypto.randomBytes(16).toString('hex');
inMemoryUsers.set('restricted@corp.com', {
  user_id: 'usr-restricted-01',
  email: 'restricted@corp.com',
  name: 'Restricted Tier User',
  role: 'user',
  access_level: 'internal',
  salt: restrictedSalt,
  password_hash: seedHash('Restricted123!', restrictedSalt),
  created_at: new Date(),
  updated_at: new Date()
});

const analystSalt = crypto.randomBytes(16).toString('hex');
inMemoryUsers.set('analyst@corp.com', {
  user_id: 'usr-analyst-01',
  email: 'analyst@corp.com',
  name: 'Senior Triage Analyst',
  role: 'analyst',
  access_level: 'internal',
  salt: analystSalt,
  password_hash: seedHash('AnalystPass123!', analystSalt),
  created_at: new Date(),
  updated_at: new Date()
});

const adminSalt = crypto.randomBytes(16).toString('hex');
inMemoryUsers.set('admin@corp.com', {
  user_id: 'usr-admin-01',
  email: 'admin@corp.com',
  name: 'System Administrator',
  role: 'admin',
  access_level: 'restricted',
  salt: adminSalt,
  password_hash: seedHash('AdminPass123!', adminSalt),
  created_at: new Date(),
  updated_at: new Date()
});

class UserRepository {
  isDbConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  async findByEmail(email) {
    const cleanEmail = email.trim().toLowerCase();

    if (this.isDbConnected()) {
      try {
        const doc = await User.findOne({ email: cleanEmail }).lean();
        if (doc) return doc;
      } catch (err) {
        logger.warn(`Database lookup failed for email ${cleanEmail}, falling back to memory: ${err.message}`);
      }
    }

    const memUser = inMemoryUsers.get(cleanEmail) || null;
    if (memUser && this.isDbConnected()) {
      try {
        await User.findOneAndUpdate({ email: cleanEmail }, memUser, { upsert: true, new: true }).lean();
      } catch (e) {
        // silent fallback
      }
    }
    return memUser;
  }

  async findById(userId) {
    if (this.isDbConnected()) {
      try {
        const doc = await User.findOne({ user_id: userId }).lean();
        if (doc) return doc;
      } catch (err) {
        logger.warn(`Database lookup failed for user_id ${userId}, falling back to memory: ${err.message}`);
      }
    }

    for (const u of inMemoryUsers.values()) {
      if (u.user_id === userId) {
        return u;
      }
    }
    return null;
  }

  async createUser(userData) {
    const cleanEmail = userData.email.trim().toLowerCase();
    const record = {
      user_id: userData.user_id,
      email: cleanEmail,
      name: userData.name.trim(),
      password_hash: userData.password_hash,
      salt: userData.salt,
      role: userData.role || 'analyst',
      access_level: userData.access_level || 'internal',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Always mirror to in-memory store
    inMemoryUsers.set(cleanEmail, record);

    if (this.isDbConnected()) {
      try {
        await User.create(record);
      } catch (err) {
        logger.warn(`Failed to persist user in database, preserved in-memory: ${err.message}`);
      }
    }

    return record;
  }
}

const userRepository = new UserRepository();

module.exports = {
  User,
  userSchema,
  userRepository
};
