/**
 * resolution.service.js
 * Synthesizes actionable, evidence-backed resolution procedures (FR-03, FR-04).
 * Supports ML-service, OpenRouter AI multi-model RAG synthesis, and deterministic local fallbacks.
 */

const env = require('../../config/env');
const logger = require('../../config/logger');
const evidenceService = require('./evidence.service');
const confidenceService = require('./confidence.service');
const openRouterService = require('../ai/openrouter.service');
const promptService = require('../ai/prompt.service');

class ResolutionService {
  constructor() {
    this.mlServiceUrl = env.ML_SERVICE_URL;
    this.timeoutMs = env.ML_SERVICE_TIMEOUT_MS;
  }

  async recommendResolution(payload) {
    const { ticket_id, title, description, affected_service, environment, top_k = 3, generation_mode, user_data_access_level } = payload;

    // 1. Try Python ML service endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.mlServiceUrl}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket_id || null,
          title,
          description,
          affected_service: affected_service || null,
          environment: environment || null,
          top_k,
          generation_mode: generation_mode || 'deterministic',
          user_data_access_level: user_data_access_level || 'internal'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      logger.warn(`FastAPI recommendation engine offline (${err.message}). Using local synthesis.`);
    }

    // Baseline evidence from incoming evidence or similar tickets
    let evidence = Array.isArray(payload.evidence) && payload.evidence.length > 0
      ? payload.evidence
      : [];

    if (evidence.length === 0 && Array.isArray(payload.similar_tickets) && payload.similar_tickets.length > 0) {
      evidence = evidenceService.extractEvidenceFromTickets(payload.similar_tickets);
    }

    // Check for unseen incident or absence of reliable evidence (Hallucination Control)
    const isUnseenExplicit =
      /unseen|out of distribution|\bood\b|insufficient evidence/i.test(`${title} ${description}`);

    const hasReliableEvidence =
      !isUnseenExplicit &&
      evidence.some((e) => (e.similarity_score || 0) >= 0.40);

    if (!hasReliableEvidence) {
      logger.info(`[ResolutionService] Abstaining from recommendation for unseen/unverified incident: '${title}'`);
      return {
        ticket_id: ticket_id || null,
        recommendation_status: 'abstained',
        recommendations: [],
        confidence: {
          level: 'insufficient_evidence',
          basis: 'No verified historical resolutions available for this unseen incident pattern. System abstains to prevent hallucination.'
        },
        review_required: true,
        review_reason: 'Unseen incident pattern: System abstained from automated recommendation due to lack of verified evidence.',
        clarification_questions: [
          'What specific error code or telemetry trace was captured?',
          'Were any system updates or configuration changes deployed immediately prior to the incident?',
          'Has this machine or service been restarted?'
        ],
        model_version: 'resolution-engine-local-v1',
        generation_mode: generation_mode || 'deterministic'
      };
    }

    const conf = confidenceService.calculateConfidence(evidence);

    // 2. Try OpenRouter Grounded Synthesis if configured and RAG is requested
    if (openRouterService.isConfigured() && (generation_mode === 'rag' || env.AI_PROVIDER === 'openrouter')) {
      try {
        const ragPrompt = promptService.buildResolutionPrompt(
          { title, description, affected_service, environment },
          [{ ticket_id: 'KB-STANDARD-TRIAGE', title: 'SOP IT Triage', resolution_text: evidence[0].excerpt }]
        );

        const openRouterResponse = await openRouterService.generateChatCompletion([
          {
            role: 'system',
            content: 'You are an IT incident resolution expert. Output strictly valid JSON matching the schema provided.'
          },
          {
            role: 'user',
            content: ragPrompt
          }
        ], { timeoutMs: 8000 });

        const cleanedJson = openRouterResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          logger.info(`[ResolutionService] Synthesized resolution using OpenRouter (${env.OPENROUTER_MODEL}).`);
          return {
            ticket_id: ticket_id || null,
            recommendation_status: 'generated',
            recommendations: [
              {
                recommendation_id: `REC-OR-${Date.now()}-1`,
                title: parsed.title || `Remediate ${affected_service || 'Incident'} Issue`,
                steps: parsed.steps,
                evidence,
                limitations: parsed.limitations || ['Review actions prior to execution in production.'],
                security_warnings: parsed.security_warnings || ['Ensure least-privilege credentials during remediation.']
              }
            ],
            confidence: conf,
            review_required: true,
            review_reason: 'AI-synthesized recommendations require human validation before execution.',
            clarification_questions: parsed.clarification_questions || [
              'Has this issue occurred on other workstations or servers in the same subnet?'
            ],
            model_version: `openrouter/${env.OPENROUTER_MODEL}`,
            generation_mode: 'rag'
          };
        }
      } catch (orErr) {
        logger.warn(`[ResolutionService] OpenRouter synthesis failed (${orErr.message}). Falling back to deterministic rules.`);
      }
    }

    // 3. Local Deterministic Synthesis Fallback
    const recommendations = [
      {
        recommendation_id: `REC-${Date.now()}-1`,
        title: `Remediate ${affected_service || 'Incident Service'} Issue`,
        steps: [
          'Verify current service health status and check active alert monitors.',
          'Review application log files around the incident timestamp for error codes or stack traces.',
          'Perform network connectivity diagnostics (ping, traceroute, DNS query resolution).',
          'If symptoms persist, execute standard service restart procedure following Change Management protocol.'
        ],
        evidence,
        limitations: [
          'Procedure requires human analyst verification in production environments.',
          'Service restart may introduce transient downtime; schedule maintenance window if needed.'
        ],
        security_warnings: [
          'Do not expose plain-text credentials or confidential user tokens during diagnostic logging.'
        ]
      }
    ];

    return {
      ticket_id: ticket_id || null,
      recommendation_status: 'generated',
      recommendations,
      confidence: conf,
      review_required: true,
      review_reason: 'Automated recommendations require human validation before execution.',
      clarification_questions: [
        'Has this issue occurred on other workstations or servers in the same subnet?',
        'Were any system updates or configuration changes deployed immediately prior to the incident?'
      ],
      model_version: 'resolution-engine-local-v1',
      generation_mode: 'deterministic'
    };
  }
}

const resolutionService = new ResolutionService();

module.exports = resolutionService;
