const rateLimit = require('express-rate-limit');

const checkerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many eligibility checks. Please slow down and try again in a minute.'
  }
});

const submitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 submissions per 5 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many application attempts. Please wait before submitting again.'
  }
});

const verificationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 45, // 45 task verifications per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Verification rate limit exceeded. Please wait a moment.'
  }
});

module.exports = {
  checkerLimiter,
  submitLimiter,
  verificationLimiter
};
