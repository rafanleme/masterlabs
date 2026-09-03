const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

let _seq = 0;
function uniqueCnpj() {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-14).padStart(14, '1');
}

describe('Exports — CSV', () => {
  let tenantId, adminToken;

  beforeAll(async () => {
    const ts = Date.now();
    const res = await request(app).post('/api/v1/tenants/register').send({
      razaoSocial: 'CsvLab', nomeFantasia: 'CsvLab',
      cnpj: uniqueCnpj(), email: `csvlab${ts}@test.com`,
      adminName: 'Admin', adminEmail: `csvadmin${ts}@test.com`, adminPassword: 'senha1234',
    });
    tenantId   = res.body.tenant.id;
    adminToken = res.body.token;

    await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Maria; "Csv"', documento: uniqueCnpj().slice(0, 11) });
    await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PJ', nome: 'Empresa Csv LTDA', documento: uniqueCnpj() });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.client.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('GET /api/v1/clients/export.csv exporta clientes do tenant', async () => {
    const res = await request(app).get('/api/v1/clients/export.csv')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/clientes\.csv/);
    expect(res.text).toContain('Nome;Tipo;Documento');
    expect(res.text).toContain('Empresa Csv LTDA');
    // Campos com ; e aspas são escapados
    expect(res.text).toContain('"Maria; ""Csv"""');
  });

  it('GET /api/v1/reports/export.csv responde com cabeçalho mesmo sem laudos', async () => {
    const res = await request(app).get('/api/v1/reports/export.csv')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Número do Laudo;Status;Cliente');
  });

  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/v1/clients/export.csv');
    expect(res.status).toBe(401);
  });
});
