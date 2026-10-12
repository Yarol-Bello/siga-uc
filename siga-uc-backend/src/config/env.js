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

// Exportar configuración centralizada
module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT) || 3000,
  TZ: process.env.TZ || "America/Lima",

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
};
