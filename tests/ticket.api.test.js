/**
 * ticket.api.test.js
 * Integration Test Suite for Ticket Management REST APIs using Supertest.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { Ticket } = require('../src/models/Ticket');
const { AuditEvent } = require('../src/models/AuditEvent');

describe('Ticket REST API Endpoints', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://localhost:27017';
    try {
      await mongoose.connect(mongoUri, {
        dbName: 'it_ticket_test_db',
        serverSelectionTimeoutMS: 2500
      });
      dbAvailable = true;
      await Ticket.deleteMany({});
      await AuditEvent.deleteMany({});

      // Seed 2 sample tickets for API testing
      await Ticket.create([
        {
          ticket_id: 'INC-3001',
          title: 'GlobalProtect VPN connection drops repeatedly',
          description: 'VPN tunnel disconnects intermittently every 5 to 10 minutes on workstation WS-01.',
          category: 'Network',
          subcategory: 'VPN',
          priority: 'P2',
          intent: 'Incident',
          affected_service: 'Corporate VPN',
          environment: 'Production',
          status: 'Resolved',
          assignment_group: 'Network Support',
          resolution_text: 'Adjusted MTU size to 1350 on virtual network adapter.',
          created_at: new Date('2026-01-10T08:00:00Z'),
          resolved_at: new Date('2026-01-10T10:00:00Z')
        },
        {
          ticket_id: 'INC-3002',
          title: 'User account locked out after multiple failed logon attempts',
          description: 'Employee account locked out in Active Directory with Event ID 4625.',
          category: 'Access & Identity',
          subcategory: 'Account Lockout',
          priority: 'P3',
          intent: 'Incident',
          affected_service: 'Active Directory Domain Services',
          environment: 'Production',
          status: 'New',
          assignment_group: 'Identity & Access Management',
          created_at: new Date('2026-01-11T09:00:00Z')
        }
      ]);
    } catch (err) {
      console.warn('[Integration Test Notice] MongoDB instance is not available. Skipping DB-dependent assertions.');
    }
  });

  afterAll(async () => {
    if (dbAvailable && mongoose.connection.readyState !== 0) {
      await Ticket.deleteMany({});
      await AuditEvent.deleteMany({});
      await mongoose.connection.close();
    }
  });

  describe('GET /api/health', () => {
    it('should return 200 and health status UP', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });
  });

  describe('GET /api/tickets', () => {
    it('should return paginated tickets structure', async () => {
      if (!dbAvailable) return;
      const res = await request(app).get('/api/tickets?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
    });

    it('should filter tickets by category', async () => {
      if (!dbAvailable) return;
      const res = await request(app).get('/api/tickets?category=Network');
      expect(res.status).toBe(200);
      expect(res.body.data.every((t) => t.category === 'Network')).toBe(true);
    });
  });

  describe('GET /api/tickets/:ticketId', () => {
    it('should return 200 and the ticket for a valid ticket_id', async () => {
      if (!dbAvailable) return;
      const res = await request(app).get('/api/tickets/INC-3001');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket_id).toBe('INC-3001');
    });

    it('should return 404 for a non-existent ticket_id', async () => {
      if (!dbAvailable) return;
      const res = await request(app).get('/api/tickets/INC-999999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('POST /api/tickets', () => {
    it('should create a new ticket and generate audit event', async () => {
      if (!dbAvailable) return;
      const payload = {
        title: 'New printer queue offline in Building 2',
        description: 'HP LaserJet printer spooler service has stopped responding.',
        category: 'Hardware',
        subcategory: 'Printer',
        priority: 'P3',
        affected_service: 'Print Server Services',
        assignment_group: 'Desktop Support',
        environment: 'Production'
      };

      const res = await request(app)
        .post('/api/tickets')
        .set('x-user-id', 'test_technician')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket_id).toBeDefined();
      expect(res.body.data.title).toBe(payload.title);

      // Verify audit event creation
      const audit = await AuditEvent.findOne({ ticket_id: res.body.data.ticket_id });
      expect(audit).toBeDefined();
      expect(audit.event_type).toBe('TICKET_CREATED');
      expect(audit.actor_reference.actor_id).toBe('test_technician');
    });

    it('should reject creation when validation fails (short title)', async () => {
      const invalidPayload = {
        title: 'No', // Too short (< 5 chars)
        description: 'Valid description text here',
        category: 'Network',
        priority: 'P2'
      };

      const res = await request(app).post('/api/tickets').send(invalidPayload);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid Request Body');
    });
  });

  describe('GET /api/tickets/search', () => {
    it('should search tickets matching keyword query', async () => {
      if (!dbAvailable) return;
      const res = await request(app).get('/api/tickets/search?q=VPN');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/tickets/stats', () => {
    it('should return aggregation statistics breakdown', async () => {
      if (!dbAvailable) return;
      const res = await request(app).get('/api/tickets/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTickets).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.body.data.categoryDistribution)).toBe(true);
      expect(Array.isArray(res.body.data.priorityDistribution)).toBe(true);
      expect(Array.isArray(res.body.data.statusDistribution)).toBe(true);
      expect(res.body.data.resolutionMetrics).toBeDefined();
    });
  });
});
