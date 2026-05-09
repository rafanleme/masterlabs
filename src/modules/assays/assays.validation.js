const { z } = require('zod');

const tipoComparacaoEnum = z.enum(['MENOR_QUE', 'MAIOR_QUE', 'MENOR_IGUAL', 'MAIOR_IGUAL', 'ENTRE', 'TEXTO']);

function applyComparacaoRules(data, ctx) {
  const { tipoComparacao, limiteMinimo, limiteMaximo, valorReferencia } = data;
  if (!tipoComparacao) return;

  if (tipoComparacao === 'ENTRE') {
    if (limiteMinimo == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['limiteMinimo'], message: 'limiteMinimo é obrigatório quando tipoComparacao é ENTRE' });
    if (limiteMaximo == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['limiteMaximo'], message: 'limiteMaximo é obrigatório quando tipoComparacao é ENTRE' });
  }
  if (tipoComparacao === 'MENOR_QUE' || tipoComparacao === 'MENOR_IGUAL') {
    if (limiteMaximo == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['limiteMaximo'], message: `limiteMaximo é obrigatório quando tipoComparacao é ${tipoComparacao}` });
  }
  if (tipoComparacao === 'MAIOR_QUE' || tipoComparacao === 'MAIOR_IGUAL') {
    if (limiteMinimo == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['limiteMinimo'], message: `limiteMinimo é obrigatório quando tipoComparacao é ${tipoComparacao}` });
  }
  if (tipoComparacao === 'TEXTO') {
    if (!valorReferencia) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valorReferencia'], message: 'valorReferencia é obrigatório quando tipoComparacao é TEXTO' });
  }
}

const createAssaySchema = z.object({
  nome:            z.string().trim().min(1).max(200),
  unidade:         z.string().trim().min(1).max(50),
  descricao:       z.string().trim().max(1000).optional(),
  metodoAnalitico: z.string().trim().max(200).optional(),
  tipoComparacao:  tipoComparacaoEnum.optional(),
  limiteMinimo:    z.number().optional(),
  limiteMaximo:    z.number().optional(),
  valorReferencia: z.string().trim().max(500).optional(),
}).superRefine(applyComparacaoRules);

const updateAssaySchema = z.object({
  nome:            z.string().trim().min(1).max(200).optional(),
  unidade:         z.string().trim().min(1).max(50).optional(),
  descricao:       z.string().trim().max(1000).optional(),
  metodoAnalitico: z.string().trim().max(200).optional(),
  tipoComparacao:  tipoComparacaoEnum.optional(),
  limiteMinimo:    z.number().optional(),
  limiteMaximo:    z.number().optional(),
  valorReferencia: z.string().trim().max(500).optional(),
}).superRefine(applyComparacaoRules);

module.exports = { createAssaySchema, updateAssaySchema };
