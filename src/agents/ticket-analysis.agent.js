/**
 * ticket-analysis.agent.js
 * Master Orchestrator Agent for Unified IT Ticket Analysis.
 */

const workflowGraph = require('./workflow.graph');
const { resolutionRepository } = require('../repositories/resolution.repository');
const auditService = require('../services/audit/audit.service');
const logger = require('../config/logger');

class TicketAnalysisAgent {
  async analyzeTicket(payload, context = {}) {
    const correlation_id = context.correlation_id || `CORR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const analysis_id = `ANL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const assignedTicketId = payload.ticket_id || `INC-${Date.now().toString().slice(-4)}`;

    // 1. Audit Analysis Start
    await auditService.logEvent({
      event_type: 'ANALYSIS_STARTED',
      correlation_id,
      analysis_id,
      ticket_id: assignedTicketId,
      actor_reference: { actor_id: context.userId || 'analyst-console', actor_type: 'analyst' },
      component_status: 'started',
      metadata: {
        title: payload.title,
        affected_service: payload.affected_service,
        environment: payload.environment
      }
    });

    // 2. Execute Workflow Graph
    const graphState = await workflowGraph.execute({
      ...payload,
      ticket_id: assignedTicketId,
      analysis_id,
      correlation_id,
      user_data_access_level: context.userAccessLevel || 'internal'
    });

    // 3. Persist Unified Analysis Document
    const analysisRecord = {
      analysis_id,
      correlation_id,
      ticket_id: assignedTicketId,
      input_snapshot: {
        title: payload.title,
        description: payload.description,
        affected_service: payload.affected_service || null,
        environment: payload.environment || 'Production',
        user_access_level: context.userAccessLevel || 'internal'
      },
      classification: graphState.classification,
      similar_tickets: graphState.similar_tickets,
      recommendations: graphState.recommendations,
      confidence: graphState.confidence,
      clarification_questions: graphState.clarification_questions,
      review_required: graphState.review_required,
      review_reasons: graphState.review_reasons,
      component_statuses: graphState.component_statuses,
      status: graphState.status,
      model_versions: {
        classification: graphState.classification?.model_version || 'v1',
        retrieval: graphState.retrieval_model_version || 'v1',
        recommendation: graphState.recommendation_model_version || 'v1'
      },
      execution_latency_ms: graphState.execution_latency
    };

    const savedDoc = await resolutionRepository.saveAnalysis(analysisRecord);

    // 4. Audit Analysis Completion
    await auditService.logEvent({
      event_type: graphState.status === 'completed' ? 'ANALYSIS_COMPLETED' : 'ANALYSIS_PARTIAL',
      correlation_id,
      analysis_id,
      ticket_id: assignedTicketId,
      component_status: graphState.status,
      metadata: {
        component_statuses: graphState.component_statuses,
        total_latency_ms: graphState.execution_latency?.total || 0,
        recommendations_count: graphState.recommendations?.length || 0,
        similar_tickets_count: graphState.similar_tickets?.length || 0
      }
    });

    return savedDoc;
  }
}

const ticketAnalysisAgent = new TicketAnalysisAgent();

module.exports = ticketAnalysisAgent;
