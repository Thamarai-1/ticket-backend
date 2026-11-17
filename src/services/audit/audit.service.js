/**
 * audit.service.js
 * Immutable Audit Event Logging Service (FR-08 Traceability and Compliance).
 */

const { auditRepository } = require('../../repositories/audit.repository');
const logger = require('../../config/logger');

class AuditService {
  async logEvent({
    event_type,
    correlation_id,
    analysis_id = null,
    ticket_id = null,
    actor_reference = { actor_id: 'system', actor_type: 'system' },
    component_status = 'completed',
    metadata = {}
  }) {
    try {
      const event_id = `AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const event = await auditRepository.create({
        event_id,
        correlation_id: correlation_id || `CORR-${Date.now()}`,
        analysis_id,
        ticket_id,
        event_type,
        actor_reference,
        component_status,
        metadata,
        timestamp: new Date()
      });

      return event;
    } catch (err) {
      logger.error(`Failed to persist audit event ${event_type}: ${err.message}`);
      return null;
    }
  }

  async getAuditLogs(filter = {}, pagination = {}) {
    return auditRepository.findAll(filter, pagination);
  }
}

const auditService = new AuditService();

module.exports = auditService;
