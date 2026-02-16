import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * MySQL Connection Pool (TypeScript)
 *
 * - Uses connection pooling for performance
 * - Typed query results with generics
 * - Transaction support for concurrency-safe operations
 */

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST || 'opsmind-mysql',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root_password',
  database: process.env.DB_DATABASE || 'workflow_db',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS !== 'false',
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0', 10),
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
  charset: 'utf8mb4',
});

/**
 * Execute a SELECT query and return typed rows
 */
async function query<T extends RowDataPacket[]>(sql: string, values: any[] = []): Promise<T> {
  const [rows] = await pool.execute<T>(sql, values);
  return rows;
}

/**
 * Execute an INSERT / UPDATE / DELETE and return result metadata
 */
async function execute(sql: string, values: any[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, values);
  return result;
}

/**
 * Get a raw connection from the pool (for transactions)
 */
async function getConnection(): Promise<PoolConnection> {
  return pool.getConnection();
}

/**
 * Begin a transaction and return the connection
 */
async function beginTransaction(): Promise<PoolConnection> {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
}

export { pool, query, execute, getConnection, beginTransaction };
