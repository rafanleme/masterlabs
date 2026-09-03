const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const config = require('../../config');

function invalidCredentials() {
  const err = new Error('Credenciais inválidas');
  err.status = 401;
  return err;
}

function buildToken(user) {
  return jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId };
}

async function login({ email, password, cnpj }) {
  // O mesmo e-mail pode existir em tenants diferentes (@@unique é [tenantId, email])
  const candidates = await prisma.user.findMany({
    where: {
      email,
      active: true,
      ...(cnpj && { tenant: { cnpj } }),
    },
    include: { tenant: { select: { id: true, nomeFantasia: true, cnpj: true } } },
  });

  const matches = [];
  for (const user of candidates) {
    if (await bcrypt.compare(password, user.passwordHash)) matches.push(user);
  }

  if (matches.length === 0) throw invalidCredentials();

  if (matches.length > 1) {
    const err = new Error('E-mail cadastrado em mais de um laboratório — informe o CNPJ do laboratório no login');
    err.status = 409;
    err.payload = {
      labs: matches.map((u) => ({ nomeFantasia: u.tenant.nomeFantasia, cnpj: u.tenant.cnpj })),
    };
    throw err;
  }

  const user = matches[0];
  return { token: buildToken(user), user: publicUser(user) };
}

async function me(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, tenantId: true, active: true },
  });
  if (!user || !user.active) {
    const err = new Error('Usuário inativo');
    err.status = 401;
    throw err;
  }
  const { active, ...rest } = user;
  return rest;
}

module.exports = { login, me };
