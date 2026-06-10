const prisma = require('../../../lib/prisma');
const storageClient = require('../../../lib/storageClient');
const logger = require('../../../logger');
const { renderReportPdf } = require('./pdf.renderer');

function notFound(message = 'Recurso não encontrado') {
  const err = new Error(message);
  err.status = 404;
  return err;
}

const ASSAY_SELECT = {
  id: true, nome: true, unidade: true, metodoAnalitico: true,
  tipoComparacao: true, limiteMinimo: true, limiteMaximo: true, valorReferencia: true,
};

function normalizeNumeroLaudo(numero) {
  return numero.replace(/\//g, '-');
}

function buildFilename(report, version) {
  return `laudo-${normalizeNumeroLaudo(report.numeroLaudo)}-v${version}.pdf`;
}

function buildFolder(tenantId, reportId) {
  return `laudos/${tenantId}/${reportId}`;
}

function publicArtifact(a) {
  return {
    id: a.id,
    reportId: a.reportId,
    version: a.version,
    filename: a.filename,
    size: a.size,
    createdAt: a.createdAt,
    createdBy: a.createdBy
      ? { id: a.createdBy.id, name: a.createdBy.name }
      : { id: a.createdById, name: null },
  };
}

async function loadReportForRendering(tenantId, reportId) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, tenantId, deletedAt: null },
    include: {
      tenant:  { select: {
        id: true, razaoSocial: true, nomeFantasia: true,
        cnpj: true, email: true, telefone: true, endereco: true,
      } },
      sample:  { include: { client: true } },
      items:   { orderBy: { ordem: 'asc' }, include: { assay: { select: ASSAY_SELECT } } },
    },
  });
  if (!report) throw notFound('Laudo não encontrado');
  return report;
}

async function generatePdf(tenantId, reportId, userId) {
  const report = await loadReportForRendering(tenantId, reportId);

  if (report.status !== 'EMITIDO') {
    const err = new Error(`Geração de PDF requer laudo EMITIDO (atual: ${report.status})`);
    err.status = 409;
    throw err;
  }

  const renderData = {
    tenant:  report.tenant,
    client:  report.sample.client,
    sample:  report.sample,
    report:  {
      id: report.id,
      numeroLaudo: report.numeroLaudo,
      status: report.status,
      dataEmissao: report.dataEmissao,
      responsavel: report.responsavel,
      observacoes: report.observacoes,
    },
    items:   report.items,
    generatedAt: new Date(),
  };

  const buffer = await renderReportPdf(renderData);

  const lastVersion = await prisma.pdfArtifact.findFirst({
    where: { reportId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version || 0) + 1;

  const uploaded = await storageClient.uploadFile({
    buffer,
    filename: buildFilename(report, nextVersion),
    folder:   buildFolder(tenantId, reportId),
  });

  const artifact = await prisma.pdfArtifact.create({
    data: {
      tenantId,
      reportId,
      version:     nextVersion,
      storagePath: uploaded.path,
      filename:    uploaded.filename,
      size:        uploaded.size,
      createdById: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  logger.info({
    event: 'pdfArtifact.created',
    artifactId: artifact.id, reportId, tenantId, version: nextVersion,
  });

  return publicArtifact(artifact);
}

async function listVersions(tenantId, reportId) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!report) throw notFound('Laudo não encontrado');

  const artifacts = await prisma.pdfArtifact.findMany({
    where: { reportId, tenantId },
    orderBy: { version: 'desc' },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return artifacts.map(publicArtifact);
}

async function getDownloadable(tenantId, reportId, versionParam) {
  const report = await prisma.report.findFirst({
    where: { id: reportId, tenantId, deletedAt: null },
    select: { id: true, numeroLaudo: true },
  });
  if (!report) throw notFound('Laudo não encontrado');

  const where = { reportId, tenantId };
  let artifact;
  if (versionParam != null) {
    const version = parseInt(versionParam, 10);
    if (!Number.isInteger(version) || version < 1) {
      throw notFound('Versão de PDF não encontrada');
    }
    artifact = await prisma.pdfArtifact.findFirst({ where: { ...where, version } });
  } else {
    artifact = await prisma.pdfArtifact.findFirst({
      where,
      orderBy: { version: 'desc' },
    });
  }
  if (!artifact) throw notFound('PDF não encontrado para este laudo');

  const buffer = await storageClient.downloadFile(artifact.storagePath);

  return {
    buffer,
    size: buffer.length,
    downloadName: buildFilename(report, artifact.version),
    version: artifact.version,
  };
}

module.exports = { generatePdf, listVersions, getDownloadable };
