/**
 * Servicio de rollover anual (Fase 6.2)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * Previsualiza y clona la oferta del año destino:
 * grados → conceptos → períodos → carga → tutores.
 * No crea alumnos, matrículas, pagos, notas, asistencia, actas ni horarios.
 */

const crypto = require("crypto");
const rolloverDao = require("../dao/rolloverDao");
const anioLectivoDao = require("../dao/anioLectivoDao");
const { getClient } = require("../config/database");
const {
  parseAnio,
  normalizarBooleano,
  crearError,
  traducirError,
} = require("./anioLectivoService");

const DIAS_SEMANA = 5;
const configuracionAnioService = require("./configuracionAnioService");
const TIPOS_BASE = new Set(["MATRICULA", "PENSION"]);
const VERSION_HASH = 1;

const aNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const aMonto = (valor) => aNumero(valor).toFixed(2);

const aHoras = (valor) =>
  valor === null || valor === undefined ? null : aNumero(valor);

const claveGrado = (grado) =>
  `${String(grado.nombre_grado).trim()}|${String(grado.seccion).trim()}`;

const claveAlcanceConcepto = (concepto) => {
  if (concepto.id_grado) {
    return `G:${String(concepto.grado_nombre || "").trim()}|${String(
      concepto.grado_seccion || "",
    ).trim()}`;
  }
  if (concepto.nivel) {
    return `N:${String(concepto.nivel).trim()}`;
  }
  return "GLOBAL";
};

const claveConceptoBase = (concepto) =>
  `${concepto.tipo}|${
    concepto.mes === null || concepto.mes === undefined
      ? ""
      : Number(concepto.mes)
  }|${claveAlcanceConcepto(concepto)}`;

const claveConcepto = (concepto) =>
  concepto.tipo === "OTROS"
    ? `OTROS|${String(concepto.nombre).trim()}|${claveAlcanceConcepto(concepto)}`
    : claveConceptoBase(concepto);

const nombreConceptoDestino = (concepto, anioOrigen, anioDestino) =>
  String(concepto.nombre).split(String(anioOrigen)).join(String(anioDestino));

const construirMarca = (anioOrigen, incluirOtros) =>
  `Rollover desde ${anioOrigen} (${
    incluirOtros ? "MATRICULA/PENSION/OTROS" : "MATRICULA/PENSION"
  })`;

const parsearMarca = (observacion) => {
  const coincidencia = String(observacion || "").match(
    /Rollover desde (\d{4}) \((MATRICULA\/PENSION(?:\/OTROS)?)\)/,
  );
  if (!coincidencia) return null;
  const origen = Number(coincidencia[1]);
  if (!Number.isInteger(origen) || origen < 2000 || origen > 2100) return null;
  return {
    anioOrigen: origen,
    incluirOtros: coincidencia[2].includes("OTROS"),
  };
};

const actualizarMarca = (observacion, marca) => {
  const texto = String(observacion || "").trim();
  if (!texto) return marca;
  const patron = /Rollover desde \d{4} \((?:MATRICULA\/PENSION(?:\/OTROS)?)\)/;
  if (patron.test(texto)) return texto.replace(patron, marca);
  return `${texto} | ${marca}`;
};

const ordenarParaHash = (filas) =>
  filas
    .map((fila) => JSON.stringify(fila))
    .sort()
    .map((fila) => JSON.parse(fila));

const crearHash = (payload) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

const conTransaccion = async (fn) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const resultado = await fn(client);
    await client.query("COMMIT");
    return resultado;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "❌ Error al revertir transacción de rollover:",
        rollbackError.message,
      );
    }
    throw traducirError(error);
  } finally {
    client.release();
  }
};

const bloqueo = (codigo, mensaje, detalle = null) => ({
  codigo,
  mensaje,
  ...(detalle ? { detalle } : {}),
});

const totalActividad = (actividad) =>
  Object.values(actividad || {}).reduce(
    (total, valor) => total + aNumero(valor),
    0,
  );

/**
 * Lee la oferta de ambos años y calcula conflictos, advertencias y hash.
 * No escribe nada. `modo = 'reversion'` endurece la comparación: exige que
 * la oferta del destino sea exactamente la esperada, incluidos los OTROS.
 */
const leerContexto = async ({
  anioOrigen,
  anioDestino,
  incluirOtros,
  modo = "preview",
  client = null,
}) => {
  const origen = await anioLectivoDao.findByAnio(anioOrigen, client);
  const destino = await anioLectivoDao.findByAnio(anioDestino, client);

  const gradosOrigen = await rolloverDao.leerGrados(anioOrigen, client);
  const conceptosOrigen = await rolloverDao.leerConceptos(anioOrigen, client);
  const periodosOrigen = await rolloverDao.leerPeriodos(anioOrigen, client);
  const cargaOrigen = await rolloverDao.leerCarga(anioOrigen, client);
  const tutoresOrigen = await rolloverDao.leerTutores(anioOrigen, client);

  const gradosDestino = await rolloverDao.leerGrados(anioDestino, client);
  const conceptosDestino = await rolloverDao.leerConceptos(anioDestino, client);
  const periodosDestino = await rolloverDao.leerPeriodos(anioDestino, client);
  const cargaDestino = await rolloverDao.leerCarga(anioDestino, client);
  const tutoresDestino = await rolloverDao.leerTutores(anioDestino, client);

  const actividadDestino = await rolloverDao.contarActividad(
    anioDestino,
    client,
  );

  const bloqueos = [];
  const advertencias = [];

  // ------------------------------------------------------------
  // Origen
  // ------------------------------------------------------------
  if (!origen) {
    bloqueos.push(
      bloqueo(
        "ORIGEN_NO_EXISTE",
        `El año origen ${anioOrigen} no existe en el catálogo de años lectivos.`,
      ),
    );
  }

  if (gradosOrigen.length === 0) {
    bloqueos.push(
      bloqueo(
        "ORIGEN_SIN_GRADOS",
        `El año origen ${anioOrigen} no tiene grados para clonar.`,
      ),
    );
  }

  const conceptosBase = conceptosOrigen.filter((concepto) =>
    TIPOS_BASE.has(concepto.tipo),
  );
  const conceptosOtros = conceptosOrigen.filter(
    (concepto) => concepto.tipo === "OTROS",
  );

  if (!conceptosBase.some((concepto) => concepto.tipo === "MATRICULA")) {
    bloqueos.push(
      bloqueo(
        "ORIGEN_SIN_MATRICULA",
        `El año origen ${anioOrigen} no tiene un concepto de pago MATRICULA.`,
      ),
    );
  }

  // Grados sin orden o duplicados por nivel/sección/orden.
  const gradosSinOrden = gradosOrigen.filter(
    (grado) => grado.orden === null || grado.orden === undefined,
  );
  if (gradosSinOrden.length > 0) {
    bloqueos.push(
      bloqueo(
        "GRADO_SIN_ORDEN",
        "Hay grados del año origen sin orden configurado.",
        gradosSinOrden.map((grado) => ({
          id_grado: grado.id_grado,
          nombre_grado: grado.nombre_grado,
        })),
      ),
    );
  }

  const conteoOrdenGrados = new Map();
  for (const grado of gradosOrigen) {
    const clave = `${grado.nivel}|${grado.seccion}|${grado.orden}`;
    conteoOrdenGrados.set(clave, (conteoOrdenGrados.get(clave) || 0) + 1);
  }
  const ordenesDuplicados = [...conteoOrdenGrados.entries()]
    .filter(([, total]) => total > 1)
    .map(([clave]) => clave);
  if (ordenesDuplicados.length > 0) {
    bloqueos.push(
      bloqueo(
        "GRADO_ORDEN_DUPLICADO",
        "Hay grados del año origen duplicados por nivel, sección y orden.",
        ordenesDuplicados,
      ),
    );
  }

  // Conceptos duplicados en el origen (la tabla no tiene UNIQUE).
  const conteoConceptos = new Map();
  for (const concepto of conceptosOrigen) {
    const clave = claveConcepto(concepto);
    conteoConceptos.set(clave, (conteoConceptos.get(clave) || 0) + 1);
  }
  const conceptosDuplicados = [...conteoConceptos.entries()]
    .filter(([, total]) => total > 1)
    .map(([clave]) => clave);
  if (conceptosDuplicados.length > 0) {
    bloqueos.push(
      bloqueo(
        "CONCEPTO_DUPLICADO_ORIGEN",
        "Hay conceptos de pago duplicados en el año origen.",
        conceptosDuplicados,
      ),
    );
  }

  // Estado del año destino.
  if (destino && destino.estado !== "PLANIFICADO" && modo !== "reversion") {
    bloqueos.push(
      bloqueo(
        "DESTINO_NO_PLANIFICADO",
        `El año destino ${anioDestino} está ${destino.estado}. Solo se puede preparar oferta en un año PLANIFICADO.`,
      ),
    );
  }

  if (destino && modo !== "reversion") {
    const marcaDestino = parsearMarca(destino.observacion);
    if (marcaDestino && marcaDestino.anioOrigen !== anioOrigen) {
      bloqueos.push(
        bloqueo(
          "DESTINO_ROLLOVER_DISTINTO",
          `El año destino ya fue preparado desde ${marcaDestino.anioOrigen}; no se puede mezclar con otro origen.`,
        ),
      );
    }
  }

  if (totalActividad(actividadDestino) > 0) {
    bloqueos.push(
      bloqueo(
        "DESTINO_CON_ACTIVIDAD",
        `El año destino ${anioDestino} ya tiene actividad (alumnos, pagos, notas, asistencia, pensiones, pre-tickets, actas u horarios).`,
        actividadDestino,
      ),
    );
  }

  // ------------------------------------------------------------
  // Comparación de la oferta del destino
  // ------------------------------------------------------------
  const detalleGrados = [];
  const mapaGradosOrigen = new Map();
  const mapaGradosDestino = new Map();
  for (const grado of gradosOrigen) {
    mapaGradosOrigen.set(claveGrado(grado), grado);
  }
  for (const grado of gradosDestino) {
    mapaGradosDestino.set(claveGrado(grado), grado);
  }

  let gradosNuevos = 0;
  let gradosExistentes = 0;
  const conflictosOferta = [];

  for (const grado of gradosOrigen) {
    const clave = claveGrado(grado);
    const existente = mapaGradosDestino.get(clave) || null;
    let estado = "nuevo";

    if (existente) {
      estado = "existente";
      gradosExistentes += 1;
      if (
        String(existente.nivel) !== String(grado.nivel) ||
        aNumero(existente.orden) !== aNumero(grado.orden)
      ) {
        conflictosOferta.push(
          `Grado ${grado.nombre_grado} ${grado.seccion}: el destino tiene nivel/orden distintos.`,
        );
      }
    } else {
      gradosNuevos += 1;
    }

    detalleGrados.push({
      id_grado: grado.id_grado,
      id_grado_destino: existente?.id_grado || null,
      nombre_grado: grado.nombre_grado,
      nivel: grado.nivel,
      seccion: grado.seccion,
      orden: grado.orden,
      estado,
    });
  }

  for (const grado of gradosDestino) {
    if (!mapaGradosOrigen.has(claveGrado(grado))) {
      conflictosOferta.push(
        `El destino tiene un grado que no existe en el origen: ${grado.nombre_grado} ${grado.seccion}.`,
      );
    }
  }

  // Conceptos seleccionados para copiar.
  const conceptosSeleccionados = incluirOtros
    ? [...conceptosBase, ...conceptosOtros]
    : [...conceptosBase];

  const conceptosEsperados = conceptosSeleccionados.map((concepto) => ({
    ...concepto,
    clave: claveConcepto(concepto),
    nombre_destino: nombreConceptoDestino(
      concepto,
      anioOrigen,
      anioDestino,
    ),
    monto_destino: aMonto(concepto.monto_base),
    vigente_desde_destino: concepto.vigente_desde
      ? `${anioDestino}${String(concepto.vigente_desde).slice(4, 10)}`
      : `${anioDestino}-01-01`,
  }));

  const conceptosDestinoComparables =
    modo === "reversion"
      ? conceptosDestino
      : conceptosDestino.filter((concepto) =>
          incluirOtros ? true : TIPOS_BASE.has(concepto.tipo),
        );

  const mapaConceptosDestino = new Map();
  for (const concepto of conceptosDestinoComparables) {
    mapaConceptosDestino.set(claveConcepto(concepto), concepto);
  }

  let conceptosNuevos = 0;
  let conceptosExistentes = 0;
  const detalleConceptos = [];

  for (const concepto of conceptosEsperados) {
    const existente = mapaConceptosDestino.get(concepto.clave) || null;
    let estado = "nuevo";

    if (existente) {
      estado = "existente";
      conceptosExistentes += 1;
      if (
        aMonto(existente.monto_base) !== concepto.monto_destino ||
        String(existente.nombre) !== String(concepto.nombre_destino)
      ) {
        conflictosOferta.push(
          `Concepto ${concepto.nombre_destino}: el destino tiene otro monto o nombre.`,
        );
      }
    } else {
      conceptosNuevos += 1;
    }

    detalleConceptos.push({
      id_concepto: concepto.id_concepto,
      nombre: concepto.nombre_destino,
      nombre_origen: concepto.nombre,
      tipo: concepto.tipo,
      mes: concepto.mes,
      monto_base: concepto.monto_destino,
      nivel: concepto.nivel || null,
      id_grado: concepto.id_grado || null,
      grado_nombre: concepto.grado_nombre || null,
      grado_seccion: concepto.grado_seccion || null,
      vigente_desde: concepto.vigente_desde_destino,
      estado,
    });
  }

  const clavesEsperadasConceptos = new Set(
    conceptosEsperados.map((concepto) => concepto.clave),
  );
  for (const concepto of conceptosDestinoComparables) {
    if (!clavesEsperadasConceptos.has(claveConcepto(concepto))) {
      conflictosOferta.push(
        `El destino tiene un concepto que no existe en el origen: ${concepto.nombre}.`,
      );
    }
  }

  // Períodos.
  const mapaPeriodosOrigen = new Map();
  const mapaPeriodosDestino = new Map();
  for (const periodo of periodosOrigen) {
    mapaPeriodosOrigen.set(String(periodo.orden), periodo);
  }
  for (const periodo of periodosDestino) {
    mapaPeriodosDestino.set(String(periodo.orden), periodo);
  }

  let periodosNuevos = 0;
  let periodosExistentes = 0;
  const detallePeriodos = [];

  for (const periodo of periodosOrigen) {
    const existente = mapaPeriodosDestino.get(String(periodo.orden)) || null;
    let estado = "nuevo";

    if (existente) {
      estado = "existente";
      periodosExistentes += 1;
      if (
        String(existente.nombre) !== String(periodo.nombre) ||
        String(existente.hora_inicio) !== String(periodo.hora_inicio) ||
        String(existente.hora_fin) !== String(periodo.hora_fin) ||
        String(existente.tipo) !== String(periodo.tipo) ||
        Boolean(existente.activo) !== Boolean(periodo.activo)
      ) {
        conflictosOferta.push(
          `Período ${periodo.orden} (${periodo.nombre}): el destino tiene horas, tipo o estado distintos.`,
        );
      }
    } else {
      periodosNuevos += 1;
    }

    detallePeriodos.push({
      id_periodo: periodo.id_periodo,
      nombre: periodo.nombre,
      orden: periodo.orden,
      hora_inicio: periodo.hora_inicio,
      hora_fin: periodo.hora_fin,
      tipo: periodo.tipo,
      activo: Boolean(periodo.activo),
      estado,
    });
  }

  for (const periodo of periodosDestino) {
    if (!mapaPeriodosOrigen.has(String(periodo.orden))) {
      conflictosOferta.push(
        `El destino tiene un período extra en el orden ${periodo.orden} (${periodo.nombre}).`,
      );
    }
  }

  // Carga curricular.
  const mapaCargaDestino = new Map();
  for (const carga of cargaDestino) {
    mapaCargaDestino.set(`${carga.id_grado}|${carga.id_curso}`, carga);
  }

  let cargaNuevas = 0;
  let cargaExistentes = 0;
  const detalleCarga = [];
  const clavesCargaEsperadas = new Set();

  for (const carga of cargaOrigen) {
    const gradoDestino = mapaGradosDestino.get(claveGrado(carga)) || null;
    let estado = "nuevo";
    let existente = null;

    if (gradoDestino) {
      const clave = `${gradoDestino.id_grado}|${carga.id_curso}`;
      clavesCargaEsperadas.add(clave);
      existente = mapaCargaDestino.get(clave) || null;
    }

    if (existente) {
      estado = "existente";
      cargaExistentes += 1;
      if (
        aNumero(existente.id_personal) !== aNumero(carga.id_personal) ||
        aHoras(existente.horas_asignadas) !== aHoras(carga.horas_asignadas)
      ) {
        conflictosOferta.push(
          `Carga ${carga.nombre_grado} ${carga.seccion} / ${carga.nombre_curso}: el destino tiene otro docente u horas.`,
        );
      }
    } else {
      cargaNuevas += 1;
    }

    detalleCarga.push({
      id_carga: carga.id_carga,
      id_grado_destino: gradoDestino?.id_grado || null,
      nombre_grado: carga.nombre_grado,
      seccion: carga.seccion,
      nombre_curso: carga.nombre_curso,
      area_academica: carga.area_academica,
      docente_nombre: carga.docente_nombre,
      id_personal: carga.id_personal,
      horas_asignadas: carga.horas_asignadas,
      estado,
    });
  }

  for (const carga of cargaDestino) {
    if (!clavesCargaEsperadas.has(`${carga.id_grado}|${carga.id_curso}`)) {
      conflictosOferta.push(
        `El destino tiene una carga que no existe en el origen: ${carga.nombre_grado} ${carga.seccion} / ${carga.nombre_curso}.`,
      );
    }
  }

  // Tutores: solo docentes activos.
  const tutoresActivos = tutoresOrigen.filter(
    (tutor) => tutor.docente_estado === "ACTIVO",
  );
  const tutoresOmitidos = tutoresOrigen.length - tutoresActivos.length;

  const mapaTutoresDestino = new Map();
  for (const tutor of tutoresDestino) {
    mapaTutoresDestino.set(String(tutor.id_grado), tutor);
  }

  let tutoresNuevos = 0;
  let tutoresExistentes = 0;
  const detalleTutores = [];
  const clavesTutorEsperadas = new Set();

  for (const tutor of tutoresActivos) {
    const gradoDestino = mapaGradosDestino.get(claveGrado(tutor)) || null;
    let estado = "nuevo";
    let existente = null;

    if (gradoDestino) {
      const clave = String(gradoDestino.id_grado);
      clavesTutorEsperadas.add(clave);
      existente = mapaTutoresDestino.get(clave) || null;
    }

    if (existente) {
      estado = "existente";
      tutoresExistentes += 1;
      if (aNumero(existente.id_personal) !== aNumero(tutor.id_personal)) {
        conflictosOferta.push(
          `Tutor de ${tutor.nombre_grado} ${tutor.seccion}: el destino tiene otro docente.`,
        );
      }
    } else {
      tutoresNuevos += 1;
    }

    detalleTutores.push({
      id_tutor: tutor.id_tutor,
      id_grado_destino: gradoDestino?.id_grado || null,
      nombre_grado: tutor.nombre_grado,
      seccion: tutor.seccion,
      docente_nombre: tutor.docente_nombre,
      id_personal: tutor.id_personal,
      estado,
    });
  }

  for (const tutor of tutoresDestino) {
    if (!clavesTutorEsperadas.has(String(tutor.id_grado))) {
      conflictosOferta.push(
        `El destino tiene un tutor que no existe en el origen: ${tutor.nombre_grado} ${tutor.seccion}.`,
      );
    }
  }

  if (conflictosOferta.length > 0) {
    bloqueos.push(
      bloqueo(
        "OFERTA_DESTINO_DISTINTA",
        `La oferta del año ${anioDestino} no coincide con la que se clonaría desde ${anioOrigen}.`,
        conflictosOferta,
      ),
    );
  }

  // ------------------------------------------------------------
  // Docentes: inactivos y capacidad horaria
  // ------------------------------------------------------------
  const docentesInactivos = new Map();
  for (const carga of cargaOrigen) {
    if (carga.docente_estado !== "ACTIVO") {
      docentesInactivos.set(carga.id_personal, {
        id_personal: carga.id_personal,
        docente_nombre: carga.docente_nombre,
        estado: carga.docente_estado,
      });
    }
  }

  if (docentesInactivos.size > 0 && modo !== "reversion") {
    bloqueos.push(
      bloqueo(
        "DOCENTE_INACTIVO",
        "Hay docentes inactivos en la carga curricular del año origen.",
        [...docentesInactivos.values()],
      ),
    );
  }

  const periodosDestinoClase = periodosDestino.filter(
    (periodo) => periodo.tipo === "CLASE" && periodo.activo,
  );
  const periodosOrigenClase = periodosOrigen.filter(
    (periodo) => periodo.tipo === "CLASE" && periodo.activo,
  );
  const periodosBaseCapacidad =
    periodosDestinoClase.length > 0
      ? periodosDestinoClase.length
      : periodosOrigenClase.length;
  const configuracionDestino =
    await configuracionAnioService.obtenerEfectiva(anioDestino);
  const diasBaseCapacidad =
    configuracionDestino.dias_clase?.length || DIAS_SEMANA;
  const capacidadHoraria = periodosBaseCapacidad * diasBaseCapacidad;

  const horasPorDocente = new Map();
  for (const carga of cargaOrigen) {
    horasPorDocente.set(
      carga.id_personal,
      (horasPorDocente.get(carga.id_personal) || 0) +
        aNumero(carga.horas_asignadas),
    );
  }

  const docentesSobrecargados = [];
  if (capacidadHoraria > 0 && modo !== "reversion") {
    for (const carga of cargaOrigen) {
      if (docentesSobrecargados.some(
        (item) => item.id_personal === carga.id_personal,
      )) {
        continue;
      }
      const horas = horasPorDocente.get(carga.id_personal) || 0;
      if (horas > capacidadHoraria) {
        docentesSobrecargados.push({
          id_personal: carga.id_personal,
          docente_nombre: carga.docente_nombre,
          horas,
          capacidad: capacidadHoraria,
        });
      }
    }
  }

  if (docentesSobrecargados.length > 0) {
    bloqueos.push(
      bloqueo(
        "DOCENTE_SOBRECAPACIDAD",
        `Hay docentes que superan la capacidad de ${periodosBaseCapacidad} períodos × ${diasBaseCapacidad} días = ${capacidadHoraria} h.`,
        docentesSobrecargados,
      ),
    );
  }

  // ------------------------------------------------------------
  // Advertencias (no bloquean)
  // ------------------------------------------------------------
  if (periodosOrigen.length === 0) {
    advertencias.push(
      `El año origen ${anioOrigen} no tiene períodos de clase; el horario del año nuevo no podrá generarse hasta configurarlos.`,
    );
  }
  if (cargaOrigen.length === 0) {
    advertencias.push(
      `El año origen ${anioOrigen} no tiene carga curricular; el año nuevo quedará sin cursos asignados.`,
    );
  }
  if (tutoresActivos.length === 0) {
    advertencias.push(
      "No hay tutores activos para clonar; los grados del año nuevo quedarán sin tutor.",
    );
  }
  if (conceptosOtros.length > 0 && !incluirOtros) {
    advertencias.push(
      `Se omitirán ${conceptosOtros.length} concepto(s) OTROS del año origen. Marque "incluir OTROS" y vuelva a previsualizar para copiarlos.`,
    );
  }
  if (
    modo !== "reversion" &&
    !incluirOtros &&
    conceptosDestino.some((concepto) => concepto.tipo === "OTROS")
  ) {
    advertencias.push(
      "El año destino ya tiene conceptos OTROS que no se modifican ni se eliminan.",
    );
  }
  if (tutoresOmitidos > 0) {
    advertencias.push(
      `Se omitirán ${tutoresOmitidos} tutor(es) con docente inactivo.`,
    );
  }

  // ------------------------------------------------------------
  // Resumen, mapas de trabajo y hash estable
  // ------------------------------------------------------------
  const docentesUnicos = new Set(
    cargaOrigen.map((carga) => carga.id_personal),
  );

  const resumen = {
    grados: {
      total: detalleGrados.length,
      nuevos: gradosNuevos,
      existentes: gradosExistentes,
    },
    conceptos: {
      total: conceptosEsperados.length,
      nuevos: conceptosNuevos,
      existentes: conceptosExistentes,
      matricula: conceptosEsperados.filter(
        (concepto) => concepto.tipo === "MATRICULA",
      ).length,
      pension: conceptosEsperados.filter(
        (concepto) => concepto.tipo === "PENSION",
      ).length,
      otros: conceptosEsperados.filter(
        (concepto) => concepto.tipo === "OTROS",
      ).length,
      omitidos: incluirOtros ? 0 : conceptosOtros.length,
    },
    periodos: {
      total: detallePeriodos.length,
      nuevos: periodosNuevos,
      existentes: periodosExistentes,
    },
    carga: {
      total: detalleCarga.length,
      nuevas: cargaNuevas,
      existentes: cargaExistentes,
    },
    tutores: {
      total: detalleTutores.length,
      nuevos: tutoresNuevos,
      existentes: tutoresExistentes,
      omitidos: tutoresOmitidos,
    },
    docentes: {
      total: docentesUnicos.size,
      inactivos: docentesInactivos.size,
      sobrecargados: docentesSobrecargados.length,
    },
    capacidad_horaria: capacidadHoraria,
  };

  const payloadHash = {
    version: VERSION_HASH,
    anio_origen: anioOrigen,
    anio_destino: anioDestino,
    incluir_otros: Boolean(incluirOtros),
    resumen: {
      grados: resumen.grados.total,
      conceptos: resumen.conceptos.total,
      periodos: resumen.periodos.total,
      carga: resumen.carga.total,
      tutores: resumen.tutores.total,
    },
    actividad_destino: Object.fromEntries(
      Object.entries(actividadDestino).map(([clave, valor]) => [
        clave,
        aNumero(valor),
      ]),
    ),
    conflictos: bloqueos.map((item) => item.codigo).sort(),
    origen: {
      grados: ordenarParaHash(
        gradosOrigen.map((grado) => [
          grado.nombre_grado,
          grado.nivel,
          grado.seccion,
          aNumero(grado.orden),
        ]),
      ),
      conceptos: ordenarParaHash(
        conceptosSeleccionados.map((concepto) => [
          concepto.tipo,
          concepto.mes === null || concepto.mes === undefined
            ? null
            : Number(concepto.mes),
          concepto.nombre,
          aMonto(concepto.monto_base),
        ]),
      ),
      periodos: ordenarParaHash(
        periodosOrigen.map((periodo) => [
          Number(periodo.orden),
          periodo.nombre,
          String(periodo.hora_inicio),
          String(periodo.hora_fin),
          periodo.tipo,
          Boolean(periodo.activo),
        ]),
      ),
      carga: ordenarParaHash(
        cargaOrigen.map((carga) => [
          carga.nombre_grado,
          carga.seccion,
          Number(carga.id_curso),
          Number(carga.id_personal),
          aHoras(carga.horas_asignadas),
        ]),
      ),
      tutores: ordenarParaHash(
        tutoresOrigen.map((tutor) => [
          tutor.nombre_grado,
          tutor.seccion,
          Number(tutor.id_personal),
          tutor.docente_estado,
        ]),
      ),
    },
    // La oferta del destino no entra en el hash: el confirm idempotente debe
    // conservar el mismo hash después de clonar. Cualquier cambio relevante
    // del destino (actividad u oferta distinta) cambia `conflictos`.
    // Un año ausente se normaliza a PLANIFICADO porque el rollover lo crea así.
    destino: {
      estado: destino?.estado || "PLANIFICADO",
    },
  };

  const previewHash = crearHash(payloadHash);

  // Mapas para el clonado. Las claves usan datos naturales, no IDs del origen.
  const mapas = {
    grados: new Map(mapaGradosDestino),
    conceptos: new Map(mapaConceptosDestino),
    periodos: new Map(mapaPeriodosDestino),
    carga: new Map(mapaCargaDestino),
    tutores: new Map(mapaTutoresDestino),
  };

  return {
    anioOrigen,
    anioDestino,
    incluirOtros,
    origen,
    destino,
    crearAnio: !destino,
    marca: construirMarca(anioOrigen, incluirOtros),
    actividadDestino,
    resumen,
    detalle: {
      grados: detalleGrados,
      conceptos: detalleConceptos,
      periodos: detallePeriodos,
      carga: detalleCarga,
      tutores: detalleTutores,
    },
    bloqueos,
    advertencias,
    previewHash,
    fuentes: {
      grados: gradosOrigen,
      conceptos: conceptosEsperados,
      periodos: periodosOrigen,
      carga: cargaOrigen,
      tutores: tutoresActivos,
    },
    mapas,
  };
};

/**
 * Previsualización de solo lectura.
 */
const previsualizar = async (data = {}) => {
  const anioOrigen = parseAnio(data.anio_origen, "año origen");
  const anioDestino = parseAnio(data.anio_destino, "año destino");
  if (anioOrigen >= anioDestino) {
    throw crearError(
      "El año destino debe ser posterior al año origen.",
      400,
      { codigo: "ANIOS_INVALIDOS", anio_origen: anioOrigen, anio_destino: anioDestino },
    );
  }
  const incluirOtros = normalizarBooleano(data.incluir_otros);

  try {
    const contexto = await leerContexto({
      anioOrigen,
      anioDestino,
      incluirOtros,
      modo: "preview",
    });

    return {
      anio_origen: anioOrigen,
      anio_destino: anioDestino,
      incluir_otros: incluirOtros,
      crear_anio: contexto.crearAnio,
      resumen: contexto.resumen,
      detalle: contexto.detalle,
      actividad_destino: contexto.actividadDestino,
      bloqueos: contexto.bloqueos,
      advertencias: contexto.advertencias,
      preview_hash: contexto.previewHash,
    };
  } catch (error) {
    throw traducirError(error);
  }
};

const clonarOferta = async (client, contexto, idUsuario) => {
  const { anioDestino, incluirOtros } = contexto;
  const marca = contexto.marca;

  let anioRow = await anioLectivoDao.findByAnioForUpdate(
    anioDestino,
    client,
  );
  let anioCreado = false;

  if (!anioRow) {
    anioRow = await anioLectivoDao.crear(
      {
        anio: anioDestino,
        creadoPor: idUsuario,
        observacion: marca,
      },
      client,
    );
    anioCreado = true;

    if (!anioRow) {
      throw crearError(
        `No se pudo crear el año lectivo ${anioDestino}; puede haber cambiado de estado.`,
        409,
        { codigo: "ANIO_DESTINO_CONFLICTO", anio: anioDestino },
      );
    }
  } else {
    if (anioRow.estado !== "PLANIFICADO") {
      throw crearError(
        `El año destino ${anioDestino} está ${anioRow.estado}; no se puede clonar oferta.`,
        409,
        {
          codigo: "DESTINO_NO_PLANIFICADO",
          anio: anioDestino,
          estado: anioRow.estado,
        },
      );
    }
    const observacion = actualizarMarca(anioRow.observacion, marca);
    if (observacion !== anioRow.observacion) {
      anioRow = await anioLectivoDao.actualizarObservacion(
        anioDestino,
        observacion,
        client,
      );
    }
  }

  const conteos = {
    grados: { creados: 0, existentes: 0 },
    conceptos: { creados: 0, existentes: 0 },
    periodos: { creados: 0, existentes: 0 },
    carga: { creadas: 0, existentes: 0 },
    tutores: { creados: 0, existentes: 0, omitidos: 0 },
  };

  // Grados
  for (const grado of contexto.fuentes.grados) {
    const clave = claveGrado(grado);
    if (contexto.mapas.grados.has(clave)) {
      conteos.grados.existentes += 1;
      continue;
    }

    const insertado = await rolloverDao.insertarGrado(
      grado,
      anioDestino,
      client,
    );
    contexto.mapas.grados.set(clave, insertado);
    conteos.grados.creados += 1;
  }

  // Conceptos
  for (const concepto of contexto.fuentes.conceptos) {
    if (contexto.mapas.conceptos.has(concepto.clave)) {
      conteos.conceptos.existentes += 1;
      continue;
    }

    let idGradoDestino = null;
    if (concepto.id_grado) {
      const grado = contexto.mapas.grados.get(
        `${String(concepto.grado_nombre || "").trim()}|${String(
          concepto.grado_seccion || "",
        ).trim()}`,
      );
      if (!grado) {
        throw crearError(
          `No se pudo mapear el grado de la tarifa ${concepto.nombre} al año ${anioDestino}.`,
          422,
          { codigo: "CONCEPTO_SIN_GRADO_DESTINO" },
        );
      }
      idGradoDestino = grado.id_grado;
    }

    const insertado = await rolloverDao.insertarConcepto(
      {
        nombre: concepto.nombre_destino,
        monto_base: concepto.monto_base,
        tipo: concepto.tipo,
        mes: concepto.mes,
        nivel: concepto.nivel || null,
        id_grado: idGradoDestino,
        orden: concepto.orden || 0,
        vigente_desde: concepto.vigente_desde_destino,
        vigente_hasta: null,
      },
      anioDestino,
      client,
    );
    contexto.mapas.conceptos.set(concepto.clave, insertado);
    conteos.conceptos.creados += 1;
  }

  // Períodos
  for (const periodo of contexto.fuentes.periodos) {
    const clave = String(periodo.orden);
    if (contexto.mapas.periodos.has(clave)) {
      conteos.periodos.existentes += 1;
      continue;
    }

    const insertado = await rolloverDao.insertarPeriodo(
      periodo,
      anioDestino,
      client,
    );
    contexto.mapas.periodos.set(clave, insertado);
    conteos.periodos.creados += 1;
  }

  // Carga curricular
  for (const carga of contexto.fuentes.carga) {
    const gradoDestino = contexto.mapas.grados.get(claveGrado(carga));
    if (!gradoDestino) {
      throw crearError(
        `No se pudo mapear el grado ${carga.nombre_grado} ${carga.seccion} al año ${anioDestino}.`,
        500,
        { codigo: "MAPEO_GRADO_INCOMPLETO" },
      );
    }

    const clave = `${gradoDestino.id_grado}|${carga.id_curso}`;
    if (contexto.mapas.carga.has(clave)) {
      conteos.carga.existentes += 1;
      continue;
    }

    const insertada = await rolloverDao.insertarCarga(
      {
        id_grado: gradoDestino.id_grado,
        id_curso: carga.id_curso,
        id_personal: carga.id_personal,
        horas_asignadas: carga.horas_asignadas,
      },
      anioDestino,
      client,
    );
    contexto.mapas.carga.set(clave, insertada);
    conteos.carga.creadas += 1;
  }

  // Tutores (solo docentes activos; se permite que queden vacíos)
  const tutoresActivos = contexto.fuentes.tutores.filter(
    (tutor) => tutor.docente_estado === "ACTIVO",
  );
  conteos.tutores.omitidos = contexto.resumen.tutores.omitidos || 0;

  for (const tutor of tutoresActivos) {
    const gradoDestino = contexto.mapas.grados.get(claveGrado(tutor));
    if (!gradoDestino) {
      throw crearError(
        `No se pudo mapear el grado ${tutor.nombre_grado} ${tutor.seccion} al año ${anioDestino}.`,
        500,
        { codigo: "MAPEO_GRADO_INCOMPLETO" },
      );
    }

    const clave = String(gradoDestino.id_grado);
    if (contexto.mapas.tutores.has(clave)) {
      conteos.tutores.existentes += 1;
      continue;
    }

    const insertado = await rolloverDao.insertarTutor(
      {
        id_grado: gradoDestino.id_grado,
        id_personal: tutor.id_personal,
      },
      anioDestino,
      client,
    );
    contexto.mapas.tutores.set(clave, insertado);
    conteos.tutores.creados += 1;
  }

  const creados =
    conteos.grados.creados +
    conteos.conceptos.creados +
    conteos.periodos.creados +
    conteos.carga.creadas +
    conteos.tutores.creados;
  const existentes =
    conteos.grados.existentes +
    conteos.conceptos.existentes +
    conteos.periodos.existentes +
    conteos.carga.existentes +
    conteos.tutores.existentes;

  return {
    anio_origen: contexto.anioOrigen,
    anio_destino: anioDestino,
    incluir_otros: incluirOtros,
    anio_creado: anioCreado,
    estado: anioRow?.estado || "PLANIFICADO",
    creados,
    existentes,
    conteos,
    preview_hash: contexto.previewHash,
  };
};

/**
 * Confirmación transaccional e idempotente.
 */
const confirmar = async (data = {}, idUsuario = null) => {
  const anioOrigen = parseAnio(data.anio_origen, "año origen");
  const anioDestino = parseAnio(data.anio_destino, "año destino");
  if (anioOrigen >= anioDestino) {
    throw crearError(
      "El año destino debe ser posterior al año origen.",
      400,
      { codigo: "ANIOS_INVALIDOS" },
    );
  }

  if (!normalizarBooleano(data.confirmar)) {
    throw crearError(
      "Debe enviar confirmar=true para ejecutar el rollover.",
      400,
      { codigo: "CONFIRMAR_REQUERIDO" },
    );
  }

  const previewHash = String(data.preview_hash || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(previewHash)) {
    throw crearError(
      "El preview_hash debe ser un SHA-256 hexadecimal de 64 caracteres.",
      400,
      { codigo: "HASH_INVALIDO" },
    );
  }

  const incluirOtros = normalizarBooleano(data.incluir_otros);

  let resultado;
  try {
    resultado = await conTransaccion(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `rollover:${anioOrigen}:${anioDestino}`,
      ]);

      const contexto = await leerContexto({
        anioOrigen,
        anioDestino,
        incluirOtros,
        modo: "preview",
        client,
      });

      if (contexto.previewHash !== previewHash) {
        throw crearError(
          "La previsualización cambió desde que se generó. Vuelva a previsualizar antes de confirmar.",
          409,
          { codigo: "PREVIEW_DESACTUALIZADA" },
        );
      }

      if (contexto.bloqueos.length > 0) {
        const codigos = contexto.bloqueos.map((item) => item.codigo);
        const conflictoOferta = codigos.some((codigo) =>
          ["OFERTA_DESTINO_DISTINTA", "DESTINO_CON_ACTIVIDAD"].includes(
            codigo,
          ),
        );

        throw crearError(
          "No se puede confirmar el rollover porque hay bloqueos.",
          conflictoOferta ? 409 : 422,
          {
            codigo: conflictoOferta
              ? "ROLLOVER_CONFLICTO"
              : "ROLLOVER_BLOQUEADO",
            bloqueos: contexto.bloqueos,
            advertencias: contexto.advertencias,
          },
        );
      }

      return await clonarOferta(client, contexto, idUsuario);
    });
  } catch (error) {
    throw traducirError(error);
  }

  return resultado;
};

/**
 * Revierte la oferta de un año PLANIFICADO sin actividad.
 * Solo borra si la oferta coincide exactamente con la esperada.
 */
const revertir = async ({ anio, motivo, confirmar, idUsuario = null }) => {
  const anioObjetivo = parseAnio(anio, "año a revertir");
  if (!normalizarBooleano(confirmar)) {
    throw crearError(
      "Debe enviar confirmar=true para revertir el rollover.",
      400,
      { codigo: "CONFIRMAR_REQUERIDO" },
    );
  }

  const motivoLimpio = String(motivo || "").trim();
  if (motivoLimpio.length < 10) {
    throw crearError(
      "El motivo de reversión debe tener al menos 10 caracteres.",
      400,
      { codigo: "MOTIVO_REQUERIDO" },
    );
  }
  if (motivoLimpio.length > 250) {
    throw crearError(
      "El motivo de reversión no puede superar los 250 caracteres.",
      400,
      { codigo: "MOTIVO_REQUERIDO" },
    );
  }

  try {
    return await conTransaccion(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `revertir_anio:${anioObjetivo}`,
      ]);

      const anioRow = await anioLectivoDao.findByAnioForUpdate(
        anioObjetivo,
        client,
      );
      if (!anioRow) {
        throw crearError(
          `El año lectivo ${anioObjetivo} no existe en el catálogo.`,
          404,
          { codigo: "ANIO_NO_ENCONTRADO" },
        );
      }

      if (anioRow.estado !== "PLANIFICADO") {
        throw crearError(
          `Solo se puede revertir un año PLANIFICADO. El año ${anioObjetivo} está ${anioRow.estado}.`,
          409,
          {
            codigo: "ANIO_NO_PLANIFICADO",
            anio: anioObjetivo,
            estado: anioRow.estado,
          },
        );
      }

      const actividad = await rolloverDao.contarActividad(
        anioObjetivo,
        client,
      );
      if (totalActividad(actividad) > 0) {
        throw crearError(
          `No se puede revertir ${anioObjetivo}: el año ya tiene actividad.`,
          409,
          { codigo: "ANIO_CON_ACTIVIDAD", actividad },
        );
      }

      const marca = parsearMarca(anioRow.observacion);
      if (!marca) {
        throw crearError(
          `No se puede revertir ${anioObjetivo}: la oferta no fue creada por un rollover identificable.`,
          409,
          { codigo: "SIN_MARCA_ROLLOVER", anio: anioObjetivo },
        );
      }

      const contexto = await leerContexto({
        anioOrigen: marca.anioOrigen,
        anioDestino: anioObjetivo,
        incluirOtros: marca.incluirOtros,
        modo: "reversion",
        client,
      });

      if (contexto.bloqueos.length > 0) {
        throw crearError(
          `No se puede revertir ${anioObjetivo}: la oferta no coincide exactamente con la clonada desde ${marca.anioOrigen}.`,
          409,
          {
            codigo: "OFERTA_NO_REVERSIBLE",
            bloqueos: contexto.bloqueos,
          },
        );
      }

      const conteos = await rolloverDao.eliminarOferta(
        anioObjetivo,
        client,
      );

      let anioEliminado = false;
      if (String(anioRow.observacion || "").trim().startsWith("Rollover desde")) {
        const eliminado = await anioLectivoDao.eliminarAnio(
          anioObjetivo,
          client,
        );
        anioEliminado = Boolean(eliminado);
      }

      return {
        anio: anioObjetivo,
        motivo: motivoLimpio,
        anio_origen: marca.anioOrigen,
        incluir_otros: marca.incluirOtros,
        anio_eliminado: anioEliminado,
        conteos,
        creados: 0,
        existentes: 0,
      };
    });
  } catch (error) {
    throw traducirError(error);
  }
};

module.exports = {
  previsualizar,
  confirmar,
  revertir,
  leerContexto,
  construirMarca,
  parsearMarca,
  actualizarMarca,
};
