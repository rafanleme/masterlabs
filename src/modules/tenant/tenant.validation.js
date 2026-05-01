const { z } = require('zod');

const registerSchema = z.object({
  razaoSocial:   z.string().min(2),
  nomeFantasia:  z.string().min(2),
  cnpj:          z.string().length(14).regex(/^\d+$/, 'CNPJ deve conter apenas dígitos'),
  email:         z.string().email(),
  telefone:      z.string().optional(),
  endereco:      z.string().optional(),
  adminName:     z.string().min(2),
  adminEmail:    z.string().email(),
  adminPassword: z.string().min(8),
});

module.exports = { registerSchema };
