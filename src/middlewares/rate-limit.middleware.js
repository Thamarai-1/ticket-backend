/**
 * rate-limit.middleware.js
 * In-memory sliding rate limiter middleware.
 */

const clientHits = new Map();

const rateLimitMiddleware = (options = {}) => {
  const windowMs = options.windowMs || 60 * 1000; // default 1 minute
  const max = options.max || 120; // default 120 requests per minute
  const message = options.message || 'Too many requests from this IP, please try again later';

  return (req, res, next) => {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const key = req.ip || req.headers['x-forwarded-for'] || 'anonymous';
    const now = Date.now();

    const record = clientHits.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    clientHits.set(key, record);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        error: message,
        retryAfterMs: record.resetTime - now,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

module.exports = rateLimitMiddleware;
