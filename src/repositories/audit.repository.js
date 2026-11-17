/**
 * audit.repository.js
 * Data Access Layer for Immutable Compliance Audit Logs (FR-08).
 */

const mongoose = require('mongoose');
const { AUDIT_EVENT_TYPES } = require('../utils/constants');

const auditEventSchema = new mongoose.Schema(
  {
    event_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    correlation_id: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    analysis_id: {
      type: String,
      trim: true,
      index: true,
      default: null
    },
    ticket_id: {
      type: String,
      trim: true,
      index: true,
      default: null
    },
    event_type: {
      type: String,
      required: true,
      enum: {
        values: AUDIT_EVENT_TYPES,
        message: '{VALUE} is not a valid audit event type'
      },
      index: true
    },
    actor_reference: {
      actor_id: { type: String, default: 'system' },
      actor_type: {
        type: String,
        enum: ['system', 'user', 'analyst', 'seeder', 'agent'],
        default: 'system'
      },
      ip_address: { type: String, default: null }
    },
    component_status: {
      type: String,
      enum: ['started', 'completed', 'failed', 'unavailable', 'skipped'],
      default: 'completed'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    versionKey: false
  }
);

auditEventSchema.index({ correlation_id: 1, timestamp: 1 });
auditEventSchema.index({ event_type: 1, timestamp: -1 });

const AuditEventModel = mongoose.models.AuditEvent || mongoose.model('AuditEvent', auditEventSchema);

class AuditRepository {
  async create(data) {
    const doc = new AuditEventModel(data);
    return doc.save();
  }

  async findAll(filter = {}, { skip = 0, limit = 20, sort = { timestamp: -1 } } = {}) {
    const [logs, total] = await Promise.all([
      AuditEventModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      AuditEventModel.countDocuments(filter)
    ]);
    return { logs, total };
  }
}

const auditRepository = new AuditRepository();

module.exports = {
  AuditRepository,
  auditRepository,
  AuditEvent: AuditEventModel,
  auditEventSchema,
  AUDIT_EVENT_TYPES
};
