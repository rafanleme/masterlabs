const prisma = require('../../lib/prisma');
const logger = require('../../logger');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function notFound() {
  const err = new Error('Cliente não encontrado');
  err.status = 404;
  return err;
}

function handlePrismaConflict(err) {
  if (err.code === 'P2002') {
    const conflict = new Error('Documento já cadastrado neste laboratório');
    conflict.status = 409;
    throw conflict;
  }
  throw err;
}

async function createClient(tenantId, data) {
  try {
    const client = await prisma.client.create({
      data: { tenantId, ...data },
    });
    logger.info({ event: 'client.created', clientId: client.id, tenantId });
    return client;
  } catch (err) {
    handlePrismaConflict(err);
  }
}

async function listClients(tenantId, query) {
  let { page, pageSize, tipoPessoa, search } = query;

  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(tipoPessoa && { tipoPessoa }),
    ...(search && {
      OR: [
        { nome:      { contains: search } },
        { documento: { contains: search } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      orderBy: { nome: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, tipoPessoa: true, nome: true, documento: true,
        email: true, telefone: true, createdAt: true,
      },
    }),
    prisma.client.count({ where }),
  ]);

  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

async function getClientById(tenantId, id) {
  const client = await prisma.client.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!client) throw notFound();
  return client;
}

async function updateClient(tenantId, id, data) {
  await getClientById(tenantId, id);
  try {
    const client = await prisma.client.update({
      where: { id },
      data,
    });
    logger.info({ event: 'client.updated', clientId: id, tenantId });
    return client;
  } catch (err) {
    handlePrismaConflict(err);
  }
}

async function softDeleteClient(tenantId, id) {
  await getClientById(tenantId, id);
  await prisma.client.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  logger.info({ event: 'client.deleted', clientId: id, tenantId });
}

module.exports = { createClient, listClients, getClientById, updateClient, softDeleteClient };
