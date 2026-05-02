# PRD — CRUD de Clientes

**Status**: Draft  
**Versão**: 1.0  
**Data**: 2026-05-01  
**Épico relacionado**: Semana 2 — Clientes & Amostras (CRUD)

---

## 1. Contexto e Objetivo

O laboratório precisa cadastrar seus clientes (pacientes PF ou empresas PJ) antes de registrar amostras e emitir laudos. Esta feature entrega o CRUD completo de clientes com isolamento multi-tenant, suporte a pessoa física e jurídica, e exclusão lógica para preservar o histórico de laudos futuros.

## 2. Usuários Afetados

| Role | Permissões |
|------|-----------|
| `ADMIN` | Criar, listar, visualizar, editar, excluir (soft delete) |
| `ANALYST` | Criar, listar, visualizar, editar |
| `VIEWER` | Listar, visualizar |

Todos os usuários são autenticados via JWT do painel do laboratório. Não há acesso público a este módulo.

## 3. Requisitos Funcionais

### RF-01 — Criar cliente
**Como** operador do laboratório, **quero** cadastrar um cliente (PF ou PJ), **para** vinculá-lo a amostras e laudos futuramente.

- Critérios de aceite:
  - [ ] Campo `tipoPessoa` aceita apenas `PF` ou `PJ`
  - [ ] Se `tipoPessoa = PF`, `documento` deve ter exatamente 11 dígitos (CPF)
  - [ ] Se `tipoPessoa = PJ`, `documento` deve ter exatamente 14 dígitos (CNPJ)
  - [ ] Documento duplicado dentro do mesmo tenant retorna `409`
  - [ ] Cliente criado com sucesso retorna `201` com os dados do cliente
  - [ ] `tenantId` é extraído do JWT — nunca do body

### RF-02 — Listar clientes
**Como** operador do laboratório, **quero** listar os clientes do meu laboratório com paginação, **para** localizar e gerenciar cadastros.

- Critérios de aceite:
  - [ ] Retorna apenas clientes ativos (`deletedAt IS NULL`) do tenant autenticado
  - [ ] Suporta paginação via `page` e `pageSize` (padrão: `page=1`, `pageSize=20`, máximo: `100`)
  - [ ] Resposta inclui metadados de paginação: `total`, `page`, `pageSize`, `totalPages`
  - [ ] Suporta filtro opcional por `tipoPessoa` (`PF` | `PJ`)
  - [ ] Suporta busca opcional por nome ou documento (query param `search`)

### RF-03 — Visualizar cliente
**Como** operador do laboratório, **quero** visualizar os detalhes de um cliente específico, **para** conferir seus dados antes de criar uma amostra ou laudo.

- Critérios de aceite:
  - [ ] Retorna `404` se o cliente não pertencer ao tenant autenticado
  - [ ] Retorna `404` se o cliente estiver soft-deletado

### RF-04 — Editar cliente
**Como** operador do laboratório, **quero** atualizar os dados de um cliente, **para** corrigir informações desatualizadas.

- Critérios de aceite:
  - [ ] Todos os campos são opcionais no body (PATCH semântico)
  - [ ] Se `documento` for alterado, revalida unicidade dentro do tenant (excluindo o próprio registro)
  - [ ] Se `tipoPessoa` for alterado, revalida o formato do `documento`
  - [ ] Retorna `404` se cliente não pertencer ao tenant ou estiver deletado
  - [ ] Retorna `409` se novo documento já existir para outro cliente do tenant

### RF-05 — Excluir cliente (soft delete)
**Como** administrador do laboratório, **quero** remover um cliente do cadastro ativo, **para** desativá-lo sem perder o histórico.

- Critérios de aceite:
  - [ ] Apenas role `ADMIN` pode executar esta operação — `ANALYST` e `VIEWER` recebem `403`
  - [ ] Preenche `deletedAt` com o timestamp atual (não remove do banco)
  - [ ] Cliente excluído não aparece em listagens nem em buscas por ID
  - [ ] Retorna `404` se cliente não pertencer ao tenant ou já estiver deletado
  - [ ] Retorna `204` em caso de sucesso

## 4. Requisitos Não-Funcionais

- **Segurança**: isolamento absoluto por `tenantId` — nenhuma query retorna dados de outro tenant; `tenantId` sempre vem do JWT
- **Autorização**: middleware `authenticate.js` obrigatório em todas as rotas; `DELETE` adiciona verificação de role `ADMIN`
- **Performance**: índice composto `(tenantId, deletedAt)` para filtrar ativos; índice `(tenantId, documento)` para checar unicidade
- **Validações**:
  - `nome`: obrigatório, string, mínimo 2 caracteres
  - `tipoPessoa`: obrigatório, enum `PF` | `PJ`
  - `documento`: obrigatório, apenas dígitos, 11 chars se PF / 14 chars se PJ
  - `email`: opcional, formato de e-mail válido
  - `telefone`: opcional, string
  - `endereco`: opcional, string
- **LGPD**: CPF, CNPJ e e-mail são dados pessoais — logs não devem expor esses valores; retenção mantida para fins de auditoria de laudos

## 5. Modelo de Dados

### Novo modelo Prisma

```prisma
enum TipoPessoa {
  PF
  PJ
}

model Client {
  id          String      @id @default(cuid())
  tenantId    String
  tipoPessoa  TipoPessoa
  nome        String
  documento   String
  email       String?
  telefone    String?
  endereco    String?
  deletedAt   DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  tenant      Tenant      @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, documento])
  @@index([tenantId])
  @@index([tenantId, deletedAt])
}
```

### Alterações em modelos existentes

Adicionar relação em `Tenant`:

```prisma
model Tenant {
  // ... campos existentes ...
  users    User[]
  clients  Client[]   // nova relação
}
```

## 6. API — Endpoints

| Método | Path | Auth | Role mínima | Descrição |
|--------|------|------|-------------|-----------|
| `POST` | `/api/v1/clients` | JWT Bearer | `ANALYST` | Criar cliente |
| `GET` | `/api/v1/clients` | JWT Bearer | `VIEWER` | Listar clientes (paginado) |
| `GET` | `/api/v1/clients/:id` | JWT Bearer | `VIEWER` | Visualizar cliente |
| `PATCH` | `/api/v1/clients/:id` | JWT Bearer | `ANALYST` | Editar cliente |
| `DELETE` | `/api/v1/clients/:id` | JWT Bearer | `ADMIN` | Soft delete cliente |

### Contratos de Request/Response

#### POST /api/v1/clients

**Request body:**
```json
{
  "tipoPessoa": "PF",
  "nome": "João da Silva",
  "documento": "12345678901",
  "email": "joao@email.com",
  "telefone": "11999990000",
  "endereco": "Rua das Flores, 123, São Paulo - SP"
}
```

**Response 201:**
```json
{
  "id": "clxabc123",
  "tenantId": "clxtenant456",
  "tipoPessoa": "PF",
  "nome": "João da Silva",
  "documento": "12345678901",
  "email": "joao@email.com",
  "telefone": "11999990000",
  "endereco": "Rua das Flores, 123, São Paulo - SP",
  "createdAt": "2026-05-01T10:00:00.000Z",
  "updatedAt": "2026-05-01T10:00:00.000Z"
}
```

**Erros possíveis:**
- `400` — campos inválidos (Zod), retorna `fieldErrors`
- `409` — documento já cadastrado no tenant
- `401` — token ausente ou inválido

---

#### GET /api/v1/clients

**Query params:**
- `page` (opcional, default `1`)
- `pageSize` (opcional, default `20`, máximo `100`)
- `tipoPessoa` (opcional, `PF` | `PJ`)
- `search` (opcional, busca por nome ou documento — `LIKE %valor%`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "clxabc123",
      "tipoPessoa": "PF",
      "nome": "João da Silva",
      "documento": "12345678901",
      "email": "joao@email.com",
      "telefone": "11999990000",
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

---

#### GET /api/v1/clients/:id

**Response 200:**
```json
{
  "id": "clxabc123",
  "tenantId": "clxtenant456",
  "tipoPessoa": "PF",
  "nome": "João da Silva",
  "documento": "12345678901",
  "email": "joao@email.com",
  "telefone": "11999990000",
  "endereco": "Rua das Flores, 123, São Paulo - SP",
  "createdAt": "2026-05-01T10:00:00.000Z",
  "updatedAt": "2026-05-01T10:00:00.000Z"
}
```

**Erros possíveis:**
- `404` — cliente não encontrado ou não pertence ao tenant

---

#### PATCH /api/v1/clients/:id

**Request body** (todos os campos opcionais):
```json
{
  "nome": "João da Silva Santos",
  "email": "joao.novo@email.com",
  "telefone": "11988880000"
}
```

**Response 200:** objeto atualizado no mesmo formato do GET /:id

**Erros possíveis:**
- `400` — campos inválidos
- `404` — cliente não encontrado ou não pertence ao tenant
- `409` — novo documento já existe para outro cliente do tenant

---

#### DELETE /api/v1/clients/:id

**Response 204:** sem body

**Erros possíveis:**
- `403` — role insuficiente (não é `ADMIN`)
- `404` — cliente não encontrado, não pertence ao tenant ou já deletado

## 7. Regras de Negócio

- **RN-01**: `tenantId` é sempre extraído do JWT — nunca aceito no body da requisição
- **RN-02**: Unicidade de `documento` é validada dentro do escopo do tenant (`tenantId + documento`)
- **RN-03**: Clientes com `deletedAt` preenchido são invisíveis em todas as operações (listagem, busca por ID, edição)
- **RN-04**: O campo `documento` deve conter apenas dígitos (sem pontuação como `.`, `-`, `/`)
- **RN-05**: Validação de formato de documento é por `tipoPessoa`: 11 dígitos para PF, 14 dígitos para PJ (formato, não dígito verificador)
- **RN-06**: `ANALYST` e `VIEWER` recebem `403` ao tentar excluir um cliente
- **RN-07**: A listagem retorna apenas clientes do tenant autenticado com `deletedAt IS NULL`

## 8. Integrações Externas

Nenhuma nesta feature.

## 9. Fora do Escopo (desta entrega)

- Validação de dígito verificador de CPF/CNPJ (apenas formato/tamanho)
- Restauração de clientes excluídos (soft delete sem restore)
- Histórico de alterações (audit log por campo)
- Importação de clientes via CSV
- Vínculo com amostras e laudos (feature da Semana 2/3)
- Busca avançada com múltiplos filtros combinados

## 10. Critérios de Aceite do MVP

- [ ] `POST /api/v1/clients` cria cliente PF e PJ com sucesso, retorna 201
- [ ] Documento duplicado no mesmo tenant retorna 409
- [ ] Documento de outro tenant pode ser igual (sem conflito)
- [ ] `GET /api/v1/clients` retorna paginação correta e só clientes do tenant
- [ ] `GET /api/v1/clients/:id` retorna 404 para ID de outro tenant
- [ ] `PATCH /api/v1/clients/:id` atualiza parcialmente sem sobrescrever campos não enviados
- [ ] `DELETE /api/v1/clients/:id` preenche `deletedAt` e o cliente some das listagens
- [ ] `ANALYST` recebe 403 ao tentar deletar
- [ ] `VIEWER` recebe 403 ao tentar criar, editar ou deletar
- [ ] Nenhuma rota retorna dados de outro tenant em nenhum cenário

## 11. Dependências e Pré-requisitos

- PE-002 concluído: Prisma configurado, modelos `Tenant` e `User` existentes, middleware `authenticate.js` funcional, padrão de validação Zod com `validate.js` disponível
- Migration do modelo `Client` deve ser aplicada antes do deploy (`npx prisma migrate deploy`)
