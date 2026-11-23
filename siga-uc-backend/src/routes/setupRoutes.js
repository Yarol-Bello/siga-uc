/**
 * Rutas públicas de primera configuración (H79 / Fase 7)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const setupController = require("../controllers/setupController");

const router = express.Router();

/**
 * @route   GET /api/setup/status
 * @desc    Indica si el sistema requiere la primera configuración
 * @access  Público
 */
router.get("/status", setupController.estado);

/**
 * @route   POST /api/setup/inicializar
 * @desc    Crea el primer ADMIN, institución, año y grados
 * @access  Público con token de instalación
 */
router.post("/inicializar", setupController.inicializar);

module.exports = router;
