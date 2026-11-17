/**
 * audit.service.js (Compatibility Bridge)
 * Re-exports AuditService from services/audit/audit.service.js
 */

const auditService = require('./audit/audit.service');

module.exports = auditService;
