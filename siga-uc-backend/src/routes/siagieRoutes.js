/**
 * Rutas de Exportación Interna de Calificaciones (SIAGIE)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Exportación interna: no hay portal MINEDU, ni plantilla oficial, ni carga de
 * archivos. Solo se leen notas finales de SIGA-UC y se genera un Excel.
 */

const express = require("express");
const siagieController = require("../controllers/siagieController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Todas las rutas requieren autenticación y rol ADMIN.
router.use(verificarAutenticacion);
router.use(verificarRol("ADMIN"));

/**
 * @route   GET /api/siagie/resumen
 * @desc    Conteos y advertencias de la exportación interna
 * @access  Privado (ADMIN)
 */
router.get("/resumen", siagieController.obtenerResumen);

/**
 * @route   GET /api/siagie/exportar
 * @desc    Genera y descarga el Excel interno de calificaciones
 * @access  Privado (ADMIN)
 */
router.get("/exportar", siagieController.exportarInterno);

/**
 * @route   GET /api/siagie/exportaciones/:codigo/verificar
 * @desc    Verifica un código de control interno contra los datos actuales
 * @access  Privado (ADMIN)
 */
router.get(
  "/exportaciones/:codigo/verificar",
  siagieController.verificarExportacion,
);

module.exports = router;
