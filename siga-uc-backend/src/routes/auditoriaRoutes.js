/**
 * Rutas de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const auditoriaController = require("../controllers/auditoriaController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// ============================================================
// CONSULTAS
// ============================================================
router.get("/", auditoriaController.listarBitacora);
router.get("/modulos", auditoriaController.listarModulos);
router.get("/estadisticas", auditoriaController.getEstadisticas);
router.get("/actas", auditoriaController.listarActas);
router.get("/:id", auditoriaController.obtenerBitacora);

// ============================================================
// MODIFICACIONES (solo ADMIN)
// ============================================================
router.post(
  "/actas/cerrar",
  verificarRol("ADMIN"),
  auditoriaController.cerrarActa,
);

module.exports = router;
