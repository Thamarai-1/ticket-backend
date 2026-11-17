/**
 * app.js
 * Express Application Configuration and Middleware Pipeline.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./env');
const apiRouter = require('../api/index');
const requestIdMiddleware = require('../middlewares/request-id.middleware');
const rateLimitMiddleware = require('../middlewares/rate-limit.middleware');
const errorMiddleware = require('../middlewares/error.middleware');

const app = express();

// Security and Cross-Origin Configuration
app.use(
  cors({
    origin: env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-id',
      'x-user-role',
      'x-user-access-level',
      'x-correlation-id',
      'x-request-id'
    ]
  })
);

// Body Parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Traceability & Rate Limiting
app.use(requestIdMiddleware);
app.use(rateLimitMiddleware({ max: 300, windowMs: 60 * 1000 }));

// Request Logging
if (!env.isTest) {
  app.use(morgan('dev'));
}

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'IT Ticket Resolution Assistant - Backend',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Mount Main Modular API Router
app.use('/api', apiRouter);

// Catch-all 404 Route
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Centralized Error Handling Middleware
app.use(errorMiddleware);

module.exports = app;
