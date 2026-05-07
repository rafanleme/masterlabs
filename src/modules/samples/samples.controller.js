const service = require('./samples.service');

async function create(req, res, next) {
  try {
    const sample = await service.createSample(req.user.tenantId, req.body);
    res.status(201).json(sample);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const result = await service.listSamples(req.user.tenantId, req.query);
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const sample = await service.getSampleById(req.user.tenantId, req.params.id);
    res.json(sample);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const sample = await service.updateSample(req.user.tenantId, req.params.id, req.body);
    res.json(sample);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const sample = await service.updateSampleStatus(req.user.tenantId, req.params.id, req.body.status);
    res.json(sample);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.softDeleteSample(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { create, list, getById, update, updateStatus, remove };
