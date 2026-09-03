const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const config = require('../../src/config');

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
    razaoSocial: `UserLab ${suffix}`, nomeFantasia: `UserLab ${suffix}`,
    cnpj: uniqueCnpj(), email: `userlab${ts}@test.com`,
    adminName: 'Admin', adminEmail: `useradmin${ts}@test.com`, adminPassword: 'senha1234',
  });
}

describe('Users — Gestão de usuários', () => {
  let tenantId, adminToken, adminUserId;
  let tenant2Id, admin2Token;

  beforeAll(async () => {
    const r1 = await registerTenant('A');
    tenantId    = r1.body.tenant.id;
    adminToken  = r1.body.token;
    adminUserId = jwt.decode(adminToken).userId;

    const r2 = await registerTenant('B');
    tenant2Id   = r2.body.tenant.id;
    admin2Token = r2.body.token;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantId, tenant2Id] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, tenant2Id] } } });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/users', () => {
    it('ADMIN cria ANALYST e a resposta não expõe hash de senha', async () => {
      const res = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ana Analista', email: `ana-${Date.now()}@test.com`, password: 'senha1234', role: 'ANALYST' });

      expect(res.status).toBe(201);
      expect(res.body.role).toBe('ANALYST');
      expect(res.body.active).toBe(true);
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.password).toBeUndefined();
    });

    it('usuário criado consegue logar e acessar /auth/me', async () => {
      const email = `login-${Date.now()}@test.com`;
      await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Login User', email, password: 'senha1234', role: 'VIEWER' });

      const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'senha1234' });
      expect(login.status).toBe(200);
      expect(login.body.user.role).toBe('VIEWER');

      const me = await request(app).get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.token}`);
      expect(me.status).toBe(200);
      expect(me.body.email).toBe(email);
    });

    it('retorna 409 para e-mail duplicado no mesmo tenant', async () => {
      const email = `dup-${Date.now()}@test.com`;
      await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Original', email, password: 'senha1234' });

      const res = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Duplicado', email, password: 'senha1234' });

      expect(res.status).toBe(409);
    });

    it('mesmo e-mail pode existir em outro tenant', async () => {
      const email = `cross-${Date.now()}@test.com`;
      const res1 = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Tenant 1', email, password: 'senha1234' });
      const res2 = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ name: 'Tenant 2', email, password: 'senha1234' });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });

    it('retorna 400 para senha curta', async () => {
      const res = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Senha Curta', email: `curta-${Date.now()}@test.com`, password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('password');
    });

    it('retorna 403 quando ANALYST tenta criar usuário', async () => {
      const res = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${makeToken(tenantId, 'ANALYST', adminUserId)}`)
        .send({ name: 'Bloqueado', email: `blk-${Date.now()}@test.com`, password: 'senha1234' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/users', () => {
    it('lista apenas usuários do tenant, com paginação', async () => {
      const res = await request(app).get('/api/v1/users?page=1&pageSize=50')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.data.length).toBeGreaterThan(0);
      const ids2 = (await request(app).get('/api/v1/users?pageSize=50')
        .set('Authorization', `Bearer ${admin2Token}`)).body.data.map((u) => u.id);
      const intersection = res.body.data.map((u) => u.id).filter((id) => ids2.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('filtra por role', async () => {
      const res = await request(app).get('/api/v1/users?role=ADMIN')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.forEach((u) => expect(u.role).toBe('ADMIN'));
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('retorna 404 para usuário de outro tenant', async () => {
      const res = await request(app).get(`/api/v1/users/${adminUserId}`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    let targetId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Para Editar', email: `edit-${Date.now()}@test.com`, password: 'senha1234' });
      targetId = res.body.id;
    });

    it('atualiza nome e role de outro usuário', async () => {
      const res = await request(app).patch(`/api/v1/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Editado', role: 'VIEWER' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Editado');
      expect(res.body.role).toBe('VIEWER');
    });

    it('retorna 422 ao tentar alterar o próprio papel', async () => {
      const res = await request(app).patch(`/api/v1/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'VIEWER' });

      expect(res.status).toBe(422);
    });

    it('troca de senha permite login com a nova senha', async () => {
      const email = `newpass-${Date.now()}@test.com`;
      const created = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Nova Senha', email, password: 'senha1234' });

      await request(app).patch(`/api/v1/users/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'outrasenha99' });

      const oldLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'senha1234' });
      const newLogin = await request(app).post('/api/v1/auth/login').send({ email, password: 'outrasenha99' });
      expect(oldLogin.status).toBe(401);
      expect(newLogin.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('retorna 422 ao tentar desativar a si mesmo', async () => {
      const res = await request(app).delete(`/api/v1/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(422);
    });

    it('desativa usuário e bloqueia login dele', async () => {
      const email = `off-${Date.now()}@test.com`;
      const created = await request(app).post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Desativado', email, password: 'senha1234' });

      const del = await request(app).delete(`/api/v1/users/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(del.status).toBe(204);

      const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'senha1234' });
      expect(login.status).toBe(401);

      const fetched = await request(app).get(`/api/v1/users/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fetched.body.active).toBe(false);
    });
  });
});
