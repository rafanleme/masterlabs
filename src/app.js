const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const correlationId = require('./middlewares/correlationId');
const httpLogger = require('./middlewares/httpLogger');
const errorHandler = require('./middlewares/errorHandler');
const healthRouter = require('./health/healthRouter');
const tenantRoutes = require('./modules/tenant/tenant.routes');
const authRoutes = require('./modules/auth/auth.routes');
const clientsRoutes = require('./modules/clients/clients.routes');
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
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/clients', clientsRoutes);

app.use(errorHandler);

module.exports = app;
