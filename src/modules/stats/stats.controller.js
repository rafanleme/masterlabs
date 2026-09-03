const service = require('./stats.service');

async function overview(req, res, next) {
  try {
    const result = await service.overview(req.user.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { overview };
