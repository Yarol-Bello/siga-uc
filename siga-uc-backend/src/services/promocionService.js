/**
 * Servicio de promociones anuales (H73 / Fase 6.3)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 *
 * La promoción es recomendación + confirmación humana. El sistema no
 * decide la norma peruana: aplica la política configurada y exige un
 * override auditado cuando el ADMIN se aparta de la sugerencia.
 */

const crypto = require("crypto");
const promocionDao = require("../dao/promocionDao");
const anioLectivoDao = require("../dao/anioLectivoDao");
const politicaPromocionService = require("./politicaPromocionService");
const { getClient } = require("../config/database");

const RESULTADOS = new Set([
  "PROMOVIDO",
  "REPITENTE",
  "EGRESADO",
  "RETIRADO",
  "PENDIENTE",
]);

const RESULTADOS_CON_DESTINO = new Set(["PROMOVIDO", "REPITENTE"]);

const crearError = politicaPromocionService.crearError;
const traducirError = politicaPromocionService.traducirError;
const parseAnio = politicaPromocionService.parseAnio;

const aNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const normalizarBooleano = (valor, defecto = false) => {
  if (valor === undefined || valor === null) return defecto;
  return valor === true || valor === "true" || valor === 1 || valor === "1";
};

const claveGrado = (grado) =>
  `${String(grado.nivel).trim()}|${String(grado.seccion).trim()}|${Number(
    grado.orden,
  )}`;

const claveGradoOrden = (grado) =>
  `${String(grado.nivel).trim()}|${String(grado.seccion).trim()}|${Number(
    grado.orden,
  )}`;

const normalizarDecisiones = (decisiones) => {
  if (decisiones === undefined || decisiones === null || decisiones === "") {
    return [];
  }
  if (!Array.isArray(decisiones)) {
    throw crearError(
      "decisiones debe ser un arreglo de objetos.",
      400,
      { codigo: "DECISIONES_INVALIDAS" },
    );
  }

  const vistos = new Set();
  const resultado = decisiones.map((decision) => {
    if (!decision || typeof decision !== "object") {
      throw crearError(
        "Cada decisión debe ser un objeto.",
        400,
        { codigo: "DECISIONES_INVALIDAS" },
      );
    }

    const id = Number(decision.id_alumno_origen);
    if (!Number.isInteger(id) || id <= 0) {
      throw crearError(
        "Cada decisión requiere id_alumno_origen válido.",
        400,
        { codigo: "DECISIONES_INVALIDAS" },
      );
    }
    if (vistos.has(id)) {
      throw crearError(
        `Hay más de una decisión para la matrícula ${id}.`,
        400,
        { codigo: "DECISION_DUPLICADA", id_alumno_origen: id },
      );
    }
    vistos.add(id);

    const resultadoDecision = String(decision.resultado || "").toUpperCase();
    if (!RESULTADOS.has(resultadoDecision)) {
      throw crearError(
        `Resultado inválido en la decisión de la matrícula ${id}.`,
        400,
        { codigo: "RESULTADO_INVALIDO", id_alumno_origen: id },
      );
    }

    let idGradoDestino = null;
    if (
      decision.id_grado_destino !== undefined &&
      decision.id_grado_destino !== null &&
      decision.id_grado_destino !== ""
    ) {
      idGradoDestino = Number(decision.id_grado_destino);
      if (!Number.isInteger(idGradoDestino) || idGradoDestino <= 0) {
        throw crearError(
          `id_grado_destino inválido en la decisión de la matrícula ${id}.`,
          400,
          { codigo: "GRADO_INVALIDO", id_alumno_origen: id },
        );
      }
    }

    return {
      id_alumno_origen: id,
      resultado: resultadoDecision,
      id_grado_destino: idGradoDestino,
      motivo: String(decision.motivo || "").trim(),
      es_override: normalizarBooleano(decision.es_override, false),
    };
  });

  return resultado.sort(
    (a, b) => a.id_alumno_origen - b.id_alumno_origen,
  );
};

const porcentajeAsistencia = (asistencia) => {
  const total = aNumero(asistencia?.total);
  const presentes = aNumero(asistencia?.presentes);
  if (total === 0) return null;
  return Math.round((presentes / total) * 10000) / 100;
};

const esUltimoGrado = (gradosOrigen, grado) => {
  const mismos = gradosOrigen.filter(
    (item) =>
      String(item.nivel) === String(grado.nivel) &&
      String(item.seccion) === String(grado.seccion),
  );
  const maximo = Math.max(...mismos.map((item) => Number(item.orden)), 0);
  return Number(grado.orden) >= maximo;
};

const hayOtroNivel = (gradosDestino, nivelOrigen) =>
  gradosDestino.some(
    (grado) => String(grado.nivel) !== String(nivelOrigen),
  );

const buscarGradoDestino = (gradosDestino, gradoOrigen, ordenDestino) =>
  gradosDestino.find(
    (grado) =>
      String(grado.nivel) === String(gradoOrigen.nivel) &&
      String(grado.seccion) === String(gradoOrigen.seccion) &&
      Number(grado.orden) === Number(ordenDestino),
  ) || null;

const buscarTransicion = (politica, gradoOrigen, gradosDestino) => {
  const transiciones = politica?.criterio_academico?.transiciones || [];
  for (const transicion of transiciones) {
    if (
      String(transicion.nivel_origen) !== String(gradoOrigen.nivel) ||
      Number(transicion.orden_origen) !== Number(gradoOrigen.orden)
    ) {
      continue;
    }
    if (
      transicion.seccion &&
      String(transicion.seccion) !== String(gradoOrigen.seccion)
    ) {
      continue;
    }
    const seccionDestino = transicion.seccion_destino || gradoOrigen.seccion;
    const destino = gradosDestino.find(
      (grado) =>
        String(grado.nivel) === String(transicion.nivel_destino) &&
        String(grado.seccion) === String(seccionDestino) &&
        Number(grado.orden) === Number(transicion.orden_destino),
    );
    if (destino) return destino;
  }
  return null;
};

const construirHash = (payload) =>
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
        "❌ Error al revertir transacción de promociones:",
        rollbackError.message,
      );
    }
    throw traducirError(error);
  } finally {
    client.release();
  }
};

/**
 * Calcula la previsualización completa sin escribir nada.
 * `client` se usa dentro de la transacción de confirmación.
 */
const calcularPreview = async (
  {
    anioOrigen,
    anioDestino,
    idPolitica = null,
    idGrado = null,
    incluirRetirados = false,
    decisiones = [],
  },
  client = null,
) => {
  const anioO = parseAnio(anioOrigen, "año origen");
  const anioD = parseAnio(anioDestino, "año destino");
  if (anioO >= anioD) {
    throw crearError(
      "El año destino debe ser posterior al año origen.",
      400,
      { codigo: "ANIOS_INVALIDOS" },
    );
  }

  const gradoFiltro =
    idGrado === undefined || idGrado === null || idGrado === ""
      ? null
      : Number(idGrado);
  if (
    gradoFiltro !== null &&
    (!Number.isInteger(gradoFiltro) || gradoFiltro <= 0)
  ) {
    throw crearError("Grado inválido.", 400, {
      codigo: "GRADO_INVALIDO",
    });
  }

  const origenAnio = await anioLectivoDao.findByAnio(anioO, client);
  const destinoAnio = await anioLectivoDao.findByAnio(anioD, client);

  if (!origenAnio) {
    throw crearError(
      `El año origen ${anioO} no existe en el catálogo de años lectivos.`,
      422,
      { codigo: "ORIGEN_SIN_OFERTA", anio_origen: anioO },
    );
  }
  if (!destinoAnio) {
    throw crearError(
      `El año destino ${anioD} no existe. Ejecute el rollover de 6.2 primero.`,
      422,
      { codigo: "DESTINO_SIN_OFERTA", anio_destino: anioD },
    );
  }

  const gradosOrigen = await promocionDao.listarGrados(anioO, client);
  const gradosDestino = await promocionDao.listarGrados(anioD, client);
  const conceptoMatricula = await promocionDao.obtenerConceptoMatricula(
    anioD,
    client,
  );

  if (gradosDestino.length === 0) {
    throw crearError(
      `El año destino ${anioD} no tiene grados. Ejecute el rollover de 6.2 primero.`,
      422,
      { codigo: "DESTINO_SIN_OFERTA", anio_destino: anioD },
    );
  }

  if (gradosOrigen.length === 0) {
    throw crearError(
      `El año origen ${anioO} no tiene grados.`,
      422,
      { codigo: "ORIGEN_SIN_OFERTA", anio_origen: anioO },
    );
  }

  if (
    gradoFiltro !== null &&
    !gradosOrigen.some((grado) => Number(grado.id_grado) === gradoFiltro)
  ) {
    throw crearError(
      `El grado ${gradoFiltro} no pertenece al año origen ${anioO}.`,
      422,
      { codigo: "GRADO_NO_PERTENECE", id_grado: gradoFiltro },
    );
  }

  const politica = await politicaPromocionService.resolverPolitica(
    idPolitica,
    anioO,
    anioD,
  );

  const alumnos = await promocionDao.listarMatriculasOrigen(
    {
      anioOrigen: anioO,
      idGrado: gradoFiltro,
      incluirRetirados: normalizarBooleano(incluirRetirados, false),
    },
    client,
  );

  const retiradosOmitidos = normalizarBooleano(incluirRetirados, false)
    ? 0
    : await promocionDao.contarRetiradosOmitidos(
        { anioOrigen: anioO, idGrado: gradoFiltro },
        client,
      );

  const idsAlumnos = alumnos.map((alumno) => Number(alumno.id_alumno));
  const idsGrados = [...new Set(alumnos.map((alumno) => Number(alumno.id_grado)))];

  const cursos = await promocionDao.listarCursosPorGrado(
    anioO,
    gradoFiltro,
    client,
  );
  const actas = await promocionDao.listarActas(anioO, idsGrados, client);
  const notas = await promocionDao.listarNotasFinales(
    {
      anio: anioO,
      bimestre: politica.criterio_academico.notas_bimestre,
      idsAlumnos,
    },
    client,
  );
  const asistencias = await promocionDao.listarAsistencia(
    { anio: anioO, idsAlumnos },
    client,
  );
  const deudas = await promocionDao.listarDeuda(
    { anio: anioO, idsAlumnos },
    client,
  );
  const becas = await promocionDao.listarBecas(
    { anio: anioO, idsAlumnos },
    client,
  );
  const promocionesConfirmadas =
    await promocionDao.buscarPromocionesConfirmadas({ idsAlumnos }, client);
  const matriculasDestino =
    await promocionDao.buscarMatriculasDestino(
      {
        anioDestino: anioD,
        idsUsuarios: alumnos.map((alumno) => Number(alumno.id_usuario)),
        dnis: alumnos.map((alumno) => String(alumno.dni)),
      },
      client,
    );

  const cursosPorGrado = new Map();
  for (const curso of cursos) {
    const idGradoCurso = Number(curso.id_grado);
    if (!cursosPorGrado.has(idGradoCurso)) {
      cursosPorGrado.set(idGradoCurso, []);
    }
    cursosPorGrado.get(idGradoCurso).push({
      id_curso: Number(curso.id_curso),
      nombre_curso: curso.nombre_curso,
    });
  }

  const actasPorGrado = new Map();
  const actasGlobales = new Map();
  for (const acta of actas) {
    const bimestre = Number(acta.bimestre);
    if (acta.id_grado === null) {
      actasGlobales.set(bimestre, acta.estado);
    } else {
      const idGradoActa = Number(acta.id_grado);
      if (!actasPorGrado.has(idGradoActa)) {
        actasPorGrado.set(idGradoActa, new Map());
      }
      actasPorGrado.get(idGradoActa).set(bimestre, acta.estado);
    }
  }

  const notasMap = new Map();
  for (const nota of notas) {
    notasMap.set(
      `${Number(nota.id_alumno)}|${Number(nota.id_curso)}`,
      String(nota.nota_final).toUpperCase(),
    );
  }

  const asistenciaMap = new Map(
    asistencias.map((item) => [Number(item.id_alumno), item]),
  );
  const deudaMap = new Map(
    deudas.map((item) => [Number(item.id_alumno), item]),
  );
  const becasMap = new Map();
  for (const beca of becas) {
    const idAlumno = Number(beca.id_alumno);
    if (!becasMap.has(idAlumno)) becasMap.set(idAlumno, []);
    becasMap.get(idAlumno).push({
      id_beca: Number(beca.id_beca),
      tipo: beca.tipo,
      porcentaje_descuento: aNumero(beca.porcentaje_descuento),
      monto_descuento:
        beca.monto_descuento === null ? null : aNumero(beca.monto_descuento),
      fecha_fin: beca.fecha_fin,
    });
  }

  const promocionesPorOrigen = new Map();
  for (const promocion of promocionesConfirmadas) {
    promocionesPorOrigen.set(Number(promocion.id_alumno_origen), promocion);
  }
  const matriculasDestinoPorUsuario = new Map();
  const matriculasDestinoPorDni = new Map();
  for (const matricula of matriculasDestino) {
    matriculasDestinoPorUsuario.set(Number(matricula.id_usuario), matricula);
    matriculasDestinoPorDni.set(String(matricula.dni), matricula);
  }

  const decisionMap = new Map(
    normalizarDecisiones(decisiones).map((decision) => [
      decision.id_alumno_origen,
      decision,
    ]),
  );

  const alumnosPreview = [];
  const conteos = {
    PROMOVIDO: 0,
    REPITENTE: 0,
    EGRESADO: 0,
    RETIRADO: 0,
    PENDIENTE: 0,
  };

  const bloquesBimestres =
    politica.criterio_academico.bimestres_requeridos || [1, 2, 3, 4];

  for (const alumno of alumnos) {
    const idAlumno = Number(alumno.id_alumno);
    const idGradoOrigen = Number(alumno.id_grado);
    const actasGrado = actasPorGrado.get(idGradoOrigen) || new Map();
    const faltantesActas = bloquesBimestres.filter(
      (bimestre) =>
        actasGlobales.get(Number(bimestre)) !== "CERRADO" &&
        actasGrado.get(Number(bimestre)) !== "CERRADO",
    );
    const actaGlobalCerrada = [...actasGlobales.values()].includes("CERRADO");

    const cursosGrado = cursosPorGrado.get(idGradoOrigen) || [];
    const faltantesNotas = cursosGrado
      .filter(
        (curso) =>
          !notasMap.has(`${idAlumno}|${Number(curso.id_curso)}`),
      )
      .map((curso) => curso.nombre_curso);

    const asistencia = asistenciaMap.get(idAlumno) || {
      total: 0,
      presentes: 0,
      tardanzas: 0,
      faltas: 0,
    };
    const porcentaje = porcentajeAsistencia(asistencia);
    const umbral = politica.umbral_asistencia;
    const cumpleAsistencia =
      umbral === null || porcentaje === null || porcentaje >= umbral;

    const deuda = deudaMap.get(idAlumno) || {
      deuda_pensiones: 0,
      deuda_pretickets: 0,
    };
    const montoDeuda =
      aNumero(deuda.deuda_pensiones) + aNumero(deuda.deuda_pretickets);

    const becasAlumno = becasMap.get(idAlumno) || [];

    const bloqueos = [];
    const advertencias = [];
    const agregarBloqueo = (codigo, mensaje, detalle = null) => {
      bloqueos.push({
        codigo,
        mensaje,
        ...(detalle ? { detalle } : {}),
      });
    };
    const agregarAdvertencia = (codigo, mensaje, detalle = null) => {
      advertencias.push({
        codigo,
        mensaje,
        ...(detalle ? { detalle } : {}),
      });
    };

    const esRetirado =
      alumno.condicion === "Traslado" ||
      alumno.estado_matricula === "Retirado";

    let resultadoSugerido = "PENDIENTE";
    let idGradoDestinoSugerido = null;

    if (esRetirado) {
      resultadoSugerido = "RETIRADO";
    } else {
      const siguiente = buscarGradoDestino(
        gradosDestino,
        alumno,
        Number(alumno.orden) + 1,
      );
      const transicion = siguiente
        ? null
        : buscarTransicion(politica, alumno, gradosDestino);

      if (siguiente) {
        idGradoDestinoSugerido = Number(siguiente.id_grado);
      } else if (transicion) {
        idGradoDestinoSugerido = Number(transicion.id_grado);
      } else if (esUltimoGrado(gradosOrigen, alumno)) {
        if (hayOtroNivel(gradosDestino, alumno.nivel)) {
          resultadoSugerido = "PENDIENTE";
          agregarBloqueo(
            "TRANSICION_NO_CONFIGURADA",
            "El alumno termina el nivel y no hay una transición configurada en la política.",
          );
        } else {
          resultadoSugerido = "EGRESADO";
        }
      } else {
        resultadoSugerido = "PENDIENTE";
        agregarBloqueo(
          "SIN_GRADO_DESTINO",
          "No existe el grado siguiente en la oferta del año destino.",
        );
      }

      if (resultadoSugerido === "PENDIENTE" && bloqueos.length === 0) {
        resultadoSugerido = "PROMOVIDO";
      }

      // Repitencia configurable por umbral de notas desaprobadas.
      if (
        resultadoSugerido === "PROMOVIDO" &&
        politica.criterio_academico.modo_repitencia === "UMBRAL"
      ) {
        const notasDesaprobadas = new Set(
          politica.criterio_academico.notas_desaprobadas || ["C"],
        );
        let desaprobados = 0;
        for (const curso of cursosGrado) {
          const nota = notasMap.get(
            `${idAlumno}|${Number(curso.id_curso)}`,
          );
          if (nota && notasDesaprobadas.has(nota)) desaprobados += 1;
        }
        if (
          desaprobados >=
          Number(politica.criterio_academico.min_cursos_desaprobados)
        ) {
          const mismoGrado = buscarGradoDestino(
            gradosDestino,
            alumno,
            Number(alumno.orden),
          );
          if (mismoGrado) {
            resultadoSugerido = "REPITENTE";
            idGradoDestinoSugerido = Number(mismoGrado.id_grado);
          } else {
            resultadoSugerido = "PENDIENTE";
            idGradoDestinoSugerido = null;
            agregarBloqueo(
              "SIN_GRADO_DESTINO_REPITENTE",
              "La política sugiere repitencia, pero el año destino no tiene el mismo grado.",
            );
          }
        }
      }

      if (resultadoSugerido === "PROMOVIDO") {
        if (
          politica.requiere_actas_cerradas &&
          faltantesActas.length > 0
        ) {
          resultadoSugerido = "PENDIENTE";
          idGradoDestinoSugerido = null;
          agregarBloqueo(
            "ACTAS_PENDIENTES",
            `Faltan actas cerradas de los bimestres ${faltantesActas.join(", ")}.`,
            faltantesActas,
          );
        } else if (
          politica.requiere_notas_finales &&
          faltantesNotas.length > 0
        ) {
          resultadoSugerido = "PENDIENTE";
          idGradoDestinoSugerido = null;
          agregarBloqueo(
            "NOTAS_PENDIENTES",
            `Faltan notas finales del bimestre ${politica.criterio_academico.notas_bimestre} en ${faltantesNotas.length} curso(s).`,
            faltantesNotas,
          );
        }
      }
    }

    if (umbral !== null && porcentaje !== null && !cumpleAsistencia) {
      agregarAdvertencia(
        "ASISTENCIA_BAJA",
        `Asistencia ${porcentaje}% por debajo del umbral ${umbral}%. Es una advertencia, no una exclusión automática.`,
      );
    }
    if (asistencia.total === 0) {
      agregarAdvertencia(
        "SIN_ASISTENCIA",
        "No hay registros de asistencia del año origen.",
      );
    }
    if (montoDeuda > 0) {
      agregarAdvertencia(
        "DEUDA_PENDIENTE",
        `Deuda pendiente de S/ ${montoDeuda.toFixed(2)}. No bloquea la promoción.`,
      );
    }
    if (becasAlumno.length > 0) {
      agregarAdvertencia(
        "BECA_ACTIVA",
        `Tiene ${becasAlumno.length} beca(s) activa(s). Se copiarán solo si se confirma copiar_becas.`,
      );
    }

    const promocionExistente = promocionesPorOrigen.get(idAlumno) || null;
    const matriculasDestinoAlumno =
      matriculasDestinoPorUsuario.get(Number(alumno.id_usuario)) ||
      matriculasDestinoPorDni.get(String(alumno.dni)) ||
      null;

    let yaConfirmada = false;
    if (promocionExistente) {
      if (Number(promocionExistente.anio_destino) === anioD) {
        yaConfirmada = true;
      } else {
        agregarBloqueo(
          "PROMOCION_YA_CONFIRMADA",
          `La matrícula ya tiene una promoción confirmada al año ${promocionExistente.anio_destino}.`,
          { id_promocion: promocionExistente.id_promocion },
        );
      }
    } else if (matriculasDestinoAlumno) {
      agregarBloqueo(
        "DESTINO_YA_MATRICULADO",
        `El alumno ya tiene matrícula ${anioD}.`,
        { id_alumno_destino: matriculasDestinoAlumno.id_alumno },
      );
    }

    let resultadoFinal = resultadoSugerido;
    let idGradoDestinoFinal = idGradoDestinoSugerido;
    let esOverride = false;
    let motivo = null;
    const decision = decisionMap.get(idAlumno) || null;

    if (decision && !yaConfirmada) {
      if (
        resultadoSugerido === "RETIRADO" &&
        decision.resultado !== "RETIRADO"
      ) {
        agregarBloqueo(
          "RETIRADO_NO_PROMOVIBLE",
          "Un alumno retirado o trasladado no puede promoverse.",
        );
      } else if (decision.resultado !== resultadoSugerido) {
        if (!politica.permite_override) {
          agregarBloqueo(
            "OVERRIDE_NO_PERMITIDO",
            "La política no permite modificar la sugerencia.",
          );
        } else if (decision.motivo.length < 5) {
          agregarBloqueo(
            "MOTIVO_OVERRIDE_REQUERIDO",
            "El override requiere un motivo de al menos 5 caracteres.",
          );
        } else {
          resultadoFinal = decision.resultado;
          esOverride = true;
          motivo = decision.motivo;
        }
      } else {
        resultadoFinal = decision.resultado;
      }

      if (RESULTADOS_CON_DESTINO.has(resultadoFinal)) {
        let gradoDestino = decision.id_grado_destino
          ? gradosDestino.find(
              (grado) =>
                Number(grado.id_grado) === Number(decision.id_grado_destino),
            ) || null
          : null;

        if (decision.id_grado_destino && !gradoDestino) {
          agregarBloqueo(
            "GRADO_DESTINO_INVALIDO",
            `El grado destino ${decision.id_grado_destino} no pertenece al año ${anioD}.`,
          );
        }

        if (!gradoDestino) {
          if (resultadoFinal === "REPITENTE") {
            gradoDestino = buscarGradoDestino(
              gradosDestino,
              alumno,
              Number(alumno.orden),
            );
          } else {
            gradoDestino =
              idGradoDestinoSugerido !== null
                ? gradosDestino.find(
                    (grado) =>
                      Number(grado.id_grado) ===
                      Number(idGradoDestinoSugerido),
                  ) || null
                : buscarGradoDestino(
                    gradosDestino,
                    alumno,
                    Number(alumno.orden) + 1,
                  ) ||
                  buscarTransicion(politica, alumno, gradosDestino);
          }
        }

        if (!gradoDestino) {
          agregarBloqueo(
            "SIN_GRADO_DESTINO",
            "El resultado elegido requiere un grado destino y no se encontró.",
          );
          idGradoDestinoFinal = null;
        } else {
          if (
            decision.id_grado_destino &&
            Number(decision.id_grado_destino) !==
              Number(idGradoDestinoSugerido) &&
            !esOverride
          ) {
            agregarBloqueo(
              "MOTIVO_OVERRIDE_REQUERIDO",
              "Cambiar el grado destino requiere un override con motivo.",
            );
            idGradoDestinoFinal = idGradoDestinoSugerido;
          } else {
            idGradoDestinoFinal = Number(gradoDestino.id_grado);
          }
        }
      } else {
        idGradoDestinoFinal = null;
      }

      if (
        esOverride &&
        (RESULTADOS_CON_DESTINO.has(resultadoFinal) ||
          resultadoFinal === "EGRESADO" ||
          resultadoFinal === "RETIRADO")
      ) {
        const bloqueosActas = bloqueos.filter(
          (item) =>
            item.codigo === "ACTAS_PENDIENTES" ||
            item.codigo === "NOTAS_PENDIENTES",
        );
        for (const bloqueo of bloqueosActas) {
          const indice = bloqueos.indexOf(bloqueo);
          if (indice >= 0) bloqueos.splice(indice, 1);
          advertencias.push({
            codigo: `OVERRIDE_${bloqueo.codigo}`,
            mensaje: `Override auditado: ${bloqueo.mensaje}`,
          });
        }
      }
    } else if (yaConfirmada) {
      resultadoFinal = promocionExistente.resultado;
      idGradoDestinoFinal = promocionExistente.id_grado_destino;
      esOverride = Boolean(promocionExistente.es_override);
      motivo = promocionExistente.motivo || null;
    }

    if (
      RESULTADOS_CON_DESTINO.has(resultadoFinal) &&
      idGradoDestinoFinal === null &&
      !bloqueos.some((item) => item.codigo === "SIN_GRADO_DESTINO")
    ) {
      agregarBloqueo(
        "SIN_GRADO_DESTINO",
        "No se pudo determinar el grado destino.",
      );
    }

    if (
      !RESULTADOS_CON_DESTINO.has(resultadoFinal) &&
      resultadoFinal !== "RETIRADO"
    ) {
      idGradoDestinoFinal = null;
    }

    if (yaConfirmada) {
      bloqueos.length = 0;
    }

    conteos[resultadoFinal] = (conteos[resultadoFinal] || 0) + 1;

    alumnosPreview.push({
      id_alumno_origen: idAlumno,
      id_usuario: Number(alumno.id_usuario),
      dni: alumno.dni,
      nombres: alumno.nombres,
      apellidos: alumno.apellidos,
      nombre_completo: `${alumno.nombres} ${alumno.apellidos}`,
      fecha_nacimiento: alumno.fecha_nacimiento,
      id_apoderado: alumno.id_apoderado,
      codigo_estudiante: alumno.codigo_estudiante,
      estado_matricula: alumno.estado_matricula,
      condicion: alumno.condicion,
      id_grado_origen: idGradoOrigen,
      nombre_grado: alumno.nombre_grado,
      nivel: alumno.nivel,
      seccion: alumno.seccion,
      orden: Number(alumno.orden),
      fecha_retiro: alumno.fecha_retiro,
      motivo_retiro: alumno.motivo_retiro,
      colegio_destino: alumno.colegio_destino,
      id_grado_destino: idGradoDestinoFinal,
      resultado_sugerido: resultadoSugerido,
      resultado_final: resultadoFinal,
      es_override: esOverride,
      motivo,
      ya_confirmada: yaConfirmada,
      id_promocion: promocionExistente?.id_promocion || null,
      id_alumno_destino_promocion:
        promocionExistente?.id_alumno_destino || null,
      actas: {
        requeridas: bloquesBimestres,
        cerradas: bloquesBimestres.filter(
          (bimestre) => !faltantesActas.includes(bimestre),
        ),
        faltantes: faltantesActas,
        global_cerrada: actaGlobalCerrada,
      },
      notas: {
        bimestre: politica.criterio_academico.notas_bimestre,
        requeridas: cursosGrado.length,
        registradas: cursosGrado.length - faltantesNotas.length,
        faltantes: faltantesNotas,
        cursos: cursosGrado.map((curso) => curso.nombre_curso),
      },
      asistencia: {
        total: Number(asistencia.total || 0),
        presentes: Number(asistencia.presentes || 0),
        tardanzas: Number(asistencia.tardanzas || 0),
        faltas: Number(asistencia.faltas || 0),
        porcentaje,
        umbral,
        cumple: cumpleAsistencia,
      },
      deuda: {
        monto: Math.round(montoDeuda * 100) / 100,
        pensiones: aNumero(deuda.deuda_pensiones),
        pretickets: aNumero(deuda.deuda_pretickets),
      },
      becas: becasAlumno,
      bloqueos,
      advertencias,
      bloqueado: bloqueos.length > 0,
    });
  }

  const incluir = normalizarBooleano(incluirRetirados, false);
  const advertenciasGlobales = [];
  if (!incluir && retiradosOmitidos > 0) {
    advertenciasGlobales.push({
      codigo: "RETIRADOS_OMITIDOS",
      mensaje: `Se omitieron ${retiradosOmitidos} matrícula(s) retirada(s) o de traslado. Active "incluir retirados" para registrarlas.`,
    });
  }
  if (alumnos.length === 0) {
    advertenciasGlobales.push({
      codigo: "SIN_ALUMNOS",
      mensaje: "No hay matrículas para los filtros seleccionados.",
    });
  }
  if (!conceptoMatricula) {
    advertenciasGlobales.push({
      codigo: "SIN_CONCEPTO_MATRICULA",
      mensaje: `El año destino ${anioD} no tiene concepto MATRICULA; los promovidos quedarán Matriculado en lugar de PendientePago.`,
    });
  }

  const bloqueados = alumnosPreview.filter((alumno) => alumno.bloqueado).length;
  const overrides = alumnosPreview.filter((alumno) => alumno.es_override).length;
  const yaConfirmadas = alumnosPreview.filter(
    (alumno) => alumno.ya_confirmada,
  ).length;

  const payloadHash = {
    version: 1,
    anio_origen: anioO,
    anio_destino: anioD,
    id_grado: gradoFiltro,
    incluir_retirados: incluir,
    politica: {
      id_politica: politica.id_politica,
      nombre: politica.nombre,
      anio_origen: Number(politica.anio_origen),
      anio_destino:
        politica.anio_destino === null
          ? null
          : Number(politica.anio_destino),
      requiere_actas_cerradas: Boolean(politica.requiere_actas_cerradas),
      requiere_notas_finales: Boolean(politica.requiere_notas_finales),
      umbral_asistencia:
        politica.umbral_asistencia === null
          ? null
          : Number(politica.umbral_asistencia),
      permite_override: Boolean(politica.permite_override),
      criterio_academico: politica.criterio_academico,
    },
    destino: {
      grados: gradosDestino
        .map((grado) => [
          Number(grado.id_grado),
          grado.nombre_grado,
          grado.nivel,
          grado.seccion,
          Number(grado.orden),
        ])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      matricula: conceptoMatricula
        ? {
            id_concepto: Number(conceptoMatricula.id_concepto),
            monto: aNumero(conceptoMatricula.monto_base).toFixed(2),
          }
        : null,
    },
    decisiones: normalizarDecisiones(decisiones),
    alumnos: alumnosPreview
      .map((alumno) => ({
        id_alumno_origen: alumno.id_alumno_origen,
        dni: alumno.dni,
        nombres: alumno.nombres,
        apellidos: alumno.apellidos,
        id_grado_origen: alumno.id_grado_origen,
        id_grado_destino: alumno.id_grado_destino,
        estado_matricula: alumno.estado_matricula,
        condicion: alumno.condicion,
        fecha_retiro: alumno.fecha_retiro,
        motivo_retiro: alumno.motivo_retiro,
        colegio_destino: alumno.colegio_destino,
        resultado_sugerido: alumno.resultado_sugerido,
        resultado_final: alumno.resultado_final,
        es_override: alumno.es_override,
        motivo: alumno.motivo,
        actas: alumno.actas,
        notas: alumno.notas,
        asistencia: {
          total: alumno.asistencia.total,
          presentes: alumno.asistencia.presentes,
          porcentaje: alumno.asistencia.porcentaje,
        },
        deuda: alumno.deuda.monto,
        becas: alumno.becas.map((beca) => [
          beca.id_beca,
          beca.tipo,
          beca.porcentaje_descuento,
        ]),
        bloqueos: alumno.bloqueos.map((bloqueo) => bloqueo.codigo).sort(),
      }))
      .sort((a, b) => a.id_alumno_origen - b.id_alumno_origen),
    conteos,
  };

  const previewHash = construirHash(payloadHash);

  return {
    anio_origen: anioO,
    anio_destino: anioD,
    id_politica: politica.id_politica,
    politica: {
      id_politica: politica.id_politica,
      nombre: politica.nombre,
      anio_origen: Number(politica.anio_origen),
      anio_destino:
        politica.anio_destino === null
          ? null
          : Number(politica.anio_destino),
      requiere_actas_cerradas: Boolean(politica.requiere_actas_cerradas),
      requiere_notas_finales: Boolean(politica.requiere_notas_finales),
      umbral_asistencia:
        politica.umbral_asistencia === null
          ? null
          : Number(politica.umbral_asistencia),
      permite_override: Boolean(politica.permite_override),
      criterio_academico: politica.criterio_academico,
    },
    id_grado: gradoFiltro,
    incluir_retirados: incluir,
    destino: {
      nombre: destinoAnio?.nombre || `Año ${anioD}`,
      tiene_matricula: Boolean(conceptoMatricula),
      concepto_matricula: conceptoMatricula
        ? {
            id_concepto: Number(conceptoMatricula.id_concepto),
            monto: aNumero(conceptoMatricula.monto_base),
          }
        : null,
      grados: gradosDestino.map((grado) => ({
        id_grado: Number(grado.id_grado),
        nombre_grado: grado.nombre_grado,
        nivel: grado.nivel,
        seccion: grado.seccion,
        orden: Number(grado.orden),
      })),
    },
    resumen: {
      total: alumnosPreview.length,
      por_resultado: conteos,
      bloqueados,
      overrides,
      ya_confirmadas: yaConfirmadas,
      retirados_omitidos: retiradosOmitidos,
    },
    alumnos: alumnosPreview,
    advertencias: advertenciasGlobales,
    bloqueos: [],
    preview_hash: previewHash,
  };
};

const previsualizar = async (data = {}) => {
  try {
    return await calcularPreview({
      anioOrigen: data.anio_origen,
      anioDestino: data.anio_destino,
      idPolitica: data.id_politica,
      idGrado: data.id_grado,
      incluirRetirados: data.incluir_retirados,
      decisiones: data.decisiones,
    });
  } catch (error) {
    throw traducirError(error);
  }
};

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

  if (!normalizarBooleano(data.confirmar, false)) {
    throw crearError(
      "Debe enviar confirmar=true para ejecutar la promoción.",
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

  const decisiones = normalizarDecisiones(data.decisiones);
  const copiarBecas = normalizarBooleano(data.copiar_becas, false);

  return await conTransaccion(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `promocion:${anioOrigen}:${anioDestino}`,
    ]);

    const preview = await calcularPreview(
      {
        anioOrigen,
        anioDestino,
        idPolitica: data.id_politica,
        idGrado: data.id_grado,
        incluirRetirados: data.incluir_retirados,
        decisiones,
      },
      client,
    );

    if (preview.preview_hash !== previewHash) {
      throw crearError(
        "La previsualización cambió desde que se generó. Vuelva a previsualizar antes de confirmar.",
        409,
        { codigo: "PREVIEW_DESACTUALIZADA" },
      );
    }

    const bloqueados = preview.alumnos.filter((alumno) => alumno.bloqueado);
    if (bloqueados.length > 0) {
      throw crearError(
        "No se puede confirmar la promoción porque hay alumnos bloqueados.",
        422,
        {
          codigo: "PROMOCION_BLOQUEADA",
          alumnos: bloqueados.map((alumno) => ({
            id_alumno_origen: alumno.id_alumno_origen,
            nombre_completo: alumno.nombre_completo,
            bloqueos: alumno.bloqueos,
          })),
        },
      );
    }

    if (preview.alumnos.length === 0) {
      throw crearError(
        "No hay matrículas para promover con los filtros seleccionados.",
        422,
        { codigo: "SIN_ALUMNOS" },
      );
    }

    const confirmadas = preview.alumnos.filter(
      (alumno) => alumno.ya_confirmada,
    );
    if (confirmadas.length === preview.alumnos.length && preview.alumnos.length > 0) {
      return {
        anio_origen: anioOrigen,
        anio_destino: anioDestino,
        ya_confirmada: true,
        creados: 0,
        promociones: confirmadas.map((alumno) => ({
          id_promocion: alumno.id_promocion,
          id_alumno_origen: alumno.id_alumno_origen,
          resultado: alumno.resultado_final,
          id_alumno_destino: alumno.id_alumno_destino_promocion,
        })),
        resumen: preview.resumen,
        preview_hash: previewHash,
      };
    }

    if (confirmadas.length > 0) {
      throw crearError(
        "Parte del lote ya tiene una promoción confirmada. Anule o revise esas matrículas antes de reintentar.",
        409,
        {
          codigo: "PROMOCION_PARCIAL_EXISTENTE",
          ya_confirmadas: confirmadas.map((alumno) => ({
            id_alumno_origen: alumno.id_alumno_origen,
            id_promocion: alumno.id_promocion,
          })),
        },
      );
    }

    const conceptoMatricula = preview.destino.concepto_matricula;
    const promociones = [];
    const conteos = {
      PROMOVIDO: 0,
      REPITENTE: 0,
      EGRESADO: 0,
      RETIRADO: 0,
      PENDIENTE: 0,
      con_destino: 0,
      sin_destino: 0,
      becas_copiadas: 0,
    };

    for (const alumno of preview.alumnos) {
      const anulada = await promocionDao.buscarAnuladaParaReversion(
        {
          idAlumnoOrigen: alumno.id_alumno_origen,
          anioDestino,
        },
        client,
      );

      const metadata = {
        preview_hash: previewHash,
        politica: {
          id_politica: preview.politica.id_politica,
          nombre: preview.politica.nombre,
        },
        resultado_sugerido: alumno.resultado_sugerido,
        es_override: alumno.es_override,
        actas: alumno.actas,
        notas: alumno.notas,
        asistencia: alumno.asistencia,
        deuda: alumno.deuda,
        becas: alumno.becas,
        retiro:
          alumno.resultado_final === "RETIRADO"
            ? {
                motivo:
                  alumno.condicion === "Traslado" ? "TRASLADO" : "RETIRO",
                fecha_retiro: alumno.fecha_retiro,
                motivo_retiro: alumno.motivo_retiro,
                colegio_destino: alumno.colegio_destino,
              }
            : null,
      };

      let idAlumnoDestino = null;
      let idGradoDestino = alumno.id_grado_destino;

      if (
        RESULTADOS_CON_DESTINO.has(alumno.resultado_final) &&
        idGradoDestino
      ) {
        const estadoMatricula = conceptoMatricula
          ? "PendientePago"
          : "Matriculado";

        const nuevoAlumno = await promocionDao.insertarAlumnoDestino(
          {
            id_usuario: alumno.id_usuario,
            dni: alumno.dni,
            nombres: alumno.nombres,
            apellidos: alumno.apellidos,
            fecha_nacimiento: alumno.fecha_nacimiento,
            id_apoderado: alumno.id_apoderado,
            id_grado: idGradoDestino,
            condicion: "Regular",
            estado_matricula: estadoMatricula,
            codigo_estudiante: alumno.codigo_estudiante,
            anio_lectivo: anioDestino,
          },
          client,
        );
        idAlumnoDestino = Number(nuevoAlumno.id_alumno);

        await promocionDao.insertarExpediente(idAlumnoDestino, client);

        if (conceptoMatricula) {
          await promocionDao.insertarPreticket(
            {
              id_alumno: idAlumnoDestino,
              id_concepto: conceptoMatricula.id_concepto,
              monto: conceptoMatricula.monto,
              id_usuario_emite: idUsuario,
            },
            client,
          );
        }

        const becasCopiadas = [];
        if (copiarBecas) {
          for (const beca of alumno.becas) {
            const nueva = await promocionDao.copiarBeca(
              {
                id_alumno: idAlumnoDestino,
                tipo: beca.tipo,
                porcentaje_descuento: beca.porcentaje_descuento,
                monto_descuento: beca.monto_descuento,
                fecha_fin: beca.fecha_fin,
              },
              client,
            );
            becasCopiadas.push(Number(nueva.id_beca));
          }
        }
        metadata.becas_copiadas = becasCopiadas;
        conteos.becas_copiadas += becasCopiadas.length;

        const promocion = await promocionDao.crearPromocion(
          {
            id_alumno_origen: alumno.id_alumno_origen,
            id_alumno_destino: idAlumnoDestino,
            anio_origen: anioOrigen,
            anio_destino: anioDestino,
            id_grado_origen: alumno.id_grado_origen,
            id_grado_destino: idGradoDestino,
            resultado: alumno.resultado_final,
            es_override: alumno.es_override,
            motivo: alumno.motivo,
            id_usuario: idUsuario,
            id_promocion_reversa: anulada?.id_promocion || null,
            metadata,
          },
          client,
        );
        promociones.push(promocion);
        conteos[alumno.resultado_final] += 1;
        conteos.con_destino += 1;
      } else {
        const promocion = await promocionDao.crearPromocion(
          {
            id_alumno_origen: alumno.id_alumno_origen,
            id_alumno_destino: null,
            anio_origen: anioOrigen,
            anio_destino: anioDestino,
            id_grado_origen: alumno.id_grado_origen,
            id_grado_destino: null,
            resultado: alumno.resultado_final,
            es_override: alumno.es_override,
            motivo: alumno.motivo,
            id_usuario: idUsuario,
            id_promocion_reversa: anulada?.id_promocion || null,
            metadata,
          },
          client,
        );
        promociones.push(promocion);
        conteos[alumno.resultado_final] += 1;
        conteos.sin_destino += 1;
      }
    }

    return {
      anio_origen: anioOrigen,
      anio_destino: anioDestino,
      ya_confirmada: false,
      creados: promociones.length,
      promociones: promociones.map((promocion) => ({
        id_promocion: promocion.id_promocion,
        id_alumno_origen: promocion.id_alumno_origen,
        id_alumno_destino: promocion.id_alumno_destino,
        resultado: promocion.resultado,
        id_grado_destino: promocion.id_grado_destino,
      })),
      conteos,
      resumen: preview.resumen,
      preview_hash: previewHash,
    };
  });
};

const anular = async (id, { motivo, idUsuario = null }) => {
  const idPromocion = Number(id);
  if (!Number.isInteger(idPromocion) || idPromocion <= 0) {
    throw crearError("Promoción inválida.", 400, {
      codigo: "PROMOCION_INVALIDA",
    });
  }

  const motivoLimpio = String(motivo || "").trim();
  if (motivoLimpio.length < 10) {
    throw crearError(
      "El motivo de anulación debe tener al menos 10 caracteres.",
      400,
      { codigo: "MOTIVO_REQUERIDO" },
    );
  }
  if (motivoLimpio.length > 250) {
    throw crearError(
      "El motivo de anulación no puede superar los 250 caracteres.",
      400,
      { codigo: "MOTIVO_REQUERIDO" },
    );
  }

  return await conTransaccion(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `promocion_anular:${idPromocion}`,
    ]);

    const promocion = await promocionDao.findByIdForUpdate(
      idPromocion,
      client,
    );
    if (!promocion) {
      throw crearError("Promoción no encontrada.", 404, {
        codigo: "PROMOCION_NO_ENCONTRADA",
      });
    }
    if (promocion.estado !== "CONFIRMADA") {
      throw crearError(
        `Solo se anula una promoción CONFIRMADA. La promoción está ${promocion.estado}.`,
        409,
        {
          codigo: "PROMOCION_NO_CONFIRMADA",
          estado: promocion.estado,
        },
      );
    }

    let actividad = {};
    let eliminados = null;
    if (
      RESULTADOS_CON_DESTINO.has(promocion.resultado) &&
      promocion.id_alumno_destino
    ) {
      actividad = await promocionDao.contarActividadDestino(
        promocion.id_alumno_destino,
        client,
      );
      const totalActividad = Object.values(actividad).reduce(
        (total, valor) => total + aNumero(valor),
        0,
      );
      if (totalActividad > 0) {
        throw crearError(
          "No se puede anular: la matrícula destino ya tiene actividad.",
          409,
          {
            codigo: "PROMOCION_CON_ACTIVIDAD",
            actividad,
          },
        );
      }

      const becasCopiadas = Array.isArray(promocion.metadata?.becas_copiadas)
        ? promocion.metadata.becas_copiadas
        : [];
      eliminados = await promocionDao.eliminarDestino(
        {
          idAlumnoDestino: promocion.id_alumno_destino,
          idsBecas: becasCopiadas,
        },
        client,
      );
    }

    const metadataAnulacion = {
      ...(promocion.metadata || {}),
      anulacion: {
        motivo: motivoLimpio,
        fecha: new Date().toISOString(),
        id_usuario: idUsuario,
        actividad,
        eliminados,
      },
    };

    await promocionDao.actualizarAnulada(
      idPromocion,
      { metadata: metadataAnulacion },
      client,
    );

    return {
      id_promocion: idPromocion,
      estado: "ANULADA",
      motivo: motivoLimpio,
      anio_origen: promocion.anio_origen,
      anio_destino: promocion.anio_destino,
      resultado: promocion.resultado,
      actividad,
      eliminados,
    };
  });
};

const listar = async (filtros = {}) => {
  try {
    return await promocionDao.listar(filtros);
  } catch (error) {
    throw traducirError(error);
  }
};

const obtener = async (id) => {
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw crearError("Promoción inválida.", 400, {
      codigo: "PROMOCION_INVALIDA",
    });
  }
  try {
    const promocion = await promocionDao.findById(numero);
    if (!promocion) {
      throw crearError("Promoción no encontrada.", 404, {
        codigo: "PROMOCION_NO_ENCONTRADA",
      });
    }
    return promocion;
  } catch (error) {
    throw traducirError(error);
  }
};

module.exports = {
  previsualizar,
  confirmar,
  anular,
  listar,
  obtener,
  calcularPreview,
  normalizarDecisiones,
};
