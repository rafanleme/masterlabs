const prisma = require('../lib/prisma');
const logger = require('../logger');

const AUDITED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Registra em AuditLog toda mutação bem-sucedida (status < 400) na API.
 * Não persiste corpo da requisição (LGPD) — apenas quem, o quê e quando.
 */
module.exports = function auditLogger(req, res, next) {
  if (!AUDITED_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    let actorType = 'ANONYMOUS';
    let actorId = null;
    let tenantId = null;

    if (req.user) {
      actorType = 'USER';
      actorId = req.user.userId;
      tenantId = req.user.tenantId;
    } else if (req.portal) {
      actorType = 'PORTAL_CLIENT';
      actorId = req.portal.clientId;
      tenantId = req.portal.tenantId;
    }

    prisma.auditLog
      .create({
        data: {
          tenantId,
          actorType,
          actorId,
          method: req.method,
          path: (req.originalUrl || req.url).split('?')[0].slice(0, 500),
          statusCode: res.statusCode,
          ip: (req.ip || '').slice(0, 64),
          correlationId: req.correlationId,
        },
      })
      .catch((err) => {
        logger.error({ event: 'audit.writeFailed', error: err.message, correlationId: req.correlationId });
      });
  });

  next();
};
