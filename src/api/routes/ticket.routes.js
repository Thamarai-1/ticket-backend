/**
 * ticket.routes.js
 * Express routes for Ticket Management, Search, Similarity, and Stats.
 */

const express = require('express');
const router = express.Router();
const ticketController = require('../../controllers/ticket.controller');
const retrievalController = require('../../controllers/retrieval.controller');
const recommendationController = require('../../controllers/recommendation.controller');
const { validateCreateTicket } = require('../../middlewares/validation.middleware');

// Aggregations, Search, Similarity, & Recommendation routes (defined BEFORE /:ticketId)
router.get('/search', ticketController.searchTickets);
router.get('/stats', ticketController.getTicketStats);
router.post('/similar', retrievalController.getSimilarTickets);
router.post('/recommend', recommendationController.getRecommendation);

// Collection operations
router.get('/', ticketController.getTickets);
router.post('/', validateCreateTicket, ticketController.createTicket);

// Individual ticket operations
router.get('/:ticketId', ticketController.getTicketById);
router.get('/:ticketId/chunks', ticketController.getTicketChunks);
router.put('/:ticketId', ticketController.updateTicket);

module.exports = router;
