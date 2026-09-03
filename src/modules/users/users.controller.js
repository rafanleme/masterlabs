const service = require('./users.service');

async function create(req, res, next) {
  try {
    const user = await service.createUser(req.user.tenantId, req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await service.listUsers(req.user.tenantId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const user = await service.getUserById(req.user.tenantId, req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const user = await service.updateUser(req.user.tenantId, req.params.id, req.user.userId, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.deactivateUser(req.user.tenantId, req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, remove };
