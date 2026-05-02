const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const config = require('../../src/config');

// Helpers
function makeToken(tenantId, role) {
  return jwt.sign({ userId: `test-user-${role}`, tenantId, role }, config.jwt.secret, { expiresIn: '1h' });
}

let _seq = 0;
function uniqueDoc(len) {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-len).padStart(len, '1');
}
function uniqueCpf()  { return uniqueDoc(11); }
function uniqueCnpj() { return uniqueDoc(14); }

describe('Clients — CRUD', () => {
  let tenantId;
  let adminToken, analystToken, viewerToken;
  let tenant2Id, admin2Token;

  beforeAll(async () => {
    // Tenant 1
    const res1 = await request(app).post('/api/v1/tenants/register').send({
      razaoSocial:   'Lab Teste S/A',
      nomeFantasia:  'Lab Teste',
      cnpj:          uniqueCnpj(),
      email:         `lab-${Date.now()}@teste.com`,
      adminName:     'Admin Teste',
      adminEmail:    `admin-${Date.now()}@teste.com`,
      adminPassword: 'senha1234',
    });
    tenantId     = res1.body.tenant.id;
    adminToken   = res1.body.token;
    analystToken = makeToken(tenantId, 'ANALYST');
    viewerToken  = makeToken(tenantId, 'VIEWER');

    // Tenant 2 (isolamento)
    const res2 = await request(app).post('/api/v1/tenants/register').send({
      razaoSocial:   'Outro Lab S/A',
      nomeFantasia:  'Outro Lab',
      cnpj:          uniqueCnpj(),
      email:         `outro-${Date.now()}@teste.com`,
      adminName:     'Admin 2',
      adminEmail:    `admin2-${Date.now()}@teste.com`,
      adminPassword: 'senha1234',
    });
    tenant2Id   = res2.body.tenant.id;
    admin2Token = res2.body.token;
  });

  afterAll(async () => {
    await prisma.client.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.user.deleteMany({   where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.tenant.deleteMany({ where: { id:       { in: [tenantId, tenant2Id] } } });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/clients
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/clients', () => {
    it('cria cliente PF com sucesso (ADMIN)', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'João Silva', documento: uniqueCpf(), email: 'joao@teste.com' });

      expect(res.status).toBe(201);
      expect(res.body.tipoPessoa).toBe('PF');
      expect(res.body.nome).toBe('João Silva');
      expect(res.body.tenantId).toBe(tenantId);
    });

    it('cria cliente PJ com sucesso (ANALYST)', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Empresa LTDA', documento: uniqueCnpj() });

      expect(res.status).toBe(201);
      expect(res.body.tipoPessoa).toBe('PJ');
    });

    it('retorna 400 quando tipoPessoa está ausente', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Sem tipo', documento: uniqueCpf() });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('tipoPessoa');
    });

    it('retorna 400 quando CPF tem tamanho errado', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Inválido', documento: '123' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('documento');
    });

    it('retorna 400 quando CNPJ tem tamanho errado', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Inválido LTDA', documento: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('documento');
    });

    it('retorna 409 quando documento já existe no tenant', async () => {
      const doc = uniqueCpf();
      await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Primeiro', documento: doc });

      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Duplicado', documento: doc });

      expect(res.status).toBe(409);
    });

    it('retorna 401 sem token JWT', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .send({ tipoPessoa: 'PF', nome: 'Sem auth', documento: uniqueCpf() });

      expect(res.status).toBe(401);
    });

    it('retorna 403 quando VIEWER tenta criar', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Viewer', documento: uniqueCpf() });

      expect(res.status).toBe(403);
    });

    it('documento do tenant 2 pode ser igual ao do tenant 1 (sem conflito)', async () => {
      const sharedDoc = uniqueCpf();
      await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Tenant 1', documento: sharedDoc });

      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ tipoPessoa: 'PF', nome: 'Tenant 2', documento: sharedDoc });

      expect(res.status).toBe(201);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/clients
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/clients', () => {
    it('lista apenas clientes do tenant autenticado', async () => {
      const res = await request(app)
        .get('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      res.body.data.forEach(c => expect(c.tenantId).toBeUndefined()); // não expõe tenantId na lista
    });

    it('não retorna clientes de outro tenant', async () => {
      const res1 = await request(app).get('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`);
      const res2 = await request(app).get('/api/v1/clients').set('Authorization', `Bearer ${admin2Token}`);

      const ids1 = res1.body.data.map(c => c.id);
      const ids2 = res2.body.data.map(c => c.id);
      const intersection = ids1.filter(id => ids2.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('pagina corretamente', async () => {
      const res = await request(app)
        .get('/api/v1/clients?page=1&pageSize=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.pageSize).toBe(2);
      expect(res.body.pagination.page).toBe(1);
    });

    it('filtra por tipoPessoa', async () => {
      const res = await request(app)
        .get('/api/v1/clients?tipoPessoa=PF')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(c => expect(c.tipoPessoa).toBe('PF'));
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).get('/api/v1/clients');
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/clients/:id
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/clients/:id', () => {
    let clientId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Cliente GetById', documento: uniqueCpf() });
      clientId = res.body.id;
    });

    it('retorna cliente pelo ID', async () => {
      const res = await request(app)
        .get(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(clientId);
    });

    it('retorna 404 para ID de outro tenant', async () => {
      const res = await request(app)
        .get(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });

    it('retorna 404 para ID inexistente', async () => {
      const res = await request(app)
        .get('/api/v1/clients/id-que-nao-existe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/v1/clients/:id
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/clients/:id', () => {
    let clientId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Para Editar', documento: uniqueCpf() });
      clientId = res.body.id;
    });

    it('atualiza parcialmente o cliente', async () => {
      const res = await request(app)
        .patch(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nome: 'Nome Atualizado' });

      expect(res.status).toBe(200);
      expect(res.body.nome).toBe('Nome Atualizado');
    });

    it('retorna 404 para cliente de outro tenant', async () => {
      const res = await request(app)
        .patch(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ nome: 'Invasão' });

      expect(res.status).toBe(404);
    });

    it('retorna 403 quando VIEWER tenta editar', async () => {
      const res = await request(app)
        .patch(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ nome: 'Viewer Edit' });

      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/v1/clients/:id
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/clients/:id', () => {
    let clientId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PJ', nome: 'Para Deletar LTDA', documento: uniqueCnpj() });
      clientId = res.body.id;
    });

    it('retorna 403 quando ANALYST tenta deletar', async () => {
      const res = await request(app)
        .delete(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });

    it('retorna 403 quando VIEWER tenta deletar', async () => {
      const res = await request(app)
        .delete(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    it('soft delete bem-sucedido retorna 204', async () => {
      const res = await request(app)
        .delete(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('cliente deletado não aparece na listagem', async () => {
      const res = await request(app)
        .get('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`);

      const ids = res.body.data.map(c => c.id);
      expect(ids).not.toContain(clientId);
    });

    it('cliente deletado retorna 404 no GET /:id', async () => {
      const res = await request(app)
        .get(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('retorna 404 ao tentar deletar cliente de outro tenant', async () => {
      const createRes = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Outro Tenant Alvo', documento: uniqueCpf() });

      const res = await request(app)
        .delete(`/api/v1/clients/${createRes.body.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
