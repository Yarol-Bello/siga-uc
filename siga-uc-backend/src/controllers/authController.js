/**
 * Controlador de Autenticación
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { validationResult } = require("express-validator");
const authService = require("../services/authService");
const auditoriaService = require("../services/auditoriaService");
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

    await auditoriaService.registrarSeguro(req, {
      id_usuario: resultado.usuario.id_usuario,
      modulo: "Seguridad",
      accion: "LOGIN",
      descripcion: `Inicio de sesión exitoso: DNI ${resultado.usuario.dni}, rol ${resultado.usuario.rol}`,
      nuevo: {
        id_usuario: resultado.usuario.id_usuario,
        rol: resultado.usuario.rol,
      },
    });

    return response.success(res, 200, "Login exitoso", resultado);
  } catch (error) {
    // No se registra la contraseña; solo el DNI intentado.
    const dniIntento = String(req.body?.dni || "").trim();
    await auditoriaService.registrar({
      id_usuario: null,
      ip: req.ip,
      modulo: "Seguridad",
      accion: "LOGIN_FALLIDO",
      descripcion: `Intento de inicio de sesión fallido para DNI ${dniIntento || "no proporcionado"}`,
    });

    if (error.statusCode) {
      return response.error(res, error.statusCode, error.message);
    }
    console.error("❌ Error en login:", error.message);
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
  await auditoriaService.registrarSeguro(req, {
    modulo: "Seguridad",
    accion: "LOGOUT",
    descripcion: `Cierre de sesión: DNI ${req.usuario?.dni || "desconocido"}`,
  });

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

    await auditoriaService.registrarSeguro(req, {
      modulo: "Seguridad",
      accion: "RESET_PASSWORD",
      descripcion: `Reset de contraseña por administrador para DNI ${result.usuario.dni}`,
      nuevo: {
        dni: result.usuario.dni,
        id_usuario_afectado: result.usuario.id_usuario,
      },
    });

    return response.success(res, 200, "Contraseña restablecida", result);
  } catch (error) {
    console.error("❌ Error al restablecer contraseña:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * POST /api/auth/recuperar-password
 * Solicitar recuperación de contraseña
 */
const solicitarRecuperacion = async (req, res) => {
  try {
    const { identificador } = req.body;

    if (!identificador) {
      return response.error(res, 400, "Debe enviar un DNI o correo");
    }

    const recuperacionService = require("../services/recuperacionService");
    const resultado =
      await recuperacionService.solicitarRecuperacion(identificador);

    await auditoriaService.registrar({
      id_usuario: null,
      ip: req.ip,
      modulo: "Seguridad",
      accion: "MODIFICAR",
      descripcion: `Solicitud de recuperación de contraseña para ${identificador}`,
    });

    if (!resultado.tieneCorreo) {
      return response.success(
        res,
        200,
        "No tiene un correo registrado. Contacte al Administrador para restablecer su contraseña.",
        { tieneCorreo: false, enviado: false },
      );
    }

    if (resultado.enviado === false) {
      return response.success(
        res,
        200,
        "No se pudo enviar el correo de recuperación. Contacte al Administrador.",
        { tieneCorreo: true, enviado: false },
      );
    }

    return response.success(
      res,
      200,
      "Si el usuario existe, se ha enviado un correo con las instrucciones.",
      { tieneCorreo: true, enviado: true },
    );
  } catch (error) {
    console.error("❌ Error en recuperación:", error);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/auth/validar-token/:token
 * Validar un token de recuperación
 */
const validarToken = async (req, res) => {
  try {
    const recuperacionService = require("../services/recuperacionService");
    const data = await recuperacionService.validarToken(req.params.token);
    return response.success(res, 200, "Token válido", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * POST /api/auth/restablecer-password
 * Restablecer contraseña con token
 */
const restablecerPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const recuperacionService = require("../services/recuperacionService");
    const data = await recuperacionService.restablecerPassword(token, password);

    await auditoriaService.registrar({
      id_usuario: null,
      ip: req.ip,
      modulo: "Seguridad",
      accion: "MODIFICAR",
      descripcion: `Restablecimiento de contraseña con token para DNI ${data.usuario.dni}`,
      nuevo: { dni: data.usuario.dni },
    });

    return response.success(
      res,
      200,
      "Contraseña actualizada exitosamente",
      data,
    );
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * PUT /api/auth/cambiar-password
 * Cambiar la contraseña del usuario autenticado
 */
const cambiarPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return response.validationError(
        res,
        errors.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
      );
    }

    const { password_actual, password_nueva, confirmar_password } = req.body;

    const resultado = await authService.cambiarPassword(
      req.usuario.id_usuario,
      password_actual,
      password_nueva,
      confirmar_password,
    );

    await auditoriaService.registrarSeguro(req, {
      modulo: "Seguridad",
      accion: "MODIFICAR",
      descripcion: "Cambio de contraseña",
    });

    return response.success(
      res,
      200,
      "Contraseña actualizada correctamente",
      resultado,
    );
  } catch (error) {
    if (error.statusCode) {
      return response.error(res, error.statusCode, error.message);
    }
    console.error("❌ Error al cambiar contraseña:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

module.exports = {
  login,
  perfil,
  verify,
  logout,
  resetPassword,
  solicitarRecuperacion,
  validarToken,
  restablecerPassword,
  cambiarPassword,
};
