const logger = require('../logger');

module.exports = function httpLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('HTTP request', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
};
