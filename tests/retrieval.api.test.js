/**
 * retrieval.api.test.js
 * Integration Test Suite for Express Retrieval Endpoint (POST /api/tickets/similar).
 */

const request = require('supertest');
const app = require('../src/app');
const mlService = require('../src/services/ml.service');

describe('Retrieval REST API Endpoints', () => {
  describe('POST /api/tickets/similar - Validation', () => {
    it('should return 400 if title is missing when no ticket_id is supplied', async () => {
      const res = await request(app)
        .post('/api/tickets/similar')
        .send({ description: 'VPN tunnel dropped repeatedly' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('title');
    });

    it('should return 400 if description is missing', async () => {
      const res = await request(app)
        .post('/api/tickets/similar')
        .send({ title: 'VPN connection failure' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('description');
    });
  });

  describe('POST /api/tickets/similar - ML Retrieval Integration & Fallback', () => {
    it('should return similar tickets from ML service when available', async () => {
      const mockRetrievalResponse = {
        query_ticket_id: 'INC-2026-TEST',
        retrieval_method: 'hybrid',
        results: [
          {
            ticket_id: 'INC-1002',
            title: 'VPN connection drops after 5 minutes',
            description: 'Corporate VPN disconnects with timeout error',
            category: 'Network',
            subcategory: 'VPN',
            affected_service: 'Corporate VPN',
            environment: 'Production',
            status: 'Resolved',
            semantic_score: 0.892,
            bm25_score: 12.4,
            hybrid_rrf_score: 0.032,
            rank: 1,
            is_potential_duplicate: true,
            duplicate_confidence: 0.85,
            duplicate_reason: 'High semantic similarity (0.89) and identical affected service'
          }
        ],
        retrieval_model_version: 'hybrid-rrf-v1',
        retrieval_latency_ms: 18.5
      };

      const spy = jest.spyOn(mlService, 'retrieveSimilarTickets').mockResolvedValueOnce(mockRetrievalResponse);

      const res = await request(app)
        .post('/api/tickets/similar')
        .send({
          ticket_id: 'INC-2026-TEST',
          title: 'VPN connection drops intermittently',
          description: 'GlobalProtect VPN tunnel disconnects every 5 minutes on gateway 10.240.0.1',
          affected_service: 'Corporate VPN',
          environment: 'Production',
          top_k: 5
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.retrieval_method).toBe('hybrid');
      expect(res.body.data.results.length).toBe(1);
      expect(res.body.data.results[0].ticket_id).toBe('INC-1002');
      expect(res.body.data.results[0].is_potential_duplicate).toBe(true);

      spy.mockRestore();
    });

    it('should return 503 and safe fallback response when ML service is unreachable', async () => {
      const connError = new Error('ML Service at http://localhost:8000 is unreachable');
      connError.statusCode = 503;
      connError.code = 'ECONNREFUSED';

      const spy = jest.spyOn(mlService, 'retrieveSimilarTickets').mockRejectedValueOnce(connError);

      const res = await request(app)
        .post('/api/tickets/similar')
        .send({
          title: 'PostgreSQL connection pool exhausted',
          description: 'Production database max client connections reached 200/200'
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.fallback).toBeDefined();
      expect(res.body.fallback.results).toEqual([]);
      expect(res.body.fallback.notice).toContain('ML Retrieval service is currently unavailable');

      spy.mockRestore();
    });
  });
});
