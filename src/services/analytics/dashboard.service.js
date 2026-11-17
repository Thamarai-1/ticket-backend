/**
 * dashboard.service.js
 * Synthesizes high-level executive and triage dashboards.
 */

const { ticketRepository } = require('../../repositories/ticket.repository');
const mttrService = require('./mttr.service');
const metricsService = require('./metrics.service');

class DashboardService {
  async getDashboardOverview() {
    const [stats, mttr, metrics] = await Promise.all([
      ticketRepository.getStats(),
      mttrService.calculateMTTR(),
      metricsService.getOperationalMetrics()
    ]);

    return {
      kpiSummary: metrics,
      mttrAnalytics: mttr,
      distribution: {
        byCategory: stats.categoryDistribution,
        byPriority: stats.priorityDistribution,
        byStatus: stats.statusDistribution
      },
      resolutionMetrics: stats.resolutionMetrics,
      generatedAt: new Date().toISOString()
    };
  }
}

const dashboardService = new DashboardService();

module.exports = dashboardService;
