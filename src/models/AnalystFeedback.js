/**
 * AnalystFeedback.js (Compatibility Bridge)
 * Re-exports AnalystFeedback model and constants from feedback repository.
 */

const {
  AnalystFeedback,
  analystFeedbackSchema,
  FEEDBACK_STATUSES,
  TARGET_TYPES
} = require('../repositories/feedback.repository');

module.exports = {
  AnalystFeedback,
  analystFeedbackSchema,
  FEEDBACK_STATUSES,
  TARGET_TYPES
};
