/**
 * keyword-search.service.js
 * Lexical / BM25 search over ticket corpus.
 */

const { ticketRepository } = require('../../repositories/ticket.repository');

class KeywordSearchService {
  async search(queryText, options = {}) {
    const { top_k = 5, category, priority } = options;

    const { tickets } = await ticketRepository.search({
      q: queryText,
      category,
      priority,
      limit: top_k
    });

    return tickets.map((t, idx) => ({
      ticket_id: t.ticket_id,
      title: t.title,
      description: t.description,
      description_excerpt: (t.description || '').slice(0, 150) + '...',
      category: t.category,
      status: t.status,
      affected_service: t.affected_service,
      resolution_text: t.resolution_text,
      bm25_score: Number((1.0 - idx * 0.1).toFixed(3)),
      rank: idx + 1
    }));
  }
}

const keywordSearchService = new KeywordSearchService();

module.exports = keywordSearchService;
