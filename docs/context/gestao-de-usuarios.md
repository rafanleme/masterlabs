# Contexto — Gestão de Usuários

**Última atualização**: 2026-09-03

---

## O que é este fluxo

Cada laboratório (tenant) tem sua própria equipe. O usuário ADMIN é criado automaticamente no registro do tenant; a partir dele, este fluxo permite provisionar e administrar os demais usuários com papéis:

| Papel | Pode |
|-------|------|
| `ADMIN` | Tudo, incluindo gestão de usuários, exclusões e auditoria |
| `ANALYST` | Criar/editar cadastros, laudos e gerar PDFs |
| `VIEWER` | Apenas leitura (listas, consultas, downloads) |

## Endpoints

Todos exigem token de `ADMIN` e operam apenas no tenant do token:

- `POST /api/v1/users` — cria usuário (name, email, password ≥ 8 chars, role; default `ANALYST`)
- `GET /api/v1/users` — lista paginada, filtros `role`, `active`, `search`
- `GET /api/v1/users/:id`
- `PATCH /api/v1/users/:id` — name, password, role, active
- `DELETE /api/v1/users/:id` — desativa (soft; `active = false`)

## Regras de negócio

- **RN-01**: e-mail é único por tenant (`@@unique([tenantId, email])`); o mesmo e-mail pode existir em outros laboratórios.
- **RN-02**: usuário não pode alterar o próprio papel nem desativar a si mesmo (evita tenant sem ADMIN por acidente) — `422`.
- **RN-03**: usuário desativado não consegue mais fazer login nem usar `/auth/me`. Tokens JWT já emitidos continuam válidos até expirar (verificação é stateless); a desativação vale para novos logins.
- **RN-04**: hash de senha (bcrypt) nunca aparece em nenhuma resposta.

## Login multi-tenant

Como o e-mail não é globalmente único, o login (`POST /api/v1/auth/login`) aceita `cnpj` opcional:

1. Sem `cnpj`: se as credenciais valem em exatamente um tenant, loga normalmente.
2. Se valem em mais de um tenant, retorna `409` com `labs: [{ nomeFantasia, cnpj }]` — o front deve pedir ao usuário para escolher e repetir o login com o `cnpj`.
