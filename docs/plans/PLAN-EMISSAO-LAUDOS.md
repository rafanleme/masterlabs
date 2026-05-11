# Plano de Implementação — Emissão de Laudos

**Data**: 2026-05-10  
**PRD**: docs/prd/PRD-EMISSAO-LAUDOS.md  
**Status**: Aprovado

---

## Resumo

CRUD completo de laudos emitidos. Vincula Amostra + Modelo de Laudo, cria items automáticos por ensaio, calcula conformidade automaticamente ao registrar resultados e gerencia lifecycle RASCUNHO → EMITIDO | CANCELADO.

## Schema Prisma

- Enum `StatusLaudo`: RASCUNHO, EMITIDO, CANCELADO
- Enum `Conformidade`: CONFORME, NAO_CONFORME, INCONCLUSIVO
- Model `Report`: cabeçalho + número sequencial + lifecycle
- Model `ReportItem`: valor (String) + valorNumerico (Float?) + conformidade calculada
- Relações reversas: Tenant, Sample, ReportTemplate, Assay

## Arquivos a criar

```
src/modules/reports/reports.validation.js
src/modules/reports/reports.service.js
src/modules/reports/reports.controller.js
src/modules/reports/reports.routes.js
tests/integration/reports.test.js
docs/context/laudos-emitidos.md
docs/plans/PLAN-EMISSAO-LAUDOS.md  ← este arquivo
```

## Arquivos a modificar

- `prisma/schema.prisma` — 2 enums + 2 models + 4 relações
- `src/app.js` — registrar /api/v1/reports
- `postman/MasterLabs-API.postman_collection.json` — pasta Reports + {{reportId}}

## Decisões de design

- Rota aninhada `/:id/items/:assayId` — Express resolve normalmente
- `calcularConformidade(assay, valorNumerico)` — função pura no service
- Edição bloqueada em não-RASCUNHO → 422
- Soft delete bloqueado em EMITIDO → 422
- Teardown: reportItem → report → reportTemplateAssay → reportTemplate → assay → sample → attendance → client → user → tenant

## Sequência

1. Migration Prisma
2. Validation
3. Service
4. Controller
5. Routes + app.js
6. Testes
7. Context doc + Postman
