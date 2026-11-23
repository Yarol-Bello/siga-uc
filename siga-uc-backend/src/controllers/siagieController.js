/**
 * Controlador de Exportación Interna de Calificaciones (SIAGIE)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * No existe carga de plantillas ni integración oficial con MINEDU.
 * Solo se genera un Excel interno a partir de las notas finales de SIGA-UC.
 */

const siagieService = require("../services/siagieService");
const auditoriaService = require("../services/auditoriaService");
const { getAnioLectivo } = require("../config/academico");
const response = require("../utils/response");

const pluralizar = (cantidad, singular, plural) =>
  `${cantidad} ${Number(cantidad) === 1 ? singular : plural}`;

const leerParametros = (req) => {
  const idGrado = Number.parseInt(req.query.id_grado, 10);
  const bimestre = Number.parseInt(req.query.bimestre, 10);
  const anioSolicitado = Number.parseInt(
    req.query.anio ?? req.query.anio_lectivo,
    10,
  );

  return {
    id_grado: idGrado,
    bimestre,
    anio_lectivo: Number.isInteger(anioSolicitado)
      ? anioSolicitado
      : getAnioLectivo(),
  };
};

/**
 * GET /api/siagie/resumen
 * Devuelve conteos y advertencias de la exportación interna (solo lectura).
 */
const obtenerResumen = async (req, res) => {
  try {
    const resumen = await siagieService.obtenerResumen(leerParametros(req));
    return response.success(
      res,
      200,
      "Resumen de exportación interna",
      resumen,
    );
  } catch (error) {
    console.error("❌ Error al obtener el resumen SIAGIE:", error.message);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/siagie/exportar
 * Genera y descarga el Excel interno. No es una exportación oficial.
 */
const exportarInterno = async (req, res) => {
  try {
    const parametros = leerParametros(req);
    const resultado = await siagieService.generarExcelInterno({
      ...parametros,
      id_usuario: req.usuario.id_usuario,
    });

    await auditoriaService.registrarSeguro(req, {
      modulo: "SIAGIE",
      accion: "EXPORTAR",
      descripcion: `Exportación interna: ${resultado.nombre_archivo} (${pluralizar(resultado.resumen.total_notas, "nota final", "notas finales")}, ${pluralizar(resultado.resumen.total_alumnos, "alumno", "alumnos")}, ${pluralizar(resultado.resumen.total_cursos, "curso", "cursos")})`,
      nuevo: {
        archivo: resultado.nombre_archivo,
        anio_lectivo: resultado.resumen.anio_lectivo,
        bimestre: resultado.resumen.bimestre,
        id_grado: resultado.resumen.id_grado,
        alumnos: resultado.resumen.total_alumnos,
        cursos: resultado.resumen.total_cursos,
        notas: resultado.resumen.total_notas,
      },
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${resultado.nombre_archivo}"`,
    );
    res.setHeader("X-Exportacion-Interna", "true");
    res.setHeader("X-Total-Alumnos", String(resultado.resumen.total_alumnos));
    res.setHeader("X-Total-Cursos", String(resultado.resumen.total_cursos));
    res.setHeader("X-Total-Notas", String(resultado.resumen.total_notas));
    res.setHeader("Content-Length", String(resultado.buffer.length));

    return res.send(resultado.buffer);
  } catch (error) {
    console.error("❌ Error en la exportación interna SIAGIE:", error.message);
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  obtenerResumen,
  exportarInterno,
};
