/**
 * auth.validator.js
 * Input validation for user authentication and registration requests.
 */

const { ALLOWED_ACCESS_LEVELS } = require('../utils/constants');

const ALLOWED_ROLES = ['analyst', 'admin', 'user', 'manager'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRegister = (data) => {
  const errors = [];
  const { email, password, name, role, accessLevel } = data || {};

  if (!email || typeof email !== 'string') {
    errors.push('email is required and must be a string');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('email must be a valid email address');
  } else if (email.trim().length > 255) {
    errors.push('email cannot exceed 255 characters');
  }

  if (!password || typeof password !== 'string') {
    errors.push('password is required and must be a string');
  } else if (password.length < 8) {
    errors.push('password must be at least 8 characters long');
  } else if (password.length > 128) {
    errors.push('password cannot exceed 128 characters');
  }

  if (!name || typeof name !== 'string') {
    errors.push('name is required and must be a string');
  } else if (name.trim().length < 2) {
    errors.push('name must be at least 2 characters long');
  } else if (name.trim().length > 100) {
    errors.push('name cannot exceed 100 characters');
  }

  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    errors.push(`role must be one of: ${ALLOWED_ROLES.join(', ')}`);
  }

  if (accessLevel !== undefined && !ALLOWED_ACCESS_LEVELS.includes(accessLevel)) {
    errors.push(`accessLevel must be one of: ${ALLOWED_ACCESS_LEVELS.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateLogin = (data) => {
  const errors = [];
  const { email, password } = data || {};

  if (!email || typeof email !== 'string') {
    errors.push('email is required and must be a string');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('email must be a valid email address');
  }

  if (!password || typeof password !== 'string') {
    errors.push('password is required and must be a string');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateRegister,
  validateLogin,
  ALLOWED_ROLES
};
