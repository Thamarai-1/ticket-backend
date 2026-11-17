/**
 * analysis.validator.js
 * Input validator for ticket analysis, similarity retrieval, and recommendation requests.
 */

const validateAnalysisRequest = (data) => {
  const errors = [];
  const { title, description } = data;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('title is required and cannot be empty');
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push('description is required and cannot be empty');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateRetrievalRequest = (data) => {
  const errors = [];
  const { title, description, ticket_id } = data;

  if (!ticket_id && (!title || typeof title !== 'string' || title.trim().length === 0)) {
    errors.push('title is required when ticket_id is not provided');
  }

  if (!ticket_id && (!description || typeof description !== 'string' || description.trim().length === 0)) {
    errors.push('description is required when ticket_id is not provided');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateAnalysisRequest,
  validateRetrievalRequest
};
