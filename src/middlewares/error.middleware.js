/**
 * error.middleware.js
 * Centralized Express Error Handling Middleware.
 */

const logger = require('../config/logger');

const errorMiddleware = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, err.stack);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message
    }));
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue || {})[0] || 'field';
    const duplicatedValue = err.keyValue ? err.keyValue[duplicatedField] : '';
    message = `Duplicate value: '${duplicatedValue}' already exists for unique field '${duplicatedField}'`;
    details = err.keyValue;
  }

  // Handle Mongoose CastError (invalid ObjectId or type casting)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field '${err.path}'`;
    details = { value: err.value, expectedType: err.kind };
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    details,
    correlation_id: req.correlationId || req.headers['x-correlation-id'] || null,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorMiddleware;
