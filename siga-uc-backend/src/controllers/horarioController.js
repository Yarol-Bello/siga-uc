/**
 * Controlador de horarios (H47)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */

const { validationResult } = require("express-validator");
const horarioService = require("../services/horarioService");
const periodoClaseService = require("../services/periodoClaseService");
const auditoriaService = require("../services/auditoriaService");
const { getAnioLectivo } = require("../config/academico");
const response = require("../utils/response");

const responderError = (res, error, contexto) => {
  console.error(`❌ ${contexto}:`, error.message);
  return response.error(
    res,
    error.statusCode || 500,
    error.message,
    error.details || null,
  );
};

const validar = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return response.validationError(
    res,
    errors.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
  );
};

const resumenBloque = (bloque) => ({
  id_horario: bloque.id_horario,
  id_carga: bloque.id_carga,
  id_grado: bloque.id_grado,
  id_curso: bloque.id_curso,
  id_personal: bloque.id_personal,
  anio_lectivo: bloque.anio_lectivo,
  dia_semana: bloque.dia_semana,
  id_periodo: bloque.id_periodo,
  aula: bloque.aula,
  estado: bloque.estado,
});

const listarPeriodos = async (req, res) => {
  try {
    const anio = req.query.anio || getAnioLectivo();
    const data = await periodoClaseService.listar(anio);
    return response.success(res, 200, "Períodos de clase obtenidos", data);
  } catch (error) {
    return responderError(res, error, "listar períodos");
  }
};

const crearPeriodo = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const data = await periodoClaseService.crear(req.body);
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "CREAR",
      descripcion: `Período "${data.nombre}" (${data.hora_inicio}–${data.hora_fin}) para ${data.anio_lectivo}`,
      nuevo: data,
    });
    return response.success(res, 201, "Período de clase creado", data);
  } catch (error) {
    return responderError(res, error, "crear período");
  }
};

const actualizarPeriodo = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const anterior = await periodoClaseService.obtener(req.params.id);
    const data = await periodoClaseService.actualizar(req.params.id, req.body);
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "MODIFICAR",
      descripcion: `Período "${data.nombre}" actualizado (${data.anio_lectivo})`,
      anterior,
      nuevo: data,
    });
    return response.success(res, 200, "Período de clase actualizado", data);
  } catch (error) {
    return responderError(res, error, "actualizar período");
  }
};

const eliminarPeriodo = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const anterior = await periodoClaseService.obtener(req.params.id);
    const data = await periodoClaseService.eliminar(req.params.id);
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "ELIMINAR",
      descripcion: `Período "${anterior.nombre}" eliminado (${anterior.anio_lectivo})`,
      anterior,
    });
    return response.success(res, 200, "Período de clase eliminado", data);
  } catch (error) {
    return responderError(res, error, "eliminar período");
  }
};

const listar = async (req, res) => {
  try {
    const data = await horarioService.listar(req.query);
    return response.success(res, 200, "Horarios obtenidos", data);
  } catch (error) {
    return responderError(res, error, "listar horarios");
  }
};

const miHorario = async (req, res) => {
  try {
    const data = await horarioService.miHorario(req.usuario);
    return response.success(res, 200, "Horario personal obtenido", data);
  } catch (error) {
    return responderError(res, error, "obtener horario personal");
  }
};

const crear = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const data = await horarioService.crear(req.body, req.usuario);
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "CREAR",
      descripcion: `Bloque ${data.dia_semana} ${data.periodo_nombre} en ${data.nombre_grado} ${data.seccion} (${data.nombre_curso})`,
      nuevo: resumenBloque(data),
    });
    return response.success(res, 201, "Bloque de horario creado", data);
  } catch (error) {
    return responderError(res, error, "crear bloque");
  }
};

const actualizar = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const anterior = await horarioService.obtener(req.params.id);
    const data = await horarioService.actualizar(
      req.params.id,
      req.body,
      req.usuario,
    );
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "MODIFICAR",
      descripcion: `Bloque ${anterior.dia_semana} ${anterior.periodo_nombre} de ${anterior.nombre_grado} ${anterior.seccion} actualizado`,
      anterior: resumenBloque(anterior),
      nuevo: resumenBloque(data),
    });
    return response.success(res, 200, "Bloque de horario actualizado", data);
  } catch (error) {
    return responderError(res, error, "actualizar bloque");
  }
};

const eliminar = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const anterior = await horarioService.obtener(req.params.id);
    const data = await horarioService.eliminar(
      req.params.id,
      req.body,
      req.usuario,
    );
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "ELIMINAR",
      descripcion: `Bloque ${anterior.dia_semana} ${anterior.periodo_nombre} de ${anterior.nombre_grado} ${anterior.seccion} eliminado`,
      anterior: resumenBloque(anterior),
    });
    return response.success(res, 200, "Bloque de horario eliminado", data);
  } catch (error) {
    return responderError(res, error, "eliminar bloque");
  }
};

const publicar = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const data = await horarioService.publicar(req.body, req.usuario);
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "PUBLICAR",
      descripcion: `Horario publicado para ${data.anio}${data.id_grado ? ` (grado ${data.id_grado})` : ""}`,
      nuevo: data,
    });
    return response.success(res, 200, "Horario publicado", data);
  } catch (error) {
    return responderError(res, error, "publicar horario");
  }
};

const despublicar = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const data = await horarioService.despublicar(req.body, req.usuario);
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "DESPUBLICAR",
      descripcion: `Horario despublicado para ${data.anio}${data.id_grado ? ` (grado ${data.id_grado})` : ""}`,
      nuevo: data,
    });
    return response.success(res, 200, "Horario despublicado", data);
  } catch (error) {
    return responderError(res, error, "despublicar horario");
  }
};

const generar = async (req, res) => {
  const invalido = validar(req, res);
  if (invalido) return invalido;

  try {
    const data = await horarioService.generar(req.body, req.usuario);
    await auditoriaService.registrarSeguro(req, {
      modulo: "Horarios",
      accion: "GENERAR",
      descripcion: `Generación de horario ${data.anio}${data.id_grado ? ` (grado ${data.id_grado})` : ""}: ${data.generados} bloque(s), ${data.reemplazados} reemplazado(s)${data.parcial ? ", parcial" : ""}`,
      nuevo: {
        anio: data.anio,
        id_grado: data.id_grado,
        seed: data.seed,
        intentos: data.intentos,
        generados: data.generados,
        reemplazados: data.reemplazados,
        parcial: data.parcial,
        sin_ubicar: data.sin_ubicar.length,
        advertencias: data.advertencias,
      },
    });
    return response.success(res, 200, "Horario generado en borrador", data);
  } catch (error) {
    return responderError(res, error, "generar horario");
  }
};

module.exports = {
  listarPeriodos,
  crearPeriodo,
  actualizarPeriodo,
  eliminarPeriodo,
  listar,
  miHorario,
  crear,
  actualizar,
  eliminar,
  publicar,
  despublicar,
  generar,
};
