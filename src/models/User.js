/**
 * User.js (Compatibility Bridge)
 * Re-exports User model and repository functions.
 */

const {
  User,
  userSchema,
  userRepository
} = require('../repositories/user.repository');

module.exports = {
  User,
  userSchema,
  userRepository
};
