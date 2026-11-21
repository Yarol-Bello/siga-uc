/**
 * Configuración de la conexión a PostgreSQL
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Soporta dos formas de conexión, igual que scripts/backup.js:
 *  1. DATABASE_URL (tiene prioridad).
 *  2. Variables DB_* como fallback.
 *
 * SSL: se activa con DB_SSL=true o si DATABASE_URL incluye
 * sslmode=require|verify-ca|verify-full. Nunca se registran credenciales.
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const esProduccion = process.env.NODE_ENV === "production";

const parseEnteroPositivo = (valor, defecto) => {
  const numero = Number.parseInt(valor, 10);
  return Number.isInteger(numero) && numero > 0 ? numero : defecto;
};

const databaseUrl = (process.env.DATABASE_URL || "").trim();
const sslPorUrl = /[?&]sslmode=(require|verify-ca|verify-full)/i.test(
  databaseUrl,
);
const sslActivo =
  String(process.env.DB_SSL).toLowerCase() === "true" || sslPorUrl;

// Configuración del pool de conexiones
const configuracionPool = {
  max: parseEnteroPositivo(process.env.DB_POOL_MAX, 20),
  idleTimeoutMillis: parseEnteroPositivo(
    process.env.DB_IDLE_TIMEOUT_MS,
    30000,
  ),
  connectionTimeoutMillis: parseEnteroPositivo(
    process.env.DB_CONNECTION_TIMEOUT_MS,
    5000,
  ),
  // Todas las sesiones del pool trabajan en hora de Lima. Funciona también
  // cuando la conexión se define con DATABASE_URL.
  options: "-c timezone=America/Lima",
};

if (databaseUrl) {
  configuracionPool.connectionString = databaseUrl;
} else {
  configuracionPool.host = process.env.DB_HOST || "localhost";
  configuracionPool.port = parseInt(process.env.DB_PORT) || 5432;
  configuracionPool.user = process.env.DB_USER || "postgres";
  configuracionPool.password = process.env.DB_PASSWORD;
  configuracionPool.database = process.env.DB_NAME || "siga_uc";
}

if (sslActivo) {
  // Verificación real del certificado: se usa la CA de Supabase (pública,
  // versionada en certs/) o la ruta indicada en DB_SSL_CA.
  const rutaCa =
    process.env.DB_SSL_CA ||
    path.join(__dirname, "..", "..", "certs", "supabase-ca.crt");

  try {
    configuracionPool.ssl = {
      ca: fs.readFileSync(rutaCa, "utf8"),
      rejectUnauthorized: true,
    };
  } catch {
    console.error(
      `❌ DB_SSL activo pero no se pudo leer la CA en ${rutaCa}. ` +
        "Defina DB_SSL_CA con la ruta del certificado o desactive el SSL.",
    );
    process.exit(1);
  }
}

const pool = new Pool(configuracionPool);

const describirError = (error) => {
  if (!error) return "error desconocido";
  if (error.code && !error.message) return error.code;
  return error.code ? `${error.code}: ${error.message}` : error.message;
};

/**
 * Descripción segura de la conexión (sin usuario ni contraseña).
 */
const describirConexion = () => {
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      const base = url.pathname.replace(/^\//, "") || "postgres";
      return `${base}@${url.hostname}:${url.port || 5432} (DATABASE_URL)`;
    } catch {
      return "DATABASE_URL (formato no reconocido)";
    }
  }

  return `${process.env.DB_NAME || "siga_uc"}@${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}`;
};

// Evento: cuando se establece una conexión (solo en desarrollo, para no
// ensuciar los logs de producción con una línea por conexión nueva).
if (!esProduccion) {
  pool.on("connect", () => {
    console.log("✅ Conectado a PostgreSQL -", describirConexion());
  });
}

// Evento: error en un cliente inactivo del pool. Un fallo transitorio NO debe
// tumbar la API: se registra y el pool recicla la conexión.
pool.on("error", (err) => {
  console.error(
    "❌ Error inesperado en el pool de PostgreSQL (la API sigue activa):",
    describirError(err),
  );
});

/**
 * Ejecutar una consulta SQL
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (!esProduccion) {
      console.log(
        `📊 Query ejecutada en ${duration}ms | Filas: ${result.rowCount}`,
      );
    } else if (duration > 500) {
      const sql = String(text).replace(/\s+/g, " ").slice(0, 200);
      console.warn(`🐢 Query lenta (${duration}ms): ${sql}`);
    }

    return result;
  } catch (error) {
    console.error("❌ Error en consulta SQL:", describirError(error));
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
    console.log("   Conexión:", describirConexion());
    console.log("   Hora del servidor:", result.rows[0].ahora);
    console.log("   Versión PostgreSQL:", result.rows[0].version.split(",")[0]);

    // Verificar que la sesión del pool use la zona de negocio.
    const zonaResult = await pool.query("SHOW timezone");
    const zonaBd = zonaResult.rows[0]?.TimeZone;
    if (zonaBd === "America/Lima") {
      console.log("   Zona horaria BD:", zonaBd);
    } else {
      console.warn(
        `⚠️ La sesión de PostgreSQL usa "${zonaBd}" en lugar de "America/Lima". Las fechas/horas de negocio podrían desfasarse.`,
      );
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Fallo en la conexión a PostgreSQL:",
      describirError(error),
    );
    return false;
  }
};

/**
 * Healthcheck corto para /api/health. No bloquea más de `timeoutMs`.
 */
const checkDatabase = async (timeoutMs = 2000) => {
  let timer = null;

  try {
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("timeout de conexión a la BD")),
          timeoutMs,
        );
      }),
    ]);
    return true;
  } catch (error) {
    console.error(
      "❌ Healthcheck de base de datos:",
      describirError(error),
    );
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  checkDatabase,
  describirConexion,
};
