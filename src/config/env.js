/**
 * env.js
 * Centralized, validated environment configuration.
 */

require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Database settings
  DATABASE_URL: process.env.DATABASE_URL || 'mongodb://localhost:27017/it_ticket_db',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'it_ticket_db',

  // CORS & Security
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  JWT_SECRET: process.env.JWT_SECRET || 'it-ticket-default-secret-key-change-in-prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // Microservices & AI Providers
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  ML_SERVICE_TIMEOUT_MS: parseInt(process.env.ML_SERVICE_TIMEOUT_MS, 10) || 3000,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  AI_PROVIDER: process.env.AI_PROVIDER || 'ml-service',

  // Vector Database (Qdrant)
  QDRANT_URL: process.env.QDRANT_URL || '',
  QDRANT_API_KEY: process.env.QDRANT_API_KEY || '',
  QDRANT_COLLECTION_NAME: process.env.QDRANT_COLLECTION_NAME || 'ticket_embeddings'
};

module.exports = env;
