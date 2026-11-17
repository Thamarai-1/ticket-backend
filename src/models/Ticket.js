/**
 * Ticket.js (Compatibility Bridge)
 * Re-exports Ticket model and constants from repositories.
 */

const {
  Ticket,
  ticketSchema
} = require('../repositories/ticket.repository');

const {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_INTENTS,
  ALLOWED_ENVIRONMENTS,
  ALLOWED_STATUSES,
  ALLOWED_ACCESS_LEVELS,
  ALLOWED_SOURCES
} = require('../utils/constants');

module.exports = {
  Ticket,
  ticketSchema,
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_INTENTS,
  ALLOWED_ENVIRONMENTS,
  ALLOWED_STATUSES,
  ALLOWED_ACCESS_LEVELS,
  ALLOWED_SOURCES
};
