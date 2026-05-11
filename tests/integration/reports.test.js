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
    razaoSocial: `RepLab ${suffix}`, nomeFantasia: `RepLab ${suffix}`,
    cnpj: uniqueCnpj(), email: `rlab${ts}@test.com`,
    adminName: 'Admin', adminEmail: `radmin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

describe('Reports — Emissão de Laudos', () => {
  let tenantId, adminToken, analystToken, viewerToken;
  let tenant2Id, admin2Token;
  let sampleId, sample2Id;
  let assayPh, assayTurbidez, assayTexto;
  let templateId, template2Id;

  beforeAll(async () => {
    const r1 = await registerTenant('A');
    tenantId     = r1.body.tenant.id;
    adminToken   = r1.body.token;
    analystToken = makeToken(tenantId, 'ANALYST');
    viewerToken  = makeToken(tenantId, 'VIEWER');

    const r2 = await registerTenant('B');
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;

    // Criar cliente e atendimento para tenant 1
    const c1 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente Rep', documento: uniqueCnpj().slice(0, 11) });
    const a1 = await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: c1.body.id, tipoColeta: 'IN_LOCO' });

    // Criar amostras para tenant 1
    const s1 = await request(app).post('/api/v1/samples').set('Authorization', `Bearer ${adminToken}`)
      .send({ attendanceId: a1.body.id, descricao: 'Amostra para laudos' });
    sampleId = s1.body.id;

    const s2 = await request(app).post('/api/v1/samples').set('Authorization', `Bearer ${adminToken}`)
      .send({ attendanceId: a1.body.id, descricao: 'Amostra extra' });
    sample2Id = s2.body.id;

    // Criar cliente/atendimento/amostra para tenant 2
    const c2 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${admin2Token}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente B', documento: uniqueCnpj().slice(0, 11) });
    const a2 = await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${admin2Token}`)
      .send({ clientId: c2.body.id, tipoColeta: 'IN_LOCO' });
    const s3 = await request(app).post('/api/v1/samples').set('Authorization', `Bearer ${admin2Token}`)
      .send({ attendanceId: a2.body.id, descricao: 'Amostra tenant2' });
    sample2Id = s3.body.id; // reutilizamos para tenant isolation

    // Criar ensaios para tenant 1
    const eP = await request(app).post('/api/v1/assays').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'pH', unidade: 'pH', tipoComparacao: 'ENTRE', limiteMinimo: 6.0, limiteMaximo: 9.5 });
    assayPh = eP.body.id;

    const eT = await request(app).post('/api/v1/assays').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Turbidez', unidade: 'NTU', tipoComparacao: 'MENOR_IGUAL', limiteMaximo: 5.0 });
    assayTurbidez = eT.body.id;

    const eTx = await request(app).post('/api/v1/assays').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Coliformes', unidade: 'UFC/100mL', tipoComparacao: 'TEXTO', valorReferencia: 'Ausência' });
    assayTexto = eTx.body.id;

    // Criar template para tenant 1
    const tmpl = await request(app).post('/api/v1/report-templates').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Laudo FQ', assayIds: [assayPh, assayTurbidez, assayTexto] });
    templateId = tmpl.body.id;

    // Criar template extra
    const tmpl2 = await request(app).post('/api/v1/report-templates').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Laudo Simples', assayIds: [assayPh] });
    template2Id = tmpl2.body.id;
  });

  afterAll(async () => {
    await prisma.reportItem.deleteMany({ where: { report: { tenantId: { in: [tenantId, tenant2Id] } } } });
    await prisma.report.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.reportTemplateAssay.deleteMany({ where: { reportTemplate: { tenantId: { in: [tenantId, tenant2Id] } } } });
    await prisma.reportTemplate.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.assay.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.sample.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.attendance.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.client.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, tenant2Id] } } });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // POST
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/reports', () => {
    it('cria laudo em RASCUNHO com número sequencial e items automáticos', async () => {
      const res = await request(app).post('/api/v1/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: templateId, responsavel: 'Dr. Carlos' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('RASCUNHO');
      expect(res.body.numeroLaudo).toMatch(/^\d{4}\/\d{4}$/);
      expect(res.body.tenantId).toBe(tenantId);
      expect(res.body.items).toHaveLength(3);
      expect(res.body.items[0].ordem).toBe(0);
      expect(res.body.items[0].assay.id).toBe(assayPh);
      expect(res.body.items[0].conformidade).toBe('INCONCLUSIVO');
      expect(res.body.items[0].valor).toBeNull();
    });

    it('gera números sequenciais incrementais', async () => {
      const r1 = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      const r2 = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });

      const seq1 = parseInt(r1.body.numeroLaudo.split('/')[0], 10);
      const seq2 = parseInt(r2.body.numeroLaudo.split('/')[0], 10);
      expect(seq2).toBe(seq1 + 1);
    });

    it('retorna 400 quando sampleId está ausente', async () => {
      const res = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ reportTemplateId: templateId });
      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('sampleId');
    });

    it('retorna 404 quando sampleId é de outro tenant', async () => {
      const res = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId: sample2Id, reportTemplateId: templateId });
      expect(res.status).toBe(404);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).post('/api/v1/reports')
        .send({ sampleId, reportTemplateId: templateId });
      expect(res.status).toBe(401);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${viewerToken}`)
        .send({ sampleId, reportTemplateId: templateId });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // GET list
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/reports', () => {
    it('lista apenas laudos do tenant', async () => {
      const res = await request(app).get('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('não retorna laudos de outro tenant', async () => {
      // Criar laudo no tenant 2
      const c2 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${admin2Token}`)
        .send({ tipoPessoa: 'PF', nome: 'C2', documento: uniqueCnpj().slice(0, 11) });
      const a2 = await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${admin2Token}`)
        .send({ clientId: c2.body.id, tipoColeta: 'IN_LOCO' });
      const s2 = await request(app).post('/api/v1/samples').set('Authorization', `Bearer ${admin2Token}`)
        .send({ attendanceId: a2.body.id, descricao: 'S2' });
      const asT2 = await request(app).post('/api/v1/assays').set('Authorization', `Bearer ${admin2Token}`)
        .send({ nome: 'pHt2', unidade: 'pH' });
      const tmT2 = await request(app).post('/api/v1/report-templates').set('Authorization', `Bearer ${admin2Token}`)
        .send({ nome: 'Template T2', assayIds: [asT2.body.id] });
      await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${admin2Token}`)
        .send({ sampleId: s2.body.id, reportTemplateId: tmT2.body.id });

      const r1 = await request(app).get('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`);
      const r2 = await request(app).get('/api/v1/reports').set('Authorization', `Bearer ${admin2Token}`);
      const ids1 = r1.body.data.map(r => r.id);
      const ids2 = r2.body.data.map(r => r.id);
      expect(ids1.filter(id => ids2.includes(id))).toHaveLength(0);
    });

    it('filtra por status', async () => {
      const res = await request(app).get('/api/v1/reports?status=RASCUNHO').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach(r => expect(r.status).toBe('RASCUNHO'));
    });

    it('pagina corretamente', async () => {
      const res = await request(app).get('/api/v1/reports?page=1&pageSize=1').set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body.pagination.pageSize).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // GET by ID
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/reports/:id', () => {
    let reportId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: templateId, observacoes: 'Para GET by ID' });
      reportId = res.body.id;
    });

    it('retorna laudo com items ordenados', async () => {
      const res = await request(app).get(`/api/v1/reports/${reportId}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(reportId);
      expect(res.body.items).toHaveLength(3);
      expect(res.body.items[0].ordem).toBe(0);
      expect(res.body.items[1].ordem).toBe(1);
      expect(res.body.items[2].ordem).toBe(2);
    });

    it('retorna 404 para ID de outro tenant', async () => {
      const res = await request(app).get(`/api/v1/reports/${reportId}`).set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });

    it('retorna 404 para ID inexistente', async () => {
      const res = await request(app).get('/api/v1/reports/id-invalido').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH metadados
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/reports/:id', () => {
    let reportId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: templateId });
      reportId = res.body.id;
    });

    it('atualiza metadados parcialmente', async () => {
      const res = await request(app).patch(`/api/v1/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ responsavel: 'Dr. Paulo Lima' });
      expect(res.status).toBe(200);
      expect(res.body.responsavel).toBe('Dr. Paulo Lima');
    });

    it('retorna 422 quando tenta editar laudo EMITIDO', async () => {
      await request(app).patch(`/api/v1/reports/${reportId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'EMITIDO' });

      const res = await request(app).patch(`/api/v1/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ responsavel: 'Outra pessoa' });
      expect(res.status).toBe(422);
    });

    it('retorna 403 para VIEWER', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      const res = await request(app).patch(`/api/v1/reports/${r.body.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ responsavel: 'Viewer' });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH items
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/reports/:id/items/:assayId', () => {
    let reportId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: templateId });
      reportId = res.body.id;
    });

    it('registra resultado e calcula conformidade CONFORME (ENTRE)', async () => {
      const res = await request(app).patch(`/api/v1/reports/${reportId}/items/${assayPh}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ valor: '7,2', valorNumerico: 7.2 });

      expect(res.status).toBe(200);
      expect(res.body.valor).toBe('7,2');
      expect(res.body.valorNumerico).toBe(7.2);
      expect(res.body.conformidade).toBe('CONFORME');
    });

    it('calcula conformidade NAO_CONFORME quando fora da faixa', async () => {
      const res = await request(app).patch(`/api/v1/reports/${reportId}/items/${assayPh}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ valor: '10,5', valorNumerico: 10.5 });

      expect(res.status).toBe(200);
      expect(res.body.conformidade).toBe('NAO_CONFORME');
    });

    it('calcula conformidade CONFORME para MENOR_IGUAL', async () => {
      const res = await request(app).patch(`/api/v1/reports/${reportId}/items/${assayTurbidez}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ valor: '3', valorNumerico: 3.0 });

      expect(res.status).toBe(200);
      expect(res.body.conformidade).toBe('CONFORME');
    });

    it('mantém INCONCLUSIVO para ensaio tipo TEXTO', async () => {
      const res = await request(app).patch(`/api/v1/reports/${reportId}/items/${assayTexto}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ valor: 'Ausência', valorNumerico: null });

      expect(res.status).toBe(200);
      expect(res.body.conformidade).toBe('INCONCLUSIVO');
    });

    it('mantém INCONCLUSIVO quando valorNumerico é null em ensaio numérico', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: templateId });
      const res = await request(app).patch(`/api/v1/reports/${r.body.id}/items/${assayPh}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ valor: 'pendente' });

      expect(res.status).toBe(200);
      expect(res.body.conformidade).toBe('INCONCLUSIVO');
    });

    it('retorna 422 quando laudo não está em RASCUNHO', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'EMITIDO' });

      const res = await request(app).patch(`/api/v1/reports/${r.body.id}/items/${assayPh}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ valor: '7', valorNumerico: 7.0 });
      expect(res.status).toBe(422);
    });

    it('retorna 404 para assayId que não está no laudo', async () => {
      const res = await request(app).patch(`/api/v1/reports/${reportId}/items/id-invalido`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ valor: 'teste' });
      expect(res.status).toBe(404);
    });

    it('retorna 403 para VIEWER', async () => {
      const res = await request(app).patch(`/api/v1/reports/${reportId}/items/${assayPh}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ valor: '7' });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH status
  // ---------------------------------------------------------------------------
  describe('PATCH /api/v1/reports/:id/status', () => {
    it('transita RASCUNHO → EMITIDO e preenche dataEmissao', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });

      const res = await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'EMITIDO' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EMITIDO');
      expect(res.body.dataEmissao).not.toBeNull();
    });

    it('transita RASCUNHO → CANCELADO', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });

      const res = await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELADO' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELADO');
    });

    it('retorna 422 para transição inválida (EMITIDO → CANCELADO)', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'EMITIDO' });

      const res = await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELADO' });
      expect(res.status).toBe(422);
    });

    it('retorna 400 para status inválido', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      const res = await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RASCUNHO' });
      expect(res.status).toBe(400);
    });

    it('ANALYST pode emitir laudo', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${analystToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      const res = await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'EMITIDO' });
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------
  describe('DELETE /api/v1/reports/:id', () => {
    it('retorna 403 para ANALYST', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      const res = await request(app).delete(`/api/v1/reports/${r.body.id}`).set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(403);
    });

    it('soft delete de laudo RASCUNHO retorna 204', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      const res = await request(app).delete(`/api/v1/reports/${r.body.id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('laudo deletado retorna 404 no GET', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      await request(app).delete(`/api/v1/reports/${r.body.id}`).set('Authorization', `Bearer ${adminToken}`);
      const res = await request(app).get(`/api/v1/reports/${r.body.id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('retorna 422 ao tentar deletar laudo EMITIDO', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'EMITIDO' });
      const res = await request(app).delete(`/api/v1/reports/${r.body.id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(422);
    });

    it('soft delete de laudo CANCELADO retorna 204', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CANCELADO' });
      const res = await request(app).delete(`/api/v1/reports/${r.body.id}`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });

    it('retorna 404 ao deletar laudo de outro tenant', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: template2Id });
      const res = await request(app).delete(`/api/v1/reports/${r.body.id}`).set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });
  });
});
