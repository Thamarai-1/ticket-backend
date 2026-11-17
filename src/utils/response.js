/**
 * response.js
 * Uniform API response envelope helpers.
 */

const successResponse = (res, data, statusCode = 200, message = null, extra = {}) => {
  const payload = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...extra
  };
  if (message) {
    payload.message = message;
  }
  return res.status(statusCode).json(payload);
};

const paginatedResponse = (res, data, pagination, statusCode = 200, extra = {}) => {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString(),
    ...extra
  });
};

const errorResponse = (res, message, statusCode = 500, details = null, extra = {}) => {
  return res.status(statusCode).json({
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString(),
    ...extra
  });
};

module.exports = {
  successResponse,
  paginatedResponse,
  errorResponse
};
