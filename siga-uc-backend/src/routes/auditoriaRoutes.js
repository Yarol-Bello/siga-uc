/**
 * Rutas de Auditoría y Actas
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const auditoriaController = require("../controllers/auditoriaController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/authRoles");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// El resto de auditoría queda restringido a ADMIN
router.use(checkRole(["ADMIN"]));

// PDF de acta: solo ADMIN (H63). Una eventual descarga para DOCENTE debe
// validar el grado del acta; las actas globales (id_grado NULL) son ADMIN-only.
router.get("/actas/:id_acta/pdf", auditoriaController.getActaPdf);

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
  auditoriaController.cerrarActa,
);

module.exports = router;
