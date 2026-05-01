# Documento Balizador — Arquitetura e Tecnologias

**Versão**: 2.0
**Data**: 2026-05-01
**Status**: Aprovado

> **Nota**: Versão 1.0 descrevia stack .NET 8. Migrado para Node.js em 2026-05-01.

---

## Objetivo

Estabelecer decisões técnicas e de arquitetura para o MVP do sistema SaaS de laudos laboratoriais, usando Node.js, MySQL (HostGator) e deploy no Heroku.

---

## 1) Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Runtime** | Node.js 20.x |
| **Framework HTTP** | Express 5 |
| **ORM** | Prisma v5 + MySQL |
| **Banco de dados** | MySQL (HostGator) |
| **Validações** | Zod |
| **Autenticação** | JWT (`jsonwebtoken`) + bcrypt |
| **Logging** | Winston (JSON estruturado, Console sink) |
| **Observabilidade** | Healthchecks (`/healthz`, `/healthz/db`), X-Correlation-ID |
| **E-mail** | SMTP (a definir: Nodemailer + TLS) |
| **PDFs** | A definir (ex: PDFKit, Puppeteer) |
| **Assinatura Digital ICP-Brasil** | A definir (ex: Rest PKI / Lacuna) |
| **Armazenamento de arquivos** | SFTP próprio (HostGator) |
| **Documentação API** | Swagger UI (`swagger-ui-express` + `swagger-jsdoc`) |

---

## 2) Arquitetura (Monólito Modular)

```
src/
├── modules/          # Um diretório por domínio
│   ├── tenant/       # routes, controller, service, validation
│   ├── auth/
│   ├── clients/      # (próxima feature)
│   ├── assays/
│   ├── samples/
│   ├── reports/
│   └── portal/       # Portal do cliente (OTP)
├── middlewares/      # authenticate, validate, correlationId, httpLogger, errorHandler
├── lib/              # prisma.js (singleton)
├── health/           # healthRouter, mysqlCheck
├── config/           # index.js (env vars)
├── app.js
└── server.js
```

Padrão por módulo: `routes → controller → service`. Sem camada de repositório explícita (Prisma serve como ORM e query builder).

---

## 3) Multi-tenant (Isolamento por Linha)

- Coluna `tenantId` em todas as tabelas de negócio
- `tenantId` extraído do JWT em cada request e injetado via `req.user.tenantId`
- Todas as queries de negócio filtram por `tenantId` — responsabilidade do service
- Índices por `tenantId` em todas as tabelas relevantes

---

## 4) Autenticação e Autorização

- **Painel do laboratório**: JWT Bearer; roles `ADMIN`, `ANALYST`, `VIEWER`
- **Portal do Cliente**: OTP via e-mail com TTL curto; troca por token de sessão limitado
- Middleware `authenticate.js`: valida token, injeta `req.user = { userId, tenantId, role }`
- Segredos em Heroku Config Vars — nunca no repositório

---

## 5) Modelo de Dados (alto nível)

```
Tenant          — Empresa/Laboratório
User            — multi-tenant, roles (ADMIN/ANALYST/VIEWER)
Client          — paciente, vinculado ao Tenant
Sample          — amostra, vinculada ao Client
Assay           — ensaio/exame (catálogo por Tenant)
Report          — laudo, vinculado a Client + Sample
ReportAssay     — N:N entre Report e Assay, com resultados
PdfArtifact     — metadados: hash SHA-256, caminho SFTP, estado de assinatura
OtpLogin        — portal do cliente (email + código + TTL)
```

---

## 6) PDFs e Assinatura Digital

- Pipeline: gerar PDF → upload SFTP → assinar (ICP-Brasil) → atualizar metadados → disponibilizar link
- Assinatura PAdES-B/LTV com TSA (RFC 3161)
- Integridade: SHA-256 armazenado e verificado após upload/download

---

## 7) Segurança, LGPD e Compliance

- TLS em trânsito; credenciais em Config Vars (Heroku)
- Logs sem PII exposto (masking)
- Auditoria de acesso a laudos (por tenant)
- Backups automáticos MySQL (HostGator)

---

## 8) Qualidade e Testes

- Testes unitários e de integração: **Jest** (a configurar)
- Variáveis de ambiente separadas por ambiente (`.env.development`, Config Vars no Heroku)
- Healthchecks em `/healthz` e `/healthz/db`

---

## 9) Entrega Contínua e Infra

- **Deploy**: Heroku (sem Docker) via git push + Procfile
- **Branch strategy**: `develop` → stage | `main` → prod
- **CI/CD**: integração GitHub ↔ Heroku (auto-deploy por branch)
- **Banco**: MySQL na HostGator
  - Stage: `rtisol43_master_labs_stage`
  - Prod: `rtisol43_master_labs_db`
- **Migrations**: `npx prisma migrate deploy` rodado manualmente no Heroku após cada deploy

> **Nota sobre conectividade**: IPs de saída do Heroku são dinâmicos. Se a HostGator exigir whitelist, avaliar egress IP estático ou túnel seguro.

---

## 10) Diretrizes de API

- REST com versionamento `/api/v1/`
- Erros no padrão RFC 7807 (ProblemDetails): `type`, `title`, `status`, `detail`, `instance`, `correlationId`
- Paginação: `page`, `pageSize` + validação de campos (a implementar)
- CORS restrito (a configurar)
- X-Correlation-ID em todos os requests

---

## 11) Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL de conexão Prisma/MySQL |
| `JWT_SECRET` | Chave de assinatura JWT |
| `JWT_EXPIRES_IN` | Expiração do token (ex: `7d`) |
| `MYSQL_HOST` | Host MySQL (healthcheck legado) |
| `MYSQL_PORT` | Porta MySQL |
| `MYSQL_DB` | Banco de dados |
| `MYSQL_USER` | Usuário MySQL |
| `MYSQL_PASSWORD` | Senha MySQL |
| `PORT` | Porta da API (Heroku injeta automaticamente) |
| `NODE_ENV` | Ambiente (`development` / `production`) |
| `LOG_LEVEL` | Nível de log (`debug` / `info`) |
