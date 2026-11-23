/**
 * Rutas de Configuración del Sistema (Fase 1 / H74)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const configuracionController = require("../controllers/configuracionController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/authRoles");

const router = express.Router();

/**
 * @route   GET /api/configuracion
 * @desc    Configuración pública segura (año activo e institución visible)
 * @access  Público
 */
router.get("/", configuracionController.obtenerPublica);

/**
 * @route   GET /api/configuracion/admin
 * @desc    Configuración completa (institución y años)
 * @access  ADMIN/SECRETARIA
 */
router.get(
  "/admin",
  verificarAutenticacion,
  checkRole(["ADMIN", "SECRETARIA"]),
  configuracionController.obtenerAdmin,
);

/**
 * @route   PUT /api/configuracion/institucional
 * @desc    Actualiza la configuración institucional global
 * @access  ADMIN
 */
router.put(
  "/institucional",
  verificarAutenticacion,
  checkRole(["ADMIN"]),
  configuracionController.actualizarInstitucional,
);

module.exports = router;
