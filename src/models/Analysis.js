/**
 * Analysis.js (Compatibility Bridge)
 * Re-exports Analysis model from resolution repository.
 */

const { Analysis, analysisSchema } = require('../repositories/resolution.repository');

module.exports = Analysis;
module.exports.Analysis = Analysis;
module.exports.analysisSchema = analysisSchema;
