/**
 * audit.routes.js (Compatibility Bridge)
 * Re-exports admin audit routes from src/api/routes/admin.routes.js
 */

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');

router.get('/', auditController.getAuditLogs);

module.exports = router;
