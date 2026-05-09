const service = require('./assays.service');

async function create(req, res, next) {
  try {
    const assay = await service.createAssay(req.user.tenantId, req.body);
    res.status(201).json(assay);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const result = await service.listAssays(req.user.tenantId, req.query);
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const assay = await service.getAssayById(req.user.tenantId, req.params.id);
    res.json(assay);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const assay = await service.updateAssay(req.user.tenantId, req.params.id, req.body);
    res.json(assay);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.softDeleteAssay(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { create, list, getById, update, remove };
