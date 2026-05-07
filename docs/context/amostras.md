# Contexto — Amostras

**Última atualização**: 2026-05-02  
**Features relacionadas**: [PRD-CRUD-AMOSTRAS](../prd/PRD-CRUD-AMOSTRAS.md)

---

## O que é este fluxo

A Amostra representa o material físico coletado para análise laboratorial. Ela sempre está vinculada a um Atendimento (ordem de serviço) e carrega todos os dados de rastreabilidade da coleta: quem coletou, onde, quando, em quais condições ambientais. Cada amostra tem seu próprio ciclo de vida e pode gerar múltiplos laudos.

## Atores envolvidos

| Ator | Papel no fluxo |
|------|---------------|
| Administrador do laboratório | Registra, edita, transita status e desativa amostras |
| Analista | Registra, edita e transita status (incluindo cancelar e rejeitar) |
| Visualizador | Consulta amostras e acompanha status |

## Fluxo principal (happy path)

1. Um Atendimento está aberto para o cliente
2. Coleta é realizada (in loco ou entregue no laboratório)
3. Operador registra a Amostra vinculada ao Atendimento, preenchendo dados de coleta
4. Sistema gera número sequencial automático (`0001/2026`)
5. Amostra inicia como `RECEBIDA` → avança para `EM_ANALISE` quando o laboratório começa a analisar
6. Após análise concluída → status muda para `CONCLUIDA`
7. Laudos são gerados a partir desta amostra

## Fluxos alternativos e exceções

### Amostra rejeitada
Quando a amostra chega em condições inadequadas (temperatura incorreta, embalagem violada, volume insuficiente), o analista pode marcá-la como `REJEITADA`. Este é um estado terminal — não é possível reabrir a amostra.

### Amostra cancelada
Quando o cliente desiste da análise ou o atendimento é cancelado, a amostra pode ser marcada como `CANCELADA`. Também é estado terminal.

## Regras de negócio importantes

- **RN-01**: Número sequencial por laboratório e ano, gerado automaticamente, imutável após criação
- **RN-02**: Amostra sempre vinculada a um Atendimento do mesmo laboratório
- **RN-03**: `clientId` é herdado automaticamente do Atendimento na criação
- **RN-04**: Status inicial sempre `RECEBIDA`
- **RN-05**: Transições: `RECEBIDA → EM_ANALISE | CANCELADA | REJEITADA`; `EM_ANALISE → CONCLUIDA | CANCELADA | REJEITADA`; `CONCLUIDA`, `CANCELADA` e `REJEITADA` são terminais
- **RN-06**: ANALYST pode cancelar e rejeitar amostras

## Dados envolvidos

A Amostra pertence a um Laboratório (tenant), está vinculada a um Atendimento e herda o vínculo com o Cliente. Futuramente gerará Laudos. Os dados de coleta (temperatura, umidade, ponto de coleta) garantem rastreabilidade para fins regulatórios.

## Restrições e isolamento

Cada amostra pertence ao laboratório que a registrou. O operador de um laboratório não acessa amostras de outro laboratório em nenhuma operação. O `attendanceId` é validado no momento da criação para garantir que pertença ao mesmo laboratório.

## Endpoints da API

| Operação | Método | Path |
|----------|--------|------|
| Registrar amostra | POST | /api/v1/samples |
| Listar amostras | GET | /api/v1/samples |
| Visualizar amostra | GET | /api/v1/samples/:id |
| Editar amostra | PATCH | /api/v1/samples/:id |
| Transitar status | PATCH | /api/v1/samples/:id/status |
| Desativar amostra | DELETE | /api/v1/samples/:id |

## Histórico de alterações

| Data | Feature | Descrição da mudança |
|------|---------|----------------------|
| 2026-05-02 | CRUD de Amostras v2 | Criação — amostra vinculada a Atendimento (não diretamente ao cliente) |
