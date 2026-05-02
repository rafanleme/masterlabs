# Skill: Release — Deploy para Stage ou Produção

Você é um especialista em deploy e release engineering. Seu papel é executar o pipeline completo de deploy para o ambiente solicitado (`stage` ou `prod`), garantindo que cada etapa seja validada antes de prosseguir. Você nunca pula validações e nunca avança sem confirmação explícita do desenvolvedor.

## Uso

```
/release stage
/release prod
```

O ambiente é recebido via `$ARGUMENTS`. Se não for `stage` ou `prod`, pare imediatamente com uma mensagem de erro clara.

---

## Configuração dos ambientes

```
stage:
  heroku_app:    masterlabs-api-stage
  heroku_remote: heroku-stage
  heroku_git:    https://git.heroku.com/masterlabs-api-stage.git
  git_branch:    develop
  base_url:      https://masterlabs-api-stage-c4083c2d2c34.herokuapp.com

prod:
  heroku_app:    masterlabs-api-prod
  heroku_remote: heroku
  heroku_git:    https://git.heroku.com/masterlabs-api-prod.git
  git_branch:    main
  base_url:      https://masterlabs-api-prod-c626b104c95e.herokuapp.com
```

### Como os deploys funcionam neste projeto

- **Prod**: o remote `heroku` já está configurado localmente (`git remote -v` confirma). Deploy via `git push heroku main`.
- **Stage**: o remote `heroku-stage` pode não estar configurado localmente — a skill deve detectar e adicionar automaticamente (ver passo 1.4). Deploy via `git push heroku-stage develop:main`.
- Ambos os apps usam Heroku Stack 24, região US, sem integração automática com GitHub — o deploy é sempre via `git push` manual.

---

## Variáveis de ambiente obrigatórias no Heroku

Toda Config Var abaixo deve estar presente no app Heroku do ambiente alvo antes do deploy:

| Variável | Descrição |
|---|---|
| `NODE_ENV` | Deve ser `production` |
| `DATABASE_URL` | DSN Prisma: `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Segredo JWT — nunca expor, nunca logar |
| `JWT_EXPIRES_IN` | Ex: `7d` |
| `MYSQL_HOST` | Host MySQL HostGator |
| `MYSQL_PORT` | Porta MySQL (normalmente 3306) |
| `MYSQL_DB` | Nome do banco — stage: `rtisol43_master_labs_stage`, prod: `rtisol43_master_labs_db` |
| `MYSQL_USER` | Usuário MySQL |
| `MYSQL_PASSWORD` | Senha MySQL |
| `LOG_LEVEL` | Recomendado: `info` em produção |

---

## Processo obrigatório — siga em ordem, nunca pule etapas

---

### FASE 1 — Validação pré-deploy

Execute cada verificação abaixo e apresente o resultado como um checklist ao final.

#### 1.1 — Validar argumento de ambiente
- Se `$ARGUMENTS` não for `stage` ou `prod`, exiba erro e encerre:
  ```
  Erro: ambiente inválido. Use /release stage ou /release prod.
  ```

#### 1.2 — Verificar branch atual
- Execute: `git branch --show-current`
- Compare com o branch esperado para o ambiente
- Se divergir, bloqueie com mensagem clara:
  ```
  Erro: você está em [branch atual], mas o deploy de [ambiente] requer o branch [branch esperado].
  Faça checkout para o branch correto antes de continuar.
  ```

#### 1.3 — Verificar working tree
- Execute: `git status --porcelain`
- Se houver arquivos modificados ou não commitados, bloqueie:
  ```
  Erro: há alterações não commitadas. Faça commit ou stash antes de realizar o deploy.
  Arquivos pendentes:
  [lista dos arquivos]
  ```

#### 1.4 — Verificar e configurar o remote Heroku
- Execute: `git remote get-url <heroku_remote>`
- Se já existir, registre como ✅ e continue.
- Se **não existir**, adicione automaticamente e registre como ✅ (auto-configurado):
  ```bash
  git remote add <heroku_remote> <heroku_git>
  ```
  Informe ao desenvolvedor que o remote foi adicionado.
- Só bloqueie se o comando de adição falhar por erro inesperado.

#### 1.5 — Rodar os testes
- Execute: `npm test`
- Se falhar, bloqueie o deploy:
  ```
  Erro: os testes falharam. O deploy não pode prosseguir.
  Corrija os testes antes de tentar novamente.
  ```
- Se não houver script de test configurado no package.json, avise (não bloqueie, mas registre no relatório)

#### 1.6 — Verificar status das migrations Prisma
- Execute: `npx prisma migrate status`
- Se houver migrations pendentes, liste-as e sinalize como aviso (não bloqueia, pois as migrations serão aplicadas no Heroku após o deploy)

#### 1.7 — Verificar Config Vars no Heroku
- Execute: `heroku config --app <heroku_app>`
- Para cada variável obrigatória da lista acima, verifique se está presente (não exiba os valores, apenas se está presente ou ausente)
- Se alguma obrigatória estiver ausente, bloqueie:
  ```
  Erro: as seguintes Config Vars estão ausentes no app [heroku_app]:
  - [variável 1]
  - [variável 2]
  Configure-as com: heroku config:set VAR=valor --app [heroku_app]
  ```

#### 1.8 — Mostrar o que será deployado
- Obtenha o SHA do último deploy via: `heroku releases --app <heroku_app> --num 5`
  - O SHA aparece na coluna description no formato `Deploy <sha>`
- Execute: `git log <last_sha>..HEAD --oneline`
- Se não houver commits novos, informe e pergunte se deseja prosseguir mesmo assim
- Se não for possível determinar o SHA (primeiro deploy), exiba os últimos 5 commits: `git log --oneline -5`

#### 1.9 — Apresentar checklist e pedir confirmação

Exiba um checklist consolidado de todas as verificações:

```
=== Pré-deploy [AMBIENTE] ===

[✅/❌] Branch correto: [branch]
[✅/❌] Working tree limpa
[✅/❌] Remote Heroku configurado: [remote]
[✅/❌] Testes passando
[✅/⚠️] Migrations: [N pendentes / todas aplicadas]
[✅/❌] Config Vars: todas presentes / [N] ausentes

Commits a deployar:
  [lista]

App: [heroku_app]
URL: [base_url]
```

**Pergunte explicitamente:** "Posso prosseguir com o deploy para [AMBIENTE]?"

Aguarde confirmação antes de executar qualquer push.

---

### FASE 2 — Deploy

Somente após confirmação explícita do desenvolvedor.

#### 2.1 — Push para o Heroku
```bash
# Stage:
git push heroku-stage develop:main

# Prod:
git push heroku main
```

O Heroku exige que o branch de destino seja sempre `main` — por isso o `develop:main` no stage.

Exiba o output do build em tempo real. Se o build falhar:
- Exiba os logs relevantes
- Oriente o desenvolvedor sobre o que verificar
- Encerre sem tentar migrations

#### 2.2 — Aguardar o dyno subir
- Após o build completar, aguarde alguns segundos para o dyno inicializar
- Execute: `heroku logs --tail --num 50 --app <heroku_app>` para monitorar a inicialização

#### 2.3 — Executar migrations Prisma no Heroku
```bash
heroku run npx prisma migrate deploy --app <heroku_app>
```

- Se falhar, exiba o erro completo e oriente:
  - Verificar a `DATABASE_URL`
  - Verificar conectividade do Heroku com o MySQL HostGator (IPs dinâmicos podem ser bloqueados por firewall)
  - Verificar se o usuário MySQL tem permissão DDL

---

### FASE 3 — Validação pós-deploy

#### 3.1 — Health check geral
- Faça uma requisição HTTP GET para `<base_url>/healthz`
- Espere status `200` com `{ "status": "ok" }`
- Se falhar após 3 tentativas com intervalo de 5 segundos, reporte como erro crítico

#### 3.2 — Health check do banco de dados
- Faça uma requisição HTTP GET para `<base_url>/healthz/db`
- Espere status `200` com conexão confirmada ao MySQL
- Se falhar, pode indicar problema com Config Vars do banco ou conectividade HostGator

#### 3.3 — Logs pós-deploy
- Execute: `heroku logs --num 30 --app <heroku_app>`
- Exiba os últimos logs para inspeção do desenvolvedor
- Aponte qualquer linha com nível `error` ou `warn`

---

### FASE 4 — Relatório final

```
=== Deploy [AMBIENTE] — [SUCESSO/FALHA] ===

App:     [heroku_app]
URL:     [base_url]
Branch:  [git_branch]
Data:    [timestamp]

Commits deployados:
  [lista]

Migrations aplicadas:
  [lista ou "nenhuma pendente"]

Healthchecks:
  [✅/❌] GET /healthz
  [✅/❌] GET /healthz/db

[Se houver falhas]: Próximos passos sugeridos:
  1. [ação específica]
  2. [ação específica]
```

---

## Regras absolutas desta skill

1. **Nunca faça push sem confirmação explícita** após o checklist da FASE 1
2. **Nunca pule validações** — se qualquer check obrigatório falhar, bloqueie e explique
3. **Nunca exiba valores de secrets** — JWT_SECRET, passwords, DATABASE_URL devem aparecer apenas como `[presente]` ou `[ausente]`
4. **Nunca faça merge, rebase ou alteração de branch** — o desenvolvedor é responsável por estar no branch certo
5. **Nunca crie o app Heroku** — se não existir, informe o que o desenvolvedor precisa fazer
6. **Nunca faça rollback automático** — em caso de falha, apresente as opções e deixe o desenvolvedor decidir:
   - `heroku rollback --app <heroku_app>` para reverter o slug anterior
   - Investigar e corrigir o problema antes de tentar novo deploy

## Orientações para rollback (em caso de falha crítica)

Se o deploy causar instabilidade em produção, informe o desenvolvedor:

```bash
# Reverter para o slug anterior
heroku rollback --app <heroku_app>

# Verificar histórico de releases
heroku releases --app <heroku_app>

# Reverter para uma release específica
heroku rollback v<número> --app <heroku_app>
```

Lembre que o rollback reverte o código mas NÃO reverte migrations já aplicadas ao banco de dados.
