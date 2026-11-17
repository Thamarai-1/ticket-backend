/**
 * e2e.reliability.test.js
 * End-to-End Reliability and Fault-Tolerance Test Suite (Phase 5 & 6).
 */

const request = require('supertest');
const app = require('../src/app');
const mlService = require('../src/services/ml.service');
const Analysis = require('../src/models/Analysis');
const { AuditEvent } = require('../src/models/AuditEvent');
const { AnalystFeedback } = require('../src/models/AnalystFeedback');

describe('Master Analysis & Reliability Pipeline Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/analyze - Full End-to-End Workflow', () => {
    it('should coordinate classification, retrieval, and recommendation, persisting analysis to MongoDB', async () => {
      // 1. Mock ML Service responses
      const mockClf = {
        ticket_id: 'INC-TEST-E2E',
        classification: { category: 'Software', subcategory: 'CAD', priority: 'P2', intent: 'Incident' },
        confidence: { category_score: 0.91, score_type: 'estimated_probability', calibrated: false },
        review_required: false,
        model_version: 'category-tfidf-logreg-v1'
      };

      const mockRet = {
        query_ticket_id: 'INC-TEST-E2E',
        retrieval_method: 'hybrid',
        results: [
          {
            ticket_id: 'INC-1002',
            title: 'Software installation error 0x80070005 Access is denied during CAD install',
            similarity_score: 0.94,
            bm25_score: 14.2,
            potential_duplicate: true,
            duplicate_confidence: 0.92,
            match_reason: 'Identical error 0x80070005'
          }
        ],
        retrieval_model_version: 'hybrid-rrf-v1'
      };

      const mockRec = {
        ticket_id: 'INC-TEST-E2E',
        recommendation_status: 'suggested',
        recommendations: [
          {
            recommendation_id: 'REC-001',
            title: 'Resolution procedure derived from INC-1002',
            steps: ['Whitelisted SHA-256 hash in CrowdStrike console.', 'Cleared Temp directory.'],
            evidence: [
              {
                source_type: 'historical_ticket',
                source_id: 'INC-1002',
                excerpt: 'Whitelisted SHA-256 hash in CrowdStrike console.',
                relevance_reason: 'Exact error 0x80070005'
              }
            ]
          }
        ],
        confidence: { level: 'high', basis: 'Verified historical resolution' },
        review_required: true,
        model_version: 'recommendation-v1'
      };

      jest.spyOn(mlService, 'classifyTicket').mockResolvedValueOnce(mockClf);
      jest.spyOn(mlService, 'retrieveSimilarTickets').mockResolvedValueOnce(mockRet);
      jest.spyOn(mlService, 'recommendResolution').mockResolvedValueOnce(mockRec);

      // Mock Mongoose model saves
      jest.spyOn(Analysis.prototype, 'save').mockResolvedValueOnce({ analysis_id: 'ANL-TEST-001' });
      jest.spyOn(AuditEvent.prototype, 'save').mockResolvedValue({});

      const res = await request(app)
        .post('/api/analyze')
        .send({
          ticket_id: 'INC-TEST-E2E',
          title: 'AutoCAD 2026 deployment fails with error 0x80070005',
          description: 'Access is denied during installation on workstation WS-1049.',
          affected_service: 'Endpoint Management (Intune)',
          environment: 'Production'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.analysis_id).toBeDefined();
      expect(res.body.data.classification.category).toBe('Software');
      expect(res.body.data.similar_tickets.length).toBe(1);
      expect(res.body.data.recommendations.length).toBe(1);
      expect(res.body.data.component_statuses.classification).toBe('completed');
      expect(res.body.data.component_statuses.retrieval).toBe('completed');
      expect(res.body.data.component_statuses.recommendation).toBe('completed');
      expect(res.body.data.status).toBe('completed');
    });

    it('should gracefully handle partial failure when Recommendation Engine fails', async () => {
      const mockClf = {
        ticket_id: 'INC-PARTIAL',
        classification: { category: 'Network', subcategory: 'VPN', priority: 'P3', intent: 'Incident' },
        confidence: { category_score: 0.85, score_type: 'estimated_probability', calibrated: false },
        review_required: false,
        model_version: 'category-tfidf-logreg-v1'
      };

      const mockRet = {
        query_ticket_id: 'INC-PARTIAL',
        retrieval_method: 'hybrid',
        results: [],
        retrieval_model_version: 'hybrid-rrf-v1'
      };

      // Classification & Retrieval succeed, but Recommendation times out (504)
      const timeoutErr = new Error('ML Recommendation timed out');
      timeoutErr.statusCode = 504;

      jest.spyOn(mlService, 'classifyTicket').mockResolvedValueOnce(mockClf);
      jest.spyOn(mlService, 'retrieveSimilarTickets').mockResolvedValueOnce(mockRet);
      jest.spyOn(mlService, 'recommendResolution').mockRejectedValueOnce(timeoutErr);

      jest.spyOn(Analysis.prototype, 'save').mockResolvedValueOnce({ analysis_id: 'ANL-PARTIAL-001' });
      jest.spyOn(AuditEvent.prototype, 'save').mockResolvedValue({});

      const res = await request(app)
        .post('/api/analyze')
        .send({
          ticket_id: 'INC-PARTIAL',
          title: 'VPN timeout on gateway',
          description: 'Tunnel drops after 5 minutes.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.component_statuses.classification).toBe('completed');
      expect(res.body.data.component_statuses.retrieval).toBe('completed');
      expect(res.body.data.component_statuses.recommendation).toBe('unavailable');
      expect(res.body.data.status).toBe('partial');
      expect(res.body.data.review_required).toBe(true);
    });
  });

  describe('POST /api/analyses/:analysisId/feedback - Analyst Feedback (FR-06)', () => {
    it('should validate analysis existence and target before saving feedback', async () => {
      // Mock analysis existence
      const mockAnalysis = {
        analysis_id: 'ANL-2026-FB',
        ticket_id: 'INC-1002',
        recommendations: [{ recommendation_id: 'REC-001' }]
      };

      jest.spyOn(Analysis, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockAnalysis)
      });
      jest.spyOn(AnalystFeedback.prototype, 'save').mockResolvedValueOnce({ feedback_id: 'FB-001' });
      jest.spyOn(AuditEvent.prototype, 'save').mockResolvedValue({});

      const res = await request(app)
        .post('/api/analyses/ANL-2026-FB/feedback')
        .send({
          target_type: 'recommendation',
          target_id: 'REC-001',
          feedback_status: 'useful',
          comment: 'The suggested hash whitelisting directly resolved the issue.'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('recorded successfully');
    });

    it('should reject feedback if target_id does not belong to the analysis', async () => {
      const mockAnalysis = {
        analysis_id: 'ANL-2026-FB',
        ticket_id: 'INC-1002',
        recommendations: [{ recommendation_id: 'REC-001' }]
      };

      jest.spyOn(Analysis, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockAnalysis)
      });

      const res = await request(app)
        .post('/api/analyses/ANL-2026-FB/feedback')
        .send({
          target_type: 'recommendation',
          target_id: 'REC-999-FAKE', // Nonexistent target
          feedback_status: 'useful'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found in analysis');
    });
  });
});
