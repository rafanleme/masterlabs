const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let _seq = 0;
function uniqueCnpj() {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-14).padStart(14, '1');
}

describe('Stats — volumetria', () => {
  let tenantId, adminToken;

  beforeAll(async () => {
    const ts = Date.now();
    const res = await request(app).post('/api/v1/tenants/register').send({
      razaoSocial: 'StatsLab', nomeFantasia: 'StatsLab',
      cnpj: uniqueCnpj(), email: `statslab${ts}@test.com`,
      adminName: 'Admin', adminEmail: `statsadmin${ts}@test.com`, adminPassword: 'senha1234',
    });
    tenantId   = res.body.tenant.id;
    adminToken = res.body.token;

    const client = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente Stats', documento: uniqueCnpj().slice(0, 11) });
    await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: client.body.id, tipoColeta: 'IN_LOCO' });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.attendance.deleteMany({ where: { tenantId } });
    await prisma.client.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('GET /api/v1/stats/overview retorna volumetria do tenant', async () => {
    const res = await request(app).get('/api/v1/stats/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.clients.total).toBe(1);
    expect(res.body.attendances.byStatus.ABERTO).toBe(1);
    expect(res.body.samples.byStatus).toEqual({});
    expect(res.body.reports.byStatus).toEqual({});
    expect(Object.keys(res.body.reports.emissionsByMonth)).toHaveLength(6);
    expect(res.body.pdfs.total).toBe(0);
  });

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/stats/overview');
    expect(res.status).toBe(401);
  });
});
