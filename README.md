# MasterLabs API

API base em Node.js + Express com healthchecks e observabilidade.

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

Em desenvolvimento, copie `.env.example` para `.env.development` e preencha os valores.

## Executar localmente

```bash
npm install
npm start        # produção
npm run dev      # desenvolvimento com hot reload
```

## Endpoints

| Método | Path          | Descrição                          |
|--------|---------------|------------------------------------|
| GET    | `/healthz`    | Healthcheck geral (inclui MySQL)   |
| GET    | `/healthz/db` | Healthcheck exclusivo do MySQL     |
| GET    | `/swagger`    | Swagger UI (apenas fora de produção) |

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
