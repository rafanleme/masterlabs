# Contexto — Laudos Emitidos (Emissão de Laudos)

**Última atualização**: 2026-05-10  
**Features relacionadas**: [PRD-EMISSAO-LAUDOS](../prd/PRD-EMISSAO-LAUDOS.md)

---

## O que é este fluxo

Um Laudo Emitido é o documento de análise laboratorial — a instância concreta que registra os resultados obtidos para cada ensaio realizado em uma amostra específica. É o principal produto entregue pelo laboratório ao cliente.

O fluxo funciona assim: o operador seleciona um Modelo de Laudo (que define quais ensaios serão realizados) e o vincula a uma Amostra. O sistema cria automaticamente um item de resultado para cada ensaio do modelo. À medida que os analistas completam as análises, preenchem os valores — e o sistema calcula automaticamente se o resultado está dentro dos parâmetros esperados (CONFORME, NAO_CONFORME ou INCONCLUSIVO).

## Atores envolvidos

| Ator | Papel no fluxo |
|------|---------------|
| Administrador do laboratório | Cria, edita, emite, cancela e desativa laudos |
| Analista | Cria, edita, emite e cancela laudos; preenche resultados |
| Visualizador | Consulta laudos e resultados |

## Fluxo principal (happy path)

1. Analista cria o laudo selecionando uma Amostra e um Modelo de Laudo
2. Sistema gera número de protocolo automático (`0001/2026`) e cria os itens em branco para cada ensaio
3. Analista preenche o valor do resultado para cada ensaio (um por vez)
4. Sistema calcula automaticamente a conformidade com base nos limites cadastrados no ensaio
5. Quando todos os resultados estão preenchidos, operador emite o laudo (`RASCUNHO → EMITIDO`)
6. Laudo emitido fica disponível para consulta e, na próxima feature, download em PDF

## Ciclo de vida do laudo

```
RASCUNHO ──→ EMITIDO   (terminal — não pode ser revertido)
         └──→ CANCELADO (terminal)
```

- **RASCUNHO**: em edição — resultados podem ser alterados
- **EMITIDO**: finalizado — tem valor jurídico, não pode ser editado nem desativado
- **CANCELADO**: encerrado sem emissão — pode ser desativado (soft delete)

## Cálculo automático de conformidade

Ao registrar um resultado com `valorNumerico`, o sistema compara com os limites definidos no cadastro do ensaio:

| Tipo de comparação | Regra | Resultado |
|-------------------|-------|-----------|
| ENTRE | `limiteMinimo ≤ valor ≤ limiteMaximo` | CONFORME / NAO_CONFORME |
| MENOR_QUE | `valor < limiteMaximo` | CONFORME / NAO_CONFORME |
| MENOR_IGUAL | `valor ≤ limiteMaximo` | CONFORME / NAO_CONFORME |
| MAIOR_QUE | `valor > limiteMinimo` | CONFORME / NAO_CONFORME |
| MAIOR_IGUAL | `valor ≥ limiteMinimo` | CONFORME / NAO_CONFORME |
| TEXTO | Não há comparação numérica | INCONCLUSIVO |
| Sem tipo | Não há comparação | INCONCLUSIVO |
| valor sem valorNumerico | Não há comparação | INCONCLUSIVO |

Cada item tem dois campos para o valor: `valor` (texto de exibição, ex: "7,2 mg/L") e `valorNumerico` (Float, para a comparação automática).

## Regras de negócio importantes

- **RN-01**: Laudo pertence exclusivamente ao laboratório do operador
- **RN-02**: Items são criados automaticamente ao criar o laudo — um por ensaio do modelo, em ordem
- **RN-03**: Edição de metadados e resultados só em status RASCUNHO
- **RN-04**: Ao emitir, a `dataEmissao` é registrada automaticamente
- **RN-05**: Laudos EMITIDOS têm valor jurídico e não podem ser desativados
- **RN-06**: Número de laudo sequencial por laboratório e ano (ex: `0001/2026`)

## Hierarquia de dados

```
Tenant (Laboratório)
├── Sample (Amostra) ──────────────────────────────┐
├── ReportTemplate (Modelo) ──────────────────────┐ │
│   └── ReportTemplateAssay (Ensaios do modelo)   │ │
│       └── Assay (Ensaio com limites)            │ │
└── Report (Laudo Emitido) ←─────────────────────┘ ┘
    └── ReportItem (Resultado por ensaio)
        └── Assay (dados de referência)
```

## Restrições e isolamento

Todos os dados do laudo são isolados por laboratório. A `sampleId` e `reportTemplateId` são validadas no tenant antes de persistir.

## Endpoints da API

| Operação | Método | Path |
|----------|--------|------|
| Criar laudo | POST | /api/v1/reports |
| Listar laudos | GET | /api/v1/reports |
| Visualizar laudo | GET | /api/v1/reports/:id |
| Editar metadados | PATCH | /api/v1/reports/:id |
| Registrar resultado de ensaio | PATCH | /api/v1/reports/:id/items/:assayId |
| Emitir ou cancelar | PATCH | /api/v1/reports/:id/status |
| Desativar laudo | DELETE | /api/v1/reports/:id |

## Histórico de alterações

| Data | Feature | Descrição da mudança |
|------|---------|----------------------|
| 2026-05-10 | Emissão de Laudos | Criação inicial — dados, resultados, conformidade e lifecycle (sem PDF) |
