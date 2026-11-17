/**
 * ticket-normalization.service.js
 * Sanitization, normalization, and text enrichment for tickets.
 */

class TicketNormalizationService {
  normalizeTicket(input) {
    const output = { ...input };

    if (typeof output.title === 'string') {
      output.title = output.title.trim().replace(/\s+/g, ' ');
    }

    if (typeof output.description === 'string') {
      output.description = output.description.trim();
    }

    if (typeof output.affected_service === 'string') {
      output.affected_service = output.affected_service.trim();
    }

    if (typeof output.category === 'string') {
      output.category = output.category.trim();
    }

    if (typeof output.subcategory === 'string') {
      output.subcategory = output.subcategory.trim();
    }

    if (typeof output.priority === 'string') {
      output.priority = output.priority.trim().toUpperCase();
    }

    if (typeof output.status === 'string') {
      output.status = output.status.trim();
    }

    if (typeof output.environment === 'string') {
      output.environment = output.environment.trim();
    }

    if (!output.raw_text) {
      output.raw_text = `Title: ${output.title || ''}\nDescription: ${output.description || ''}`;
    }

    // Default assignment group based on category if omitted
    if (!output.assignment_group) {
      output.assignment_group = this.getDefaultAssignmentGroup(output.category);
    }

    return output;
  }

  getDefaultAssignmentGroup(category) {
    switch (category) {
      case 'Network':
        return 'Network Support Operations';
      case 'Access & Identity':
        return 'Identity & Access Management';
      case 'Hardware':
        return 'Endpoint Hardware Services';
      case 'Software':
        return 'Desktop & Application Engineering';
      case 'Server & Infrastructure':
        return 'Cloud & Datacenter Operations';
      case 'Email & Collaboration':
        return 'Messaging & Collaboration Support';
      default:
        return 'Service Desk Tier 1';
    }
  }

  maskSensitiveInfo(text) {
    if (!text || typeof text !== 'string') return text;
    // Mask potential passwords, credit card numbers, or authorization tokens
    return text
      .replace(/(password\s*[:=]\s*)(\S+)/gi, '$1********')
      .replace(/(token\s*[:=]\s*)(\S+)/gi, '$1********')
      .replace(/\b(?:\d[ -]*?){13,16}\b/g, '****-****-****-****');
  }
}

const ticketNormalizationService = new TicketNormalizationService();

module.exports = ticketNormalizationService;
