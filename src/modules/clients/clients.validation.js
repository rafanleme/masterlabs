const { z } = require('zod');

const documentoSchema = z.string().regex(/^\d+$/, 'Documento deve conter apenas dígitos');

const createClientSchema = z.object({
  tipoPessoa: z.enum(['PF', 'PJ']),
  nome:       z.string().trim().min(2),
  documento:  documentoSchema,
  email:      z.string().email().optional(),
  telefone:   z.string().trim().optional(),
  endereco:   z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.tipoPessoa === 'PF' && data.documento.length !== 11) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['documento'], message: 'CPF deve ter 11 dígitos' });
  }
  if (data.tipoPessoa === 'PJ' && data.documento.length !== 14) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['documento'], message: 'CNPJ deve ter 14 dígitos' });
  }
});

const updateClientSchema = z.object({
  tipoPessoa: z.enum(['PF', 'PJ']).optional(),
  nome:       z.string().trim().min(2).optional(),
  documento:  documentoSchema.optional(),
  email:      z.string().email().optional(),
  telefone:   z.string().trim().optional(),
  endereco:   z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.tipoPessoa && data.documento) {
    if (data.tipoPessoa === 'PF' && data.documento.length !== 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['documento'], message: 'CPF deve ter 11 dígitos' });
    }
    if (data.tipoPessoa === 'PJ' && data.documento.length !== 14) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['documento'], message: 'CNPJ deve ter 14 dígitos' });
    }
  }
});

module.exports = { createClientSchema, updateClientSchema };
