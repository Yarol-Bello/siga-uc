/**
 * Rutas de autenticación
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const {
  verificarAutenticacion,
  verificarRol,
} = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar usuario y obtener token JWT
 * @access  Público
 */
router.post(
  "/login",
  [
    body("dni")
      .notEmpty()
      .withMessage("El DNI es obligatorio")
      .isLength({ min: 8, max: 8 })
      .withMessage("El DNI debe tener 8 dígitos")
      .isNumeric()
      .withMessage("El DNI debe contener solo números"),
    body("password")
      .notEmpty()
      .withMessage("La contraseña es obligatoria")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
  ],
  authController.login,
);

/**
 * @route   GET /api/auth/perfil
 * @desc    Obtener perfil del usuario autenticado
 * @access  Privado (requiere JWT)
 */
router.get("/perfil", verificarAutenticacion, authController.perfil);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar si el token es válido
 * @access  Privado (requiere JWT)
 */
router.get("/verify", verificarAutenticacion, authController.verify);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión
 * @access  Privado (requiere JWT)
 */
router.post("/logout", verificarAutenticacion, authController.logout);

/**
 * @route   PUT /api/auth/reset-password
 * @desc    Restablecer contraseña por DNI (Admin)
 * @access  Privado (ADMIN)
 */
router.put(
  "/reset-password",
  verificarAutenticacion,
  verificarRol("ADMIN"),
  authController.resetPassword,
);

module.exports = router;
