/**
 * ticket.repository.js
 * Data Access Layer for Tickets with Mongoose & Prisma support.
 */

const mongoose = require('mongoose');
const {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_INTENTS,
  ALLOWED_ENVIRONMENTS,
  ALLOWED_STATUSES,
  ALLOWED_ACCESS_LEVELS,
  ALLOWED_SOURCES
} = require('../utils/constants');

const ticketSchema = new mongoose.Schema(
  {
    ticket_id: {
      type: String,
      required: [true, 'ticket_id is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^INC-\d{4,8}$/, 'ticket_id must follow the pattern INC-XXXX (e.g. INC-1001)']
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: [5, 'title must be at least 5 characters long'],
      maxlength: [200, 'title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
      minlength: [10, 'description must be at least 10 characters long'],
      maxlength: [5000, 'description cannot exceed 5000 characters']
    },
    raw_text: {
      type: String,
      trim: true,
      default: function () {
        return `Title: ${this.title || ''}\nDescription: ${this.description || ''}`;
      }
    },
    category: {
      type: String,
      required: [true, 'category is required'],
      enum: {
        values: ALLOWED_CATEGORIES,
        message: '{VALUE} is not a supported ticket category'
      }
    },
    subcategory: {
      type: String,
      required: [true, 'subcategory is required'],
      trim: true
    },
    priority: {
      type: String,
      required: [true, 'priority is required'],
      enum: {
        values: ALLOWED_PRIORITIES,
        message: '{VALUE} is not a valid priority level (expected P1, P2, P3, or P4)'
      }
    },
    intent: {
      type: String,
      required: [true, 'intent is required'],
      enum: {
        values: ALLOWED_INTENTS,
        message: '{VALUE} is not a valid intent'
      },
      default: 'Incident'
    },
    affected_service: {
      type: String,
      required: [true, 'affected_service is required'],
      trim: true
    },
    environment: {
      type: String,
      required: [true, 'environment is required'],
      enum: {
        values: ALLOWED_ENVIRONMENTS,
        message: '{VALUE} is not a recognized environment'
      },
      default: 'Production'
    },
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: ALLOWED_STATUSES,
        message: '{VALUE} is not a valid ticket status'
      },
      default: 'New'
    },
    assignment_group: {
      type: String,
      required: [true, 'assignment_group is required'],
      trim: true
    },
    resolution_text: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function (val) {
          if (['Resolved', 'Closed'].includes(this.status)) {
            return typeof val === 'string' && val.trim().length >= 5;
          }
          return true;
        },
        message: 'A detailed resolution_text (min 5 characters) is required when status is Resolved or Closed'
      }
    },
    created_at: {
      type: Date,
      required: true,
      default: Date.now
    },
    resolved_at: {
      type: Date,
      default: null,
      validate: {
        validator: function (val) {
          if (!val) {
            return !['Resolved', 'Closed'].includes(this.status);
          }
          const created = this.created_at ? new Date(this.created_at) : new Date();
          return new Date(val) >= created;
        },
        message: 'resolved_at cannot precede created_at, and is mandatory for Resolved or Closed tickets'
      }
    },
    source_type: {
      type: String,
      enum: ALLOWED_SOURCES,
      default: 'synthetic'
    },
    data_access_level: {
      type: String,
      enum: ALLOWED_ACCESS_LEVELS,
      default: 'internal'
    }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

// Indexes
ticketSchema.index({ category: 1, status: 1 });
ticketSchema.index({ priority: 1, created_at: -1 });
ticketSchema.index({ affected_service: 1 });
ticketSchema.index({ created_at: -1 });
ticketSchema.index(
  {
    title: 'text',
    description: 'text',
    resolution_text: 'text'
  },
  {
    name: 'TicketTextSearchIndex',
    weights: {
      title: 5,
      description: 2,
      resolution_text: 1
    }
  }
);

const TicketModel = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);

class TicketRepository {
  async findAll(filter = {}, { skip = 0, limit = 20, sort = { created_at: -1 } } = {}) {
    const [tickets, total] = await Promise.all([
      TicketModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      TicketModel.countDocuments(filter)
    ]);
    return { tickets, total };
  }

  async findByTicketId(ticketId) {
    const cleanId = String(ticketId).trim();
    let ticket = await TicketModel.findOne({
      ticket_id: { $regex: new RegExp(`^${cleanId}$`, 'i') }
    }).lean();

    if (!ticket && cleanId.match(/^[0-9a-fA-F]{24}$/)) {
      ticket = await TicketModel.findById(cleanId).lean();
    }
    return ticket;
  }

  async findLatestTicket() {
    return TicketModel.findOne({ ticket_id: /^INC-\d+$/ })
      .sort({ ticket_id: -1 })
      .lean();
  }

  async create(data) {
    const doc = new TicketModel(data);
    return doc.save();
  }

  async update(ticketId, data) {
    return TicketModel.findOneAndUpdate(
      { ticket_id: { $regex: new RegExp(`^${ticketId.trim()}$`, 'i') } },
      { $set: data },
      { new: true, runValidators: true }
    ).lean();
  }

  async delete(ticketId) {
    return TicketModel.findOneAndDelete({
      ticket_id: { $regex: new RegExp(`^${ticketId.trim()}$`, 'i') }
    }).lean();
  }

  async search({ q, category, status, priority, skip = 0, limit = 20 }) {
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    let projection = {};
    let sortOptions = { created_at: -1 };

    if (q && q.trim()) {
      const cleanQ = q.trim();
      query.$text = { $search: cleanQ };
      projection = { score: { $meta: 'textScore' } };
      sortOptions = { score: { $meta: 'textScore' } };
    }

    try {
      const [tickets, total] = await Promise.all([
        TicketModel.find(query, projection).sort(sortOptions).skip(skip).limit(limit).lean(),
        TicketModel.countDocuments(query)
      ]);
      return { tickets, total };
    } catch {
      // Regex fallback if text index isn't ready
      delete query.$text;
      if (q && q.trim()) {
        const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { ticket_id: { $regex: escaped, $options: 'i' } },
          { title: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
          { affected_service: { $regex: escaped, $options: 'i' } }
        ];
      }
      const [tickets, total] = await Promise.all([
        TicketModel.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
        TicketModel.countDocuments(query)
      ]);
      return { tickets, total };
    }
  }

  async getStats() {
    const stats = await TicketModel.aggregate([
      {
        $facet: {
          totalTickets: [{ $count: 'count' }],
          categoryDistribution: [
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          priorityDistribution: [
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ],
          statusDistribution: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          resolutionMetrics: [
            {
              $group: {
                _id: null,
                resolvedCount: {
                  $sum: { $cond: [{ $in: ['$status', ['Resolved', 'Closed']] }, 1, 0] }
                },
                unresolvedCount: {
                  $sum: { $cond: [{ $not: [{ $in: ['$status', ['Resolved', 'Closed']] }] }, 1, 0] }
                },
                resolvedWithTextCount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $in: ['$status', ['Resolved', 'Closed']] },
                          { $gt: [{ $strLenCP: { $ifNull: ['$resolution_text', ''] } }, 0] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    ]);

    const facet = stats[0] || {};
    const total = facet.totalTickets?.[0]?.count || 0;
    const res = facet.resolutionMetrics?.[0] || {
      resolvedCount: 0,
      unresolvedCount: 0,
      resolvedWithTextCount: 0
    };

    return {
      totalTickets: total,
      categoryDistribution: facet.categoryDistribution || [],
      priorityDistribution: facet.priorityDistribution || [],
      statusDistribution: facet.statusDistribution || [],
      resolutionMetrics: {
        resolved: res.resolvedCount,
        unresolved: res.unresolvedCount,
        resolvedWithResolutionText: res.resolvedWithTextCount,
        resolvedPercentage: total > 0 ? Number(((res.resolvedCount / total) * 100).toFixed(2)) : 0
      }
    };
  }

  async bulkWrite(ops, options = {}) {
    return TicketModel.bulkWrite(ops, options);
  }
}

const ticketRepository = new TicketRepository();

module.exports = {
  TicketRepository,
  ticketRepository,
  Ticket: TicketModel,
  ticketSchema
};
