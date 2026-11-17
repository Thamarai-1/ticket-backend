/**
 * metrics.service.js
 * Operational KPI and SLA metrics aggregation.
 */

const { Ticket } = require('../../repositories/ticket.repository');

class MetricsService {
  async getOperationalMetrics() {
    const total = await Ticket.countDocuments();
    const open = await Ticket.countDocuments({ status: { $in: ['New', 'Assigned', 'In Progress', 'Pending'] } });
    const resolved = await Ticket.countDocuments({ status: { $in: ['Resolved', 'Closed'] } });
    const p1Count = await Ticket.countDocuments({ priority: 'P1' });
    const p1Open = await Ticket.countDocuments({ priority: 'P1', status: { $in: ['New', 'Assigned', 'In Progress'] } });

    const resolutionRate = total > 0 ? Number(((resolved / total) * 100).toFixed(2)) : 0;

    return {
      totalTickets: total,
      openTickets: open,
      resolvedTickets: resolved,
      resolutionRatePercentage: resolutionRate,
      criticalIncidents: {
        totalP1: p1Count,
        openP1: p1Open
      }
    };
  }
}

const metricsService = new MetricsService();

module.exports = metricsService;
