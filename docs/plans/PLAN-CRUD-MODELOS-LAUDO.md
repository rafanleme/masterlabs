# Plano de Implementação — CRUD de Modelos de Laudo

**Data**: 2026-05-08  
**PRD**: docs/prd/PRD-CRUD-MODELOS-LAUDO.md  
**Status**: Aprovado

---

## Resumo

CRUD de modelos de laudo — catálogo por tenant que define tipo e composição ordenada de um relatório laboratorial. Junction table `ReportTemplateAssay` com campo `ordem` (Int).

## Schema Prisma

- Novo model `ReportTemplate`: nome, descricao, soft delete, @@unique([tenantId, nome])
- Novo model `ReportTemplateAssay`: junction com ordem + @@unique([reportTemplateId, assayId])
- Adicionar `reportTemplates ReportTemplate[]` em Tenant
- Adicionar `reportTemplates ReportTemplateAssay[]` em Assay

## Arquivos a criar

```
src/modules/report-templates/report-templates.validation.js
src/modules/report-templates/report-templates.service.js
src/modules/report-templates/report-templates.controller.js
src/modules/report-templates/report-templates.routes.js
tests/integration/report-templates.test.js
docs/context/modelos-laudo.md
docs/plans/PLAN-CRUD-MODELOS-LAUDO.md  ← este arquivo
```

## Arquivos a modificar

- `prisma/schema.prisma` — 2 models + 2 relações
- `src/app.js` — registrar /api/v1/report-templates
- `postman/MasterLabs-API.postman_collection.json` — pasta Report Templates + {{reportTemplateId}}

## Decisões de design

- Validação de ownership: findMany + count === assayIds.length antes de persistir
- PATCH atômico: $transaction([deleteMany, createMany]) quando assayIds enviado
- Listagem: _count.assays → assayCount (sem buscar registros)
- GET by ID: include assays ordenados por ordem ASC com dados do ensaio
- Teardown: reportTemplateAssay → reportTemplate → assay → user → tenant

## Sequência

1. Migration Prisma
2. Validation (Zod + superRefine para duplicatas)
3. Service
4. Controller
5. Routes + app.js
6. Testes de integração
7. Context doc + Postman
