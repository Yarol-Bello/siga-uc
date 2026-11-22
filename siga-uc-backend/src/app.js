/**
 * Servidor principal SIGA-UC
 * Sistema Integrado de Gestión Académica
 */

// Cargar variables de entorno PRIMERO
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const crypto = require("crypto");

const env = require("./config/env");
const {
  cargarAnioActivo,
} = require("./config/academico");
const {
  testConnection,
  checkDatabase,
  pool,
  describirConexion,
} = require("./config/database");
const response = require("./utils/response");

// Crear aplicación Express
const app = express();

// Detrás de proxy (Render) para que rate-limit use la IP real
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Identificador corto por petición. Se usa solo en logs (morgan y errores);
// no se agrega al JSON de respuesta.
app.use((req, res, next) => {
  req.id = crypto.randomBytes(4).toString("hex");
  res.setHeader("X-Request-Id", req.id);
  next();
});

// ============================================================
// MIDDLEWARES GLOBALES
// ============================================================

// Seguridad HTTP
app.use(helmet());

// CORS (permitir frontend Angular en local y en producción)
const allowedOrigins = [
  "http://localhost:4200",
  "http://localhost:3000",
  process.env.FRONTEND_URL, // se configura en Render
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  }),
);

// Parsear JSON en el body
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logger de peticiones HTTP
if (env.NODE_ENV === "production") {
  const formatoCombined =
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';
  morgan.token("reqid", (req) => req.id || "-");
  app.use(morgan(`:reqid ${formatoCombined}`));
} else {
  app.use(morgan("dev"));
}

// ============================================================
// RUTAS
// ============================================================

// Ruta de health check
app.get("/api/health", async (req, res) => {
  const baseDatosOk = await checkDatabase(2000);

  if (!baseDatosOk) {
    return res.status(503).json({
      success: false,
      message: "Servicio no disponible: base de datos sin conexión",
      errors: null,
      timestamp: new Date().toISOString(),
    });
  }

  return response.success(res, 200, "SIGA-UC API funcionando correctamente", {
    app: env.APP.NAME,
    version: env.APP.VERSION,
    environment: env.NODE_ENV,
    database: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Ruta raíz
app.get("/", (req, res) => {
  response.success(res, 200, `Bienvenido a ${env.APP.NAME} API`, {
    version: env.APP.VERSION,
    documentation: "/api/health",
  });
});

// Rutas de autenticación
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// Rutas de configuración pública (año lectivo activo)
const configuracionRoutes = require("./routes/configuracionRoutes");
app.use("/api/configuracion", configuracionRoutes);

// Rutas de gestión académica (grados, cursos, competencias)
const academicoRoutes = require("./routes/academicoRoutes");
app.use("/api", academicoRoutes);

// Rutas de horarios (H47)
const horarioRoutes = require("./routes/horarioRoutes");
app.use("/api/horarios", horarioRoutes);

// Rutas de gestión de alumnos
const alumnoRoutes = require("./routes/alumnoRoutes");
app.use("/api/alumnos", alumnoRoutes);

// Rutas de personal y usuarios
const personalRoutes = require("./routes/personalRoutes");
app.use("/api/personal", personalRoutes);

// Rutas de carga curricular
const cargaCurricularRoutes = require("./routes/cargaCurricularRoutes");
app.use("/api/carga-curricular", cargaCurricularRoutes);

// Rutas de asistencia
const asistenciaRoutes = require("./routes/asistenciaRoutes");
app.use("/api/asistencias", asistenciaRoutes);

// Rutas de calificaciones
const calificacionRoutes = require("./routes/calificacionRoutes");
app.use("/api/calificaciones", calificacionRoutes);

// Rutas de tesorería
const tesoreriaRoutes = require("./routes/tesoreriaRoutes");
app.use("/api/tesoreria", tesoreriaRoutes);

// Rutas de caja
const cajaRoutes = require("./routes/cajaRoutes");
app.use("/api/caja", cajaRoutes);

// Rutas de reportes
const reporteRoutes = require("./routes/reporteRoutes");
app.use("/api/reportes", reporteRoutes);

// Rutas de auditoría y actas
const auditoriaRoutes = require("./routes/auditoriaRoutes");
app.use("/api/auditoria", auditoriaRoutes);

// Rutas de exportación SIAGIE
const siagieRoutes = require("./routes/siagieRoutes");
app.use("/api/siagie", siagieRoutes);

// Rutas de notificaciones
const notificacionRoutes = require("./routes/notificacionRoutes");
app.use("/api/notificaciones", notificacionRoutes);

// ============================================================
// MANEJO DE ERRORES
// ============================================================

// Ruta no encontrada (404)
app.use((req, res) => {
  response.notFound(res, `Ruta ${req.method} ${req.path} no encontrada`);
});

// Manejo global de errores
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;

  console.error(
    `❌ Error [req ${req.id || "-"}]:`,
    err.code || "",
    err.message,
  );
  console.error(err.stack);

  if (statusCode >= 500) {
    return response.error(
      res,
      500,
      "Ocurrió un error interno en el servidor",
    );
  }

  return response.error(
    res,
    statusCode,
    err.message || "Error interno del servidor",
  );
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================

const PORT = env.PORT;

let server = null;
let cerrando = false;
let finalizado = false;

const cerrarServidor = (codigo = 0, motivo = "señal") => {
  if (cerrando) return;
  cerrando = true;

  console.log(`\n👋 Cerrando SIGA-UC (${motivo})...`);

  const finalizar = async () => {
    if (finalizado) return;
    finalizado = true;

    try {
      await pool.end();
      console.log("✅ Pool de PostgreSQL cerrado.");
    } catch (error) {
      console.error("⚠️ Error al cerrar el pool:", error.message);
    } finally {
      process.exit(codigo);
    }
  };

  if (server) {
    server.close(() => finalizar());
    // Salida ordenada aunque alguna conexión abierta demore el cierre.
    setTimeout(finalizar, 5000).unref();
  } else {
    finalizar();
  }
};

const startServer = async () => {
  try {
    console.log("\n🚀 Iniciando SIGA-UC Backend...\n");

    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error("\n⚠️  El servidor arrancará pero sin conexión a la BD.");
      console.error("   Verifica las credenciales en el archivo .env\n");
    }

    // El año activo se carga una vez al arrancar. La tabla manda sobre .env.
    const anioActivo = await cargarAnioActivo();
    console.log(
      `   📅 Año lectivo activo: ${anioActivo.anio} (fuente: ${anioActivo.fuente})`,
    );

    // Arrancar el servidor PRIMERO (sin esperar al SMTP)
    server = app.listen(PORT, "0.0.0.0", () => {
      console.log("═══════════════════════════════════════════════════");
      console.log(`   🎓 ${env.APP.NAME} v${env.APP.VERSION}`);
      console.log("═══════════════════════════════════════════════════");
      console.log(`   🌐 Servidor:     http://localhost:${PORT}`);
      console.log(`   📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`   🌍 Ambiente:     ${env.NODE_ENV}`);
      console.log(`   🕐 Zona horaria: ${env.TZ}`);
      console.log(`   💾 BD:           ${describirConexion()}`);
      console.log("═══════════════════════════════════════════════════\n");

      // Verificar conexión SMTP en SEGUNDO PLANO (no bloquea el arranque)
      setTimeout(async () => {
        try {
          const emailService = require("./services/emailService");
          await emailService.verificarConexion();
          console.log("✅ SMTP verificado correctamente.");
        } catch (err) {
          console.warn("⚠️  SMTP no disponible:", err.message);
          console.warn("   El servidor sigue funcionando, solo sin correos.\n");
        }
      }, 5000); // espera 5 segundos antes de verificar SMTP
    });
  } catch (error) {
    console.error("❌ Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

process.on("SIGINT", () => cerrarServidor(0, "SIGINT"));

process.on("SIGTERM", () => cerrarServidor(0, "SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error(
    "❌ Unhandled rejection (el proceso continúa):",
    reason instanceof Error ? reason.stack || reason.message : reason,
  );
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error?.stack || error);
  cerrarServidor(1, "uncaughtException");
});

startServer();

module.exports = app;
