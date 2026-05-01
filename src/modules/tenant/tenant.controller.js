const { registerTenant } = require('./tenant.service');

async function register(req, res, next) {
  try {
    const result = await registerTenant(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { register };
