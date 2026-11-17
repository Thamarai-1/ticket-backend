/**
 * admin.routes.js
 * Express routes for System Administration, Compliance Audit, and Maintenance Jobs.
 */

const express = require('express');
const router = express.Router();
const auditController = require('../../controllers/audit.controller');
const embeddingJob = require('../../jobs/embedding.job');
const analyticsJob = require('../../jobs/analytics.job');
const { successResponse } = require('../../utils/response');

// Compliance Audit Log inspection
router.get('/audit', auditController.getAuditLogs);

// Background Job triggers
router.post('/jobs/embedding', async (req, res, next) => {
  try {
    const result = await embeddingJob.runBatch(req.body.batchSize || 50);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/jobs/analytics', async (req, res, next) => {
  try {
    const result = await analyticsJob.runAggregation();
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
