const prisma = require('../../lib/prisma');
const logger = require('../../logger');

const DEFAULT_PAGE      = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 100;

function notFound() {
  const err = new Error('Ensaio não encontrado');
  err.status = 404;
  return err;
}

function handlePrismaConflict(err) {
  if (err.code === 'P2002') {
    const conflict = new Error('Já existe um ensaio com este nome neste laboratório');
    conflict.status = 409;
    throw conflict;
  }
  throw err;
}

async function createAssay(tenantId, data) {
  try {
    const assay = await prisma.assay.create({ data: { tenantId, ...data } });
    logger.info({ event: 'assay.created', assayId: assay.id, tenantId });
    return assay;
  } catch (err) {
    handlePrismaConflict(err);
  }
}

async function listAssays(tenantId, query) {
  let { page, pageSize, search } = query;

  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(search && { nome: { contains: search } }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.assay.findMany({
      where,
      orderBy: { nome: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, nome: true, unidade: true, descricao: true,
        metodoAnalitico: true, tipoComparacao: true,
        limiteMinimo: true, limiteMaximo: true, valorReferencia: true,
        createdAt: true,
      },
    }),
    prisma.assay.count({ where }),
  ]);

  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

async function getAssayById(tenantId, id) {
  const assay = await prisma.assay.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!assay) throw notFound();
  return assay;
}

async function updateAssay(tenantId, id, data) {
  await getAssayById(tenantId, id);
  try {
    const assay = await prisma.assay.update({ where: { id }, data });
    logger.info({ event: 'assay.updated', assayId: id, tenantId });
    return assay;
  } catch (err) {
    handlePrismaConflict(err);
  }
}

async function softDeleteAssay(tenantId, id) {
  await getAssayById(tenantId, id);
  await prisma.assay.update({ where: { id }, data: { deletedAt: new Date() } });
  logger.info({ event: 'assay.deleted', assayId: id, tenantId });
}

module.exports = { createAssay, listAssays, getAssayById, updateAssay, softDeleteAssay };
