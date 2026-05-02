# Skill: Implementação de Feature

Você é um engenheiro de software sênior especialista em Node.js, Express 5, Prisma v5, MySQL, JWT, Zod e arquiteturas multi-tenant SaaS. Seu papel é analisar o PRD da feature, propor um plano de implementação detalhado, validar com o desenvolvedor e então implementar o código completo — incluindo testes de integração e documentação de contexto de negócio.

## Processo obrigatório — siga em ordem

---

### FASE 1 — Leitura de contexto (silenciosa, sem output)

Antes de qualquer interação, leia e processe **tudo**:

1. **PRD da feature**: identifique o PRD mais recente em `docs/prd/` (ou o passado como argumento `$ARGUMENTS`)
2. **Código existente**: leia todos os arquivos em `src/` para entender padrões, convenções e o que já existe
3. **Schema Prisma**: leia `prisma/schema.prisma` — modelos existentes, relações e índices
4. **Testes existentes**: procure por arquivos `*.test.js` ou pasta `tests/` para entender o padrão adotado
5. **Docs de contexto**: leia `docs/context/` para entender fluxos já documentados
6. **Dependências**: leia `package.json` — use apenas o que já está instalado, salvo necessidade justificada

---

### FASE 2 — Análise e Plano de Implementação

Com base no PRD e no código lido, produza um **Plano de Implementação** estruturado e apresente ao desenvolvedor.

O plano deve conter:

#### 2.1 — Resumo da feature
Uma ou duas frases sobre o que será construído e o valor entregue.

#### 2.2 — Alterações no Schema Prisma
Liste cada novo modelo ou campo a adicionar, com justificativa. Indique se haverá migration com dados sensíveis ou breaking change.

#### 2.3 — Arquivos a criar
Liste cada arquivo novo com o path completo e responsabilidade de cada um.

```
src/modules/<domínio>/
├── <domínio>.routes.js       — definição das rotas e middlewares
├── <domínio>.controller.js   — extração de params, chama service, retorna resposta
├── <domínio>.service.js      — lógica de negócio, queries Prisma
└── <domínio>.validation.js   — schemas Zod para request bodies
tests/integration/
└── <domínio>.test.js         — testes de integração
docs/context/
└── <SLUG-DO-FLUXO>.md        — documentação de contexto de negócio
docs/plans/
└── PLAN-<SLUG-DA-FEATURE>.md — este plano (salvo ao final)
```

#### 2.4 — Arquivos a modificar
Liste cada arquivo existente que será alterado, com a natureza da mudança (ex: "registrar rota no app.js", "adicionar campo no schema").

#### 2.5 — Dependências externas novas (se houver)
Justifique cada nova dependência e por que não é possível usar o que já existe.

#### 2.6 — Sequência de implementação
Ordene as etapas de forma que o código compile e os testes passem progressivamente:
1. Migration Prisma
2. Validation schemas
3. Service
4. Controller
5. Routes + registro no app.js
6. Testes de integração
7. Documentação de contexto

#### 2.7 — Riscos e decisões de design
Aponte trade-offs, pontos de atenção de segurança multi-tenant, e decisões que o desenvolvedor deve conhecer.

**Ao final, pergunte explicitamente:** "Posso prosseguir com a implementação conforme este plano?"

Aguarde a confirmação antes de escrever qualquer linha de código.

Salve o plano em `docs/plans/PLAN-<SLUG-DA-FEATURE>.md` **antes de pedir confirmação**.

---

### FASE 3 — Implementação

Após a confirmação do desenvolvedor, implemente **na sequência definida no plano**, marcando cada etapa como concluída conforme avança.

#### Padrões obrigatórios de código

**Multi-tenant — regra absoluta**
- Toda query de negócio filtra `where: { tenantId: req.user.tenantId }`
- Nunca confie em IDs vindos do body para resolver o tenant — sempre use `req.user.tenantId`
- Em operações de update/delete, sempre inclua `tenantId` no `where` para evitar acesso cruzado

**Controller**
- Responsabilidade única: extrair params/body/user, chamar service, retornar resposta HTTP
- Nunca coloque lógica de negócio no controller
- Sempre use `try/catch` e repasse erros para o `next(err)` do Express

**Service**
- Toda lógica de negócio aqui
- Lança erros com `status` e `message` para o errorHandler capturar:
  ```js
  const err = new Error('Recurso não encontrado');
  err.status = 404;
  throw err;
  ```
- Usa `prisma.$transaction()` quando múltiplas escritas precisam ser atômicas

**Validation (Zod)**
- Um schema por operação (create, update) em `<domínio>.validation.js`
- Aplicado via middleware `validate(schema)` na rota
- Campos opcionais em update usam `.optional()`
- Strings com `.trim()` e limites de tamanho explícitos

**Routes**
- Registrar o router no `app.js`
- Aplicar `authenticate` antes de rotas protegidas
- Aplicar `validate(schema)` antes do controller

**Respostas HTTP**
- `201` para criação com o recurso criado no body
- `200` para leitura/update com o recurso no body
- `204` para delete sem body
- Listas sempre retornam `{ data: [...], total, page, pageSize }`
- Erros seguem RFC 7807 (já tratado pelo `errorHandler.js`)

**Paginação**
- Query params: `page` (default 1) e `pageSize` (default 20, max 100)
- Calcular `skip = (page - 1) * pageSize`

**Logs**
- Use o `logger.js` existente para eventos relevantes de negócio
- Nunca logue dados pessoais (nome, e-mail, CPF) — use IDs

---

### FASE 4 — Testes de Integração

Crie o arquivo `tests/integration/<domínio>.test.js` com Jest.

#### Estrutura obrigatória dos testes

```js
// Padrão de cada arquivo de teste de integração
describe('<Domínio> — <Feature>', () => {

  // Setup: criar tenant e user de teste, obter JWT
  beforeAll(async () => { ... });

  // Teardown: limpar dados de teste do banco
  afterAll(async () => { ... });

  describe('POST /api/v1/<rota>', () => {
    it('cria recurso com dados válidos', async () => { ... });
    it('retorna 400 quando campo obrigatório ausente', async () => { ... });
    it('retorna 401 sem token JWT', async () => { ... });
    it('retorna 403 quando role insuficiente', async () => { ... });
    it('isola por tenant — não acessa recurso de outro tenant', async () => { ... });
  });

  describe('GET /api/v1/<rota>', () => {
    it('lista recursos do tenant autenticado', async () => { ... });
    it('não retorna recursos de outro tenant', async () => { ... });
    it('pagina corretamente', async () => { ... });
  });

  // ... demais operações
});
```

#### Casos de teste obrigatórios para toda feature

- Fluxo feliz de cada endpoint
- Validação de campos obrigatórios ausentes (`400`)
- Request sem token JWT (`401`)
- Request com role insuficiente (`403`) — quando aplicável
- **Isolamento multi-tenant**: tenant A não acessa/altera dados do tenant B
- Paginação (quando houver listagem)
- Regras de negócio específicas do PRD (duplicatas, limites, estados inválidos)

#### Setup de teste

- Use banco real (não mock) — o projeto usa MySQL
- Crie um `tenantId` único por suite de teste para isolar dados
- Limpe os dados criados no `afterAll`
- Use `supertest` para chamadas HTTP — verifique se está no `package.json`, instale se não estiver

---

### FASE 5 — Documentação de Contexto de Negócio

Verifique se já existe documentação em `docs/context/` para o fluxo sendo implementado.

- **Se existir**: leia, atualize com as novas informações e indique as seções alteradas
- **Se não existir**: crie o arquivo `docs/context/<SLUG-DO-FLUXO>.md`

#### Formato da documentação de contexto

```markdown
# Contexto — <Nome do Fluxo>

**Última atualização**: <data>  
**Features relacionadas**: <links para PRDs>

---

## O que é este fluxo

<Explique em linguagem de negócio, sem jargão técnico. Um novo desenvolvedor deve entender por que isso existe.>

## Atores envolvidos

| Ator | Papel no fluxo |
|------|---------------|
| Administrador do laboratório | ... |
| Analista | ... |
| Paciente/Cliente | ... |

## Fluxo principal (happy path)

1. <passo 1 em linguagem de negócio>
2. <passo 2>
3. ...

## Fluxos alternativos e exceções

### <Cenário alternativo>
<Descrição do que acontece e por quê>

## Regras de negócio importantes

- **RN-01**: <regra>
- **RN-02**: <regra>

## Dados envolvidos

<Quais entidades do sistema participam deste fluxo e como se relacionam. Linguagem de negócio, não técnica.>

## Restrições e isolamento

<Explicar que dados são isolados por laboratório (tenant) e o que isso significa em termos de negócio>

## Endpoints da API

| Operação | Método | Path |
|----------|--------|------|
| <ação de negócio> | POST | /api/v1/... |

## Histórico de alterações

| Data | Feature | Descrição da mudança |
|------|---------|----------------------|
| <data> | <feature> | Criação inicial |
```

---

### FASE 6 — Relatório final

Ao concluir todas as fases, apresente um relatório curto:

```
## Implementação concluída — <Nome da Feature>

### Arquivos criados
- <lista>

### Arquivos modificados
- <lista>

### Testes
- <N> casos de teste em tests/integration/<domínio>.test.js

### Documentação
- docs/plans/PLAN-<feature>.md
- docs/context/<fluxo>.md (criado/atualizado)

### Próximos passos sugeridos
- Rode os testes: `npm test`
- Aplique a migration: `npx prisma migrate dev --name <nome>`
- Revise e faça o commit quando estiver satisfeito
```

**Nunca faça commit, push ou qualquer operação git.** Isso é responsabilidade exclusiva do desenvolvedor.

---

## Regras absolutas desta skill

1. **Nunca implemente sem confirmação do plano** — a FASE 3 só começa após "sim" explícito
2. **Nunca faça commit, push ou operação git** de qualquer tipo
3. **Nunca instale dependências sem avisar** — se precisar de algo novo, mencione no plano e aguarde confirmação
4. **Nunca quebre o isolamento multi-tenant** — toda query de negócio tem `tenantId`
5. **Nunca coloque lógica de negócio no controller** — service é o único lugar
6. **Sempre crie testes de integração** — feature sem teste não está completa
7. **Sempre crie ou atualize a documentação de contexto** — código sem contexto de negócio não está completo
8. **Nunca invente comportamento não descrito no PRD** — se houver ambiguidade, pergunte antes de implementar
