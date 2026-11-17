/**
 * evidence.service.js
 * Extracts evidence references and grounding citations from historical incidents (FR-04).
 */

class EvidenceService {
  extractEvidenceFromTickets(similarTickets = []) {
    const evidenceList = [];

    for (const ticket of similarTickets) {
      if (ticket.resolution_text && ticket.resolution_text.trim().length > 10) {
        evidenceList.push({
          source_id: ticket.ticket_id,
          source_type: 'historical_ticket',
          title: ticket.title,
          excerpt: ticket.resolution_text.slice(0, 300),
          relevance_reason: `Resolved past incident '${ticket.title}' with high semantic similarity (${ticket.similarity_score || 'N/A'})`,
          similarity_score: ticket.similarity_score || 0.85
        });
      }
    }

    return evidenceList;
  }
}

const evidenceService = new EvidenceService();

module.exports = evidenceService;
