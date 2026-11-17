/**
 * index.js (API Router)
 * Central API routing registry aggregating all modular domain routers.
 */

const express = require('express');
const router = express.Router();

const authRoutes = require('./routes/auth.routes');
const ticketRoutes = require('./routes/ticket.routes');
const analysisRoutes = require('./routes/analysis.routes');
const searchRoutes = require('./routes/search.routes');
const recommendationRoutes = require('./routes/recommendation.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const adminRoutes = require('./routes/admin.routes');

const analysisController = require('../controllers/analysis.controller');
const auditController = require('../controllers/audit.controller');

// Mount Domain Routers
router.use('/auth', authRoutes);
router.use('/tickets', ticketRoutes);
router.use('/analyses', analysisRoutes);
router.use('/search', searchRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/admin', adminRoutes);

// Direct Aliases & Full Backward Compatibility Routes
// 1. Unified Master Analysis (POST /api/analyze)
router.post('/analyze', analysisController.analyzeTicket);

// 2. Ticket Classification (POST /api/classify & GET /api/classify/health)
router.post('/classify', analysisController.classifyTicket);
router.get('/classify/health', analysisController.getServiceHealth);

// 3. Compliance Audit Trail (GET /api/audit)
router.get('/audit', auditController.getAuditLogs);

// API Root Health
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'IT Ticket Resolution Assistant - Modular Primary Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
