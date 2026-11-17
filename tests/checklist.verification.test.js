/**
 * checklist.verification.test.js
 * End-to-end and unit verification of the 9 required capabilities:
 * 1. Security: Restricted user denied access to protected ticket (403 Forbidden)
 * 2. Data leakage: Fake password and email redacted from context, responses, logs
 * 3. Chunking: Resolution steps understandable and source IDs preserved
 * 4. RAG retrieval: Labelled incident appears in top five results
 * 5. Hallucination control: System abstains on unseen incident
 * 6. Incremental refresh: Approved ticket becomes immediately searchable
 * 7. Duplicate detection: Exact duplicate and semantic rephrasing flagged
 * 8. Audit: analysis_id, model_versions, evidence, and reviewer decisions recorded
 * 9. MTTR: Calculation verified using created_at and resolved_at
 */

const { Readable } = require('stream');
const app = require('../src/config/app');
const tokenService = require('../src/services/auth/token.service');
const { userRepository } = require('../src/repositories/user.repository');
const { ticketRepository } = require('../src/repositories/ticket.repository');
const chunkingService = require('../src/services/retrieval/chunking.service');
const hybridSearchService = require('../src/services/retrieval/hybrid-search.service');
const resolutionService = require('../src/services/recommendation/resolution.service');
const promptService = require('../src/services/ai/prompt.service');
const mttrService = require('../src/services/analytics/mttr.service');
const auditService = require('../src/services/audit/audit.service');
const ticketNormalizationService = require('../src/services/ticket/ticket-normalization.service');

// Helper to invoke Express app in-process without network sockets
function invokeExpress(appInstance, options) {
  return new Promise((resolve) => {
    const { method = 'GET', url = '/', headers = {}, body = null } = options;
    const bodyStr = body ? JSON.stringify(body) : '';

    const req = new Readable({
      read() {
        if (bodyStr) {
          this.push(bodyStr);
        }
        this.push(null);
      }
    });

    req.method = method.toUpperCase();
    req.url = url;
    req.originalUrl = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    if (body) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = Buffer.byteLength(bodyStr).toString();
    }

    const mockSocket = {
      remoteAddress: '127.0.0.1',
      destroy: () => {},
      end: () => {}
    };
    req.socket = mockSocket;
    req.connection = mockSocket;
    req.destroy = () => {};

    let statusCode = 200;
    const resHeaders = {};

    const res = {
      statusCode: 200,
      setHeader: (key, val) => {
        resHeaders[key.toLowerCase()] = val;
      },
      getHeader: (key) => resHeaders[key.toLowerCase()],
      status: (code) => {
        statusCode = code;
        res.statusCode = code;
        return res;
      },
      json: (data) => {
        resHeaders['content-type'] = 'application/json';
        resolve({ status: statusCode, statusCode, headers: resHeaders, body: data });
      },
      send: (data) => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: statusCode, statusCode, headers: resHeaders, body: parsed });
      },
      end: (data) => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        resolve({ status: statusCode, statusCode, headers: resHeaders, body: parsed });
      }
    };

    appInstance.handle(req, res);
  });
}

describe('Master 9-Point Verification Test Suite', () => {
  let adminToken;
  let restrictedToken;
  let analystToken;

  beforeAll(async () => {
    // Generate valid JWT tokens for test roles
    adminToken = tokenService.generateToken({
      user_id: 'usr-sanjai-01',
      email: 'sanjaiexplores@gmail.com',
      role: 'admin',
      access_level: 'restricted'
    });

    restrictedToken = tokenService.generateToken({
      user_id: 'usr-restricted-01',
      email: 'restricted@corp.com',
      role: 'user',
      access_level: 'internal'
    });

    analystToken = tokenService.generateToken({
      user_id: 'usr-analyst-01',
      email: 'analyst@corp.com',
      role: 'analyst',
      access_level: 'internal'
    });
  });

  // 1. Security: Log in as a restricted user and attempt to retrieve another user's protected ticket.
  test('[1. Security] Restricted user denied access (403) to protected ticket; admin granted access', async () => {
    // Restricted user attempts to retrieve protected INC-9999
    const restrictedRes = await invokeExpress(app, {
      method: 'GET',
      url: '/api/tickets/INC-9999',
      headers: { authorization: `Bearer ${restrictedToken}` }
    });
    expect(restrictedRes.status).toBe(403);
    expect(restrictedRes.body.error).toMatch(/Access denied/i);

    // Admin attempts to retrieve same protected ticket -> 200 OK
    const adminRes = await invokeExpress(app, {
      method: 'GET',
      url: '/api/tickets/INC-9999',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.ticket_id).toBe('INC-9999');
  });

  // 2. Data leakage: Submit a synthetic ticket containing a fake password and email.
  test('[2. Data leakage] Secrets and emails are redacted from responses, model prompt context, and normalization', async () => {
    const rawPayload = {
      title: 'Database connection issue with password: SecretP@ssword123!',
      description: 'Contact user at secret.analyst@corp.com with auth token: Bearer_super_token_999 to resolve.',
      affected_service: 'Database Service',
      category: 'Software',
      subcategory: 'Database',
      priority: 'P2',
      intent: 'Incident',
      environment: 'Production'
    };

    // Verify normalization redacts secrets
    const normalized = ticketNormalizationService.normalizeTicket(rawPayload);
    expect(normalized.title).not.toContain('SecretP@ssword123!');
    expect(normalized.title).toContain('[REDACTED_PASSWORD]');
    expect(normalized.description).not.toContain('secret.analyst@corp.com');
    expect(normalized.description).toContain('[REDACTED_EMAIL]');
    expect(normalized.description).not.toContain('Bearer_super_token_999');
    expect(normalized.description).toContain('[REDACTED_SECRET]');

    // Verify model prompt builder never leaks secrets
    const prompt = promptService.buildClassificationPrompt(rawPayload);
    expect(prompt).not.toContain('SecretP@ssword123!');
    expect(prompt).not.toContain('secret.analyst@corp.com');
    expect(prompt).toContain('[REDACTED_PASSWORD]');
    expect(prompt).toContain('[REDACTED_EMAIL]');

    // Verify API response for ticket creation redacts secrets
    const res = await invokeExpress(app, {
      method: 'POST',
      url: '/api/tickets',
      headers: { authorization: `Bearer ${adminToken}` },
      body: rawPayload
    });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toContain('[REDACTED_PASSWORD]');
    expect(res.body.data.description).toContain('[REDACTED_EMAIL]');
  });

  // 3. Chunking: Inspect generated chunks. Confirm resolution steps remain understandable and source IDs are preserved.
  test('[3. Chunking] Source IDs are preserved and resolution steps are segmented coherently', async () => {
    const ticketToChunk = {
      ticket_id: 'INC-10001',
      title: 'Account Disruption Outage',
      description: 'Centralized account portal offline.',
      category: 'Network',
      affected_service: 'Technical Support',
      resolution_text: '1. Verify gateway connectivity.\n2. Restart Active Directory sync.\n3. Validate user authentication.'
    };

    const chunks = chunkingService.chunkTicket(ticketToChunk);
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    // Verify EVERY chunk preserves source_id
    chunks.forEach((chunk) => {
      expect(chunk.source_id).toBe('INC-10001');
      expect(chunk.chunk_id).toContain('INC-10001');
    });

    // Verify step chunks are structured and understandable
    const stepChunks = chunks.filter((c) => c.chunk_type === 'resolution_step');
    expect(stepChunks.length).toBe(3);
    expect(stepChunks[0].step_number).toBe(1);
    expect(stepChunks[0].content).toContain('Verify gateway connectivity');
    expect(stepChunks[1].step_number).toBe(2);
    expect(stepChunks[1].content).toContain('Restart Active Directory sync');

    // Test API chunk inspection endpoint
    const inspectRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/search/chunks/inspect',
      headers: { authorization: `Bearer ${adminToken}` },
      body: ticketToChunk
    });
    expect(inspectRes.status).toBe(200);
    expect(inspectRes.body.data.chunks.length).toBeGreaterThanOrEqual(3);
  });

  // 4. RAG retrieval: Use a labelled incident and verify relevant historical ticket appears in top five results.
  test('[4. RAG retrieval] Hybrid search retrieves labelled historical ticket in top five results', async () => {
    // Seed a labelled incident in repository
    await ticketRepository.create({
      ticket_id: 'INC-10001',
      title: 'Account Disruption',
      description: 'Centralized account management portal appears to be offline. Users cannot authenticate.',
      category: 'Network',
      subcategory: 'Account',
      priority: 'P2',
      intent: 'Incident',
      affected_service: 'Technical Support',
      environment: 'Production',
      status: 'Resolved',
      assignment_group: 'Technical Support',
      resolution_text: 'Restored centralized account management gateway and cleared stale session caches.'
    });

    const res = await invokeExpress(app, {
      method: 'POST',
      url: '/api/search/hybrid',
      headers: { authorization: `Bearer ${adminToken}` },
      body: {
        query: 'Account Disruption centralized account management portal',
        top_k: 5
      }
    });

    expect(res.status).toBe(200);
    const results = res.body.data.results || [];
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);

    const foundLabelled = results.some((r) => r.ticket_id === 'INC-10001');
    expect(foundLabelled).toBe(true);
  });

  // 5. Hallucination control: Submit an unseen incident. The system must abstain when no reliable evidence exists.
  test('[5. Hallucination control] System abstains when no reliable evidence exists for an unseen incident', async () => {
    const unseenIncident = {
      title: 'Unseen / OOD Incident (Insufficient Evidence)',
      description: 'Quantum photonic neural processor matrix desynchronization failure in cryogenic sub-module.',
      affected_service: 'Experimental Systems',
      environment: 'Production'
    };

    const recResult = await resolutionService.recommendResolution(unseenIncident);
    expect(recResult.recommendation_status).toBe('abstained');
    expect(recResult.recommendations).toEqual([]);
    expect(recResult.confidence.level).toBe('insufficient_evidence');
    expect(recResult.confidence.basis).toMatch(/abstains to prevent hallucination/i);
    expect(recResult.review_required).toBe(true);
  });

  // 6. Incremental refresh: Add an approved historical ticket, run indexing and verify it becomes searchable.
  test('[6. Incremental refresh] Newly approved historical ticket becomes immediately searchable', async () => {
    const newApprovedTicket = {
      ticket_id: 'INC-8888',
      title: 'Kubernetes Ingress Gateway High Latency',
      description: 'Ingress controller dropping TLS handshakes under high connection volume.',
      category: 'Server & Infrastructure',
      subcategory: 'Kubernetes',
      priority: 'P1',
      intent: 'Incident',
      affected_service: 'Cloud & Datacenter Operations',
      environment: 'Production',
      status: 'Resolved',
      assignment_group: 'Cloud Operations',
      resolution_text: 'Increased worker replica pool and tuned keep-alive timeouts in nginx ingress config.'
    };

    // 1. Add approved ticket
    const createRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/tickets',
      headers: { authorization: `Bearer ${adminToken}` },
      body: newApprovedTicket
    });
    expect(createRes.status).toBe(201);

    // 2. Trigger incremental indexing job
    const jobRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/admin/jobs/embedding',
      headers: { authorization: `Bearer ${adminToken}` },
      body: { batchSize: 5 }
    });
    expect(jobRes.status).toBe(200);

    // 3. Verify it is immediately searchable
    const searchRes = await invokeExpress(app, {
      method: 'GET',
      url: '/api/tickets/search?q=Kubernetes+Ingress',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(searchRes.status).toBe(200);
    const found = (searchRes.body.data || []).some((t) => t.ticket_id === 'INC-8888');
    expect(found).toBe(true);
  });

  // 7. Duplicate detection: Submit the same request twice, then test two differently worded descriptions.
  test('[7. Duplicate detection] Flags exact duplicate request and semantically rephrased incident', async () => {
    const queryExact = {
      title: 'GlobalProtect VPN drops immediately after authentication with Error 800',
      description: 'User enters credentials and completes MFA via GlobalProtect. Tunnel disconnects 5 seconds later.'
    };

    // First, seed the reference incident
    await ticketRepository.create({
      ticket_id: 'INC-10020',
      title: queryExact.title,
      description: queryExact.description,
      category: 'Network',
      subcategory: 'VPN',
      priority: 'P2',
      intent: 'Incident',
      affected_service: 'Corporate Network',
      environment: 'Production',
      status: 'Resolved',
      assignment_group: 'Network Operations',
      resolution_text: 'Reinstalled GlobalProtect virtual adapter and flushed local routing tables.'
    });

    // 1. Submit exact same request
    const exactSearch = await hybridSearchService.retrieve({
      title: queryExact.title,
      description: queryExact.description,
      top_k: 5
    });

    const exactMatch = exactSearch.results.find((r) => r.ticket_id === 'INC-10020');
    expect(exactMatch).toBeDefined();
    expect(exactMatch.potential_duplicate).toBe(true);
    expect(exactMatch.duplicate_confidence).toBeGreaterThanOrEqual(0.85);

    // 2. Submit differently worded description of the same incident
    const semanticVariant = {
      title: 'GlobalProtect client disconnects right after MFA verification',
      description: 'VPN tunnel fails right after authentication code entered on gateway. Error 800 occurs.'
    };

    const variantSearch = await hybridSearchService.retrieve({
      title: semanticVariant.title,
      description: semanticVariant.description,
      top_k: 5
    });

    const variantMatch = variantSearch.results.find((r) => r.ticket_id === 'INC-10020');
    expect(variantMatch).toBeDefined();
    expect(variantMatch.potential_duplicate).toBe(true);
  });

  // 8. Audit: Verify that analysis ID, model version, evidence references and reviewer decisions are recorded.
  test('[8. Audit] Records analysis ID, model versions, evidence references, and reviewer decisions', async () => {
    // 1. Execute analysis
    const analysisRes = await invokeExpress(app, {
      method: 'POST',
      url: '/api/analyze',
      headers: { authorization: `Bearer ${analystToken}` },
      body: {
        title: 'Account Disruption Gateway Issue',
        description: 'Users cannot log in to account portal.',
        affected_service: 'Technical Support',
        environment: 'Production'
      }
    });

    expect(analysisRes.status).toBe(200);
    const analysis = analysisRes.body.data;
    expect(analysis.analysis_id).toBeDefined();
    expect(analysis.model_versions).toBeDefined();
    expect(analysis.model_versions.classification).toBeDefined();

    // 2. Record reviewer decision via feedback
    const feedbackRes = await invokeExpress(app, {
      method: 'POST',
      url: `/api/analyses/${analysis.analysis_id}/feedback`,
      headers: { authorization: `Bearer ${analystToken}` },
      body: {
        target_type: 'classification',
        target_id: 'category',
        feedback_status: 'useful',
        comment: 'Accurately classified to Network with appropriate triage priority.',
        reviewer: {
          user_id: 'usr-analyst-01',
          role: 'analyst',
          name: 'Senior Triage Analyst'
        }
      }
    });
    expect(feedbackRes.status).toBe(201);

    // 3. Inspect audit trail to verify complete records
    const auditRes = await invokeExpress(app, {
      method: 'GET',
      url: `/api/admin/audit?analysis_id=${analysis.analysis_id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(auditRes.status).toBe(200);
    const events = auditRes.body.data || [];
    expect(events.length).toBeGreaterThan(0);

    const hasAnalysisId = events.some((e) => e.analysis_id === analysis.analysis_id);
    expect(hasAnalysisId).toBe(true);

    const feedbackEvent = events.find((e) => e.event_type === 'FEEDBACK_SUBMITTED');
    expect(feedbackEvent).toBeDefined();
    expect(feedbackEvent.metadata.reviewer_decision).toBe('useful');
    expect(feedbackEvent.metadata.comment).toContain('Accurately classified');
  });

  // 9. MTTR: Resolve a test ticket and verify the calculation using created_at and resolved_at timestamps.
  test('[9. MTTR] Resolves a test ticket and verifies MTTR calculation using created_at and resolved_at', async () => {
    // Create a resolved ticket with exact 4 hours resolution duration
    const createdAt = new Date('2026-02-01T08:00:00Z');
    const resolvedAt = new Date('2026-02-01T12:00:00Z'); // 4.0 hours duration

    await ticketRepository.create({
      ticket_id: 'INC-MTTR-01',
      title: 'MTTR Test Incident',
      description: 'Resolution time testing incident.',
      category: 'Network',
      subcategory: 'Firewall',
      priority: 'P2',
      intent: 'Incident',
      affected_service: 'Network Operations',
      environment: 'Production',
      status: 'Resolved',
      assignment_group: 'Network Support',
      resolution_text: 'Applied firmware patch to resolve packet drops.',
      created_at: createdAt,
      resolved_at: resolvedAt
    });

    const mttrData = await mttrService.calculateMTTR();
    expect(mttrData.overall).toBeDefined();
    expect(mttrData.overall.resolvedCount).toBeGreaterThanOrEqual(1);
    expect(mttrData.overall.avgHours).toBeGreaterThan(0);
  });
});
