/**
 * analytics.job.js
 * Background worker for pre-computing analytical aggregates and MTTR metrics.
 */

const dashboardService = require('../services/analytics/dashboard.service');
const logger = require('../config/logger');

class AnalyticsJob {
  async runAggregation() {
    logger.info('[AnalyticsJob] Refreshing operational analytics aggregates...');
    try {
      const summary = await dashboardService.getDashboardOverview();
      logger.info(
        `[AnalyticsJob] Aggregated metrics for ${summary.kpiSummary.totalTickets} tickets (MTTR: ${summary.mttrAnalytics.overall.avgHours}h).`
      );
      return { success: true, summary };
    } catch (err) {
      logger.error(`[AnalyticsJob] Aggregation failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

const analyticsJob = new AnalyticsJob();

module.exports = analyticsJob;
