/**
 * search.controller.js
 * Controller for Ticket Full-Text, Semantic Vector, and Hybrid Search Operations.
 */

const ticketService = require('../services/ticket/ticket.service');
const hybridSearchService = require('../services/retrieval/hybrid-search.service');
const vectorSearchService = require('../services/retrieval/vector-search.service');
const chunkingService = require('../services/retrieval/chunking.service');
const { successResponse, paginatedResponse } = require('../utils/response');

const search = async (req, res, next) => {
  try {
    const { q, category, status, priority, page, limit } = req.query;
    const result = await ticketService.searchTickets({ q, category, status, priority, page, limit });
    return paginatedResponse(res, result.tickets, result.pagination);
  } catch (err) {
    next(err);
  }
};

const hybridSearch = async (req, res, next) => {
  try {
    const { query, top_k = 5, category } = req.body;
    const results = await hybridSearchService.retrieve({
      title: query || '',
      description: query || '',
      top_k: parseInt(top_k, 10) || 5,
      filters: { category }
    });
    return successResponse(res, results);
  } catch (err) {
    next(err);
  }
};

const semanticSearch = async (req, res, next) => {
  try {
    const { query, top_k = 5, category } = req.body;
    const results = await vectorSearchService.search(query || '', {
      top_k: parseInt(top_k, 10) || 5,
      category
    });
    return successResponse(res, results);
  } catch (err) {
    next(err);
  }
};

const inspectChunks = async (req, res, next) => {
  try {
    const { ticket_id = 'INSPECT-01', title = '', description = '', resolution_text = '' } = req.body;
    const chunks = chunkingService.chunkTicket({
      ticket_id,
      title,
      description,
      resolution_text
    });
    return successResponse(res, {
      ticket_id,
      chunks_count: chunks.length,
      chunks
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  search,
  hybridSearch,
  semanticSearch,
  inspectChunks
};
