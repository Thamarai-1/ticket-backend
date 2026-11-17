/**
 * retrieval.agent.js
 * Specialized Agent for Historical Similar Incident Retrieval & Duplicate Detection.
 */

const hybridSearchService = require('../services/retrieval/hybrid-search.service');
const logger = require('../config/logger');

class RetrievalAgent {
  constructor() {
    this.name = 'RetrievalAgent';
  }

  async run(state) {
    logger.info(`[${this.name}] Starting hybrid incident retrieval...`);
    const startTime = Date.now();

    try {
      const result = await hybridSearchService.retrieve({
        ticket_id: state.ticket_id,
        title: state.title,
        description: state.description,
        affected_service: state.affected_service,
        environment: state.environment,
        top_k: state.top_k || 5,
        filters: state.filters
      });

      const latency = Date.now() - startTime;
      const similarTickets = result.results || [];
      const duplicates = similarTickets.filter((t) => t.potential_duplicate);

      return {
        ...state,
        similar_tickets: similarTickets,
        duplicate_candidates: duplicates,
        retrieval_status: 'completed',
        retrieval_model_version: result.retrieval_model_version || 'hybrid-v1',
        execution_latency: {
          ...(state.execution_latency || {}),
          retrieval: latency
        }
      };
    } catch (err) {
      logger.error(`[${this.name}] Execution failed: ${err.message}`);
      return {
        ...state,
        similar_tickets: [],
        duplicate_candidates: [],
        retrieval_status: 'failed',
        retrieval_model_version: 'fallback-v1',
        execution_latency: {
          ...(state.execution_latency || {}),
          retrieval: Date.now() - startTime
        }
      };
    }
  }
}

const retrievalAgent = new RetrievalAgent();

module.exports = retrievalAgent;
