const rateLimit = require('express-rate-limit');
const config = require('../config');

const passthrough = (req, res, next) => next();

function buildLimiter({ windowMs, max }) {
  if (!config.rateLimit.enabled) return passthrough;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        type: 'https://httpstatuses.com/429',
        title: 'Too Many Requests',
        status: 429,
        correlationId: req.correlationId,
      });
    },
  });
}

// Limite geral da API
const globalLimiter = buildLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
});

// Limite estrito para endpoints de autenticação (login, portal magic code)
const authLimiter = buildLimiter({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
});

module.exports = { globalLimiter, authLimiter };
