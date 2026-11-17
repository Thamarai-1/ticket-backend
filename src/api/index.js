/**
 * index.js (API Router)
 * Central API routing registry aggregating all modular domain routers.
 * Enforces mandatory authentication middleware across all operational and domain routes.
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
const { authenticate } = require('../middlewares/auth.middleware');

// =========================================================================
// Public Routes (No authentication token required)
// =========================================================================

// 1. API Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'IT Ticket Resolution Assistant - Modular Primary Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// 2. Authentication Router (contains public /register & /login, protected /me & /logout)
router.use('/auth', authRoutes);

// =========================================================================
// Mandatory Authentication Middleware for ALL downstream API routes
// Any subsequent endpoint strictly requires a valid Bearer token
// =========================================================================
router.use(authenticate);

// =========================================================================
// Protected Domain Routers
// =========================================================================
router.use('/tickets', ticketRoutes);
router.use('/analyses', analysisRoutes);
router.use('/search', searchRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/admin', adminRoutes);

// Protected Direct Aliases & Backward Compatibility Routes
router.post('/analyze', analysisController.analyzeTicket);
router.post('/classify', analysisController.classifyTicket);
router.get('/classify/health', analysisController.getServiceHealth);
router.get('/audit', auditController.getAuditLogs);

module.exports = router;
