const prisma = require('../../lib/prisma');
const logger = require('../../logger');
const { toCsv } = require('../../lib/csv');

const DEFAULT_PAGE      = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 100;

const STATUS_TRANSITIONS = {
  RASCUNHO: ['EMITIDO', 'CANCELADO'],
  EMITIDO:  [],
  CANCELADO:[],
};

const ASSAY_SELECT = {
  id: true, nome: true, unidade: true, metodoAnalitico: true,
  tipoComparacao: true, limiteMinimo: true, limiteMaximo: true, valorReferencia: true,
};

const ITEMS_INCLUDE = {
  orderBy: { ordem: 'asc' },
  include: { assay: { select: ASSAY_SELECT } },
};

function notFound() {
  const err = new Error('Laudo não encontrado');
  err.status = 404;
  return err;
}

function requireRascunho(report) {
  if (report.status !== 'RASCUNHO') {
    const err = new Error(`Operação não permitida: laudo está ${report.status}`);
    err.status = 422;
    throw err;
  }
}

function handlePrismaConflict(err) {
  if (err.code === 'P2002') {
    const conflict = new Error('Já existe um laudo com este número neste laboratório');
    conflict.status = 409;
    throw conflict;
  }
  throw err;
}

function calcularConformidade(assay, valorNumerico) {
  if (!assay.tipoComparacao || assay.tipoComparacao === 'TEXTO') return 'INCONCLUSIVO';
  if (valorNumerico == null) return 'INCONCLUSIVO';
  const v = valorNumerico;
  switch (assay.tipoComparacao) {
    case 'ENTRE':       return (assay.limiteMinimo <= v && v <= assay.limiteMaximo) ? 'CONFORME' : 'NAO_CONFORME';
    case 'MENOR_QUE':   return (v < assay.limiteMaximo)  ? 'CONFORME' : 'NAO_CONFORME';
    case 'MENOR_IGUAL': return (v <= assay.limiteMaximo) ? 'CONFORME' : 'NAO_CONFORME';
    case 'MAIOR_QUE':   return (v > assay.limiteMinimo)  ? 'CONFORME' : 'NAO_CONFORME';
    case 'MAIOR_IGUAL': return (v >= assay.limiteMinimo) ? 'CONFORME' : 'NAO_CONFORME';
    default:            return 'INCONCLUSIVO';
  }
}

async function generateNumeroLaudo(tx, tenantId) {
  const year = new Date().getFullYear();
  const suffix = `/${year}`;
  const last = await tx.report.findFirst({
    where: { tenantId, numeroLaudo: { endsWith: suffix } },
    orderBy: { numeroLaudo: 'desc' },
    select: { numeroLaudo: true },
  });
  const seq = last ? parseInt(last.numeroLaudo.split('/')[0], 10) + 1 : 1;
  return `${String(seq).padStart(4, '0')}/${year}`;
}

async function createReport(tenantId, { sampleId, reportTemplateId, responsavel, observacoes }) {
  const [sample, template] = await Promise.all([
    prisma.sample.findFirst({ where: { id: sampleId, tenantId, deletedAt: null }, select: { id: true } }),
    prisma.reportTemplate.findFirst({
      where: { id: reportTemplateId, tenantId, deletedAt: null },
      include: { assays: { orderBy: { ordem: 'asc' }, include: { assay: { select: ASSAY_SELECT } } } },
    }),
  ]);

  if (!sample) {
    const err = new Error('Amostra não encontrada'); err.status = 404; throw err;
  }
  if (!template) {
    const err = new Error('Modelo de laudo não encontrado'); err.status = 404; throw err;
  }

  try {
    const report = await prisma.$transaction(async (tx) => {
      const numero = await generateNumeroLaudo(tx, tenantId);
      return tx.report.create({
        data: {
          tenantId, sampleId, reportTemplateId,
          numeroLaudo: numero, responsavel, observacoes,
          items: {
            create: template.assays.map(({ assayId, ordem }) => ({
              assayId, ordem, conformidade: 'INCONCLUSIVO',
            })),
          },
        },
        include: { items: { ...ITEMS_INCLUDE } },
      });
    });
    logger.info({ event: 'report.created', reportId: report.id, tenantId });
    return report;
  } catch (err) {
    handlePrismaConflict(err);
  }
}

async function listReports(tenantId, query) {
  let { page, pageSize, status, sampleId } = query;

  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(status   && { status }),
    ...(sampleId && { sampleId }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, numeroLaudo: true, status: true, dataEmissao: true,
        responsavel: true, sampleId: true, reportTemplateId: true, createdAt: true,
      },
    }),
    prisma.report.count({ where }),
  ]);

  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

async function getReportById(tenantId, id) {
  const report = await prisma.report.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { items: { ...ITEMS_INCLUDE } },
  });
  if (!report) throw notFound();
  return report;
}

async function updateReport(tenantId, id, data) {
  const report = await prisma.report.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!report) throw notFound();
  requireRascunho(report);
  const updated = await prisma.report.update({ where: { id }, data, include: { items: { ...ITEMS_INCLUDE } } });
  logger.info({ event: 'report.updated', reportId: id, tenantId });
  return updated;
}

async function updateReportItem(tenantId, reportId, assayId, { valor, valorNumerico, observacoes }) {
  const report = await prisma.report.findFirst({ where: { id: reportId, tenantId, deletedAt: null } });
  if (!report) throw notFound();
  requireRascunho(report);

  const item = await prisma.reportItem.findFirst({
    where: { reportId, assayId },
    include: { assay: { select: ASSAY_SELECT } },
  });
  if (!item) {
    const err = new Error('Item não encontrado neste laudo'); err.status = 404; throw err;
  }

  const conformidade = calcularConformidade(item.assay, valorNumerico ?? item.valorNumerico);

  const updated = await prisma.reportItem.update({
    where: { id: item.id },
    data: {
      ...(valor         !== undefined && { valor }),
      ...(valorNumerico !== undefined && { valorNumerico }),
      ...(observacoes   !== undefined && { observacoes }),
      conformidade,
    },
    include: { assay: { select: ASSAY_SELECT } },
  });

  logger.info({ event: 'reportItem.updated', reportId, assayId, tenantId, conformidade });
  return updated;
}

async function updateReportStatus(tenantId, id, newStatus) {
  const report = await prisma.report.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!report) throw notFound();

  const allowed = STATUS_TRANSITIONS[report.status];
  if (!allowed.includes(newStatus)) {
    const err = new Error(`Transição inválida: ${report.status} → ${newStatus}`);
    err.status = 422;
    throw err;
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status: newStatus,
      ...(newStatus === 'EMITIDO' && { dataEmissao: new Date() }),
    },
    include: { items: { ...ITEMS_INCLUDE } },
  });

  logger.info({ event: 'report.status_changed', reportId: id, from: report.status, to: newStatus, tenantId });
  return updated;
}

async function softDeleteReport(tenantId, id) {
  const report = await prisma.report.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!report) throw notFound();

  if (report.status === 'EMITIDO') {
    const err = new Error('Laudos emitidos não podem ser desativados');
    err.status = 422;
    throw err;
  }

  await prisma.report.update({ where: { id }, data: { deletedAt: new Date() } });
  logger.info({ event: 'report.deleted', reportId: id, tenantId });
}

async function exportReportsCsv(tenantId) {
  const reports = await prisma.report.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      sample:         { select: { numeroAmostra: true, client: { select: { nome: true, documento: true } } } },
      reportTemplate: { select: { nome: true } },
      _count:         { select: { pdfArtifacts: true } },
    },
  });

  logger.info({ event: 'reports.exported', tenantId, count: reports.length });

  return toCsv(
    ['Número do Laudo', 'Status', 'Cliente', 'Documento', 'Amostra', 'Modelo', 'Responsável', 'Data de Emissão', 'Versões PDF', 'Criado em'],
    reports.map((r) => [
      r.numeroLaudo, r.status,
      r.sample.client.nome, r.sample.client.documento, r.sample.numeroAmostra,
      r.reportTemplate.nome, r.responsavel, r.dataEmissao,
      r._count.pdfArtifacts, r.createdAt,
    ]),
  );
}

module.exports = {
  createReport, listReports, getReportById,
  updateReport, updateReportItem, updateReportStatus, softDeleteReport,
  exportReportsCsv,
};
