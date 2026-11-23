#!/usr/bin/env node
/**
 * Limpia los datos de demostración para volver a ejecutar `uat:seed`.
 *
 * SOLO DEMO. No usar en una base con datos reales.
 *
 * Uso:
 *   $env:UAT_DATABASE_URL="postgresql://..."; $env:CONFIRM_DEMO_RESET="1"; npm run demo:reset
 *
 * Después:
 *   $env:UAT_BASE_URL="https://.../api"; $env:UAT_ADMIN_PASSWORD="..."; npm run uat:seed
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const rutaEnv = path.join(__dirname, "..", ".env");
if (fs.existsSync(rutaEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rutaEnv);
}

const conexion = (process.env.UAT_DATABASE_URL || "").trim();
if (!conexion) {
  console.error(
    "Falta UAT_DATABASE_URL. Usa la conexión directa/session pooler de la base demo.",
  );
  process.exit(1);
}
if (process.env.CONFIRM_DEMO_RESET !== "1") {
  console.error(
    "Este comando elimina alumnos, pagos y pensiones de la base demo.\n" +
      "Define CONFIRM_DEMO_RESET=1 para confirmar.",
  );
  process.exit(1);
}

const rutaSql = path.join(
  __dirname,
  "..",
  "..",
  "database",
  "demo_reset_seed_v2.sql",
);
if (!fs.existsSync(rutaSql)) {
  console.error("No se encontró database/demo_reset_seed_v2.sql");
  process.exit(1);
}

const pool = new Pool({
  connectionString: conexion,
  ssl:
    /supabase|sslmode=require/i.test(conexion)
      ? { rejectUnauthorized: false }
      : undefined,
  max: 1,
});

(async () => {
  try {
    const antes = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM alumnos) AS alumnos,
        (SELECT COUNT(*)::int FROM pagos) AS pagos,
        (SELECT COUNT(*)::int FROM pensiones) AS pensiones,
        (SELECT COUNT(*)::int FROM conclusiones_descriptivas) AS conclusiones
    `);
    console.log("Antes:", antes.rows[0]);

    await pool.query(fs.readFileSync(rutaSql, "utf8"));

    const despues = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM alumnos) AS alumnos,
        (SELECT COUNT(*)::int FROM pagos) AS pagos,
        (SELECT COUNT(*)::int FROM pensiones) AS pensiones,
        (SELECT COUNT(*)::int FROM conclusiones_descriptivas) AS conclusiones
    `);
    console.log("Después:", despues.rows[0]);
    console.log("Limpieza completada. Ejecuta ahora: npm run uat:seed");
  } catch (error) {
    console.error("Falló la limpieza demo:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
})();
