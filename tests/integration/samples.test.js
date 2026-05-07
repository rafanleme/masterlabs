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
    razaoSocial: `SampleLab ${suffix}`, nomeFantasia: `SampleLab ${suffix}`,
    cnpj: uniqueCnpj(), email: `slab${ts}@test.com`,
    adminName: 'Admin', adminEmail: `sadmin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

describe('Samples — CRUD', () => {
  let tenantId, adminToken, analystToken, viewerToken;
  let tenant2Id, admin2Token;
  let attendanceId, attendance2Id;

  beforeAll(async () => {
    const r1 = await registerTenant('A');
    tenantId     = r1.body.tenant.id;
    adminToken   = r1.body.token;
    analystToken = makeToken(tenantId, 'ANALYST');
    viewerToken  = makeToken(tenantId, 'VIEWER');

    const r2 = await registerTenant('B');
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;

    // Cliente e atendimento para tenant 1
    const c1 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente Sample', documento: uniqueDoc(11) });
    const a1 = await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: c1.body.id, tipoColeta: 'IN_LOCO' });
    attendanceId = a1.body.id;

    // Cliente e atendimento para tenant 2
    const c2 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${admin2Token}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente B', documento: uniqueDoc(11) });
    const a2 = await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${admin2Token}`)
      .send({ clientId: c2.body.id, tipoColeta: 'IN_LOCO' });
    attendance2Id = a2.body.id;
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
  describe('POST /api/v1/samples', () => {
    it('cria amostra com número sequencial', async () => {
      const res = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId, descricao: 'Amostra de água' });

      expect(res.status).toBe(201);
      expect(res.body.numeroAmostra).toMatch(/^\d{4}\/\d{4}$/);
      expect(res.body.status).toBe('RECEBIDA');
      expect(res.body.tenantId).toBe(tenantId);
    });

    it('gera números sequenciais incrementais', async () => {
      const r1 = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId, descricao: 'Amostra seq 1' });
      const r2 = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId, descricao: 'Amostra seq 2' });

      const seq1 = parseInt(r1.body.numeroAmostra.split('/')[0], 10);
      const seq2 = parseInt(r2.body.numeroAmostra.split('/')[0], 10);
      expect(seq2).toBe(seq1 + 1);
    });

    it('retorna 400 quando descricao está ausente', async () => {
      const res = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId });
      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('descricao');
    });

    it('retorna 404 quando attendanceId é de outro tenant', async () => {
      const res = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId: attendance2Id, descricao: 'Invasão' });
      expect(res.status).toBe(404);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).post('/api/v1/samples')
        .send({ attendanceId, descricao: 'Sem auth' });
      expect(res.status).toBe(401);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ attendanceId, descricao: 'Viewer' });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // GET list
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/samples', () => {
    it('lista apenas amostras do tenant', async () => {
      const res = await request(app).get('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('não retorna amostras de outro tenant', async () => {
      const r1 = await request(app).get('/api/v1/samples').set('Authorization', `Bearer ${adminToken}`);
      const r2 = await request(app).get('/api/v1/samples').set('Authorization', `Bearer ${admin2Token}`);
      const ids1 = r1.body.data.map(s => s.id);
      const ids2 = r2.body.data.map(s => s.id);
      expect(ids1.filter(id => ids2.includes(id))).toHaveLength(0);
    });

    it('filtra por attendanceId', async () => {
      const res = await request(app).get(`/api/v1/samples?attendanceId=${attendanceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(s => expect(s.attendanceId).toBe(attendanceId));
    });

    it('filtra por status', async () => {
      const res = await request(app).get('/api/v1/samples?status=RECEBIDA')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(s => expect(s.status).toBe('RECEBIDA'));
    });

    it('pagina corretamente', async () => {
      const res = await request(app).get('/api/v1/samples?page=1&pageSize=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.pageSize).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // GET by ID
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/samples/:id', () => {
    let sampleId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId, descricao: 'Para busca por ID', pontoColeta: 'Ponto A' });
      sampleId = res.body.id;
    });

    it('retorna amostra pelo ID', async () => {
      const res = await request(app).get(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sampleId);
    });

    it('retorna 404 para ID de outro tenant', async () => {
      const res = await request(app).get(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });

    it('retorna 404 para ID inexistente', async () => {
      const res = await request(app).get('/api/v1/samples/id-invalido')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH campos
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/samples/:id', () => {
    let sampleId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId, descricao: 'Para editar' });
      sampleId = res.body.id;
    });

    it('atualiza campos parcialmente', async () => {
      const res = await request(app).patch(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amostrador: 'Carlos Lima', temperaturaAmostra: 18.5 });
      expect(res.status).toBe(200);
      expect(res.body.amostrador).toBe('Carlos Lima');
      expect(res.body.temperaturaAmostra).toBe(18.5);
    });

    it('retorna 404 para amostra de outro tenant', async () => {
      const res = await request(app).patch(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ amostrador: 'Invasor' });
      expect(res.status).toBe(404);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).patch(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ amostrador: 'Viewer' });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH status
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/samples/:id/status', () => {
    let sampleId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId, descricao: 'Para transição de status' });
      sampleId = res.body.id;
    });

    it('transita RECEBIDA → EM_ANALISE', async () => {
      const res = await request(app).patch(`/api/v1/samples/${sampleId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'EM_ANALISE' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EM_ANALISE');
    });

    it('transita EM_ANALISE → CONCLUIDA', async () => {
      const res = await request(app).patch(`/api/v1/samples/${sampleId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONCLUIDA' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONCLUIDA');
    });

    it('retorna 422 para transição inválida (CONCLUIDA → RECEBIDA)', async () => {
      const res = await request(app).patch(`/api/v1/samples/${sampleId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RECEBIDA' });
      expect(res.status).toBe(422);
    });

    it('ANALYST pode cancelar amostra', async () => {
      const r = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ attendanceId, descricao: 'Para cancelar' });
      const res = await request(app).patch(`/api/v1/samples/${r.body.id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'CANCELADA' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELADA');
    });

    it('ANALYST pode rejeitar amostra', async () => {
      const r = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ attendanceId, descricao: 'Para rejeitar' });
      const res = await request(app).patch(`/api/v1/samples/${r.body.id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'REJEITADA' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REJEITADA');
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/samples/:id', () => {
    let sampleId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId, descricao: 'Para deletar' });
      sampleId = res.body.id;
    });

    it('retorna 403 para ANALYST', async () => {
      const res = await request(app).delete(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(403);
    });

    it('soft delete retorna 204', async () => {
      const res = await request(app).delete(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('amostra deletada retorna 404 no GET', async () => {
      const res = await request(app).get(`/api/v1/samples/${sampleId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('retorna 404 ao deletar amostra de outro tenant', async () => {
      const r = await request(app).post('/api/v1/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendanceId, descricao: 'Alvo de outro tenant' });
      const res = await request(app).delete(`/api/v1/samples/${r.body.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });
  });
});
