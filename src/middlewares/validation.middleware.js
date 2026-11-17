/**
 * validation.middleware.js
 * Generic Express request payload validation middleware.
 */

const { validateCreateTicket: validateTicketBody } = require('../validators/ticket.validator');
const { validateAnalysisRequest: validateAnalysisBody } = require('../validators/analysis.validator');
const { validateFeedbackRequest: validateFeedbackBody } = require('../validators/feedback.validator');
const { validateRegister: validateRegisterBody, validateLogin: validateLoginBody } = require('../validators/auth.validator');

const validate = (validatorFn) => {
  return (req, res, next) => {
    const { isValid, errors } = validatorFn(req.body);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Request Body',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

const validateCreateTicket = validate(validateTicketBody);
const validateAnalysisRequest = validate(validateAnalysisBody);
const validateFeedbackRequest = validate(validateFeedbackBody);
const validateRegister = validate(validateRegisterBody);
const validateLogin = validate(validateLoginBody);

module.exports = {
  validate,
  validateCreateTicket,
  validateAnalysisRequest,
  validateFeedbackRequest,
  validateRegister,
  validateLogin
};
