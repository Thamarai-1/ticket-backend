/**
 * qdrant.service.js
 * Qdrant Cloud Vector Database HTTP REST API integration.
 * Manages collections, point upsertion, and semantic cosine similarity search.
 */

const crypto = require('crypto');
const env = require('../../config/env');
const logger = require('../../config/logger');

class QdrantService {
  constructor() {
    this.url = (env.QDRANT_URL || '').replace(/\/+$/, '');
    this.apiKey = env.QDRANT_API_KEY || '';
    this.collectionName = env.QDRANT_COLLECTION_NAME || 'ticket_embeddings';
    this.vectorDim = 384; // Matches all-MiniLM-L6-v2
    this.timeoutMs = 6000;
    this.collectionVerified = false;
  }

  isConfigured() {
    return Boolean(this.url && this.url.length > 0);
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Deterministically converts an arbitrary string ID (e.g., 'INC-1001') to a valid UUIDv4-formatted string for Qdrant.
   */
  toUUID(str) {
    if (!str) return '00000000-0000-0000-0000-000000000000';
    const hash = crypto.createHash('md5').update(String(str)).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }

  /**
   * Check Qdrant cluster connectivity.
   */
  async healthCheck() {
    if (!this.isConfigured()) return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`${this.url}/collections`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal
      });

      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Ensures the vector collection exists in Qdrant with Cosine distance metric.
   */
  async ensureCollection() {
    if (this.collectionVerified) return true;
    if (!this.isConfigured()) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      // 1. Check if collection already exists
      const checkRes = await fetch(`${this.url}/collections/${this.collectionName}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal
      });

      if (checkRes.ok) {
        this.collectionVerified = true;
        clearTimeout(timeoutId);
        return true;
      }

      // 2. Create collection if not found (404)
      if (checkRes.status === 404) {
        const createRes = await fetch(`${this.url}/collections/${this.collectionName}`, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({
            vectors: {
              size: this.vectorDim,
              distance: 'Cosine'
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!createRes.ok) {
          const errText = await createRes.text().catch(() => '');
          throw new Error(`Failed to create Qdrant collection: HTTP ${createRes.status} ${errText}`);
        }

        logger.info(`[Qdrant] Initialized collection '${this.collectionName}' (dim: ${this.vectorDim}, metric: Cosine).`);
        this.collectionVerified = true;
        return true;
      }

      clearTimeout(timeoutId);
      return false;
    } catch (err) {
      logger.warn(`[Qdrant] ensureCollection encountered error: ${err.message}`);
      return false;
    }
  }

  /**
   * Upserts ticket vector points and payload into Qdrant.
   * @param {Array<{id: string, embedding: number[], metadata?: Object, document?: string}>} tickets
   */
  async upsertTickets(tickets) {
    if (!this.isConfigured() || !tickets || tickets.length === 0) return { count: 0 };

    await this.ensureCollection();

    const points = tickets.map((t) => ({
      id: this.toUUID(t.id),
      vector: t.embedding,
      payload: {
        ticket_id: t.id,
        title: t.metadata?.title || '',
        category: t.metadata?.category || '',
        status: t.metadata?.status || '',
        affected_service: t.metadata?.affected_service || '',
        resolution_text: t.metadata?.resolution_text || '',
        document: t.document || ''
      }
    }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs * 2);

      const res = await fetch(`${this.url}/collections/${this.collectionName}/points`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ points }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Qdrant point upsert failed (HTTP ${res.status}): ${errText}`);
      }

      logger.info(`[Qdrant] Successfully upserted ${points.length} points to collection '${this.collectionName}'.`);
      return { count: points.length };
    } catch (err) {
      logger.error(`[Qdrant] upsertTickets error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Queries top-k nearest neighbors via vector similarity.
   * @param {number[]} queryVector
   * @param {Object} [options]
   */
  async querySimilar(queryVector, options = {}) {
    if (!this.isConfigured()) return [];

    await this.ensureCollection();

    const { top_k = 5, category } = options;

    const body = {
      vector: queryVector,
      limit: top_k,
      with_payload: true
    };

    if (category) {
      body.filter = {
        must: [
          { key: 'category', match: { value: category } }
        ]
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.url}/collections/${this.collectionName}/points/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Qdrant search failed (HTTP ${res.status}): ${errText}`);
      }

      const data = await res.json();
      const hits = data.result || [];

      return hits.map((hit, idx) => {
        const payload = hit.payload || {};
        const score = typeof hit.score === 'number' ? Math.max(0, Math.min(1, hit.score)) : 0;

        return {
          ticket_id: payload.ticket_id || hit.id,
          title: payload.title || '',
          description: payload.document || '',
          description_excerpt: ((payload.document || '').slice(0, 150)) + '...',
          category: payload.category || 'General',
          status: payload.status || 'Resolved',
          affected_service: payload.affected_service || null,
          resolution_text: payload.resolution_text || null,
          similarity_score: Number(score.toFixed(4)),
          vector_rank: idx + 1,
          source: 'qdrant'
        };
      });
    } catch (err) {
      logger.warn(`[Qdrant] Search query failed: ${err.message}`);
      throw err;
    }
  }
}

const qdrantService = new QdrantService();

module.exports = qdrantService;
