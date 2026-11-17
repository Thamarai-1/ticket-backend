/**
 * AuditEvent.js (Compatibility Bridge)
 * Re-exports AuditEvent model and constants from audit repository.
 */

const {
  AuditEvent,
  auditEventSchema,
  AUDIT_EVENT_TYPES
} = require('../repositories/audit.repository');

module.exports = {
  AuditEvent,
  auditEventSchema,
  AUDIT_EVENT_TYPES
};
