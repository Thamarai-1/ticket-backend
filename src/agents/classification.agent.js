/**
 * classification.agent.js
 * Specialized Agent for Ticket Classification and Triage.
 */

const classificationService = require('../services/classification/classification.service');
const { taxonomyService } = require('../services/classification/taxonomy.service');
const logger = require('../config/logger');

class ClassificationAgent {
  constructor() {
    this.name = 'ClassificationAgent';
  }

  async run(state) {
    logger.info(`[${this.name}] Starting ticket classification...`);
    const startTime = Date.now();

    try {
      const result = await classificationService.classifyTicket({
        ticket_id: state.ticket_id,
        title: state.title,
        description: state.description,
        affected_service: state.affected_service
      });

      const latency = Date.now() - startTime;
      const category = result.classification?.category || 'Software';
      const priority = result.classification?.priority || 'P3';
      const slaHours = taxonomyService.getSlaHours(category, priority);

      return {
        ...state,
        classification: {
          ...result.classification,
          confidence_score: result.confidence?.category_score || 0.0,
          calibrated: result.confidence?.calibrated || false,
          review_required: result.review_required || false,
          review_reason: result.review_reason || null,
          model_version: result.model_version || 'v1',
          sla_target_hours: slaHours,
          status: 'completed'
        },
        execution_latency: {
          ...(state.execution_latency || {}),
          classification: latency
        }
      };
    } catch (err) {
      logger.error(`[${this.name}] Execution failed: ${err.message}`);
      return {
        ...state,
        classification: {
          category: 'Unclassified',
          subcategory: null,
          priority: 'P3',
          intent: 'Incident',
          confidence_score: 0.0,
          calibrated: false,
          review_required: true,
          review_reason: `Classification agent error: ${err.message}`,
          model_version: 'fallback-v1',
          status: 'failed'
        },
        execution_latency: {
          ...(state.execution_latency || {}),
          classification: Date.now() - startTime
        }
      };
    }
  }
}

const classificationAgent = new ClassificationAgent();

module.exports = classificationAgent;
