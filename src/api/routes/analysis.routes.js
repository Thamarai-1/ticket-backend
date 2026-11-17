/**
 * analysis.routes.js
 * Express routes for Unified Ticket Analysis and Historical Records (Phases 5 & 6).
 */

const express = require('express');
const router = express.Router();
const analysisController = require('../../controllers/analysis.controller');
const feedbackController = require('../../controllers/feedback.controller');

// Master Unified Analysis Pipeline
router.post('/analyze', analysisController.analyzeTicket);
router.post('/', analysisController.analyzeTicket);

// Historical Analysis Records
router.get('/', analysisController.getAnalyses);
router.get('/:analysisId', analysisController.getAnalysisById);

// Analyst Feedback Endpoints (FR-06)
router.post('/:analysisId/feedback', feedbackController.submitFeedback);
router.get('/:analysisId/feedback', feedbackController.getFeedbackByAnalysis);

module.exports = router;
