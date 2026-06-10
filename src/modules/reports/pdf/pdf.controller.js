const service = require('./pdf.service');

async function generate(req, res, next) {
  try {
    const artifact = await service.generatePdf(
      req.user.tenantId, req.params.id, req.user.userId
    );
    res.status(201).json(artifact);
  } catch (err) { next(err); }
}

async function listVersions(req, res, next) {
  try {
    const versions = await service.listVersions(req.user.tenantId, req.params.id);
    res.json(versions);
  } catch (err) { next(err); }
}

async function download(req, res, next) {
  try {
    const { buffer, size, downloadName } = await service.getDownloadable(
      req.user.tenantId, req.params.id, req.query.version
    );
    const dispo = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `${dispo}; filename="${downloadName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(buffer);
  } catch (err) { next(err); }
}

module.exports = { generate, listVersions, download };
