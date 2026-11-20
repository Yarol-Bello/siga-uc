/**
 * Rutas de Configuración del Sistema
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const configuracionController = require("../controllers/configuracionController");

const router = express.Router();

/**
 * @route   GET /api/configuracion
 * @desc    Configuración pública del sistema (año lectivo activo)
 * @access  Público
 */
router.get("/", configuracionController.obtener);

module.exports = router;
