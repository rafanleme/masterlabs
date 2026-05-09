# PRD — CRUD de Ensaios

**Status**: Draft  
**Versão**: 1.0  
**Data**: 2026-05-06  
**Épico relacionado**: Semana 3 — Ensaios & Modelos de Laudo

---

## 1. Contexto e Objetivo

Ensaio é a entidade de catálogo que representa um tipo de análise laboratorial (ex: "pH da água", "Contagem de coliformes totais", "DBO5"). Cada laboratório mantém seu próprio catálogo de ensaios, que serão selecionados na composição de laudos.

A feature entrega o CRUD completo de ensaios, incluindo método analítico e estrutura de valor de referência projetada para suportar verificação automática de conformidade na feature futura de emissão de laudos.

## 2. Usuários Afetados

| Perfil | Ações permitidas |
|--------|-----------------|
| ADMIN | Criar, editar, listar, visualizar e desativar ensaios |
| ANALYST | Criar, editar, listar e visualizar ensaios |
| VIEWER | Listar e visualizar ensaios |

## 3. Requisitos Funcionais

### RF-01 — Cadastrar ensaio
**Como** ADMIN ou ANALYST, **quero** cadastrar um ensaio no catálogo do laboratório, **para** que ele possa ser selecionado na composição de laudos.

- Critérios de aceite:
  - [ ] Campos obrigatórios: `nome`, `unidade`
  - [ ] Campos opcionais: `descricao`, `metodoAnalitico`, `tipoComparacao`, `limiteMinimo`, `limiteMaximo`, `valorReferencia`
  - [ ] Retorna `201` com o ensaio criado
  - [ ] Ensaio pertence ao tenant do token — nunca ao de outro
  - [ ] `nome` é único por tenant (case-insensitive não requerido, mas `@@unique([tenantId, nome])`)

### RF-02 — Listar ensaios com paginação
**Como** qualquer usuário autenticado, **quero** listar os ensaios do meu laboratório, **para** consultar o catálogo disponível.

- Critérios de aceite:
  - [ ] Retorna apenas ensaios do tenant do token
  - [ ] Não retorna registros com `deletedAt != null`
  - [ ] Suporta `page` e `pageSize` (padrão: página 1, 20 itens)
  - [ ] Retorna envelope `{ data: [], pagination: { page, pageSize, total } }`
  - [ ] Suporta filtro por `?search=<texto>` que busca em `nome`

### RF-03 — Visualizar ensaio por ID
**Como** qualquer usuário autenticado, **quero** visualizar um ensaio pelo ID, **para** consultar todos os seus dados.

- Critérios de aceite:
  - [ ] Retorna `404` se não existir ou pertencer a outro tenant
  - [ ] Retorna `404` se estiver soft-deletado

### RF-04 — Editar ensaio
**Como** ADMIN ou ANALYST, **quero** editar os dados de um ensaio, **para** corrigir ou atualizar informações do catálogo.

- Critérios de aceite:
  - [ ] Aceita qualquer subconjunto dos campos editáveis (PATCH parcial)
  - [ ] Campos não editáveis: `id`, `tenantId`, `createdAt`
  - [ ] Retorna `404` se ensaio não existir no tenant
  - [ ] Retorna `409` se o novo `nome` já existir no tenant

### RF-05 — Desativar ensaio (soft delete)
**Como** ADMIN, **quero** desativar um ensaio, **para** removê-lo do catálogo sem apagar o histórico de laudos que o utilizam.

- Critérios de aceite:
  - [ ] Apenas ADMIN pode desativar
  - [ ] Preenche `deletedAt` com timestamp atual
  - [ ] Retorna `204`
  - [ ] Ensaio desativado não aparece em listagens nem em GET por ID

## 4. Requisitos Não-Funcionais

- **Segurança**: todo acesso filtra por `tenantId` extraído do JWT — nunca do body
- **Validações**:
  - `nome`: string, 1–200 chars, obrigatório
  - `unidade`: string, 1–50 chars, obrigatório (ex: "mg/L", "UFC/100mL", "°C")
  - `descricao`: string opcional, máx 1000 chars
  - `metodoAnalitico`: string opcional, máx 200 chars (ex: "ABNT NBR 9898", "EPA 600/4-85")
  - `tipoComparacao`: enum opcional — `MENOR_QUE | MAIOR_QUE | MENOR_IGUAL | MAIOR_IGUAL | ENTRE | TEXTO`
  - `limiteMinimo`: Float opcional — obrigatório se `tipoComparacao = ENTRE`
  - `limiteMaximo`: Float opcional — obrigatório se `tipoComparacao` for `ENTRE`, `MENOR_QUE` ou `MENOR_IGUAL`; para `MAIOR_QUE`/`MAIOR_IGUAL` usa `limiteMinimo`
  - `valorReferencia`: string opcional, máx 500 chars — obrigatório se `tipoComparacao = TEXTO`
  - Se `tipoComparacao` é numérico, `valorReferencia` pode ser fornecido como texto de exibição (ex: "≤ 0,5 mg/L") mas não é obrigatório
- **LGPD**: ensaios não contêm dados pessoais

## 5. Modelo de Dados

### Novo enum Prisma

```prisma
enum TipoComparacao {
  MENOR_QUE
  MAIOR_QUE
  MENOR_IGUAL
  MAIOR_IGUAL
  ENTRE
  TEXTO
}
```

### Novo modelo Prisma

```prisma
model Assay {
  id               String          @id @default(cuid())
  tenantId         String
  nome             String
  unidade          String
  descricao        String?
  metodoAnalitico  String?
  tipoComparacao   TipoComparacao?
  limiteMinimo     Float?
  limiteMaximo     Float?
  valorReferencia  String?
  deletedAt        DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  tenant           Tenant          @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, nome])
  @@index([tenantId])
  @@index([tenantId, deletedAt])
}
```

### Alterações em modelos existentes

Adicionar relação no modelo `Tenant`:

```prisma
assays  Assay[]
```

## 6. API — Endpoints

| Método | Path | Roles | Descrição |
|--------|------|-------|-----------|
| POST | /api/v1/assays | ADMIN, ANALYST | Cadastrar ensaio |
| GET | /api/v1/assays | ADMIN, ANALYST, VIEWER | Listar ensaios (paginado) |
| GET | /api/v1/assays/:id | ADMIN, ANALYST, VIEWER | Visualizar ensaio |
| PATCH | /api/v1/assays/:id | ADMIN, ANALYST | Editar ensaio |
| DELETE | /api/v1/assays/:id | ADMIN | Desativar ensaio |

### Contratos de Request/Response

#### POST /api/v1/assays

**Request body:**
```json
{
  "nome": "pH da Água",
  "unidade": "unidade de pH",
  "descricao": "Determinação do pH por eletrometria",
  "metodoAnalitico": "ABNT NBR 9898",
  "tipoComparacao": "ENTRE",
  "limiteMinimo": 6.0,
  "limiteMaximo": 9.5,
  "valorReferencia": "6,0 a 9,5"
}
```

**Response 201:**
```json
{
  "id": "cuid",
  "tenantId": "cuid",
  "nome": "pH da Água",
  "unidade": "unidade de pH",
  "descricao": "Determinação do pH por eletrometria",
  "metodoAnalitico": "ABNT NBR 9898",
  "tipoComparacao": "ENTRE",
  "limiteMinimo": 6.0,
  "limiteMaximo": 9.5,
  "valorReferencia": "6,0 a 9,5",
  "deletedAt": null,
  "createdAt": "2026-05-06T10:00:00.000Z",
  "updatedAt": "2026-05-06T10:00:00.000Z"
}
```

**Erros possíveis:**
- `400` — campos obrigatórios ausentes ou inválidos
- `401` — sem token
- `403` — role VIEWER
- `409` — nome já existe no tenant

#### GET /api/v1/assays

**Query params:** `page` (default 1), `pageSize` (default 20), `search` (filtra em `nome`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "cuid",
      "nome": "pH da Água",
      "unidade": "unidade de pH",
      "metodoAnalitico": "ABNT NBR 9898",
      "tipoComparacao": "ENTRE",
      "limiteMinimo": 6.0,
      "limiteMaximo": 9.5,
      "valorReferencia": "6,0 a 9,5",
      "createdAt": "2026-05-06T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42
  }
}
```

#### GET /api/v1/assays/:id

**Response 200:** objeto completo (mesmo formato do POST 201)

**Erros possíveis:**
- `401` — sem token
- `404` — não encontrado ou de outro tenant

#### PATCH /api/v1/assays/:id

**Request body:** qualquer subconjunto dos campos editáveis
```json
{
  "metodoAnalitico": "EPA 150.1",
  "limiteMaximo": 9.0
}
```

**Response 200:** objeto atualizado completo

**Erros possíveis:**
- `400` — campos inválidos
- `401` — sem token
- `403` — role VIEWER
- `404` — não encontrado ou de outro tenant
- `409` — nome já existe no tenant

#### DELETE /api/v1/assays/:id

**Response 204:** sem body

**Erros possíveis:**
- `401` — sem token
- `403` — role ANALYST ou VIEWER
- `404` — não encontrado ou de outro tenant

## 7. Regras de Negócio

- **RN-01**: Ensaio pertence exclusivamente ao tenant do operador — isolamento garantido em todas as operações
- **RN-02**: `nome` é único por tenant — dois ensaios do mesmo laboratório não podem ter o mesmo nome
- **RN-03**: Se `tipoComparacao = ENTRE`, `limiteMinimo` e `limiteMaximo` são obrigatórios
- **RN-04**: Se `tipoComparacao = MENOR_QUE` ou `MENOR_IGUAL`, `limiteMaximo` é obrigatório
- **RN-05**: Se `tipoComparacao = MAIOR_QUE` ou `MAIOR_IGUAL`, `limiteMinimo` é obrigatório
- **RN-06**: Se `tipoComparacao = TEXTO`, `valorReferencia` é obrigatório
- **RN-07**: Soft delete — ensaio desativado não aparece em listagens mas permanece referenciado em laudos históricos
- **RN-08**: `valorReferencia` para tipos numéricos é opcional e serve apenas para exibição formatada (ex: "≤ 0,5 mg/L")
- **RN-09**: A verificação de conformidade do resultado (comparar valor do resultado com limites do ensaio) é responsabilidade da feature de Laudos — o Ensaio apenas armazena os parâmetros de referência

## 8. Integrações Externas

Nenhuma nesta feature.

## 9. Fora do Escopo (desta entrega)

- Associação de ensaios a laudos (feature de Laudos)
- Verificação automática de conformidade do resultado
- Importação em lote de catálogo de ensaios
- Compartilhamento de catálogo entre tenants
- Versionamento de ensaio (mudança de método analítico ao longo do tempo)

## 10. Critérios de Aceite do MVP

- [ ] POST /api/v1/assays cria ensaio e retorna 201 com `tipoComparacao = ENTRE` e limites numéricos
- [ ] POST /api/v1/assays cria ensaio com `tipoComparacao = TEXTO` e `valorReferencia`
- [ ] POST /api/v1/assays retorna 400 quando `tipoComparacao = ENTRE` mas `limiteMinimo` está ausente
- [ ] GET /api/v1/assays retorna apenas ensaios do tenant do token
- [ ] GET /api/v1/assays?search=pH filtra por nome
- [ ] PATCH /api/v1/assays/:id atualiza parcialmente
- [ ] DELETE /api/v1/assays/:id retorna 204 e ensaio some da listagem
- [ ] Operações de outro tenant retornam 404
- [ ] VIEWER não pode criar, editar ou deletar (403)
- [ ] ANALYST não pode deletar (403)

## 11. Dependências e Pré-requisitos

- Tenant + Auth implementados ✅
- Middleware `authenticate` e `authorize` disponíveis ✅
- Middleware `validate` (Zod) disponível ✅
- Padrão de módulos estabelecido (validation, service, controller, routes) ✅
- Ensaios não dependem de Clientes, Atendimentos ou Amostras
