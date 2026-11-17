/**
 * resolution.agent.js
 * Specialized Agent for Evidence-Backed Resolution Recommendation Synthesis.
 */

const resolutionService = require('../services/recommendation/resolution.service');
const evidenceService = require('../services/recommendation/evidence.service');
const confidenceService = require('../services/recommendation/confidence.service');
const logger = require('../config/logger');

class ResolutionAgent {
  constructor() {
    this.name = 'ResolutionAgent';
  }

  async run(state) {
    logger.info(`[${this.name}] Starting resolution plan synthesis...`);
    const startTime = Date.now();

    try {
      // Extract grounded evidence from retrieved similar tickets before calling recommendation
      let evidence = [];
      if (state.similar_tickets && state.similar_tickets.length > 0) {
        evidence = evidenceService.extractEvidenceFromTickets(state.similar_tickets);
      }

      const recResult = await resolutionService.recommendResolution({
        ticket_id: state.ticket_id,
        title: state.title,
        description: state.description,
        affected_service: state.affected_service,
        environment: state.environment,
        top_k: 3,
        generation_mode: state.generation_mode || 'deterministic',
        user_data_access_level: state.user_data_access_level || 'internal',
        evidence,
        similar_tickets: state.similar_tickets || []
      });

      const latency = Date.now() - startTime;

      return {
        ...state,
        recommendations: recResult.recommendations || [],
        confidence: recResult.confidence || confidenceService.calculateConfidence(evidence),
        clarification_questions: recResult.clarification_questions || [],
        resolution_status: 'completed',
        recommendation_model_version: recResult.model_version || 'rec-v1',
        execution_latency: {
          ...(state.execution_latency || {}),
          recommendation: latency
        }
      };
    } catch (err) {
      logger.error(`[${this.name}] Execution failed: ${err.message}`);
      return {
        ...state,
        recommendations: [],
        confidence: {
          level: 'insufficient_evidence',
          basis: 'Resolution engine failed; manual human triage required.'
        },
        clarification_questions: [
          'What specific error code or telemetry trace was captured?',
          'Has this machine or service been restarted?'
        ],
        resolution_status: 'failed',
        recommendation_model_version: 'fallback-v1',
        execution_latency: {
          ...(state.execution_latency || {}),
          recommendation: Date.now() - startTime
        }
      };
    }
  }
}

const resolutionAgent = new ResolutionAgent();

module.exports = resolutionAgent;
