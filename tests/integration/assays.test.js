const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const config = require('../../src/config');

function makeToken(tenantId, role) {
  return jwt.sign({ userId: `test-${role}`, tenantId, role }, config.jwt.secret, { expiresIn: '1h' });
}

let _seq = 0;
function uniqueCnpj() {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-14).padStart(14, '1');
}

async function registerTenant(suffix) {
  const ts = Date.now() + _seq++;
  return request(app).post('/api/v1/tenants/register').send({
    razaoSocial: `AssayLab ${suffix}`, nomeFantasia: `AssayLab ${suffix}`,
    cnpj: uniqueCnpj(), email: `alab${ts}@test.com`,
    adminName: 'Admin', adminEmail: `aadmin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

describe('Assays — CRUD', () => {
  let tenantId, adminToken, analystToken, viewerToken;
  let tenant2Id, admin2Token;

  beforeAll(async () => {
    const r1 = await registerTenant('A');
    tenantId     = r1.body.tenant.id;
    adminToken   = r1.body.token;
    analystToken = makeToken(tenantId, 'ANALYST');
    viewerToken  = makeToken(tenantId, 'VIEWER');

    const r2 = await registerTenant('B');
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;
  });

  afterAll(async () => {
    await prisma.assay.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.user.deleteMany({  where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.tenant.deleteMany({ where: { id:      { in: [tenantId, tenant2Id] } } });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // POST
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/assays', () => {
    it('cria ensaio com tipoComparacao ENTRE e limites numéricos', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'pH da Água', unidade: 'pH', tipoComparacao: 'ENTRE', limiteMinimo: 6.0, limiteMaximo: 9.5, valorReferencia: '6,0 a 9,5' });

      expect(res.status).toBe(201);
      expect(res.body.nome).toBe('pH da Água');
      expect(res.body.tipoComparacao).toBe('ENTRE');
      expect(res.body.limiteMinimo).toBe(6.0);
      expect(res.body.limiteMaximo).toBe(9.5);
      expect(res.body.tenantId).toBe(tenantId);
    });

    it('cria ensaio com tipoComparacao TEXTO e valorReferencia', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Coliformes Totais', unidade: 'UFC/100mL', tipoComparacao: 'TEXTO', valorReferencia: 'Ausência em 100mL' });

      expect(res.status).toBe(201);
      expect(res.body.tipoComparacao).toBe('TEXTO');
      expect(res.body.valorReferencia).toBe('Ausência em 100mL');
    });

    it('cria ensaio sem tipoComparacao (catálogo simples)', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Temperatura', unidade: '°C', metodoAnalitico: 'ABNT NBR 9898' });

      expect(res.status).toBe(201);
      expect(res.body.tipoComparacao).toBeNull();
    });

    it('ANALYST pode criar ensaio', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ nome: 'DBO5', unidade: 'mg/L O2' });

      expect(res.status).toBe(201);
    });

    it('retorna 400 quando nome está ausente', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ unidade: 'mg/L' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('nome');
    });

    it('retorna 400 quando unidade está ausente', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Sem Unidade' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('unidade');
    });

    it('retorna 400 quando tipoComparacao=ENTRE mas limiteMinimo está ausente', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Sem Min', unidade: 'mg/L', tipoComparacao: 'ENTRE', limiteMaximo: 5.0 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('limiteMinimo');
    });

    it('retorna 400 quando tipoComparacao=MENOR_QUE mas limiteMaximo está ausente', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Sem Max', unidade: 'mg/L', tipoComparacao: 'MENOR_QUE' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('limiteMaximo');
    });

    it('retorna 400 quando tipoComparacao=TEXTO mas valorReferencia está ausente', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Sem Ref', unidade: 'UFC/100mL', tipoComparacao: 'TEXTO' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('valorReferencia');
    });

    it('retorna 409 quando nome já existe no tenant', async () => {
      await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Turbidez', unidade: 'NTU' });

      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Turbidez', unidade: 'NTU' });

      expect(res.status).toBe(409);
    });

    it('mesmo nome em tenants diferentes não conflita', async () => {
      await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Cloro Residual', unidade: 'mg/L' });

      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ nome: 'Cloro Residual', unidade: 'mg/L' });

      expect(res.status).toBe(201);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).post('/api/v1/assays')
        .send({ nome: 'Sem Auth', unidade: 'mg/L' });

      expect(res.status).toBe(401);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ nome: 'Viewer', unidade: 'mg/L' });

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // GET list
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/assays', () => {
    it('lista apenas ensaios do tenant', async () => {
      const res = await request(app).get('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('não retorna ensaios de outro tenant', async () => {
      const r1 = await request(app).get('/api/v1/assays').set('Authorization', `Bearer ${adminToken}`);
      const r2 = await request(app).get('/api/v1/assays').set('Authorization', `Bearer ${admin2Token}`);
      const ids1 = r1.body.data.map(a => a.id);
      const ids2 = r2.body.data.map(a => a.id);
      expect(ids1.filter(id => ids2.includes(id))).toHaveLength(0);
    });

    it('filtra por search no nome', async () => {
      const res = await request(app).get('/api/v1/assays?search=pH')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(a => expect(a.nome).toContain('pH'));
    });

    it('pagina corretamente', async () => {
      const res = await request(app).get('/api/v1/assays?page=1&pageSize=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.pageSize).toBe(2);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).get('/api/v1/assays');
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // GET by ID
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/assays/:id', () => {
    let assayId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Para Busca por ID', unidade: 'mg/L', descricao: 'Ensaio para teste de GET by ID' });
      assayId = res.body.id;
    });

    it('retorna ensaio pelo ID', async () => {
      const res = await request(app).get(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(assayId);
      expect(res.body.descricao).toBe('Ensaio para teste de GET by ID');
    });

    it('retorna 404 para ID de outro tenant', async () => {
      const res = await request(app).get(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });

    it('retorna 404 para ID inexistente', async () => {
      const res = await request(app).get('/api/v1/assays/id-invalido')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/assays/:id', () => {
    let assayId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Para Editar', unidade: 'mg/L' });
      assayId = res.body.id;
    });

    it('atualiza campos parcialmente', async () => {
      const res = await request(app).patch(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ metodoAnalitico: 'EPA 150.1', limiteMaximo: 9.0, tipoComparacao: 'MENOR_IGUAL' });

      expect(res.status).toBe(200);
      expect(res.body.metodoAnalitico).toBe('EPA 150.1');
      expect(res.body.limiteMaximo).toBe(9.0);
    });

    it('retorna 404 para ensaio de outro tenant', async () => {
      const res = await request(app).patch(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ unidade: 'NTU' });

      expect(res.status).toBe(404);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).patch(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ unidade: 'NTU' });

      expect(res.status).toBe(403);
    });

    it('retorna 400 quando tipoComparacao=ENTRE sem limiteMinimo no update', async () => {
      const res = await request(app).patch(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoComparacao: 'ENTRE', limiteMaximo: 10.0 });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('limiteMinimo');
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/assays/:id', () => {
    let assayId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Para Deletar', unidade: 'mg/L' });
      assayId = res.body.id;
    });

    it('retorna 403 para ANALYST', async () => {
      const res = await request(app).delete(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).delete(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('soft delete retorna 204', async () => {
      const res = await request(app).delete(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('ensaio deletado retorna 404 no GET', async () => {
      const res = await request(app).get(`/api/v1/assays/${assayId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('retorna 404 ao deletar ensaio de outro tenant', async () => {
      const r = await request(app).post('/api/v1/assays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Alvo de Outro Tenant', unidade: 'mg/L' });

      const res = await request(app).delete(`/api/v1/assays/${r.body.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
