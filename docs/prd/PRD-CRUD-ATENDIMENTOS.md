# PRD — CRUD de Atendimentos

**Status**: Draft  
**Versão**: 1.0  
**Data**: 2026-05-02  
**Épico relacionado**: Semana 2 — Clientes & Amostras (CRUD)

---

## 1. Contexto e Objetivo

O Atendimento é a ordem de serviço que registra a solicitação de análises laboratoriais de um cliente. Ele agrupa as amostras coletadas e os laudos emitidos em um único contexto rastreável. Sem o Atendimento não é possível registrar amostras nem emitir laudos — é o ponto de entrada do fluxo laboratorial completo.

**Fluxo macro:**
```
Cliente → Atendimento → Amostra(s) → Laudo(s)
```

## 2. Usuários Afetados

| Role | Permissões |
|------|-----------|
| `ADMIN` | Criar, listar, visualizar, editar, transitar status, soft delete |
| `ANALYST` | Criar, listar, visualizar, editar, transitar status |
| `VIEWER` | Listar, visualizar |

## 3. Requisitos Funcionais

### RF-01 — Criar atendimento
**Como** operador do laboratório, **quero** abrir um atendimento para um cliente, **para** registrar a solicitação de análises laboratoriais.

- Critérios de aceite:
  - [ ] Atendimento criado com status inicial `ABERTO`
  - [ ] Número sequencial gerado automaticamente no formato `0001/2026` (por tenant + ano)
  - [ ] `clientId` deve pertencer ao mesmo tenant — retorna `404` se não encontrado ou de outro tenant
  - [ ] `tenantId` sempre extraído do JWT, nunca do body
  - [ ] Retorna `201` com o atendimento criado incluindo `numeroAtendimento`

### RF-02 — Listar atendimentos
**Como** operador do laboratório, **quero** listar atendimentos com paginação e filtros, **para** acompanhar o andamento das ordens de serviço.

- Critérios de aceite:
  - [ ] Retorna apenas atendimentos ativos (`deletedAt IS NULL`) do tenant autenticado
  - [ ] Paginação via `page` / `pageSize` (padrão: 1 / 20, máximo: 100)
  - [ ] Filtro opcional por `clientId`
  - [ ] Filtro opcional por `status`
  - [ ] Filtro opcional por `tipoColeta`
  - [ ] Busca opcional por `numeroAtendimento` ou `descricao` (query param `search`)
  - [ ] Resposta inclui `{ data, pagination: { total, page, pageSize, totalPages } }`

### RF-03 — Visualizar atendimento
**Como** operador do laboratório, **quero** ver todos os dados de um atendimento, **para** consultar detalhes da solicitação.

- Critérios de aceite:
  - [ ] Retorna `404` se o atendimento não pertencer ao tenant autenticado
  - [ ] Retorna `404` se o atendimento estiver soft-deletado

### RF-04 — Editar atendimento
**Como** operador do laboratório, **quero** corrigir ou complementar dados de um atendimento, **para** manter as informações atualizadas.

- Critérios de aceite:
  - [ ] Atualização parcial (PATCH) — apenas campos enviados são alterados
  - [ ] Não é permitido alterar `status` via este endpoint (use RF-05)
  - [ ] Não é permitido alterar `numeroAtendimento` (imutável após criação)
  - [ ] Não é permitido alterar `clientId` após criação
  - [ ] Retorna `404` se atendimento não pertencer ao tenant ou estiver deletado

### RF-05 — Transitar status
**Como** operador do laboratório, **quero** avançar o status de um atendimento, **para** refletir o progresso real do serviço.

- Critérios de aceite:
  - [ ] Endpoint dedicado: `PATCH /api/v1/attendances/:id/status`
  - [ ] Transições permitidas:
    - `ABERTO` → `EM_ANDAMENTO`, `CANCELADO`
    - `EM_ANDAMENTO` → `ENCERRADO`, `CANCELADO`
    - `ENCERRADO` → nenhuma (estado terminal)
    - `CANCELADO` → nenhuma (estado terminal)
  - [ ] Transição inválida retorna `422` com mensagem descritiva
  - [ ] Retorna `200` com o atendimento atualizado

### RF-06 — Excluir atendimento (soft delete)
**Como** administrador do laboratório, **quero** remover um atendimento, **para** desativá-lo sem perder o histórico.

- Critérios de aceite:
  - [ ] Apenas role `ADMIN` — outros recebem `403`
  - [ ] Preenche `deletedAt` com o timestamp atual
  - [ ] Retorna `204` em caso de sucesso

## 4. Requisitos Não-Funcionais

- **Segurança**: isolamento total por `tenantId`; `clientId` validado dentro do tenant
- **Performance**: índices em `(tenantId)`, `(tenantId, deletedAt)`, `(tenantId, clientId)`, `(tenantId, status)`
- **Concorrência**: geração do `numeroAtendimento` dentro de `$transaction` com `SELECT MAX`
- **Validações**:
  - `clientId`: obrigatório
  - `tipoColeta`: obrigatório, enum `IN_LOCO` | `ENTREGA_NO_LABORATORIO`
  - `descricao`: opcional, string, mínimo 2 caracteres
  - `dataSolicitacao`: opcional, ISO 8601
  - `prazoEntrega`: opcional, ISO 8601
  - `responsavel`: opcional, string (nome do responsável pelo atendimento no laboratório)
  - `observacoes`: opcional, string
- **LGPD**: dados do atendimento não contêm PII diretamente — vinculado ao cliente por ID

## 5. Modelo de Dados

### Novo enum e model Prisma

```prisma
enum StatusAtendimento {
  ABERTO
  EM_ANDAMENTO
  ENCERRADO
  CANCELADO
}

enum TipoColeta {
  IN_LOCO
  ENTREGA_NO_LABORATORIO
}

model Attendance {
  id                 String             @id @default(cuid())
  tenantId           String
  clientId           String
  numeroAtendimento  String
  status             StatusAtendimento  @default(ABERTO)
  tipoColeta         TipoColeta
  descricao          String?
  dataSolicitacao    DateTime?
  prazoEntrega       DateTime?
  responsavel        String?
  observacoes        String?
  deletedAt          DateTime?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  tenant             Tenant             @relation(fields: [tenantId], references: [id])
  client             Client             @relation(fields: [clientId], references: [id])
  samples            Sample[]

  @@unique([tenantId, numeroAtendimento])
  @@index([tenantId])
  @@index([tenantId, deletedAt])
  @@index([tenantId, clientId])
  @@index([tenantId, status])
}
```

### Alterações em modelos existentes

```prisma
model Tenant {
  // ... campos existentes ...
  attendances  Attendance[]
}

model Client {
  // ... campos existentes ...
  attendances  Attendance[]
}
```

### Geração do número sequencial

```
sequencia = MAX(numeroAtendimento WHERE tenantId = X AND ano = ANO_ATUAL) + 1
numeroAtendimento = LPAD(sequencia, 4, '0') + '/' + ANO_ATUAL
```

Exemplo: `0001/2026`, `0002/2026`.

## 6. API — Endpoints

| Método | Path | Auth | Role mínima | Descrição |
|--------|------|------|-------------|-----------|
| `POST` | `/api/v1/attendances` | JWT Bearer | `ANALYST` | Criar atendimento |
| `GET` | `/api/v1/attendances` | JWT Bearer | `VIEWER` | Listar atendimentos |
| `GET` | `/api/v1/attendances/:id` | JWT Bearer | `VIEWER` | Visualizar atendimento |
| `PATCH` | `/api/v1/attendances/:id` | JWT Bearer | `ANALYST` | Editar campos |
| `PATCH` | `/api/v1/attendances/:id/status` | JWT Bearer | `ANALYST` | Transitar status |
| `DELETE` | `/api/v1/attendances/:id` | JWT Bearer | `ADMIN` | Soft delete |

### Contratos de Request/Response

#### POST /api/v1/attendances

**Request body:**
```json
{
  "clientId": "cuid-do-cliente",
  "tipoColeta": "IN_LOCO",
  "descricao": "Análise de qualidade da água para fins de consumo humano",
  "dataSolicitacao": "2026-05-02T09:00:00.000Z",
  "prazoEntrega": "2026-05-10T18:00:00.000Z",
  "responsavel": "Dr. Carlos Menezes",
  "observacoes": "Cliente solicitou urgência nos laudos de coliformes"
}
```

**Response 201:**
```json
{
  "id": "cuid",
  "tenantId": "cuid",
  "clientId": "cuid",
  "numeroAtendimento": "0001/2026",
  "status": "ABERTO",
  "tipoColeta": "IN_LOCO",
  "descricao": "Análise de qualidade da água para fins de consumo humano",
  "dataSolicitacao": "2026-05-02T09:00:00.000Z",
  "prazoEntrega": "2026-05-10T18:00:00.000Z",
  "responsavel": "Dr. Carlos Menezes",
  "observacoes": "Cliente solicitou urgência nos laudos de coliformes",
  "createdAt": "2026-05-02T10:00:00.000Z",
  "updatedAt": "2026-05-02T10:00:00.000Z"
}
```

**Erros possíveis:**
- `400` — campos inválidos
- `401` — sem token
- `403` — role insuficiente
- `404` — `clientId` não pertence ao tenant

---

#### PATCH /api/v1/attendances/:id/status

**Request body:**
```json
{
  "status": "EM_ANDAMENTO"
}
```

**Response 200:** objeto atualizado completo.

**Erros possíveis:**
- `400` — status inválido
- `404` — atendimento não encontrado ou não pertence ao tenant
- `422` — transição não permitida

---

#### GET /api/v1/attendances

**Query params:**
- `page`, `pageSize`
- `clientId` (opcional)
- `status` (opcional)
- `tipoColeta` (opcional)
- `search` (busca em `numeroAtendimento`, `descricao`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "cuid",
      "numeroAtendimento": "0001/2026",
      "status": "ABERTO",
      "tipoColeta": "IN_LOCO",
      "descricao": "Análise de qualidade da água",
      "prazoEntrega": "2026-05-10T18:00:00.000Z",
      "clientId": "cuid",
      "createdAt": "2026-05-02T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

## 7. Regras de Negócio

- **RN-01**: `tenantId` sempre do JWT — nunca do body
- **RN-02**: `clientId` deve pertencer ao mesmo tenant
- **RN-03**: `numeroAtendimento` gerado automaticamente, sequencial por tenant+ano, imutável após criação
- **RN-04**: Status inicial sempre `ABERTO`
- **RN-05**: Transições válidas: `ABERTO → EM_ANDAMENTO | CANCELADO`; `EM_ANDAMENTO → ENCERRADO | CANCELADO`; `ENCERRADO` e `CANCELADO` são terminais
- **RN-06**: `clientId` e `numeroAtendimento` são imutáveis após criação

## 8. Integrações Externas

Nenhuma nesta feature.

## 9. Fora do Escopo (desta entrega)

- Listagem de amostras dentro do atendimento (retornada pelo módulo de Amostras via filtro)
- Cálculo automático de status do atendimento com base no status das amostras
- Notificação ao cliente sobre mudança de status
- Anexos ou documentos vinculados ao atendimento

## 10. Critérios de Aceite do MVP

- [ ] `POST /api/v1/attendances` cria atendimento com `numeroAtendimento` no formato `0001/2026`
- [ ] Dois atendimentos seguidos geram `0001/2026` e `0002/2026`
- [ ] `clientId` de outro tenant retorna `404`
- [ ] `GET /api/v1/attendances` retorna apenas atendimentos do tenant autenticado
- [ ] Filtros por `status`, `clientId` e `tipoColeta` funcionam
- [ ] Transição válida (`ABERTO → EM_ANDAMENTO`) retorna `200` com status atualizado
- [ ] Transição inválida (`ENCERRADO → ABERTO`) retorna `422`
- [ ] `VIEWER` recebe `403` ao tentar criar, editar ou deletar
- [ ] Nenhum endpoint retorna dados de outro tenant

## 11. Dependências e Pré-requisitos

- CRUD de Clientes implementado e em produção
- **Deve ser implementado antes do CRUD de Amostras** — Amostra referencia `attendanceId`
