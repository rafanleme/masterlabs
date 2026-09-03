# Contexto — Auditoria e Hardening de Segurança

**Última atualização**: 2026-09-03

---

## Auditoria (`AuditLog`)

Toda mutação bem-sucedida (`POST`/`PATCH`/`PUT`/`DELETE` com status < 400) em `/api/v1/*` gera um registro assíncrono via middleware `auditLogger`:

| Campo | Conteúdo |
|-------|----------|
| `actorType` | `USER` (equipe do lab), `PORTAL_CLIENT` (cliente no portal) ou `ANONYMOUS` (registro/login) |
| `actorId` | id do usuário ou cliente |
| `tenantId` | tenant do ator (null para ações anônimas, ex.: registro de tenant) |
| `method` / `path` / `statusCode` | o quê |
| `ip` / `correlationId` / `createdAt` | de onde, rastreio e quando |

Decisões LGPD:
- **Nenhum corpo de requisição é persistido** — evita guardar dados pessoais duplicados na trilha.
- Falha na escrita da auditoria **não** derruba a requisição (logada como erro).

Consulta: `GET /api/v1/audit-logs` (apenas ADMIN, escopo do tenant) com filtros `actorType`, `actorId`, `method`, `path`, `from`, `to` e paginação.

## Hardening HTTP

- **helmet**: headers de segurança padrão.
- **CORS**: liberado por padrão; restrinja com `CORS_ORIGINS` (lista separada por vírgula).
- **Rate limiting** (`express-rate-limit`): habilitado por padrão só em produção (`RATE_LIMIT_ENABLED` força). Limite geral em `/api/v1` (300 req/15 min/IP) e limite estrito (20 req/15 min/IP) em `/api/v1/auth/login` e `/api/v1/portal/auth/*`. Em produção `trust proxy` é ativado (Heroku) para o IP real.
- **Tokens**: rotas internas rejeitam tokens do portal e vice-versa (separação por `scope`).

## Volumetria

`GET /api/v1/stats/overview` (qualquer usuário autenticado do tenant): total de clientes, atendimentos/amostras/laudos por status, total de PDFs e laudos emitidos por mês (últimos 6 meses).

## Exportações CSV

- `GET /api/v1/clients/export.csv`
- `GET /api/v1/reports/export.csv`

CSV com separador `;`, BOM UTF-8 (compatível com Excel pt-BR) e escaping RFC 4180.
