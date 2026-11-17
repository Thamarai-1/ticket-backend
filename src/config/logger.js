/**
 * logger.js
 * Structured logging utility.
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = process.env.NODE_ENV === 'test' ? 'error' : (process.env.LOG_LEVEL || 'info');

const shouldLog = (level) => {
  return (LOG_LEVELS[level] ?? 2) <= (LOG_LEVELS[currentLevel] ?? 2);
};

const sanitizeLog = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/(password|passwd|pwd|pass|secret|token)\s*[:=]\s*([^\s,;"]+)/gi, '$1: [REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
};

const formatMessage = (level, message, context = null) => {
  const timestamp = new Date().toISOString();
  let cleanMsg = typeof message === 'string' ? sanitizeLog(message) : message;
  let contextStr = '';
  if (context) {
    const rawContext = typeof context === 'object' ? JSON.stringify(context) : String(context);
    contextStr = ` [${sanitizeLog(rawContext)}]`;
  }
  return `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${cleanMsg}`;
};

const logger = {
  info: (msg, ctx) => {
    if (shouldLog('info')) console.log(formatMessage('info', msg, ctx));
  },
  warn: (msg, ctx) => {
    if (shouldLog('warn')) console.warn(formatMessage('warn', msg, ctx));
  },
  error: (msg, ctx) => {
    if (shouldLog('error')) console.error(formatMessage('error', msg, ctx));
  },
  debug: (msg, ctx) => {
    if (shouldLog('debug')) console.debug(formatMessage('debug', msg, ctx));
  }
};

module.exports = logger;
