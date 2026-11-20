/**
 * Middlewares de autorización por rol y pertenencia.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const response = require("../utils/response");
const autorizacionDao = require("../dao/autorizacionDao");
const { getAnioLectivo } = require("../config/academico");

const obtenerAnio = (req) => {
  const body = req.body || {};
  const valor =
    req.query.anio ||
    body.anio_lectivo ||
    body.anio ||
    getAnioLectivo();
  const anio = parseInt(valor, 10);
  return Number.isNaN(anio) ? getAnioLectivo() : anio;
};

/**
 * Valida que req.usuario.rol pertenezca a la lista permitida.
 */
const checkRole = (rolesPermitidos = []) => {
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

/**
 * Valida acceso a un alumno por id_alumno.
 * ADMIN/SECRETARIA pasan; ESTUDIANTE solo el propio; DOCENTE solo alumnos de sus cursos.
 */
const checkAlumnoPropio = async (req, res, next) => {
  try {
    const rol = req.usuario?.rol;
    if (rol === "ADMIN" || rol === "SECRETARIA") {
      return next();
    }

    const idAlumno = Number(
      req.params.id_alumno || req.params.id || req.body?.id_alumno,
    );

    if (rol === "ESTUDIANTE") {
      if (idAlumno && Number(req.usuario.id_alumno) === idAlumno) {
        return next();
      }
      return response.forbidden(res, "Solo puede consultar su propia información");
    }

    if (rol === "DOCENTE") {
      if (!idAlumno || !req.usuario.id_personal) {
        return response.forbidden(res, "No tiene acceso a este alumno");
      }
      const permitido = await autorizacionDao.docenteTieneAlumno(
        req.usuario.id_personal,
        idAlumno,
      );
      return permitido
        ? next()
        : response.forbidden(res, "No tiene acceso a este alumno");
    }

    return response.forbidden(res, "No tiene acceso a este alumno");
  } catch (error) {
    console.error("❌ Error autorizando alumno:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

/**
 * Valida acceso a un alumno por DNI.
 */
const checkAlumnoPorDni = async (req, res, next) => {
  try {
    const rol = req.usuario?.rol;
    if (rol === "ADMIN" || rol === "SECRETARIA") {
      return next();
    }

    const dni = String(req.params.dni || "").trim();

    if (rol === "ESTUDIANTE") {
      return dni === req.usuario.dni
        ? next()
        : response.forbidden(res, "Solo puede consultar su propia información");
    }

    if (rol === "DOCENTE") {
      if (!dni || !req.usuario.id_personal) {
        return response.forbidden(res, "No tiene acceso a este alumno");
      }
      const permitido = await autorizacionDao.docenteTieneAlumnoPorDni(
        req.usuario.id_personal,
        dni,
      );
      return permitido
        ? next()
        : response.forbidden(res, "No tiene acceso a este alumno");
    }

    return response.forbidden(res, "No tiene acceso a este alumno");
  } catch (error) {
    console.error("❌ Error autorizando alumno por DNI:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

/**
 * Valida que un DOCENTE tenga asignado el curso/grado.
 * ADMIN pasa. Para DOCENTE se exige coincidencia en carga_curricular.
 */
const checkCursoDocente = async (req, res, next) => {
  try {
    if (req.usuario?.rol !== "DOCENTE") {
      return next();
    }

    const body = req.body || {};
    const idCurso = Number(
      req.params.id_curso || body.id_curso || req.query.id_curso,
    );
    const idGradoRaw =
      req.params.id_grado || body.id_grado || req.query.id_grado;
    const idGrado = idGradoRaw ? Number(idGradoRaw) : null;

    if (!idCurso || !req.usuario.id_personal) {
      return response.forbidden(res, "No tiene acceso a este curso");
    }

    const permitido = await autorizacionDao.docenteTieneCurso(
      req.usuario.id_personal,
      idCurso,
      idGrado,
      obtenerAnio(req),
    );

    return permitido
      ? next()
      : response.forbidden(res, "No tiene acceso a este curso");
  } catch (error) {
    console.error("❌ Error autorizando curso:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

/**
 * Valida cursos de un lote masivo (registros[]).
 */
const checkCursosDocenteBody = async (req, res, next) => {
  try {
    if (req.usuario?.rol !== "DOCENTE") {
      return next();
    }

    const registros = req.body?.registros;
    if (!Array.isArray(registros) || registros.length === 0) {
      return next();
    }
    if (!req.usuario.id_personal) {
      return response.forbidden(res, "No tiene acceso a estos cursos");
    }

    const anio = obtenerAnio(req);
    const vistos = new Set();

    for (const reg of registros) {
      const idCurso = Number(reg.id_curso);
      const idGrado = reg.id_grado ? Number(reg.id_grado) : null;
      if (!idCurso) {
        return response.forbidden(res, "No tiene acceso a este curso");
      }

      const clave = `${idCurso}-${idGrado || ""}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      const permitido = await autorizacionDao.docenteTieneCurso(
        req.usuario.id_personal,
        idCurso,
        idGrado,
        anio,
      );
      if (!permitido) {
        return response.forbidden(res, "No tiene acceso a este curso");
      }
    }

    return next();
  } catch (error) {
    console.error("❌ Error autorizando cursos masivos:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

/**
 * Valida que un DOCENTE tenga asignado el grado (reportes).
 */
const checkGradoDocente = async (req, res, next) => {
  try {
    if (req.usuario?.rol !== "DOCENTE") {
      return next();
    }

    const idGrado = Number(req.params.id_grado || req.query.id_grado);
    if (!idGrado || !req.usuario.id_personal) {
      return response.forbidden(res, "No tiene acceso a este grado");
    }

    const permitido = await autorizacionDao.docenteTieneGrado(
      req.usuario.id_personal,
      idGrado,
      obtenerAnio(req),
    );

    return permitido
      ? next()
      : response.forbidden(res, "No tiene acceso a este grado");
  } catch (error) {
    console.error("❌ Error autorizando grado:", error);
    return response.error(res, 500, "Error interno del servidor");
  }
};

module.exports = {
  checkRole,
  checkAlumnoPropio,
  checkAlumnoPorDni,
  checkCursoDocente,
  checkCursosDocenteBody,
  checkGradoDocente,
};
