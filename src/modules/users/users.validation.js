const { z } = require('zod');

const createUserSchema = z.object({
  name:     z.string().trim().min(2),
  email:    z.string().email(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  role:     z.enum(['ADMIN', 'ANALYST', 'VIEWER']).default('ANALYST'),
});

const updateUserSchema = z.object({
  name:     z.string().trim().min(2).optional(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').optional(),
  role:     z.enum(['ADMIN', 'ANALYST', 'VIEWER']).optional(),
  active:   z.boolean().optional(),
});

module.exports = { createUserSchema, updateUserSchema };
