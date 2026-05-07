const { z } = require('zod');

const createAttendanceSchema = z.object({
  clientId:       z.string().min(1),
  tipoColeta:     z.enum(['IN_LOCO', 'ENTREGA_NO_LABORATORIO']),
  descricao:      z.string().trim().min(2).optional(),
  dataSolicitacao: z.string().datetime().optional(),
  prazoEntrega:   z.string().datetime().optional(),
  responsavel:    z.string().trim().optional(),
  observacoes:    z.string().trim().optional(),
});

const updateAttendanceSchema = z.object({
  tipoColeta:     z.enum(['IN_LOCO', 'ENTREGA_NO_LABORATORIO']).optional(),
  descricao:      z.string().trim().min(2).optional(),
  dataSolicitacao: z.string().datetime().optional(),
  prazoEntrega:   z.string().datetime().optional(),
  responsavel:    z.string().trim().optional(),
  observacoes:    z.string().trim().optional(),
});

const attendanceStatusSchema = z.object({
  status: z.enum(['ABERTO', 'EM_ANDAMENTO', 'ENCERRADO', 'CANCELADO']),
});

module.exports = { createAttendanceSchema, updateAttendanceSchema, attendanceStatusSchema };
