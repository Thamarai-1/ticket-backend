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

const formatMessage = (level, message, context = null) => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` [${typeof context === 'object' ? JSON.stringify(context) : context}]` : '';
  return `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${message}`;
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
