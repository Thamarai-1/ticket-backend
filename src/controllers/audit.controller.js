/**
 * audit.controller.js
 * Controller for Querying Immutable Compliance Audit Trails (FR-08).
 */

const auditService = require('../services/audit/audit.service');
const { parsePagination, formatPagination } = require('../utils/pagination');
const { paginatedResponse } = require('../utils/response');

const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, event_type, analysis_id, ticket_id, correlation_id } = req.query;
    const { page: pageNum, limit: limitNum, skip } = parsePagination({ page, limit }, 20, 100);

    const filter = {};
    if (event_type) filter.event_type = event_type;
    if (analysis_id) filter.analysis_id = analysis_id;
    if (ticket_id) filter.ticket_id = ticket_id;
    if (correlation_id) filter.correlation_id = correlation_id;

    const { logs, total } = await auditService.getAuditLogs(filter, { skip, limit: limitNum });

    return paginatedResponse(res, logs, formatPagination(total, pageNum, limitNum));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs
};
