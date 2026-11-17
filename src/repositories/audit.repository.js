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

const inMemoryAuditLogs = [];

class AuditRepository {
  isDbConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  async create(data) {
    const raw = { ...data, timestamp: data.timestamp || new Date() };
    inMemoryAuditLogs.unshift(raw);

    if (this.isDbConnected()) {
      try {
        const doc = new AuditEventModel(raw);
        return await doc.save();
      } catch {
        // fallback
      }
    }
    return raw;
  }

  async findAll(filter = {}, { skip = 0, limit = 20, sort = { timestamp: -1 } } = {}) {
    if (this.isDbConnected()) {
      try {
        const [logs, total] = await Promise.all([
          AuditEventModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
          AuditEventModel.countDocuments(filter)
        ]);
        if (total > 0) return { logs, total };
      } catch {
        // fallback
      }
    }

    let filtered = inMemoryAuditLogs;
    if (filter.analysis_id) {
      filtered = filtered.filter((l) => l.analysis_id === filter.analysis_id);
    }
    if (filter.ticket_id) {
      filtered = filtered.filter((l) => l.ticket_id === filter.ticket_id);
    }
    if (filter.event_type) {
      filtered = filtered.filter((l) => l.event_type === filter.event_type);
    }

    return {
      logs: filtered.slice(skip, skip + limit),
      total: filtered.length
    };
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
