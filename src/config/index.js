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
};
