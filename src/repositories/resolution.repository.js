/**
 * resolution.repository.js
 * Data Access Layer for Analysis & Resolution records.
 */

const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema(
  {
    analysis_id: {
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
    ticket_id: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    input_snapshot: {
      title: { type: String, required: true },
      description: { type: String, required: true },
      affected_service: { type: String, default: null },
      environment: { type: String, default: null },
      user_access_level: { type: String, default: 'internal' }
    },
    classification: {
      category: { type: String, default: null },
      subcategory: { type: String, default: null },
      priority: { type: String, default: null },
      intent: { type: String, default: null },
      confidence_score: { type: Number, default: 0.0 },
      calibrated: { type: Boolean, default: false },
      review_required: { type: Boolean, default: false },
      review_reason: { type: String, default: null },
      model_version: { type: String, default: null },
      status: {
        type: String,
        enum: ['completed', 'failed', 'unavailable', 'skipped'],
        default: 'completed'
      }
    },
    similar_tickets: [
      {
        ticket_id: { type: String, required: true },
        title: { type: String, required: true },
        description_excerpt: { type: String },
        affected_service: { type: String },
        category: { type: String },
        status: { type: String },
        similarity_score: { type: Number },
        bm25_score: { type: Number },
        rrf_score: { type: Number },
        hybrid_rank: { type: Number },
        potential_duplicate: { type: Boolean, default: false },
        duplicate_confidence: { type: Number, default: 0.0 },
        duplicate_reason: { type: String },
        match_reason: { type: String }
      }
    ],
    recommendations: [
      {
        recommendation_id: { type: String, required: true },
        title: { type: String, required: true },
        steps: [{ type: String }],
        evidence: [
          {
            source_id: { type: String, required: true },
            source_type: { type: String, default: 'historical_ticket' },
            title: { type: String },
            excerpt: { type: String, required: true },
            relevance_reason: { type: String, required: true },
            similarity_score: { type: Number }
          }
        ],
        limitations: [{ type: String }],
        security_warnings: [{ type: String }]
      }
    ],
    confidence: {
      level: {
        type: String,
        enum: ['high', 'medium', 'low', 'insufficient_evidence'],
        default: 'insufficient_evidence'
      },
      basis: { type: String, default: '' }
    },
    clarification_questions: [{ type: String }],
    review_required: {
      type: Boolean,
      default: true
    },
    review_reasons: [{ type: String }],
    component_statuses: {
      classification: {
        type: String,
        enum: ['completed', 'failed', 'unavailable', 'skipped'],
        default: 'completed'
      },
      retrieval: {
        type: String,
        enum: ['completed', 'failed', 'unavailable', 'skipped'],
        default: 'completed'
      },
      recommendation: {
        type: String,
        enum: ['completed', 'failed', 'unavailable', 'skipped'],
        default: 'completed'
      }
    },
    status: {
      type: String,
      enum: ['completed', 'partial', 'failed', 'review_required'],
      default: 'completed',
      index: true
    },
    model_versions: {
      classification: { type: String, default: 'category-tfidf-logreg-v1' },
      retrieval: { type: String, default: 'hybrid-rrf-v1' },
      recommendation: { type: String, default: 'recommendation-v1' }
    },
    execution_latency_ms: {
      total: { type: Number, default: 0 },
      classification: { type: Number, default: 0 },
      retrieval: { type: Number, default: 0 },
      recommendation: { type: Number, default: 0 },
      orchestration: { type: Number, default: 0 }
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    updated_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

analysisSchema.index({ ticket_id: 1, created_at: -1 });

const AnalysisModel = mongoose.models.Analysis || mongoose.model('Analysis', analysisSchema);

const inMemoryAnalyses = new Map();

class ResolutionRepository {
  isDbConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  async saveAnalysis(data) {
    const raw = { ...data, created_at: data.created_at || new Date(), updated_at: new Date() };
    inMemoryAnalyses.set(raw.analysis_id, raw);

    if (this.isDbConnected()) {
      try {
        const doc = new AnalysisModel(raw);
        return await doc.save();
      } catch {
        // fallback
      }
    }
    return raw;
  }

  async findAnalysisById(analysisId) {
    const cleanId = String(analysisId).trim();
    if (this.isDbConnected()) {
      try {
        const doc = await AnalysisModel.findOne({
          analysis_id: { $regex: new RegExp(`^${cleanId}$`, 'i') }
        }).lean();
        if (doc) return doc;
      } catch {
        // fallback
      }
    }

    for (const [id, a] of inMemoryAnalyses.entries()) {
      if (id.toLowerCase() === cleanId.toLowerCase()) {
        return a;
      }
    }
    return null;
  }

  async findByTicketId(ticketId) {
    const cleanId = String(ticketId).trim();
    if (this.isDbConnected()) {
      try {
        const docs = await AnalysisModel.find({
          ticket_id: { $regex: new RegExp(`^${cleanId}$`, 'i') }
        })
          .sort({ created_at: -1 })
          .lean();
        if (docs && docs.length > 0) return docs;
      } catch {
        // fallback
      }
    }

    const matches = [];
    for (const a of inMemoryAnalyses.values()) {
      if (a.ticket_id && a.ticket_id.toLowerCase() === cleanId.toLowerCase()) {
        matches.push(a);
      }
    }
    return matches;
  }

  async listAnalyses(filter = {}, { skip = 0, limit = 10 } = {}) {
    if (this.isDbConnected()) {
      try {
        const [analyses, total] = await Promise.all([
          AnalysisModel.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
          AnalysisModel.countDocuments(filter)
        ]);
        if (total > 0) return { analyses, total };
      } catch {
        // fallback
      }
    }

    const list = Array.from(inMemoryAnalyses.values());
    return {
      analyses: list.slice(skip, skip + limit),
      total: list.length
    };
  }
}

const resolutionRepository = new ResolutionRepository();

module.exports = {
  ResolutionRepository,
  resolutionRepository,
  Analysis: AnalysisModel,
  analysisSchema
};
