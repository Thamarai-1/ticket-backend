/**
 * prompt.service.js
 * Prompt engineering templates for LLM integrations (Gemini, OpenAI).
 */

const ticketNormalizationService = require('../ticket/ticket-normalization.service');

class PromptService {
  buildClassificationPrompt(ticket) {
    const cleanTitle = ticketNormalizationService.maskSensitiveInfo(ticket.title || '');
    const cleanDescription = ticketNormalizationService.maskSensitiveInfo(ticket.description || '');

    return `You are an expert IT Service Management triage specialist.
Analyze the following IT support ticket and classify it accurately.

Ticket Title: ${cleanTitle}
Ticket Description: ${cleanDescription}
Affected Service: ${ticket.affected_service || 'Not specified'}

Respond strictly with valid JSON:
{
  "category": "Network | Access & Identity | Hardware | Software | Server & Infrastructure | Email & Collaboration",
  "subcategory": "string",
  "priority": "P1 | P2 | P3 | P4",
  "intent": "Incident | Service Request | Problem | Change Request",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief justification"
}`;
  }

  buildResolutionPrompt(ticket, evidenceTickets = []) {
    const cleanTitle = ticketNormalizationService.maskSensitiveInfo(ticket.title || '');
    const cleanDescription = ticketNormalizationService.maskSensitiveInfo(ticket.description || '');

    const evidenceText = evidenceTickets
      .map(
        (t, i) => `[Source ${i + 1}] ID: ${t.ticket_id}
Title: ${ticketNormalizationService.maskSensitiveInfo(t.title || '')}
Resolution: ${ticketNormalizationService.maskSensitiveInfo(t.resolution_text || 'No text')}`
      )
      .join('\n\n');

    return `You are a Senior IT Systems Engineer providing an actionable, safe, step-by-step resolution procedure for an IT incident.

Incoming Incident:
Title: ${cleanTitle}
Description: ${cleanDescription}
Service: ${ticket.affected_service || 'Unknown'}
Environment: ${ticket.environment || 'Production'}

Ground Truth Evidence from Past Resolved Incidents:
${evidenceText || 'No prior resolved matches found.'}

Provide a structured, evidence-backed resolution plan in strict JSON:
{
  "title": "Clear action title",
  "steps": ["Step 1...", "Step 2..."],
  "limitations": ["Any operational limitations"],
  "security_warnings": ["Security risks or precautions"],
  "confidence_level": "high | medium | low | insufficient_evidence",
  "confidence_basis": "reasoning based on evidence",
  "clarification_questions": ["Question 1 if missing info"]
}`;
  }
}

const promptService = new PromptService();

module.exports = promptService;
