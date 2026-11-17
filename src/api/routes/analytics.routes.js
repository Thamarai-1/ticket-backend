/**
 * analytics.routes.js
 * Express routes for Operational Metrics, MTTR Analytics, and Dashboard Overview.
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/analytics.controller');

router.get('/dashboard', analyticsController.getDashboardOverview);
router.get('/mttr', analyticsController.getMTTRMetrics);
router.get('/metrics', analyticsController.getOperationalMetrics);

module.exports = router;
