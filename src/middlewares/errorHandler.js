module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  res.status(status).json({
    type: `https://httpstatuses.com/${status}`,
    title: err.title || err.message || 'Internal Server Error',
    status,
    detail: err.detail || undefined,
    instance: req.originalUrl,
    correlationId: req.correlationId,
  });
};
