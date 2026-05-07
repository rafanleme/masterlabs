# Contexto — Atendimentos (Ordens de Serviço)

**Última atualização**: 2026-05-02  
**Features relacionadas**: [PRD-CRUD-ATENDIMENTOS](../prd/PRD-CRUD-ATENDIMENTOS.md)

---

## O que é este fluxo

Um Atendimento é a ordem de serviço que registra a solicitação de análises laboratoriais feita por um cliente. É o ponto de entrada do fluxo laboratorial: antes de coletar qualquer amostra ou emitir qualquer laudo, o laboratório precisa abrir um atendimento para o cliente. Ele agrupa todas as amostras coletadas e os laudos gerados em um único contexto rastreável.

## Atores envolvidos

| Ator | Papel no fluxo |
|------|---------------|
| Administrador do laboratório | Abre, edita, transita status e encerra atendimentos |
| Analista | Abre, edita e transita status (incluindo cancelar) |
| Visualizador | Consulta atendimentos e acompanha o andamento |

## Fluxo principal (happy path)

1. Cliente solicita análises laboratoriais ao laboratório
2. Operador abre um Atendimento informando o cliente, tipo de coleta (in loco ou entrega) e dados da solicitação
3. O sistema gera automaticamente um número de protocolo sequencial (`0001/2026`)
4. Equipe vai ao campo ou recebe as amostras → Amostras são registradas vinculadas a este atendimento
5. Análises são realizadas e laudos emitidos
6. Operador encerra o atendimento ao finalizar todas as análises

## Fluxos alternativos e exceções

### Atendimento cancelado
O atendimento pode ser cancelado a qualquer momento antes de ser encerrado, tanto pelo ADMIN quanto pelo ANALYST. Isso acontece quando o cliente desiste da solicitação ou quando as condições de coleta inviabilizam o serviço.

### Coleta in loco vs entrega no laboratório
O campo `tipoColeta` define a logística: `IN_LOCO` significa que a equipe do laboratório se desloca até o local de coleta; `ENTREGA_NO_LABORATORIO` significa que o cliente entrega ou envia as amostras diretamente.

## Regras de negócio importantes

- **RN-01**: Número de protocolo gerado automaticamente, sequencial por laboratório e ano, imutável após criação
- **RN-02**: Status inicial sempre `ABERTO`
- **RN-03**: Transições válidas: `ABERTO → EM_ANDAMENTO | CANCELADO`; `EM_ANDAMENTO → ENCERRADO | CANCELADO`; `ENCERRADO` e `CANCELADO` são terminais
- **RN-04**: Dados de um laboratório são completamente invisíveis a outro

## Dados envolvidos

O Atendimento pertence a um Laboratório (tenant) e está vinculado a um Cliente. Ele pode conter múltiplas Amostras, cada uma com seus próprios dados de coleta e ciclo de vida.

## Restrições e isolamento

Cada atendimento pertence exclusivamente ao laboratório que o criou. Um operador do laboratório A jamais acessa atendimentos do laboratório B — o isolamento é garantido pelo token de autenticação em todas as operações.

## Endpoints da API

| Operação | Método | Path |
|----------|--------|------|
| Criar atendimento | POST | /api/v1/attendances |
| Listar atendimentos | GET | /api/v1/attendances |
| Visualizar atendimento | GET | /api/v1/attendances/:id |
| Editar atendimento | PATCH | /api/v1/attendances/:id |
| Transitar status | PATCH | /api/v1/attendances/:id/status |
| Encerrar/cancelar | PATCH | /api/v1/attendances/:id/status |
| Desativar atendimento | DELETE | /api/v1/attendances/:id |

## Histórico de alterações

| Data | Feature | Descrição da mudança |
|------|---------|----------------------|
| 2026-05-02 | CRUD de Atendimentos | Criação inicial |
