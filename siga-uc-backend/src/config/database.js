/**
 * Configuración de la conexión a PostgreSQL
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { Pool } = require("pg");
require("dotenv").config();

// Configuración del pool de conexiones
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "siga_uc",

  // Configuración del pool
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Evento: cuando se establece una conexión
pool.on("connect", () => {
  console.log(
    "✅ Conectado a PostgreSQL - Base de datos:",
    process.env.DB_NAME,
  );
});

// Evento: cuando ocurre un error en el pool
pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de PostgreSQL:", err.message);
  process.exit(-1);
});

/**
 * Ejecutar una consulta SQL
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `📊 Query ejecutada en ${duration}ms | Filas: ${result.rowCount}`,
      );
    }

    return result;
  } catch (error) {
    console.error("❌ Error en consulta SQL:", error.message);
    throw error;
  }
};

/**
 * Obtener un cliente para transacciones
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Verificar la conexión a la base de datos
 */
const testConnection = async () => {
  try {
    const result = await pool.query(
      "SELECT NOW() as ahora, version() as version",
    );
    console.log("✅ Test de conexión exitoso");
    console.log("   Hora del servidor:", result.rows[0].ahora);
    console.log("   Versión PostgreSQL:", result.rows[0].version.split(",")[0]);
    return true;
  } catch (error) {
    console.error("❌ Fallo en la conexión a PostgreSQL:", error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
};
