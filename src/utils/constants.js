/**
 * constants.js
 * Domain constants and enumeration values for IT Ticket Assistant.
 */

const ALLOWED_CATEGORIES = [
  'Network',
  'Access & Identity',
  'Hardware',
  'Software',
  'Server & Infrastructure',
  'Email & Collaboration'
];

const ALLOWED_PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

const ALLOWED_INTENTS = ['Incident', 'Service Request', 'Problem', 'Change Request'];

const ALLOWED_ENVIRONMENTS = ['Production', 'Staging', 'Development', 'QA', 'DR'];

const ALLOWED_STATUSES = [
  'New',
  'Assigned',
  'In Progress',
  'Pending',
  'Resolved',
  'Closed',
  'Cancelled'
];

const ALLOWED_ACCESS_LEVELS = ['internal', 'confidential', 'restricted', 'public'];

const ALLOWED_SOURCES = ['synthetic', 'production', 'sanitized_enterprise'];

const FEEDBACK_STATUSES = ['useful', 'incorrect', 'unresolved'];

const TARGET_TYPES = ['recommendation', 'similar_ticket', 'classification'];

const AUDIT_EVENT_TYPES = [
  'TICKET_SUBMITTED',
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'TICKET_STATUS_CHANGED',
  'ANALYSIS_STARTED',
  'CLASSIFICATION_COMPLETED',
  'RETRIEVAL_COMPLETED',
  'RECOMMENDATION_COMPLETED',
  'ANALYSIS_COMPLETED',
  'ANALYSIS_PARTIAL',
  'ANALYSIS_FAILED',
  'FEEDBACK_SUBMITTED',
  'FEEDBACK_REVISED',
  'SEED_INGESTED'
];

module.exports = {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_INTENTS,
  ALLOWED_ENVIRONMENTS,
  ALLOWED_STATUSES,
  ALLOWED_ACCESS_LEVELS,
  ALLOWED_SOURCES,
  FEEDBACK_STATUSES,
  TARGET_TYPES,
  AUDIT_EVENT_TYPES
};
