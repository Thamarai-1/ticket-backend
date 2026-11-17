/**
 * chunking.service.js
 * Semantic chunking service for incident resolution documents and ticket corpora.
 * Guarantees that source IDs are preserved across every chunk and step-by-step
 * resolution instructions remain complete, coherent, and understandable.
 */

class ChunkingService {
  /**
   * Generates semantic chunks from a ticket record.
   * @param {Object} ticket - Ticket data containing ticket_id, title, description, resolution_text
   * @returns {Array<Object>} List of coherent semantic chunks with source_id preserved
   */
  chunkTicket(ticket) {
    if (!ticket) return [];

    const sourceId = ticket.ticket_id || 'UNKNOWN';
    const chunks = [];

    // Chunk 1: Problem Context Chunk (Incident Summary & Symptoms)
    const contextText = `Incident [${sourceId}]: ${ticket.title || ''}\nDescription: ${ticket.description || ''}`.trim();
    chunks.push({
      chunk_id: `${sourceId}-chk-context`,
      source_id: sourceId,
      chunk_type: 'problem_context',
      title: ticket.title || '',
      content: contextText,
      step_number: null,
      metadata: {
        category: ticket.category || 'General',
        affected_service: ticket.affected_service || 'IT Support',
        priority: ticket.priority || 'P3',
        status: ticket.status || 'Resolved'
      }
    });

    // Chunk 2+: Resolution Steps
    const resolutionText = ticket.resolution_text || '';
    if (resolutionText.trim()) {
      const stepChunks = this.chunkResolutionSteps(sourceId, resolutionText, ticket);
      chunks.push(...stepChunks);
    }

    return chunks;
  }

  /**
   * Segments resolution text into discrete, understandable step chunks while preserving source_id.
   * Handles numbered steps ("1.", "2."), bullet points ("-", "*"), or structured sentences.
   */
  chunkResolutionSteps(sourceId, resolutionText, ticket = {}) {
    const rawSteps = [];

    // Check if text has numbered items like "1. ... 2. ..." or bullet points
    const lines = resolutionText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let currentStep = '';
    const stepNumberRegex = /^(\d+[\.\)]|[-*•])\s+/;

    for (const line of lines) {
      if (stepNumberRegex.test(line)) {
        if (currentStep) rawSteps.push(currentStep);
        currentStep = line.replace(stepNumberRegex, '').trim();
      } else if (currentStep) {
        currentStep += ' ' + line;
      } else {
        // Line without numbering
        currentStep = line;
      }
    }
    if (currentStep) rawSteps.push(currentStep);

    // If no explicit line breaks/bullets were found, segment by sentences
    if (rawSteps.length <= 1) {
      const sentences = resolutionText
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      if (sentences.length > 1) {
        rawSteps.length = 0;
        rawSteps.push(...sentences);
      }
    }

    // Default if only a single contiguous block exists
    if (rawSteps.length === 0) {
      rawSteps.push(resolutionText.trim());
    }

    return rawSteps.map((stepText, idx) => ({
      chunk_id: `${sourceId}-step-${idx + 1}`,
      source_id: sourceId,
      chunk_type: 'resolution_step',
      step_number: idx + 1,
      title: `${ticket.title || 'Resolution'} (Step ${idx + 1})`,
      content: `[Source ${sourceId}] Step ${idx + 1}: ${stepText}`,
      metadata: {
        category: ticket.category || 'General',
        affected_service: ticket.affected_service || 'IT Support',
        is_actionable: true
      }
    }));
  }

  /**
   * Batch inspect chunks for an array of tickets
   */
  chunkBatch(tickets = []) {
    return tickets.flatMap((t) => this.chunkTicket(t));
  }
}

const chunkingService = new ChunkingService();

module.exports = chunkingService;
