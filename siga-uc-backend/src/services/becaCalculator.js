/**
 * Motor de aplicación de becas (Fase 5 / H78)
 * Se usa dentro de transacciones de matrícula/pensiones.
 */

const becaDao = require("../dao/becaDao");

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

const esNoAplicada = (error) =>
  error?.code === "42P01" || error?.code === "42703";

/**
 * Calcula las becas aplicables y su descuento sobre un monto base.
 * Reglas: prioridad, tope, combinación/exclusividad y monto no negativo.
 */
const calcular = async (
  { idAlumno, alcance, base, fecha = null, idUsuario = null },
  client,
) => {
  const baseNumero = redondear(base);
  if (!idAlumno || baseNumero <= 0) {
    return {
      descuento: 0,
      monto_final: Math.max(0, baseNumero),
      aplicaciones: [],
    };
  }

  let becas = [];
  try {
    becas = await becaDao.listarAplicables(
      {
        idAlumno,
        alcance,
        fecha: fecha || new Date().toISOString().slice(0, 10),
      },
      client,
    );
  } catch (error) {
    if (esNoAplicada(error)) {
      return { descuento: 0, monto_final: baseNumero, aplicaciones: [] };
    }
    throw error;
  }

  const aplicaciones = [];
  const grupos = new Set();
  let restante = baseNumero;
  let bloqueaCombinacion = false;

  for (const beca of becas) {
    if (restante <= 0) break;
    if (bloqueaCombinacion) break;
    if (!beca.permite_combinacion && aplicaciones.length > 0) continue;
    if (beca.grupo && grupos.has(beca.grupo)) continue;

    const modalidad = String(beca.modalidad || "PORCENTAJE").toUpperCase();
    const valor = Number(beca.valor || 0);
    let monto =
      modalidad === "PORCENTAJE"
        ? (baseNumero * valor) / 100
        : valor;

    if (beca.monto_maximo !== null && beca.monto_maximo !== undefined) {
      monto = Math.min(monto, Number(beca.monto_maximo) || 0);
    }
    monto = redondear(Math.min(monto, restante));
    if (monto <= 0) continue;

    aplicaciones.push({
      id_beca: Number(beca.id_beca),
      tipo: beca.tipo,
      tipo_codigo: beca.tipo_codigo,
      tipo_nombre: beca.tipo_nombre,
      modalidad,
      valor,
      monto_aplicado: monto,
      porcentaje_aplicado:
        modalidad === "PORCENTAJE"
          ? valor
          : redondear((monto / baseNumero) * 100),
    });

    restante = redondear(restante - monto);
    if (beca.grupo) grupos.add(beca.grupo);
    if (!beca.permite_combinacion) bloqueaCombinacion = true;
  }

  return {
    descuento: redondear(baseNumero - restante),
    monto_final: redondear(restante),
    aplicaciones,
  };
};

const aplicarPension = async (
  client,
  { idPension, idAlumno, base, fecha = null, idUsuario = null },
) => {
  const calculo = await calcular(
    {
      idAlumno,
      alcance: "PENSION",
      base,
      fecha,
      idUsuario,
    },
    client,
  );

  await becaDao.eliminarAplicacionesPension(idPension, client);
  const principal = calculo.aplicaciones[0]?.id_beca || null;
  await becaDao.actualizarPension(
    idPension,
    {
      descuento: calculo.descuento,
      montoFinal: calculo.monto_final,
      idBeca: principal,
    },
    client,
  );

  for (const aplicacion of calculo.aplicaciones) {
    await becaDao.crearAplicacion(
      {
        id_beca: aplicacion.id_beca,
        id_pension: idPension,
        id_preticket: null,
        monto_aplicado: aplicacion.monto_aplicado,
        porcentaje_aplicado: aplicacion.porcentaje_aplicado,
        creado_por: idUsuario,
      },
      client,
    );
  }

  return calculo;
};

const aplicarPreticket = async (
  client,
  { idPreticket, idAlumno, base, fecha = null, idUsuario = null },
) => {
  const calculo = await calcular(
    {
      idAlumno,
      alcance: "MATRICULA",
      base,
      fecha,
      idUsuario,
    },
    client,
  );

  await becaDao.eliminarAplicacionesPreticket(idPreticket, client);
  const exonerado = calculo.monto_final <= 0;
  await becaDao.actualizarPreticket(
    idPreticket,
    {
      descuento: calculo.descuento,
      monto: calculo.monto_final,
      exonerado,
    },
    client,
  );

  for (const aplicacion of calculo.aplicaciones) {
    await becaDao.crearAplicacion(
      {
        id_beca: aplicacion.id_beca,
        id_pension: null,
        id_preticket: idPreticket,
        monto_aplicado: aplicacion.monto_aplicado,
        porcentaje_aplicado: aplicacion.porcentaje_aplicado,
        creado_por: idUsuario,
      },
      client,
    );
  }

  return { ...calculo, exonerado };
};

const aplicarPensionesAlumno = async (
  client,
  idAlumno,
  idUsuario = null,
) => {
  let pensiones = [];
  try {
    const result = await client.query(
      `SELECT id_pension, id_alumno, monto_base, mes
       FROM pensiones
       WHERE id_alumno = $1 AND estado IN ('PENDIENTE', 'EXONERADO')`,
      [idAlumno],
    );
    pensiones = result.rows;
  } catch (error) {
    if (esNoAplicada(error)) return 0;
    throw error;
  }

  for (const pension of pensiones) {
    await aplicarPension(client, {
      idPension: pension.id_pension,
      idAlumno,
      base: pension.monto_base,
      fecha: null,
      idUsuario,
    });
  }
  return pensiones.length;
};

const aplicarPensionesMes = async (
  client,
  anio,
  mes,
  idUsuario = null,
) => {
  let pensiones = [];
  try {
    const result = await client.query(
      `SELECT id_pension, id_alumno, monto_base
       FROM pensiones
       WHERE anio_lectivo = $1 AND mes = $2
         AND estado IN ('PENDIENTE', 'EXONERADO')`,
      [anio, mes],
    );
    pensiones = result.rows;
  } catch (error) {
    if (esNoAplicada(error)) return 0;
    throw error;
  }

  for (const pension of pensiones) {
    await aplicarPension(client, {
      idPension: pension.id_pension,
      idAlumno: pension.id_alumno,
      base: pension.monto_base,
      idUsuario,
    });
  }
  return pensiones.length;
};

module.exports = {
  calcular,
  aplicarPension,
  aplicarPreticket,
  aplicarPensionesAlumno,
  aplicarPensionesMes,
};
