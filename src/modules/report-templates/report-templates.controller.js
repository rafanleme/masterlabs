const service = require('./report-templates.service');

async function create(req, res, next) {
  try {
    const template = await service.createReportTemplate(req.user.tenantId, req.body);
    res.status(201).json(template);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const result = await service.listReportTemplates(req.user.tenantId, req.query);
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const template = await service.getReportTemplateById(req.user.tenantId, req.params.id);
    res.json(template);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const template = await service.updateReportTemplate(req.user.tenantId, req.params.id, req.body);
    res.json(template);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.softDeleteReportTemplate(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { create, list, getById, update, remove };
