/**
 * User.js (Compatibility Bridge)
 * Re-exports User model, userSchema, and userRepository.
 */

const {
  User,
  userSchema,
  userRepository
} = require('../repositories/user.repository');

// Allow both `const User = require('./models/User')` and `const { User } = require('./models/User')`
User.User = User;
User.userSchema = userSchema;
User.userRepository = userRepository;

module.exports = User;
