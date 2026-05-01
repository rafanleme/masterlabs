const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const correlationId = require('./middlewares/correlationId');
const httpLogger = require('./middlewares/httpLogger');
const errorHandler = require('./middlewares/errorHandler');
const healthRouter = require('./health/healthRouter');
const config = require('./config');

const app = express();

app.use(express.json());
app.use(correlationId);
app.use(httpLogger);

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MasterLabs API',
      version: '1.0.0',
      description: 'API base com healthchecks e observabilidade',
    },
  },
  apis: ['./src/health/healthRouter.js'],
});

if (config.env !== 'production') {
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use(healthRouter);

app.use(errorHandler);

module.exports = app;
