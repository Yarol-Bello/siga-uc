# 18 — Auditoría de preparación para producción (2026-11-22)

> **Sesión de solo lectura.** No se corrigió código, no se aplicaron migraciones y no se
> escribió en Supabase ni en Render. El único artefacto de esta sesión es este informe.
>
> **Alcance real de la lectura:** se revisó el código local, la base local `siga_uc`, una
> base desechable creada desde `siga_uc.sql` + `seed_produccion.sql` + migraciones, la UI
> local en Chrome y la UI/API desplegadas en Render. Los inicios de sesión de navegador en
> local actualizaron `ultimo_login` y agregaron eventos `LOGIN` en la bitácora local, como
> cualquier login; no se editó ningún dato de negocio. Los flujos de escritura se probaron
> en la base desechable de `test:e2e`, no en `siga_uc` ni en producción.
>
> **Código desplegado:** `64a90dc` (según el contexto y `HANDOFF_SESSION.md`). **HEAD local:**
> `156be38`; los commits posteriores a `64a90dc` solo tocan documentación/limpieza.
>
> **Definiciones usadas:** P0 = un flujo principal no se puede completar o entrega un
> resultado incorrecto con impacto operativo/financiero; P1 = la UI promete una acción que
> no existe o muestra información engañosa; P2 = cosmético, texto de relleno, deuda técnica
> menor o higiene operativa.
>
> **Actualización 22/11/2026:** **H50** (caja efectivo/digital) y **H63** (PDF de actas
> ADMIN-only) se corrigieron en `2449cf3`; **H48** (actas reales), **H51** (libretas por
> bimestre), H49/H73 (multi-año/promoción), H59/H62/H65–H69 (Fase 7), **H70** (Resend sin
> SMTP/Nodemailer) y **H71** (backfill de retirados) se cerraron después. **H05/H52** se
> resolvieron en el cierre de demo: SIAGIE es una **exportación interna** honesta, sin
> portal MINEDU, análisis simulado ni carga de plantilla. `test:e2e` pasó a **75 PASS**;
> ver `HANDOFF_SESSION.md` y `15-HALLAZGOS-RIESGOS-Y-MEJORAS.md`.

---

## 1. Resumen ejecutivo

**No está listo para producción real.** La demo actual se puede mostrar, pero hay tres
bloqueos que deben resolverse antes de cargar datos reales:

1. **El cierre de actas no se puede ejecutar** en una instalación nueva y, en la demo
   local, las actas existentes son globales y no bloquean las notas. Es una regresión
   funcional de **H06**.
2. **El cuadre de caja es incorrecto si se usan Yape/transferencia**: el efectivo esperado
   suma ingresos digitales como si fueran físicos y descuenta egresos digitales del cajón.
3. **No existe rollover anual**: el seed crea grados, conceptos, carga y períodos con el
   año calendario, no con `ANIO_LECTIVO`, y no hay UI ni script para preparar 2027. Una
   instalación hecha en diciembre de 2026 para el año 2027 queda sin estructura académica.

Además, hay hallazgos P1 de UI engañosa (SIAGIE simulado, libretas fijas al II Bimestre,
botones "próximamente" en paneles de docente/secretaría, carné QR de personal que no es un
QR) y un IDOR de PDF de actas para DOCENTE.

**Resultado de pruebas:** `smoke` 11 PASS; `test:e2e` 14 PASS; `test:h47-generador` 4 PASS;
`test:integridad` 8 PASS/2 FAIL en la demo local (datos conocidos de H41) y **10 PASS** en
una base nueva de producción. El detalle está en la sección 9.

---

## 2. Hallazgos nuevos (H48–H72)

### 2.1 Tabla maestra

| ID | Sev. | Módulo | Título | Evidencia (archivo:línea) | Impacto | Recomendación | Esf. |
|---|---|---|---|---|---|---|---|
| **H48** | **P0** | Auditoría / Actas | Cierre de acta inalcanzable e inefectivo (regresión H06) | `siga-uc-backend/src/dao/auditoriaDao.js:238-257` (solo `UPDATE`); `:373-399` (ignora actas globales); `siga-uc-frontend/src/app/features/admin/auditoria/admin-auditoria.component.html:208-229` (solo lista y cierra filas existentes); `database/seed_produccion.sql` no inserta actas; `database/siga_uc_completo.sql:2097-2098` | En una base nueva no hay actas y no hay forma de crearlas; en la demo local las 2 actas son globales y `actaEstaCerrada` las ignora, por lo que las notas se siguen pudiendo editar. El módulo "Cierre y Firmado" es decorativo. | Crear/upsert de acta por período+grado+año al cerrar; decidir si las actas globales bloquean o migrarlas a por grado; probar con seed de producción vacío. | M |
| **H49** | **P0** | Configuración / Año lectivo | Sin rollover anual; el seed usa el año calendario | `database/seed_produccion.sql:74-84` (grados), `:160-181` (conceptos), `:225-250` (carga), `:255-276` (períodos) usan `CURRENT_DATE`; `siga-uc-backend/src/routes/academicoRoutes.js:18-31` solo GET; `tesoreriaRoutes.js:22` solo GET de conceptos; no existe script/UI de rollover; `admin-reportes.component.ts:75` y `:174-180` solo usan el año activo | Una instalación para 2027 hecha en 2026 crea grados/conceptos/carga/períodos de 2026. `GET /grados?anio=2027` y `GET /tesoreria/conceptos?anio=2027` devuelven vacío; no se puede matricular, generar pensiones ni programar horarios. Tampoco hay selector de año en reportes/libretas para consultar el histórico. | Parameterizar el seed con `-v anio_lectivo` o `ANIO_LECTIVO`; agregar script `npm run nuevo-anio` o pantalla ADMIN para clonar grados/conceptos/carga/períodos; agregar selector de año en reportes. | M |
| **H50** | **P0** | Caja / Tesorería | El efectivo esperado incluye pagos digitales y egresos digitales | `cajaDao.js:21-24` suma todo `INGRESO` sin mirar `medio_pago`; `siga-uc-frontend/.../secretaria-caja.component.ts:326-333` usa `total_ingresos` para "Efectivo Físico en Cajón"; `secretaria-caja.component.html:73-77` y `:406-408`; `cajaDao.js:271-288` sí separa efectivo/digital al cerrar; `cajaDao.js:275` suma todo `EGRESO`; `tesoreriaDao.js:319-329` crea el EGRESO de anulación con el mismo medio | Con un cobro Yape/transferencia, la UI muestra más efectivo del que hay en el cajón; al cerrar, el sistema puede declarar FALTANTE/sobrante falso. Una anulación digital también reduce el efectivo esperado. Riesgo financiero directo. | Devolver en `/caja/actual` `total_ingresos_efectivo`, `total_ingresos_digital`, `total_egresos_efectivo`, `total_egresos_digital`; calcular el efectivo solo con medios físicos; registrar el egreso digital por separado y reflejarlo en el cierre. | S/M |
| **H51** | P1 | Reportes / Libretas | Las libretas quedan fijas en el II Bimestre | `admin-reportes.component.ts:87` (`bimestre = signal(2)`); `admin-reportes.component.html:26-36` oculta el selector cuando `tabActiva() === 'libretas'`; `:253` y `:284` envían `this.bimestre()` a la libreta y al PDF | El ADMIN no puede ver ni descargar libretas de I, III o IV bimestre; el encabezado dice "2° Bimestre" sin control para cambiarlo. Verificado en navegador: solo hay selector de grado. | Mostrar el selector de bimestre en todas las pestañas o dentro de la pestaña de libretas; inicializarlo en el bimestre actual. | S |
| **H52** | P1 | SIAGIE | "Abrir Portal MINEDU" y el análisis de plantilla son simulados | `admin-siagie.component.ts:130-137` solo muestra un `alert` y no abre ni descarga nada; `:139-148` marca `analisisCompletado=true` con `setTimeout(800)` sin leer el archivo; `admin-siagie.component.html:22-24` y `:92-99` | El ADMIN cree que descargó la plantilla y que el sistema mapeó las columnas. Probado con un archivo de 18 bytes que no era Excel: mostró "Análisis Dinámico Exitoso... Columnas mapeadas correctamente". El Excel posterior no tiene garantía de estar bien mapeado (o falla al procesar el archivo). Se suma al límite conocido H05 (4 cursos/primera hoja). | Abrir la URL real del MINEDU o incluir la plantilla; validar y analizar el `.xlsx` con ExcelJS antes de mostrar éxito; mostrar hojas/columnas detectadas y errores reales. | M |
| **H53** | P1 | Docente | "Asistencia" y "Notas" del panel solo muestran un alert "próximamente" | `docente-dashboard.component.ts:92-107`; `docente-dashboard.component.html:61-66`; las rutas `/docente/asistencia` y `/docente/notas` existen y funcionan | El docente no puede iniciar la tarea desde el panel; se le dice que el módulo no existe cuando sí existe. Es una UI engañosa y un callejón sin salida. | Navegar a `/docente/asistencia` o `/docente/notas` pasando el `id_carga`, o quitar los botones y dejar el menú. | S |
| **H54** | P1 | Secretaría | "Cobrar" un pre-ticket en el panel solo muestra un alert | `secretaria-dashboard.component.ts:77-79`; `secretaria-dashboard.component.html:88-90` | La acción principal de la bandeja de matrículas pendientes no cobra nada; obliga a ir manualmente a Tesorería. En la demo se probó y mostró "Cobro del pre-ticket 1 próximamente". | Navegar a `/secretaria/tesoreria` con el alumno/pre-ticket preseleccionado o reutilizar `cobrarPreticket` de tesorería. | S |
| **H55** | P1 | Personal | El carné QR del personal muestra un icono, no un QR escaneable | `admin-personal.component.html:450` (`<i class="fa-solid fa-qrcode">`); `:456` imprime; el componente no importa `qrcode` ni lee `credencial_qr`; verificado en navegador: 0 `canvas`, 0 `img`, 0 `svg` en el modal | La credencial impresa no se puede escanear; el módulo de asistencia QR no puede usar ese carné. Parece una credencial real y no lo es. | Generar el QR con `qrcode.toDataURL(codigo_qr)` desde `/auth/perfil` o desde un endpoint de credencial; reutilizar el modal del header que sí genera QR real. | S |
| **H56** | P1 | Asistencia / Reportes | La asistencia no filtra por año lectivo | `reporteDao.js:137-150` (libreta: `WHERE id_alumno = $1`, sin año); `asistenciaDao.js:115-176` (resumen/estadísticas del alumno sin año); `estudiante-asistencia.component.ts:93`; `docente-ficha.component.ts:112` y `:146` | A partir de 2027, la libreta y "Mi Asistencia" suman registros de 2026; los porcentajes y el historial quedan contaminados. Es distinto del H13 conocido (resumen por grado). | Agregar `AND EXTRACT(YEAR FROM asis.fecha) = $anio` (o una columna `anio_lectivo`) en todas las consultas de asistencia y enviar `?anio=` desde la UI. | S/M |
| **H57** | P1 | Estudiante | El panel del estudiante muestra un grado fijo, felicita sin datos y confunde "cursos con notas" con "cursos matriculados" | `sidebar-estudiante.component.html:26` ("3ro de Secundaria" fijo); `estudiante-dashboard.component.html:21` (texto fijo "Vas por un excelente rendimiento..."); `:29-30` (`cursos().length`); verificado con alumno de 2do: el sidebar dice "3ro" y el horario dice "2do de Secundaria"; con 0 notas muestra "Cursos Matriculados 0" | Información académica falsa para el alumno/apoderado; el grado y el conteo no corresponden a su matrícula. | Tomar `nombre_grado` y el número de cursos de la matrícula/carga, no de las notas; condicionar el mensaje de felicitación a que existan notas; mostrar "Cursos con notas" si se mantiene el dato. | S |
| **H58** | P2 | UI / Exportaciones | "Descargar PDF"/"Exportar PDF"/"Imprimir" usan `window.print()` y no aíslan el documento | `admin-reportes.component.html:40-41`; `docente-reportes.component.html:34-35`; `secretaria-caja.component.html:484` y `:488-489`; `admin-personal.component.html:456`; `header.component.ts:159-160`; solo `horario-grid` y `admin-horarios` tienen `@media print` | Se imprime toda la interfaz (sidebar/header) en lugar del acta, boleta o reporte; el usuario espera un archivo PDF y recibe el diálogo de impresión. | Agregar CSS `@media print` por documento o generar el PDF en backend; renombrar a "Imprimir" cuando sea intencional. | S |
| **H59** | P2 | Alumnos / Personal | Campos de formulario que se descartan en silencio | `admin-alumnos.component.ts:230-236` exige correo del apoderado, pero `:251` envía el apoderado solo si tiene `nombres`; `admin-personal.component.html:358-359` textarea de Observaciones sin `ngModel`; `admin-personal.component.ts:326-327` no envía observaciones | El usuario completa un dato obligatorio o una observación y el sistema lo pierde sin avisar. En el cese, la observación nunca se guarda. | Validar nombres del apoderado si se exige su correo; bindear y persistir observaciones o quitar el campo. | S |
| **H60** | P2 | Docente / Asistencia | Una observación sin estado de asistencia no se guarda | `docente-asistencia.component.ts:152-157` crea el cambio con `estado: getEstado(...)` (puede ser `''`); `:233` solo agrega registros con `cambio.estado` | El docente escribe "Justificado por dirección" sin marcar P/T/F; al guardar y recargar, la observación desaparece. | Exigir estado cuando hay observación o guardar la observación con estado por defecto; mostrar validación. | S |
| **H61** | P2 | Asistencia (regresión H39) | El día de la semana se guarda desfasado y se muestra en inglés | `docente-asistencia.component.ts:227` usa `new Date('YYYY-MM-DD').getDay()`; `new Date('2026-11-23')` en `America/Lima` devuelve domingo, no lunes; `asistenciaDao.js:93` usa `TO_CHAR(fecha,'Day')`; verificado en navegador: "Tuesday" en una UI en español | El campo `dia_semana` almacenado es incorrecto para todas las asistencias creadas desde la UI; los reportes que lo usen fallarán. El historial muestra días en inglés. Es una regresión de H39. | Parsear la fecha como local (`new Date(y, m-1, d)`) o derivar el día en backend; usar el `dia_semana` almacenado o `TO_CHAR` con locale `es_PE`/una tabla de días. | S |
| **H62** | P2 | Seguridad / Notificaciones | Un DOCENTE puede enviar una notificación a cualquier usuario | `notificacionRoutes.js:35-39` permite `ADMIN` y `DOCENTE` en `POST /notificaciones`; `notificacionService.js:30-48` acepta `id_usuario_destino` sin validar pertenencia; no hay UI de envío para docente, es una vía solo API | Un docente con token puede enviar mensajes internos y correos a cualquier usuario (incluido ADMIN u otro docente), con riesgo de spam/phishing. En producción con Resend real el correo sale a la dirección personal. | Restringir DOCENTE a sus alumnos/cursos o quitar DOCENTE del envío individual; validar destino y limitar tasa. | S |
| **H63** | P1 | Seguridad / Auditoría | IDOR en el PDF de actas para DOCENTE | `auditoriaRoutes.js:18-23` permite `ADMIN` y `DOCENTE`; `auditoriaController.js:92-124` usa `req.params.id_acta` sin ownership; `auditoriaService.js:68-105` devuelve cualquier acta, incluida una global con todos los grados; no se aplica `checkGradoDocente` | Cualquier docente puede descargar el acta de cualquier grado/año (nombres, notas y PDF de menores) enumerando IDs. La UI de actas es solo ADMIN, así que es una exposición API. | Restringir el PDF a ADMIN o aplicar `checkGradoDocente` usando `acta.id_grado`; si el acta es global, no exponerla a DOCENTE. | S |
| **H64** | P2 | Despliegue | Las rutas profundas del frontend responden HTTP 404 | `https://siga-uc-web.onrender.com/` → 200; `/login` y `/admin` → 404 (el SPA igual renderiza por `404.html`); `siga-uc-frontend/package.json` crea `404.html`; no hay rewrite documentado/configurado en Render | Monitoreo, crawlers y algunos clientes ven 404 en enlaces válidos; un refresh de una ruta interna queda como error HTTP aunque el usuario vea la página. | Configurar rewrite `/* → /index.html` con 200 en Render (o regla equivalente) y conservar 404.html solo para rutas desconocidas. | S |
| **H65** | P2 | Dashboards | KPIs y etiquetas inexactas | `reporteDao.js:16` cuenta todo `personal` con `fecha_cese NULL`; `dashboard.component.html:43` lo llama "Plana Docente" (en local mostró 7 fichas activas, no solo docentes); `reporteDao.js:15` solo cuenta `Matriculado` bajo "Total Estudiantes"; `secretaria-dashboard.component.ts:55` filtra "Pagos Registrados" por mes pero la etiqueta no lo dice | El director toma decisiones con cifras que no significan lo que la etiqueta dice. | Contar docentes con `id_rol=2`, separar "personal activo"; renombrar "Estudiantes matriculados" y "Pagos del mes". | S |
| **H66** | P2 | Dashboard | El panel "Alertas de Asistencia y Expedientes" no tiene alertas de asistencia | `dashboard.component.html:73-95`: solo dos filas fijas (pre-tickets y retirados); `:77` muestra "Filtro Automático" sin control ni cálculo de asistencia | El título promete alertas de asistencia que no existen; el badge sugiere un filtro inexistente. | Calcular alumnos con faltas/tardanzas (usando el resumen existente) o renombrar el panel a "Cobranza y expedientes". | S/M |
| **H67** | P2 | Varios | Fuentes de verdad hardcodeadas | `admin-alumnos.component.html:13-17` filtro de grados 1–5 fijo, aunque `grados()` viene de la API; `admin-carga-curricular.component.html:10` "los 11 cursos oficiales" fijo | Si cambian IDs, secciones o cursos, el filtro y el texto mienten. Es una segunda fuente de verdad. | Usar `grados()` para el filtro y `cursos().length` para el texto. | S |
| **H68** | P2 | Auditoría / Actas | "Firma digital" sobre un hash MD5 | `admin-auditoria.component.ts:305-306` y `:321` dicen "firmar digitalmente"; `auditoriaController.js:148`; `auditoriaDao.js:245` usa `MD5(...)` | Un hash MD5 no es una firma digital ni garantiza no repudio; el mensaje puede inducir a error legal/auditor. | Renombrar a "hash de integridad" y "cierre"; si se exige firma, implementar PKI/firma externa. | S |
| **H69** | P2 | Textos / Navegación | Etiquetas y pantallas no productivas | `secretaria-layout.component.html:5` "Facturación"; `admin-personal.component.html:195,288` "Correo Institucional (Decorativo)"; `index.html:2,5` `lang="en"` y título `SigaUcFrontend`; `secretaria-dashboard.component.html:82` DNI fijo "-"; `admin-layout.component.html:8` título fijo "Resumen Ejecutivo" en todos los módulos; `en-construccion.component.html:15-16,38-40` dice que Docente/Estudiante/Secretaría están en desarrollo; `login.component.ts:154-157` promete correo en modo prueba | La UI se ve de demo, no de producción; el título de página no identifica al colegio; "Facturación" sugiere SUNAT cuando las boletas son internas; el DNI de la bandeja es siempre "-"; un usuario real puede llegar a `/en-construccion` y ver información falsa. | Cambiar a "Boletas internas"/"Tesorería"; ocultar el campo institucional o etiquetarlo como referencia; `lang="es"` y título "SIGA-UC — I.E.P. Unión Científica"; usar el DNI real o quitar la columna; títulos por ruta; eliminar `/en-construccion`; advertir el modo prueba en recuperación. | S |
| **H70** | P2 | Observabilidad / Higiene | Logs heredados y PII en consola | `login.component.ts:65` imprime el objeto `usuario` completo; `app.js:267-276` registra "SMTP verificado" después de verificar Resend; `siga-uc-backend/package.json` mantiene `nodemailer` sin uso | Ruido y PII en consola del navegador; un operador puede creer que el correo es SMTP; dependencia innecesaria. | Loguear solo rol/ID; cambiar el mensaje a "Resend configurado"; quitar `nodemailer` y las variables SMTP del ejemplo (H27). | S |
| **H71** | P2 | Integridad / Datos | Un alumno retirado de la demo conserva usuario activo y expediente abierto | `database/siga_uc_completo.sql:2123` crea al alumno 14 como `Retirado`; `:2460` deja `congelado=false`; el usuario 20 sigue `ACTIVO`; `alumnoDao.js:426` solo congela en retiros nuevos | El alumno retirado puede iniciar sesión y acceder; contradice H19. En una base migrada desde antes de H19, todos los retirados históricos quedan así. No hay backfill ni invariante que lo detecte. | Migración/backfill `Retirado ⇒ usuarios.INACTIVO + expediente.congelado=TRUE`; agregar invariante al test de integridad; limpiar el dump demo. | S |
| **H72** | P2 | Navegación | `**` manda al login e ignora `returnUrl` | `app.routes.ts:277`; `auth.guard.ts:18` guarda `returnUrl`; `login.component.ts:73-90` siempre navega por rol | Un usuario autenticado que escribe mal una URL termina en el login; el `returnUrl` nunca se usa. No hay página 404 propia. | Crear `NotFoundComponent` o redirigir al dashboard del rol; usar `returnUrl` si existe. | S |

### 2.2 Detalle de los P0

#### H48 — Cierre de acta: el módulo no puede crear actas y las globales no bloquean

- `auditoriaDao.cerrarActa` es un `UPDATE actas_bimestrales ... WHERE periodo = $2 AND anio_lectivo = $3 AND id_grado IS NOT DISTINCT FROM $4`.
  No hay `INSERT`: si no existe la fila, `RETURNING *` no devuelve nada y el servicio
  devuelve `null`; el controlador intenta leer `data.periodo` y responde 500.
- `seed_produccion.sql` no inserta ninguna acta. Verificado en una base desechable:
  `SELECT COUNT(*) FROM actas_bimestrales` → **0**.
- `siga_uc_completo.sql` solo inserta dos actas globales (`id_grado = NULL`) ya `CERRADO`
  (líneas 2097-2098). La UI las muestra como "Todos los grados" y "Acta Firmada"; no hay
  botón para crear una por grado.
- `actaEstaCerrada` tiene el comentario explícito "Las actas globales (id_grado NULL) se
  ignoran por decisión de negocio" (`auditoriaDao.js:373-399`). Por eso, en la demo, el
  ADMIN ve "Acta Firmada" en 1er y 2do Bimestre pero `guardarCalificaciones` no encuentra
  un acta cerrada para el grado y permite editar.
- El `test:e2e` pasa la prueba 14 solo porque **inserta el acta por SQL** en
  `scripts/test-e2e.js:1242-1252`; la aplicación real no tiene ese paso.
- Verificación en navegador: en local, la pestaña "Cierre y Firmado de Actas" muestra las
  dos actas globales `CERRADO`; en una base nueva no muestra ninguna y no ofrece acción de
  creación.

**Por qué es P0:** el cierre de acta es el mecanismo que impide alterar notas después del
bimestre. Hoy no se puede crear y, cuando existe global, no bloquea. Es una regresión de
H06.

#### H49 — Rollover anual: 2027 no se puede preparar sin SQL

- `seed_produccion.sql` usa `EXTRACT(YEAR FROM CURRENT_DATE)` para grados, conceptos,
  carga y períodos. No lee `ANIO_LECTIVO`.
- `academicoRoutes.js` solo tiene GET para grados/cursos; `tesoreriaRoutes.js` solo GET
  para conceptos. No hay endpoint de creación de grados, secciones, conceptos ni carga
  masiva por año.
- No existe script `nuevo-anio`/`rollover` ni migración de clonado. Una búsqueda de
  `nuevo.anio|rollover|clonar` no devuelve nada.
- El frontend no tiene selector de año en reportes/libretas; `admin-reportes` usa
  exclusivamente `anioLectivo()`. Después de 2026, las libretas de 2026 no se pueden
  consultar desde la UI.
- Verificación: base nueva con `siga_uc.sql` + `seed_produccion.sql` en noviembre de 2026
  crea 5 grados, 11 conceptos, 10 períodos y 55 cargas, todos de 2026. Si `ANIO_LECTIVO`
  fuera 2027, la UI de matrícula, tesorería y horarios no encontraría grados/conceptos.

**Por qué es P0:** la instalación de producción para el año siguiente no se puede hacer
sin escribir SQL a mano; no es un detalle cosmético.

#### H50 — Caja: el efectivo esperado no distingue medio de pago

- `cajaDao.obtenerCajaAbierta` devuelve `total_ingresos` como `SUM(monto)` de todos los
  `INGRESO`, sin filtrar `medio_pago`.
- La UI calcula `efectivoEsperado = monto_inicial + total_ingresos - total_egresos` y lo
  rotula "Efectivo Físico en Cajón" y "Efectivo Físico Esperado".
- El cierre del backend sí distingue: `ingresos_efectivo` (solo `medio_pago = 'Efectivo'`),
  `ingresos_digital`, y calcula `efectivo_esperado` solo con efectivo. La UI, entonces,
  muestra un número distinto al que usará el cierre.
- `anularPago` inserta un `EGRESO` con el mismo `medio_pago` del ingreso; `cerrar` suma
  todos los `EGRESO` como si fueran efectivo. Una anulación de Yape reduce el efectivo
  esperado del cajón.
- En local todos los pagos son `Efectivo` (11 pagos), por eso no se ve el error; el bug se
  activa con Yape/Interbank, que la UI ofrece.

**Por qué es P0:** el arqueo de caja puede cerrar con faltante/sobrante falso. Es un riesgo
financiero y de confianza en el módulo de tesorería.

### 2.3 Detalle de los P1 más importantes

- **H51:** verificado en navegador: en "Libretas Informativas" solo hay un `<select>` de
  grado; el encabezado dice "2° Bimestre" y no hay forma de cambiarlo. Las pestañas de
  mérito/riesgo sí muestran el selector.
- **H52:** verificado en navegador con un archivo falso de 18 bytes: el botón "Abrir Portal
  MINEDU" solo lanzó un `alert`; al subir el archivo, a los 800 ms apareció "Análisis
  Dinámico Exitoso ... 4 Estudiantes | 11 Asignaturas | Columnas mapeadas correctamente".
  No se abrió ninguna pestaña ni se descargó nada.
- **H55:** verificado en navegador: el modal "Credencial Digital Institucional" no contiene
  `canvas`, `img` ni `svg`; solo el icono FontAwesome `fa-qrcode`. El QR del header sí es
  real (generado con `qrcode`).
- **H57:** verificado con el alumno `74829103` (2do de Secundaria): el sidebar dice "3ro de
  Secundaria"; el módulo de horario dice "2do de Secundaria Única"; el panel muestra
  "Cursos Matriculados 0" y el texto "Vas por un excelente rendimiento académico".
- **H63:** la ruta se registra antes del `router.use(checkRole(["ADMIN"]))` y el servicio
  no recibe el `id_personal` del token. Un DOCENTE con el ID de otra acta puede descargar
  el PDF completo.

---

## 3. Matriz de preparación por módulo

| Módulo | Estado | Motivo | Evidencia / nota |
|---|---|---|---|
| Autenticación, sesión y contraseñas | 🟢 | Login JWT, roles, bloqueo por cambio obligatorio, rate limit y resets auditados. Recuperación limitada por Resend en modo prueba (aceptado). | Smoke 4/10; H03/H18/H43; `authMiddleware.js`; `rateLimit.js` |
| Alumnos y matrícula | 🟡 | Alta, edición, retiro y matrícula funcionan; el E2E crea alumno, usuario, expediente y QR. Detalles: filtro de grados hardcodeado, apoderado que se descarta si no tiene nombres, correo institucional ficticio mostrado en el alta. | E2E 3/4; H59/H67; `admin-alumnos` |
| Personal y usuarios | 🟡 | CRUD, cese, reactivación y reset funcionan. Detalles: carné QR placeholder, observaciones de cese no guardadas, etiqueta "Decorativo". | H55/H59/H69 |
| Carga curricular | 🟡 | Asignación y tutor funcionan; H47 reasigna bloques al cambiar docente. En una base nueva, las 55 cargas quedan en el ADMIN hasta reasignarlas. Texto "11 cursos" fijo. | H67; seed producción verificado |
| Horarios | 🟡 | H47 está sólido: generador 4 PASS, publicación, bloqueos y grid por rol. En local hay 0 bloques y 54 cargas en ADMIN, por lo que no se puede generar sin reasignar; en la demo Supabase hay 145 publicados (según contexto). Sin rollover anual. | `test:h47-generador` 4 PASS; H49 |
| Asistencia QR de personal | 🟢 | Marcación por DNI simulado (aceptado), estados P/T/F y resumen diario. La palabra "automático" es cosmética. | `admin-asistencia-qr`; verificado |
| Asistencia de alumnos | 🟡 | Carga por curso/fecha y guardado masivo con errores; H11. Detalles: año no filtrado en resúmenes, día desfasado/inglés, observación sin estado se pierde. | H56/H60/H61; `docente-asistencia` |
| Calificaciones | 🟡 | Registro individual/masivo, nota final automática y bloqueo por acta (cuando existe acta por grado). El cierre de acta está roto (H48); conclusiones sin CRUD (H33). | E2E 9/10/14; H48/H33 |
| Tesorería y pensiones | 🟡 | Pago, boleta, generación de pensiones, anulación y doble pago protegidos; E2E 5-8. Detalles: N+1 (una petición por alumno; 21 alumnos), sin alta manual de pre-tickets ni UI de becas, y el efectivo de caja mal calculado (H50). | E2E 5-8; H22/H50 |
| Caja | 🔴 | Con efectivo funciona; con Yape/transferencia el efectivo esperado es incorrecto y el cierre puede declarar faltante/sobrante falso. | H50; `cajaDao.js`; `secretaria-caja` |
| Reportes y libretas | 🟡 | PDF real de libreta, boleta y acta; smoke/E2E los verifican. La pestaña de libretas solo muestra II Bimestre y no hay consulta histórica por año. | H51/H49; smoke 8/11; E2E 11 |
| SIAGIE | 🔴 | El backend está limitado por H05 (4 cursos/primera hoja) y la UI simula el portal y el análisis. El flujo no es confiable para una exportación oficial. | H05/H52 |
| Auditoría / bitácora | 🟢 | Paginación, filtros, módulos, estadísticas y eventos críticos. El PDF de acta tiene un IDOR para DOCENTE (H63). | H63; smoke 6; E2E 13 |
| Actas | 🔴 | No se pueden crear en una base nueva; las globales de la demo no bloquean notas. | H48; regresión H06 |
| Notificaciones | 🟡 | Campanita, personal/rol/grado/alumno y contador funcionan; Resend en modo prueba es aceptado. Detalle: DOCENTE puede enviar a cualquier usuario (H62) y hay dos campanas (header y reportes) con contadores independientes. | H62; smoke; H15 |
| Dashboards | 🟡 | KPIs reales en su mayoría, pero "Plana Docente" cuenta todo el personal, el panel de alertas no tiene asistencia, el alumno ve grado/texto fijos y secretaría tiene un cobro muerto. | H54/H57/H65/H66 |
| Seguridad y roles | 🟡 | Baseline correcto: JWT, estado en cada request, ownership en alumnos/cursos, CORS/helmet. Pendientes: H36 (rate limit por IP), H62 y H63. | Smoke 3/9; E2E 12 |
| Base de datos / integridad | 🟡 | Producción nueva: 10/10 invariantes. Demo local: 8/10 por 5 pagos sin INGRESO y 144 pensiones PAGADO sin pago (H41), más 1 retirado activo (H71). | `test:integridad`; sección 9 |
| Documentación | 🟡 | Este informe actualiza la auditoría; los conteos de `README`, `AGENTS` y `03` siguen desactualizados. | H26; sección 8 |
| Pruebas / CI | 🟡 | Hay smoke, E2E, integridad y generador; no hay CI ni tests unitarios (H24). | Sección 9 |
| Despliegue | 🟡 | Render/Supabase gratuitos son aceptados para demo. Deep links 404, sin staging, migraciones manuales. | H64; H40 |

---

## 4. Conectividad funcional (Fase 3)

### 4.1 Matriz módulo → ruta → componente → servicio → endpoint → controlador → DAO → tabla

| Módulo | Ruta frontend | Componente | Servicio / cliente | Endpoint principal | Controlador | DAO | Tablas |
|---|---|---|---|---|---|---|---|
| Login | `/login` | `LoginComponent` | `AuthService.login` | `POST /api/auth/login` | `authController.login` | `usuarioDao.findByDni` | `usuarios`, `roles` |
| Cambio obligatorio | `/cambiar-password` | `CambiarPasswordComponent` | `AuthService.cambiarPassword` | `PUT /api/auth/cambiar-password` | `authController.cambiarPassword` | `usuarioDao.actualizarPassword` | `usuarios` |
| Recuperación | `/reset-password?token=` | `ResetPasswordComponent` | `HttpClient` | `GET /auth/validar-token/:token`; `POST /auth/restablecer-password` | `authController` | `recuperacionDao` | `recuperacion_password`, `usuarios` |
| Dashboard ADMIN | `/admin` | `DashboardComponent` | `HttpClient` + `NotificacionService` | `GET /reportes/dashboard`; `POST /notificaciones/masivo` | `reporteController`, `notificacionController` | `reporteDao`, `notificacionDao` | `alumnos`, `personal`, `pagos`, `pre_tickets`, `grados`, `cursos`, `notificaciones` |
| Alumnos / padrón | `/admin/alumnos`, `/secretaria/padron` | `AdminAlumnosComponent` (wrapper) | `HttpClient` | `GET/POST /alumnos`; `PUT /alumnos/:id`; `PUT /alumnos/:id/retirar` | `alumnoController` | `alumnoDao` | `alumnos`, `apoderados`, `usuarios`, `expediente_alumno`, `credenciales_qr`, `pre_tickets` |
| Personal | `/admin/personal` | `AdminPersonalComponent` | `HttpClient` | `GET/POST /personal`; `PUT /personal/:id`; `cesar`, `reactivar`, `reset-password` | `personalController` | `personalDao`, `usuarioDao` | `personal`, `usuarios`, `credenciales_qr` |
| Carga curricular | `/admin/carga-curricular` | `AdminCargaCurricularComponent` | `HttpClient` | `GET /carga-curricular/grado/:id`; `POST/PUT/DELETE /carga-curricular`; `POST /tutor` | `cargaCurricularController` | `cargaCurricularDao` | `carga_curricular`, `grados`, `cursos`, `personal`, `tutores_grado` |
| Horarios ADMIN | `/admin/horarios` | `AdminHorariosComponent` | `HorarioService` | `GET /horarios`; CRUD `/horarios/:id`; `/periodos`; `/generar`; `/publicar`; `/despublicar` | `horarioController` | `horarioDao`, `periodoClaseDao` | `horarios`, `periodos_clase`, `carga_curricular` |
| Horarios SEC/ DOC/ EST | `/secretaria/horarios`, `/docente/horario`, `/estudiante/horario` | `SecretariaHorariosComponent`, `DocenteHorarioComponent`, `EstudianteHorarioComponent` | `HorarioService` | `GET /horarios` (SEC); `GET /horarios/mi-horario` (DOC/EST) | `horarioController` | `horarioDao` | `horarios`, `periodos_clase` |
| Asistencia QR personal | `/admin/asistencia-qr`, `/secretaria/asistencia-qr` | `AdminAsistenciaQrComponent` (wrapper) | `HttpClient` | `GET /asistencias/personal/todos`; `GET /personal/resumen`; `GET /personal/dni/:dni`; `POST /personal/marcar` | `asistenciaController` | `asistenciaDao` | `asistencia_personal`, `personal` |
| Asistencia docente | `/docente/asistencia` | `DocenteAsistenciaComponent` | `HttpClient` | `GET /asistencias/curso/:id/fecha/:fecha`; `POST /asistencias/masivo` | `asistenciaController` | `asistenciaDao` | `asistencia_alumnos`, `carga_curricular`, `alumnos` |
| Notas docente | `/docente/notas` | `DocenteNotasComponent` | `HttpClient` | `GET /calificaciones/curso/:id/grado/:id`; `POST /calificaciones/masivo` | `calificacionController` | `calificacionDao` | `calificaciones`, `notas_finales_area`, `competencias` |
| Ficha estudiante | `/docente/ficha-estudiante` | `DocenteFichaComponent` | `HttpClient` | `GET /alumnos/dni/:dni`; `GET /asistencias/alumno/:id`; `GET /calificaciones/notas-finales/alumno/:id` | `alumnoController`, `asistenciaController`, `calificacionController` | `alumnoDao`, `asistenciaDao`, `calificacionDao` | `alumnos`, `asistencia_alumnos`, `notas_finales_area` |
| Reportes docente | `/docente/reportes` | `DocenteReportesComponent` | `HttpClient` | `GET /calificaciones/curso/:id/grado/:id`; notificaciones | `calificacionController`, `notificacionController` | `calificacionDao`, `notificacionDao` | `calificaciones`, `competencias`, `notificaciones` |
| Tesorería | `/admin/tesoreria`, `/secretaria/tesoreria` | `SecretariaTesoreriaComponent` (wrapper) | `HttpClient` | `GET /alumnos`; `GET /tesoreria/pensiones/alumno/:id`; `GET /conceptos`; `GET /pre-tickets`; `POST /pagos`; `POST /pensiones/alumno/:id/generar` | `tesoreriaController` | `tesoreriaDao` | `pensiones`, `pagos`, `pre_tickets`, `conceptos_pago`, `boletas_electronicas` |
| Caja | `/admin/caja`, `/secretaria/caja` | `SecretariaCajaComponent` (wrapper) | `HttpClient` | `GET /caja/actual`; `GET /movimientos/:id`; `POST /aperturar`, `/egresos`, `/cerrar`; `PUT /tesoreria/pagos/:id/anular` | `cajaController`, `tesoreriaController` | `cajaDao`, `tesoreriaDao` | `aperturas_caja`, `movimientos_caja`, `cierres_caja`, `pagos` |
| Reportes / libretas | `/admin/reportes` | `AdminReportesComponent` | `HttpClient` | `GET /reportes/libreta/:id`; `GET /reportes/libreta/:id/pdf`; `cuadro-merito`; `alumnos-riesgo` | `reporteController` | `reporteDao` | `alumnos`, `notas_finales_area`, `conclusiones_descriptivas`, `asistencia_alumnos`, `tutores_grado` |
| SIAGIE | `/admin/siagie` | `AdminSiagieComponent` | `HttpClient` (multipart) | `POST /siagie/generar-excel`; `GET /reportes/auditoria-docentes/:id_grado` | `siagieController`, `reporteController` | `siagieDao`, `reporteDao` | `exportaciones_siagie`, `notas_finales_area`, `carga_curricular` |
| Auditoría / actas | `/admin/auditoria` | `AdminAuditoriaComponent` | `HttpClient` | `GET /auditoria`; `/modulos`; `/estadisticas`; `/actas`; `GET /actas/:id/pdf`; `POST /actas/cerrar` | `auditoriaController` | `auditoriaDao` | `bitacora_auditoria`, `actas_bimestrales` |
| Notificaciones | Header / modal | `HeaderComponent`; `DocenteReportesComponent` | `NotificacionService` | `GET /notificaciones`; `/no-leidas`; `PUT /:id/leer`; `/leer-todas`; `POST /`; `/masivo` | `notificacionController` | `notificacionDao` | `notificaciones`, `usuarios`, `grados` |
| Dashboard SEC | `/secretaria` | `SecretariaDashboardComponent` | `HttpClient` | `GET /tesoreria/estadisticas`; `GET /pre-tickets` | `tesoreriaController` | `tesoreriaDao` | `pagos`, `pre_tickets` |
| Dashboard EST | `/estudiante` | `EstudianteDashboardComponent` | `HttpClient` | `GET /calificaciones/notas-finales/alumno/:id` | `calificacionController` | `calificacionDao` | `notas_finales_area` |
| Asistencia EST | `/estudiante/asistencia` | `EstudianteAsistenciaComponent` | `HttpClient` | `GET /asistencias/alumno/:id/resumen`; `GET /asistencias/alumno/:id?id_curso=` | `asistenciaController` | `asistenciaDao` | `asistencia_alumnos` |
| Horario EST | `/estudiante/horario` | `EstudianteHorarioComponent` | `HorarioService` | `GET /horarios/mi-horario` | `horarioController` | `horarioDao` | `horarios`, `periodos_clase` |
| Configuración | App initializer | `ConfiguracionService` | `HttpClient` | `GET /configuracion` | `configuracionController` | `config/academico` | — |

### 4.2 Acciones de UI sin endpoint real

| Acción | Archivo | Qué hace hoy | Estado |
|---|---|---|---|
| Docente → Asistencia / Notas | `docente-dashboard.component.ts:94-107` | `alert("próximamente")` | H53 |
| Secretaría → Cobrar pre-ticket | `secretaria-dashboard.component.ts:77-79` | `alert("próximamente")` | H54 |
| SIAGIE → Abrir Portal MINEDU | `admin-siagie.component.ts:130-137` | `alert` | H52 |
| SIAGIE → análisis de plantilla | `admin-siagie.component.ts:139-148` | `setTimeout(800)` y mensaje de éxito sin leer el archivo | H52 |
| Personal → Carné QR | `admin-personal.component.html:450` | Icono FontAwesome; sin QR | H55 |
| Reportes → Exportar PDF | `admin-reportes.component.html:40` | `window.print()` | H58 |
| Docente reportes → Descargar PDF | `docente-reportes.component.html:34` | `window.print()` | H58 |
| Caja → Firmar, Cerrar e Imprimir | `secretaria-caja.component.html:484` | Cierra caja, pero no firma ni imprime automáticamente | H58/H68 |
| Caja → Imprimir Acta | `secretaria-caja.component.html:488` | `window.print()` sobre toda la página | H58 |
| Header → Imprimir carné | `header.component.ts:159-160` | `window.print()` sobre toda la página | H58 |
| Admin dashboard → "Filtro Automático" | `dashboard.component.html:77` | Solo badge; no hay filtro | H66 |

### 4.3 Endpoints sin uso en la UI

No todos son defectos: algunos son utilidades internas o de consulta. Los relevantes para
producción son los que no tienen ninguna pantalla:

- `GET /api/auth/verify`, `POST /api/auth/logout` (H31: logout local).
- `GET /api/grados/:id`, `GET /api/cursos/:id`, `GET /api/cursos/:id/competencias`,
  `GET /api/escala-calificacion`.
- `POST /api/asistencias` (individual; la UI usa `/masivo`).
- `POST /api/calificaciones` (individual; la UI usa `/masivo`).
- `POST /api/calificaciones/notas-finales` (la UI no lo necesita desde H04).
- `GET /api/caja/cajas`, `/aperturas`, `/aperturas/:id`, `/cierres` (no hay pantalla de
  historial de cierres).
- `GET /api/tesoreria/pre-tickets/:id`, `POST /api/tesoreria/pre-tickets` (no hay alta
  manual de pre-tickets).
- `GET /api/tesoreria/pagos/:id` (el detalle se toma de la lista).
- `POST /api/tesoreria/pensiones/generar` (generador mensual global sin UI).
- `GET/POST /api/tesoreria/becas` (no hay UI de becas).
- `GET /api/auditoria/:id` (el modal usa la fila de la lista).
- `GET /api/notificaciones/:id`, `DELETE /api/notificaciones/:id` (no hay borrado en UI).
- `GET /api/reportes/resumen-asistencia/:id_grado` (no hay pestaña de resumen por grado;
  además H13).
- `GET /api/carga-curricular/:id`.

**Impacto:** el backend tiene más superficie de la que la UI usa; no es un bug por sí mismo,
pero sí es deuda de producto y de permisos (cada endpoint sin UI sigue expuesto).

### 4.4 Guards y roles incoherentes

- Los guards de ruta y el backend están alineados para los módulos principales: un
  SECRETARIA no entra a `/admin` (tiene `/secretaria`), un DOCENTE no entra a `/admin`,
  un ESTUDIANTE solo a `/estudiante`.
- **Incoherencia:** `POST /api/notificaciones` permite DOCENTE, pero no existe UI de envío
  para docente. La API ofrece una acción que la UI no muestra y que no valida pertenencia
  (H62).
- **Incoherencia:** `GET /api/auditoria/actas/:id/pdf` permite DOCENTE, pero la UI de actas
  es solo ADMIN. La API queda más abierta que la UI (H63).
- **Incoherencia:** el backend permite `GET /api/reportes/libreta/:id` al ESTUDIANTE propio,
  pero no hay pantalla "Mi libreta" en el panel del estudiante (H35, pendiente).
- **Incoherencia menor:** el sidebar del ADMIN declara roles por ítem, pero el componente
  no filtra por `rol`; hoy no se nota porque solo se usa en el layout ADMIN.

### 4.5 Datos que no se refrescan o tienen dos fuentes de verdad

- La campanita del header y la campana duplicada de `docente-reportes` usan contadores
  independientes; al marcar todas como leídas en la página, el badge del header puede
  tardar hasta 30 s (polling).
- El filtro de grados de alumnos usa una lista 1–5 fija, no `grados()` (H67).
- El texto "11 cursos" de carga curricular no sale de `cursos()` (H67).
- El estudiante ve "3ro de Secundaria" fijo en el sidebar y "2do" real en el horario (H57).
- El dashboard ADMIN llama "Plana Docente" a todo el personal activo (H65).
- La UI de caja y el backend calculan el efectivo con criterios distintos (H50).
- El acta dice "Firmada" pero `actaEstaCerrada` no la considera si es global (H48).
- El seed de producción usa `CURRENT_DATE`, no `ANIO_LECTIVO` (H49).

---

## 5. Recorrido E2E por rol (Fase 4)

> **Restricción aplicada:** no se ejecutaron altas, pagos, anulaciones, retiros ni cierres
> sobre `siga_uc` ni sobre producción. Los flujos de escritura se validaron con
> `npm run test:e2e` en la base desechable `siga_uc_e2e`, que se crea y se elimina sola.

### 5.1 ADMIN (local, solo lectura)

| Paso | Resultado | Evidencia |
|---|---|---|
| Login | OK | Redirige a `/admin`; dashboard con 17 estudiantes matriculados, 7 "plana docente", S/2750 recaudado, 1 pre-ticket. |
| Padrón | OK | 21 estudiantes, 20 filas en la primera página, paginación server-side; filtros de grado/estado funcionan con IDs 1–5. |
| Personal | OK | 8 fichas; carné QR abierto: no hay QR real (H55); "Correo Institucional (Decorativo)" visible. |
| Carga curricular | OK | 11 asignaciones en 1ro; tutor Juan Carlos; todas las cargas en ADMIN (dato local). |
| Horarios | 🟡 | 0 bloques y 10 períodos; "Generar automático" no puede completar con 54 cargas en ADMIN (capacidad 40). Es estado de datos, no bug de código. |
| Tesorería | OK | 21 alumnos con pensiones; una petición GET de pensión por alumno (N+1, H22; 21 GET + 21 preflight en la sesión); 1 pre-ticket; tabla con PAGADO de demo sin pago (H41). |
| Caja | OK con reserva | Caja abierta con S/100, ingreso S/250, efectivo S/350; todos los pagos locales son efectivo, por eso H50 no se ve. |
| Reportes/libretas | 🟡 | Pestaña "Libretas Informativas" solo permite II Bimestre (H51); el PDF de libreta sí es real. |
| SIAGIE | 🔴 | "Abrir Portal MINEDU" solo alert; archivo falso de 18 bytes declarado "mapeado correctamente" (H52). |
| Auditoría/actas | 🔴 | 2 actas globales CERRADO, sin forma de crear una por grado; al no bloquear, el cierre es decorativo (H48). |
| Notificaciones | OK | Modal de nueva notificación con aviso de modo prueba; envío masivo real. |
| Asistencia QR | OK | 7 personas, 0 marcaciones; el escaneo por DNI es una simulación aceptada. |

**Escrituras del ADMIN verificadas en `test:e2e`:** crear alumno con apoderado, retirar,
pagar matrícula, bloquear doble pago, anular pago, bloquear doble anulación, guardar
calificación, guardado masivo con error, descargar libreta/boleta, RBAC, auditoría y acta
cerrada. Todas PASS.

### 5.2 SECRETARÍA (local, solo lectura)

- Login OK; dashboard con 1 pre-ticket de matrícula y S/250 pendiente.
- El botón **Cobrar** solo muestra "Cobro del pre-ticket 1 próximamente" (H54).
- La columna DNI de la bandeja muestra siempre "-" (H69).
- Las rutas de padrón, tesorería, caja, QR y horarios existen y cargan; no se probaron
  escrituras por la restricción de solo lectura.

### 5.3 DOCENTE (local, solo lectura)

- Login OK. En local el docente `20394812` tiene **0 asignaciones** porque las 54 cargas
  quedaron en el ADMIN tras la limpieza. Por eso no se pudieron ejercitar notas/asistencia
  con datos reales desde la UI.
- El dashboard muestra "0 asignaciones"; los botones "Asistencia" y "Notas" no aparecen
  porque no hay tarjetas de curso. El código confirma que, cuando hay cursos, esos botones
  solo lanzan `alert("... próximamente")` (H53).
- `/docente/horario` muestra "Tu horario aún no está publicado" (0 horarios).
- `/docente/notas`, `/docente/asistencia`, `/docente/ficha-estudiante` y
  `/docente/reportes` cargan sin errores de consola, pero con selects vacíos. No hay un
  estado "no tienes cursos asignados" en esas páginas; es una mejora de UX, no un bloqueo.

### 5.4 ESTUDIANTE (local, solo lectura)

- Login con `74829103` (2do de Secundaria). El sidebar dice **"3ro de Secundaria"**; el
  horario dice "2do de Secundaria Única" (H57).
- Dashboard: "Cursos Matriculados 0", promedio "-" y el texto fijo "Vas por un excelente
  rendimiento académico" (H57).
- Mi Asistencia: 1 registro, 100%, pero el día se muestra **"Tuesday"** en una UI en
  español (H61).
- Horario: "Tu horario aún no está publicado" (0 horarios locales), correcto.
- No existe pantalla de libreta para el estudiante (H35, pendiente).

### 5.5 Producción (solo lectura)

- `https://siga-uc-web.onrender.com/` → 200; la raíz redirige a `/login` en el SPA.
- `https://siga-uc-web.onrender.com/login` → **HTTP 404** (el documento carga el SPA, pero
  el estado es 404); `/admin` → **404** (H64).
- `https://siga-uc-api-prod.onrender.com/api/health` → 200, `database: ok`.
- `GET /api/configuracion` → 200, `anio_lectivo: 2026`.
- No se inició sesión ni se ejecutó ninguna escritura en producción. No se validaron de
  forma directa las 40 tablas, 145 horarios ni 5 docentes de Supabase; se toman del contexto
  y de `HANDOFF_SESSION.md`.

---

## 6. Seguridad e integridad (Fase 5)

### 6.1 IDOR, ownership y roles

| Recurso | Control | Resultado |
|---|---|---|
| `GET /alumnos`, `GET /alumnos/:id`, `GET /alumnos/dni/:dni` | `checkRole` + `checkAlumnoPropio` / `checkAlumnoPorDni` | OK; smoke 3/5/9 y E2E 12. |
| `GET /asistencias/alumno/:id`, `GET /asistencias/alumno/:id/resumen` | `checkAlumnoPropio` | OK. |
| `GET /calificaciones/alumno/:id/curso/:id` | `checkAlumnoPropio` + `checkCursoDocente` | OK. |
| `GET /reportes/libreta/:id` y `/pdf` | `checkAlumnoPropio` | OK. |
| `GET /personal`, `GET /caja/*`, `GET /tesoreria/*` | Verificación de rol ADMIN/SECRETARIA | OK. |
| `GET /auditoria/*` | ADMIN, salvo PDF de acta | **IDOR en PDF de acta para DOCENTE (H63)**. |
| `POST /notificaciones` | ADMIN/DOCENTE | **Destino arbitrario para DOCENTE (H62)**. |

No se encontró otro IDOR en los endpoints revisados. El ownership de docentes se apoya en
`autorizacionDao.docenteTieneAlumno/Curso/Grado`; el E2E prueba 403 para curso ajeno.

### 6.2 Errores y filtrado

- `response.js` y el handler global sustituyen los mensajes 5xx por uno genérico (H17).
- Excepción: `cerrarActa` con acta inexistente devuelve 500 por `data.periodo` sobre
  `null` (H48). No expone SQL, pero es un 500 evitable.
- Los controllers devuelven `error.message` en 4xx; es intencional y no incluye SQL.

### 6.3 Secretos, CORS y rate limits

- `git ls-files` no muestra `.env`, claves ni backups; `.gitignore` cubre `.env`,
  `backups/` y `uploads/`.
- `AGENTS.md` documenta la credencial local `74829102 / UC2026*`; no es la de producción
  (HANDOFF dice que la real no está en `.env`). Es una higiene a corregir cuando se
  publique el repo, no un secreto de producción.
- CORS: orígenes explícitos (`localhost:4200`, `localhost:3000`, `FRONTEND_URL`); en
  producción el backend exige `FRONTEND_URL` al arrancar.
- `helmet()` y `trust proxy` solo en producción; rate limit de login/recuperación/token.
- Pendiente H36: 5 fallos por IP en 15 min pueden bloquear una red escolar con NAT.

### 6.4 Resets y contraseñas

- Los resets por ADMIN (`/auth/reset-password` y `/personal/:id/reset-password`) auditan
  `RESET_PASSWORD` con DNI e `id_usuario_afectado`, sin clave ni hash (H43).
- La contraseña temporal de alumnos y personal es el DNI; `requiere_cambio_password=TRUE`
  obliga a cambiarla. Es predecible, pero el flujo de cambio está bloqueado por backend y
  guards.
- No se probó el envío real de recuperación porque Resend está en modo prueba.

### 6.5 Integridad de datos

Consultas de solo lectura sobre `siga_uc`:

- 0 DNI duplicados en alumnos/usuarios; 0 pensiones duplicadas; 0 notas finales duplicadas.
- 0 cargas sin docente; 0 horarios sin período; 0 notas finales sin calificación.
- 0 pagos PAGADO sin boleta; 0 boletas sin pago; 0 pagos ANULADO sin EGRESO.
- 1 apertura de caja abierta (esperado).
- **5 pagos PAGADO sin movimiento INGRESO** y **144 pensiones PAGADO sin pago**: datos del
  dump demo, ya documentados en H41; no aparecen en el seed de producción.
- **1 alumno Retirado con usuario ACTIVO y expediente `congelado=false`** (H71): el código
  de H19 funciona para retiros nuevos, pero no hay backfill para datos históricos/demo.
- `test:integridad` no detecta H71 porque el invariante 7 solo exige ficha a
  ESTUDIANTE/DOCENTE activos y el 10 solo mira Matriculados sin usuario activo.

---

## 7. Textos y placeholders visibles (Fase 2)

| Archivo:línea | Dónde se ve | Texto actual | Propuesta | Sev. |
|---|---|---|---|---|
| `siga-uc-frontend/src/index.html:5` | Pestaña del navegador | `SigaUcFrontend` | `SIGA-UC — I.E.P. Unión Científica` | P2 (H30) |
| `siga-uc-frontend/src/index.html:2` | `<html>` | `lang="en"` | `lang="es"` | P2 |
| `en-construccion.component.html:15-16` | Ruta `/en-construccion` | "El panel ... está en desarrollo. Estará disponible próximamente..." | Eliminar la ruta/pantalla o actualizarla a "Módulo no disponible" | P2 |
| `en-construccion.component.html:38-40` | Misma pantalla | "Dashboard Docente/Estudiante/Secretaría (en desarrollo)" | Quitar; los tres dashboards ya existen | P2 |
| `admin-personal.component.html:195,288` | Alta/edición de personal | "Correo Institucional (Decorativo)" | "Correo institucional (referencia)" u ocultar el campo | P2 |
| `secretaria-layout.component.html:5` | Header de secretaría | "Gestión de Tesorería, Pensiones y Facturación" | "Tesorería, Pensiones y Boletas internas" | P2 |
| `secretaria-dashboard.component.html:82` | Bandeja de pre-tickets | Columna DNI fija `-` | Enviar y mostrar el DNI real o quitar la columna | P2 |
| `admin-layout.component.html:8` | Header de todo el ADMIN | "Resumen Ejecutivo" en todos los módulos | Título por ruta | P2 |
| `estudiante-dashboard.component.html:21` | Panel del alumno | "Vas por un excelente rendimiento académico..." | "Aún no hay notas de este periodo" si no hay datos | P2 (H57) |
| `sidebar-estudiante.component.html:26` | Sidebar del alumno | "3ro de Secundaria" | `nombre_grado` real del alumno | P2 (H57) |
| `sidebar-docente.component.html:27` | Sidebar del docente | "Docente de Área" | Especialidad/cargo real o "Docente" | P2 |
| `admin-siagie.component.html:22-24` | SIAGIE, paso 1 | "Abrir Portal MINEDU" | Abrir URL real o "Descargar plantilla" | P1 (H52) |
| `admin-siagie.component.html:92-99` | SIAGIE, paso 2 | "Análisis Dinámico Exitoso... Columnas mapeadas correctamente" | Mostrar resultado real del parser | P1 (H52) |
| `docente-dashboard.component.ts:96,105` | Tarjetas de curso | "Módulo ... próximamente" | Navegar a la página real | P1 (H53) |
| `secretaria-dashboard.component.ts:78` | Bandeja de pre-tickets | "Cobro del pre-ticket ... próximamente" | Navegar a tesorería | P1 (H54) |
| `login.component.ts:154-157` | Recuperación | "Revise su correo personal..." | Avisar "modo prueba: solo llega al correo del administrador" | P2 |
| `login.component.html:113` | Placeholder de recuperación | `correo@unioncientifica.edu.pe` | `correo@gmail.com` o texto genérico | P2 |
| `admin-dashboard.component.html:136-137` | Modal de notificación | "Correo en modo prueba..." | Correcto: mantener; es honesto | — |
| `app.js:272` | Log del backend | "SMTP verificado correctamente" | "Resend configurado correctamente" | P2 (H70) |
| `emailService.js:112` | Pie de correo | "© 2026 ..." | Usar año dinámico o `ANIO_LECTIVO` | P2 |

**Búsquedas sin coincidencias visibles:** no hay "Lorem", "ficticio", "simulado" ni
"onboarding@resend.dev" en templates; el modo prueba está bien avisado en el modal de
notificaciones. El texto "demo" no aparece como banner; solo en datos locales de prueba.

---

## 8. Documentación y consistencia (Fase 6)

### 8.1 Conteos reales vs documentados

| Elemento | Documentado | Real (esta sesión) | Comentario |
|---|---|---|---|
| Tablas de producción | 40 | **40** | `siga_uc` local tiene 41 por `horarios_h47_backup`; producción nueva 40. |
| Endpoints REST | 113 (64 GET/31 POST/14 PUT/4 DELETE) | **113** | Verificado con conteo de `router.get/post/put/delete/patch`. |
| Routers | 15 | **15** | `src/routes/*.js`. |
| Controladores | 15 | **15** | `src/controllers/*.js`. |
| Servicios | 21 | **22** | Faltan en el conteo `actaPdfService` y/o `periodoClaseService` (según el doc). |
| DAOs | 17 | **18** | Incluye `autorizacionDao` y `periodoClaseDao`. |
| Archivos backend JS | 80 | **80** | Coincide. |
| Archivos frontend | 129 (53 TS) | **134** archivos `ts/html/scss`; **56 TS** | El conteo de 129/53 está desactualizado. |

### 8.2 Inconsistencias concretas

- `documentacion/README.md:27` dice "102 endpoints"; la misma página, línea 51, dice 113.
- `documentacion/03-ESTRUCTURA-Y-CLASES.md:12` dice "14 routers"; la tabla de líneas 23-36
  omite `horarioRoutes`; el real es 15.
- `documentacion/03-ESTRUCTURA-Y-CLASES.md:25` dice que `academicoRoutes` tiene 7
  endpoints; tiene 6 (grados, grados/:id, cursos, cursos/:id, competencias, escala).
- `AGENTS.md:37-38` dice 21 servicios, 17 DAOs, 129 archivos frontend y 53 TS; los reales
  son 22, 18, 134 y 56.
- `database/seed_produccion.sql:12-17` enumera la secuencia de instalación solo hasta H07;
  no menciona H45 ni H47, aunque `HANDOFF_SESSION.md` y `AGENTS.md` sí.
- `docs/` mantiene la documentación histórica (26 tablas, Nodemailer/SMTP, etc.); H26
  sigue abierto.
- `documentacion/03` línea 121 dice que `auth.guard` "guarda returnUrl"; lo guarda en la
  URL, pero el login no lo usa (H72).
- `siga_uc.sql` sigue con `\restrict`/`\unrestrict` de psql 18 (H28).
- `.env.example` sigue con SMTP y no con Resend (H27).

No se encontraron referencias a archivos inexistentes en la revisión muestral de
`documentacion/03`; los archivos citados existen.

---

## 9. Pruebas automáticas (Fase 7)

| Comando | Resultado | Detalle |
|---|---|---|
| `npm run smoke` (local, backend 3000) | **11 PASS, 0 FAIL, 0 SKIP** | Salud, configuración, 401 sin token, login ADMIN/perfil, alumnos, bitácora, pagos, libreta PDF, RBAC estudiante, login docente, libreta propia. |
| `npm run test:e2e` | **14 PASS, 0 FAIL** | Base `siga_uc_e2e` creada y eliminada; 14 flujos de negocio, PDFs, RBAC y acta cerrada. |
| `npm run test:integridad` (local `siga_uc`) | **8 PASS, 2 FAIL** | FAIL 4: 5 pagos PAGADO sin INGRESO; FAIL 8: 144 pensiones PAGADO sin pago. Son datos del dump demo (H41), no del seed de producción. |
| `npm run test:integridad` (base nueva `siga_uc_audit_prod`) | **10 PASS, 0 FAIL** | `siga_uc.sql` + `seed_produccion.sql` + H32/H10/H07/H45/H47; 40 tablas, 0 alumnos, 0 actas, 5 grados, 11 conceptos, 10 períodos, 55 cargas. Base eliminada al terminar. |
| `npm run test:h47-generador` | **4 PASS** | Carga coherente, bloques externos, sobrecarga, reproducibilidad por semilla. |
| `GET /api/health` producción | **200**, `database: ok` | Solo lectura. |
| `GET /api/configuracion` producción | **200**, `anio_lectivo: 2026` | Solo lectura. |
| Frontend producción | `/` 200; `/login` y `/admin` 404 | El SPA renderiza, pero el estado HTTP es 404 (H64). |

**Conclusión de pruebas:** los flujos críticos de negocio que ya existían pasan en una base
desechable. La deuda no está en los tests actuales, sino en lo que no cubren: creación de
actas desde la UI, cierre de caja con medios digitales, rollover anual, SIAGIE real,
recuperación de contraseña real y rutas profundas en Render.

---

## 10. Regresiones de hallazgos cerrados

| Hallazgo cerrado | Regresión detectada | Evidencia | Nuevo ID |
|---|---|---|---|
| **H06** — Acta cerrada bloquea notas | El bloqueo solo funciona si existe un acta por grado; la app no puede crearla. Las actas globales (las únicas de la demo) se ignoran. | `auditoriaDao.js:238-257`, `:373-399`; `seed_produccion.sql` sin actas; `test-e2e.js:1242-1252` inserta el acta por SQL. | **H48** |
| **H39** — Fechas de negocio en hora de Lima | La fecha de asistencia se sigue parseando como UTC para calcular `dia_semana`; en Lima un lunes se guarda como domingo. | `docente-asistencia.component.ts:227`; prueba `new Date('2026-11-23').getDay()` → `0` con `TZ=America/Lima`. | **H61** |
| **H19** — Retiro desactiva usuario y congela expediente | El código nuevo lo hace, pero no hay backfill para datos históricos/demo: el alumno 14 está Retirado con usuario ACTIVO y expediente abierto. | `siga_uc_completo.sql:2123,2460`; consulta local; `alumnoDao.js:426` solo en retiros nuevos. | **H71** |

**H12** sigue resuelto para literales de año; **H49** no es una regresión de H12, sino el
rollover anual que H12 nunca cubrió. **H30** y **H26** siguen abiertos (no son
regresiones). **H47** no muestra regresión: generador 4 PASS y E2E 14 PASS.

---

## 11. Pendientes previos verificados (sin re-reportar como nuevos)

| Hallazgo | Estado | Evidencia actual |
|---|---|---|
| H05 — SIAGIE limitado a 4 cursos/primera hoja | Sigue | `siagieService` detecta solo `ARITM`, `ALGEBRA`, `COMUNIC`, `FISICA`; H52 agrava la UI. |
| H13 — Resumen de asistencia por grado ignora el año | Sigue | `reporteDao.js:177-198`; comentario "SOLO 1 parámetro" en línea 197. |
| H14 — Dos algoritmos de nota final | Sigue | `calificacionDao.calcularNotaFinal` y función SQL `calcular_nota_final_area`; no se unificaron. |
| H16 — HTML del correo sin escapar | Sigue | `emailService.js:102-104` interpola `asunto`, `destinatario` y `cuerpo`. |
| H21 — Cambio de rol no regenera QR | Sigue | `personalDao.actualizar` cambia `id_rol`; `credenciales_qr.tipo` no se actualiza. |
| H22 — N+1 en tesorería | Sigue | La UI hace una petición GET de pensión por alumno (21 alumnos) más preflight; `secretaria-tesoreria.component.ts:179-206`. |
| H23 — Paginación faltante | Sigue | Personal, pagos y pre-tickets siguen sin paginación server-side. |
| H24 — Sin tests/CI | Sigue | `package.json` backend `test: echo`; no hay workflows. |
| H26 — Documentación desactualizada | Sigue | Conteos de la sección 8; `docs/` histórico. |
| H27 — `.env.example` con SMTP | Sigue | `siga-uc-backend/.env.example:38-47`; no define `RESEND_API_KEY`/`EMAIL_FROM`. |
| H28 — `\restrict` en `siga_uc.sql` | Sigue | `database/siga_uc.sql:5,3752`. |
| H29 — Tablas de reportes sin uso | Sigue | 0 referencias a `alumnos_riesgo`, `cuadro_merito`, `estado_carga_docentes`, `libretas`, `resumen_asistencia_curso`. |
| H30 — Título e identidad menores | Sigue | `index.html:5` `SigaUcFrontend`; `lang="en"`. |
| H31 — Logout sin uso | Sigue | `POST /auth/logout` existe; el frontend solo borra localStorage. |
| H33 — Sin CRUD de competencias/conclusiones | Sigue | `academicoRoutes` solo GET; `conclusiones_descriptivas` solo se lee. |
| H35 — Estudiante sin pantalla de libreta | Sigue | `app.routes.ts` del estudiante solo tiene dashboard, asistencia y horario. |
| H36 — Rate limit por IP compartida | Sigue | `rateLimit.js:22-32`; 5 fallos/15 min por IP. |

---

## 12. Descartados (revisado y correcto)

- **H01/H02:** ownership y revalidación de estado funcionan; smoke 3/9 y E2E 12/4 dan 401/403/retiro bloqueado.
- **H04:** la nota final se recalcula y guarda tras el guardado; E2E 9 y 10 PASS.
- **H07:** la bitácora registra LOGIN/CREAR/ANULAR con usuario; E2E 13 PASS, sin datos sensibles.
- **H08/H09/H10/H32/H38:** pago con caja abierta, monto/concepto, concurrencia, anulación y doble pago; E2E 5-8 PASS.
- **H17:** los 5xx se devuelven genéricos; el detalle queda en consola.
- **H18:** el cambio obligatorio de contraseña bloquea la API y redirige la UI; código y guards.
- **H25:** el script `npm run backup` existe y está documentado; no se ejecutó para no generar archivos.
- **H34:** libreta, boleta y acta son PDF reales; smoke 8/11 y E2E 11 PASS.
- **H40/H41:** la secuencia de producción funciona; base nueva 10/10 invariantes y 0 datos operativos.
- **H43:** los resets auditados no guardan clave ni hash; código verificado.
- **H46:** Personal restringe roles 1-3 y especialidad solo DOCENTE; código verificado.
- **H47:** generador, publicación, CRUD y `mi-horario`; 4 PASS del generador y E2E 14 PASS.
- **Sin mocks/TODO:** no hay `TODO/FIXME` en backend, ni controladores que devuelvan arrays constantes, ni servicios mock.
- **Sin literales 2026 en código:** salvo el pie de correo; el año viene de `ANIO_LECTIVO`/`getAnioLectivo`.
- **Sin secretos versionados:** `git ls-files` no muestra `.env`, claves ni backups.
- **Rutas:** todas las rutas de los 4 roles resuelven; no hay `routerLink` a rutas inexistentes. La única pantalla no enlazada es `en-construccion` (H69).
- **Consola:** las vistas locales recorridas no mostraron errores de consola.
- **Integridad estructural:** 0 DNI duplicados, 0 pensiones duplicadas, 0 notas finales duplicadas, 0 cargas sin docente, 0 horarios sin período.
- **CORS/helmet/trust proxy:** configuración razonable para Render; `FRONTEND_URL` obligatoria en producción.
- **Errores 500:** el handler global no expone SQL; la excepción H48 es funcional, no de filtrado.

---

## 13. No verificado

- Conteos directos de Supabase (40 tablas, 145 horarios, 5 docentes): se toman del contexto
  y de `HANDOFF_SESSION.md`; no se abrió una conexión a Supabase.
- Login y flujos de los 4 roles en producción: no se dispone de la contraseña real del
  dueño; no se escribió en producción.
- `npm run smoke` contra Render: no se ejecutó (requiere la contraseña real del ADMIN).
- Envío real de correo con Resend: modo prueba; solo llegaría al dueño de la cuenta.
- Recuperación de contraseña de punta a punta: no se envió correo.
- Plantilla real del SIAGIE: no se dispone del `.xlsx` oficial; se probó con un archivo falso.
- Restauración de un backup: no se probó.
- Cierre de caja con un pago Yape/transferencia real: H50 se infiere del código; en local
  todos los pagos son efectivo.
- Bloqueo de notas por acta cerrada: se verificó por código y por el E2E con acta insertada
  por SQL; no se ejecutó una escritura en local.
- Rollover 2027: se verificó por código y por la base nueva de 2026; no se creó una base
  2027.
- Responsive/móvil y accesibilidad: no se auditó en dispositivos.
- Docente con asignaciones en la UI local: local tiene 0 cargas docentes tras la limpieza;
  no se reasignaron datos por la restricción de solo lectura.
- H05/H13/H14/H16/H21/H22/H23/H24/H26/H27/H28/H29/H30/H31/H33/H35/H36: se verificó su
  vigencia documental/código, no se re-probaron uno por uno.

---

## 14. Top 10 prioridades y orden recomendado

1. **H48 — Cierre de acta (P0).** Crear el acta por período/grado/año y decidir el rol de
   las actas globales. Sin esto, el cierre de bimestre no existe y H06 sigue roto.
2. **H50 — Cuadre de caja con medios digitales (P0).** Separar efectivo/digital en
   `/caja/actual`, en el arqueo y en los egresos de anulación. Es dinero.
3. **H49 — Rollover anual (P0).** Parameterizar el seed y agregar clonado/creación de
   grados, conceptos, carga y períodos para el año siguiente; agregar selector de año en
   reportes.
4. **H63 — IDOR del PDF de actas (P1).** Restringir a ADMIN o validar el grado del docente.
5. **H52 — SIAGIE real (P1).** Abrir/descargar la plantilla de verdad y parsear el archivo;
   no mostrar "mapeado" sin leerlo. Resolver H05 para más de 4 cursos.
6. **H51 — Selector de bimestre en libretas (P1).** Mostrarlo en la pestaña de libretas y
   usar el bimestre elegido en el PDF.
7. **H56 — Asistencia por año (P1).** Filtrar libreta, resumen y estadísticas por año
   lectivo; agregar `?anio=`.
8. **H55 — Carné QR real (P1).** Generar el QR desde `credencial_qr.codigo_qr`.
9. **H53 — Botones del docente (P1).** Navegar a las páginas reales con `id_carga`.
10. **H57 — Panel del estudiante (P1).** Usar grado/matrícula reales y no felicitar sin
    notas; corregir "Cursos Matriculados".

**Quick wins P2 (después de los 10):** H54 (cobrar pre-ticket), H58 (print/PDF),
H59 (campos descartados), H60 (observación sin estado), H61 (día de semana), H62
(notificación de docente), H64 (404 en Render), H65 (KPIs), H66 (alertas), H67
(hardcodes), H68 ("firma digital"), H69 (textos), H70 (logs), H71 (backfill de retirados),
H72 (404 propia/returnUrl).

---

## 15. Los 3 hallazgos más graves

1. **H48 — El cierre de acta no se puede ejecutar y no bloquea notas.** En una base nueva
   no hay actas; en la demo las actas son globales y el código las ignora. El módulo
   "Cierre y Firmado" es una promesa vacía y H06 está reabierto en la práctica.
2. **H50 — El efectivo de caja se calcula mal con pagos digitales.** La UI suma Yape y
   transferencias al efectivo del cajón, y el cierre descuenta egresos digitales del
   efectivo. Puede declarar faltantes/sobrantes falsos y afectar el arqueo diario.
3. **H49 — No hay rollover anual.** El seed crea la estructura con el año calendario, no
   con `ANIO_LECTIVO`, y no hay UI/script para 2027. Una instalación de producción hecha
   antes de enero queda sin grados, conceptos, carga ni períodos para el año siguiente.

---

## 16. Anexo — Evidencia de entorno

### 16.1 Estado local (`siga_uc`)

| Dato | Valor |
|---|---|
| Tablas | 41 (40 + `horarios_h47_backup`) |
| Alumnos | 21 (17 Matriculados, 3 PendientePago, 1 Retirado) |
| Usuarios | 29 |
| Actas | 2, ambas globales (`id_grado NULL`) y `CERRADO` |
| Horarios | 0 (limpios tras la demo) |
| Períodos | 10 |
| Cargas | 54, todas en el ADMIN (142 h) |
| Pagos | 11, todos Efectivo |
| Pensiones | 180 |
| Pre-tickets | 1 |
| Notificaciones | 8 |

### 16.2 Base nueva de producción (desechable, ya eliminada)

| Dato | Valor |
|---|---|
| Tablas | 40 |
| Alumnos | 0 |
| Usuarios | 1 (ADMIN) |
| Actas | 0 |
| Grados | 5 (2026) |
| Conceptos | 11 (2026) |
| Períodos | 10 (2026) |
| Cargas | 55, todas en el ADMIN |
| Integridad | 10 PASS, 0 FAIL |

### 16.3 Comandos ejecutados

```powershell
# Backend local
cd siga-uc-backend; npm start
npm run smoke
npm run test:e2e
npm run test:integridad
npm run test:h47-generador

# Base nueva desechable (solo para verificar el seed de producción)
createdb siga_uc_audit_prod
psql -d siga_uc_audit_prod -f database/siga_uc.sql
psql -d siga_uc_audit_prod -v admin_password="<clave-temporal>" -f database/seed_produccion.sql
psql -d siga_uc_audit_prod -f database/migracion_h32_anulacion_pagos.sql
psql -d siga_uc_audit_prod -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -d siga_uc_audit_prod -f database/migracion_h07_auditoria.sql
psql -d siga_uc_audit_prod -f database/migracion_h45_pensiones_anuladas.sql
psql -d siga_uc_audit_prod -f database/migracion_h47_horarios.sql
$env:DB_NAME='siga_uc_audit_prod'; npm run test:integridad
dropdb siga_uc_audit_prod

# Producción (solo GET)
curl.exe -s https://siga-uc-api-prod.onrender.com/api/health
curl.exe -s https://siga-uc-api-prod.onrender.com/api/configuracion
# /  -> 200; /login y /admin -> 404 (contenido SPA)
```

### 16.4 Evidencia de navegador (local)

- **ADMIN /personal:** modal "Credencial Digital Institucional" sin `canvas`/`img`/`svg`;
  solo `<i class="fa-solid fa-qrcode">`.
- **ADMIN /reportes:** "Libretas Informativas — 2° Bimestre"; único `<select>` de grado;
  sin selector de bimestre.
- **ADMIN /siagie:** archivo `plantilla_falsa.xlsx` de 18 bytes → "Análisis Dinámico
  Exitoso ... Columnas mapeadas correctamente".
- **SECRETARÍA:** "Cobrar" → alert "Cobro del pre-ticket 1 próximamente".
- **ESTUDIANTE 74829103:** sidebar "3ro de Secundaria"; horario "2do de Secundaria Única";
  dashboard "Cursos Matriculados 0"; asistencia con día "Tuesday".

---

> **Cierre:** este informe no propone refactors masivos. Las recomendaciones son acotadas
> y ordenadas por riesgo. La demo se puede sostener con las limitaciones aceptadas; la
> producción real requiere resolver, como mínimo, H48, H49 y H50, y luego H63, H52, H51,
> H56 y H55.
