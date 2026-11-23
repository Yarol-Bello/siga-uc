# 20 — Módulo de Configuración y Ajustes

**SIGA-UC — I.E.P. Unión Científica**
**Fase 0:** diagnóstico, decisiones y diseño
**Fecha:** 23/11/2026
**Commit base:** `3b7240d`
**Estado:** diseño aprobado para iniciar Fase 1. No se modificó código de negocio ni base de datos.

> Este documento es la referencia de implementación del módulo de configuración.
> Si una regla de negocio no está confirmada por el colegio, se marca como
> **provisional** y no se implementa hasta la fase que la necesite.

---

## 1. Objetivo y alcance

Digitalizar la configuración operativa del colegio para que pueda cambiar tarifas,
conceptos, cursos, competencias, jornada, becas y datos institucionales **sin editar
código**, con validaciones, vista previa y auditoría.

### 1.1 Incluido

- Tarifas y conceptos de pago por año, con alcance global, por nivel o por grado.
- Catálogo de cursos, áreas y competencias; activación/desactivación sin borrar historial.
- Carga curricular activa/inactiva por año.
- Jornada, días de clase, períodos, recesos, almuerzo y límites del generador.
- Tipos de beca, asignación, aprobación, evidencia, vigencia, tope y combinación.
- Datos institucionales, moneda, zona horaria y textos de documentos.
- Auditoría de cada cambio con valor anterior, valor nuevo y motivo.
- UI ADMIN, con lectura para SECRETARÍA si se autoriza.

### 1.2 Fuera de alcance

- Fase 8 (operación, CI, backups pagos, dominio).
- Integración oficial con SIAGIE/MINEDU.
- Multi-moneda con conversión.
- Almacenamiento de archivos de evidencia (solo referencia textual/URL).
- Cambio del stack, ORM, Docker o CI.
- Activación de 2027, datos reales o cambios en Supabase sin autorización.

---

## 2. Línea base verificada (23/11/2026)

| Verificación | Resultado | Observación |
|---|---|---|
| Repositorio | `3b7240d`, limpio | Sin cambios locales al iniciar. |
| E2E (`npm run test:e2e`) | **75 PASS, 0 FAIL** | Base desechable `siga_uc_e2e`; limpieza correcta. |
| Integridad local (`npm run test:integridad`) | **19 PASS, 2 FAIL** | Fallos 4 y 8 por datos de seed: 5 pagos sin INGRESO y 144 pensiones PAGADO sin pago. No son regresiones. |
| Integridad en base nueva | **21 PASS** | Verificado previamente con `siga_uc.sql` + `seed_produccion.sql` + migraciones. |
| Smoke (`npm run smoke`) | **11 PASS, 0 FAIL** | API local 200, `database: "ok"`. |
| H47 generador | **4 PASS** | Generador de horarios. |
| Build Angular (`npm run build`) | **OK** | Advertencia de presupuesto inicial (734.57 kB vs 500 kB); no bloquea. |
| `node --check` backend | **OK** | Todos los JS de `src`. |

**Datos locales relevantes:** 21 alumnos, 11 cursos, 54 cargas/142 h, 10 períodos
(07:30–14:30), 11 conceptos de pago (todos S/ 250), 2 becas, 0 horarios publicados.
`anios_lectivos`: 2026 ACTIVO.

---

## 3. Diagnóstico que justifica el módulo

1. **Precio único por año.** `conceptos_pago` no tiene nivel, grado, vigencia ni estado.
   Matrícula y promoción toman el primer concepto `MATRICULA` del año
   (`alumnoDao.js:284-299`, `promocionDao.js:457-468`).
2. **Beca del 100% sin efecto.** El código descuenta `monto_descuento`, no
   `porcentaje_descuento` (`tesoreriaDao.js:378,635-640`). La beca de excelencia del seed
   tiene 100% y monto 0: las pensiones siguen en S/ 250.
3. **Una sola beca por alumno.** `LIMIT 1` sin orden ni combinación; `pensiones.id_beca`
   nunca se llena en la generación.
4. **Sin tope ni monto no negativo.** `pensiones.monto_final` no tiene CHECK >= 0.
5. **Borrados peligrosos.** `cursos` cascadea calificaciones, carga, competencias y
   asistencia; `competencias` cascadea calificaciones; `conceptos_pago` cascadea pagos y
   pre-tickets (`siga_uc_completo.sql:3992,4064,4072,4104,4144,4320,4352,4423`).
6. **Días y límites en tres capas.** `config/horarios.js`, CHECK de `horarios` y
   `horario-grid`/`admin-horarios` fijan Lunes–Viernes; `HORAS_DEFAULT_CARGA` y
   `MAX_BLOQUES_CURSO_DIA` solo se cambian por entorno.
7. **Rollover frágil ante el cambio.** Usa clave `tipo|mes` y `DIAS_SEMANA = 5`
   (`rolloverService.js:21,38-44`); al agregar alcance o sábado, el preview y el hash
   deben actualizarse.
8. **Sin CRUD ni auditoría de configuración.** Los cambios se hacen por SQL; no hay
   valor anterior/nuevo ni motivo.
9. **Monto arbitrario en generación mensual.** `POST /pensiones/generar` acepta
   `monto_base`; contradice “leer la configuración”.
10. **Cargos de S/ 0 sin regla.** Una beca del 100% en matrícula o pensión no tiene flujo
    definido para pasar a `Matriculado`/`PAGADO` sin un pago.

---

## 4. Decisiones de diseño

| ID | Decisión | Estado |
|---|---|---|
| D01 | Extender las tablas existentes; no crear un módulo paralelo de conceptos, cursos o becas. | Aprobada para implementación |
| D02 | Separar configuración global (institución) de configuración por año (tarifas, jornada, oferta). | Aprobada |
| D03 | Solo ADMIN escribe. SECRETARÍA puede leer; la escritura de becas y dinero queda en ADMIN. | Provisional |
| D04 | Tarifas con alcance global, por nivel o por grado; precedencia grado > nivel > global. | Provisional |
| D05 | Cambios de precio hacia adelante; no se reprecian pagos ni cargos ya emitidos. | Provisional |
| D06 | Una tarifa con pagos/pre-tickets no se edita en sitio: se crea una nueva versión y se desactiva la anterior. | Aprobada |
| D07 | Borrado lógico (`activo=false`) para cursos, competencias, carga y conceptos. Borrado físico solo sin dependencias. | Aprobada |
| D08 | Auditoría en la misma transacción del cambio de configuración, con motivo obligatorio. | Aprobada |
| D09 | El endpoint público `/api/configuracion` solo expone datos seguros; la configuración completa exige ADMIN/SECRETARÍA. | Aprobada |
| D10 | `HORAS_DEFAULT_CARGA` y `MAX_BLOQUES_CURSO_DIA`: configuración del año > variable de entorno > default 2. | Aprobada |
| D11 | No se cambia la estructura de un horario publicado sin despublicar. | Aprobada |
| D12 | La moneda de fase 1 es PEN; no se implementa conversión. | Provisional |
| D13 | El correo remitente real sigue en `EMAIL_FROM`; la BD solo controla nombre visible y textos. | Provisional |
| D14 | La evidencia de beca es JSONB con referencia textual/URL; no se suben archivos. | Provisional |
| D15 | Si un curso/competencia tiene notas, no se renombra: se crea uno nuevo y se desactiva el anterior. | Provisional |

> **Provisional** significa que se implementa con un default reversible, pero el dueño
> debe confirmarlo antes de la fase que lo use. Ninguna regla provisional se convierte en
> un CHECK rígido que impida cambiarla después.

---

## 5. Reglas de negocio provisionales

### 5.1 Tarifas

- `monto_base > 0`.
- `PENSION` exige mes 1–12; `MATRICULA` no lleva mes; `OTROS` puede llevar mes.
- Un mismo alcance/tipo/mes no puede tener dos versiones abiertas y activas.
- `vigente_desde` y `vigente_hasta` son inclusivos. Una nueva versión cierra la anterior
  el día anterior a su inicio.
- Fecha efectiva:
  - Pensión del mes M: primer día del mes M.
  - Matrícula: fecha de emisión del pre-ticket o de la matrícula.
  - Otros: fecha de emisión.
- Si no hay tarifa para el grado/nivel, se usa la global. Si no hay global, error de
  configuración; nunca “el primer concepto”.

### 5.2 Becas

- Catálogo `tipos_beca` editable; se elimina el CHECK rígido de `becas.tipo`.
- La asignación tiene estado `SOLICITADA/APROBADA/RECHAZADA/ANULADA`.
- Solo ADMIN aprueba; SECRETARÍA puede solicitar/consultar si se autoriza.
- Cálculo: porcentaje o monto fijo, alcance matrícula/pensión/ambas, tope, prioridad y
  exclusividad/combinación.
- El descuento total nunca supera el monto base.
- No se modifican cargos pagados. Los pendientes solo se recalculan con acción explícita,
  vista previa y motivo.
- El detalle se guarda en `aplicaciones_beca`; `pensiones.id_beca` queda como beca
  principal por compatibilidad.

### 5.3 Cursos y carga

- Curso: nombre único, área del catálogo, horas semanales > 0, activo.
- Competencia: orden único por curso, activa.
- Carga: única por grado/curso/año; `activo` permite dejar de ofrecer sin borrar.
- El generador y las nuevas asignaciones usan solo carga activa.
- Reportes históricos incluyen cursos con notas aunque la carga esté inactiva.

### 5.4 Horarios

- Días, jornada, duración mínima y límites viven en `configuracion_anio`.
- Períodos dentro de la jornada, sin solapes, con fin > inicio y duración >= mínima.
- Al menos un período `CLASE` activo.
- Si hay horarios `PUBLICADO`, no se cambia la estructura sin despublicar.
- La capacidad del generador usa los días configurados, no 5.

### 5.5 Cargos de monto cero

**Pendiente de confirmación.** Opciones:

1. Estado `EXONERADO` en pensión/pre-ticket, sin pago ni boleta.
2. Pago de S/ 0 con `forma_pago = 'Exonerado'` y sin movimiento de caja.
3. Acción explícita “Matricular por exoneración” con auditoría.

No se implementa hasta la Fase 5. Mientras tanto, una beca del 100% no debe generar
montos negativos; el sistema rechazará la operación con un mensaje claro.

---

## 6. Experiencia de usuario

### 6.1 Pantallas

Ruta principal: `/admin/configuracion`.

| Pestaña | Contenido |
|---|---|
| General | Institución, RUC, dirección, contacto, logo, moneda, zona horaria, locale, textos. |
| Tarifas | Año, tipo, mes, alcance, monto, vigencia, estado, orden; crear, programar versión, desactivar, preview. |
| Académico | Áreas, cursos, competencias, horas, activación, dependencias, carga. |
| Horarios | Días, jornada, duración mínima, límites, plantilla de períodos, recesos/almuerzo. |
| Becas | Tipos, asignaciones, aprobación, evidencia, vigencia, combinación, preview. |
| Parámetros | Textos y formatos de baja criticidad; serie/numeración si se aprueba. |

La pestaña de Auditoría no se duplica: enlaza a `/admin/auditoria` filtrado por
`Configuración`.

### 6.2 Permisos

| Grupo | ADMIN | SECRETARÍA | DOCENTE | ESTUDIANTE |
|---|---|---|---|---|
| Configuración pública | Sí | Sí | Sí | Sí (sin token) |
| Configuración completa | Sí | Lectura si se autoriza | No | No |
| Tarifas | Escritura | Lectura | No | No |
| Cursos/competencias | Escritura | Lectura | GET existente | GET existente |
| Horarios/jornada | Escritura | Lectura | Lectura de su horario | Lectura de su horario |
| Becas | Escritura/aprobación | Solicitud/lectura si se autoriza | No | No |
| Auditoría | Lectura | No | No | No |

### 6.3 Patrones de UI

- Signals, `inject()`, modales con `@if` + `.modal-overlay` + `stopPropagation()`.
- Loading apagado primero en `error:`.
- Sin IDs internos visibles: nombres de grado, curso, tipo y concepto.
- Vista previa con resumen de impacto, advertencia y motivo obligatorio.
- Responsive desde el inicio (360, 768, 1366).
- No usar `alert/confirm` en el módulo nuevo; modales propios.

---

## 7. Modelo de datos

### 7.1 Reutilización

| Tabla | Cambio |
|---|---|
| `conceptos_pago` | `nivel`, `id_grado`, `activo`, `descripcion`, `orden`, `vigente_desde`, `vigente_hasta`, auditoría. |
| `becas` | `id_tipo_beca`, `alcance`, `modalidad`, `valor`, `monto_maximo`, `estado`, `motivo`, `evidencia`, `aprobado_por`, `fecha_aprobacion`, `grupo_exclusividad`, `prioridad`, auditoría. |
| `cursos` | `activo`, `orden`, `descripcion`, timestamps. |
| `competencias` | `activo`, `descripcion`, timestamps. |
| `carga_curricular` | `activo`, `observacion`, timestamps. |
| `periodos_clase` | Sin cambio; la jornada va en `configuracion_anio`. |
| `horarios` | Solo se amplía el CHECK de días si se aprueba sábado. |
| `bitacora_auditoria` | `motivo` varchar(500). |

### 7.2 Tablas nuevas

- **`configuracion_institucional`**: una fila (`id_configuracion = 1`) con datos del
  colegio, moneda, símbolo, zona horaria, locale, logo, textos y numeración de boleta.
- **`configuracion_anio`**: una fila por año con días de clase, jornada, duración mínima,
  máximo por curso/día, horas default y política de inicio de pensiones.
- **`areas_academicas`**: catálogo de áreas; `cursos.area_academica` se mantiene como
  texto validado para no romper consultas.
- **`tipos_beca`**: catálogo editable con alcance, modalidad, tope, combinación,
  exclusividad, evidencia y aprobación.
- **`aplicaciones_beca`**: detalle de cada beca aplicada a una pensión o pre-ticket.
- **`parametros_sistema`** (fase 6): clave/valor JSONB con lista blanca para textos y
  formatos; sin secretos.

### 7.3 Índices y checks clave

```sql
-- Una sola versión abierta por alcance/tipo/mes.
CREATE UNIQUE INDEX uq_concepto_base_abierto
ON conceptos_pago (anio_lectivo, tipo, mes, nivel, id_grado)
NULLS NOT DISTINCT
WHERE activo AND vigente_hasta IS NULL
  AND tipo IN ('MATRICULA', 'PENSION');

-- OTROS se distinguen por nombre.
CREATE UNIQUE INDEX uq_concepto_otros_abierto
ON conceptos_pago (anio_lectivo, nombre, nivel, id_grado)
NULLS NOT DISTINCT
WHERE activo AND vigente_hasta IS NULL
  AND tipo = 'OTROS';

-- Montos y vigencias.
CHECK (monto_base > 0);
CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde);
CHECK (tipo <> 'PENSION' OR mes BETWEEN 1 AND 12);

-- Pensión no negativa.
CHECK (monto_base > 0);
CHECK (descuento >= 0);
CHECK (monto_final >= 0);
CHECK (descuento <= monto_base);
```

### 7.4 Resolución de tarifa

1. Filtrar `activo` y fecha dentro de `[vigente_desde, vigente_hasta]`.
2. Preferir `id_grado = grado del alumno`.
3. Luego `nivel = nivel del grado`.
4. Luego `id_grado IS NULL AND nivel IS NULL` (global).
5. Si no hay fila, error de configuración.

---

## 8. Migraciones y backfill

| Migración | Contenido | Depende de |
|---|---|---|
| **H74** | `configuracion_institucional`, `configuracion_anio`, `motivo` en bitácora; seeds por defecto. | H49 |
| **H75** | Alcance/vigencia/estado en `conceptos_pago`; índices; preflight. | H74 |
| **H76** | `areas_academicas`; `activo`/orden/timestamps en cursos, competencias y carga. | H74 |
| **H77** | Días/jornada/límites; CHECK de días si se aprueba sábado. | H47, H74 |
| **H78** | `tipos_beca`, columnas de `becas`, `aplicaciones_beca`, descuento en pre-ticket. | H74, H49 |
| **H79** | `parametros_sistema` y textos/formatos. | H74 |

Todas idempotentes, con `BEGIN/COMMIT`, `to_regclass` y preflight que aborta con mensaje
claro. No editar `siga_uc_completo.sql` a mano; actualizar la secuencia de instalación y
`database/README.md`.

### 8.1 Backfill

- Conceptos: `activo=true`, `nivel=NULL`, `id_grado=NULL`,
  `vigente_desde=make_date(anio_lectivo,1,1)`, `vigente_hasta=NULL`, `orden` secuencial.
  Abortar si hay duplicados, `PENSION` sin mes o monto <= 0.
- Cursos/competencias/carga: `activo=true`; orden de competencias único; abortar si hay
  duplicados.
- Becas: crear tipos base, mapear `tipo`, conservar montos, `estado='APROBADA'` si
  `activo`; no recalcular pagos históricos.
- `aplicaciones_beca` no se reconstruye para el histórico: queda vacía y documentada.
- `configuracion_anio`: una fila por año; días Lunes–Viernes, jornada según períodos
  existentes, límites default 2.

---

## 9. Impacto por módulo

| Módulo | Cambio | Mitigación |
|---|---|---|
| Tesorería | Resolver tarifa por alumno/grado/fecha; validar concepto del alumno; no aceptar montos arbitrarios. | Pruebas con dos grados, nivel y global. |
| Matrícula | Pre-ticket con tarifa del grado; beca de matrícula. | Probar primaria/secundaria y 100%. |
| Pensiones | Generación con `LATERAL` y precedencia; `id_beca` + `aplicaciones_beca`; checks. | Probar 100%, 50%, fijo, tope y combinación. |
| Promoción | Matrícula destino por grado; becas con nuevos campos; hash. | Actualizar tests 39–58. |
| Rollover | Copiar alcance/vigencia y mapear grado; `configuracion_anio`; días reales. | Actualizar clave, hash y reversión. |
| Horarios | Días/jornada/límites; generador; publicados. | Reutilizar editor de períodos; pruebas H47. |
| Carga | `activo`; filtros; bloqueo de borrado. | Reportes históricos conservan cursos con notas. |
| Reportes/SIAGIE | Cursos inactivos no desaparecen del histórico; dashboard cuenta activos. | Definir “activo” vs “con notas”. |
| Auditoría | Módulo `Configuración`, motivo, antes/después. | Reutilizar visor. |
| Frontend | Rutas, pestañas, servicios, responsive. | No tocar el responsive pausado fuera del módulo. |
| Tests | Nuevos E2E, integridad, smoke, H47. | Ajustar fixtures de conceptos duplicados. |

---

## 10. Fases

| Fase | Alcance | Depende de | Riesgo | Esfuerzo |
|---|---|---|---|---|
| 0 | Diagnóstico, decisiones, línea base. | — | Bajo | 2–3 días |
| 1 | Núcleo global/año, auditoría, UI General. | 0 | Medio | 5–7 días |
| 2 | Tarifas, resolución, matrícula/pensiones/promoción, preview. | 1 | Alto | 8–12 días |
| 3 | Cursos, áreas, competencias, carga, rollover. | 1 | Medio-alto | 5–7 días |
| 4 | Jornada, días, límites, generador. | 1, 3 | Medio | 5–7 días |
| 5 | Becas, aprobación, aplicación, combinación. | 1, 2 | Alto | 10–14 días |
| 6 | Textos, PDF, correo. | 1 | Bajo-medio | 3–4 días |
| 7 | Pruebas, documentación y despliegue. | Todas | Medio | 4–6 días |

**MVP recomendado:** fases 0–2 + 7.

---

## 11. Criterios de aceptación y pruebas

### Fase 0

- Documento aprobado; inventario validado; línea base registrada.
- Sin cambios de código de negocio ni BD.

### Fase 1

- H74 idempotente; una fila global; una fila por año.
- `GET /api/configuracion` mantiene `anio_lectivo` y agrega datos públicos seguros.
- `GET /api/configuracion/admin` ADMIN/SECRETARÍA; `PUT` solo ADMIN.
- Validaciones de correo, moneda, zona horaria, locale, RUC y longitudes.
- Auditoría transaccional con motivo.
- Si H74 no está aplicada: `503 CONFIG_NO_APLICADA` en admin y fallback público.
- UI responsive; guarda, recarga y muestra errores inline.
- Smoke/E2E/build verdes.

### Fase 2

- Tarifas global/nivel/grado; precedencia y vigencia.
- Duplicados 409; monto <= 0, mes inválido 400.
- Preview con hash; confirm viejo 409.
- Pagos y cargos pagados intactos.
- Matrícula, pensión y promoción usan la tarifa correcta.
- Rollover copia alcance/vigencia sin colisión.
- E2E con dos grados y tarifa global/nivel.

### Fase 3

- CRUD de áreas, cursos y competencias con auditoría.
- Desactivar sin borrar; borrado con dependencias 409.
- Carga activa/inactiva; generador solo activas.
- Rollover e históricos correctos.

### Fase 4

- Días/jornada/límites configurables; 07:00–18:00 sin código.
- Validación de solapes, duración mínima, jornada y recesos.
- Generador usa días reales; publicados protegidos.
- H47 4 PASS + nuevas pruebas.

### Fase 5

- Catálogo de tipos; asignación/aprobación/evidencia.
- 100% -> 0 según regla aprobada; 50%, fijo, tope y combinación.
- `aplicaciones_beca`; sin montos negativos; pagos intactos.
- Promoción copia becas y hash.

### Fase 6

- PDFs/correos usan nombre, moneda, zona horaria y textos configurados.
- Sin “I.E.P. UNIÓN CIENTÍFICA”, “S/” ni “© 2026” fijos en servicios.
- Correo real sigue en entorno.

### Fase 7

- E2E >= 75 + nuevos; integridad >= 21 + nuevos; smoke >= 11 + nuevos; H47.
- Build y `node --check`.
- Documentación y AGENTS actualizados.
- Backup; Supabase solo con autorización; 2026 activo; 2027 no se activa.

---

## 12. Riesgos

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Repreciar cargos históricos | Alto | Pagos/pensiones/pre-tickets conservan monto; no update retroactivo. |
| Borrado en cascada | Alto | Soft delete; bloqueo con dependencias; tests. |
| Beca 100% sin flujo | Alto | Definir regla antes de Fase 5; rechazar montos negativos. |
| Rollover con clave incompleta | Alto | Incluir alcance/vigencia y mapear grado; tests de preview/hash. |
| Tests E2E con conceptos duplicados | Medio | Ajustar fixtures antes de H75. |
| Cambio de jornada con horarios publicados | Medio | Bloquear estructura hasta despublicar; preview. |
| Moneda distinta a PEN | Medio | Fase 1 solo PEN; documentar. |
| Evidencia sin storage | Medio | JSONB con referencia; no prometer archivos. |
| SECRETARÍA con acceso indebido | Medio | Lectura limitada; escritura solo ADMIN. |

---

## 13. Preguntas pendientes del colegio

1. ¿Precios solo para años nuevos o también dentro del año? ¿Qué pasa con cargos
   pendientes ya generados?
2. ¿Matrícula y pensión varían por nivel, grado o sección? ¿Qué niveles y conceptos hay?
3. ¿Qué becas existen, quién las aprueba y cómo se combinan? ¿Tope? ¿Matrícula, pensión o
   ambas?
4. ¿Qué pasa con pagos ya realizados si cambia un precio?
5. ¿Jornada exacta, días, duración, recesos, almuerzo, sábado y máximos?
6. ¿Cursos/áreas los administra ADMIN o SECRETARÍA? ¿Se renombran cursos con notas?
7. ¿SECRETARÍA lee configuración? ¿Aprobación de dos personas para dinero?
8. ¿Basta auditoría o se necesitan versiones históricas completas?
9. ¿Moneda solo PEN? ¿Correo remitente editable o fijo por despliegue?
10. ¿Bimestres 1–4 fijos o configurables?
11. ¿Evidencia de beca textual/URL o archivos?
12. ¿Formas de pago configurables?
13. ¿Borrado físico permitido sin dependencias?
14. ¿El rollover copia tarifas, jornada y becas?

---

## 14. Registro de cambios

| Fecha | Cambio | Autor |
|---|---|---|
| 23/11/2026 | Fase 0: documento de diseño, decisiones, línea base y plan de fases. | Sesión de código |
