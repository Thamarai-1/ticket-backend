/**
 * mttr.service.js
 * Mean Time To Resolution (MTTR) calculation engine.
 */

const { Ticket } = require('../../repositories/ticket.repository');

class MTTRService {
  async calculateMTTR(filter = {}) {
    const matchStage = {
      status: { $in: ['Resolved', 'Closed'] },
      resolved_at: { $exists: true, $ne: null },
      created_at: { $exists: true, $ne: null },
      ...filter
    };

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

    const summary = results[0] || {
      overallMTTRHours: 0,
      resolvedCount: 0,
      minResolutionHours: 0,
      maxResolutionHours: 0
    };

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
}

const mttrService = new MTTRService();

module.exports = mttrService;
