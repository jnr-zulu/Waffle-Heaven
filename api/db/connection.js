// api/db/connections.js
// Database connection configuration for Waffle Heaven restaurant

const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT, // Added port configuration
  waitForConnections: true,
  connectionLimit: 10, // Adjust based on your application needs
  queueLimit: 0,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true
  } : false
});

// Test the database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Execute a query with parameters
async function query(sql, params) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Execute a transaction with multiple queries
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('Transaction failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Add error handling for connection issues
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('Database connection was closed. Attempting to reconnect...');
    // Implement reconnection logic if needed
  }
});

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};