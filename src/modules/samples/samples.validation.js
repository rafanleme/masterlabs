const { z } = require('zod');

const createSampleSchema = z.object({
  attendanceId:       z.string().min(1),
  descricao:          z.string().trim().min(2),
  dataColeta:         z.string().datetime().optional(),
  dataRecebimento:    z.string().datetime().optional(),
  amostrador:         z.string().trim().optional(),
  etiqueta:           z.string().trim().optional(),
  motivo:             z.string().trim().optional(),
  temperaturaAmostra: z.number().optional(),
  temperaturaAmbiente:z.number().optional(),
  umidadeRelativa:    z.number().min(0).max(100).optional(),
  pontoColeta:        z.string().trim().optional(),
  observacoes:        z.string().trim().optional(),
});

const updateSampleSchema = z.object({
  descricao:          z.string().trim().min(2).optional(),
  dataColeta:         z.string().datetime().optional(),
  dataRecebimento:    z.string().datetime().optional(),
  amostrador:         z.string().trim().optional(),
  etiqueta:           z.string().trim().optional(),
  motivo:             z.string().trim().optional(),
  temperaturaAmostra: z.number().optional(),
  temperaturaAmbiente:z.number().optional(),
  umidadeRelativa:    z.number().min(0).max(100).optional(),
  pontoColeta:        z.string().trim().optional(),
  observacoes:        z.string().trim().optional(),
});

const sampleStatusSchema = z.object({
  status: z.enum(['RECEBIDA', 'EM_ANALISE', 'CANCELADA', 'REJEITADA', 'CONCLUIDA']),
});

module.exports = { createSampleSchema, updateSampleSchema, sampleStatusSchema };
