/**
 * classification.service.js
 * Ticket Classification Service coordinating ML microservice and taxonomy heuristics.
 */

const env = require('../../config/env');
const logger = require('../../config/logger');
const { taxonomyService } = require('./taxonomy.service');

class ClassificationService {
  constructor() {
    this.mlServiceUrl = env.ML_SERVICE_URL;
    this.timeoutMs = env.ML_SERVICE_TIMEOUT_MS;
  }

  async classifyTicket(payload) {
    const { ticket_id, title, description, affected_service } = payload;

    // Attempt calling Python FastAPI ML service first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.mlServiceUrl}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket_id || null,
          title,
          description,
          affected_service: affected_service || null
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      logger.warn(`FastAPI classification service unreachable (${err.message}). Using local rule engine.`);
    }

    // Heuristic Fallback
    const combinedText = `${title} ${description} ${affected_service || ''}`;
    const suggestion = taxonomyService.suggestCategoryFromText(combinedText);
    const subcategories = taxonomyService.getSubcategories(suggestion.category);

    const isHighPriority = /outage|down|critical|emergency|production|crash|p1/i.test(combinedText);
    const priority = isHighPriority ? 'P1' : 'P3';

    return {
      ticket_id: ticket_id || null,
      classification: {
        category: suggestion.category,
        subcategory: subcategories[0] || 'General',
        priority,
        intent: 'Incident'
      },
      confidence: {
        category_score: suggestion.confidence,
        score_type: 'heuristic_rule',
        calibrated: false
      },
      review_required: suggestion.confidence < 0.75,
      review_reason:
        suggestion.confidence < 0.75
          ? 'Confidence score below auto-approval threshold'
          : null,
      model_version: 'taxonomy-heuristic-fallback-v1'
    };
  }
}

const classificationService = new ClassificationService();

module.exports = classificationService;
