/**
 * Rutas de gestión de alumnos
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const { body } = require("express-validator");
const alumnoController = require("../controllers/alumnoController");
const {
  verificarAutenticacion,
} = require("../middlewares/authMiddleware");
const {
  checkRole,
  checkAlumnoPropio,
  checkAlumnoPorDni,
} = require("../middlewares/authRoles");

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarAutenticacion);

// ============================================================
// CONSULTAS
// ============================================================
router.get("/", checkRole(["ADMIN", "SECRETARIA"]), alumnoController.listar);
router.get(
  "/dni/:dni",
  checkRole(["ADMIN", "SECRETARIA", "DOCENTE", "ESTUDIANTE"]),
  checkAlumnoPorDni,
  alumnoController.buscarPorDni,
);
router.get(
  "/:id",
  checkRole(["ADMIN", "SECRETARIA", "DOCENTE", "ESTUDIANTE"]),
  checkAlumnoPropio,
  alumnoController.obtener,
);

// ============================================================
// MODIFICACIONES (solo ADMIN y SECRETARIA)
// ============================================================
router.post(
  "/",
  checkRole(["ADMIN", "SECRETARIA"]),
  [
    body("dni")
      .isLength({ min: 8, max: 8 })
      .withMessage("DNI debe tener 8 dígitos")
      .isNumeric(),
    body("nombres").notEmpty().withMessage("Nombres obligatorio"),
    body("apellidos").notEmpty().withMessage("Apellidos obligatorio"),
    body("fecha_nacimiento").isDate().withMessage("Fecha inválida"),
    body("id_grado").isInt().withMessage("Grado inválido"),
  ],
  alumnoController.crear,
);

router.put(
  "/:id",
  checkRole(["ADMIN", "SECRETARIA"]),
  alumnoController.actualizar,
);

router.put(
  "/:id/retirar",
  checkRole(["ADMIN", "SECRETARIA"]),
  [body("motivo_retiro").notEmpty().withMessage("Motivo obligatorio")],
  alumnoController.retirar,
);

module.exports = router;
