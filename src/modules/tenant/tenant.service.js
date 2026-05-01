const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const config = require('../../config');

async function registerTenant({ razaoSocial, nomeFantasia, cnpj, email, telefone, endereco, adminName, adminEmail, adminPassword }) {
  const existing = await prisma.tenant.findFirst({
    where: { OR: [{ cnpj }, { email }] },
  });

  if (existing) {
    const field = existing.cnpj === cnpj ? 'CNPJ' : 'e-mail';
    const err = new Error(`${field} já cadastrado`);
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const { tenant, user } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { razaoSocial, nomeFantasia, cnpj, email, telefone, endereco },
    });

    const user = await tx.user.create({
      data: { tenantId: tenant.id, name: adminName, email: adminEmail, passwordHash, role: 'ADMIN' },
    });

    return { tenant, user };
  });

  const token = jwt.sign(
    { userId: user.id, tenantId: tenant.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    tenant: { id: tenant.id, razaoSocial: tenant.razaoSocial, nomeFantasia: tenant.nomeFantasia, cnpj: tenant.cnpj, email: tenant.email },
    token,
  };
}

module.exports = { registerTenant };
