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
    razaoSocial: `RTLab ${suffix}`, nomeFantasia: `RTLab ${suffix}`,
    cnpj: uniqueCnpj(), email: `rtlab${ts}@test.com`,
    adminName: 'Admin', adminEmail: `rtadmin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

async function createAssay(token, nome) {
  const res = await request(app).post('/api/v1/assays')
    .set('Authorization', `Bearer ${token}`)
    .send({ nome, unidade: 'mg/L' });
  return res.body.id;
}

describe('ReportTemplates — CRUD', () => {
  let tenantId, adminToken, analystToken, viewerToken;
  let tenant2Id, admin2Token;
  let assayId1, assayId2, assayId3;
  let assay2Id1;

  beforeAll(async () => {
    const r1 = await registerTenant('A');
    tenantId     = r1.body.tenant.id;
    adminToken   = r1.body.token;
    analystToken = makeToken(tenantId, 'ANALYST');
    viewerToken  = makeToken(tenantId, 'VIEWER');

    const r2 = await registerTenant('B');
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;

    [assayId1, assayId2, assayId3] = await Promise.all([
      createAssay(adminToken, 'pH'),
      createAssay(adminToken, 'Turbidez'),
      createAssay(adminToken, 'Cloro Residual'),
    ]);
    assay2Id1 = await createAssay(admin2Token, 'pH Tenant2');
  });

  afterAll(async () => {
    await prisma.reportTemplateAssay.deleteMany({
      where: { reportTemplate: { tenantId: { in: [tenantId, tenant2Id] } } },
    });
    await prisma.reportTemplate.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.assay.deleteMany({          where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.user.deleteMany({           where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.tenant.deleteMany({         where: { id:       { in: [tenantId, tenant2Id] } } });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // POST
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/report-templates', () => {
    it('cria modelo com 3 ensaios e retorna assays ordenados', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nome: 'Laudo Físico-Químico',
          descricao: 'Análises físico-químicas',
          assayIds: [assayId1, assayId2, assayId3],
        });

      expect(res.status).toBe(201);
      expect(res.body.nome).toBe('Laudo Físico-Químico');
      expect(res.body.tenantId).toBe(tenantId);
      expect(res.body.assays).toHaveLength(3);
      expect(res.body.assays[0].ordem).toBe(0);
      expect(res.body.assays[0].assay.id).toBe(assayId1);
      expect(res.body.assays[1].ordem).toBe(1);
      expect(res.body.assays[2].ordem).toBe(2);
    });

    it('ANALYST pode criar modelo', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ nome: 'Laudo Microbiológico', assayIds: [assayId1] });

      expect(res.status).toBe(201);
    });

    it('retorna 400 quando nome está ausente', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assayIds: [assayId1] });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('nome');
    });

    it('retorna 400 quando assayIds está ausente', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Sem Ensaios' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('assayIds');
    });

    it('retorna 400 quando assayIds está vazio', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Array Vazio', assayIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('assayIds');
    });

    it('retorna 400 quando assayIds tem duplicatas', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Com Duplicatas', assayIds: [assayId1, assayId1] });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('assayIds');
    });

    it('retorna 404 quando assayId pertence a outro tenant', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Invasão', assayIds: [assayId1, assay2Id1] });

      expect(res.status).toBe(404);
    });

    it('retorna 409 quando nome já existe no tenant', async () => {
      await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Laudo Duplicado', assayIds: [assayId1] });

      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Laudo Duplicado', assayIds: [assayId2] });

      expect(res.status).toBe(409);
    });

    it('mesmo nome em tenants diferentes não conflita', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ nome: 'Laudo Físico-Químico', assayIds: [assay2Id1] });

      expect(res.status).toBe(201);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .send({ nome: 'Sem Auth', assayIds: [assayId1] });

      expect(res.status).toBe(401);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ nome: 'Viewer', assayIds: [assayId1] });

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // GET list
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/report-templates', () => {
    it('lista apenas modelos do tenant', async () => {
      const res = await request(app).get('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      res.body.data.forEach(t => expect(t).toHaveProperty('assayCount'));
    });

    it('não retorna modelos de outro tenant', async () => {
      const r1 = await request(app).get('/api/v1/report-templates').set('Authorization', `Bearer ${adminToken}`);
      const r2 = await request(app).get('/api/v1/report-templates').set('Authorization', `Bearer ${admin2Token}`);
      const ids1 = r1.body.data.map(t => t.id);
      const ids2 = r2.body.data.map(t => t.id);
      expect(ids1.filter(id => ids2.includes(id))).toHaveLength(0);
    });

    it('assayCount reflete quantidade correta de ensaios', async () => {
      const res = await request(app).get('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`);

      const modelo = res.body.data.find(t => t.nome === 'Laudo Físico-Químico');
      expect(modelo).toBeDefined();
      expect(modelo.assayCount).toBe(3);
    });

    it('filtra por search no nome', async () => {
      const res = await request(app).get('/api/v1/report-templates?search=Físico')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(t => expect(t.nome).toContain('Físico'));
    });

    it('pagina corretamente', async () => {
      const res = await request(app).get('/api/v1/report-templates?page=1&pageSize=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body.pagination.pageSize).toBe(1);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).get('/api/v1/report-templates');
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // GET by ID
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/report-templates/:id', () => {
    let templateId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Para Busca por ID', assayIds: [assayId2, assayId1] });
      templateId = res.body.id;
    });

    it('retorna modelo com assays ordenados pelo campo ordem', async () => {
      const res = await request(app).get(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(templateId);
      expect(res.body.assays).toHaveLength(2);
      expect(res.body.assays[0].ordem).toBe(0);
      expect(res.body.assays[0].assay.id).toBe(assayId2);
      expect(res.body.assays[1].ordem).toBe(1);
      expect(res.body.assays[1].assay.id).toBe(assayId1);
    });

    it('retorna 404 para ID de outro tenant', async () => {
      const res = await request(app).get(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });

    it('retorna 404 para ID inexistente', async () => {
      const res = await request(app).get('/api/v1/report-templates/id-invalido')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/report-templates/:id', () => {
    let templateId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Para Editar', assayIds: [assayId1, assayId2] });
      templateId = res.body.id;
    });

    it('atualiza descricao parcialmente sem alterar ensaios', async () => {
      const res = await request(app).patch(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ descricao: 'Nova descrição' });

      expect(res.status).toBe(200);
      expect(res.body.descricao).toBe('Nova descrição');
      expect(res.body.assays).toHaveLength(2);
    });

    it('substitui lista de ensaios mantendo nova ordem', async () => {
      const res = await request(app).patch(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assayIds: [assayId3, assayId1] });

      expect(res.status).toBe(200);
      expect(res.body.assays).toHaveLength(2);
      expect(res.body.assays[0].assay.id).toBe(assayId3);
      expect(res.body.assays[1].assay.id).toBe(assayId1);
    });

    it('retorna 400 quando assayIds tem duplicatas no PATCH', async () => {
      const res = await request(app).patch(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assayIds: [assayId1, assayId1] });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('assayIds');
    });

    it('retorna 404 quando assayId de outro tenant no PATCH', async () => {
      const res = await request(app).patch(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assayIds: [assayId1, assay2Id1] });

      expect(res.status).toBe(404);
    });

    it('retorna 404 para modelo de outro tenant', async () => {
      const res = await request(app).patch(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ descricao: 'Invasão' });

      expect(res.status).toBe(404);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).patch(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ descricao: 'Viewer' });

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/report-templates/:id', () => {
    let templateId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Para Deletar', assayIds: [assayId1] });
      templateId = res.body.id;
    });

    it('retorna 403 para ANALYST', async () => {
      const res = await request(app).delete(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).delete(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('soft delete retorna 204', async () => {
      const res = await request(app).delete(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('modelo deletado retorna 404 no GET', async () => {
      const res = await request(app).get(`/api/v1/report-templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('retorna 404 ao deletar modelo de outro tenant', async () => {
      const r = await request(app).post('/api/v1/report-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Alvo Outro Tenant', assayIds: [assayId1] });

      const res = await request(app).delete(`/api/v1/report-templates/${r.body.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
