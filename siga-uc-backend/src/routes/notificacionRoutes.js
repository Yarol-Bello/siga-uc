/**
 * Rutas de Notificaciones
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const notificacionController = require("../controllers/notificacionController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// ============================================================
// CONSULTAS (cualquier usuario autenticado)
// ============================================================
router.get("/", notificacionController.listar);
router.get("/no-leidas", notificacionController.contarNoLeidas);
router.get("/:id", notificacionController.obtener);

// ============================================================
// ACCIONES SOBRE MIS NOTIFICACIONES
// ============================================================
router.put("/:id/leer", notificacionController.marcarLeida);
router.put("/leer-todas", notificacionController.marcarTodasLeidas);
router.delete("/:id", notificacionController.eliminar);

// ============================================================
// ENVÍO (solo ADMIN y DOCENTE)
// ============================================================
router.post(
  "/",
  verificarRol("ADMIN", "DOCENTE"),
  notificacionController.crear,
);
router.post(
  "/masivo",
  verificarRol("ADMIN"),
  notificacionController.crearMasivo,
);

module.exports = router;
