const app = require('./app');
const config = require('./config');
const logger = require('./logger');

const server = app.listen(config.port, () => {
  logger.info('Server started', {
    port: config.port,
    env: config.env,
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
