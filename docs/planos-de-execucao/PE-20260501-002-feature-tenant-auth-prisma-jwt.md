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
- **Progresso**: 9/9 etapas concluídas (100%)
- **Status**: 🟢 Concluída
- **Data de Início**: 2026-05-01
- **Data de Conclusão**: 2026-05-01
- **Responsável**: Equipe de Desenvolvimento

### Status das Etapas

| Etapa | Descrição | Status | Data Início | Data Fim | Observações |
|-------|-----------|--------|-------------|----------|-------------|
| E01 | Instalação de dependências | 🟢 Concluída | 2026-05-01 | 2026-05-01 | prisma@5, zod, bcrypt, jsonwebtoken instalados |
| E02 | Prisma init + schema (Tenant, User, Role) | 🟢 Concluída | 2026-05-01 | 2026-05-01 | Prisma v5 (v7 incompatível com CommonJS) |
| E03 | Migration + config (DATABASE_URL, JWT) | 🟢 Concluída | 2026-05-01 | 2026-05-01 | Migration init-tenant-auth aplicada |
| E04 | Infra: prisma.js, validate.js, authenticate.js | 🟢 Concluída | 2026-05-01 | 2026-05-01 | |
| E05 | Módulo Tenant (register) | 🟢 Concluída | 2026-05-01 | 2026-05-01 | POST /api/v1/tenants/register |
| E06 | Módulo Auth (login + me) | 🟢 Concluída | 2026-05-01 | 2026-05-01 | POST /api/v1/auth/login, GET /api/v1/auth/me |
| E07 | Registro das rotas em app.js | 🟢 Concluída | 2026-05-01 | 2026-05-01 | |
| E08 | Testes manuais (register, login, me, erros) | 🟢 Concluída | 2026-05-01 | 2026-05-01 | Todos os cenários validados |
| E09 | Deploy stage + prod (commit + push + Config Vars + migration) | 🟢 Concluída | 2026-05-01 | 2026-05-01 | Stage e prod validados |

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

> **Nota**: Prisma v7 (latest) é incompatível com projetos CommonJS — usa ESM e exige driver adapter. Fixado em v5.

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

- Adicionar `DATABASE_URL` ao `.env` (Prisma CLI) e `.env.development` (runtime)
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

Atualizado `src/app.js`:
```js
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/auth',    authRoutes);
```

---

### E08 — Testes manuais

Todos os cenários validados localmente:
- Register → 201 com tenant + JWT ✅
- Login → 200 com token + user ✅
- Me → 200 com dados do usuário ✅
- CNPJ duplicado → 409 ✅
- Senha errada → 401 genérico ✅
- Token ausente → 401 ✅
- Body inválido → 400 com erros por campo ✅

---

### E09 — Deploy Stage + Prod

**Stage** (`masterlabs-api-stage`):
- Config Vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` ✅
- Migration aplicada: `npx prisma migrate deploy` ✅
- Endpoints validados em `masterlabs-api-stage-c4083c2d2c34.herokuapp.com` ✅

**Prod** (`masterlabs-api-prod`):
- Config Vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` ✅
- Migration aplicada: `npx prisma migrate deploy` ✅
- Endpoints validados em `masterlabs-api-prod-c626b104c95e.herokuapp.com` ✅

---

## Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | URL de conexão Prisma | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Chave de assinatura JWT | string longa e aleatória |
| `JWT_EXPIRES_IN` | Expiração do token | `7d` |

## Critérios de Aceite

- [x] `POST /api/v1/tenants/register` cria Tenant + User Admin e retorna JWT
- [x] `POST /api/v1/auth/login` autentica e retorna JWT
- [x] `GET /api/v1/auth/me` retorna dados do usuário logado
- [x] CNPJ duplicado retorna 409
- [x] Senha errada retorna 401 sem expor qual campo falhou
- [x] Token ausente/inválido retorna 401
- [x] Body inválido retorna 400 com erros por campo
- [x] Deploy funcionando no stage com migration aplicada
- [x] Deploy funcionando no prod com migration aplicada

## 📝 Log de Atualizações

| Data | Etapa | Status Anterior | Status Novo | Observações |
|------|-------|-----------------|-------------|-------------|
| 2026-05-01 | — | — | 🔵 Em Andamento | Plano criado |
| 2026-05-01 | E01–E08 | ⏳ Pendente | 🟢 Concluída | Implementação completa e testes locais |
| 2026-05-01 | E09 | ⏳ Pendente | 🟢 Concluída | Deploy stage + prod + migrations aplicadas |
