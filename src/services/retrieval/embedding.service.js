/**
 * embedding.service.js
 * Text Embedding Service for vector similarity computation.
 */

const env = require('../../config/env');
const logger = require('../../config/logger');

class EmbeddingService {
  constructor() {
    this.mlServiceUrl = env.ML_SERVICE_URL;
  }

  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      return new Array(384).fill(0);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(`${this.mlServiceUrl}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        return data.embedding;
      }
    } catch {
      logger.debug('Downstream embedding service offline, falling back to hashed sparse representation.');
    } finally {
      clearTimeout(timeoutId);
    }

    // Deterministic 384-dimensional hashed projection fallback
    return this.generateHashedVector(text, 384);
  }

  generateHashedVector(text, dimensions = 384) {
    const vector = new Array(dimensions).fill(0);
    const tokens = text.toLowerCase().match(/\w+/g) || [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let hash = 0;
      for (let j = 0; j < token.length; j++) {
        hash = (hash << 5) - hash + token.charCodeAt(j);
        hash |= 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1;
    }

    // L2 Normalize
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < dimensions; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
  }
}

const embeddingService = new EmbeddingService();

module.exports = embeddingService;
