/**
 * Backup de PostgreSQL para SIGA-UC
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Uso:
 *   npm run backup
 *
 * Genera un archivo .sql en siga-uc-backend/backups/
 * No modifica ni elimina datos de la base de datos.
 */

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve(__dirname, "../backups");

const pad = (value) => String(value).padStart(2, "0");

/**
 * Fecha segura para nombres de archivo en Windows/Linux/macOS.
 * Formato: YYYY-MM-DD_HH-mm-ss
 */
const timestamp = () => {
  const now = new Date();
  const date = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("-");
  const time = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("-");

  return `${date}_${time}`;
};

/**
 * Resuelve la conexión usando DATABASE_URL o las variables DB_*.
 */
const buildConnection = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    const env = { ...process.env };
    if (String(process.env.DB_SSL).toLowerCase() === "true") {
      env.PGSSLMODE = "require";
    }

    return {
      args: ["--dbname", databaseUrl],
      env,
      label: "DATABASE_URL",
    };
  }

  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USER || "postgres";
  const database = process.env.DB_NAME || "siga_uc";
  const password = process.env.DB_PASSWORD;

  if (!password) {
    throw new Error(
      "Falta DB_PASSWORD o DATABASE_URL. Configure el .env antes de respaldar.",
    );
  }

  const env = { ...process.env, PGPASSWORD: password };
  if (String(process.env.DB_SSL).toLowerCase() === "true") {
    env.PGSSLMODE = "require";
  }

  return {
    args: [
      "--host",
      host,
      "--port",
      String(port),
      "--username",
      user,
      "--dbname",
      database,
    ],
    env,
    label: `${host}:${port}/${database}`,
  };
};

const main = async () => {
  let filePath = null;

  try {
    const connection = buildConnection();

    // Verificar pg_dump antes de crear archivos o ejecutar el volcado.
    const pgDumpCheck = spawnSync("pg_dump", ["--version"], {
      stdio: "ignore",
      env: connection.env,
    });
    if (pgDumpCheck.error && pgDumpCheck.error.code === "ENOENT") {
      throw new Error("PG_DUMP_NOT_FOUND");
    }

    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const fileName = `backup_siga_uc_${timestamp()}.sql`;
    filePath = path.join(BACKUP_DIR, fileName);

    const args = [
      ...connection.args,
      "--format=plain",
      "--no-owner",
      "--no-privileges",
      "--encoding=UTF8",
      "--no-password",
      "--file",
      filePath,
    ];

    console.log(`💾 Generando backup de ${connection.label}...`);
    console.log(`   Destino: ${filePath}`);

    await new Promise((resolve, reject) => {
      const child = spawn("pg_dump", args, {
        env: connection.env,
        stdio: ["ignore", "ignore", "pipe"],
      });

      let stderr = "";
      let handled = false;

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        if (handled) return;
        handled = true;

        if (error.code === "ENOENT") {
          reject(new Error("PG_DUMP_NOT_FOUND"));
          return;
        }

        reject(error);
      });

      child.on("close", (code) => {
        if (handled) return;
        handled = true;

        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `pg_dump terminó con código ${code}${stderr ? `\n${stderr.trim()}` : ""}`,
          ),
        );
      });
    });

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error("El archivo de backup quedó vacío.");
    }

    console.log(
      `✅ Backup generado: ${fileName} (${(stats.size / 1024).toFixed(1)} KB)`,
    );
  } catch (error) {
    if (error.message === "PG_DUMP_NOT_FOUND") {
      console.error("❌ No se encontró pg_dump.");
      console.error(
        "   Por favor, instale PostgreSQL Client para generar respaldos.",
      );
      console.error("   Windows: https://www.postgresql.org/download/windows/");
      console.error("   Debian/Ubuntu: sudo apt-get install postgresql-client");
      console.error("   macOS: brew install postgresql");
    } else if (error.message.startsWith("pg_dump terminó")) {
      console.error("❌ Error al generar el backup.");
      console.error(error.message);
    } else {
      console.error("❌ Error al generar el backup:", error.message);
    }

    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.warn(
          "⚠️ No se pudo eliminar el archivo parcial:",
          cleanupError.message,
        );
      }
    }

    process.exitCode = 1;
  }
};

main();
