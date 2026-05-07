# PRD — CRUD de Amostras

**Status**: Draft  
**Versão**: 2.0  
**Data**: 2026-05-02  
**Épico relacionado**: Semana 2 — Clientes & Amostras (CRUD)

> **v2.0** — Amostra agora vinculada a **Atendimento** (e não diretamente ao Cliente). Requer PRD-CRUD-ATENDIMENTOS implementado primeiro.

---

## 1. Contexto e Objetivo

A Amostra representa o material físico coletado para análise laboratorial. Ela é vinculada a um Atendimento (ordem de serviço) e possui ciclo de vida próprio — desde o recebimento até a conclusão da análise. Cada amostra pode gerar múltiplos laudos. É o elo entre o atendimento ao cliente e os laudos emitidos.

**Hierarquia:**
```
Cliente → Atendimento → Amostra(s) → Laudo(s)
```

## 2. Usuários Afetados

| Role | Permissões |
|------|-----------|
| `ADMIN` | Criar, listar, visualizar, editar, transitar status, soft delete |
| `ANALYST` | Criar, listar, visualizar, editar, transitar status (incl. cancelar/rejeitar) |
| `VIEWER` | Listar, visualizar |

## 3. Requisitos Funcionais

### RF-01 — Criar amostra
**Como** operador do laboratório, **quero** registrar uma amostra vinculada a um atendimento, **para** iniciar o processo de análise.

- Critérios de aceite:
  - [ ] Amostra criada com status inicial `RECEBIDA`
  - [ ] Número sequencial gerado automaticamente no formato `0001/2026` (por tenant + ano)
  - [ ] `attendanceId` deve pertencer ao mesmo tenant — retorna `404` se não encontrado ou de outro tenant
  - [ ] `tenantId` sempre extraído do JWT, nunca do body
  - [ ] Retorna `201` com a amostra criada incluindo `numeroAmostra`

### RF-02 — Listar amostras
**Como** operador do laboratório, **quero** listar amostras com paginação e filtros, **para** monitorar o estado das análises.

- Critérios de aceite:
  - [ ] Retorna apenas amostras ativas (`deletedAt IS NULL`) do tenant autenticado
  - [ ] Paginação via `page` / `pageSize` (padrão: 1 / 20, máximo: 100)
  - [ ] Filtro opcional por `attendanceId`
  - [ ] Filtro opcional por `status`
  - [ ] Busca opcional por `numeroAmostra`, `descricao` ou `pontoColeta` (query param `search`)
  - [ ] Resposta inclui `{ data, pagination: { total, page, pageSize, totalPages } }`

### RF-03 — Visualizar amostra
**Como** operador do laboratório, **quero** ver todos os dados de uma amostra, **para** consultar detalhes de coleta e status atual.

- Critérios de aceite:
  - [ ] Retorna `404` se a amostra não pertencer ao tenant autenticado
  - [ ] Retorna `404` se a amostra estiver soft-deletada

### RF-04 — Editar amostra
**Como** operador do laboratório, **quero** atualizar os dados de uma amostra, **para** corrigir informações de coleta.

- Critérios de aceite:
  - [ ] Atualização parcial (PATCH) — apenas campos enviados são alterados
  - [ ] Não é permitido alterar `status` via este endpoint (use RF-05)
  - [ ] Não é permitido alterar `numeroAmostra` nem `attendanceId` após criação
  - [ ] Retorna `404` se amostra não pertencer ao tenant ou estiver deletada

### RF-05 — Transitar status
**Como** operador do laboratório, **quero** avançar o status de uma amostra, **para** refletir o progresso da análise.

- Critérios de aceite:
  - [ ] Endpoint dedicado: `PATCH /api/v1/samples/:id/status`
  - [ ] Transições permitidas:
    - `RECEBIDA` → `EM_ANALISE`, `CANCELADA`, `REJEITADA`
    - `EM_ANALISE` → `CONCLUIDA`, `CANCELADA`, `REJEITADA`
    - `CONCLUIDA`, `CANCELADA`, `REJEITADA` → nenhuma (estados terminais)
  - [ ] Transição inválida retorna `422` com mensagem descritiva
  - [ ] `ANALYST` pode transitar para todos os status, incluindo `CANCELADA` e `REJEITADA`
  - [ ] Retorna `200` com a amostra atualizada

### RF-06 — Excluir amostra (soft delete)
**Como** administrador do laboratório, **quero** remover uma amostra, **para** desativá-la sem perder o histórico.

- Critérios de aceite:
  - [ ] Apenas role `ADMIN` — outros recebem `403`
  - [ ] Preenche `deletedAt` com o timestamp atual
  - [ ] Retorna `204` em caso de sucesso

## 4. Requisitos Não-Funcionais

- **Segurança**: isolamento por `tenantId`; `attendanceId` validado dentro do tenant
- **Performance**: índices em `(tenantId)`, `(tenantId, deletedAt)`, `(tenantId, attendanceId)`, `(tenantId, status)`
- **Concorrência**: geração do `numeroAmostra` dentro de `$transaction` com `SELECT MAX`
- **Validações**:
  - `attendanceId`: obrigatório
  - `descricao`: obrigatório, mínimo 2 caracteres
  - `dataColeta`: opcional, ISO 8601
  - `dataRecebimento`: opcional, ISO 8601
  - `amostrador`: opcional, string
  - `etiqueta`: opcional, string (texto livre, sem unicidade)
  - `motivo`: opcional, string
  - `temperaturaAmostra`: opcional, float
  - `temperaturaAmbiente`: opcional, float
  - `umidadeRelativa`: opcional, float (0–100)
  - `pontoColeta`: opcional, string
  - `observacoes`: opcional, string
- **LGPD**: sem PII diretamente na amostra — vínculo por ID

## 5. Modelo de Dados

### Novo enum e model Prisma

```prisma
enum StatusAmostra {
  RECEBIDA
  EM_ANALISE
  CANCELADA
  REJEITADA
  CONCLUIDA
}

model Sample {
  id                  String        @id @default(cuid())
  tenantId            String
  attendanceId        String
  numeroAmostra       String
  status              StatusAmostra @default(RECEBIDA)
  descricao           String
  dataColeta          DateTime?
  dataRecebimento     DateTime?
  amostrador          String?
  etiqueta            String?
  motivo              String?
  temperaturaAmostra  Float?
  temperaturaAmbiente Float?
  umidadeRelativa     Float?
  pontoColeta         String?
  observacoes         String?
  deletedAt           DateTime?
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  tenant              Tenant        @relation(fields: [tenantId], references: [id])
  attendance          Attendance    @relation(fields: [attendanceId], references: [id])

  @@unique([tenantId, numeroAmostra])
  @@index([tenantId])
  @@index([tenantId, deletedAt])
  @@index([tenantId, attendanceId])
  @@index([tenantId, status])
}
```

### Alterações em modelos existentes

```prisma
model Tenant {
  // ... campos existentes ...
  samples  Sample[]
}

// Attendance já declara samples Sample[] no PRD-CRUD-ATENDIMENTOS
```

### Geração do número sequencial

```
sequencia = MAX(numeroAmostra WHERE tenantId = X AND ano = ANO_ATUAL) + 1
numeroAmostra = LPAD(sequencia, 4, '0') + '/' + ANO_ATUAL
```

Exemplo: `0001/2026`, `0002/2026`. Sequência independente da de Atendimentos.

## 6. API — Endpoints

| Método | Path | Auth | Role mínima | Descrição |
|--------|------|------|-------------|-----------|
| `POST` | `/api/v1/samples` | JWT Bearer | `ANALYST` | Criar amostra |
| `GET` | `/api/v1/samples` | JWT Bearer | `VIEWER` | Listar amostras |
| `GET` | `/api/v1/samples/:id` | JWT Bearer | `VIEWER` | Visualizar amostra |
| `PATCH` | `/api/v1/samples/:id` | JWT Bearer | `ANALYST` | Editar campos |
| `PATCH` | `/api/v1/samples/:id/status` | JWT Bearer | `ANALYST` | Transitar status |
| `DELETE` | `/api/v1/samples/:id` | JWT Bearer | `ADMIN` | Soft delete |

### Contratos de Request/Response

#### POST /api/v1/samples

**Request body:**
```json
{
  "attendanceId": "cuid-do-atendimento",
  "descricao": "Amostra de água superficial",
  "dataColeta": "2026-05-01T08:00:00.000Z",
  "dataRecebimento": "2026-05-02T09:30:00.000Z",
  "amostrador": "Carlos Souza",
  "etiqueta": "RIO-001-A",
  "motivo": "Monitoramento mensal",
  "temperaturaAmostra": 18.5,
  "temperaturaAmbiente": 24.0,
  "umidadeRelativa": 72.3,
  "pontoColeta": "Rio Tietê — km 42",
  "observacoes": "Coleta realizada após chuva intensa"
}
```

**Response 201:**
```json
{
  "id": "cuid",
  "tenantId": "cuid",
  "attendanceId": "cuid",
  "numeroAmostra": "0001/2026",
  "status": "RECEBIDA",
  "descricao": "Amostra de água superficial",
  "dataColeta": "2026-05-01T08:00:00.000Z",
  "dataRecebimento": "2026-05-02T09:30:00.000Z",
  "amostrador": "Carlos Souza",
  "etiqueta": "RIO-001-A",
  "motivo": "Monitoramento mensal",
  "temperaturaAmostra": 18.5,
  "temperaturaAmbiente": 24.0,
  "umidadeRelativa": 72.3,
  "pontoColeta": "Rio Tietê — km 42",
  "observacoes": "Coleta realizada após chuva intensa",
  "createdAt": "2026-05-02T10:00:00.000Z",
  "updatedAt": "2026-05-02T10:00:00.000Z"
}
```

**Erros possíveis:**
- `400` — campos inválidos
- `401` — sem token
- `403` — role insuficiente
- `404` — `attendanceId` não pertence ao tenant

---

#### PATCH /api/v1/samples/:id/status

**Request body:**
```json
{ "status": "EM_ANALISE" }
```

**Response 200:** objeto atualizado completo.

**Erros possíveis:**
- `400` — status ausente ou inválido
- `404` — amostra não encontrada
- `422` — transição não permitida (ex: sair de `CONCLUIDA`)

---

#### GET /api/v1/samples

**Query params:** `page`, `pageSize`, `attendanceId`, `status`, `search`

**Response 200:**
```json
{
  "data": [
    {
      "id": "cuid",
      "numeroAmostra": "0001/2026",
      "status": "RECEBIDA",
      "descricao": "Amostra de água superficial",
      "pontoColeta": "Rio Tietê — km 42",
      "dataRecebimento": "2026-05-02T09:30:00.000Z",
      "attendanceId": "cuid",
      "createdAt": "2026-05-02T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

## 7. Regras de Negócio

- **RN-01**: `tenantId` sempre do JWT, nunca do body
- **RN-02**: `attendanceId` deve pertencer ao mesmo tenant — validado no service
- **RN-03**: `numeroAmostra` gerado automaticamente, sequencial por tenant+ano, imutável após criação
- **RN-04**: Status inicial sempre `RECEBIDA`
- **RN-05**: Transições válidas: `RECEBIDA → EM_ANALISE | CANCELADA | REJEITADA`; `EM_ANALISE → CONCLUIDA | CANCELADA | REJEITADA`; estados terminais: `CONCLUIDA`, `CANCELADA`, `REJEITADA`
- **RN-06**: `ANALYST` pode transitar para qualquer status, incluindo `CANCELADA` e `REJEITADA`
- **RN-07**: `attendanceId` e `numeroAmostra` são imutáveis após criação

## 8. Integrações Externas

Nenhuma nesta feature.

## 9. Fora do Escopo (desta entrega)

- Vínculo com laudos (Semana 3+)
- Histórico de transições de status
- Reativação de amostras em estados terminais
- Numeração contínua entre anos (reinicia em `0001` a cada ano)
- Upload de arquivos vinculados à amostra

## 10. Critérios de Aceite do MVP

- [ ] `POST /api/v1/samples` cria amostra com `numeroAmostra` no formato `0001/2026`
- [ ] Duas amostras criadas seguidas geram `0001/2026` e `0002/2026`
- [ ] `attendanceId` de outro tenant retorna `404`
- [ ] `GET /api/v1/samples` retorna apenas amostras do tenant autenticado
- [ ] Filtros por `status` e `attendanceId` funcionam
- [ ] Transição válida retorna `200` com status atualizado
- [ ] Transição inválida retorna `422`
- [ ] `ANALYST` consegue cancelar e rejeitar
- [ ] `VIEWER` recebe `403` ao tentar criar, editar ou deletar
- [ ] Nenhum endpoint retorna dados de outro tenant

## 11. Dependências e Pré-requisitos

- CRUD de Clientes — implementado ✅
- **CRUD de Atendimentos — deve ser implementado antes** (Amostra referencia `attendanceId`)
- Migration da tabela `Sample` aplicada após a de `Attendance`
