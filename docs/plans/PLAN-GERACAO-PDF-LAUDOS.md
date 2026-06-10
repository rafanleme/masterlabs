# PLAN — Geração de PDF de Laudos

**PRD relacionado**: [PRD-GERACAO-PDF-LAUDOS](../prd/PRD-GERACAO-PDF-LAUDOS.md)  
**Data**: 2026-06-10

---

## 1. Resumo da feature

Adicionar geração de PDF de laudos emitidos via `pdfkit`, com upload para a Storage API externa (`https://www.rtisolutionscode.com.br/storage`), versionamento por `PdfArtifact`, listagem de versões e download via proxy autenticado.

## 2. Alterações no Schema Prisma

### Novo modelo `PdfArtifact`

```prisma
model PdfArtifact {
  id          String   @id @default(cuid())
  tenantId    String
  reportId    String
  version     Int
  storagePath String   @db.VarChar(500)
  filename    String   @db.VarChar(255)
  size        Int
  createdById String
  createdAt   DateTime @default(now())

  tenant    Tenant @relation(fields: [tenantId], references: [id])
  report    Report @relation(fields: [reportId], references: [id])
  createdBy User   @relation(fields: [createdById], references: [id])

  @@unique([reportId, version])
  @@index([tenantId])
  @@index([reportId])
}
```

### Relações inversas adicionadas

- `Tenant.pdfArtifacts PdfArtifact[]`
- `Report.pdfArtifacts PdfArtifact[]`
- `User.pdfArtifacts PdfArtifact[]`

Sem breaking change, sem backfill necessário. Migration: `add_pdf_artifact`.

## 3. Arquivos a criar

```
src/lib/
└── storageClient.js                          — cliente HTTP da Storage API (upload + download)

src/modules/reports/pdf/
├── pdf.controller.js                          — 3 handlers (gerar, listar versões, baixar)
├── pdf.service.js                             — orquestra geração + upload + persistência + proxy
└── pdf.renderer.js                            — gera Buffer do PDF com pdfkit

tests/integration/
└── reports-pdf.test.js                        — testes de integração (com mock do storageClient)

docs/context/
└── geracao-pdf-laudos.md                      — documentação de contexto de negócio

docs/plans/
└── PLAN-GERACAO-PDF-LAUDOS.md                 — este plano
```

### Responsabilidades

- **`src/lib/storageClient.js`**: encapsula chamadas HTTP. Exporta `uploadFile({ buffer, filename, folder })` (retorna `{ path, filename, size }`) e `downloadFile(path)` (retorna Buffer). Lê `STORAGE_BASE_URL` e `STORAGE_API_KEY` do `config`. Mapeia erros HTTP em `Error` com `status` apropriado (401, 413, 415 → 502 no contexto da nossa API; timeout → 502).

- **`pdf.renderer.js`**: função pura `renderReportPdf(reportData) → Promise<Buffer>`. Recebe um objeto agregado (tenant + sample + client + report + items+assays) e devolve o Buffer do PDF. Toda a lógica de layout, sem dependência de Prisma.

- **`pdf.service.js`**: 3 funções:
  - `generatePdf(tenantId, reportId, userId)`: valida laudo (existe, mesmo tenant, status EMITIDO), agrega dados, chama renderer, faz upload, cria `PdfArtifact` em transação, retorna o artifact serializado.
  - `listVersions(tenantId, reportId)`: lista artifacts do laudo.
  - `streamDownload(tenantId, reportId, version)`: localiza o `PdfArtifact`, baixa via storageClient, retorna `{ buffer, filename, size }`.

- **`pdf.controller.js`**: 3 handlers HTTP que extraem params e chamam o service. O handler de download seta headers e envia o buffer com `res.end(buffer)`.

## 4. Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Adicionar `PdfArtifact` + relações inversas em `Tenant`, `Report`, `User` |
| `src/modules/reports/reports.routes.js` | Registrar 3 novas rotas `POST /:id/pdf`, `GET /:id/pdf-artifacts`, `GET /:id/pdf` |
| `src/config/index.js` | Adicionar `storage: { baseUrl, apiKey }` lendo `STORAGE_BASE_URL` e `STORAGE_API_KEY` |
| `.env.example` | Adicionar `STORAGE_BASE_URL` e `STORAGE_API_KEY` |
| `.env.development` | Adicionar `STORAGE_BASE_URL` e `STORAGE_API_KEY` (dev usa a Storage real ou um valor placeholder com mock no teste) |
| `package.json` | Adicionar deps `pdfkit`, `axios`, `form-data` |
| `postman/MasterLabs-API.postman_collection.json` | Adicionar pasta "Reports — PDF" com 3 requests |

## 5. Dependências externas novas

| Pacote | Justificativa |
|--------|---------------|
| `pdfkit` | Lib de geração programática de PDF. Decisão tomada no PRD. |
| `axios` | Cliente HTTP para chamar a Storage API. Suportado pela doc da Storage. Alternativa `fetch` nativo do Node 20 funciona, mas o exemplo da doc usa `axios` e padroniza com helper já existente em outros projetos do usuário. |
| `form-data` | Necessário para montar `multipart/form-data` com `Content-Type` correto ao usar `axios` no Node (o `FormData` global do Node 20 não funciona bem com axios). |

Os 3 são leves e estáveis. Sem ferramentas adicionais (sem buildpack, sem binário extra).

## 6. Sequência de implementação

1. **Schema Prisma**: adicionar `PdfArtifact` + relações inversas; rodar `npx prisma migrate dev --name add_pdf_artifact` (ou só `prisma generate` e deixar o usuário rodar a migration).
2. **Config + env**: atualizar `src/config/index.js` e `.env.example`.
3. **Instalar deps**: `pdfkit`, `axios`, `form-data`.
4. **`src/lib/storageClient.js`**: implementar `uploadFile` e `downloadFile`.
5. **`pdf.renderer.js`**: função `renderReportPdf` (puro, retorna Buffer).
6. **`pdf.service.js`**: `generatePdf`, `listVersions`, `streamDownload`.
7. **`pdf.controller.js`**: 3 handlers.
8. **`reports.routes.js`**: registrar as 3 novas rotas com `authenticate` + `authorize`.
9. **Testes de integração**: `tests/integration/reports-pdf.test.js` com `jest.mock` do storageClient.
10. **Documentação de contexto**: `docs/context/geracao-pdf-laudos.md`.
11. **Postman**: nova pasta "Reports — PDF" com 3 requests.

## 7. Riscos e decisões de design

### Decisões

- **Sub-pasta `pdf/` dentro de `reports/`**: PDF é parte do domínio de laudos, mas com responsabilidade isolada (renderização + storage externo). Sub-pasta evita inchar `reports.service.js` (já com 230 linhas) e mantém afinidade no mesmo módulo.

- **Mock do storageClient nos testes**: o projeto **não usa mocks** em outros testes (são 100% integração contra MySQL real). Aqui abrimos exceção porque:
  1. A Storage API é externa, sem garantia de estabilidade no ambiente de CI/dev
  2. Não queremos poluir o storage real com arquivos de teste a cada run
  3. O contrato HTTP é estável e simples — pode ser validado manualmente via Postman
  
  Registrar isso no doc de contexto.

- **Renderer puro (sem Prisma)**: o renderer recebe o objeto agregado já pronto. Facilita teste unitário do layout (se quisermos no futuro) e separa responsabilidades.

- **Download streaming vs buffer**: o PRD diz "streaming". Na prática, `axios` com `responseType: 'arraybuffer'` carrega tudo em memória. Para PDFs ≤ 10 MB isso é aceitável e simplifica o controller. **Decisão**: usar arraybuffer + `res.end(buffer)`. Streaming verdadeiro pode ser adicionado depois se houver pressão de memória.

- **`filename` no Content-Disposition**: usar `laudo-<numeroLaudoNormalizado>-v<version>.pdf` (com `/` → `-`). O `filename` salvo no artifact é o que a Storage API retornou (com hash) — usado apenas internamente.

### Riscos de multi-tenant

- Toda query do service filtra por `tenantId` do JWT — nunca confia em body/query.
- O `path` retornado pela Storage não revela o tenant fora da pasta (incluímos `tenantId` no path para auditoria interna, mas o storage não tem auth por tenant — confiar no nosso filtro Prisma).
- Endpoint de download valida o tenant no `PdfArtifact` antes de chamar a Storage.

### Riscos de robustez

- **Falha de upload**: se a Storage API falhar, **não** criamos o `PdfArtifact` (RN-07). A versão "não consumida" é coberta pelo cálculo `max(version)+1` no próximo retry, que naturalmente reusará o número.
- **Corrida em geração simultânea**: duas chamadas simultâneas no mesmo report tentariam criar versão N+1 igual. O `@@unique([reportId, version])` protege — a segunda recebe `P2002` e podemos retornar `409` ou re-calcular. **Decisão**: na primeira versão, deixar o `P2002` borbulhar como `502` (raro em uso real); melhoria futura: usar `SELECT ... FOR UPDATE` em transação.
- **Tamanho do PDF**: o pré-validação no upload (10 MB) é feita pela Storage. Antes de enviar, conferimos `buffer.length > 10 * 1024 * 1024` e abortamos com `502` "PDF gerado excede limite de 10 MB" para evitar round-trip.

### Riscos de segurança

- `STORAGE_API_KEY` lida só do env, nunca logada nem retornada em response.
- Endpoint de download sempre passa pelo backend (proxy).
- `storagePath` nunca exposto em response público (só log interno).

---

## 8. Confirmação solicitada

> Posso prosseguir com a implementação conforme este plano?
