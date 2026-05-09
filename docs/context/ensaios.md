# Contexto — Ensaios (Catálogo de Análises)

**Última atualização**: 2026-05-08  
**Features relacionadas**: [PRD-CRUD-ENSAIOS](../prd/PRD-CRUD-ENSAIOS.md)

---

## O que é este fluxo

Um Ensaio representa um tipo de análise laboratorial que o laboratório está habilitado a realizar — por exemplo: "pH da Água", "Contagem de Coliformes Totais", "DBO5", "Turbidez". Cada laboratório mantém seu próprio catálogo de ensaios, que serão selecionados na composição de laudos.

O diferencial desta entidade é que ela carrega os parâmetros de referência do ensaio (valor mínimo, máximo, tipo de comparação), permitindo que o sistema determine automaticamente se um resultado está dentro ou fora da faixa aceitável no momento da emissão do laudo.

## Atores envolvidos

| Ator | Papel no fluxo |
|------|---------------|
| Administrador do laboratório | Cria, edita, lista e desativa ensaios do catálogo |
| Analista | Cria, edita e consulta ensaios |
| Visualizador | Consulta o catálogo de ensaios |

## Fluxo principal (happy path)

1. Administrador ou analista cadastra os ensaios que o laboratório realiza
2. Para cada ensaio, informa nome, unidade de medida, método analítico e parâmetros de referência
3. O catálogo fica disponível para seleção na criação de laudos
4. Quando um resultado for registrado no laudo, o sistema compara com os limites cadastrados e determina automaticamente: CONFORME ou NÃO CONFORME

## Fluxos alternativos e exceções

### Ensaio com referência textual
Alguns ensaios não têm valor numérico — por exemplo, "Coliformes Totais" pode ter referência "Ausência em 100mL". Nesse caso, `tipoComparacao = TEXTO` e o campo `valorReferencia` contém o texto, sem comparação automática possível.

### Desativação de ensaio
Quando um laboratório deixa de realizar um ensaio, o administrador pode desativá-lo. Ele some do catálogo ativo mas permanece nos laudos históricos que o utilizaram.

## Regras de negócio importantes

- **RN-01**: Cada ensaio pertence exclusivamente ao laboratório que o cadastrou
- **RN-02**: O nome do ensaio é único por laboratório
- **RN-03**: Se `tipoComparacao = ENTRE`, ambos os limites (mínimo e máximo) são obrigatórios
- **RN-04**: Se `tipoComparacao = MENOR_QUE` ou `MENOR_IGUAL`, apenas o limite máximo é obrigatório
- **RN-05**: Se `tipoComparacao = MAIOR_QUE` ou `MAIOR_IGUAL`, apenas o limite mínimo é obrigatório
- **RN-06**: Se `tipoComparacao = TEXTO`, o campo `valorReferencia` é obrigatório
- **RN-07**: Soft delete — ensaio desativado não aparece no catálogo mas é preservado no histórico

## Estrutura do valor de referência

O valor de referência é armazenado em três campos complementares:

| Campo | Tipo | Propósito |
|-------|------|-----------|
| `tipoComparacao` | Enum | Define a operação de comparação |
| `limiteMinimo` / `limiteMaximo` | Float | Valores para comparação automática no laudo |
| `valorReferencia` | Texto | Exibição formatada (ex: "6,0 a 9,5") ou referência textual |

## Dados envolvidos

O Ensaio pertence a um Laboratório (tenant). Futuramente estará associado a Laudos, onde cada item do laudo terá: ensaio selecionado + resultado registrado + status de conformidade calculado.

## Restrições e isolamento

O catálogo de ensaios é completamente isolado por laboratório. Um analista do Laboratório A não vê nem acessa os ensaios do Laboratório B.

## Endpoints da API

| Operação | Método | Path |
|----------|--------|------|
| Cadastrar ensaio | POST | /api/v1/assays |
| Listar ensaios | GET | /api/v1/assays |
| Visualizar ensaio | GET | /api/v1/assays/:id |
| Editar ensaio | PATCH | /api/v1/assays/:id |
| Desativar ensaio | DELETE | /api/v1/assays/:id |

## Histórico de alterações

| Data | Feature | Descrição da mudança |
|------|---------|----------------------|
| 2026-05-08 | CRUD de Ensaios | Criação inicial — catálogo de análises com parâmetros de referência para conformidade automática |
