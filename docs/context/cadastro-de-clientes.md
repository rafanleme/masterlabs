# Contexto — Cadastro de Clientes

**Última atualização**: 2026-05-01  
**Features relacionadas**: [PRD-CRUD-CLIENTES](../prd/PRD-CRUD-CLIENTES.md)

---

## O que é este fluxo

Cada laboratório cadastrado no sistema precisa gerenciar seus clientes — que podem ser pacientes pessoas físicas (PF) ou empresas pessoas jurídicas (PJ). Este fluxo cobre o ciclo de vida completo de um cliente dentro de um laboratório: criação, consulta, edição e desativação. Os clientes são a entidade central que conecta amostras e laudos.

## Atores envolvidos

| Ator | Papel no fluxo |
|------|---------------|
| Administrador do laboratório | Pode criar, editar e desativar clientes |
| Analista do laboratório | Pode criar e editar clientes, mas não desativar |
| Visualizador do laboratório | Apenas consulta clientes |
| Sistema | Garante que cada cliente pertence a um único laboratório e que documentos não se repetem dentro do mesmo laboratório |

## Fluxo principal (happy path)

1. O operador do laboratório autentica-se no painel e acessa a seção de clientes
2. Preenche os dados do novo cliente: tipo (PF ou PJ), nome completo/razão social, documento (CPF ou CNPJ), e-mail e telefone opcionais
3. O sistema valida o documento conforme o tipo escolhido (11 dígitos para CPF, 14 para CNPJ)
4. O sistema verifica se já existe um cliente com o mesmo documento naquele laboratório
5. O cliente é registrado e fica disponível para vincular a amostras e laudos

## Fluxos alternativos e exceções

### Documento já cadastrado no laboratório
Se um operador tentar cadastrar um cliente com CPF ou CNPJ já existente no mesmo laboratório, o sistema recusa com erro de conflito. O mesmo documento pode existir em laboratórios diferentes sem conflito — o isolamento é por laboratório.

### Desativação de cliente
Quando um administrador desativa um cliente, o registro não é apagado do banco — apenas marcado como inativo com a data de desativação. Isso preserva o histórico de amostras e laudos associados. Um cliente desativado desaparece das listagens e não pode ser encontrado por ID, mas seus laudos continuam acessíveis internamente para fins de auditoria.

### Edição parcial
O operador pode atualizar apenas os campos que deseja — não é necessário reenviar todos os dados do cliente. Se alterar o documento, o sistema revalida o formato e verifica unicidade novamente.

## Regras de negócio importantes

- **RN-01**: CPF tem exatamente 11 dígitos, CNPJ tem exatamente 14 dígitos — apenas números, sem pontuação
- **RN-02**: Documento é único dentro do mesmo laboratório — o mesmo CPF não pode aparecer duas vezes para o mesmo laboratório
- **RN-03**: Apenas administradores podem desativar clientes — analistas e visualizadores recebem acesso negado
- **RN-04**: Clientes desativados são invisíveis para todas as operações da API (listagem, busca, edição)
- **RN-05**: O laboratório de um cliente é sempre determinado pelo token de autenticação do operador — nunca informado pelo corpo da requisição

## Dados envolvidos

O cliente está vinculado ao laboratório (tenant) e futuramente será vinculado a amostras e laudos. Cada cliente tem tipo de pessoa, identificação por documento, dados de contato opcionais e controle de ativação. O documento (CPF/CNPJ) junto com o laboratório formam a chave natural de identificação do cliente.

## Restrições e isolamento

Cada cliente pertence exclusivamente ao laboratório que o cadastrou. Um operador do laboratório A jamais enxerga, edita ou desativa clientes do laboratório B — mesmo que compartilhem o mesmo CPF/CNPJ. O isolamento é garantido tecnicamente: todas as consultas incluem o identificador do laboratório extraído do token de autenticação.

## Endpoints da API

| Operação | Método | Path |
|----------|--------|------|
| Criar cliente | POST | /api/v1/clients |
| Listar clientes | GET | /api/v1/clients |
| Visualizar cliente | GET | /api/v1/clients/:id |
| Editar cliente | PATCH | /api/v1/clients/:id |
| Desativar cliente | DELETE | /api/v1/clients/:id |

## Histórico de alterações

| Data | Feature | Descrição da mudança |
|------|---------|----------------------|
| 2026-05-01 | CRUD de Clientes | Criação inicial — suporte a PF e PJ, soft delete, controle de role |
