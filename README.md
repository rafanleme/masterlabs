# MasterLabs API

SaaS multi-tenant de emissão de laudos laboratoriais — Node.js + Express + Prisma (MySQL).

Funcionalidades: cadastros (clientes, atendimentos, amostras, ensaios, modelos de laudo), emissão de laudos com conformidade, geração de PDF versionado em storage externo, gestão de usuários com papéis, portal do cliente com login por código de e-mail (magic code), auditoria, rate limiting e exportações CSV.

## Pré-requisitos

- Node.js 20.x
- MySQL 5.7+ (externo)

## Variáveis de ambiente

| Variável         | Descrição                  | Padrão       |
|------------------|----------------------------|--------------|
| `MYSQL_HOST`     | Host do servidor MySQL     | —            |
| `MYSQL_PORT`     | Porta do MySQL             | `3306`       |
| `MYSQL_DB`       | Nome do banco de dados     | —            |
| `MYSQL_USER`     | Usuário do MySQL           | —            |
| `MYSQL_PASSWORD` | Senha do MySQL             | —            |
| `PORT`           | Porta da API               | `3000`       |
| `NODE_ENV`       | Ambiente                   | `development`|
| `LOG_LEVEL`      | Nível de log               | `info`       |
| `DATABASE_URL`   | URL Prisma do MySQL        | —            |
| `JWT_SECRET`     | Segredo dos tokens JWT     | —            |
| `STORAGE_BASE_URL` / `STORAGE_API_KEY` | Storage API dos PDFs | — |
| `CORS_ORIGINS`   | Origens CORS (CSV; vazio = todas) | vazio |
| `RATE_LIMIT_*`   | Rate limiting (habilitado em produção) | ver `.env.example` |
| `SMTP_*` / `MAIL_FROM` | SMTP dos e-mails do portal (sem `SMTP_HOST`, códigos só são logados) | — |
| `PORTAL_*`       | TTL/limites do magic code do portal | ver `.env.example` |

Em desenvolvimento, copie `.env.example` para `.env.development` e preencha os valores.

## Executar localmente

```bash
npm install
npm start        # produção
npm run dev      # desenvolvimento com hot reload
```

## Endpoints

A documentação completa está no Swagger UI (`/swagger`, fora de produção) e no spec `/swagger.json` (sempre disponível). Visão geral:

| Área | Base path | Descrição |
|------|-----------|-----------|
| Health | `/healthz`, `/healthz/db` | Healthchecks (geral e MySQL) |
| Tenants | `/api/v1/tenants/register` | Registro de laboratório + ADMIN inicial |
| Auth | `/api/v1/auth` | Login JWT (`cnpj` opcional desambigua multi-tenant) e `/me` |
| Users | `/api/v1/users` | Gestão de usuários e papéis (ADMIN) |
| Clients | `/api/v1/clients` | CRUD de clientes + `export.csv` |
| Attendances | `/api/v1/attendances` | CRUD de atendimentos + status |
| Samples | `/api/v1/samples` | CRUD de amostras + status |
| Assays | `/api/v1/assays` | CRUD de ensaios |
| Report Templates | `/api/v1/report-templates` | CRUD de modelos de laudo |
| Reports | `/api/v1/reports` | Laudos, resultados, status, PDFs versionados + `export.csv` |
| Portal | `/api/v1/portal` | Login por código de e-mail; cliente lista/baixa os próprios laudos |
| Stats | `/api/v1/stats/overview` | Volumetria do tenant |
| Audit | `/api/v1/audit-logs` | Trilha de auditoria (ADMIN) |

### Exemplo de resposta `/healthz`

```json
{
  "status": "Healthy",
  "checks": [
    {
      "name": "mysql",
      "status": "Healthy",
      "description": "MySQL connection successful",
      "duration": 42
    }
  ],
  "totalDuration": 42
}
```

## Deploy

O deploy é automático via integração Heroku ↔ GitHub:

| Branch    | Ambiente | App Heroku               |
|-----------|----------|--------------------------|
| `develop` | Stage    | `masterlabs-api-stage`   |
| `main`    | Prod     | `masterlabs-api-prod`    |

Basta dar push no branch desejado — o Heroku detecta e faz o deploy automaticamente.

### Deploy manual (primeira vez ou emergência)

```bash
# Stage
heroku git:remote -a masterlabs-api-stage
git push heroku develop:main

# Prod
heroku git:remote -a masterlabs-api-prod
git push heroku main
```
