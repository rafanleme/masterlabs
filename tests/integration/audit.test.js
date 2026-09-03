const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const config = require('../../src/config');

function makeToken(tenantId, role, userId) {
  return jwt.sign({ userId: userId || `test-${role}`, tenantId, role }, config.jwt.secret, { expiresIn: '1h' });
}

let _seq = 0;
function uniqueCnpj() {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-14).padStart(14, '1');
}

// O registro de auditoria é assíncrono (após o response) — aguarda com polling
async function waitForAuditLog(where, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const log = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: 'desc' } });
    if (log) return log;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

describe('Audit — trilha de auditoria', () => {
  let tenantId, adminToken, adminUserId;

  beforeAll(async () => {
    const ts = Date.now();
    const res = await request(app).post('/api/v1/tenants/register').send({
      razaoSocial: 'AuditLab', nomeFantasia: 'AuditLab',
      cnpj: uniqueCnpj(), email: `auditlab${ts}@test.com`,
      adminName: 'Admin', adminEmail: `auditadmin${ts}@test.com`, adminPassword: 'senha1234',
    });
    tenantId    = res.body.tenant.id;
    adminToken  = res.body.token;
    adminUserId = jwt.decode(adminToken).userId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ tenantId }, { tenantId: null }] } });
    await prisma.client.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('registra mutações bem-sucedidas com ator, método e caminho', async () => {
    const created = await request(app).post('/api/v1/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente Auditado', documento: uniqueCnpj().slice(0, 11) });
    expect(created.status).toBe(201);

    const log = await waitForAuditLog({
      tenantId, method: 'POST', path: '/api/v1/clients', actorId: adminUserId,
    });

    expect(log).not.toBeNull();
    expect(log.actorType).toBe('USER');
    expect(log.statusCode).toBe(201);
    expect(log.correlationId).toBeTruthy();
  });

  it('não registra mutações que falharam', async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId, statusCode: { gte: 400 } } });

    const res = await request(app).post('/api/v1/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Sem tipoPessoa' });
    expect(res.status).toBe(400);

    await new Promise((r) => setTimeout(r, 300));
    const bad = await prisma.auditLog.findFirst({ where: { tenantId, statusCode: { gte: 400 } } });
    expect(bad).toBeNull();
  });

  it('GET /api/v1/audit-logs lista a trilha do tenant com filtros', async () => {
    await waitForAuditLog({ tenantId, method: 'POST', path: '/api/v1/clients' });

    const res = await request(app).get('/api/v1/audit-logs?method=POST&path=clients')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((log) => {
      expect(log.tenantId).toBe(tenantId);
      expect(log.method).toBe('POST');
      expect(log.path).toContain('clients');
    });
  });

  it('retorna 403 para não-ADMIN', async () => {
    const res = await request(app).get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${makeToken(tenantId, 'ANALYST', adminUserId)}`);
    expect(res.status).toBe(403);
  });
});
