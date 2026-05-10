# PRD — CRUD de Modelos de Laudo (Report Templates)

**Status**: Draft  
**Versão**: 1.0  
**Data**: 2026-05-08  
**Épico relacionado**: Semana 3 — Ensaios & Modelos de Laudo

---

## 1. Contexto e Objetivo

Um Modelo de Laudo define o **tipo e a composição** de um relatório laboratorial — por exemplo: "Laudo Físico-Químico de Água" ou "Laudo Microbiológico". Ele agrupa os ensaios que compõem aquele tipo de análise, em uma ordem definida que será respeitada na geração do PDF.

Esta feature entrega o CRUD completo de modelos de laudo. A **emissão** do laudo (vincular um modelo a uma amostra, registrar resultados, gerar PDF) é a feature da Semana 4.

## 2. Usuários Afetados

| Perfil | Ações permitidas |
|--------|-----------------|
| ADMIN | Criar, editar, listar, visualizar e desativar modelos |
| ANALYST | Criar, editar, listar e visualizar modelos |
| VIEWER | Listar e visualizar modelos |

## 3. Requisitos Funcionais

### RF-01 — Criar modelo de laudo
**Como** ADMIN ou ANALYST, **quero** criar um modelo de laudo com nome e lista de ensaios, **para** que ele possa ser usado na emissão de laudos para amostras.

- Critérios de aceite:
  - [ ] Campos obrigatórios: `nome`, `assayIds` (mínimo 1 ensaio)
  - [ ] Campos opcionais: `descricao`
  - [ ] A posição de cada assayId no array define a ordem de exibição (`ordem` 0-based)
  - [ ] Todos os assayIds devem pertencer ao tenant do token
  - [ ] `assayIds` não podem conter duplicatas
  - [ ] `nome` é único por tenant
  - [ ] Retorna `201` com o modelo criado, incluindo `assays` ordenados

### RF-02 — Listar modelos com paginação
**Como** qualquer usuário autenticado, **quero** listar os modelos de laudo do meu laboratório, **para** consultar o catálogo disponível.

- Critérios de aceite:
  - [ ] Retorna apenas modelos do tenant do token
  - [ ] Não retorna registros com `deletedAt != null`
  - [ ] Suporta `page` e `pageSize` (padrão: página 1, 20 itens)
  - [ ] Retorna envelope `{ data: [], pagination: { page, pageSize, total } }`
  - [ ] Suporta filtro por `?search=<texto>` em `nome`
  - [ ] Listagem inclui contagem de ensaios (`assayCount`)

### RF-03 — Visualizar modelo por ID
**Como** qualquer usuário autenticado, **quero** visualizar um modelo pelo ID, **para** consultar todos os seus dados incluindo os ensaios que o compõem.

- Critérios de aceite:
  - [ ] Retorna o modelo com array `assays` completo e ordenado por `ordem`
  - [ ] Cada item do array inclui os dados do ensaio (id, nome, unidade, metodoAnalitico, tipoComparacao, limiteMinimo, limiteMaximo, valorReferencia)
  - [ ] Retorna `404` se não existir ou pertencer a outro tenant
  - [ ] Retorna `404` se estiver soft-deletado

### RF-04 — Editar modelo
**Como** ADMIN ou ANALYST, **quero** editar um modelo de laudo, **para** atualizar nome, descrição ou a lista de ensaios.

- Critérios de aceite:
  - [ ] `nome` e `descricao` são opcionais (PATCH parcial)
  - [ ] Se `assayIds` for enviado, substitui a lista completa atomicamente (delete + insert em `$transaction`)
  - [ ] Se `assayIds` for enviado, deve ter mínimo 1 item, sem duplicatas, todos do mesmo tenant
  - [ ] Retorna `404` se modelo não existir no tenant
  - [ ] Retorna `409` se o novo `nome` já existir no tenant

### RF-05 — Desativar modelo (soft delete)
**Como** ADMIN, **quero** desativar um modelo de laudo, **para** removê-lo do catálogo sem apagar histórico.

- Critérios de aceite:
  - [ ] Apenas ADMIN pode desativar
  - [ ] Preenche `deletedAt` com timestamp atual
  - [ ] Retorna `204`
  - [ ] Modelo desativado não aparece em listagens nem em GET por ID

## 4. Requisitos Não-Funcionais

- **Segurança**: todo acesso filtra por `tenantId` extraído do JWT — nunca do body
- **Validações**:
  - `nome`: string, 1–200 chars, obrigatório na criação
  - `descricao`: string opcional, máx 1000 chars
  - `assayIds`: array de strings, mínimo 1 item, sem duplicatas — obrigatório na criação, opcional no PATCH
- **Atomicidade**: substituição de ensaios no PATCH usa `prisma.$transaction` (delete all + create new)
- **LGPD**: modelos de laudo não contêm dados pessoais

## 5. Modelo de Dados

### Novos modelos Prisma

```prisma
model ReportTemplate {
  id        String                @id @default(cuid())
  tenantId  String
  nome      String
  descricao String?
  deletedAt DateTime?
  createdAt DateTime              @default(now())
  updatedAt DateTime              @updatedAt
  tenant    Tenant                @relation(fields: [tenantId], references: [id])
  assays    ReportTemplateAssay[]

  @@unique([tenantId, nome])
  @@index([tenantId])
  @@index([tenantId, deletedAt])
}

model ReportTemplateAssay {
  id               String         @id @default(cuid())
  reportTemplateId String
  assayId          String
  ordem            Int
  reportTemplate   ReportTemplate @relation(fields: [reportTemplateId], references: [id])
  assay            Assay          @relation(fields: [assayId], references: [id])

  @@unique([reportTemplateId, assayId])
  @@index([reportTemplateId])
}
```

### Alterações em modelos existentes

Adicionar relação no model `Tenant`:
```prisma
reportTemplates ReportTemplate[]
```

Adicionar relação no model `Assay`:
```prisma
reportTemplates ReportTemplateAssay[]
```

## 6. API — Endpoints

| Método | Path | Roles | Descrição |
|--------|------|-------|-----------|
| POST | /api/v1/report-templates | ADMIN, ANALYST | Criar modelo |
| GET | /api/v1/report-templates | todos | Listar (paginado) |
| GET | /api/v1/report-templates/:id | todos | Visualizar com ensaios |
| PATCH | /api/v1/report-templates/:id | ADMIN, ANALYST | Editar |
| DELETE | /api/v1/report-templates/:id | ADMIN | Soft delete |

### Contratos de Request/Response

#### POST /api/v1/report-templates

**Request body:**
```json
{
  "nome": "Laudo Físico-Químico de Água",
  "descricao": "Análises físico-químicas para água de consumo humano (Portaria 888/2021)",
  "assayIds": ["cuid-assay-ph", "cuid-assay-turbidez", "cuid-assay-cloro"]
}
```

**Response 201:**
```json
{
  "id": "cuid",
  "tenantId": "cuid",
  "nome": "Laudo Físico-Químico de Água",
  "descricao": "Análises físico-químicas para água de consumo humano (Portaria 888/2021)",
  "deletedAt": null,
  "createdAt": "2026-05-08T10:00:00.000Z",
  "updatedAt": "2026-05-08T10:00:00.000Z",
  "assays": [
    {
      "ordem": 0,
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
    },
    {
      "ordem": 1,
      "assay": {
        "id": "cuid-assay-turbidez",
        "nome": "Turbidez",
        "unidade": "NTU",
        "metodoAnalitico": null,
        "tipoComparacao": "MENOR_IGUAL",
        "limiteMinimo": null,
        "limiteMaximo": 5.0,
        "valorReferencia": "≤ 5 NTU"
      }
    }
  ]
}
```

**Erros possíveis:**
- `400` — campos obrigatórios ausentes, assayIds vazio ou com duplicatas
- `401` — sem token
- `403` — role VIEWER
- `404` — um ou mais assayIds não pertencem ao tenant
- `409` — nome já existe no tenant

#### GET /api/v1/report-templates

**Query params:** `page` (default 1), `pageSize` (default 20), `search` (filtra em `nome`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "cuid",
      "nome": "Laudo Físico-Químico de Água",
      "descricao": "Análises físico-químicas...",
      "assayCount": 3,
      "createdAt": "2026-05-08T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### GET /api/v1/report-templates/:id

**Response 200:** objeto completo conforme POST 201

**Erros possíveis:**
- `401` — sem token
- `404` — não encontrado ou de outro tenant

#### PATCH /api/v1/report-templates/:id

**Request body:** qualquer subconjunto dos campos editáveis
```json
{
  "descricao": "Atualizado conforme Portaria 888/2021",
  "assayIds": ["cuid-assay-ph", "cuid-assay-cloro", "cuid-assay-turbidez", "cuid-assay-dbo"]
}
```

**Response 200:** objeto atualizado completo (mesmo formato do GET by ID)

**Erros possíveis:**
- `400` — assayIds inválido (vazio, duplicatas)
- `401` — sem token
- `403` — role VIEWER
- `404` — modelo não encontrado ou assayId inválido
- `409` — nome já existe no tenant

#### DELETE /api/v1/report-templates/:id

**Response 204:** sem body

**Erros possíveis:**
- `401` — sem token
- `403` — role ANALYST ou VIEWER
- `404` — não encontrado ou de outro tenant

## 7. Regras de Negócio

- **RN-01**: Modelo pertence exclusivamente ao tenant do operador — isolamento garantido em todas as operações
- **RN-02**: `nome` é único por tenant
- **RN-03**: Todos os assayIds enviados devem pertencer ao mesmo tenant — validar antes de persistir (retorna 404 se inválido)
- **RN-04**: `assayIds` não pode ter duplicatas — retorna 400
- **RN-05**: Mínimo 1 assay na criação e no PATCH quando `assayIds` for enviado
- **RN-06**: A posição no array `assayIds` define o campo `ordem` (índice 0-based) na junction table
- **RN-07**: Substituição de ensaios no PATCH é atômica — usa `$transaction` para delete all + insert new
- **RN-08**: Soft delete — modelo desativado não aparece em listagens mas permanece referenciável em laudos históricos

## 8. Integrações Externas

Nenhuma nesta feature.

## 9. Fora do Escopo (desta entrega)

- Emissão de laudo (vincular modelo a uma amostra, registrar resultados, calcular conformidade)
- Geração de PDF
- Clonagem de modelo entre tenants
- Versionamento de modelo (histórico de composição)
- Restrição de desativação caso o modelo tenha laudos emitidos vinculados

## 10. Critérios de Aceite do MVP

- [ ] POST cria modelo com 3 ensaios e retorna 201 com `assays` ordenados
- [ ] GET by ID retorna `assays` na mesma ordem enviada no POST
- [ ] PATCH com novo `assayIds` substitui a lista completamente e mantém nova ordenação
- [ ] POST com assayId de outro tenant retorna 404
- [ ] POST com assayIds duplicados retorna 400
- [ ] GET lista retorna `assayCount` correto
- [ ] DELETE retorna 204 e modelo some da listagem
- [ ] Operações de outro tenant retornam 404
- [ ] VIEWER não pode criar, editar ou deletar (403)
- [ ] ANALYST não pode deletar (403)

## 11. Dependências e Pré-requisitos

- Tenant + Auth ✅
- CRUD de Ensaios (Assay) ✅ — os assayIds enviados no POST referenciam registros desta tabela
- Middlewares `authenticate`, `authorize`, `validate` ✅
