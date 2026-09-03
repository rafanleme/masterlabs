if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
}

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.MYSQL_HOST || process.env.DATABASE_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    database: process.env.MYSQL_DB || process.env.DATABASE_DEFAULT,
    user: process.env.MYSQL_USER || process.env.DATABASE_USER,
    password: process.env.MYSQL_PASSWORD || process.env.DATABASE_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  storage: {
    baseUrl: process.env.STORAGE_BASE_URL || 'https://www.rtisolutionscode.com.br/storage',
    apiKey: process.env.STORAGE_API_KEY,
    timeoutMs: parseInt(process.env.STORAGE_TIMEOUT_MS || '30000', 10),
    maxBytes: parseInt(process.env.STORAGE_MAX_BYTES || '10485760', 10),
  },
  cors: {
    // CORS_ORIGINS="https://app.exemplo.com,https://outro.com" — vazio libera todas
    origins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED
      ? process.env.RATE_LIMIT_ENABLED === 'true'
      : (process.env.NODE_ENV || 'development') === 'production',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),      // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
    authWindowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || '900000', 10),
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '20', 10),
  },
  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.MAIL_FROM || 'MasterLabs <no-reply@masterlabs.com.br>',
  },
  portal: {
    codeTtlMinutes: parseInt(process.env.PORTAL_CODE_TTL_MINUTES || '15', 10),
    maxVerifyAttempts: parseInt(process.env.PORTAL_MAX_VERIFY_ATTEMPTS || '5', 10),
    maxCodesPerHour: parseInt(process.env.PORTAL_MAX_CODES_PER_HOUR || '3', 10),
    jwtExpiresIn: process.env.PORTAL_JWT_EXPIRES_IN || '1h',
  },
};
