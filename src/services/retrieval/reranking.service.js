/**
 * reranking.service.js
 * Reciprocal Rank Fusion (RRF) and duplicate candidate scoring.
 */

class RerankingService {
  /**
   * Reciprocal Rank Fusion of vector and keyword results.
   * RRF score = sum(1 / (k + rank))
   */
  fuseRankings(vectorResults, keywordResults, k = 60) {
    const scoreMap = new Map();

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

    // Flag potential duplicates
    return fused.map((ticket, idx) => {
      const sim = ticket.similarity_score || 0;
      const isDuplicate = sim >= 0.82;
      return {
        ...ticket,
        hybrid_rank: idx + 1,
        potential_duplicate: isDuplicate,
        duplicate_confidence: isDuplicate ? Number(sim.toFixed(2)) : 0.0,
        duplicate_reason: isDuplicate
          ? 'High textual and semantic overlap with query incident'
          : null,
        match_reason: `RRF Rank ${idx + 1} (Score: ${ticket.rrf_score.toFixed(4)})`
      };
    });
  }
}

const rerankingService = new RerankingService();

module.exports = rerankingService;
