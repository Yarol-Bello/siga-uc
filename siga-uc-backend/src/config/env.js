/**
 * Validación y carga de variables de entorno
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

require("dotenv").config();

const databaseUrl = (process.env.DATABASE_URL || "").trim();

// Variables requeridas (obligatorias). Con DATABASE_URL no hacen falta las DB_*.
const requiredEnvVars = ["JWT_SECRET"];
if (!databaseUrl) {
  requiredEnvVars.push(
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
  );
}

// Validar que existan las variables requeridas
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Faltan variables de entorno requeridas:");
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  console.error(
    "\n💡 Copia el archivo .env.example a .env y completa los valores.",
  );
  console.error(
    "   También puedes definir DATABASE_URL en lugar de las variables DB_*.",
  );
  process.exit(1);
}

// ============================================================
// VALIDACIONES DE PRODUCCIÓN
// ============================================================
const esProduccion = (process.env.NODE_ENV || "development") === "production";
const jwtSecret = process.env.JWT_SECRET || "";
const secretoDeEjemplo =
  /cambiar|ejemplo|example|changeme|tu_clave|una_clave_larga/i.test(jwtSecret);

if (esProduccion && (jwtSecret.length < 32 || secretoDeEjemplo)) {
  console.error(
    "❌ NODE_ENV=production requiere un JWT_SECRET de al menos 32 caracteres y distinto de los valores de ejemplo.",
  );
  process.exit(1);
}

if (esProduccion && !process.env.FRONTEND_URL) {
  console.error(
    "❌ NODE_ENV=production requiere FRONTEND_URL (CORS y enlaces de recuperación).",
  );
  console.error(
    "   Sin esa variable CORS solo permitiría localhost y el frontend no podría autenticarse.",
  );
  process.exit(1);
}

// ============================================================
// ZONA HORARIA
// ============================================================
// TZ no se aplica desde JavaScript: Node toma la zona del sistema/proceso al
// arrancar. Debe definirse como variable de entorno del proceso (en Render:
// Environment > TZ=America/Lima), no dentro del código.
const zonaProceso = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (zonaProceso !== "America/Lima") {
  console.warn(
    `⚠️ Zona horaria del proceso: ${zonaProceso}. Se recomienda TZ=America/Lima como variable de entorno del proceso (en Render, no en JS).`,
  );
}

// Año lectivo activo (configurable por despliegue)
const anioLectivoConfigurado = Number.parseInt(process.env.ANIO_LECTIVO, 10);
const anioLectivoValido =
  Number.isInteger(anioLectivoConfigurado) &&
  anioLectivoConfigurado >= 2000 &&
  anioLectivoConfigurado <= 2100;

const ANIO_LECTIVO = anioLectivoValido
  ? anioLectivoConfigurado
  : new Date().getFullYear();

if (!anioLectivoValido) {
  console.warn(
    `⚠️ ANIO_LECTIVO no configurado o inválido. Usando año calendario: ${ANIO_LECTIVO}`,
  );
}

// Exportar configuración centralizada
module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT) || 3000,
  TZ: process.env.TZ || "America/Lima",
  ANIO_LECTIVO,

  DB: {
    URL: databaseUrl || null,
    SSL:
      String(process.env.DB_SSL).toLowerCase() === "true" ||
      /[?&]sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl),
    HOST: process.env.DB_HOST,
    PORT: parseInt(process.env.DB_PORT),
    USER: process.env.DB_USER,
    PASSWORD: process.env.DB_PASSWORD,
    NAME: process.env.DB_NAME,
    POOL_MAX: parseInt(process.env.DB_POOL_MAX) || 20,
  },

  JWT: {
    SECRET: process.env.JWT_SECRET,
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  },

  APP: {
    NAME: process.env.APP_NAME || "SIGA-UC",
    VERSION: process.env.APP_VERSION || "1.0.0",
  },
};
