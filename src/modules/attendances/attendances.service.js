const prisma = require('../../lib/prisma');
const logger = require('../../logger');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const STATUS_TRANSITIONS = {
  ABERTO:       ['EM_ANDAMENTO', 'CANCELADO'],
  EM_ANDAMENTO: ['ENCERRADO', 'CANCELADO'],
  ENCERRADO:    [],
  CANCELADO:    [],
};

function notFound() {
  const err = new Error('Atendimento não encontrado');
  err.status = 404;
  return err;
}

async function generateNumeroAtendimento(tx, tenantId) {
  const year = new Date().getFullYear();
  const suffix = `/${year}`;
  const last = await tx.attendance.findFirst({
    where: { tenantId, numeroAtendimento: { endsWith: suffix } },
    orderBy: { numeroAtendimento: 'desc' },
    select: { numeroAtendimento: true },
  });
  const seq = last ? parseInt(last.numeroAtendimento.split('/')[0], 10) + 1 : 1;
  return `${String(seq).padStart(4, '0')}/${year}`;
}

async function createAttendance(tenantId, data) {
  const client = await prisma.client.findFirst({
    where: { id: data.clientId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!client) {
    const err = new Error('Cliente não encontrado');
    err.status = 404;
    throw err;
  }

  const attendance = await prisma.$transaction(async (tx) => {
    const numero = await generateNumeroAtendimento(tx, tenantId);
    return tx.attendance.create({
      data: { tenantId, numeroAtendimento: numero, ...data },
    });
  });

  logger.info({ event: 'attendance.created', attendanceId: attendance.id, tenantId });
  return attendance;
}

async function listAttendances(tenantId, query) {
  let { page, pageSize, clientId, status, tipoColeta, search } = query;

  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    ...(clientId   && { clientId }),
    ...(status     && { status }),
    ...(tipoColeta && { tipoColeta }),
    ...(search && {
      OR: [
        { numeroAtendimento: { contains: search } },
        { descricao:         { contains: search } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, numeroAtendimento: true, status: true, tipoColeta: true,
        descricao: true, prazoEntrega: true, clientId: true, createdAt: true,
      },
    }),
    prisma.attendance.count({ where }),
  ]);

  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

async function getAttendanceById(tenantId, id) {
  const attendance = await prisma.attendance.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!attendance) throw notFound();
  return attendance;
}

async function updateAttendance(tenantId, id, data) {
  await getAttendanceById(tenantId, id);
  const attendance = await prisma.attendance.update({ where: { id }, data });
  logger.info({ event: 'attendance.updated', attendanceId: id, tenantId });
  return attendance;
}

async function updateAttendanceStatus(tenantId, id, newStatus) {
  const attendance = await getAttendanceById(tenantId, id);
  const allowed = STATUS_TRANSITIONS[attendance.status];

  if (!allowed.includes(newStatus)) {
    const err = new Error(`Transição inválida: ${attendance.status} → ${newStatus}`);
    err.status = 422;
    throw err;
  }

  const updated = await prisma.attendance.update({ where: { id }, data: { status: newStatus } });
  logger.info({ event: 'attendance.status_changed', attendanceId: id, from: attendance.status, to: newStatus, tenantId });
  return updated;
}

async function softDeleteAttendance(tenantId, id) {
  await getAttendanceById(tenantId, id);
  await prisma.attendance.update({ where: { id }, data: { deletedAt: new Date() } });
  logger.info({ event: 'attendance.deleted', attendanceId: id, tenantId });
}

module.exports = {
  createAttendance,
  listAttendances,
  getAttendanceById,
  updateAttendance,
  updateAttendanceStatus,
  softDeleteAttendance,
};
