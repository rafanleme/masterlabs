# Plano de Implementação — Atendimentos + Amostras

**Data**: 2026-05-02  
**PRDs de referência**: docs/prd/PRD-CRUD-ATENDIMENTOS.md · docs/prd/PRD-CRUD-AMOSTRAS.md  
**Status**: Aguardando confirmação

---

## 2.1 — Resumo

Implementar dois módulos em sequência: **Atendimentos** (ordem de serviço que agrupa amostras) e **Amostras** (material coletado vinculado ao atendimento). Ambos têm ciclo de vida com endpoint dedicado de transição de status e número sequencial auto-gerado por tenant+ano (`0001/2026`).

---

## 2.2 — Alterações no Schema Prisma

| Alteração | Tipo | Observação |
|-----------|------|------------|
| Enum `StatusAtendimento` (ABERTO, EM_ANDAMENTO, ENCERRADO, CANCELADO) | Novo | Sem breaking change |
| Enum `TipoColeta` (IN_LOCO, ENTREGA_NO_LABORATORIO) | Novo | Sem breaking change |
| Enum `StatusAmostra` (RECEBIDA, EM_ANALISE, CANCELADA, REJEITADA, CONCLUIDA) | Novo | Sem breaking change |
| Model `Attendance` com 10 campos + índices | Novo | Migration sem dados sensíveis |
| Model `Sample` com 14 campos + índices | Novo | Depende de `Attendance` |
| Relações `attendances` e `samples` em `Tenant` e `Client` | Alteração | Apenas lado virtual |

---

## 2.3 — Arquivos a criar

```
src/modules/attendances/
├── attendances.routes.js      — 6 rotas (CRUD + status)
├── attendances.controller.js  — create, list, getById, update, updateStatus, remove
├── attendances.service.js     — lógica + número sequencial + transições de status
└── attendances.validation.js  — createSchema, updateSchema, statusSchema

src/modules/samples/
├── samples.routes.js          — 6 rotas (CRUD + status)
├── samples.controller.js      — create, list, getById, update, updateStatus, remove
├── samples.service.js         — lógica + número sequencial + transições de status
└── samples.validation.js      — createSchema, updateSchema, statusSchema

tests/integration/
├── attendances.test.js        — ~22 casos de teste
└── samples.test.js            — ~22 casos de teste

docs/context/
├── atendimentos.md
└── amostras.md
```

---

## 2.4 — Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | 3 enums + 2 models + relações em Tenant e Client |
| `src/app.js` | Registrar `/api/v1/attendances` e `/api/v1/samples` |
| `postman/MasterLabs-API.postman_collection.json` | Adicionar pastas Attendances e Samples com variáveis `{{attendanceId}}` e `{{sampleId}}` |

---

## 2.5 — Dependências externas novas

Nenhuma. Tudo que é necessário já está instalado.

---

## 2.6 — Sequência de implementação

**Bloco 1 — Atendimentos**
1. Schema Prisma (enums + Attendance + relações)
2. `attendances.validation.js`
3. `attendances.service.js`
4. `attendances.controller.js`
5. `attendances.routes.js` + registro em `app.js`
6. `tests/integration/attendances.test.js`
7. `docs/context/atendimentos.md`

**Bloco 2 — Amostras**
8. Schema Prisma (enums + Sample + relações) — migration única com tudo
9. `samples.validation.js`
10. `samples.service.js`
11. `samples.controller.js`
12. `samples.routes.js` + registro em `app.js`
13. `tests/integration/samples.test.js`
14. `docs/context/amostras.md`

**Bloco 3 — Finalização**
15. Atualização da collection Postman

---

## 2.7 — Riscos e decisões de design

**Número sequencial por tenant+ano**
Gerado dentro de `$transaction` usando `findFirst` com `orderBy: { numeroAtendimento: 'desc' }` filtrando pelo sufixo `/ANO`. Mais simples e confiável que `MAX()` com parsing SQL. Sem risco de duplicata pois a transaction garante atomicidade. O `@@unique([tenantId, numeroAtendimento])` no schema é a segunda camada de segurança.

**Endpoint dedicado de status (`PATCH /:id/status`)**
Separa a validação de transição (lógica de negócio complexa) da edição de campos. Retorna `422` para transições inválidas — diferente do `400` de validação de schema.

**Mapa de transições como constante no service**
```js
const TRANSITIONS = {
  ABERTO:       ['EM_ANDAMENTO', 'CANCELADO'],
  EM_ANDAMENTO: ['ENCERRADO', 'CANCELADO'],
  ENCERRADO:    [],
  CANCELADO:    [],
};
```

**Isolamento em cascata**
Ao buscar uma amostra por ID, o service verifica `tenantId` diretamente na query — não confia que o `attendanceId` já pertença ao tenant. Toda query inclui `tenantId` no `where`.

**Teardown dos testes**
Ordem obrigatória para respeitar foreign keys:
`samples → attendances → clients → users → tenants`
