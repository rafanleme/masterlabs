# PRD — Geração de PDF de Laudos

**Status**: Draft  
**Versão**: 1.0  
**Data**: 2026-06-10  
**Épico relacionado**: Semana 4 — Geração de Laudos (Parte 2: PDF)

---

## 1. Contexto e Objetivo

Após a emissão do laudo (entidade de dados, coberta pelo PRD anterior), o laboratório precisa entregar ao cliente um **documento PDF padronizado** contendo a identificação do laboratório, dados do cliente, dados da amostra, resultados dos ensaios com conformidade e observações.

Este PRD cobre a **geração, armazenamento, versionamento, listagem e download** do PDF de laudos emitidos. A geração é disparada **manualmente por endpoint dedicado** (não automática ao emitir), permite **histórico de versões** (regerar quando necessário) e usa a **Storage API externa** já em uso na infraestrutura (`https://www.rtisolutionscode.com.br/storage`).

**Fora do escopo desta entrega**: assinatura digital ICP-Brasil (Semana 5), carimbo de tempo, QR Code de verificação, logo do laboratório (apenas o espaço será reservado no layout), portal do cliente (Semana 6).

## 2. Usuários Afetados

| Perfil | Ações permitidas |
|--------|-----------------|
| ADMIN | Gerar PDF, listar versões, baixar |
| ANALYST | Gerar PDF, listar versões, baixar |
| VIEWER | Listar versões, baixar |

## 3. Requisitos Funcionais

### RF-01 — Gerar nova versão do PDF
**Como** ADMIN ou ANALYST, **quero** gerar o PDF de um laudo emitido, **para** disponibilizá-lo ao cliente.

- Critérios de aceite:
  - [ ] Disparado por `POST /api/v1/reports/:id/pdf`
  - [ ] Laudo precisa pertencer ao tenant do token — retorna `404` se inválido
  - [ ] Laudo precisa estar com `status = EMITIDO` — retorna `409` em outros status
  - [ ] PDF é construído com `pdfkit` em memória (sem persistência em disco local)
  - [ ] PDF é enviado à Storage API (`POST /upload.php`) na pasta `laudos/<tenantId>/<reportId>/`
  - [ ] Cria registro `PdfArtifact` com `version = max(version do report) + 1` (inicia em 1)
  - [ ] Persiste `storagePath`, `filename`, `size`, `createdById`, `createdAt`
  - [ ] Retorna `201` com o `PdfArtifact` criado (sem o binário)
  - [ ] Falhas da Storage API (timeout, 5xx, 4xx) não criam o `PdfArtifact` e retornam `502`

### RF-02 — Listar versões de PDF de um laudo
**Como** qualquer usuário autenticado, **quero** ver o histórico de PDFs gerados de um laudo, **para** auditar regerações e escolher qual versão baixar.

- Critérios de aceite:
  - [ ] Endpoint `GET /api/v1/reports/:id/pdf-artifacts`
  - [ ] Laudo precisa pertencer ao tenant — retorna `404` se inválido
  - [ ] Ordem decrescente por `version`
  - [ ] Retorna lista com: `id`, `version`, `filename`, `size`, `createdAt`, `createdBy` (id + nome)
  - [ ] Não expõe `storagePath` (informação interna)
  - [ ] Retorna `[]` se não houver versões geradas
  - [ ] Não exige paginação (volume baixo por laudo)

### RF-03 — Baixar PDF (proxy)
**Como** qualquer usuário autenticado, **quero** baixar o PDF de um laudo, **para** entregá-lo ao cliente.

- Critérios de aceite:
  - [ ] Endpoint `GET /api/v1/reports/:id/pdf`
  - [ ] Aceita query opcional `?version=N` — se omitido, retorna a última versão
  - [ ] Aceita query opcional `?inline=1` — define `Content-Disposition: inline` (default: `attachment`)
  - [ ] Laudo precisa pertencer ao tenant — retorna `404` se inválido
  - [ ] Versão específica precisa existir — retorna `404` se inválida
  - [ ] Backend baixa o arquivo da Storage API (`GET /download.php?path=...`) usando `X-API-Key`
  - [ ] Backend re-stream o conteúdo para o cliente com headers:
    - `Content-Type: application/pdf`
    - `Content-Length: <size do PdfArtifact>`
    - `Content-Disposition: attachment; filename="laudo-<numeroLaudo>-v<version>.pdf"` (ou `inline` se solicitado)
    - `Cache-Control: private, no-store`
  - [ ] Chave `STORAGE_API_KEY` **nunca** vaza no response

### RF-04 — Conteúdo do PDF
**Como** laboratório, **quero** que o PDF tenha um layout padronizado e completo, **para** garantir profissionalismo e rastreabilidade.

- Critérios de aceite (seções obrigatórias na ordem):
  - [ ] **Cabeçalho**: espaço reservado para logo (~80x80px, vazio por enquanto), razão social, CNPJ, endereço, email, telefone do Tenant
  - [ ] **Identificação do laudo**: "LAUDO Nº <numeroLaudo>" em destaque, data de emissão, responsável, status
  - [ ] **Dados do cliente**: nome, tipo (PF/PJ), documento (CPF/CNPJ formatado), email, telefone
  - [ ] **Dados da amostra**: número, data de coleta, data de recebimento, amostrador, ponto de coleta, condições (temperatura amostra/ambiente, umidade) quando preenchidos
  - [ ] **Resultados dos ensaios** (tabela): coluna `Ensaio`, `Unidade`, `Referência`, `Resultado`, `Conformidade`
    - Linhas na ordem de `ReportItem.ordem`
    - `Referência` exibe o critério do `Assay` (ex.: "≤ 10", "entre 5 e 8", "ND", texto livre)
    - `Conformidade` exibe `CONFORME` / `NÃO CONFORME` / `INCONCLUSIVO`
  - [ ] **Observações do laudo**: bloco com `Report.observacoes` (omitir bloco se vazio)
  - [ ] **Rodapé** (em todas as páginas): texto "Documento sem assinatura digital — sujeito a versão definitiva" + data/hora de geração + paginação "página X de Y"

## 4. Requisitos Não-Funcionais

- **Segurança**:
  - Isolamento multi-tenant em todos os endpoints (filtro `tenantId` no Prisma)
  - JWT Bearer obrigatório
  - `STORAGE_API_KEY` lida exclusivamente de env var; nunca exposta em response/log
  - Logs de geração e download incluem `tenantId`, `reportId`, `userId` e `version` — sem o conteúdo do PDF
- **Performance**:
  - Geração do PDF em memória deve concluir em < 2 s para laudos com até 30 ensaios
  - Upload à Storage API com timeout de 30 s
  - Download (proxy) usa streaming — não carrega o PDF inteiro em memória do backend
- **Validações**:
  - PDF gerado deve ser sempre ≤ 10 MB (limite da Storage API)
  - `version` é inteiro positivo, único por `reportId`
- **LGPD**:
  - PDF contém dados pessoais do cliente (nome, CPF/CNPJ, email) — armazenado em storage privado com auth
  - Download exige autenticação e isolamento de tenant; nunca é público
  - Logs não persistem conteúdo do PDF nem `storagePath` em texto plano em painéis externos

## 5. Modelo de Dados

### Novos modelos Prisma necessários

```prisma
model PdfArtifact {
  id            String   @id @default(cuid())
  tenantId      String
  reportId      String
  version       Int
  storagePath   String   @db.VarChar(500)
  filename      String   @db.VarChar(255)
  size          Int
  createdById   String
  createdAt     DateTime @default(now())

  tenant    Tenant @relation(fields: [tenantId], references: [id])
  report    Report @relation(fields: [reportId], references: [id])
  createdBy User   @relation(fields: [createdById], references: [id])

  @@unique([reportId, version])
  @@index([tenantId])
  @@index([reportId])
}
```

### Alterações em modelos existentes

- `Tenant`: adicionar relação inversa `pdfArtifacts PdfArtifact[]`
- `Report`: adicionar relação inversa `pdfArtifacts PdfArtifact[]`
- `User`: adicionar relação inversa `pdfArtifacts PdfArtifact[]`

> Observação: **não** será adicionado campo `logoPath` ao `Tenant` nesta entrega. O layout reserva o espaço, mas a inclusão real do logo é entrega futura.

## 6. API — Endpoints

| Método | Path | Auth | Roles | Descrição |
|--------|------|------|-------|-----------|
| POST | `/api/v1/reports/:id/pdf` | JWT Bearer | ADMIN, ANALYST | Gera nova versão do PDF e envia ao storage |
| GET  | `/api/v1/reports/:id/pdf-artifacts` | JWT Bearer | ADMIN, ANALYST, VIEWER | Lista versões geradas |
| GET  | `/api/v1/reports/:id/pdf` | JWT Bearer | ADMIN, ANALYST, VIEWER | Baixa PDF (última ou versão específica) |

### Contratos de Request/Response

#### POST /api/v1/reports/:id/pdf

**Request body:** vazio

**Response 201:**
```json
{
  "id": "clxyz...",
  "reportId": "clrep...",
  "version": 2,
  "filename": "a1b2c3d4e5f60718_laudo.pdf",
  "size": 245678,
  "createdAt": "2026-06-10T14:23:11.000Z",
  "createdBy": {
    "id": "cluser...",
    "name": "Maria Souza"
  }
}
```

**Erros possíveis:**
- `401` — token ausente/inválido
- `403` — role insuficiente (VIEWER)
- `404` — laudo não pertence ao tenant ou não existe
- `409` — laudo não está com status `EMITIDO`
- `502` — falha na Storage API (timeout, erro 5xx, extensão rejeitada, tamanho excedido)

#### GET /api/v1/reports/:id/pdf-artifacts

**Response 200:**
```json
[
  {
    "id": "clxyz2...",
    "version": 2,
    "filename": "a1b2c3d4e5f60718_laudo.pdf",
    "size": 245678,
    "createdAt": "2026-06-10T14:23:11.000Z",
    "createdBy": { "id": "cluser...", "name": "Maria Souza" }
  },
  {
    "id": "clxyz1...",
    "version": 1,
    "filename": "f9e8d7c6b5a40312_laudo.pdf",
    "size": 244112,
    "createdAt": "2026-06-09T10:11:02.000Z",
    "createdBy": { "id": "cluser2...", "name": "João Lima" }
  }
]
```

**Erros possíveis:**
- `401` — token ausente/inválido
- `404` — laudo não pertence ao tenant ou não existe

#### GET /api/v1/reports/:id/pdf

**Query params:**
- `version` (opcional, inteiro ≥ 1) — versão específica; default: última
- `inline` (opcional, `0` ou `1`) — abre no browser em vez de baixar; default: `0`

**Response 200:**
```
Content-Type: application/pdf
Content-Length: 245678
Content-Disposition: attachment; filename="laudo-0001-2026-v2.pdf"
Cache-Control: private, no-store

<bytes binários>
```

**Erros possíveis:**
- `401` — token ausente/inválido
- `404` — laudo não pertence ao tenant, ou versão informada não existe, ou nenhum PDF foi gerado ainda
- `502` — falha na Storage API ao baixar

## 7. Regras de Negócio

- **RN-01**: PDF só pode ser gerado quando `Report.status = EMITIDO`. Tentativas em `RASCUNHO` ou `CANCELADO` retornam `409`.
- **RN-02**: Cada chamada bem-sucedida ao endpoint de geração cria **uma nova versão** — não há sobrescrita. A versão antiga continua acessível para download.
- **RN-03**: `version` é sequencial por `reportId`, começando em 1. Calculado como `max(version) + 1` dentro de transação para evitar corrida.
- **RN-04**: O `storagePath` retornado pela Storage API é o identificador canônico do arquivo no storage. Não tentar reconstruir a partir de `filename`.
- **RN-05**: Cancelamento ou edição do laudo após PDFs gerados **não** invalida nem remove os artefatos. Eles permanecem para auditoria.
- **RN-06**: A pasta no storage segue o padrão `laudos/<tenantId>/<reportId>/`. O nome de arquivo enviado é `laudo-<numeroLaudoNormalizado>-v<version>.pdf` (ex.: `laudo-0001-2026-v1.pdf`); o storage prefixa com hash de 16 chars.
- **RN-07**: Falha de upload é tratada como atômica — se a Storage API retornar erro, **nenhum** `PdfArtifact` é criado e a versão não é consumida.
- **RN-08**: O endpoint de download nunca retorna o `storagePath` no response — só o binário.
- **RN-09**: Para o número do laudo no nome do arquivo, normalizar `0001/2026` → `0001-2026` (substituir `/` por `-`).

## 8. Integrações Externas

### Storage API

- **Base URL**: `https://www.rtisolutionscode.com.br/storage` (env var `STORAGE_BASE_URL`)
- **Autenticação**: header `X-API-Key: <STORAGE_API_KEY>` em todas as requisições
- **Upload**: `POST /upload.php` — `multipart/form-data` com campos `file` (binário PDF) e `folder` (`laudos/<tenantId>/<reportId>`)
  - Sucesso: `200` com `{ ok, filename, folder, path, size }` — persistir `path` em `PdfArtifact.storagePath` e `filename` em `PdfArtifact.filename`
  - Falhas relevantes: `413` (>10 MB), `415` (extensão), `401` (chave), `5xx`
- **Download**: `GET /download.php?path=<storagePath>` — retorna binário do arquivo
- **Implementação**: helper `src/shared/storage/storageClient.js` com funções `uploadFile(buffer, filename, folder)` e `downloadFile(path)` usando `axios` + `form-data`
- **Timeouts**: 30 s para upload e download

### Variáveis de ambiente novas

| Nome | Obrigatória | Descrição |
|------|-------------|-----------|
| `STORAGE_BASE_URL` | Sim | URL base da Storage API |
| `STORAGE_API_KEY` | Sim | Chave de acesso `X-API-Key` |

Adicionar ambas ao `.env.example` (sem valores reais) e às Config Vars do Heroku (stage e prod).

### Dependências novas no `package.json`

- `pdfkit` — geração do PDF
- `axios` — cliente HTTP para Storage API
- `form-data` — montagem do `multipart/form-data` no upload

## 9. Fora do Escopo (desta entrega)

- Assinatura digital ICP-Brasil (Semana 5)
- Carimbo de tempo
- QR Code de verificação no rodapé
- Upload e renderização do logo do laboratório (apenas o espaço será reservado no layout)
- Portal do cliente para download (Semana 6)
- Envio do PDF por e-mail
- Exclusão de versões antigas / política de retenção
- Configuração de cores/marca por tenant
- Internacionalização do PDF (será sempre pt-BR)

## 10. Critérios de Aceite do MVP

- [ ] `POST /api/v1/reports/:id/pdf` gera o PDF de um laudo EMITIDO, envia ao storage e cria `PdfArtifact` com `version = 1`
- [ ] Segunda chamada no mesmo laudo cria `PdfArtifact` com `version = 2` (sem sobrescrever a v1)
- [ ] Tentativa em laudo `RASCUNHO` retorna `409`
- [ ] Tentativa em laudo de outro tenant retorna `404`
- [ ] VIEWER recebe `403` ao tentar gerar
- [ ] `GET /api/v1/reports/:id/pdf-artifacts` lista as duas versões ordenadas decrescente
- [ ] `GET /api/v1/reports/:id/pdf` sem `?version` retorna a v2; com `?version=1` retorna a v1
- [ ] `GET /api/v1/reports/:id/pdf?inline=1` retorna `Content-Disposition: inline`
- [ ] PDF aberto em visualizador contém: cabeçalho com dados do tenant, identificação do laudo, dados do cliente, dados da amostra, tabela de ensaios com conformidade, observações (se houver) e rodapé com paginação
- [ ] Espaço para o logo está reservado no cabeçalho (área visualmente delimitada e vazia)
- [ ] Falha simulada da Storage API (401/500/timeout) **não** cria `PdfArtifact` e retorna `502`
- [ ] `STORAGE_API_KEY` não aparece em nenhum response nem em log
- [ ] Tamanho do PDF gerado em laudo padrão (≤ 10 ensaios) fica abaixo de 200 KB

## 11. Dependências e Pré-requisitos

- **Implementado**: módulo `reports` com CRUD e emissão (PRD-EMISSAO-LAUDOS concluído)
- **Implementado**: módulos `tenant`, `clients`, `samples`, `assays`, `report-templates`
- **Externo**: Storage API operacional em `https://www.rtisolutionscode.com.br/storage` com chave de acesso provisionada
- **Config**: env vars `STORAGE_BASE_URL` e `STORAGE_API_KEY` configuradas em stage e prod no Heroku
- **Migration**: criação da tabela `PdfArtifact` antes do deploy do código
