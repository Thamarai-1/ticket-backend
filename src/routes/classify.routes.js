/**
 * classify.routes.js (Compatibility Bridge)
 * Re-exports classification routes.
 */

const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysis.controller');

router.post('/', analysisController.classifyTicket);
router.get('/health', analysisController.getServiceHealth);

module.exports = router;
