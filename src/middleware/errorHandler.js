/**
 * errorHandler.js (Compatibility Bridge)
 * Re-exports error middleware from src/middlewares/error.middleware.js
 */

const errorMiddleware = require('../middlewares/error.middleware');

module.exports = errorMiddleware;
