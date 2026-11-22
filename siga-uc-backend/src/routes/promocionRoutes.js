/**
 * Rutas de promociones anuales (H73 / Fase 6.3)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * ADMIN: todo. SECRETARIA: lectura y preview. DOCENTE/ESTUDIANTE: 403.
 */

const express = require("express");
const promocionController = require("../controllers/promocionController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(verificarAutenticacion);

// Rutas fijas antes de las paramétricas.
router.get(
  "/politicas",
  verificarRol("ADMIN", "SECRETARIA"),
  promocionController.listarPoliticas,
);
router.post(
  "/politicas",
  verificarRol("ADMIN"),
  promocionController.crearPolitica,
);
router.put(
  "/politicas/:id",
  verificarRol("ADMIN"),
  promocionController.actualizarPolitica,
);

router.post(
  "/preview",
  verificarRol("ADMIN", "SECRETARIA"),
  promocionController.preview,
);
router.post(
  "/confirmar",
  verificarRol("ADMIN"),
  promocionController.confirmar,
);

router.get(
  "/",
  verificarRol("ADMIN", "SECRETARIA"),
  promocionController.listar,
);
router.get(
  "/:id",
  verificarRol("ADMIN", "SECRETARIA"),
  promocionController.obtener,
);

router.put(
  "/:id/anular",
  verificarRol("ADMIN"),
  promocionController.anular,
);

module.exports = router;
