/**
 * validate.js (Compatibility Bridge)
 * Re-exports validation middleware from src/middlewares/validation.middleware.js
 */

const { validateCreateTicket } = require('../middlewares/validation.middleware');

module.exports = {
  validateCreateTicket
};
