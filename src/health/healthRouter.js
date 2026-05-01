const { Router } = require('express');
const logger = require('../logger');
const { checkMysql } = require('./mysqlCheck');

const router = Router();

router.get('/healthz', async (req, res) => {
  const start = Date.now();
  const mysqlResult = await checkMysql();
  const totalDuration = Date.now() - start;
  const overallStatus = mysqlResult.status === 'Healthy' ? 'Healthy' : 'Unhealthy';

  logger.info('Health check requested', {
    correlationId: req.correlationId,
    status: overallStatus,
    durationMs: totalDuration,
  });

  const statusCode = overallStatus === 'Healthy' ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    checks: [mysqlResult],
    totalDuration,
  });
});

router.get('/healthz/db', async (req, res) => {
  const mysqlResult = await checkMysql();

  logger.info('Database health check requested', {
    correlationId: req.correlationId,
    status: mysqlResult.status,
    durationMs: mysqlResult.duration,
  });

  const statusCode = mysqlResult.status === 'Healthy' ? 200 : 503;

  res.status(statusCode).json({
    status: mysqlResult.status,
    checks: [mysqlResult],
    totalDuration: mysqlResult.duration,
  });
});

module.exports = router;
