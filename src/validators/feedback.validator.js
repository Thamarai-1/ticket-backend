/**
 * feedback.validator.js
 * Input validator for analyst feedback submissions (FR-06).
 */

const { FEEDBACK_STATUSES, TARGET_TYPES } = require('../utils/constants');

const validateFeedbackRequest = (data) => {
  const errors = [];
  const { target_type, target_id, feedback_status, comment } = data;

  if (!target_type || !TARGET_TYPES.includes(target_type)) {
    errors.push(`Invalid target_type '${target_type}'. Must be one of: ${TARGET_TYPES.join(', ')}`);
  }

  if (!target_id || typeof target_id !== 'string' || target_id.trim().length === 0) {
    errors.push('target_id is required and cannot be empty');
  }

  if (!feedback_status || !FEEDBACK_STATUSES.includes(feedback_status)) {
    errors.push(`Invalid feedback_status '${feedback_status}'. Must be one of: ${FEEDBACK_STATUSES.join(', ')}`);
  }

  if (comment !== undefined && typeof comment === 'string' && comment.length > 2000) {
    errors.push('comment cannot exceed 2000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateFeedbackRequest
};
