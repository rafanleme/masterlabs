const { z } = require('zod');

const requestCodeSchema = z.object({
  email: z.string().email(),
});

const verifyCodeSchema = z.object({
  email:    z.string().email(),
  code:     z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos'),
  tenantId: z.string().trim().min(1).optional(),
});

module.exports = { requestCodeSchema, verifyCodeSchema };
