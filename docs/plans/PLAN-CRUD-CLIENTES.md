# Plano de Implementação — CRUD de Clientes

**Data**: 2026-05-01  
**PRD de referência**: docs/prd/PRD-CRUD-CLIENTES.md  
**Status**: Aguardando confirmação

---

## 2.1 — Resumo

Implementar o CRUD completo de clientes (PF e PJ) com isolamento multi-tenant, soft delete, paginação e controle de acesso por role. É o primeiro módulo de negócio sobre a base de Tenant + Auth já existente.

---

## 2.2 — Alterações no Schema Prisma

| Alteração | Tipo | Observação |
|-----------|------|------------|
| Enum `TipoPessoa` (PF, PJ) | Novo | Sem breaking change |
| Model `Client` com 9 campos + índices | Novo | Migration sem dados sensíveis |
| Relação `clients Client[]` em `Tenant` | Alteração | Apenas lado virtual, sem coluna nova |

Não há breaking change — tabela nova, sem alterar dados existentes.

---

## 2.3 — Arquivos a criar

```
src/modules/clients/
├── clients.routes.js       — 5 rotas + authenticate + authorize por role
├── clients.controller.js   — 5 funções: create, list, getById, update, remove
├── clients.service.js      — lógica de negócio, queries Prisma, soft delete
└── clients.validation.js   — createClientSchema + updateClientSchema (Zod)

src/middlewares/
└── authorize.js            — middleware genérico de role (ADMIN, ANALYST, VIEWER)

tests/integration/
└── clients.test.js         — ~20 casos de teste com banco real

docs/context/
└── cadastro-de-clientes.md — documentação de negócio do fluxo

docs/plans/
└── PLAN-CRUD-CLIENTES.md   — este arquivo
```

---

## 2.4 — Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Adicionar enum `TipoPessoa`, model `Client`, relação em `Tenant` |
| `src/app.js` | Registrar `clientsRoutes` em `/api/v1/clients` |

---

## 2.5 — Dependências externas novas

| Pacote | Motivo | Tipo |
|--------|--------|------|
| `jest` | Framework de testes — não existe no projeto | devDependency |
| `supertest` | Chamadas HTTP nos testes de integração | devDependency |

Nenhuma dependência nova em produção.

---

## 2.6 — Sequência de implementação

1. **Schema Prisma** — enum + model + relação + índices
2. **`authorize.js`** — middleware de role (reutilizável por features futuras)
3. **`clients.validation.js`** — schemas Zod para create e update
4. **`clients.service.js`** — create, list, getById, update, softDelete
5. **`clients.controller.js`** — 5 funções chamando o service
6. **`clients.routes.js`** — rotas com authenticate + authorize + validate
7. **`app.js`** — registrar o router
8. **`tests/integration/clients.test.js`** — ~20 casos de teste
9. **`docs/context/cadastro-de-clientes.md`** — documentação de negócio

---

## 2.7 — Riscos e decisões de design

**`authorize.js` como novo middleware**  
O projeto não tem controle de role implementado ainda. Criarei um middleware `authorize(...roles)` que verifica `req.user.role` e retorna 403 se insuficiente. Será reutilizado por todas as features seguintes (amostras, ensaios, laudos).

**Validação de query params**  
O `validate.js` atual só valida `req.body`. Para paginação e filtros do GET, o parsing e validação dos query params (`page`, `pageSize`, `tipoPessoa`, `search`) serão feitos no service, com defaults aplicados lá mesmo — sem modificar o middleware existente.

**Unicidade de documento**  
O índice `@@unique([tenantId, documento])` no Prisma lançará `PrismaClientKnownRequestError` (código `P2002`) em caso de conflito. O service captura esse erro e relança como 409.

**Soft delete invisível**  
Todas as queries do service incluem `deletedAt: null` no `where` — listagem, busca por ID, update e delete verificam isso. Um cliente deletado é tratado como inexistente em toda a API.

**Instalação de jest + supertest**  
Precisarei instalar como devDependencies antes de criar os testes. Confirmarei antes de rodar o install.
