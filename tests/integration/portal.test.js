jest.mock('../../src/lib/mailer', () => {
  const state = { sent: [] };
  return {
    __state: state,
    sendMail: jest.fn(async (msg) => {
      state.sent.push(msg);
      return { delivered: false, logged: true };
    }),
  };
});

jest.mock('../../src/lib/storageClient', () => ({
  uploadFile: jest.fn(),
  downloadFile: jest.fn(async () => Buffer.from('%PDF-1.4 fake portal pdf\n%%EOF\n')),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const config = require('../../src/config');
const mailer = require('../../src/lib/mailer');

let _seq = 0;
function uniqueCnpj() {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-14).padStart(14, '1');
}
function uniqueCpf() {
  return uniqueCnpj().slice(0, 11);
}

async function registerTenant(suffix) {
  const ts = Date.now() + _seq++;
  return request(app).post('/api/v1/tenants/register').send({
    razaoSocial: `PortalLab ${suffix}`, nomeFantasia: `PortalLab ${suffix}`,
    cnpj: uniqueCnpj(), email: `portallab${ts}@test.com`,
    adminName: 'Admin', adminEmail: `portaladmin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

function lastCodeSent() {
  const sent = mailer.__state.sent;
  expect(sent.length).toBeGreaterThan(0);
  const match = sent[sent.length - 1].text.match(/\b(\d{6})\b/);
  expect(match).not.toBeNull();
  return match[1];
}

// Cria cadeia cliente → atendimento → amostra → ensaio → modelo → laudo EMITIDO
async function createEmittedReportForClient(token, clientId) {
  const att = await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${token}`)
    .send({ clientId, tipoColeta: 'IN_LOCO' });
  const sample = await request(app).post('/api/v1/samples').set('Authorization', `Bearer ${token}`)
    .send({ attendanceId: att.body.id, descricao: 'Amostra Portal' });
  const assay = await request(app).post('/api/v1/assays').set('Authorization', `Bearer ${token}`)
    .send({ nome: `pH-${_seq++}`, unidade: 'pH' });
  const tmpl = await request(app).post('/api/v1/report-templates').set('Authorization', `Bearer ${token}`)
    .send({ nome: `Modelo Portal ${_seq++}`, assayIds: [assay.body.id] });
  const report = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${token}`)
    .send({ sampleId: sample.body.id, reportTemplateId: tmpl.body.id, responsavel: 'Dr. Portal' });
  await request(app).patch(`/api/v1/reports/${report.body.id}/status`)
    .set('Authorization', `Bearer ${token}`).send({ status: 'EMITIDO' });
  return report.body.id;
}

describe('Portal do Cliente — magic code', () => {
  let tenantId, adminToken, adminUserId;
  let tenant2Id, admin2Token;
  let clientId, client2Id, otherClientId;
  let reportId, otherReportId;
  const clientEmail = `cliente-${Date.now()}@portal.test`;
  const otherEmail  = `outro-${Date.now()}@portal.test`;

  beforeAll(async () => {
    const r1 = await registerTenant('A');
    tenantId    = r1.body.tenant.id;
    adminToken  = r1.body.token;
    adminUserId = jwt.decode(adminToken).userId;

    const r2 = await registerTenant('B');
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;

    // Cliente principal (tenant 1) com laudo emitido
    const c1 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente Portal', documento: uniqueCpf(), email: clientEmail });
    clientId = c1.body.id;
    reportId = await createEmittedReportForClient(adminToken, clientId);

    // Outro cliente do mesmo tenant com laudo próprio (não pode vazar)
    const c3 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Outro Cliente', documento: uniqueCpf(), email: otherEmail });
    otherClientId = c3.body.id;
    otherReportId = await createEmittedReportForClient(adminToken, otherClientId);
  });

  afterAll(async () => {
    const tenants = [tenantId, tenant2Id];
    await prisma.clientAccessCode.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.pdfArtifact.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.reportItem.deleteMany({ where: { report: { tenantId: { in: tenants } } } });
    await prisma.report.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.reportTemplateAssay.deleteMany({ where: { reportTemplate: { tenantId: { in: tenants } } } });
    await prisma.reportTemplate.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.assay.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.sample.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.attendance.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.client.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenants } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/portal/auth/request-code', () => {
    it('responde genericamente para e-mail desconhecido, sem enviar e-mail', async () => {
      const before = mailer.__state.sent.length;
      const res = await request(app).post('/api/v1/portal/auth/request-code')
        .send({ email: 'naoexiste@portal.test' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Se o e-mail estiver cadastrado/);
      expect(mailer.__state.sent.length).toBe(before);
    });

    it('envia código de 6 dígitos para cliente cadastrado com a mesma resposta genérica', async () => {
      const res = await request(app).post('/api/v1/portal/auth/request-code')
        .send({ email: clientEmail });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Se o e-mail estiver cadastrado/);
      expect(lastCodeSent()).toMatch(/^\d{6}$/);
    });
  });

  describe('POST /api/v1/portal/auth/verify', () => {
    let portalToken;

    it('retorna 401 para código errado', async () => {
      const res = await request(app).post('/api/v1/portal/auth/verify')
        .send({ email: clientEmail, code: '000000' });
      expect(res.status).toBe(401);
    });

    it('troca código válido por token do portal', async () => {
      const code = lastCodeSent();
      const res = await request(app).post('/api/v1/portal/auth/verify')
        .send({ email: clientEmail, code });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.client.id).toBe(clientId);
      portalToken = res.body.token;
    });

    it('código é single-use: segunda verificação falha', async () => {
      const code = lastCodeSent();
      const res = await request(app).post('/api/v1/portal/auth/verify')
        .send({ email: clientEmail, code });
      expect(res.status).toBe(401);
    });

    it('GET /portal/me retorna dados do cliente', async () => {
      const res = await request(app).get('/api/v1/portal/me')
        .set('Authorization', `Bearer ${portalToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(clientId);
      expect(res.body.lab).toMatch(/PortalLab/);
    });

    it('GET /portal/reports lista apenas laudos do próprio cliente', async () => {
      const res = await request(app).get('/api/v1/portal/reports')
        .set('Authorization', `Bearer ${portalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(reportId);
      expect(res.body.data[0].pdfDisponivel).toBe(false);
    });

    it('não permite baixar laudo de outro cliente (404)', async () => {
      const res = await request(app).get(`/api/v1/portal/reports/${otherReportId}/pdf`)
        .set('Authorization', `Bearer ${portalToken}`);
      expect(res.status).toBe(404);
    });

    it('retorna 404 quando o laudo ainda não tem PDF', async () => {
      const res = await request(app).get(`/api/v1/portal/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${portalToken}`);
      expect(res.status).toBe(404);
    });

    it('baixa a última versão do PDF quando disponível', async () => {
      await prisma.pdfArtifact.create({
        data: {
          tenantId, reportId, version: 1,
          storagePath: `laudos/${tenantId}/${reportId}/fake.pdf`,
          filename: 'fake.pdf', size: 100, createdById: adminUserId,
        },
      });

      const res = await request(app).get(`/api/v1/portal/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${portalToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/laudo-.*-v1\.pdf/);
    });

    it('token do portal não acessa rotas internas', async () => {
      const res = await request(app).get('/api/v1/clients')
        .set('Authorization', `Bearer ${portalToken}`);
      expect(res.status).toBe(401);
    });

    it('token interno não acessa rotas do portal', async () => {
      const res = await request(app).get('/api/v1/portal/reports')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(401);
    });
  });

  describe('e-mail em múltiplos laboratórios', () => {
    beforeAll(async () => {
      const c2 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${admin2Token}`)
        .send({ tipoPessoa: 'PF', nome: 'Cliente Portal T2', documento: uniqueCpf(), email: clientEmail });
      client2Id = c2.body.id;
    });

    it('verify sem tenantId retorna 409 com a lista de laboratórios', async () => {
      await request(app).post('/api/v1/portal/auth/request-code').send({ email: clientEmail });
      const code = lastCodeSent();

      const res = await request(app).post('/api/v1/portal/auth/verify')
        .send({ email: clientEmail, code });

      expect(res.status).toBe(409);
      expect(res.body.labs).toHaveLength(2);

      const res2 = await request(app).post('/api/v1/portal/auth/verify')
        .send({ email: clientEmail, code, tenantId: tenant2Id });
      expect(res2.status).toBe(200);
      expect(res2.body.client.id).toBe(client2Id);
    });
  });

  describe('throttle de códigos', () => {
    it('bloqueia com 429 após o limite de códigos por hora', async () => {
      const email = `throttle-${Date.now()}@portal.test`;
      await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
        .send({ tipoPessoa: 'PF', nome: 'Cliente Throttle', documento: uniqueCpf(), email });

      for (let i = 0; i < config.portal.maxCodesPerHour; i++) {
        const ok = await request(app).post('/api/v1/portal/auth/request-code').send({ email });
        expect(ok.status).toBe(200);
      }

      const blocked = await request(app).post('/api/v1/portal/auth/request-code').send({ email });
      expect(blocked.status).toBe(429);
    });
  });
});
