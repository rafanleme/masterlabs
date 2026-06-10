# Contexto — Geração de PDF de Laudos

**Última atualização**: 2026-06-10  
**Features relacionadas**: [PRD-GERACAO-PDF-LAUDOS](../prd/PRD-GERACAO-PDF-LAUDOS.md), [PRD-EMISSAO-LAUDOS](../prd/PRD-EMISSAO-LAUDOS.md)

---

## O que é este fluxo

Depois que o laboratório finaliza a análise e emite o laudo (status passa de `RASCUNHO` para `EMITIDO`), ele precisa entregar ao cliente um **documento PDF padronizado** com a identificação do laboratório, dados do cliente, dados da amostra, resultados dos ensaios com conformidade e observações.

Este fluxo é responsável por:

1. Gerar o PDF do laudo sob demanda
2. Armazenar o arquivo em um storage externo seguro
3. Manter o histórico de versões — cada geração cria uma nova versão imutável
4. Permitir que usuários autorizados baixem qualquer versão

A geração **não é automática** ao emitir o laudo. Ela é disparada manualmente pelo operador via um endpoint específico, o que permite revisar os dados antes de comprometer o tempo de processamento e o espaço no storage.

Esta entrega cobre o ciclo de PDF "sem assinatura digital" — o rodapé exibe um aviso indicando que o documento ainda não tem valor jurídico definitivo. A assinatura ICP-Brasil é entrega de uma feature posterior (Semana 5 do roadmap).

## Atores envolvidos

| Ator | Papel no fluxo |
|------|---------------|
| Administrador do laboratório | Gera PDF, lista versões, baixa qualquer versão |
| Analista | Gera PDF, lista versões, baixa qualquer versão |
| Visualizador | Lista versões e baixa — não pode gerar |
| Cliente final (paciente / empresa) | Recebe o PDF entregue pelo laboratório (esta entrega ainda não tem portal do cliente) |

## Fluxo principal (happy path)

1. Analista finaliza o registro de todos os resultados no laudo
2. Analista altera o status do laudo de `RASCUNHO` para `EMITIDO`
3. Analista solicita a geração do PDF via `POST /api/v1/reports/:id/pdf`
4. Sistema monta o PDF com cabeçalho do laboratório, dados do cliente, dados da amostra, tabela de resultados e observações
5. Sistema envia o arquivo para a Storage API externa
6. Sistema registra um `PdfArtifact` versão 1 vinculado ao laudo
7. Sistema retorna ao operador os metadados do artefato (id, versão, tamanho, quando, quem gerou)
8. Operador entrega o PDF ao cliente baixando via `GET /api/v1/reports/:id/pdf`

## Fluxos alternativos e exceções

### Regeneração — correção de dados ou re-emissão

Se um erro for percebido depois da geração (ex.: observação errada, responsável errado), o operador pode editar o laudo enquanto ele estiver em `RASCUNHO`. Para laudos já `EMITIDO`, edição direta não é permitida — porém, **uma nova chamada ao endpoint de geração de PDF cria uma versão nova** sem apagar a anterior. O histórico fica preservado para auditoria.

### Tentativa de gerar PDF de laudo não-emitido

Bloqueada com `409 Conflict`. O sistema só aceita gerar PDF de laudos com status `EMITIDO`. Rascunhos têm dados em construção; cancelados não devem produzir novos artefatos.

### Falha na Storage API

Se o upload para a Storage API falhar (timeout, 5xx, autenticação), **nenhuma versão é gravada no banco**. O operador recebe `502 Bad Gateway` e pode tentar novamente. O número de versão "não é consumido" — a próxima tentativa bem-sucedida ocupará o número seguinte natural.

### Geração simultânea no mesmo laudo

Dois operadores clicando em "gerar PDF" ao mesmo tempo competem pelo mesmo número de versão. O banco impede colisão (`unique [reportId, version]`), e a segunda tentativa recebe erro. Esse cenário é raro na prática e será endurecido em entrega posterior se necessário.

## Regras de negócio importantes

- **RN-01**: PDF só pode ser gerado para laudos com status `EMITIDO`.
- **RN-02**: Cada geração cria uma nova versão imutável — não há sobrescrita.
- **RN-03**: As versões são sequenciais por laudo, começando em 1.
- **RN-04**: Cancelar ou regerar não remove versões anteriores — o histórico é preservado para fins de auditoria.
- **RN-05**: O PDF gerado **não tem valor jurídico definitivo** nesta entrega. O rodapé deixa isso explícito. A assinatura digital ICP-Brasil será adicionada na próxima feature.
- **RN-06**: O conteúdo do PDF é montado a partir do snapshot atual dos dados (laboratório, cliente, amostra, ensaios e resultados). Se algum cadastro for alterado depois, isso só aparecerá em uma nova geração.
- **RN-07**: O download é feito sempre via backend (proxy) — o cliente nunca recebe credenciais da Storage. Cada download é autenticado pelo JWT do usuário e isolado pelo tenant.
- **RN-08**: O laboratório terá um espaço reservado para logo no cabeçalho do PDF, mas a entrega atual não exibe o logo — apenas a área delimitada.

## Dados envolvidos

| Entidade | Papel no fluxo |
|----------|---------------|
| **Laboratório (Tenant)** | Identificação no cabeçalho do PDF (razão social, CNPJ, endereço, contato) |
| **Cliente** | Identificação do destinatário do laudo (nome, documento, contato) |
| **Amostra** | Identificação física do material analisado (número, datas, condições de coleta) |
| **Laudo (Report)** | O documento em si — número, status, data de emissão, responsável |
| **Itens do laudo (ReportItem)** | Cada ensaio realizado, com valor obtido e conformidade |
| **Ensaios (Assay)** | Definição do que está sendo medido — unidade, faixa de referência |
| **Versão de PDF (PdfArtifact)** | Cada geração concreta — versão, caminho no storage, tamanho, autor, momento |

## Restrições e isolamento

- Cada laboratório só enxerga seus próprios laudos e versões de PDF. O isolamento é feito automaticamente pelo `tenantId` derivado do JWT do usuário autenticado.
- Embora a Storage API externa não diferencie por laboratório nas suas pastas, o backend nunca permite que um usuário baixe ou liste versões de um laudo que não pertence ao seu laboratório.
- Credenciais da Storage API existem só no servidor — não trafegam até o navegador.

## Endpoints da API

| Operação | Método | Path | Roles |
|----------|--------|------|-------|
| Gerar nova versão de PDF | POST | `/api/v1/reports/:id/pdf` | ADMIN, ANALYST |
| Listar versões geradas | GET  | `/api/v1/reports/:id/pdf-artifacts` | ADMIN, ANALYST, VIEWER |
| Baixar PDF (última ou versão específica) | GET  | `/api/v1/reports/:id/pdf?version=N&inline=0\|1` | ADMIN, ANALYST, VIEWER |

## Decisões técnicas relevantes

- **Biblioteca de geração**: `pdfkit` (programático, sem dependência de browser). Foi escolhida porque é leve, roda no Heroku sem buildpack adicional e é a mesma usada em outros projetos do mesmo time.
- **Storage**: serviço externo `https://www.rtisolutionscode.com.br/storage`, autenticado por `X-API-Key`. As variáveis `STORAGE_BASE_URL` e `STORAGE_API_KEY` ficam apenas no servidor.
- **Mock nos testes**: os testes de integração mockam o `storageClient` — exceção ao padrão "tudo integrado" do projeto. Justificativa: a Storage API é externa, não temos garantia de disponibilidade em CI, e não queremos poluir o storage real com arquivos de teste a cada execução. O contrato HTTP simples permite validar a integração manualmente via Postman.

## Histórico de alterações

| Data | Feature | Descrição da mudança |
|------|---------|----------------------|
| 2026-06-10 | Geração de PDF de Laudos (Semana 4 — parte 2) | Criação inicial do fluxo: geração, versionamento, listagem e download via proxy |
