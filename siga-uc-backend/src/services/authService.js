/**
 * Servicio de Autenticación
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const usuarioDao = require("../dao/usuarioDao");
const env = require("../config/env");

/**
 * Autenticar un usuario con DNI y contraseña
 * @param {string} dni - DNI del usuario
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<object>} Datos del usuario + token
 * @throws {Error} Si las credenciales son inválidas
 */
const login = async (dni, password) => {
  // 1. Buscar usuario por DNI
  const usuario = await usuarioDao.findByDni(dni);

  if (!usuario) {
    const error = new Error("Credenciales inválidas");
    error.statusCode = 401;
    throw error;
  }

  // 2. Verificar que el usuario esté activo
  if (usuario.estado !== "ACTIVO") {
    const error = new Error(
      `Usuario ${usuario.estado.toLowerCase()}. Contacte al administrador.`,
    );
    error.statusCode = 403;
    throw error;
  }

  // 3. Verificar contraseña con bcrypt
  const passwordValida = await bcrypt.compare(password, usuario.password_hash);

  if (!passwordValida) {
    const error = new Error("Credenciales inválidas");
    error.statusCode = 401;
    throw error;
  }

  // 4. Obtener información adicional según el rol
  let infoAdicional = null;

  if (usuario.nombre_rol === "ESTUDIANTE") {
    infoAdicional = await usuarioDao.getAlumnoInfo(usuario.id_usuario);
  } else if (
    usuario.nombre_rol === "DOCENTE" ||
    usuario.nombre_rol === "SECRETARIA"
  ) {
    infoAdicional = await usuarioDao.getPersonalInfo(usuario.id_usuario);
  }

  // 5. Actualizar último login
  await usuarioDao.updateUltimoLogin(usuario.id_usuario);

  // 6. Generar token JWT
  const payload = {
    id_usuario: usuario.id_usuario,
    dni: usuario.dni,
    nombre_completo: `${usuario.nombres} ${usuario.apellidos}`,
    correo: usuario.correo_institucional,
    id_rol: usuario.id_rol,
    rol: usuario.nombre_rol,
  };

  const token = jwt.sign(payload, env.JWT.SECRET, {
    expiresIn: env.JWT.EXPIRES_IN,
  });

  // 7. Retornar datos + token (sin password_hash)
  return {
    usuario: {
      id_usuario: usuario.id_usuario,
      dni: usuario.dni,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      nombre_completo: `${usuario.nombres} ${usuario.apellidos}`,
      correo_institucional: usuario.correo_institucional,
      telefono: usuario.telefono,
      rol: usuario.nombre_rol,
      id_rol: usuario.id_rol,
      requiere_cambio_password: usuario.requiere_cambio_password,
      info_adicional: infoAdicional,
    },
    token,
    expires_in: env.JWT.EXPIRES_IN,
  };
};

/**
 * Verificar y decodificar un token JWT
 * @param {string} token - Token JWT
 * @returns {object} Payload decodificado
 * @throws {Error} Si el token es inválido o expirado
 */
const verificarToken = (token) => {
  try {
    return jwt.verify(token, env.JWT.SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      const err = new Error("Token expirado");
      err.statusCode = 401;
      throw err;
    }
    if (error.name === "JsonWebTokenError") {
      const err = new Error("Token inválido");
      err.statusCode = 401;
      throw err;
    }
    throw error;
  }
};

/**
 * Obtener el perfil de un usuario por ID
 * @param {number} id_usuario - ID del usuario
 * @returns {Promise<object>}
 */
const getPerfil = async (id_usuario) => {
  const usuario = await usuarioDao.findById(id_usuario);

  if (!usuario) {
    const error = new Error("Usuario no encontrado");
    error.statusCode = 404;
    throw error;
  }

  let infoAdicional = null;

  if (usuario.nombre_rol === "ESTUDIANTE") {
    infoAdicional = await usuarioDao.getAlumnoInfo(id_usuario);
  } else if (
    usuario.nombre_rol === "DOCENTE" ||
    usuario.nombre_rol === "SECRETARIA"
  ) {
    infoAdicional = await usuarioDao.getPersonalInfo(id_usuario);
  }

  return {
    ...usuario,
    info_adicional: infoAdicional,
  };
};

/**
 * Restablecer contraseña por DNI (uso del Admin)
 * @param {string} dni - DNI del usuario
 * @returns {Promise<object>}
 */
const resetPassword = async (dni) => {
  if (!dni || dni.length !== 8) {
    const error = new Error("DNI inválido");
    error.statusCode = 400;
    throw error;
  }

  const usuario = await usuarioDao.resetPasswordByDni(dni);

  if (!usuario) {
    const error = new Error("Usuario no encontrado");
    error.statusCode = 404;
    throw error;
  }

  return {
    usuario,
    password_temporal: "UC" + dni,
  };
};

module.exports = {
  login,
  verificarToken,
  getPerfil,
  resetPassword,
};
