# Plano de Implementação — CRUD de Ensaios

**Data**: 2026-05-06  
**PRD**: docs/prd/PRD-CRUD-ENSAIOS.md  
**Status**: Aprovado

---

## Resumo

CRUD completo do catálogo de ensaios analíticos por tenant. Sem dependências de Clientes/Atendimentos/Amostras — é uma entidade de catálogo pura consumida futuramente pela feature de Laudos.

## Schema Prisma

- Novo enum `TipoComparacao`: MENOR_QUE, MAIOR_QUE, MENOR_IGUAL, MAIOR_IGUAL, ENTRE, TEXTO
- Novo model `Assay`: 12 campos + relação Tenant + 2 índices + @@unique([tenantId, nome])
- Adicionar `assays Assay[]` no model `Tenant`

## Arquivos a criar

```
src/modules/assays/assays.validation.js
src/modules/assays/assays.service.js
src/modules/assays/assays.controller.js
src/modules/assays/assays.routes.js
tests/integration/assays.test.js
docs/context/ensaios.md
docs/plans/PLAN-CRUD-ENSAIOS.md  ← este arquivo
```

## Arquivos a modificar

- `prisma/schema.prisma` — enum + model + relação
- `src/app.js` — registrar /api/v1/assays
- `postman/MasterLabs-API.postman_collection.json` — pasta Assays + {{assayId}}

## Sequência

1. Migration Prisma
2. assays.validation.js (Zod + superRefine)
3. assays.service.js
4. assays.controller.js
5. assays.routes.js + app.js
6. assays.test.js
7. docs/context/ensaios.md + Postman
