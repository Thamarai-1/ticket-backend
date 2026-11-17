/**
 * recommendation.controller.js
 * Controller for Standalone Evidence-Backed Resolution Recommendation (Phase 4).
 */

const { ticketRepository } = require('../repositories/ticket.repository');
const mlService = require('../services/ml.service');
const auditService = require('../services/audit/audit.service');
const { successResponse } = require('../utils/response');

const getRecommendation = async (req, res, next) => {
  try {
    let {
      ticket_id,
      title,
      description,
      affected_service,
      environment,
      top_k = 3,
      generation_mode = 'deterministic'
    } = req.body;

    const correlation_id = req.headers['x-correlation-id'] || req.correlationId || `CORR-REC-${Date.now()}`;
    const userAccess = req.headers['x-user-access-level'] || req.userAccessLevel || 'internal';

    // If ticket_id provided, fetch ground-truth record from repository if needed
    if (ticket_id && (!title || !description)) {
      const existingTicket = await ticketRepository.findByTicketId(ticket_id);

      if (!existingTicket) {
        return res.status(404).json({
          success: false,
          error: `Ticket with ID '${ticket_id}' was not found`,
          timestamp: new Date().toISOString()
        });
      }

      title = title || existingTicket.title;
      description = description || existingTicket.description;
      affected_service = affected_service || existingTicket.affected_service;
      environment = environment || existingTicket.environment;
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'title is required to generate resolution recommendations',
        timestamp: new Date().toISOString()
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'description is required to generate resolution recommendations',
        timestamp: new Date().toISOString()
      });
    }

    const recResult = await mlService.recommendResolution({
      ticket_id,
      title: title.trim(),
      description: description.trim(),
      affected_service: affected_service ? affected_service.trim() : null,
      environment: environment ? environment.trim() : null,
      top_k: Math.min(10, Math.max(1, parseInt(top_k, 10) || 3)),
      generation_mode,
      user_data_access_level: userAccess
    });

    await auditService.logEvent({
      event_type: 'RECOMMENDATION_COMPLETED',
      correlation_id,
      ticket_id: ticket_id || null,
      component_status: 'completed',
      metadata: {
        recommendation_count: recResult.recommendations ? recResult.recommendations.length : 0,
        confidence_level: recResult.confidence ? recResult.confidence.level : 'unknown',
        generation_mode
      }
    });

    return successResponse(res, recResult);
  } catch (error) {
    if (error.statusCode === 503 || error.statusCode === 504) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        fallback: {
          ticket_id: req.body.ticket_id || null,
          recommendation_status: 'human_review_required',
          recommendations: [],
          confidence: {
            level: 'insufficient_evidence',
            basis: 'ML Recommendation service is offline; automated suggestions suspended.'
          },
          review_required: true,
          review_reason: 'ML Service unreachable. Manual human triage required.',
          clarification_questions: [
            'What specific symptoms or error messages are observed?',
            'Has this issue occurred previously on this system?'
          ],
          model_version: 'fallback-offline'
        },
        timestamp: new Date().toISOString()
      });
    }
    next(error);
  }
};

module.exports = {
  getRecommendation
};
