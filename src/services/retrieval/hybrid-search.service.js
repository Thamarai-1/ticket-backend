/**
 * hybrid-search.service.js
 * Hybrid Retrieval Orchestration combining dense embeddings and sparse BM25.
 */

const env = require('../../config/env');
const logger = require('../../config/logger');
const vectorSearchService = require('./vector-search.service');
const keywordSearchService = require('./keyword-search.service');
const rerankingService = require('./reranking.service');

class HybridSearchService {
  constructor() {
    this.mlServiceUrl = env.ML_SERVICE_URL;
    this.timeoutMs = env.ML_SERVICE_TIMEOUT_MS;
  }

  async retrieve(payload) {
    const { ticket_id, title, description, affected_service, environment, top_k = 5, filters, method = 'hybrid' } = payload;

    // 1. Try FastAPI retrieval endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.mlServiceUrl}/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket_id || null,
          title,
          description,
          affected_service: affected_service || null,
          environment: environment || null,
          top_k,
          filters: filters || null,
          method
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      logger.warn(`FastAPI hybrid retrieval offline (${err.message}). Using local hybrid pipeline.`);
    }

    // 2. Local fallback hybrid retrieval
    const queryText = `${title} ${description}`;
    const [vectorRes, keywordRes] = await Promise.all([
      vectorSearchService.search(queryText, { top_k, category: filters?.category }),
      keywordSearchService.search(queryText, { top_k, category: filters?.category })
    ]);

    const results = rerankingService.fuseRankings(vectorRes, keywordRes, 60, {
      title,
      description
    }).slice(0, top_k);

    return {
      query_ticket_id: ticket_id || null,
      retrieval_method: 'hybrid-local-fallback',
      results,
      retrieval_model_version: 'hybrid-rrf-fallback-v1'
    };
  }
}

const hybridSearchService = new HybridSearchService();

module.exports = hybridSearchService;
