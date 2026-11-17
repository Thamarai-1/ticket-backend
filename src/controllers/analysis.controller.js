/**
 * analysis.controller.js
 * Master Orchestrator for Unified IT Ticket Analysis (Phases 2, 3, 4, 5, 6).
 */

const { Analysis } = require('../repositories/resolution.repository');
const { AnalystFeedback } = require('../repositories/feedback.repository');
const mlService = require('../services/ml.service');
const auditService = require('../services/audit/audit.service');
const { parsePagination, formatPagination } = require('../utils/pagination');

/**
 * Executes unified AI analysis workflow.
 */
const analyzeTicket = async (req, res, next) => {
  const startTime = Date.now();
  const correlation_id = req.headers['x-correlation-id'] || `CORR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const userAccess = req.headers['x-user-access-level'] || 'internal';

  try {
    const {
      ticket_id,
      title,
      description,
      affected_service,
      environment = 'Production',
      generation_mode = 'deterministic'
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'title is required to perform ticket analysis',
        correlation_id,
        timestamp: new Date().toISOString()
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'description is required to perform ticket analysis',
        correlation_id,
        timestamp: new Date().toISOString()
      });
    }

    const assignedTicketId = ticket_id || `INC-${Date.now().toString().slice(-4)}`;
    const analysis_id = `ANL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Audit initiation
    await auditService.logEvent({
      event_type: 'ANALYSIS_STARTED',
      correlation_id,
      analysis_id,
      ticket_id: assignedTicketId,
      actor_reference: { actor_id: 'analyst-console', actor_type: 'analyst' },
      component_status: 'started',
      metadata: { title, affected_service, environment, userAccess }
    });

    const payload = {
      ticket_id: assignedTicketId,
      title: title.trim(),
      description: description.trim(),
      affected_service: affected_service ? affected_service.trim() : null,
      environment: environment ? environment.trim() : null,
      user_data_access_level: userAccess,
      generation_mode
    };

    const componentStatuses = {
      classification: 'pending',
      retrieval: 'pending',
      recommendation: 'pending'
    };

    const latencyMetrics = {
      total: 0,
      classification: 0,
      retrieval: 0,
      recommendation: 0,
      orchestration: 0
    };

    // 2. Concurrently execute Classification & Retrieval operations
    const t0Clf = Date.now();
    const classificationPromise = mlService.classifyTicket(payload)
      .then((res) => {
        latencyMetrics.classification = Date.now() - t0Clf;
        componentStatuses.classification = 'completed';
        return res;
      })
      .catch((err) => {
        latencyMetrics.classification = Date.now() - t0Clf;
        componentStatuses.classification = err.statusCode === 504 ? 'unavailable' : 'failed';
        console.warn(`[ANALYSIS_PIPELINE] Classification failed (${err.message}). Continuing with degraded status.`);
        return null;
      });

    const t0Ret = Date.now();
    const retrievalPromise = mlService.retrieveSimilarTickets({ ...payload, top_k: 5 })
      .then((res) => {
        latencyMetrics.retrieval = Date.now() - t0Ret;
        componentStatuses.retrieval = 'completed';
        return res;
      })
      .catch((err) => {
        latencyMetrics.retrieval = Date.now() - t0Ret;
        componentStatuses.retrieval = err.statusCode === 504 ? 'unavailable' : 'failed';
        console.warn(`[ANALYSIS_PIPELINE] Retrieval failed (${err.message}). Continuing with degraded status.`);
        return null;
      });

    const [clfResult, retResult] = await Promise.all([classificationPromise, retrievalPromise]);

    // 3. Execute Recommendation Engine
    const t0Rec = Date.now();
    let recResult = null;
    try {
      recResult = await mlService.recommendResolution({ ...payload, top_k: 3 });
      latencyMetrics.recommendation = Date.now() - t0Rec;
      componentStatuses.recommendation = 'completed';
    } catch (err) {
      latencyMetrics.recommendation = Date.now() - t0Rec;
      componentStatuses.recommendation = err.statusCode === 504 ? 'unavailable' : 'failed';
      console.warn(`[ANALYSIS_PIPELINE] Recommendation failed (${err.message}).`);
    }

    // 4. Synthesize unified response data
    const reviewReasons = [];

    // Classification synthesis
    let finalClassification = {
      category: 'Unclassified',
      subcategory: null,
      priority: 'P3',
      intent: 'Incident',
      confidence_score: 0.0,
      calibrated: false,
      review_required: true,
      review_reason: 'Classification service was unavailable',
      model_version: 'fallback-v1',
      status: componentStatuses.classification
    };

    if (clfResult) {
      finalClassification = {
        category: clfResult.classification.category,
        subcategory: clfResult.classification.subcategory,
        priority: clfResult.classification.priority || 'P3',
        intent: clfResult.classification.intent || 'Incident',
        confidence_score: clfResult.confidence.category_score,
        calibrated: clfResult.confidence.calibrated,
        review_required: clfResult.review_required,
        review_reason: clfResult.review_reason,
        model_version: clfResult.model_version,
        status: 'completed'
      };
      if (clfResult.review_required && clfResult.review_reason) {
        reviewReasons.push(clfResult.review_reason);
      }
    } else {
      reviewReasons.push('Classification model offline; default triage applied.');
    }

    // Retrieval synthesis
    let similarTickets = [];
    if (retResult && retResult.results) {
      similarTickets = retResult.results;
      const dupCount = similarTickets.filter((t) => t.potential_duplicate).length;
      if (dupCount > 0) {
        reviewReasons.push(`Identified ${dupCount} potential duplicate historical incidents requiring verification.`);
      }
    } else {
      reviewReasons.push('Historical ticket similarity search was unavailable.');
    }

    // Recommendation synthesis
    let recommendations = [];
    let recConfidence = {
      level: 'insufficient_evidence',
      basis: 'Recommendation engine was unavailable.'
    };
    let clarificationQuestions = [];

    if (recResult) {
      recommendations = recResult.recommendations || [];
      recConfidence = recResult.confidence || recConfidence;
      clarificationQuestions = recResult.clarification_questions || [];

      if (recResult.review_required && recResult.review_reason) {
        reviewReasons.push(recResult.review_reason);
      }
    } else {
      clarificationQuestions.push('Please describe system logs or explicit error messages observed.');
      reviewReasons.push('Automated resolution recommendation engine unavailable.');
    }

    // Determine overall pipeline status
    const allCompleted = Object.values(componentStatuses).every((s) => s === 'completed');
    const allFailed = Object.values(componentStatuses).every((s) => s === 'failed' || s === 'unavailable');
    const overallStatus = allCompleted ? 'completed' : allFailed ? 'failed' : 'partial';

    const totalDuration = Date.now() - startTime;
    latencyMetrics.total = totalDuration;
    latencyMetrics.orchestration = Math.max(
      0,
      totalDuration - (latencyMetrics.classification + latencyMetrics.recommendation)
    );

    // 5. Persist unified analysis into database
    const analysisDoc = new Analysis({
      analysis_id,
      correlation_id,
      ticket_id: assignedTicketId,
      input_snapshot: {
        title: payload.title,
        description: payload.description,
        affected_service: payload.affected_service,
        environment: payload.environment,
        user_access_level: userAccess
      },
      classification: finalClassification,
      similar_tickets: similarTickets,
      recommendations,
      confidence: recConfidence,
      clarification_questions: clarificationQuestions,
      review_required: true,
      review_reasons: reviewReasons,
      component_statuses: componentStatuses,
      status: overallStatus,
      model_versions: {
        classification: clfResult ? clfResult.model_version : 'uninitialized',
        retrieval: retResult ? retResult.retrieval_model_version : 'uninitialized',
        recommendation: recResult ? recResult.model_version : 'uninitialized'
      },
      execution_latency_ms: latencyMetrics
    });

    await analysisDoc.save();

    // 6. Record audit event for analysis completion
    await auditService.logEvent({
      event_type: overallStatus === 'completed' ? 'ANALYSIS_COMPLETED' : 'ANALYSIS_PARTIAL',
      correlation_id,
      analysis_id,
      ticket_id: assignedTicketId,
      component_status: overallStatus,
      metadata: {
        component_statuses: componentStatuses,
        total_latency_ms: totalDuration,
        recommendations_count: recommendations.length,
        similar_tickets_count: similarTickets.length
      }
    });

    return res.status(200).json({
      success: true,
      data: analysisDoc,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[ANALYSIS_FATAL] Error in analyzeTicket:`, err);
    await auditService.logEvent({
      event_type: 'ANALYSIS_FAILED',
      correlation_id,
      component_status: 'failed',
      metadata: { error: err.message }
    });
    next(err);
  }
};

/**
 * GET /api/analyses
 * Retrieves paginated historical analysis records.
 */
const getAnalyses = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, category, ticket_id } = req.query;
    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit }, 10, 50);

    const filter = {};
    if (status) filter.status = status;
    if (category) filter['classification.category'] = category;
    if (ticket_id) filter.ticket_id = { $regex: new RegExp(ticket_id.trim(), 'i') };

    const [analyses, total] = await Promise.all([
      Analysis.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean(),
      Analysis.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: analyses,
      pagination: formatPagination(total, pageNum, limitNum),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analyses/:analysisId
 * Fetches single analysis record along with any submitted analyst feedback.
 */
const getAnalysisById = async (req, res, next) => {
  try {
    const { analysisId } = req.params;

    const analysis = await Analysis.findOne({
      analysis_id: { $regex: new RegExp(`^${analysisId.trim()}$`, 'i') }
    }).lean();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: `Analysis with ID '${analysisId}' was not found`,
        timestamp: new Date().toISOString()
      });
    }

    const feedbackList = await AnalystFeedback.find({ analysis_id: analysis.analysis_id })
      .sort({ created_at: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...analysis,
        feedback: feedbackList
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/classify
 * Direct ticket classification endpoint.
 */
const classifyTicket = async (req, res, next) => {
  const { title, description, affected_service, ticket_id } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'title is required and cannot be empty',
      timestamp: new Date().toISOString()
    });
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'description is required and cannot be empty',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const mlResponse = await mlService.classifyTicket({
      ticket_id,
      title,
      description,
      affected_service
    });

    const analysisId = `ANL-${Date.now()}`;
    if (mlResponse.classification?.category && require('mongoose').connection.readyState !== 0) {
      try {
        const analysisDoc = new Analysis({
          analysis_id: analysisId,
          correlation_id: req.headers['x-correlation-id'] || `CORR-CLF-${Date.now()}`,
          ticket_id: req.body.ticket_id || `DRAFT-${Date.now()}`,
          input_snapshot: {
            title: title || '',
            description: description || '',
            affected_service: affected_service || null
          },
          classification: {
            category: mlResponse.classification.category,
            subcategory: mlResponse.classification.subcategory || 'Unassigned',
            priority: mlResponse.classification.priority || 'P3'
          },
          confidence: {
            category_score: mlResponse.confidence?.category_score || 0.0
          },
          similar_tickets: [],
          recommendations: [],
          review_required: mlResponse.review_required,
          model_versions: {
            classification: mlResponse.model_version
          }
        });

        await analysisDoc.save();
      } catch (dbErr) {
        console.warn(`[Classify Controller] Could not persist Analysis record: ${dbErr.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      data: mlResponse,
      analysis_id: analysisId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.statusCode === 503 || error.statusCode === 504) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        fallback: {
          ticket_id: ticket_id || null,
          classification: {
            category: null,
            subcategory: null,
            priority: null,
            intent: null
          },
          confidence: {
            category_score: 0.0,
            score_type: 'fallback',
            calibrated: false
          },
          review_required: true,
          review_reason: `ML service unavailable (${error.code || 'TIMEOUT'}); ticket automatically routed to human triage`
        },
        timestamp: new Date().toISOString()
      });
    }

    next(error);
  }
};

/**
 * GET /api/classify/health
 */
const getServiceHealth = async (req, res) => {
  const health = await mlService.checkHealth();
  res.status(200).json({
    success: true,
    data: health
  });
};

module.exports = {
  analyzeTicket,
  getAnalyses,
  getAnalysisById,
  classifyTicket,
  getServiceHealth
};
