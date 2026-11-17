/**
 * confidence.service.js
 * Multi-factor confidence estimation for resolution recommendations.
 */

class ConfidenceService {
  calculateConfidence(evidence = [], similarTickets = []) {
    if (!evidence || evidence.length === 0) {
      return {
        level: 'insufficient_evidence',
        basis: 'No verified historical resolutions available for this incident pattern.'
      };
    }

    const maxSimilarity = Math.max(...evidence.map((e) => e.similarity_score || 0), 0);
    const count = evidence.length;

    if (maxSimilarity >= 0.85 && count >= 2) {
      return {
        level: 'high',
        basis: `Corroborated by ${count} highly similar resolved historical tickets (similarity: ${(maxSimilarity * 100).toFixed(0)}%).`
      };
    }

    if (maxSimilarity >= 0.70 || count >= 1) {
      return {
        level: 'medium',
        basis: `Grounded in ${count} moderately similar historical resolution record(s).`
      };
    }

    return {
      level: 'low',
      basis: 'Weak similarity match with known historical resolution procedures.'
    };
  }
}

const confidenceService = new ConfidenceService();

module.exports = confidenceService;
