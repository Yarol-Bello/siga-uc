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

const env = require("./config/env");
const { testConnection } = require("./config/database");
const response = require("./utils/response");

// Crear aplicación Express
const app = express();

// ============================================================
// MIDDLEWARES GLOBALES
// ============================================================

// Seguridad HTTP
app.use(helmet());

// CORS (permitir frontend Angular en localhost:4200)
app.use(
  cors({
    origin: ["http://localhost:4200", "http://localhost:3000"],
    credentials: true,
  }),
);

// Parsear JSON en el body
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logger de peticiones HTTP
if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ============================================================
// RUTAS
// ============================================================

// Ruta de health check
app.get("/api/health", (req, res) => {
  response.success(res, 200, "SIGA-UC API funcionando correctamente", {
    app: env.APP.NAME,
    version: env.APP.VERSION,
    environment: env.NODE_ENV,
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

// Rutas de gestión académica (grados, cursos, competencias)
const academicoRoutes = require("./routes/academicoRoutes");
app.use("/api", academicoRoutes);

// Rutas de gestión de alumnos
const alumnoRoutes = require("./routes/alumnoRoutes");
app.use("/api/alumnos", alumnoRoutes);

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

// ============================================================
// MANEJO DE ERRORES
// ============================================================

// Ruta no encontrada (404)
app.use((req, res) => {
  response.notFound(res, `Ruta ${req.method} ${req.path} no encontrada`);
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  console.error(err.stack);

  response.error(
    res,
    err.status || 500,
    err.message || "Error interno del servidor",
    env.NODE_ENV === "development" ? err.stack : null,
  );
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================

const PORT = env.PORT;

const startServer = async () => {
  try {
    console.log("\n🚀 Iniciando SIGA-UC Backend...\n");

    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error("\n⚠️  El servidor arrancará pero sin conexión a la BD.");
      console.error("   Verifica las credenciales en el archivo .env\n");
    }

    app.listen(PORT, () => {
      console.log("═══════════════════════════════════════════════════");
      console.log(`   🎓 ${env.APP.NAME} v${env.APP.VERSION}`);
      console.log("═══════════════════════════════════════════════════");
      console.log(`   🌐 Servidor:     http://localhost:${PORT}`);
      console.log(`   📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`   🌍 Ambiente:     ${env.NODE_ENV}`);
      console.log(`   🕐 Zona horaria: ${env.TZ}`);
      console.log(
        `   💾 BD:           ${env.DB.NAME}@${env.DB.HOST}:${env.DB.PORT}`,
      );
      console.log("═══════════════════════════════════════════════════\n");
    });
  } catch (error) {
    console.error("❌ Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

process.on("SIGINT", () => {
  console.log("\n\n👋 Cerrando servidor SIGA-UC...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n👋 Cerrando servidor SIGA-UC...");
  process.exit(0);
});

startServer();

module.exports = app;
