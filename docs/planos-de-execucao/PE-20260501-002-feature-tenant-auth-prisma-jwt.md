# Plano de Execução — PE-20260501-002

**Identificador**: PE-20260501-002
**Descrição**: Feature 01 — Tenant + Auth (Prisma + JWT)
**Data**: 2026-05-01

## Objetivo

Implementar o alicerce do sistema multi-tenant:
- Setup do Prisma ORM com MySQL
- Módulo Tenant: cadastro de laboratório com primeiro usuário Admin
- Módulo Auth: login JWT para o painel do laboratório
- Middlewares de autenticação e validação reutilizáveis por todas as features seguintes

## 📊 Acompanhamento de Progresso

### Status Geral
- **Progresso**: 0/9 etapas concluídas (0%)
- **Status**: 🔵 Em Andamento
- **Data de Início**: 2026-05-01
- **Data de Conclusão**: ___________
- **Responsável**: Equipe de Desenvolvimento

### Status das Etapas

| Etapa | Descrição | Status | Data Início | Data Fim | Observações |
|-------|-----------|--------|-------------|----------|-------------|
| E01 | Instalação de dependências | ⏳ Pendente | | | prisma, zod, bcrypt, jsonwebtoken |
| E02 | Prisma init + schema (Tenant, User, Role) | ⏳ Pendente | | | |
| E03 | Migration + config (DATABASE_URL, JWT) | ⏳ Pendente | | | |
| E04 | Infra: prisma.js, validate.js, authenticate.js | ⏳ Pendente | | | |
| E05 | Módulo Tenant (register) | ⏳ Pendente | | | POST /api/v1/tenants/register |
| E06 | Módulo Auth (login + me) | ⏳ Pendente | | | POST /api/v1/auth/login, GET /api/v1/auth/me |
| E07 | Registro das rotas em app.js | ⏳ Pendente | | | |
| E08 | Testes manuais (register, login, me, erros) | ⏳ Pendente | | | |
| E09 | Deploy stage (commit + push + Config Vars + migration) | ⏳ Pendente | | | |

### Legenda de Status
- 🟡 **Aguardando**: Etapa não iniciada
- 🔵 **Em Andamento**: Etapa sendo executada
- 🟢 **Concluída**: Etapa finalizada com sucesso
- 🔴 **Bloqueada**: Etapa com impedimentos
- ⚠️ **Com Problemas**: Etapa concluída com issues
- ⏭️ **Pulada**: Etapa não necessária

---

## Etapas

### E01 — Instalação de dependências

```bash
npm install @prisma/client zod bcrypt jsonwebtoken
npm install -D prisma
```

---

### E02 — Prisma init + Schema

```bash
npx prisma init
```

**`prisma/schema.prisma`**:
- Model `Tenant`: id (cuid), razaoSocial, nomeFantasia, cnpj (unique), email (unique), telefone?, endereco?, timestamps
- Model `User`: id (cuid), tenantId (FK), name, email, passwordHash, role (enum), timestamps; unique([tenantId, email])
- Enum `Role`: ADMIN, ANALYST, VIEWER

---

### E03 — Migration + Config

- Adicionar `DATABASE_URL` ao `.env.development`
- Adicionar `JWT_SECRET` e `JWT_EXPIRES_IN` ao `.env.development`
- Atualizar `src/config/index.js` com bloco `jwt`
- Rodar: `npx prisma migrate dev --name init-tenant-auth`

---

### E04 — Infra

- `src/lib/prisma.js`: singleton PrismaClient
- `src/middlewares/validate.js`: middleware genérico Zod — valida req.body, retorna 400 com fieldErrors
- `src/middlewares/authenticate.js`: verifica Bearer JWT, injeta req.user = { userId, tenantId, role }, retorna 401 se inválido

---

### E05 — Módulo Tenant

**`POST /api/v1/tenants/register`** — pública

Body: razaoSocial, nomeFantasia, cnpj (14 dígitos), email, telefone?, endereco?, adminName, adminEmail, adminPassword (min 8)

Lógica:
1. Verificar duplicidade de CNPJ ou email → 409
2. Hash bcrypt (rounds 10)
3. `prisma.$transaction`: criar Tenant + User (ADMIN)
4. Gerar JWT
5. Retornar 201 com `{ tenant, token }`

---

### E06 — Módulo Auth

**`POST /api/v1/auth/login`** — pública

Body: email, password

Lógica:
1. Buscar user por email
2. Verificar bcrypt — falha → 401 genérico (não expor qual campo)
3. Gerar JWT
4. Retornar `{ token, user: { id, name, email, role, tenantId } }`

**`GET /api/v1/auth/me`** — protegida (authenticate middleware)

Retorna dados do usuário do `req.user`.

---

### E07 — Registro das rotas

Atualizar `src/app.js`:
```js
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/auth',    authRoutes);
```

---

### E08 — Testes manuais

```bash
# Register
curl -X POST http://localhost:3000/api/v1/tenants/register -H "Content-Type: application/json" \
  -d '{"razaoSocial":"Lab Teste","nomeFantasia":"Lab","cnpj":"12345678000195","email":"lab@teste.com","adminName":"Admin","adminEmail":"admin@teste.com","adminPassword":"senha1234"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@teste.com","password":"senha1234"}'

# Me
curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer <token>"
```

Cenários de erro: CNPJ duplicado → 409 | Senha errada → 401 | Token ausente → 401 | Body inválido → 400

---

### E09 — Deploy Stage

1. `git add . && git commit -m "feat: E01-E08 - Tenant + Auth (Prisma + JWT)"`
2. `git push origin develop`
3. Setar Config Vars no Heroku stage: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`
4. `heroku run npx prisma migrate deploy -a masterlabs-api-stage`
5. Validar endpoints em produção

---

## Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | URL de conexão Prisma | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Chave de assinatura JWT | string longa e aleatória |
| `JWT_EXPIRES_IN` | Expiração do token | `7d` |

## Critérios de Aceite

- [ ] `POST /api/v1/tenants/register` cria Tenant + User Admin e retorna JWT
- [ ] `POST /api/v1/auth/login` autentica e retorna JWT
- [ ] `GET /api/v1/auth/me` retorna dados do usuário logado
- [ ] CNPJ duplicado retorna 409
- [ ] Senha errada retorna 401 sem expor qual campo falhou
- [ ] Token ausente/inválido retorna 401
- [ ] Body inválido retorna 400 com erros por campo
- [ ] Deploy funcionando no stage com migration aplicada

## 📝 Log de Atualizações

| Data | Etapa | Status Anterior | Status Novo | Observações |
|------|-------|-----------------|-------------|-------------|
| 2026-05-01 | — | — | 🔵 Em Andamento | Plano criado |
