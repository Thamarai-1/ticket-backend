/**
 * workflow.graph.js
 * State Graph Workflow Orchestrator for IT Ticket Analysis.
 * Runs concurrent classification and retrieval steps, synthesizes evidence-backed resolutions,
 * and validates governance/human-in-the-loop policies.
 */

const classificationAgent = require('./classification.agent');
const retrievalAgent = require('./retrieval.agent');
const resolutionAgent = require('./resolution.agent');
const logger = require('../config/logger');

class WorkflowGraph {
  async execute(initialState) {
    const startTime = Date.now();
    logger.info(`[WorkflowGraph] Executing workflow graph for ticket: ${initialState.ticket_id || 'NEW'}`);

    let state = {
      ...initialState,
      execution_latency: {},
      review_reasons: [],
      component_statuses: {}
    };

    // Node 1 & 2: Concurrently execute Classification & Retrieval agents
    const [classificationState, retrievalState] = await Promise.all([
      classificationAgent.run(state),
      retrievalAgent.run(state)
    ]);

    // Merge branch states
    state = {
      ...state,
      classification: classificationState.classification,
      similar_tickets: retrievalState.similar_tickets,
      duplicate_candidates: retrievalState.duplicate_candidates,
      retrieval_status: retrievalState.retrieval_status,
      execution_latency: {
        ...classificationState.execution_latency,
        ...retrievalState.execution_latency
      },
      component_statuses: {
        classification: classificationState.classification?.status || 'completed',
        retrieval: retrievalState.retrieval_status || 'completed'
      }
    };

    // Node 3: Resolution Synthesis Agent (receives merged context)
    const resolutionState = await resolutionAgent.run(state);

    state = {
      ...state,
      recommendations: resolutionState.recommendations,
      confidence: resolutionState.confidence,
      clarification_questions: resolutionState.clarification_questions,
      execution_latency: {
        ...state.execution_latency,
        ...resolutionState.execution_latency
      },
      component_statuses: {
        ...state.component_statuses,
        recommendation: resolutionState.resolution_status || 'completed'
      }
    };

    // Node 4: Policy & Review Evaluation Node
    const reviewReasons = [];

    if (state.classification?.review_required && state.classification.review_reason) {
      reviewReasons.push(state.classification.review_reason);
    }

    if (state.duplicate_candidates && state.duplicate_candidates.length > 0) {
      reviewReasons.push(`Identified ${state.duplicate_candidates.length} potential duplicate incidents`);
    }

    if (state.confidence?.level === 'low' || state.confidence?.level === 'insufficient_evidence') {
      reviewReasons.push('Confidence level is low or insufficient; manual human triage required');
    }

    // Default policy: always require analyst verification before production remediation
    state.review_required = true;
    state.review_reasons = reviewReasons;

    const totalDuration = Date.now() - startTime;
    state.execution_latency.total = totalDuration;
    state.execution_latency.orchestration = Math.max(
      0,
      totalDuration -
        ((state.execution_latency.classification || 0) + (state.execution_latency.recommendation || 0))
    );

    const statuses = Object.values(state.component_statuses);
    const allCompleted = statuses.every((s) => s === 'completed');
    const allFailed = statuses.every((s) => s === 'failed');
    state.status = allCompleted ? 'completed' : allFailed ? 'failed' : 'partial';

    logger.info(`[WorkflowGraph] Completed with status: ${state.status} in ${totalDuration}ms`);
    return state;
  }
}

const workflowGraph = new WorkflowGraph();

module.exports = workflowGraph;
