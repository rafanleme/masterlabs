const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const config = require('../../config');
const logger = require('../../logger');
const mailer = require('../../lib/mailer');
const storageClient = require('../../lib/storageClient');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Resposta idêntica com ou sem cliente cadastrado — não vaza existência do e-mail
const GENERIC_REQUEST_RESPONSE = {
  message: 'Se o e-mail estiver cadastrado, um código de acesso foi enviado.',
};

function invalidCode() {
  const err = new Error('Código inválido ou expirado');
  err.status = 401;
  return err;
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function requestCode(email) {
  const clients = await prisma.client.findMany({
    where: { email, deletedAt: null },
    select: { id: true, tenantId: true, nome: true },
  });

  if (clients.length === 0) {
    logger.info({ event: 'portal.requestCode.unknownEmail' });
    return GENERIC_REQUEST_RESPONSE;
  }

  // Throttle por e-mail (independente do rate limit HTTP): máx N códigos/hora por cliente
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.clientAccessCode.count({
    where: {
      clientId: { in: clients.map((c) => c.id) },
      createdAt: { gt: oneHourAgo },
    },
  });
  if (recent >= config.portal.maxCodesPerHour * clients.length) {
    const err = new Error('Muitas solicitações de código — tente novamente mais tarde');
    err.status = 429;
    throw err;
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + config.portal.codeTtlMinutes * 60 * 1000);

  await prisma.clientAccessCode.createMany({
    data: clients.map((c) => ({
      tenantId: c.tenantId,
      clientId: c.id,
      codeHash,
      expiresAt,
    })),
  });

  await mailer.sendMail({
    to: email,
    subject: 'Seu código de acesso — MasterLabs',
    text: [
      `Olá, ${clients[0].nome}!`,
      '',
      `Seu código de acesso ao portal de laudos é: ${code}`,
      '',
      `O código expira em ${config.portal.codeTtlMinutes} minutos e só pode ser usado uma vez.`,
      'Se você não solicitou este código, ignore este e-mail.',
    ].join('\n'),
  });

  logger.info({ event: 'portal.requestCode.sent', clients: clients.length });
  return GENERIC_REQUEST_RESPONSE;
}

async function verifyCode({ email, code, tenantId }) {
  const now = new Date();
  const candidates = await prisma.clientAccessCode.findMany({
    where: {
      consumedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: config.portal.maxVerifyAttempts },
      client: { email, deletedAt: null, ...(tenantId && { tenantId }) },
    },
    include: {
      client: {
        select: {
          id: true, tenantId: true, nome: true, email: true,
          tenant: { select: { nomeFantasia: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const matches = [];
  for (const candidate of candidates) {
    if (await bcrypt.compare(code, candidate.codeHash)) matches.push(candidate);
  }

  if (matches.length === 0) {
    if (candidates.length > 0) {
      await prisma.clientAccessCode.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { attempts: { increment: 1 } },
      });
    }
    throw invalidCode();
  }

  const tenants = [...new Set(matches.map((m) => m.client.tenantId))];
  if (tenants.length > 1) {
    const err = new Error('E-mail cadastrado em mais de um laboratório — informe o tenantId na verificação');
    err.status = 409;
    err.payload = {
      labs: matches.map((m) => ({
        tenantId: m.client.tenantId,
        nomeFantasia: m.client.tenant.nomeFantasia,
      })),
    };
    throw err;
  }

  const match = matches[0];

  // Consome todos os códigos pendentes do cliente (single-use)
  await prisma.clientAccessCode.updateMany({
    where: { clientId: match.client.id, consumedAt: null },
    data: { consumedAt: now },
  });

  const token = jwt.sign(
    { clientId: match.client.id, tenantId: match.client.tenantId, scope: 'portal' },
    config.jwt.secret,
    { expiresIn: config.portal.jwtExpiresIn }
  );

  logger.info({ event: 'portal.login', clientId: match.client.id, tenantId: match.client.tenantId });

  return {
    token,
    client: {
      id: match.client.id,
      nome: match.client.nome,
      email: match.client.email,
      lab: match.client.tenant.nomeFantasia,
    },
  };
}

async function getMe({ clientId, tenantId }) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId, deletedAt: null },
    select: {
      id: true, nome: true, email: true, tipoPessoa: true,
      tenant: { select: { nomeFantasia: true } },
    },
  });
  if (!client) throw invalidCode();
  return {
    id: client.id,
    nome: client.nome,
    email: client.email,
    tipoPessoa: client.tipoPessoa,
    lab: client.tenant.nomeFantasia,
  };
}

async function listMyReports({ clientId, tenantId }, query) {
  let { page, pageSize } = query;
  page     = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
  pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSize, 10) || DEFAULT_PAGE_SIZE));

  const where = {
    tenantId,
    deletedAt: null,
    status: 'EMITIDO',
    sample: { clientId },
  };

  const [reports, total] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      orderBy: { dataEmissao: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        numeroLaudo: true,
        dataEmissao: true,
        responsavel: true,
        sample: { select: { numeroAmostra: true, descricao: true } },
        _count: { select: { pdfArtifacts: true } },
      },
    }),
    prisma.report.count({ where }),
  ]);

  const data = reports.map((r) => ({
    id: r.id,
    numeroLaudo: r.numeroLaudo,
    dataEmissao: r.dataEmissao,
    responsavel: r.responsavel,
    amostra: r.sample,
    pdfDisponivel: r._count.pdfArtifacts > 0,
  }));

  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

async function downloadMyReportPdf({ clientId, tenantId }, reportId) {
  const report = await prisma.report.findFirst({
    where: {
      id: reportId,
      tenantId,
      deletedAt: null,
      status: 'EMITIDO',
      sample: { clientId },
    },
    select: { id: true, numeroLaudo: true },
  });
  if (!report) {
    const err = new Error('Laudo não encontrado');
    err.status = 404;
    throw err;
  }

  const artifact = await prisma.pdfArtifact.findFirst({
    where: { reportId: report.id, tenantId },
    orderBy: { version: 'desc' },
  });
  if (!artifact) {
    const err = new Error('PDF ainda não disponível para este laudo');
    err.status = 404;
    throw err;
  }

  const buffer = await storageClient.downloadFile(artifact.storagePath);
  const downloadName = `laudo-${report.numeroLaudo.replace(/\//g, '-')}-v${artifact.version}.pdf`;

  logger.info({ event: 'portal.pdfDownloaded', reportId, clientId, tenantId, version: artifact.version });
  return { buffer, size: buffer.length, downloadName };
}

module.exports = { requestCode, verifyCode, getMe, listMyReports, downloadMyReportPdf };
