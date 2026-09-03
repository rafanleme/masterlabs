const bcrypt = require('bcrypt');
const prisma = require('../../lib/prisma');
const logger = require('../../logger');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const PUBLIC_SELECT = {
  id: true, name: true, email: true, role: true, active: true,
  createdAt: true, updatedAt: true,
};

function notFound() {
  const err = new Error('Usuário não encontrado');
  err.status = 404;
  return err;
}

function handlePrismaConflict(err) {
  if (err.code === 'P2002') {
    const conflict = new Error('E-mail já cadastrado neste laboratório');
    conflict.status = 409;
    throw conflict;
  }
  throw err;
}

async function createUser(tenantId, { name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { tenantId, name, email, passwordHash, role },
      select: PUBLIC_SELECT,
    });
    logger.info({ event: 'user.created', userId: user.id, tenantId, role });
    return user;
  } catch (err) {
    handlePrismaConflict(err);
  }
}

async function listUsers(tenantId, query) {
  let { page, pageSize, role, active, search } = query;

  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    ...(role && { role }),
    ...(active != null && active !== '' && { active: active === 'true' }),
    ...(search && {
      OR: [
        { name:  { contains: search } },
        { email: { contains: search } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: PUBLIC_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

async function getUserById(tenantId, id) {
  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: PUBLIC_SELECT,
  });
  if (!user) throw notFound();
  return user;
}

async function updateUser(tenantId, id, currentUserId, { name, password, role, active }) {
  await getUserById(tenantId, id);

  if (id === currentUserId && (role !== undefined || active === false)) {
    const err = new Error('Não é permitido alterar o próprio papel ou desativar a si mesmo');
    err.status = 422;
    throw err;
  }

  const data = {
    ...(name !== undefined && { name }),
    ...(role !== undefined && { role }),
    ...(active !== undefined && { active }),
    ...(password !== undefined && { passwordHash: await bcrypt.hash(password, 10) }),
  };

  const user = await prisma.user.update({
    where: { id },
    data,
    select: PUBLIC_SELECT,
  });
  logger.info({ event: 'user.updated', userId: id, tenantId });
  return user;
}

async function deactivateUser(tenantId, id, currentUserId) {
  await getUserById(tenantId, id);

  if (id === currentUserId) {
    const err = new Error('Não é permitido desativar a si mesmo');
    err.status = 422;
    throw err;
  }

  await prisma.user.update({ where: { id }, data: { active: false } });
  logger.info({ event: 'user.deactivated', userId: id, tenantId });
}

module.exports = { createUser, listUsers, getUserById, updateUser, deactivateUser };
