/**
 * Servicio de Autenticación
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const usuarioDao = require("../dao/usuarioDao");
const env = require("../config/env");
const { getAnioLectivo } = require("../config/academico");

/**
 * La info adicional del estudiante siempre es un objeto, aunque no tenga
 * matrícula en el año activo. Así el frontend puede mostrar el mensaje sin
 * confundirlo con un error de login.
 */
const construirInfoAlumno = (info, anioLectivo) => ({
  id_alumno: info?.id_alumno ?? null,
  codigo_estudiante: info?.codigo_estudiante ?? null,
  id_grado: info?.id_grado ?? null,
  nombre_grado: info?.nombre_grado ?? null,
  seccion: info?.seccion ?? null,
  estado_matricula: info?.estado_matricula ?? null,
  anio_lectivo: info?.anio_lectivo ?? anioLectivo,
  matricula_activa: Boolean(info?.id_alumno),
});

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
    const anioLectivo = getAnioLectivo();
    const alumno = await usuarioDao.getAlumnoInfo(
      usuario.id_usuario,
      anioLectivo,
    );
    infoAdicional = construirInfoAlumno(alumno, anioLectivo);
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
    const anioLectivo = getAnioLectivo();
    const alumno = await usuarioDao.getAlumnoInfo(id_usuario, anioLectivo);
    infoAdicional = construirInfoAlumno(alumno, anioLectivo);
  } else if (
    usuario.nombre_rol === "DOCENTE" ||
    usuario.nombre_rol === "SECRETARIA"
  ) {
    infoAdicional = await usuarioDao.getPersonalInfo(id_usuario);
  }

  // 👇 Obtener la credencial QR
  const credencialQR = await usuarioDao.getCredencialQR(id_usuario);

  return {
    ...usuario,
    info_adicional: infoAdicional,
    credencial_qr: credencialQR,
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
    password_temporal: dni,
  };
};

/**
 * Cambiar la contraseña de un usuario autenticado
 * @param {number} id_usuario - ID del usuario autenticado
 * @param {string} passwordActual - Contraseña actual en texto plano
 * @param {string} passwordNueva - Nueva contraseña en texto plano
 * @param {string} confirmarPassword - Confirmación de la nueva contraseña
 * @returns {Promise<object>} Datos del usuario actualizado
 */
const cambiarPassword = async (
  id_usuario,
  passwordActual,
  passwordNueva,
  confirmarPassword,
) => {
  if (!passwordActual || !passwordNueva || !confirmarPassword) {
    const error = new Error("Debe completar todos los campos");
    error.statusCode = 400;
    throw error;
  }

  if (passwordNueva.length < 6) {
    const error = new Error(
      "La nueva contraseña debe tener al menos 6 caracteres",
    );
    error.statusCode = 400;
    throw error;
  }

  if (passwordNueva !== confirmarPassword) {
    const error = new Error("Las contraseñas no coinciden");
    error.statusCode = 400;
    throw error;
  }

  if (passwordNueva === passwordActual) {
    const error = new Error(
      "La nueva contraseña debe ser diferente a la actual",
    );
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await usuarioDao.getPasswordHashById(id_usuario);

  if (!passwordHash) {
    const error = new Error("Usuario no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const passwordValida = await bcrypt.compare(passwordActual, passwordHash);

  if (!passwordValida) {
    const error = new Error("La contraseña actual es incorrecta");
    error.statusCode = 400;
    throw error;
  }

  const usuarioActualizado = await usuarioDao.actualizarPassword(
    id_usuario,
    passwordNueva,
  );

  if (!usuarioActualizado) {
    const error = new Error("Usuario no encontrado");
    error.statusCode = 404;
    throw error;
  }

  return {
    usuario: {
      ...usuarioActualizado,
      requiere_cambio_password: false,
    },
  };
};

module.exports = {
  login,
  verificarToken,
  getPerfil,
  resetPassword,
  cambiarPassword,
};
