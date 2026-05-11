const { z } = require('zod');

const createReportSchema = z.object({
  sampleId:         z.string().min(1),
  reportTemplateId: z.string().min(1),
  responsavel:      z.string().trim().max(200).optional(),
  observacoes:      z.string().trim().max(2000).optional(),
});

const updateReportSchema = z.object({
  responsavel: z.string().trim().max(200).optional(),
  observacoes: z.string().trim().max(2000).optional(),
});

const updateReportItemSchema = z.object({
  valor:         z.string().trim().max(500).optional(),
  valorNumerico: z.number().nullable().optional(),
  observacoes:   z.string().trim().max(1000).optional(),
});

const reportStatusSchema = z.object({
  status: z.enum(['EMITIDO', 'CANCELADO']),
});

module.exports = { createReportSchema, updateReportSchema, updateReportItemSchema, reportStatusSchema };
