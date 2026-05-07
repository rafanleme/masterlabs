const prisma = require('../../lib/prisma');
const logger = require('../../logger');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const STATUS_TRANSITIONS = {
  RECEBIDA:   ['EM_ANALISE', 'CANCELADA', 'REJEITADA'],
  EM_ANALISE: ['CONCLUIDA', 'CANCELADA', 'REJEITADA'],
  CONCLUIDA:  [],
  CANCELADA:  [],
  REJEITADA:  [],
};

function notFound() {
  const err = new Error('Amostra não encontrada');
  err.status = 404;
  return err;
}

async function generateNumeroAmostra(tx, tenantId) {
  const year = new Date().getFullYear();
  const suffix = `/${year}`;
  const last = await tx.sample.findFirst({
    where: { tenantId, numeroAmostra: { endsWith: suffix } },
    orderBy: { numeroAmostra: 'desc' },
    select: { numeroAmostra: true },
  });
  const seq = last ? parseInt(last.numeroAmostra.split('/')[0], 10) + 1 : 1;
  return `${String(seq).padStart(4, '0')}/${year}`;
}

async function createSample(tenantId, data) {
  const attendance = await prisma.attendance.findFirst({
    where: { id: data.attendanceId, tenantId, deletedAt: null },
    select: { id: true, clientId: true },
  });
  if (!attendance) {
    const err = new Error('Atendimento não encontrado');
    err.status = 404;
    throw err;
  }

  const sample = await prisma.$transaction(async (tx) => {
    const numero = await generateNumeroAmostra(tx, tenantId);
    return tx.sample.create({
      data: {
        tenantId,
        clientId: attendance.clientId,
        numeroAmostra: numero,
        ...data,
      },
    });
  });

  logger.info({ event: 'sample.created', sampleId: sample.id, tenantId });
  return sample;
}

async function listSamples(tenantId, query) {
  let { page, pageSize, attendanceId, status, search } = query;

  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(attendanceId && { attendanceId }),
    ...(status       && { status }),
    ...(search && {
      OR: [
        { numeroAmostra: { contains: search } },
        { descricao:     { contains: search } },
        { pontoColeta:   { contains: search } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.sample.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, numeroAmostra: true, status: true, descricao: true,
        pontoColeta: true, dataRecebimento: true, attendanceId: true, createdAt: true,
      },
    }),
    prisma.sample.count({ where }),
  ]);

  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

async function getSampleById(tenantId, id) {
  const sample = await prisma.sample.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!sample) throw notFound();
  return sample;
}

async function updateSample(tenantId, id, data) {
  await getSampleById(tenantId, id);
  const sample = await prisma.sample.update({ where: { id }, data });
  logger.info({ event: 'sample.updated', sampleId: id, tenantId });
  return sample;
}

async function updateSampleStatus(tenantId, id, newStatus) {
  const sample = await getSampleById(tenantId, id);
  const allowed = STATUS_TRANSITIONS[sample.status];

  if (!allowed.includes(newStatus)) {
    const err = new Error(`Transição inválida: ${sample.status} → ${newStatus}`);
    err.status = 422;
    throw err;
  }

  const updated = await prisma.sample.update({ where: { id }, data: { status: newStatus } });
  logger.info({ event: 'sample.status_changed', sampleId: id, from: sample.status, to: newStatus, tenantId });
  return updated;
}

async function softDeleteSample(tenantId, id) {
  await getSampleById(tenantId, id);
  await prisma.sample.update({ where: { id }, data: { deletedAt: new Date() } });
  logger.info({ event: 'sample.deleted', sampleId: id, tenantId });
}

module.exports = {
  createSample,
  listSamples,
  getSampleById,
  updateSample,
  updateSampleStatus,
  softDeleteSample,
};
