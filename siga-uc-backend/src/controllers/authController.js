/**
 * Controlador de Autenticación
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { validationResult } = require("express-validator");
const authService = require("../services/authService");
const response = require("../utils/response");

/**
 * POST /api/auth/login
 * Autenticar un usuario y retornar token JWT
 */
const login = async (req, res) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return response.validationError(
        res,
        errors.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
      );
    }

    const { dni, password } = req.body;

    // Llamar al servicio
    const resultado = await authService.login(dni, password);

    return response.success(res, 200, "Login exitoso", resultado);
  } catch (error) {
    if (error.statusCode) {
      return response.error(res, error.statusCode, error.message);
    }
    console.error("❌ Error en login:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

/**
 * GET /api/auth/perfil
 * Obtener el perfil del usuario autenticado
 */
const perfil = async (req, res) => {
  try {
    const { id_usuario } = req.usuario;
    const perfil = await authService.getPerfil(id_usuario);
    return response.success(res, 200, "Perfil obtenido", perfil);
  } catch (error) {
    if (error.statusCode) {
      return response.error(res, error.statusCode, error.message);
    }
    console.error("❌ Error al obtener perfil:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

/**
 * POST /api/auth/verify
 * Verificar si un token es válido
 */
const verify = async (req, res) => {
  // Si llega aquí, el middleware ya validó el token
  return response.success(res, 200, "Token válido", {
    usuario: req.usuario,
  });
};

/**
 * POST /api/auth/logout
 * Cerrar sesión (solo del lado del cliente, eliminar token)
 */
const logout = async (req, res) => {
  // El backend no guarda sesiones, el cliente debe eliminar el token
  return response.success(res, 200, "Sesión cerrada exitosamente");
};

/**
 * PUT /api/usuarios/reset-password
 * Restablecer contraseña de un usuario (Admin)
 */
const resetPassword = async (req, res) => {
  try {
    const { dni } = req.body;

    if (!dni) {
      return response.error(res, 400, "El DNI es obligatorio");
    }

    const result = await authService.resetPassword(dni);

    return response.success(res, 200, "Contraseña restablecida", result);
  } catch (error) {
    console.error("❌ Error al restablecer contraseña:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  login,
  perfil,
  verify,
  logout,
  resetPassword,
};
