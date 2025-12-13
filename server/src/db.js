/**
 * PostgreSQL connection pool helper
 * PostgreSQL database connection pool
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionString: process.env.DATABASE_URL || 'postgresql://xdrive:xdrive@localhost:5432/xdrive',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
