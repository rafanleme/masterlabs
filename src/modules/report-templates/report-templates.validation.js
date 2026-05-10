const { z } = require('zod');

function noDuplicates(assayIds, ctx) {
  if (!assayIds) return;
  const unique = new Set(assayIds);
  if (unique.size !== assayIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assayIds'], message: 'assayIds não pode conter duplicatas' });
  }
}

const createReportTemplateSchema = z.object({
  nome:      z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(1000).optional(),
  assayIds:  z.array(z.string()).min(1, 'assayIds deve ter pelo menos 1 ensaio'),
}).superRefine((data, ctx) => noDuplicates(data.assayIds, ctx));

const updateReportTemplateSchema = z.object({
  nome:      z.string().trim().min(1).max(200).optional(),
  descricao: z.string().trim().max(1000).optional(),
  assayIds:  z.array(z.string()).min(1, 'assayIds deve ter pelo menos 1 ensaio').optional(),
}).superRefine((data, ctx) => noDuplicates(data.assayIds, ctx));

module.exports = { createReportTemplateSchema, updateReportTemplateSchema };
