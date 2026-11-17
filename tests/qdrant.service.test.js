/**
 * qdrant.service.test.js
 * Unit tests for Qdrant Cloud vector database service and retrieval integration.
 */

const qdrantService = require('../src/services/retrieval/qdrant.service');
const vectorSearchService = require('../src/services/retrieval/vector-search.service');
const embeddingService = require('../src/services/retrieval/embedding.service');

describe('Qdrant Vector Database Service', () => {
  const originalFetch = global.fetch;
  const originalUrl = qdrantService.url;
  const originalApiKey = qdrantService.apiKey;

  beforeEach(() => {
    // Ensure unit tests have a valid mock endpoint regardless of whether .env is present
    qdrantService.url = 'https://mock.qdrant.io';
    qdrantService.apiKey = 'test-api-key';
    qdrantService.collectionVerified = false;
  });

  afterAll(() => {
    qdrantService.url = originalUrl;
    qdrantService.apiKey = originalApiKey;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('isConfigured and toUUID', () => {
    it('should correctly report configuration status', () => {
      qdrantService.url = '';
      expect(qdrantService.isConfigured()).toBe(false);

      qdrantService.url = 'https://example.qdrant.io';
      expect(qdrantService.isConfigured()).toBe(true);
    });

    it('should generate valid deterministic UUIDs from arbitrary strings', () => {
      const uuid1 = qdrantService.toUUID('INC-1001');
      const uuid2 = qdrantService.toUUID('INC-1001');
      const uuid3 = qdrantService.toUUID('INC-1002');

      expect(uuid1).toBe(uuid2);
      expect(uuid1).not.toBe(uuid3);
      expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('healthCheck', () => {
    it('should return true when cluster /collections endpoint returns 200', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
      const healthy = await qdrantService.healthCheck();
      expect(healthy).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/collections'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should return false when cluster is unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection timed out'));
      const healthy = await qdrantService.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('ensureCollection', () => {
    it('should create collection if GET returns 404', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 }) // GET check
        .mockResolvedValueOnce({ ok: true, status: 200 }); // PUT create

      const created = await qdrantService.ensureCollection();
      expect(created).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      const [putUrl, putOptions] = global.fetch.mock.calls[1];
      expect(putUrl).toContain(`/collections/${qdrantService.collectionName}`);
      expect(putOptions.method).toBe('PUT');
      expect(JSON.parse(putOptions.body)).toEqual({
        vectors: { size: 384, distance: 'Cosine' }
      });
    });
  });

  describe('upsertTickets', () => {
    it('should format points with deterministic UUIDs and PUT to Qdrant points endpoint', async () => {
      jest.spyOn(qdrantService, 'ensureCollection').mockResolvedValue(true);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const tickets = [
        {
          id: 'INC-501',
          embedding: [0.05, 0.15, -0.25],
          metadata: { title: 'Printer Offline', category: 'Hardware' },
          document: 'Network printer on 2nd floor is not responding'
        }
      ];

      const res = await qdrantService.upsertTickets(tickets);
      expect(res.count).toBe(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/points'),
        expect.objectContaining({ method: 'PUT' })
      );

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.points[0].payload.ticket_id).toBe('INC-501');
      expect(callBody.points[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('querySimilar', () => {
    it('should map Qdrant points search results to normalized similarity items', async () => {
      jest.spyOn(qdrantService, 'ensureCollection').mockResolvedValue(true);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: [
            {
              id: 'd9e8f7a6-b5c4-d3e2-f1a0-b9c8d7e6f5a4',
              score: 0.9123,
              payload: {
                ticket_id: 'INC-2001',
                title: 'VPN Tunnel Failed',
                category: 'Network',
                document: 'VPN tunnel is timing out on gateway'
              }
            }
          ]
        })
      });

      const results = await qdrantService.querySimilar([0.1, 0.2, 0.3], { top_k: 1 });
      expect(results).toHaveLength(1);
      expect(results[0].ticket_id).toBe('INC-2001');
      expect(results[0].similarity_score).toBe(0.9123);
      expect(results[0].source).toBe('qdrant');
      expect(results[0].vector_rank).toBe(1);
    });
  });

  describe('vectorSearchService integration with Qdrant', () => {
    it('should query Qdrant when healthy and return matches', async () => {
      jest.spyOn(embeddingService, 'generateEmbedding').mockResolvedValue(new Array(384).fill(0.05));
      jest.spyOn(qdrantService, 'isConfigured').mockReturnValue(true);
      jest.spyOn(qdrantService, 'healthCheck').mockResolvedValue(true);
      jest.spyOn(qdrantService, 'querySimilar').mockResolvedValue([
        {
          ticket_id: 'INC-888',
          title: 'Direct Qdrant Match',
          similarity_score: 0.95,
          source: 'qdrant'
        }
      ]);

      const results = await vectorSearchService.search('Network interface error');
      expect(results).toHaveLength(1);
      expect(results[0].ticket_id).toBe('INC-888');
      expect(results[0].source).toBe('qdrant');
    });
  });
});
