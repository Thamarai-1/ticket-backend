/**
 * classify.api.test.js
 * Integration Test Suite for Express Classification Endpoint (POST /api/classify).
 */

const request = require('supertest');
const app = require('../src/app');
const mlService = require('../src/services/ml.service');

describe('Classification REST API Endpoints', () => {
  describe('POST /api/classify - Validation', () => {
    it('should return 400 if title is missing', async () => {
      const res = await request(app)
        .post('/api/classify')
        .send({ description: 'VPN tunnel dropped unexpectedly' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('title');
    });

    it('should return 400 if description is empty string', async () => {
      const res = await request(app)
        .post('/api/classify')
        .send({ title: 'VPN Issue', description: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('description');
    });
  });

  describe('POST /api/classify - ML Service Integration & Fallback', () => {
    it('should return classification from ML service when available', async () => {
      // Mock successful response from mlService.classifyTicket
      const mockMlResponse = {
        ticket_id: 'INC-TEST-01',
        classification: {
          category: 'Network',
          subcategory: 'VPN',
          priority: null,
          intent: null
        },
        confidence: {
          category_score: 0.88,
          score_type: 'estimated_probability',
          calibrated: false
        },
        review_required: false,
        review_reason: null,
        model_version: 'category-tfidf-logreg-v1',
        taxonomy_version: 'v1.0',
        inference_latency_ms: 10.5
      };

      const spy = jest.spyOn(mlService, 'classifyTicket').mockResolvedValueOnce(mockMlResponse);

      const res = await request(app)
        .post('/api/classify')
        .send({
          ticket_id: 'INC-TEST-01',
          title: 'GlobalProtect VPN tunnel drops repeatedly',
          description: 'User encounters error 800 while attempting connection to 10.240.0.1',
          affected_service: 'Corporate VPN'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.classification.category).toBe('Network');
      expect(res.body.data.confidence.category_score).toBe(0.88);
      expect(res.body.data.review_required).toBe(false);

      spy.mockRestore();
    });

    it('should return 503 and human-review fallback when ML service is offline', async () => {
      // Mock connection refused error from mlService.classifyTicket
      const connError = new Error('ML Service at http://localhost:8000 is unreachable');
      connError.statusCode = 503;
      connError.code = 'ECONNREFUSED';

      const spy = jest.spyOn(mlService, 'classifyTicket').mockRejectedValueOnce(connError);

      const res = await request(app)
        .post('/api/classify')
        .send({
          title: 'Database connection exhausted',
          description: 'Production PostgreSQL database has 200/200 active connections'
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.fallback).toBeDefined();
      expect(res.body.fallback.review_required).toBe(true);
      expect(res.body.fallback.review_reason).toContain('triage');

      spy.mockRestore();
    });
  });
});
