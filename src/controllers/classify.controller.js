/**
 * classify.controller.js (Compatibility Bridge)
 * Re-exports classification handlers from analysis.controller.js
 */

const { classifyTicket, getServiceHealth } = require('./analysis.controller');

module.exports = {
  classifyTicket,
  getServiceHealth
};
