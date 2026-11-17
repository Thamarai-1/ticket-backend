/**
 * vector-search.service.js
 * Dense vector search and semantic similarity matching using Qdrant with local fallback.
 */

const embeddingService = require('./embedding.service');
const qdrantService = require('./qdrant.service');
const { ticketRepository } = require('../../repositories/ticket.repository');
const logger = require('../../config/logger');

class VectorSearchService {
  async search(queryText, options = {}) {
    const { top_k = 5, category } = options;

    const queryVector = await embeddingService.generateEmbedding(queryText);

    // 1. Attempt Qdrant Cloud Vector Search first
    if (qdrantService.isConfigured()) {
      try {
        const isOnline = await qdrantService.healthCheck();
        if (isOnline) {
          const qdrantResults = await qdrantService.querySimilar(queryVector, { top_k, category });
          if (qdrantResults && qdrantResults.length > 0) {
            logger.debug(`[VectorSearch] Retrieved ${qdrantResults.length} matches from Qdrant.`);
            return qdrantResults;
          }
        }
      } catch (err) {
        logger.warn(`[VectorSearch] Qdrant search bypassed (${err.message}). Using database fallback.`);
      }
    }

    // 2. Database + In-Memory Fallback
    const filter = category ? { category } : {};
    const { tickets } = await ticketRepository.findAll(filter, { limit: 50 });

    const scored = [];
    for (const ticket of tickets) {
      const textToEmbed = `${ticket.title} ${ticket.description}`;
      const docVector = await embeddingService.generateEmbedding(textToEmbed);
      const similarity = embeddingService.cosineSimilarity(queryVector, docVector);

      scored.push({
        ticket_id: ticket.ticket_id,
        title: ticket.title,
        description: ticket.description,
        description_excerpt: (ticket.description || '').slice(0, 150) + '...',
        category: ticket.category,
        status: ticket.status,
        affected_service: ticket.affected_service,
        resolution_text: ticket.resolution_text,
        similarity_score: Number(similarity.toFixed(4)),
        source: 'local_vector'
      });
    }

    scored.sort((a, b) => b.similarity_score - a.similarity_score);
    return scored.slice(0, top_k).map((item, idx) => ({
      ...item,
      vector_rank: idx + 1
    }));
  }
}

const vectorSearchService = new VectorSearchService();

module.exports = vectorSearchService;
