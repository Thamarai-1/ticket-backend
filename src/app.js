/**
 * app.js (Compatibility Bridge)
 * Re-exports Express application from src/config/app.js
 */

const app = require('./config/app');

module.exports = app;
