const prisma = require('../../lib/prisma');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

async function listAuditLogs(tenantId, query) {
  let { page, pageSize, actorType, actorId, method, path, from, to } = query;

  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const createdAt = {};
  if (from && !Number.isNaN(Date.parse(from))) createdAt.gte = new Date(from);
  if (to   && !Number.isNaN(Date.parse(to)))   createdAt.lte = new Date(to);

  const where = {
    tenantId,
    ...(actorType && { actorType }),
    ...(actorId && { actorId }),
    ...(method && { method: method.toUpperCase() }),
    ...(path && { path: { contains: path } }),
    ...(Object.keys(createdAt).length > 0 && { createdAt }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

module.exports = { listAuditLogs };
