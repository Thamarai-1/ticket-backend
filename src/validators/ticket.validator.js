/**
 * ticket.validator.js
 * Validation rules and validators for Ticket entities.
 */

const {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_STATUSES,
  ALLOWED_ENVIRONMENTS
} = require('../utils/constants');

const validateCreateTicket = (data) => {
  const errors = [];
  const { title, description, category, priority, status, environment } = data;

  if (!title || typeof title !== 'string' || title.trim().length < 5) {
    errors.push('title is required and must be at least 5 characters');
  }

  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    errors.push('description is required and must be at least 10 characters');
  }

  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    errors.push(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }

  if (!priority || !ALLOWED_PRIORITIES.includes(priority)) {
    errors.push(`priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}`);
  }

  if (status && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }

  if (environment && !ALLOWED_ENVIRONMENTS.includes(environment)) {
    errors.push(`environment must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateUpdateTicket = (data) => {
  const errors = [];
  const { title, description, category, priority, status, environment } = data;

  if (title !== undefined && (typeof title !== 'string' || title.trim().length < 5)) {
    errors.push('title must be at least 5 characters');
  }

  if (description !== undefined && (typeof description !== 'string' || description.trim().length < 10)) {
    errors.push('description must be at least 10 characters');
  }

  if (category !== undefined && !ALLOWED_CATEGORIES.includes(category)) {
    errors.push(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
  }

  if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
    errors.push(`priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}`);
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }

  if (environment !== undefined && !ALLOWED_ENVIRONMENTS.includes(environment)) {
    errors.push(`environment must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateCreateTicket,
  validateUpdateTicket
};
