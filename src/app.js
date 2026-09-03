const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const correlationId = require('./middlewares/correlationId');
const httpLogger = require('./middlewares/httpLogger');
const errorHandler = require('./middlewares/errorHandler');
const auditLogger = require('./middlewares/auditLogger');
const { globalLimiter, authLimiter } = require('./middlewares/rateLimiters');
const healthRouter = require('./health/healthRouter');
const tenantRoutes = require('./modules/tenant/tenant.routes');
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const clientsRoutes     = require('./modules/clients/clients.routes');
const attendancesRoutes = require('./modules/attendances/attendances.routes');
const samplesRoutes     = require('./modules/samples/samples.routes');
const assaysRoutes           = require('./modules/assays/assays.routes');
const reportTemplatesRoutes  = require('./modules/report-templates/report-templates.routes');
const reportsRoutes          = require('./modules/reports/reports.routes');
const portalRoutes           = require('./modules/portal/portal.routes');
const statsRoutes            = require('./modules/stats/stats.routes');
const auditRoutes            = require('./modules/audit/audit.routes');
const openapiSpec = require('./docs/openapi');
const config = require('./config');

const app = express();

if (config.env === 'production') {
  app.set('trust proxy', 1); // Heroku roda atrás de proxy — necessário p/ rate limit por IP real
}

app.use(helmet());
app.use(cors({
  exposedHeaders: ['Content-Disposition', 'X-Correlation-ID'],
  ...(config.cors.origins.length > 0 ? { origin: config.cors.origins } : {}),
}));
app.use(express.json());
app.use(correlationId);
app.use(httpLogger);

app.use('/swagger.json', (req, res) => res.json(openapiSpec));
if (config.env !== 'production') {
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(openapiSpec));
}

app.use(healthRouter);

app.use('/api/v1', globalLimiter);
app.use('/api/v1', auditLogger);

app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/clients',     clientsRoutes);
app.use('/api/v1/attendances', attendancesRoutes);
app.use('/api/v1/samples',     samplesRoutes);
app.use('/api/v1/assays',            assaysRoutes);
app.use('/api/v1/report-templates',  reportTemplatesRoutes);
app.use('/api/v1/reports',           reportsRoutes);
app.use('/api/v1/portal',            portalRoutes);
app.use('/api/v1/stats',             statsRoutes);
app.use('/api/v1/audit-logs',        auditRoutes);

app.use(errorHandler);

module.exports = app;
