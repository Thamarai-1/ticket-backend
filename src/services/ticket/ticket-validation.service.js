/**
 * ticket-validation.service.js
 * Domain schema and business rule validation for tickets.
 */

const {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_STATUSES,
  ALLOWED_ENVIRONMENTS,
  ALLOWED_INTENTS,
  ALLOWED_ACCESS_LEVELS
} = require('../../utils/constants');
const { ValidationError } = require('../../utils/errors');

class TicketValidationService {
  validateTicketPayload(payload, isUpdate = false) {
    const errors = [];

    if (!isUpdate || payload.title !== undefined) {
      if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length < 5) {
        errors.push('title must be a string of at least 5 characters');
      }
    }

    if (!isUpdate || payload.description !== undefined) {
      if (!payload.description || typeof payload.description !== 'string' || payload.description.trim().length < 10) {
        errors.push('description must be a string of at least 10 characters');
      }
    }

    if (!isUpdate || payload.category !== undefined) {
      if (!payload.category || !ALLOWED_CATEGORIES.includes(payload.category)) {
        errors.push(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
      }
    }

    if (!isUpdate || payload.priority !== undefined) {
      if (!payload.priority || !ALLOWED_PRIORITIES.includes(payload.priority)) {
        errors.push(`priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}`);
      }
    }

    if (payload.status && !ALLOWED_STATUSES.includes(payload.status)) {
      errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
    }

    if (payload.intent && !ALLOWED_INTENTS.includes(payload.intent)) {
      errors.push(`intent must be one of: ${ALLOWED_INTENTS.join(', ')}`);
    }

    if (payload.environment && !ALLOWED_ENVIRONMENTS.includes(payload.environment)) {
      errors.push(`environment must be one of: ${ALLOWED_ENVIRONMENTS.join(', ')}`);
    }

    if (payload.data_access_level && !ALLOWED_ACCESS_LEVELS.includes(payload.data_access_level)) {
      errors.push(`data_access_level must be one of: ${ALLOWED_ACCESS_LEVELS.join(', ')}`);
    }

    if (['Resolved', 'Closed'].includes(payload.status)) {
      if (!payload.resolution_text || payload.resolution_text.trim().length < 5) {
        errors.push('resolution_text is required when ticket status is Resolved or Closed');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Ticket validation failed', errors);
    }

    return true;
  }
}

const ticketValidationService = new TicketValidationService();

module.exports = ticketValidationService;
