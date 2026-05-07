const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const config = require('../../src/config');

function makeToken(tenantId, role) {
  return jwt.sign({ userId: `test-${role}`, tenantId, role }, config.jwt.secret, { expiresIn: '1h' });
}

let _seq = 0;
function uniqueDoc(len) {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-len).padStart(len, '1');
}
function uniqueCnpj() { return uniqueDoc(14); }

async function registerTenant(suffix) {
  const ts = Date.now() + _seq++;
  return request(app).post('/api/v1/tenants/register').send({
    razaoSocial: `Lab ${suffix}`, nomeFantasia: `Lab ${suffix}`,
    cnpj: uniqueCnpj(), email: `lab${ts}@test.com`,
    adminName: 'Admin', adminEmail: `admin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

describe('Attendances — CRUD', () => {
  let tenantId, adminToken, analystToken, viewerToken;
  let tenant2Id, admin2Token;
  let clientId, client2Id;

  beforeAll(async () => {
    const r1 = await registerTenant('A');
    tenantId     = r1.body.tenant.id;
    adminToken   = r1.body.token;
    analystToken = makeToken(tenantId, 'ANALYST');
    viewerToken  = makeToken(tenantId, 'VIEWER');

    const r2 = await registerTenant('B');
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;

    const c1 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente Teste', documento: uniqueDoc(11) });
    clientId = c1.body.id;

    const c2 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${admin2Token}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente B', documento: uniqueDoc(11) });
    client2Id = c2.body.id;
  });

  afterAll(async () => {
    await prisma.sample.deleteMany({     where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.attendance.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.client.deleteMany({     where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.user.deleteMany({       where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.tenant.deleteMany({     where: { id:       { in: [tenantId, tenant2Id] } } });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // POST
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/attendances', () => {
    it('cria atendimento com número sequencial', async () => {
      const res = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, tipoColeta: 'IN_LOCO', descricao: 'Análise de água' });

      expect(res.status).toBe(201);
      expect(res.body.numeroAtendimento).toMatch(/^\d{4}\/\d{4}$/);
      expect(res.body.status).toBe('ABERTO');
      expect(res.body.tenantId).toBe(tenantId);
    });

    it('gera números sequenciais incrementais', async () => {
      const r1 = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, tipoColeta: 'ENTREGA_NO_LABORATORIO' });
      const r2 = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, tipoColeta: 'IN_LOCO' });

      const seq1 = parseInt(r1.body.numeroAtendimento.split('/')[0], 10);
      const seq2 = parseInt(r2.body.numeroAtendimento.split('/')[0], 10);
      expect(seq2).toBe(seq1 + 1);
    });

    it('retorna 400 quando tipoColeta está ausente', async () => {
      const res = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId });
      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('tipoColeta');
    });

    it('retorna 404 quando clientId é de outro tenant', async () => {
      const res = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId: client2Id, tipoColeta: 'IN_LOCO' });
      expect(res.status).toBe(404);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).post('/api/v1/attendances')
        .send({ clientId, tipoColeta: 'IN_LOCO' });
      expect(res.status).toBe(401);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ clientId, tipoColeta: 'IN_LOCO' });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // GET list
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/attendances', () => {
    it('lista apenas atendimentos do tenant', async () => {
      const res = await request(app).get('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('não retorna atendimentos de outro tenant', async () => {
      const r1 = await request(app).get('/api/v1/attendances').set('Authorization', `Bearer ${adminToken}`);
      const r2 = await request(app).get('/api/v1/attendances').set('Authorization', `Bearer ${admin2Token}`);
      const ids1 = r1.body.data.map(a => a.id);
      const ids2 = r2.body.data.map(a => a.id);
      expect(ids1.filter(id => ids2.includes(id))).toHaveLength(0);
    });

    it('filtra por status', async () => {
      const res = await request(app).get('/api/v1/attendances?status=ABERTO')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(a => expect(a.status).toBe('ABERTO'));
    });

    it('pagina corretamente', async () => {
      const res = await request(app).get('/api/v1/attendances?page=1&pageSize=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.pageSize).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // GET by ID
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/attendances/:id', () => {
    let attendanceId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, tipoColeta: 'IN_LOCO', descricao: 'Para busca por ID' });
      attendanceId = res.body.id;
    });

    it('retorna atendimento pelo ID', async () => {
      const res = await request(app).get(`/api/v1/attendances/${attendanceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(attendanceId);
    });

    it('retorna 404 para ID de outro tenant', async () => {
      const res = await request(app).get(`/api/v1/attendances/${attendanceId}`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });

    it('retorna 404 para ID inexistente', async () => {
      const res = await request(app).get('/api/v1/attendances/id-invalido')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH campos
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/attendances/:id', () => {
    let attendanceId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, tipoColeta: 'IN_LOCO' });
      attendanceId = res.body.id;
    });

    it('atualiza campos parcialmente', async () => {
      const res = await request(app).patch(`/api/v1/attendances/${attendanceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ responsavel: 'Dr. Carlos' });
      expect(res.status).toBe(200);
      expect(res.body.responsavel).toBe('Dr. Carlos');
    });

    it('retorna 404 para atendimento de outro tenant', async () => {
      const res = await request(app).patch(`/api/v1/attendances/${attendanceId}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ responsavel: 'Invasor' });
      expect(res.status).toBe(404);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).patch(`/api/v1/attendances/${attendanceId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ responsavel: 'Viewer' });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH status
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/attendances/:id/status', () => {
    let attendanceId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, tipoColeta: 'IN_LOCO' });
      attendanceId = res.body.id;
    });

    it('transita ABERTO → EM_ANDAMENTO com sucesso', async () => {
      const res = await request(app).patch(`/api/v1/attendances/${attendanceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'EM_ANDAMENTO' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EM_ANDAMENTO');
    });

    it('transita EM_ANDAMENTO → ENCERRADO com sucesso', async () => {
      const res = await request(app).patch(`/api/v1/attendances/${attendanceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ENCERRADO' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ENCERRADO');
    });

    it('retorna 422 para transição inválida (ENCERRADO → ABERTO)', async () => {
      const res = await request(app).patch(`/api/v1/attendances/${attendanceId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ABERTO' });
      expect(res.status).toBe(422);
    });

    it('ANALYST pode cancelar', async () => {
      const r = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ clientId, tipoColeta: 'IN_LOCO' });
      const res = await request(app).patch(`/api/v1/attendances/${r.body.id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'CANCELADO' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELADO');
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/attendances/:id', () => {
    let attendanceId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/attendances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, tipoColeta: 'ENTREGA_NO_LABORATORIO' });
      attendanceId = res.body.id;
    });

    it('retorna 403 para ANALYST', async () => {
      const res = await request(app).delete(`/api/v1/attendances/${attendanceId}`)
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(403);
    });

    it('soft delete retorna 204', async () => {
      const res = await request(app).delete(`/api/v1/attendances/${attendanceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('atendimento deletado retorna 404 no GET', async () => {
      const res = await request(app).get(`/api/v1/attendances/${attendanceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
