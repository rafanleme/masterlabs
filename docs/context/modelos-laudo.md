# Contexto — Modelos de Laudo (Report Templates)

**Última atualização**: 2026-05-08  
**Features relacionadas**: [PRD-CRUD-MODELOS-LAUDO](../prd/PRD-CRUD-MODELOS-LAUDO.md)

---

## O que é este fluxo

Um Modelo de Laudo define o **tipo e a composição** de um relatório laboratorial. Pense nele como um formulário pré-configurado: "Laudo Físico-Químico de Água" contém os ensaios de pH, Turbidez e Cloro; "Laudo Microbiológico" contém Coliformes Totais e E. coli. Cada laboratório define seus próprios modelos conforme os serviços que oferece.

A ordem dos ensaios no modelo é preservada — ela define a ordem em que os resultados aparecerão no PDF do laudo emitido.

## Atores envolvidos

| Ator | Papel no fluxo |
|------|---------------|
| Administrador do laboratório | Cria, edita, lista e desativa modelos |
| Analista | Cria, edita e consulta modelos |
| Visualizador | Consulta o catálogo de modelos |

## Fluxo principal (happy path)

1. Administrador ou analista acessa o catálogo de ensaios para verificar quais estão disponíveis
2. Cria um modelo de laudo informando nome e selecionando os ensaios na ordem desejada
3. O modelo fica disponível no catálogo para uso na emissão de laudos
4. Ao emitir um laudo para uma amostra, o operador seleciona um modelo e preenche os resultados

## Fluxos alternativos e exceções

### Atualização da composição
Se o laboratório começar a usar um novo ensaio ou descontinuar outro, o analista edita o modelo enviando a nova lista completa de ensaios. A substituição é atômica — a lista antiga é removida e a nova é inserida de uma vez, sem estados intermediários.

### Desativação de modelo
Quando um tipo de laudo cai em desuso, o administrador pode desativar o modelo. Ele some do catálogo ativo mas permanece vinculado aos laudos históricos que foram emitidos com base nele.

## Regras de negócio importantes

- **RN-01**: Modelo pertence exclusivamente ao laboratório que o criou
- **RN-02**: Nome único por laboratório
- **RN-03**: Todos os ensaios selecionados devem pertencer ao mesmo laboratório
- **RN-04**: Mínimo 1 ensaio por modelo
- **RN-05**: Sem ensaios duplicados no mesmo modelo
- **RN-06**: A posição do ensaio no array define a ordem de exibição no laudo (0-based)
- **RN-07**: Soft delete — modelo desativado não aparece em listagens

## Dados envolvidos

O Modelo de Laudo pertence a um Laboratório (tenant). Ele referencia múltiplos Ensaios através de uma tabela de associação que preserva a ordem. Futuramente, cada Emissão de Laudo (Report) estará vinculada a um Modelo de Laudo e a uma Amostra.

## Hierarquia de dados

```
Tenant (Laboratório)
├── Assay (Ensaio) — catálogo de tipos de análise
└── ReportTemplate (Modelo de Laudo)
    └── ReportTemplateAssay (Ensaios do modelo, ordenados)
        └── → Assay
```

## Restrições e isolamento

O catálogo de modelos é completamente isolado por laboratório. Um analista do Laboratório A não vê nem acessa os modelos do Laboratório B.

## Endpoints da API

| Operação | Método | Path |
|----------|--------|------|
| Criar modelo | POST | /api/v1/report-templates |
| Listar modelos | GET | /api/v1/report-templates |
| Visualizar modelo | GET | /api/v1/report-templates/:id |
| Editar modelo | PATCH | /api/v1/report-templates/:id |
| Desativar modelo | DELETE | /api/v1/report-templates/:id |

## Histórico de alterações

| Data | Feature | Descrição da mudança |
|------|---------|----------------------|
| 2026-05-08 | CRUD de Modelos de Laudo | Criação inicial — templates com ensaios ordenados |
