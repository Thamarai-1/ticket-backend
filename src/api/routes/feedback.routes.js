/**
 * feedback.routes.js
 * Express routes for Analyst Feedback Management (FR-06).
 */

const express = require('express');
const router = express.Router();
const feedbackController = require('../../controllers/feedback.controller');

router.post('/:analysisId', feedbackController.submitFeedback);
router.get('/:analysisId', feedbackController.getFeedbackByAnalysis);

module.exports = router;
