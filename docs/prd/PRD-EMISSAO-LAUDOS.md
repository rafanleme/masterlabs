# PRD — Emissão de Laudos

**Status**: Draft  
**Versão**: 1.0  
**Data**: 2026-05-10  
**Épico relacionado**: Semana 4 — Geração de Laudos (Parte 1: Dados e Conformidade)

---

## 1. Contexto e Objetivo

Um Laudo Emitido é a instância concreta de análise: um Modelo de Laudo aplicado a uma Amostra específica, com os resultados preenchidos por ensaio e a conformidade calculada automaticamente. É o principal produto entregue pelo laboratório ao cliente.

Esta feature cobre o ciclo completo de dados — criar, preencher resultados, emitir e cancelar laudos. A geração de PDF é a feature seguinte (Semana 4 — Parte 2).

## 2. Usuários Afetados

| Perfil | Ações permitidas |
|--------|-----------------|
| ADMIN | Criar, editar metadados, registrar resultados, emitir, cancelar, desativar |
| ANALYST | Criar, editar metadados, registrar resultados, emitir, cancelar |
| VIEWER | Listar e visualizar |

## 3. Requisitos Funcionais

### RF-01 — Criar laudo
**Como** ADMIN ou ANALYST, **quero** criar um laudo vinculando uma amostra a um modelo, **para** iniciar o registro de resultados analíticos.

- Critérios de aceite:
  - [ ] Campos obrigatórios: `sampleId`, `reportTemplateId`
  - [ ] Campos opcionais: `responsavel`, `observacoes`
  - [ ] Status inicial: `RASCUNHO`
  - [ ] Número de laudo gerado automaticamente no formato `0001/2026` (por tenant + ano)
  - [ ] Items criados automaticamente a partir dos ensaios do modelo, na mesma ordem, com `valor = null` e `conformidade = INCONCLUSIVO`
  - [ ] `sampleId` e `reportTemplateId` devem pertencer ao tenant — retorna `404` se inválidos
  - [ ] Retorna `201` com o laudo completo incluindo items

### RF-02 — Listar laudos com paginação
**Como** qualquer usuário autenticado, **quero** listar laudos do meu laboratório, **para** acompanhar o andamento das análises.

- Critérios de aceite:
  - [ ] Retorna apenas laudos do tenant do token
  - [ ] Não retorna registros com `deletedAt != null`
  - [ ] Suporta `page` e `pageSize` (padrão: 1/20)
  - [ ] Filtro por `?status=RASCUNHO|EMITIDO|CANCELADO`
  - [ ] Filtro por `?sampleId=<id>`
  - [ ] Retorna envelope `{ data, pagination }`
  - [ ] Listagem inclui: id, numeroLaudo, status, dataEmissao, sampleId, responsavel, createdAt

### RF-03 — Visualizar laudo por ID
**Como** qualquer usuário autenticado, **quero** ver todos os dados de um laudo, **para** consultar resultados e conformidade.

- Critérios de aceite:
  - [ ] Retorna o laudo com array `items` ordenado por `ordem ASC`
  - [ ] Cada item inclui: ordem, valor, valorNumerico, conformidade, observacoes, e dados do ensaio (id, nome, unidade, metodoAnalitico, tipoComparacao, limiteMinimo, limiteMaximo, valorReferencia)
  - [ ] Retorna `404` se não existir no tenant ou estiver soft-deletado

### RF-04 — Editar metadados do laudo
**Como** ADMIN ou ANALYST, **quero** editar responsável e observações do laudo, **para** complementar informações antes de emitir.

- Critérios de aceite:
  - [ ] Aceita `responsavel` e/ou `observacoes` (PATCH parcial)
  - [ ] Só permitido em status `RASCUNHO` — retorna `422` se `EMITIDO` ou `CANCELADO`
  - [ ] Retorna `404` se laudo não existir no tenant

### RF-05 — Registrar resultado de um item
**Como** ADMIN ou ANALYST, **quero** registrar o valor do resultado para um ensaio específico do laudo, **para** que a conformidade seja calculada automaticamente.

- Critérios de aceite:
  - [ ] Endpoint: `PATCH /api/v1/reports/:id/items/:assayId`
  - [ ] Aceita `valor` (String), `valorNumerico` (Float), `observacoes` (String) — todos opcionais
  - [ ] Só permitido em status `RASCUNHO` — retorna `422` se EMITIDO ou CANCELADO
  - [ ] `conformidade` é calculada automaticamente no service (veja RN-05)
  - [ ] Retorna `200` com o item atualizado
  - [ ] Retorna `404` se o laudo ou o assayId não existirem no laudo

### RF-06 — Emitir ou cancelar laudo
**Como** ADMIN ou ANALYST, **quero** transitar o status do laudo, **para** finalizá-lo ou cancelá-lo.

- Critérios de aceite:
  - [ ] Endpoint: `PATCH /api/v1/reports/:id/status`
  - [ ] Transições válidas: `RASCUNHO → EMITIDO`, `RASCUNHO → CANCELADO`
  - [ ] `EMITIDO` e `CANCELADO` são terminais — retorna `422` para qualquer outra transição
  - [ ] Ao emitir (`EMITIDO`): `dataEmissao` é preenchida com o timestamp atual
  - [ ] Retorna `200` com o laudo atualizado

### RF-07 — Desativar laudo (soft delete)
**Como** ADMIN, **quero** desativar um laudo, **para** removê-lo das listagens sem apagar o histórico.

- Critérios de aceite:
  - [ ] Apenas ADMIN
  - [ ] Só permitido em `RASCUNHO` ou `CANCELADO` — laudo `EMITIDO` tem valor jurídico e não pode ser desativado (retorna `422`)
  - [ ] Preenche `deletedAt` com timestamp atual
  - [ ] Retorna `204`

## 4. Requisitos Não-Funcionais

- **Segurança**: `tenantId` sempre do JWT; `sampleId` e `reportTemplateId` validados no tenant
- **Atomicidade**: criação do laudo + items em `$transaction`; geração do número sequencial em `$transaction`
- **Validações**:
  - `sampleId`: string, obrigatório
  - `reportTemplateId`: string, obrigatório
  - `responsavel`: string opcional, máx 200 chars
  - `observacoes`: string opcional, máx 2000 chars
  - `valor` (item): string opcional, máx 500 chars
  - `valorNumerico` (item): Float opcional
  - `observacoes` (item): string opcional, máx 1000 chars
- **LGPD**: laudos contêm dados de análise — não PII diretamente, mas vinculados a amostras de clientes

## 5. Modelo de Dados

### Novos enums Prisma

```prisma
enum StatusLaudo {
  RASCUNHO
  EMITIDO
  CANCELADO
}

enum Conformidade {
  CONFORME
  NAO_CONFORME
  INCONCLUSIVO
}
```

### Novos modelos Prisma

```prisma
model Report {
  id               String         @id @default(cuid())
  tenantId         String
  sampleId         String
  reportTemplateId String
  numeroLaudo      String
  status           StatusLaudo    @default(RASCUNHO)
  dataEmissao      DateTime?
  responsavel      String?
  observacoes      String?
  deletedAt        DateTime?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  tenant           Tenant         @relation(fields: [tenantId], references: [id])
  sample           Sample         @relation(fields: [sampleId], references: [id])
  reportTemplate   ReportTemplate @relation(fields: [reportTemplateId], references: [id])
  items            ReportItem[]

  @@unique([tenantId, numeroLaudo])
  @@index([tenantId])
  @@index([tenantId, sampleId])
  @@index([tenantId, status])
  @@index([tenantId, deletedAt])
}

model ReportItem {
  id            String       @id @default(cuid())
  reportId      String
  assayId       String
  ordem         Int
  valor         String?
  valorNumerico Float?
  conformidade  Conformidade @default(INCONCLUSIVO)
  observacoes   String?
  report        Report       @relation(fields: [reportId], references: [id])
  assay         Assay        @relation(fields: [assayId], references: [id])

  @@unique([reportId, assayId])
  @@index([reportId])
}
```

### Alterações em modelos existentes

```prisma
// Tenant
reports Report[]

// Sample
reports Report[]

// ReportTemplate
reports Report[]

// Assay
reportItems ReportItem[]
```

## 6. API — Endpoints

| Método | Path | Roles | Descrição |
|--------|------|-------|-----------|
| POST | /api/v1/reports | ADMIN, ANALYST | Criar laudo em RASCUNHO |
| GET | /api/v1/reports | todos | Listar laudos (paginado) |
| GET | /api/v1/reports/:id | todos | Visualizar com items |
| PATCH | /api/v1/reports/:id | ADMIN, ANALYST | Editar metadados |
| PATCH | /api/v1/reports/:id/items/:assayId | ADMIN, ANALYST | Registrar resultado de um item |
| PATCH | /api/v1/reports/:id/status | ADMIN, ANALYST | Emitir ou cancelar |
| DELETE | /api/v1/reports/:id | ADMIN | Soft delete |

### Contratos de Request/Response

#### POST /api/v1/reports

**Request body:**
```json
{
  "sampleId": "cuid-sample",
  "reportTemplateId": "cuid-template",
  "responsavel": "Dr. Carlos Menezes",
  "observacoes": "Coleta após evento de chuva"
}
```

**Response 201:**
```json
{
  "id": "cuid",
  "tenantId": "cuid",
  "sampleId": "cuid-sample",
  "reportTemplateId": "cuid-template",
  "numeroLaudo": "0001/2026",
  "status": "RASCUNHO",
  "dataEmissao": null,
  "responsavel": "Dr. Carlos Menezes",
  "observacoes": "Coleta após evento de chuva",
  "createdAt": "2026-05-10T10:00:00.000Z",
  "updatedAt": "2026-05-10T10:00:00.000Z",
  "items": [
    {
      "id": "cuid-item-1",
      "assayId": "cuid-assay-ph",
      "ordem": 0,
      "valor": null,
      "valorNumerico": null,
      "conformidade": "INCONCLUSIVO",
      "observacoes": null,
      "assay": {
        "id": "cuid-assay-ph",
        "nome": "pH da Água",
        "unidade": "unidade de pH",
        "metodoAnalitico": "ABNT NBR 9898",
        "tipoComparacao": "ENTRE",
        "limiteMinimo": 6.0,
        "limiteMaximo": 9.5,
        "valorReferencia": "6,0 a 9,5"
      }
    }
  ]
}
```

**Erros possíveis:**
- `400` — campos obrigatórios ausentes
- `401` — sem token
- `403` — VIEWER
- `404` — sampleId ou reportTemplateId inválido/outro tenant

#### GET /api/v1/reports

**Query params:** `page`, `pageSize`, `status`, `sampleId`

**Response 200:**
```json
{
  "data": [
    {
      "id": "cuid",
      "numeroLaudo": "0001/2026",
      "status": "RASCUNHO",
      "dataEmissao": null,
      "responsavel": "Dr. Carlos Menezes",
      "sampleId": "cuid-sample",
      "createdAt": "2026-05-10T10:00:00.000Z"
    }
  ],
  "pagination": { "total": 5, "page": 1, "pageSize": 20, "totalPages": 1 }
}
```

#### GET /api/v1/reports/:id

**Response 200:** objeto completo conforme POST 201

#### PATCH /api/v1/reports/:id

**Request body:**
```json
{ "responsavel": "Dr. Paulo Lima", "observacoes": "Revisado" }
```

**Response 200:** laudo completo com items

**Erros:** `400`, `401`, `403`, `404`, `422` (não RASCUNHO)

#### PATCH /api/v1/reports/:id/items/:assayId

**Request body:**
```json
{
  "valor": "7,2",
  "valorNumerico": 7.2,
  "observacoes": "Medido às 09:30"
}
```

**Response 200:**
```json
{
  "id": "cuid-item",
  "reportId": "cuid",
  "assayId": "cuid-assay-ph",
  "ordem": 0,
  "valor": "7,2",
  "valorNumerico": 7.2,
  "conformidade": "CONFORME",
  "observacoes": "Medido às 09:30"
}
```

**Erros:** `400`, `401`, `403`, `404` (laudo ou item não encontrado), `422` (não RASCUNHO)

#### PATCH /api/v1/reports/:id/status

**Request body:**
```json
{ "status": "EMITIDO" }
```

**Response 200:** laudo completo (com `dataEmissao` preenchida se EMITIDO)

**Erros:** `400`, `401`, `403`, `404`, `422` (transição inválida)

#### DELETE /api/v1/reports/:id

**Response 204:** sem body

**Erros:** `401`, `403`, `404`, `422` (EMITIDO não pode ser deletado)

## 7. Regras de Negócio

- **RN-01**: `tenantId` sempre do JWT — `sampleId` e `reportTemplateId` validados no tenant antes de persistir
- **RN-02**: Items criados automaticamente ao criar o laudo — um por ensaio do template, na mesma ordem, com valores nulos e `conformidade = INCONCLUSIVO`
- **RN-03**: Edição de metadados e resultados só permitida em `RASCUNHO` → `422` em outros estados
- **RN-04**: Ao emitir (`RASCUNHO → EMITIDO`), `dataEmissao` recebe o timestamp atual
- **RN-05**: Conformidade calculada automaticamente ao salvar um item:
  - Se `tipoComparacao = null` ou `TEXTO`: `INCONCLUSIVO`
  - Se `valorNumerico = null`: `INCONCLUSIVO`
  - `ENTRE`: `limiteMinimo <= valorNumerico <= limiteMaximo` → `CONFORME`, senão `NAO_CONFORME`
  - `MENOR_QUE`: `valorNumerico < limiteMaximo` → `CONFORME`
  - `MENOR_IGUAL`: `valorNumerico <= limiteMaximo` → `CONFORME`
  - `MAIOR_QUE`: `valorNumerico > limiteMinimo` → `CONFORME`
  - `MAIOR_IGUAL`: `valorNumerico >= limiteMinimo` → `CONFORME`
- **RN-06**: `EMITIDO` e `CANCELADO` são estados terminais de status
- **RN-07**: Soft delete bloqueado para laudos `EMITIDO` (valor jurídico) — retorna `422`
- **RN-08**: `numeroLaudo` sequencial por tenant + ano, gerado dentro de `$transaction`, imutável após criação
- **RN-09**: Cada amostra pode ter múltiplos laudos (diferentes modelos ou reemissões futuras)

## 8. Integrações Externas

Nenhuma nesta feature. PDF é a feature seguinte.

## 9. Fora do Escopo (desta entrega)

- Geração de PDF do laudo
- Armazenamento e URL de download do PDF
- Assinatura digital
- Portal do cliente (acesso ao laudo pelo cliente)
- Reemissão com versão (histórico de versões do laudo)
- Notificação ao cliente ao emitir

## 10. Critérios de Aceite do MVP

- [ ] POST cria laudo com `numeroLaudo = 0001/2026` e items automáticos do template
- [ ] Items têm `conformidade = INCONCLUSIVO` ao criar
- [ ] PATCH item com `valorNumerico = 7.2` em ensaio ENTRE [6.0, 9.5] → `conformidade = CONFORME`
- [ ] PATCH item com `valorNumerico = 10.0` em ensaio ENTRE [6.0, 9.5] → `conformidade = NAO_CONFORME`
- [ ] PATCH item com ensaio TEXTO → `conformidade = INCONCLUSIVO`
- [ ] PATCH metadados em EMITIDO → 422
- [ ] PATCH item em EMITIDO → 422
- [ ] RASCUNHO → EMITIDO → `dataEmissao` preenchida, status terminal
- [ ] RASCUNHO → CANCELADO → status terminal
- [ ] DELETE em EMITIDO → 422
- [ ] DELETE em RASCUNHO → 204
- [ ] GET by ID retorna items ordenados por `ordem`
- [ ] sampleId de outro tenant → 404
- [ ] reportTemplateId de outro tenant → 404
- [ ] Isolamento multi-tenant em todas as operações

## 11. Dependências e Pré-requisitos

- Tenant + Auth ✅
- CRUD de Clientes ✅
- CRUD de Atendimentos + Amostras ✅
- CRUD de Ensaios ✅
- CRUD de Modelos de Laudo (ReportTemplate) ✅
