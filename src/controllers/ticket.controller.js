/**
 * ticket.controller.js
 * Express Controller handling HTTP Requests and Responses for Ticket Operations.
 */

const ticketService = require('../services/ticket/ticket.service');
const { successResponse, paginatedResponse } = require('../utils/response');

const getTickets = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      category,
      priority,
      status,
      affected_service,
      environment,
      startDate,
      endDate,
      sortBy,
      sortOrder
    } = req.query;

    const result = await ticketService.listTickets({
      page,
      limit,
      category,
      priority,
      status,
      affected_service,
      environment,
      startDate,
      endDate,
      sortBy,
      sortOrder
    });

    return paginatedResponse(res, result.tickets, result.pagination);
  } catch (error) {
    next(error);
  }
};

const getTicketById = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const ticket = await ticketService.getTicketById(ticketId, req.user);
    return successResponse(res, ticket);
  } catch (error) {
    next(error);
  }
};

const createTicket = async (req, res, next) => {
  try {
    const ticket = await ticketService.createTicket(req.body, {
      actor_id: req.headers['x-user-id'] || req.userId || 'analyst_01',
      actor_type: 'user',
      ip_address: req.ip
    });

    return successResponse(res, ticket, 201, 'Ticket created successfully');
  } catch (error) {
    next(error);
  }
};

const updateTicket = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const updated = await ticketService.updateTicket(ticketId, req.body, {
      actor_id: req.headers['x-user-id'] || req.userId || 'analyst_01',
      actor_type: 'user'
    });

    return successResponse(res, updated, 200, 'Ticket updated successfully');
  } catch (error) {
    next(error);
  }
};

const searchTickets = async (req, res, next) => {
  try {
    const { q, category, status, priority, page, limit } = req.query;

    const result = await ticketService.searchTickets({
      q,
      category,
      status,
      priority,
      page,
      limit
    });

    return paginatedResponse(res, result.tickets, result.pagination);
  } catch (error) {
    next(error);
  }
};

const getTicketStats = async (req, res, next) => {
  try {
    const stats = await ticketService.getStats();
    return successResponse(res, stats);
  } catch (error) {
    next(error);
  }
};

const getTicketChunks = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const ticket = await ticketService.getTicketById(ticketId, req.user);
    const chunkingService = require('../services/retrieval/chunking.service');
    const chunks = chunkingService.chunkTicket(ticket);
    return successResponse(res, {
      ticket_id: ticket.ticket_id,
      chunks_count: chunks.length,
      chunks
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTickets,
  getTicketById,
  getTicketChunks,
  createTicket,
  updateTicket,
  searchTickets,
  getTicketStats
};
