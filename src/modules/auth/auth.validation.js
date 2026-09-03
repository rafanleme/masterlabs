const { z } = require('zod');

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  cnpj:     z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos').optional(),
});

module.exports = { loginSchema };
