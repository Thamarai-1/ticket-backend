/**
 * ml.service.js
 * Node.js HTTP Client Integration with Python FastAPI ML Service (Phases 2 & 3).
 *
 * Features:
 * - Reads ML_SERVICE_URL from environment (default: http://localhost:8000)
 * - Configurable request timeout (3000ms) with AbortController
 * - Error discrimination (ECONNREFUSED vs Timeout vs 4xx/5xx)
 * - Exposes classifyTicket, retrieveSimilarTickets, recommendResolution, checkHealth
 */

const env = require('../config/env');

const ML_SERVICE_URL = env.ML_SERVICE_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = env.ML_SERVICE_TIMEOUT_MS || 3000;

/**
 * Sends ticket payload to FastAPI /classify endpoint.
 */
const classifyTicket = async (ticketPayload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const url = `${ML_SERVICE_URL}/classify`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ticket_id: ticketPayload.ticket_id || null,
        title: ticketPayload.title,
        description: ticketPayload.description,
        affected_service: ticketPayload.affected_service || null
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const error = new Error(errData.detail || `ML Service returned HTTP status ${response.status}`);
      error.statusCode = response.status >= 500 ? 503 : response.status;
      throw error;
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      const timeoutError = new Error(`ML Service request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      timeoutError.statusCode = 504;
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }

    if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
      const connError = new Error(`ML Service at ${ML_SERVICE_URL} is unreachable`);
      connError.statusCode = 503;
      connError.code = 'ECONNREFUSED';
      throw connError;
    }

    throw err;
  }
};

/**
 * Phase 3: Sends retrieval payload to FastAPI /retrieve endpoint for hybrid search.
 */
const retrieveSimilarTickets = async (queryPayload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const url = `${ML_SERVICE_URL}/retrieve`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ticket_id: queryPayload.ticket_id || null,
        title: queryPayload.title,
        description: queryPayload.description,
        affected_service: queryPayload.affected_service || null,
        environment: queryPayload.environment || null,
        top_k: queryPayload.top_k || 5,
        filters: queryPayload.filters || null,
        method: queryPayload.method || 'hybrid'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const error = new Error(errData.detail || `ML Retrieval returned HTTP status ${response.status}`);
      error.statusCode = response.status >= 500 ? 503 : response.status;
      throw error;
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      const timeoutError = new Error(`ML Retrieval request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      timeoutError.statusCode = 504;
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }

    if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
      const connError = new Error(`ML Service at ${ML_SERVICE_URL} is unreachable`);
      connError.statusCode = 503;
      connError.code = 'ECONNREFUSED';
      throw connError;
    }

    throw err;
  }
};

/**
 * Phase 4: Sends ticket payload to FastAPI /recommend endpoint for evidence-backed resolutions.
 */
const recommendResolution = async (queryPayload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const url = `${ML_SERVICE_URL}/recommend`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ticket_id: queryPayload.ticket_id || null,
        title: queryPayload.title,
        description: queryPayload.description,
        affected_service: queryPayload.affected_service || null,
        environment: queryPayload.environment || null,
        top_k: queryPayload.top_k || 3,
        generation_mode: queryPayload.generation_mode || 'deterministic',
        user_data_access_level: queryPayload.user_data_access_level || 'internal'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const error = new Error(errData.detail || `ML Recommendation returned HTTP status ${response.status}`);
      error.statusCode = response.status >= 500 ? 503 : response.status;
      throw error;
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      const timeoutError = new Error(`ML Recommendation request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      timeoutError.statusCode = 504;
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }

    if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
      const connError = new Error(`ML Service at ${ML_SERVICE_URL} is unreachable`);
      connError.statusCode = 503;
      connError.code = 'ECONNREFUSED';
      throw connError;
    }

    throw err;
  }
};

/**
 * Checks readiness of the ML service via /health endpoint.
 */
const checkHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${ML_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return { status: 'DEGRADED', model_loaded: false, retrieval_ready: false };
    return await res.json();
  } catch {
    return { status: 'DOWN', model_loaded: false, retrieval_ready: false };
  }
};

module.exports = {
  classifyTicket,
  retrieveSimilarTickets,
  recommendResolution,
  checkHealth
};
