/**
 * embedding.job.js
 * Background worker for generating and indexing ticket embeddings into Qdrant Cloud.
 */

const { Ticket } = require('../repositories/ticket.repository');
const embeddingService = require('../services/retrieval/embedding.service');
const qdrantService = require('../services/retrieval/qdrant.service');
const logger = require('../config/logger');

class EmbeddingJob {
  async runBatch(batchSize = 50) {
    logger.info(`[EmbeddingJob] Running embedding indexing batch (size: ${batchSize})...`);

    try {
      // Find tickets that need embeddings
      const tickets = await Ticket.find({}).limit(batchSize).lean();
      let processed = 0;
      const qdrantBatch = [];

      for (const t of tickets) {
        const text = `${t.title} ${t.description}`;
        const embedding = await embeddingService.generateEmbedding(text);
        processed++;

        qdrantBatch.push({
          id: t.ticket_id,
          embedding,
          metadata: {
            title: t.title || '',
            category: t.category || '',
            status: t.status || '',
            affected_service: t.affected_service || '',
            resolution_text: t.resolution_text || ''
          },
          document: text
        });
      }

      // Upsert into Qdrant if configured
      if (qdrantService.isConfigured() && qdrantBatch.length > 0) {
        try {
          const qdrantAvailable = await qdrantService.healthCheck();
          if (qdrantAvailable) {
            await qdrantService.upsertTickets(qdrantBatch);
            logger.info(`[EmbeddingJob] Synced ${qdrantBatch.length} embeddings to Qdrant Cloud.`);
          }
        } catch (qdrantErr) {
          logger.warn(`[EmbeddingJob] Qdrant sync skipped: ${qdrantErr.message}`);
        }
      }

      logger.info(`[EmbeddingJob] Indexed ${processed} ticket embeddings.`);
      return { success: true, processed };
    } catch (err) {
      logger.error(`[EmbeddingJob] Error processing batch: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

const embeddingJob = new EmbeddingJob();

module.exports = embeddingJob;
