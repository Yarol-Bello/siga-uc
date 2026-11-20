/**
 * Validación y carga de variables de entorno
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

require("dotenv").config();

// Variables requeridas (obligatorias)
const requiredEnvVars = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
];

// Validar que existan las variables requeridas
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Faltan variables de entorno requeridas:");
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  console.error(
    "\n💡 Copia el archivo .env.example a .env y completa los valores.",
  );
  process.exit(1);
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
    HOST: process.env.DB_HOST,
    PORT: parseInt(process.env.DB_PORT),
    USER: process.env.DB_USER,
    PASSWORD: process.env.DB_PASSWORD,
    NAME: process.env.DB_NAME,
  },

  JWT: {
    SECRET: process.env.JWT_SECRET,
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  },

  APP: {
    NAME: process.env.APP_NAME || "SIGA-UC",
    VERSION: process.env.APP_VERSION || "1.0.0",
  },

  SMTP: {
    HOST: process.env.SMTP_HOST || "smtp.gmail.com",
    PORT: parseInt(process.env.SMTP_PORT) || 587,
    SECURE: process.env.SMTP_SECURE === "true",
    USER: process.env.SMTP_USER,
    PASSWORD: process.env.SMTP_PASSWORD,
    FROM_NAME: process.env.SMTP_FROM_NAME || "SIGA-UC",
  },
};
