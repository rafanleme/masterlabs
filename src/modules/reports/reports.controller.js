const service = require('./reports.service');

async function create(req, res, next) {
  try {
    const report = await service.createReport(req.user.tenantId, req.body);
    res.status(201).json(report);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const result = await service.listReports(req.user.tenantId, req.query);
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const report = await service.getReportById(req.user.tenantId, req.params.id);
    res.json(report);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const report = await service.updateReport(req.user.tenantId, req.params.id, req.body);
    res.json(report);
  } catch (err) { next(err); }
}

async function updateItem(req, res, next) {
  try {
    const item = await service.updateReportItem(
      req.user.tenantId, req.params.id, req.params.assayId, req.body
    );
    res.json(item);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const report = await service.updateReportStatus(req.user.tenantId, req.params.id, req.body.status);
    res.json(report);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.softDeleteReport(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { create, list, getById, update, updateItem, updateStatus, remove };
