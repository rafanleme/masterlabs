const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let _seq = 0;
function uniqueCnpj() {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-14).padStart(14, '1');
}

async function registerTenant(suffix, cnpj) {
  const ts = Date.now() + _seq++;
  return request(app).post('/api/v1/tenants/register').send({
    razaoSocial: `AuthLab ${suffix}`, nomeFantasia: `AuthLab ${suffix}`,
    cnpj, email: `authlab${ts}@test.com`,
    adminName: 'Admin', adminEmail: `authadmin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

describe('Auth — login multi-tenant', () => {
  let tenantId, adminToken, cnpj1;
  let tenant2Id, admin2Token, cnpj2;
  const sharedEmail = `shared-${Date.now()}@test.com`;

  beforeAll(async () => {
    cnpj1 = uniqueCnpj();
    cnpj2 = uniqueCnpj();
    const r1 = await registerTenant('A', cnpj1);
    tenantId   = r1.body.tenant.id;
    adminToken = r1.body.token;

    const r2 = await registerTenant('B', cnpj2);
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;

    // Mesmo e-mail + mesma senha nos dois tenants
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Compartilhado T1', email: sharedEmail, password: 'mesmasenha1', role: 'ANALYST' });
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${admin2Token}`)
      .send({ name: 'Compartilhado T2', email: sharedEmail, password: 'mesmasenha1', role: 'VIEWER' });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, tenant2Id] } } });
    await prisma.$disconnect();
  });

  it('retorna 409 com a lista de laboratórios quando o e-mail vale em mais de um tenant', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: sharedEmail, password: 'mesmasenha1' });

    expect(res.status).toBe(409);
    expect(res.body.labs).toHaveLength(2);
    expect(res.body.labs[0]).toHaveProperty('cnpj');
    expect(res.body.labs[0]).toHaveProperty('nomeFantasia');
  });

  it('login com cnpj desambigua e autentica no tenant certo', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: sharedEmail, password: 'mesmasenha1', cnpj: cnpj2 });

    expect(res.status).toBe(200);
    expect(res.body.user.tenantId).toBe(tenant2Id);
    expect(res.body.user.role).toBe('VIEWER');
  });

  it('quando as senhas diferem entre tenants, a senha seleciona o tenant sem precisar de cnpj', async () => {
    const email = `diff-${Date.now()}@test.com`;
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Diff T1', email, password: 'senhatenant1', role: 'ANALYST' });
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${admin2Token}`)
      .send({ name: 'Diff T2', email, password: 'senhatenant2', role: 'ANALYST' });

    const res = await request(app).post('/api/v1/auth/login')
      .send({ email, password: 'senhatenant2' });

    expect(res.status).toBe(200);
    expect(res.body.user.tenantId).toBe(tenant2Id);
  });

  it('retorna 401 para senha errada', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: sharedEmail, password: 'senhaerrada' });
    expect(res.status).toBe(401);
  });

  it('retorna 400 para cnpj mal formatado', async () => {
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: sharedEmail, password: 'mesmasenha1', cnpj: 'abc' });
    expect(res.status).toBe(400);
  });
});
