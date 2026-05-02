const service = require('./clients.service');

async function create(req, res, next) {
  try {
    const client = await service.createClient(req.user.tenantId, req.body);
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await service.listClients(req.user.tenantId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const client = await service.getClientById(req.user.tenantId, req.params.id);
    res.json(client);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const client = await service.updateClient(req.user.tenantId, req.params.id, req.body);
    res.json(client);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.softDeleteClient(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, update, remove };
