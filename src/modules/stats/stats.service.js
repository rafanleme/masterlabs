const prisma = require('../../lib/prisma');

function groupToObject(groups, key, countKey = '_count') {
  return groups.reduce((acc, g) => {
    acc[g[key]] = g[countKey];
    return acc;
  }, {});
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function overview(tenantId) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    clientsCount,
    attendancesByStatus,
    samplesByStatus,
    reportsByStatus,
    pdfCount,
    recentEmissions,
  ] = await Promise.all([
    prisma.client.count({ where: { tenantId, deletedAt: null } }),
    prisma.attendance.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null },
      _count: true,
    }),
    prisma.sample.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null },
      _count: true,
    }),
    prisma.report.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null },
      _count: true,
    }),
    prisma.pdfArtifact.count({ where: { tenantId } }),
    prisma.report.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'EMITIDO',
        dataEmissao: { gte: sixMonthsAgo },
      },
      select: { dataEmissao: true },
    }),
  ]);

  // Volumetria de laudos emitidos por mês (últimos 6 meses, meses zerados incluídos)
  const emissionsByMonth = {};
  const cursor = new Date(sixMonthsAgo);
  for (let i = 0; i < 6; i++) {
    emissionsByMonth[monthKey(cursor)] = 0;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const r of recentEmissions) {
    if (!r.dataEmissao) continue;
    const key = monthKey(r.dataEmissao);
    if (key in emissionsByMonth) emissionsByMonth[key] += 1;
  }

  return {
    clients: { total: clientsCount },
    attendances: { byStatus: groupToObject(attendancesByStatus, 'status') },
    samples: { byStatus: groupToObject(samplesByStatus, 'status') },
    reports: {
      byStatus: groupToObject(reportsByStatus, 'status'),
      emissionsByMonth,
    },
    pdfs: { total: pdfCount },
  };
}

module.exports = { overview };
