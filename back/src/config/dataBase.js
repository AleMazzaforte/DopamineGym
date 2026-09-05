// db/config.js
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 5, // Mantén bajo en Clever Cloud
  queueLimit: 0,
  connectTimeout: 60000,
  // Configuración crítica para Clever Cloud:
  idleTimeout: 30000, // 30 segundos
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 segundos
  // Para manejar el timeout de Clever Cloud
  maxIdle: 5,
  // Reconexión automática
  acquireTimeout: 60000,
  timeout: 60000
});
/*
// Eventos del pool para monitoreo
pool.on('connection', (connection) => {
  console.log('🔌 Nueva conexión a la base de datos');
});

pool.on('release', (connection) => {
  console.log('🔄 Conexión liberada al pool');
});

pool.on('error', (err) => {
  console.error('❌ Error en el pool:', err.code);
  if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Intentando reconectar...');
  }
});
*/