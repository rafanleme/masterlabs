jest.mock('../../src/lib/storageClient', () => {
  const state = {
    uploads: [],
    uploadShouldFail: false,
    downloadShouldFail: false,
    fakeBuffer: Buffer.from('%PDF-1.4 fake-pdf-bytes\n%%EOF\n'),
  };
  return {
    __state: state,
    uploadFile: jest.fn(async ({ buffer, filename, folder }) => {
      if (state.uploadShouldFail) {
        const err = new Error('Storage indisponível'); err.status = 502; throw err;
      }
      const path = `${folder}/hash16_${filename}`;
      state.uploads.push({ path, filename, size: buffer.length, folder });
      return { path, filename, size: buffer.length };
    }),
    downloadFile: jest.fn(async (path) => {
      if (state.downloadShouldFail) {
        const err = new Error('Storage download falhou'); err.status = 502; throw err;
      }
      return state.fakeBuffer;
    }),
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const config = require('../../src/config');
const storageClient = require('../../src/lib/storageClient');

function makeToken(tenantId, role, userId) {
  return jwt.sign({ userId: userId || `test-${role}`, tenantId, role }, config.jwt.secret, { expiresIn: '1h' });
}

let _seq = 0;
function uniqueCnpj() {
  const n = String(Date.now() * 1000 + (++_seq));
  return n.slice(-14).padStart(14, '1');
}

async function registerTenant(suffix) {
  const ts = Date.now() + _seq++;
  return request(app).post('/api/v1/tenants/register').send({
    razaoSocial: `PdfLab ${suffix}`, nomeFantasia: `PdfLab ${suffix}`,
    cnpj: uniqueCnpj(), email: `pdflab${ts}@test.com`,
    telefone: '11999990000',
    endereco: 'Rua das Flores, 123, São Paulo - SP',
    adminName: 'Admin', adminEmail: `pdfadmin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

async function createEmittedReport(token, sampleId, templateId) {
  const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${token}`)
    .send({ sampleId, reportTemplateId: templateId, responsavel: 'Dr. Carlos' });
  expect(r.status).toBe(201);
  await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
    .set('Authorization', `Bearer ${token}`).send({ status: 'EMITIDO' });
  return r.body.id;
}

describe('Reports — Geração de PDF', () => {
  let tenantId, adminToken, analystToken, viewerToken;
  let tenant2Id, admin2Token;
  let sampleId, sample2Id;
  let assayPh, assayTexto;
  let templateId;

  beforeAll(async () => {
    const r1 = await registerTenant('A');
    tenantId   = r1.body.tenant.id;
    adminToken = r1.body.token;
    const adminUserId = jwt.decode(adminToken).userId;
    analystToken = makeToken(tenantId, 'ANALYST', adminUserId);
    viewerToken  = makeToken(tenantId, 'VIEWER',  adminUserId);

    const r2 = await registerTenant('B');
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;

    const c1 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${adminToken}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente PDF', documento: uniqueCnpj().slice(0, 11),
              email: 'cliente@pdf.test', telefone: '11988880000' });
    const a1 = await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: c1.body.id, tipoColeta: 'IN_LOCO' });
    const s1 = await request(app).post('/api/v1/samples').set('Authorization', `Bearer ${adminToken}`)
      .send({ attendanceId: a1.body.id, descricao: 'Amostra PDF',
              dataColeta: '2026-06-01T08:00:00.000Z', dataRecebimento: '2026-06-01T10:00:00.000Z',
              amostrador: 'João', pontoColeta: 'Rio Teste', temperaturaAmostra: 22.5 });
    sampleId = s1.body.id;

    const c2 = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${admin2Token}`)
      .send({ tipoPessoa: 'PF', nome: 'Cliente T2', documento: uniqueCnpj().slice(0, 11) });
    const a2 = await request(app).post('/api/v1/attendances').set('Authorization', `Bearer ${admin2Token}`)
      .send({ clientId: c2.body.id, tipoColeta: 'IN_LOCO' });
    const s2 = await request(app).post('/api/v1/samples').set('Authorization', `Bearer ${admin2Token}`)
      .send({ attendanceId: a2.body.id, descricao: 'Amostra T2' });
    sample2Id = s2.body.id;

    const eP = await request(app).post('/api/v1/assays').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'pH', unidade: 'pH', tipoComparacao: 'ENTRE', limiteMinimo: 6.0, limiteMaximo: 9.5 });
    assayPh = eP.body.id;
    const eT = await request(app).post('/api/v1/assays').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Coliformes', unidade: 'UFC', tipoComparacao: 'TEXTO', valorReferencia: 'Ausência' });
    assayTexto = eT.body.id;

    const tmpl = await request(app).post('/api/v1/report-templates').set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Laudo PDF', assayIds: [assayPh, assayTexto] });
    templateId = tmpl.body.id;
  });

  afterAll(async () => {
    await prisma.pdfArtifact.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
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

  beforeEach(() => {
    storageClient.__state.uploads = [];
    storageClient.__state.uploadShouldFail = false;
    storageClient.__state.downloadShouldFail = false;
    storageClient.uploadFile.mockClear();
    storageClient.downloadFile.mockClear();
  });

  // ---------------------------------------------------------------------------
  // POST /:id/pdf
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/reports/:id/pdf', () => {
    it('gera versão 1 do PDF para laudo EMITIDO', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      const res = await request(app).post(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`).send();

      expect(res.status).toBe(201);
      expect(res.body.version).toBe(1);
      expect(res.body.reportId).toBe(reportId);
      expect(res.body.size).toBeGreaterThan(0);
      expect(res.body.createdBy).toHaveProperty('id');
      expect(res.body).not.toHaveProperty('storagePath');
      expect(storageClient.uploadFile).toHaveBeenCalledTimes(1);
      const uploadArg = storageClient.uploadFile.mock.calls[0][0];
      expect(uploadArg.folder).toBe(`laudos/${tenantId}/${reportId}`);
      expect(uploadArg.filename).toMatch(/^laudo-\d{4}-\d{4}-v1\.pdf$/);
      expect(uploadArg.buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('gera versão sequencial 2 quando chamado novamente', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      const res = await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      expect(res.status).toBe(201);
      expect(res.body.version).toBe(2);
    });

    it('retorna 409 para laudo em RASCUNHO', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: templateId });
      const res = await request(app).post(`/api/v1/reports/${r.body.id}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`).send();
      expect(res.status).toBe(409);
    });

    it('retorna 409 para laudo CANCELADO', async () => {
      const r = await request(app).post('/api/v1/reports').set('Authorization', `Bearer ${adminToken}`)
        .send({ sampleId, reportTemplateId: templateId });
      await request(app).patch(`/api/v1/reports/${r.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`).send({ status: 'CANCELADO' });
      const res = await request(app).post(`/api/v1/reports/${r.body.id}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`).send();
      expect(res.status).toBe(409);
    });

    it('retorna 404 quando laudo é de outro tenant', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      const res = await request(app).post(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${admin2Token}`).send();
      expect(res.status).toBe(404);
    });

    it('retorna 404 para id inexistente', async () => {
      const res = await request(app).post('/api/v1/reports/id-invalido/pdf')
        .set('Authorization', `Bearer ${adminToken}`).send();
      expect(res.status).toBe(404);
    });

    it('retorna 401 sem token', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      const res = await request(app).post(`/api/v1/reports/${reportId}/pdf`).send();
      expect(res.status).toBe(401);
    });

    it('retorna 403 para VIEWER', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      const res = await request(app).post(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${viewerToken}`).send();
      expect(res.status).toBe(403);
    });

    it('ANALYST pode gerar', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      const res = await request(app).post(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${analystToken}`).send();
      expect(res.status).toBe(201);
    });

    it('retorna 502 e não cria PdfArtifact quando Storage falha no upload', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      storageClient.__state.uploadShouldFail = true;
      const res = await request(app).post(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`).send();
      expect(res.status).toBe(502);
      const count = await prisma.pdfArtifact.count({ where: { reportId } });
      expect(count).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /:id/pdf-artifacts
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/reports/:id/pdf-artifacts', () => {
    it('retorna lista vazia quando nenhum PDF foi gerado', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf-artifacts`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('lista versões em ordem decrescente', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();

      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf-artifacts`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].version).toBe(2);
      expect(res.body[1].version).toBe(1);
      expect(res.body[0]).not.toHaveProperty('storagePath');
    });

    it('VIEWER pode listar', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf-artifacts`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('retorna 404 para laudo de outro tenant', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf-artifacts`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /:id/pdf
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/reports/:id/pdf', () => {
    it('baixa última versão como application/pdf', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();

      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true).parse((res, cb) => {
          const chunks = []; res.on('data', c => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/^attachment;/);
      expect(res.headers['content-disposition']).toMatch(/laudo-\d{4}-\d{4}-v1\.pdf/);
      expect(res.body.slice(0, 4).toString()).toBe('%PDF');
      expect(storageClient.downloadFile).toHaveBeenCalledTimes(1);
    });

    it('baixa versão específica via ?version=N', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();

      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf?version=1`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/v1\.pdf/);
    });

    it('usa Content-Disposition inline quando ?inline=1', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf?inline=1`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/^inline;/);
    });

    it('VIEWER pode baixar', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(200);
    });

    it('retorna 404 quando nenhum PDF foi gerado', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('retorna 404 para versão inexistente', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf?version=99`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('retorna 404 para laudo de outro tenant', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });

    it('retorna 502 quando Storage falha no download', async () => {
      const reportId = await createEmittedReport(adminToken, sampleId, templateId);
      await request(app).post(`/api/v1/reports/${reportId}/pdf`).set('Authorization', `Bearer ${adminToken}`).send();
      storageClient.__state.downloadShouldFail = true;
      const res = await request(app).get(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(502);
    });
  });
});
