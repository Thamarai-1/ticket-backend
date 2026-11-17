/**
 * auth.routes.js
 * Express routes for User Authentication (email + password), Registration, Profile, and Logout.
 */

const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { validateRegister, validateLogin } = require('../../middlewares/validation.middleware');
const rateLimitMiddleware = require('../../middlewares/rate-limit.middleware');

// Strict rate limiter for authentication routes to protect against brute-force attacks
const authRateLimiter = rateLimitMiddleware({
  max: 30,
  windowMs: 60 * 1000,
  message: 'Too many authentication attempts. Please try again after 1 minute.'
});

// Public Authentication Endpoints
router.post('/register', authRateLimiter, validateRegister, authController.register);
router.post('/login', authRateLimiter, validateLogin, authController.login);

// Protected User Profile & Session Endpoints
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
