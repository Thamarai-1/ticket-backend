/**
 * feedback.repository.js
 * Data Access Layer for Analyst Feedback (FR-06).
 */

const mongoose = require('mongoose');
const { FEEDBACK_STATUSES, TARGET_TYPES } = require('../utils/constants');

const analystFeedbackSchema = new mongoose.Schema(
  {
    feedback_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    analysis_id: {
      type: String,
      required: true,
      ref: 'Analysis',
      index: true
    },
    target_type: {
      type: String,
      required: true,
      enum: {
        values: TARGET_TYPES,
        message: '{VALUE} is not a supported feedback target_type'
      }
    },
    target_id: {
      type: String,
      required: true,
      trim: true
    },
    reviewer_reference: {
      user_id: { type: String, default: 'analyst-current' },
      role: { type: String, default: 'IT Support Analyst' },
      name: { type: String, default: 'IT Triage Specialist' }
    },
    feedback_status: {
      type: String,
      required: true,
      enum: {
        values: FEEDBACK_STATUSES,
        message: '{VALUE} is not a valid feedback status (must be useful, incorrect, or unresolved)'
      }
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
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

analystFeedbackSchema.index({ analysis_id: 1, target_id: 1 });

const AnalystFeedbackModel =
  mongoose.models.AnalystFeedback || mongoose.model('AnalystFeedback', analystFeedbackSchema);

const inMemoryFeedback = [];

class FeedbackRepository {
  isDbConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  async create(data) {
    const raw = { ...data, created_at: data.created_at || new Date(), updated_at: new Date() };
    inMemoryFeedback.push(raw);

    if (this.isDbConnected()) {
      try {
        const doc = new AnalystFeedbackModel(raw);
        return await doc.save();
      } catch {
        // fallback
      }
    }
    return raw;
  }

  async findByAnalysisId(analysisId) {
    const cleanId = String(analysisId).trim();
    if (this.isDbConnected()) {
      try {
        const docs = await AnalystFeedbackModel.find({
          analysis_id: { $regex: new RegExp(`^${cleanId}$`, 'i') }
        })
          .sort({ created_at: -1 })
          .lean();
        if (docs && docs.length > 0) return docs;
      } catch {
        // fallback
      }
    }

    return inMemoryFeedback.filter(
      (f) => f.analysis_id && f.analysis_id.toLowerCase() === cleanId.toLowerCase()
    );
  }

  async findAll(filter = {}, { skip = 0, limit = 20 } = {}) {
    if (this.isDbConnected()) {
      try {
        const [feedbacks, total] = await Promise.all([
          AnalystFeedbackModel.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
          AnalystFeedbackModel.countDocuments(filter)
        ]);
        if (total > 0) return { feedbacks, total };
      } catch {
        // fallback
      }
    }

    return {
      feedbacks: inMemoryFeedback.slice(skip, skip + limit),
      total: inMemoryFeedback.length
    };
  }
}

const feedbackRepository = new FeedbackRepository();

module.exports = {
  FeedbackRepository,
  feedbackRepository,
  AnalystFeedback: AnalystFeedbackModel,
  analystFeedbackSchema,
  FEEDBACK_STATUSES,
  TARGET_TYPES
};
