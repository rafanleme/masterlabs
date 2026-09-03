const service = require('./portal.service');

async function requestCode(req, res, next) {
  try {
    const result = await service.requestCode(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function verifyCode(req, res, next) {
  try {
    const result = await service.verifyCode(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await service.getMe(req.portal);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listReports(req, res, next) {
  try {
    const result = await service.listMyReports(req.portal, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const { buffer, size, downloadName } = await service.downloadMyReportPdf(req.portal, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.end(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { requestCode, verifyCode, me, listReports, downloadPdf };
