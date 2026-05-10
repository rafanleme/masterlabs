const prisma = require('../../lib/prisma');
const logger = require('../../logger');

const DEFAULT_PAGE      = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 100;

const ASSAY_SELECT = {
  id: true, nome: true, unidade: true, metodoAnalitico: true,
  tipoComparacao: true, limiteMinimo: true, limiteMaximo: true, valorReferencia: true,
};

function notFound() {
  const err = new Error('Modelo de laudo não encontrado');
  err.status = 404;
  return err;
}

function handlePrismaConflict(err) {
  if (err.code === 'P2002') {
    const conflict = new Error('Já existe um modelo de laudo com este nome neste laboratório');
    conflict.status = 409;
    throw conflict;
  }
  throw err;
}

async function validateAssayIds(tenantId, assayIds) {
  const found = await prisma.assay.findMany({
    where: { id: { in: assayIds }, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== assayIds.length) {
    const err = new Error('Um ou mais ensaios não foram encontrados neste laboratório');
    err.status = 404;
    throw err;
  }
}

function buildAssayItems(assayIds) {
  return assayIds.map((assayId, index) => ({ assayId, ordem: index }));
}

function formatTemplate(template) {
  return {
    ...template,
    assays: template.assays.map(({ ordem, assay }) => ({ ordem, assay })),
  };
}

async function createReportTemplate(tenantId, { nome, descricao, assayIds }) {
  await validateAssayIds(tenantId, assayIds);
  try {
    const template = await prisma.reportTemplate.create({
      data: {
        tenantId,
        nome,
        descricao,
        assays: { create: buildAssayItems(assayIds) },
      },
      include: {
        assays: {
          orderBy: { ordem: 'asc' },
          include: { assay: { select: ASSAY_SELECT } },
        },
      },
    });
    logger.info({ event: 'reportTemplate.created', reportTemplateId: template.id, tenantId });
    return formatTemplate(template);
  } catch (err) {
    handlePrismaConflict(err);
  }
}

async function listReportTemplates(tenantId, query) {
  let { page, pageSize, search } = query;

  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(search && { nome: { contains: search } }),
  };

  const [raw, total] = await prisma.$transaction([
    prisma.reportTemplate.findMany({
      where,
      orderBy: { nome: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, nome: true, descricao: true, createdAt: true,
        _count: { select: { assays: true } },
      },
    }),
    prisma.reportTemplate.count({ where }),
  ]);

  const data = raw.map(({ _count, ...rest }) => ({ ...rest, assayCount: _count.assays }));
  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

async function getReportTemplateById(tenantId, id) {
  const template = await prisma.reportTemplate.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      assays: {
        orderBy: { ordem: 'asc' },
        include: { assay: { select: ASSAY_SELECT } },
      },
    },
  });
  if (!template) throw notFound();
  return formatTemplate(template);
}

async function updateReportTemplate(tenantId, id, { nome, descricao, assayIds }) {
  const existing = await prisma.reportTemplate.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw notFound();

  if (assayIds) await validateAssayIds(tenantId, assayIds);

  try {
    const template = await prisma.$transaction(async (tx) => {
      if (assayIds) {
        await tx.reportTemplateAssay.deleteMany({ where: { reportTemplateId: id } });
        await tx.reportTemplateAssay.createMany({
          data: buildAssayItems(assayIds).map(item => ({ ...item, reportTemplateId: id })),
        });
      }
      return tx.reportTemplate.update({
        where: { id },
        data: {
          ...(nome      !== undefined && { nome }),
          ...(descricao !== undefined && { descricao }),
        },
        include: {
          assays: {
            orderBy: { ordem: 'asc' },
            include: { assay: { select: ASSAY_SELECT } },
          },
        },
      });
    });
    logger.info({ event: 'reportTemplate.updated', reportTemplateId: id, tenantId });
    return formatTemplate(template);
  } catch (err) {
    handlePrismaConflict(err);
  }
}

async function softDeleteReportTemplate(tenantId, id) {
  const existing = await prisma.reportTemplate.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw notFound();
  await prisma.reportTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  logger.info({ event: 'reportTemplate.deleted', reportTemplateId: id, tenantId });
}

module.exports = {
  createReportTemplate, listReportTemplates,
  getReportTemplateById, updateReportTemplate, softDeleteReportTemplate,
};
