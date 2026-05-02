const { randomUUID } = require('crypto');

module.exports = function correlationId(req, res, next) {
  const id = req.headers['x-correlation-id'] || randomUUID();
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
};
