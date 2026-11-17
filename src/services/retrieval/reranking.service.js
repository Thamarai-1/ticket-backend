/**
 * reranking.service.js
 * Reciprocal Rank Fusion (RRF) and duplicate candidate scoring.
 */

class RerankingService {
  /**
   * Reciprocal Rank Fusion of vector and keyword results.
   * RRF score = sum(1 / (k + rank))
   */
  fuseRankings(vectorResults, keywordResults, k = 60, queryContext = {}) {
    const scoreMap = new Map();
    const cleanQueryTitle = (queryContext.title || '').trim().toLowerCase();
    const cleanQueryDesc = (queryContext.description || '').trim().toLowerCase();

    vectorResults.forEach((item) => {
      const id = item.ticket_id;
      const vScore = 1 / (k + item.vector_rank);
      scoreMap.set(id, {
        ...item,
        rrf_score: vScore,
        vector_rank: item.vector_rank,
        keyword_rank: null
      });
    });

    keywordResults.forEach((item) => {
      const id = item.ticket_id;
      const kScore = 1 / (k + item.rank);
      if (scoreMap.has(id)) {
        const existing = scoreMap.get(id);
        existing.rrf_score += kScore;
        existing.keyword_rank = item.rank;
        existing.bm25_score = item.bm25_score;
      } else {
        scoreMap.set(id, {
          ...item,
          rrf_score: kScore,
          vector_rank: null,
          keyword_rank: item.rank
        });
      }
    });

    const fused = Array.from(scoreMap.values());
    fused.sort((a, b) => b.rrf_score - a.rrf_score);

    // Flag potential duplicates (exact textual match or semantic/token overlap)
    return fused.map((ticket, idx) => {
      const sim = ticket.similarity_score || 0;
      const bm25 = ticket.bm25_score || 0;
      const itemTitle = (ticket.title || '').trim().toLowerCase();
      const itemDesc = (ticket.description || '').trim().toLowerCase();

      const isExactMatch =
        (cleanQueryTitle && itemTitle === cleanQueryTitle) ||
        (cleanQueryDesc && itemDesc === cleanQueryDesc);

      // Compute token overlap for semantic and rephrased incidents
      const queryTokens = new Set(`${cleanQueryTitle} ${cleanQueryDesc}`.match(/\w+/g) || []);
      const itemTokens = new Set(`${itemTitle} ${itemDesc}`.match(/\w+/g) || []);
      let intersection = 0;
      queryTokens.forEach((tok) => {
        if (itemTokens.has(tok)) intersection++;
      });
      const overlapRatio = queryTokens.size > 0 ? intersection / queryTokens.size : 0;

      const isSemanticDuplicate = sim >= 0.40 || bm25 >= 0.70 || overlapRatio >= 0.35;
      const isDuplicate = isExactMatch || isSemanticDuplicate;

      let duplicateReason = null;
      if (isExactMatch) {
        duplicateReason = 'Exact duplicate: identical incident title/description previously submitted';
      } else if (isSemanticDuplicate) {
        duplicateReason = `Semantic duplicate: ${Math.round(Math.max(sim, overlapRatio) * 100)}% conceptual overlap with existing incident`;
      }

      return {
        ...ticket,
        hybrid_rank: idx + 1,
        potential_duplicate: isDuplicate,
        duplicate_confidence: isExactMatch ? 1.0 : Number(Math.max(sim, overlapRatio).toFixed(2)),
        duplicate_reason: duplicateReason,
        match_reason: `RRF Rank ${idx + 1} (Score: ${ticket.rrf_score.toFixed(4)})`
      };
    });
  }
}

const rerankingService = new RerankingService();

module.exports = rerankingService;
