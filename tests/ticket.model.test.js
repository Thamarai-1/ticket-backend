/**
 * ticket.model.test.js
 * Mongoose Schema Validation Test Suite.
 */

const mongoose = require('mongoose');
const { Ticket } = require('../src/models/Ticket');

describe('Ticket Mongoose Model Validation', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://localhost:27017';
    try {
      await mongoose.connect(mongoUri, {
        dbName: 'it_ticket_test_db',
        serverSelectionTimeoutMS: 2000
      });
      await Ticket.deleteMany({});
    } catch (err) {
      console.warn('[Test Notice] MongoDB not reachable; schema unit tests running in standalone validation mode.');
    }
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await Ticket.deleteMany({});
        await mongoose.connection.close();
      }
    } catch (err) {
      // Ignore disconnect errors
    }
  });

  it('should validate a complete, well-formed ticket', () => {
    const validTicket = new Ticket({
      ticket_id: 'INC-2001',
      title: 'GlobalProtect VPN tunnel drops after MFA',
      description: 'User experiences error 800 while authenticating against VPN gateway 10.240.0.1',
      category: 'Network',
      subcategory: 'VPN',
      priority: 'P2',
      intent: 'Incident',
      affected_service: 'Corporate VPN',
      environment: 'Production',
      status: 'Resolved',
      assignment_group: 'Network Support',
      resolution_text: 'Re-flushed DNS and upgraded GlobalProtect client to 6.1.2.',
      created_at: new Date('2026-01-10T10:00:00Z'),
      resolved_at: new Date('2026-01-10T12:00:00Z')
    });

    const err = validTicket.validateSync();
    expect(err).toBeUndefined();
  });

  it('should fail validation when required fields are missing', () => {
    const incompleteTicket = new Ticket({
      category: 'Network',
      priority: 'P2'
    });

    const err = incompleteTicket.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.ticket_id).toBeDefined();
    expect(err.errors.title).toBeDefined();
    expect(err.errors.description).toBeDefined();
    expect(err.errors.subcategory).toBeDefined();
    expect(err.errors.affected_service).toBeDefined();
    expect(err.errors.assignment_group).toBeDefined();
  });

  it('should reject invalid ticket_id pattern', () => {
    const ticket = new Ticket({
      ticket_id: 'INVALID-ID',
      title: 'Valid Ticket Title',
      description: 'Valid ticket description with adequate length',
      category: 'Network',
      subcategory: 'VPN',
      priority: 'P2',
      affected_service: 'Corporate VPN',
      assignment_group: 'Network Support'
    });

    const err = ticket.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.ticket_id).toBeDefined();
    expect(err.errors.ticket_id.message).toContain('pattern');
  });

  it('should reject invalid category not in taxonomy', () => {
    const ticket = new Ticket({
      ticket_id: 'INC-2002',
      title: 'Valid Title Here',
      description: 'Valid description text with enough characters',
      category: 'Cryptocurrency Mining', // Invalid
      subcategory: 'Bitcoin',
      priority: 'P1',
      affected_service: 'Miner',
      assignment_group: 'Security'
    });

    const err = ticket.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.category).toBeDefined();
  });

  it('should reject invalid priority values', () => {
    const ticket = new Ticket({
      ticket_id: 'INC-2003',
      title: 'Valid Title Here',
      description: 'Valid description text with enough characters',
      category: 'Network',
      subcategory: 'VPN',
      priority: 'P99', // Invalid
      affected_service: 'VPN',
      assignment_group: 'Network Support'
    });

    const err = ticket.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.priority).toBeDefined();
  });

  it('should reject resolved ticket if resolved_at precedes created_at', () => {
    const ticket = new Ticket({
      ticket_id: 'INC-2004',
      title: 'Valid Title Here',
      description: 'Valid description text with enough characters',
      category: 'Network',
      subcategory: 'VPN',
      priority: 'P2',
      affected_service: 'VPN',
      status: 'Resolved',
      assignment_group: 'Network Support',
      resolution_text: 'Fixed the VPN gateway setting.',
      created_at: new Date('2026-01-10T12:00:00Z'),
      resolved_at: new Date('2026-01-10T08:00:00Z') // 4 hours BEFORE creation
    });

    const err = ticket.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.resolved_at).toBeDefined();
    expect(err.errors.resolved_at.message).toContain('precede');
  });

  it('should reject resolved ticket if resolution_text is missing or blank', () => {
    const ticket = new Ticket({
      ticket_id: 'INC-2005',
      title: 'Valid Title Here',
      description: 'Valid description text with enough characters',
      category: 'Network',
      subcategory: 'VPN',
      priority: 'P2',
      affected_service: 'VPN',
      status: 'Resolved',
      assignment_group: 'Network Support',
      resolution_text: '', // Missing
      created_at: new Date('2026-01-10T08:00:00Z'),
      resolved_at: new Date('2026-01-10T12:00:00Z')
    });

    const err = ticket.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.resolution_text).toBeDefined();
  });
});
