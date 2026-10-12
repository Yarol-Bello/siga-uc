/**
 * Middleware de autenticación JWT
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const authService = require("../services/authService");
const response = require("../utils/response");

/**
 * Verificar que el usuario esté autenticado (JWT válido)
 */
const verificarAutenticacion = (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return response.unauthorized(res, "Token no proporcionado");
    }

    // Formato esperado: "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return response.unauthorized(res, "Formato de token inválido");
    }

    const token = parts[1];

    // Verificar y decodificar token
    const decoded = authService.verificarToken(token);
    req.usuario = decoded;

    next();
  } catch (error) {
    if (error.statusCode) {
      return response.error(res, error.statusCode, error.message);
    }
    console.error("❌ Error en autenticación:", error);
    return response.unauthorized(res, "Error de autenticación");
  }
};

/**
 * Verificar que el usuario tenga uno de los roles permitidos
 * @param {string[]} rolesPermitidos - Lista de roles permitidos
 */
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return response.unauthorized(res, "Usuario no autenticado");
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return response.forbidden(
        res,
        `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(", ")}`,
      );
    }

    next();
  };
};

module.exports = {
  verificarAutenticacion,
  verificarRol,
};
