const service = require('./attendances.service');

async function create(req, res, next) {
  try {
    const attendance = await service.createAttendance(req.user.tenantId, req.body);
    res.status(201).json(attendance);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const result = await service.listAttendances(req.user.tenantId, req.query);
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const attendance = await service.getAttendanceById(req.user.tenantId, req.params.id);
    res.json(attendance);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const attendance = await service.updateAttendance(req.user.tenantId, req.params.id, req.body);
    res.json(attendance);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const attendance = await service.updateAttendanceStatus(req.user.tenantId, req.params.id, req.body.status);
    res.json(attendance);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await service.softDeleteAttendance(req.user.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

module.exports = { create, list, getById, update, updateStatus, remove };
