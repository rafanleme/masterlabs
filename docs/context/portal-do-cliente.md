# Contexto — Portal do Cliente (Magic Code)

**Última atualização**: 2026-09-03

---

## O que é este fluxo

O cliente final do laboratório (paciente/empresa) acessa os próprios laudos sem senha fixa: informa o e-mail, recebe um código de 6 dígitos por e-mail e o troca por um token de acesso de curta duração (scope `portal`). Com o token, lista os laudos **EMITIDOS** vinculados às suas amostras e baixa a última versão do PDF.

## Endpoints

- `POST /api/v1/portal/auth/request-code` — `{ email }`; resposta **sempre genérica** (não revela se o e-mail está cadastrado)
- `POST /api/v1/portal/auth/verify` — `{ email, code, tenantId? }`; retorna `{ token, client }`
- `GET /api/v1/portal/me` — dados do cliente autenticado
- `GET /api/v1/portal/reports` — lista paginada dos próprios laudos EMITIDOS (com flag `pdfDisponivel`)
- `GET /api/v1/portal/reports/:id/pdf` — baixa a última versão do PDF (proxy pela Storage API)

## Regras de segurança

- **RN-01**: código de 6 dígitos gerado com `crypto.randomInt`, armazenado apenas como hash bcrypt (`ClientAccessCode`).
- **RN-02**: expira em 15 min (`PORTAL_CODE_TTL_MINUTES`), é single-use (todos os códigos pendentes do cliente são consumidos na verificação) e aceita no máximo 5 tentativas erradas (`PORTAL_MAX_VERIFY_ATTEMPTS`).
- **RN-03**: throttle por e-mail no banco — máx. 3 códigos/hora por cliente (`PORTAL_MAX_CODES_PER_HOUR`) → `429`. Independente do rate limit HTTP, que também cobre esses endpoints.
- **RN-04**: token do portal carrega `{ clientId, tenantId, scope: 'portal' }`, expira em 1h e **não** dá acesso às rotas internas (o middleware `authenticate` rejeita scope `portal`); tokens internos também não acessam o portal.
- **RN-05**: todas as queries filtram por `tenantId` + `sample.clientId` do token — o cliente nunca enxerga laudos de outros clientes/tenants.
- **RN-06**: se o mesmo e-mail for cliente de mais de um laboratório, a verificação retorna `409` com `labs: [{ tenantId, nomeFantasia }]` — repetir o verify com `tenantId`.

## E-mail

`src/lib/mailer.js` usa SMTP genérico via `nodemailer` quando `SMTP_HOST` está configurado. Sem SMTP (dev/test), o conteúdo é apenas logado — nenhum e-mail sai. Para produção, configurar `SMTP_*` e `MAIL_FROM` (com domínio próprio + SPF/DKIM/DMARC para entregabilidade).

## Decisões

- **Um código por cliente-registro**: se o e-mail existe em N laboratórios, o mesmo código é registrado para os N clientes; a desambiguação acontece no verify (não na solicitação) para não vazar em quais labs o e-mail existe antes de provar posse do código.
- **Testes com mock do mailer**: exceção à regra "sem mocks" (mesma justificativa do storageClient) — o código só sai no e-mail, então o teste captura o texto enviado.
