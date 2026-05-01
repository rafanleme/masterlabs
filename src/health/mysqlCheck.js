const mysql = require('mysql2/promise');
const config = require('../config');

async function checkMysql() {
  const start = Date.now();
  let connection;

  try {
    connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      connectTimeout: 5000,
    });

    await connection.ping();

    return {
      name: 'mysql',
      status: 'Healthy',
      description: 'MySQL connection successful',
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      name: 'mysql',
      status: 'Unhealthy',
      description: err.message,
      duration: Date.now() - start,
    };
  } finally {
    if (connection) await connection.end();
  }
}

module.exports = { checkMysql };
