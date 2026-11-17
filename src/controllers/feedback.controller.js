/**
 * feedback.controller.js
 * Controller for Capturing and Inspecting Human Analyst Feedback (FR-06).
 */

const { feedbackRepository, FEEDBACK_STATUSES, TARGET_TYPES } = require('../repositories/feedback.repository');
const { resolutionRepository } = require('../repositories/resolution.repository');
const auditService = require('../services/audit/audit.service');

/**
 * POST /api/analyses/:analysisId/feedback
 * Validates and records analyst feedback on recommendations, similar tickets, or classification.
 */
const submitFeedback = async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    const { target_type, target_id, feedback_status, comment = '', reviewer } = req.body;

    const correlation_id = req.headers['x-correlation-id'] || `CORR-FB-${Date.now()}`;

    // 1. Verify analysis exists
    const analysis = await resolutionRepository.findAnalysisById(analysisId);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: `Analysis with ID '${analysisId}' does not exist`,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Validate target_type
    if (!target_type || !TARGET_TYPES.includes(target_type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid target_type '${target_type}'. Must be one of: ${TARGET_TYPES.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    // 3. Validate target_id
    if (!target_id || typeof target_id !== 'string' || target_id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'target_id is required',
        timestamp: new Date().toISOString()
      });
    }

    // Verify target_id belongs to the specified analysis
    let targetExists = false;
    if (target_type === 'recommendation') {
      targetExists = (analysis.recommendations || []).some((r) => r.recommendation_id === target_id.trim());
    } else if (target_type === 'similar_ticket') {
      targetExists = (analysis.similar_tickets || []).some((s) => s.ticket_id === target_id.trim());
    } else if (target_type === 'classification') {
      targetExists = target_id.trim().toLowerCase() === 'category' || target_id.trim() === analysis.ticket_id;
    }

    if (!targetExists) {
      return res.status(400).json({
        success: false,
        error: `Target ID '${target_id}' was not found in analysis '${analysisId}' under target_type '${target_type}'`,
        timestamp: new Date().toISOString()
      });
    }

    // 4. Validate feedback_status
    if (!feedback_status || !FEEDBACK_STATUSES.includes(feedback_status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid feedback_status '${feedback_status}'. Must be one of: ${FEEDBACK_STATUSES.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    const feedback_id = `FB-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const feedbackDoc = await feedbackRepository.create({
      feedback_id,
      analysis_id: analysis.analysis_id,
      target_type,
      target_id: target_id.trim(),
      reviewer_reference: {
        user_id: reviewer?.user_id || 'analyst-1',
        role: reviewer?.role || 'Lead Triage Specialist',
        name: reviewer?.name || 'Triage Analyst'
      },
      feedback_status,
      comment: comment ? comment.trim() : '',
      created_at: new Date(),
      updated_at: new Date()
    });

    // 5. Immutable Audit Event
    await auditService.logEvent({
      event_type: 'FEEDBACK_SUBMITTED',
      correlation_id,
      analysis_id: analysis.analysis_id,
      ticket_id: analysis.ticket_id,
      actor_reference: {
        actor_id: feedbackDoc.reviewer_reference?.user_id || 'analyst-1',
        actor_type: 'analyst'
      },
      component_status: 'completed',
      metadata: {
        feedback_id,
        target_type,
        target_id: feedbackDoc.target_id,
        feedback_status,
        reviewer_decision: feedback_status,
        comment: feedbackDoc.comment,
        comment_length: feedbackDoc.comment ? feedbackDoc.comment.length : 0
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Analyst feedback recorded successfully',
      data: feedbackDoc,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analyses/:analysisId/feedback
 * Returns list of feedback records submitted for a specific analysis.
 */
const getFeedbackByAnalysis = async (req, res, next) => {
  try {
    const { analysisId } = req.params;

    const feedbackList = await AnalystFeedback.find({
      analysis_id: { $regex: new RegExp(`^${analysisId.trim()}$`, 'i') }
    })
      .sort({ created_at: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: feedbackList,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitFeedback,
  getFeedbackByAnalysis
};
