/**
 * Controlador de Reportes
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const reporteService = require("../services/reporteService");
const libretaPdfService = require("../services/libretaPdfService");
const auditoriaService = require("../services/auditoriaService");
const { getAnioLectivo } = require("../config/academico");
const response = require("../utils/response");

const getDashboard = async (req, res) => {
  try {
    const { anio } = req.query;
    const data = await reporteService.getDashboard(
      anio ? parseInt(anio) : getAnioLectivo(),
    );
    return response.success(res, 200, "Dashboard ejecutivo", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getAlumnosRiesgo = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const { bimestre = 1, anio } = req.query;
    const data = await reporteService.getAlumnosRiesgo(
      id_grado,
      parseInt(bimestre),
      anio ? parseInt(anio) : getAnioLectivo(),
    );
    return response.success(res, 200, `${data.length} alumnos en riesgo`, data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getCuadroMerito = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const { bimestre = 1, anio } = req.query;
    const data = await reporteService.getCuadroMerito(
      id_grado,
      parseInt(bimestre),
      anio ? parseInt(anio) : getAnioLectivo(),
    );
    return response.success(res, 200, "Cuadro de mérito", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

const getLibreta = async (req, res) => {
  try {
    const { id_alumno } = req.params;
    const { bimestre = 1, anio } = req.query;
    const data = await reporteService.getLibreta(
      id_alumno,
      parseInt(bimestre),
      anio ? parseInt(anio) : getAnioLectivo(),
    );
    return response.success(res, 200, "Libreta del alumno", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/reportes/libreta/:id_alumno/pdf
 * Genera y descarga la libreta en PDF.
 */
const getLibretaPdf = async (req, res) => {
  try {
    const { id_alumno } = req.params;
    const { bimestre = 1, anio } = req.query;
    const bimestreNumero = parseInt(bimestre);
    const anioLectivo = anio ? parseInt(anio) : getAnioLectivo();

    const data = await reporteService.getLibreta(
      id_alumno,
      bimestreNumero,
      anioLectivo,
    );

    if (!data?.alumno) {
      return response.notFound(res, "Alumno no encontrado");
    }

    const buffer = await libretaPdfService.generarLibretaPdf(data);

    await auditoriaService.registrarSeguro(req, {
      modulo: "Reportes",
      accion: "DESCARGAR",
      descripcion: `Descarga de libreta del alumno ${id_alumno}`,
      nuevo: {
        id_alumno: Number(id_alumno) || null,
        bimestre: bimestreNumero,
      },
    });

    const dni = String(data.alumno.dni || "alumno").replace(
      /[^0-9A-Za-z_-]/g,
      "",
    );
    const fileName = `libreta_${dni}_BIM${bimestreNumero}_${anioLectivo}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.send(buffer);
  } catch (error) {
    console.error("❌ Error al generar PDF de libreta:", error.message);
    return response.error(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "No se pudo generar la libreta en PDF",
    );
  }
};

const getResumenAsistencia = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const { anio } = req.query;
    const data = await reporteService.getResumenAsistencia(
      id_grado,
      anio ? parseInt(anio) : getAnioLectivo(),
    );
    return response.success(res, 200, "Resumen de asistencia del grado", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

/**
 * GET /api/reportes/auditoria-docentes/:id_grado
 */
const getAuditoriaDocentes = async (req, res) => {
  try {
    const { id_grado } = req.params;
    const { bimestre = 2, anio } = req.query;
    const data = await reporteService.getAuditoriaDocentes(
      id_grado,
      parseInt(bimestre),
      anio ? parseInt(anio) : getAnioLectivo(),
    );
    return response.success(res, 200, "Auditoría de docentes", data);
  } catch (error) {
    return response.error(res, error.statusCode || 500, error.message);
  }
};

module.exports = {
  getDashboard,
  getAlumnosRiesgo,
  getCuadroMerito,
  getLibreta,
  getLibretaPdf,
  getResumenAsistencia,
  getAuditoriaDocentes,
};
