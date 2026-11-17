/**
 * mttr.service.js
 * Mean Time To Resolution (MTTR) calculation engine.
 */

const { Ticket, ticketRepository } = require('../../repositories/ticket.repository');

class MTTRService {
  async calculateMTTR(filter = {}) {
    const matchStage = {
      status: { $in: ['Resolved', 'Closed'] },
      resolved_at: { $exists: true, $ne: null },
      created_at: { $exists: true, $ne: null },
      ...filter
    };

    try {
      const results = await Ticket.aggregate([
        { $match: matchStage },
        {
          $project: {
            category: 1,
            priority: 1,
            affected_service: 1,
            resolutionTimeHours: {
              $divide: [{ $subtract: ['$resolved_at', '$created_at'] }, 1000 * 60 * 60]
            }
          }
        },
        {
          $group: {
            _id: null,
            overallMTTRHours: { $avg: '$resolutionTimeHours' },
            resolvedCount: { $sum: 1 },
            minResolutionHours: { $min: '$resolutionTimeHours' },
            maxResolutionHours: { $max: '$resolutionTimeHours' }
          }
        }
      ]);

      const summary = results[0];

      if (summary && summary.resolvedCount > 0) {
        // Calculate MTTR by category
        const categoryMTTR = await Ticket.aggregate([
          { $match: matchStage },
          {
            $project: {
              category: 1,
              resolutionTimeHours: {
                $divide: [{ $subtract: ['$resolved_at', '$created_at'] }, 1000 * 60 * 60]
              }
            }
          },
          {
            $group: {
              _id: '$category',
              avgHours: { $avg: '$resolutionTimeHours' },
              count: { $sum: 1 }
            }
          },
          { $sort: { avgHours: -1 } }
        ]);

        // Calculate MTTR by priority
        const priorityMTTR = await Ticket.aggregate([
          { $match: matchStage },
          {
            $project: {
              priority: 1,
              resolutionTimeHours: {
                $divide: [{ $subtract: ['$resolved_at', '$created_at'] }, 1000 * 60 * 60]
              }
            }
          },
          {
            $group: {
              _id: '$priority',
              avgHours: { $avg: '$resolutionTimeHours' },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        return {
          overall: {
            avgHours: Number((summary.overallMTTRHours || 0).toFixed(2)),
            resolvedCount: summary.resolvedCount,
            minHours: Number((summary.minResolutionHours || 0).toFixed(2)),
            maxHours: Number((summary.maxResolutionHours || 0).toFixed(2))
          },
          byCategory: categoryMTTR.map((c) => ({
            category: c._id,
            avgHours: Number(c.avgHours.toFixed(2)),
            count: c.count
          })),
          byPriority: priorityMTTR.map((p) => ({
            priority: p._id,
            avgHours: Number(p.avgHours.toFixed(2)),
            count: p.count
          }))
        };
      }
    } catch {
      // In-memory fallback
    }

    // Fallback: in-memory computation
    const { tickets } = await ticketRepository.findAll({}, { limit: 500 });
    const resolved = tickets.filter(
      (t) =>
        ['Resolved', 'Closed'].includes(t.status) &&
        t.created_at &&
        t.resolved_at &&
        new Date(t.resolved_at) >= new Date(t.created_at)
    );

    if (resolved.length === 0) {
      return {
        overall: { avgHours: 0, resolvedCount: 0, minHours: 0, maxHours: 0 },
        byCategory: [],
        byPriority: []
      };
    }

    const times = resolved.map((t) => {
      const ms = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
      return Math.max(0, ms / (1000 * 60 * 60));
    });

    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / times.length;

    return {
      overall: {
        avgHours: Number(avg.toFixed(2)),
        resolvedCount: resolved.length,
        minHours: Number(Math.min(...times).toFixed(2)),
        maxHours: Number(Math.max(...times).toFixed(2))
      },
      byCategory: [],
      byPriority: []
    };
  }
}

const mttrService = new MTTRService();

module.exports = mttrService;
