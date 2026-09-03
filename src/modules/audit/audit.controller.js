const service = require('./audit.service');

async function list(req, res, next) {
  try {
    const result = await service.listAuditLogs(req.user.tenantId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
