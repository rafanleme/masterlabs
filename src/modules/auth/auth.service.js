const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const config = require('../../config');

const INVALID_CREDENTIALS = (() => {
  const err = new Error('Credenciais inválidas');
  err.status = 401;
  return err;
})();

async function login({ email, password }) {
  const user = await prisma.user.findFirst({ where: { email } });

  if (!user) throw INVALID_CREDENTIALS;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw INVALID_CREDENTIALS;

  const token = jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
  };
}

async function me(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, tenantId: true },
  });
  return user;
}

module.exports = { login, me };
