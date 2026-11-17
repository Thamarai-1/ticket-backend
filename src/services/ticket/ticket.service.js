/**
 * ticket.service.js
 * Core Ticket Management Service.
 */

const { ticketRepository } = require('../../repositories/ticket.repository');
const { auditRepository } = require('../../repositories/audit.repository');
const ticketValidationService = require('./ticket-validation.service');
const ticketNormalizationService = require('./ticket-normalization.service');
const { parsePagination, formatPagination } = require('../../utils/pagination');
const { NotFoundError, ForbiddenError } = require('../../utils/errors');

class TicketService {
  async listTickets(queryParams = {}) {
    const {
      page = 1,
      limit = 20,
      category,
      priority,
      status,
      affected_service,
      environment,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = queryParams;

    const query = {};
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (status) query.status = status;
    if (affected_service) query.affected_service = affected_service;
    if (environment) query.environment = environment;

    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }

    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortDirection };

    const { tickets, total } = await ticketRepository.findAll(query, { skip, limit: limitNum, sort });

    return {
      tickets,
      pagination: formatPagination(total, pageNum, limitNum)
    };
  }

  async getTicketById(ticketId, user = null) {
    const ticket = await ticketRepository.findByTicketId(ticketId);
    if (!ticket) {
      throw new NotFoundError(`Ticket with ID '${ticketId}' was not found`);
    }

    if (user) {
      const isRestrictedRole = user.role === 'user';
      const isRestrictedTicket =
        ticket.data_access_level === 'restricted' || ticket.data_access_level === 'confidential';

      const clearanceRank = { public: 1, internal: 2, confidential: 3, restricted: 4 };
      const userRank = user.role === 'admin' ? 4 : (clearanceRank[user.access_level] || 2);
      const ticketRank = clearanceRank[ticket.data_access_level] || 2;

      const isOwner =
        ticket.created_by &&
        (ticket.created_by === user.user_id || ticket.created_by === user.email);

      if (isRestrictedRole && isRestrictedTicket && !isOwner) {
        throw new ForbiddenError(
          "Access denied: You do not have permission to access another user's protected ticket"
        );
      }

      if (userRank < ticketRank && !isOwner) {
        throw new ForbiddenError(
          `Access denied: Ticket requires '${ticket.data_access_level}' clearance level`
        );
      }
    }

    return ticket;
  }

  async createTicket(ticketData, actor = { actor_id: 'api_user', actor_type: 'user' }) {
    ticketValidationService.validateTicketPayload(ticketData);
    const normalized = ticketNormalizationService.normalizeTicket(ticketData);

    let nextTicketId = normalized.ticket_id;
    if (!nextTicketId) {
      const latest = await ticketRepository.findLatestTicket();
      let nextNum = 1001;
      if (latest && latest.ticket_id) {
        const match = latest.ticket_id.match(/^INC-(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      }
      nextTicketId = `INC-${nextNum}`;
    }

    normalized.ticket_id = nextTicketId;
    const saved = await ticketRepository.create(normalized);

    // Audit log
    await auditRepository.create({
      event_id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      correlation_id: `CORR-${Date.now()}`,
      event_type: 'TICKET_CREATED',
      ticket_id: saved.ticket_id,
      actor_reference: actor,
      metadata: {
        title: saved.title,
        category: saved.category,
        priority: saved.priority,
        status: saved.status,
        affected_service: saved.affected_service
      }
    });

    return saved;
  }

  async updateTicket(ticketId, updateData, actor = { actor_id: 'api_user', actor_type: 'user' }) {
    ticketValidationService.validateTicketPayload(updateData, true);
    const normalized = ticketNormalizationService.normalizeTicket(updateData);

    const updated = await ticketRepository.update(ticketId, normalized);
    if (!updated) {
      throw new NotFoundError(`Ticket with ID '${ticketId}' was not found`);
    }

    await auditRepository.create({
      event_id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      correlation_id: `CORR-${Date.now()}`,
      event_type: 'TICKET_UPDATED',
      ticket_id: updated.ticket_id,
      actor_reference: actor,
      metadata: updateData
    });

    return updated;
  }

  async searchTickets(params = {}) {
    const { q, category, status, priority, page = 1, limit = 20 } = params;
    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit });

    const { tickets, total } = await ticketRepository.search({
      q,
      category,
      status,
      priority,
      skip,
      limit: limitNum
    });

    return {
      tickets,
      pagination: formatPagination(total, pageNum, limitNum)
    };
  }

  async getStats() {
    return ticketRepository.getStats();
  }
}

const ticketService = new TicketService();

module.exports = ticketService;
