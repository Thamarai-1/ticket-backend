/**
 * analytics.controller.js
 * Controller for IT Service Analytics, MTTR tracking, and Executive Dashboard metrics.
 */

const dashboardService = require('../services/analytics/dashboard.service');
const mttrService = require('../services/analytics/mttr.service');
const metricsService = require('../services/analytics/metrics.service');
const { successResponse } = require('../utils/response');

const getDashboardOverview = async (req, res, next) => {
  try {
    const data = await dashboardService.getDashboardOverview();
    return successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

const getMTTRMetrics = async (req, res, next) => {
  try {
    const { category, priority } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const data = await mttrService.calculateMTTR(filter);
    return successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

const getOperationalMetrics = async (req, res, next) => {
  try {
    const data = await metricsService.getOperationalMetrics();
    return successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardOverview,
  getMTTRMetrics,
  getOperationalMetrics
};
