# CONTEXTO_SESION.md — SIGA-UC (lectura mínima)

> **Uso:** este es el único archivo que la próxima sesión necesita leer para retomar.
> No hace falta leer `AGENTS.md`, `HANDOFF_SESSION.md` ni `documentacion/` completos.
> Si hace falta un detalle puntual, abrir solo la sección indicada.

## 1. Qué es

SIGA-UC es la demo funcional del Sistema Integrado de Gestión Académica de la
I.E.P. Unión Científica (Huancayo, Perú). **No es producción real.**

- Frontend: https://siga-uc-web.onrender.com
- Backend: https://siga-uc-api-prod.onrender.com/api
- Repo: `https://github.com/Yarol-Bello/siga-uc.git`, rama `main`
- Código desplegado y verificado: **`039c57e`** (backend health `039c57e`, frontend
  `main-B6UDX76Y.js`). Incluye Gmail relay sin dominio, notificaciones por campanita +
  correo, recuperación honesta, cuadro de mérito con notas completas, el fix docente
  `65429f9` y la caja `2864531`. El `commit` del health corresponde al backend; no
  comparar con el hash del frontend.
- Health: `status: "ok"`, `dbReady: true`, `database: "ok"`, `zona_horaria: "America/Lima"`.

## 2. Estado actual (no re-verificar)

- **Demo aprobada técnicamente:** conclusiones, SIAGIE interno, tesorería, caja, notas,
  reportes, PDFs y RBAC funcionan. Suites verdes: smoke 12, integridad 36, E2E 102,
  uat:verify 22, setup 5 y build Angular OK.
- **Datos de Supabase:** se dejan con el **seed v1 a propósito** (113 pagos, 38 pagadas,
  10 exoneradas). **No refrescar, no pedir credenciales y no ejecutar `demo:reset` /
  `uat:seed` ahora.** El usuario decidió que al final se borrará todo y el sistema
  iniciará desde 0.
- **Local:** `siga_uc_h81` tiene el seed v2 validado (75 alumnos, 750 pensiones,
  ~423–432 pagos, 3,300 notas, 3,300 conclusiones). No es la base de Supabase.
- **Render:** backend `039c57e` y frontend `main-B6UDX76Y.js`; caja, docente,
  recuperación, notificaciones y mérito verificados.
- **Correo:** Gmail relay configurado en Render (`GMAIL_RELAY_URL` y
  `GMAIL_RELAY_SECRET`), sin dominio y con límite de **100 destinatarios/día**. Envía
  desde la cuenta Gmail a cualquier destinatario. Resend queda como respaldo. Si el correo
  falla, la API responde `{ tieneCorreo: true, enviado: false }` y la UI pide contactar al
  administrador; el ADMIN puede resetear la clave.
- **Notificaciones:** `crearMasivo` guarda en la campanita y envía el correo en lote;
  devuelve `correos_enviados`, `correos_fallidos`, `correos_sin_destino` y `correos_error`.
  El dashboard del ADMIN muestra ambos canales.
- **Cuadro de mérito:** solo rankea alumnos con nota final en todos los cursos de
  `carga_curricular` del grado/bimestre/año. Un alumno con una sola nota ya no aparece.

## 3. Lo último implementado (Gmail relay + notificaciones + mérito, ya probado)

- **Gmail relay:** `gmailRelayService` llama por HTTPS a una app web de Google Apps Script
  (`scripts/gmail-relay.gs`) que envía con `GmailApp.sendEmail`. No usa SMTP ni dominio.
  `emailService` le da prioridad sobre Resend.
- **Notificaciones:** `notificacionService.crearMasivo` envía en lote (máx. 40 por llamada)
  y conserva la campanita aunque el correo falle. La UI del admin muestra enviados,
  fallidos y sin correo.
- **Recuperación:** `recuperacionService` espera y propaga el resultado del envío; ya no
  muestra un falso “correo enviado”.
- **Mérito:** `reporteDao.getCuadroMerito` cuenta cursos distintos de la carga y exige
  `total_cursos = total_cursos_carga`; agrega `total_cursos_carga` a la respuesta.
- **Pruebas:** Gmail relay local 2/2 y notificación 1 guardada + 1 correo; producción
  `76543211` → `enviado:true` y correo recibido a las 12:42; mérito con 11/11 cursos
  devuelve 2 alumnos y excluye incompletos; con 1 nota devuelve 0. Build Angular y smoke
  12/12 OK. Sin migración ni cambios en Supabase.

## 4. Lo anterior implementado (docente + caja + H81, ya probado)

- **Docente:** Conclusiones usa `id_carga` para seleccionar el grado correcto; antes
  `id_curso` repetía el primer grado del mismo curso y ocultaba alumnos de otra sección.
  Notas y Conclusiones buscan por DNI, nombre o código y muestran contador/estado vacío.
- `GET /api/tesoreria/pagos?page=&pageSize=&search=&anio=`: historial paginado; `search`
  acepta DNI, nombres o código; `anio=todos` incluye años anteriores. `data` sigue siendo
  un arreglo y `pagination` lleva `total`/`totalPages`.
- La caja muestra 10 pagos por página, fecha de pago, DNI, comprobante, monto, medio,
  estado y descarga de boleta PDF.
- `GET /api/tesoreria/pensiones/padron?anio=&page=&pageSize=&search=&estado=`:
  alumnos + pensiones + estado general en **una sola consulta**. Tesorería carga 25 por
  página y dejó de hacer 75 peticiones.
- `GET /api/personal?page=&pageSize=`: paginación server-side; sin `page` conserva el
  arreglo histórico.
- `database/migracion_h81_rendimiento_paginacion.sql`: índices idempotentes.
- Responsive ADMIN/SECRETARÍA/DOCENTE y cabeceras dinámicas ya desplegados.
- Seed v2 y reset reproducible listos, pero **no ejecutados en Supabase**.

## 5. Archivos que se están usando

Backend:
- `siga-uc-backend/src/services/gmailRelayService.js` (relay Gmail por Apps Script)
- `siga-uc-backend/src/services/emailService.js` (Gmail relay, Resend y plantillas)
- `siga-uc-backend/src/services/notificacionService.js` (campanita + correo en lote)
- `siga-uc-backend/scripts/gmail-relay.gs` (código de la app web de Gmail)
- `siga-uc-backend/src/services/recuperacionService.js` (fallo de envío real)
- `siga-uc-backend/src/dao/reporteDao.js` (`getCuadroMerito` con notas completas)
- `siga-uc-backend/src/config/database.js` (zona horaria y health)
- `siga-uc-backend/src/dao/tesoreriaDao.js` (`listarPadronPensiones`)
- `siga-uc-backend/src/dao/personalDao.js` (`listarPaginado`)
- `siga-uc-backend/src/controllers/tesoreriaController.js`
- `siga-uc-backend/src/controllers/personalController.js`
- `siga-uc-backend/src/routes/tesoreriaRoutes.js`
- `siga-uc-backend/scripts/uat-seed.js`, `scripts/uat-verify.js`, `scripts/smoke.js`
- `siga-uc-backend/scripts/demo-reset.js`

Frontend:
- `siga-uc-frontend/src/app/features/admin/dashboard/dashboard.component.ts` (resultado de notificación)
- `siga-uc-frontend/src/app/features/auth/login/login.component.ts` (aviso de recuperación)
- `siga-uc-frontend/src/app/features/admin/reportes/` (mérito y nota de cursos)
- `siga-uc-frontend/src/app/features/secretaria/tesoreria/`
- `siga-uc-frontend/src/app/features/admin/personal/`
- `siga-uc-frontend/src/app/features/secretaria/caja/secretaria-caja.component.ts`
- `siga-uc-frontend/src/app/features/{admin,secretaria,docente}/layout/`
- `siga-uc-frontend/src/app/shared/components/{sidebar,sidebar-secretaria,sidebar-docente,header}/`

Base de datos y documentación:
- `database/migracion_h81_rendimiento_paginacion.sql`
- `database/demo_reset_seed_v2.sql`
- `HANDOFF_SESSION.md` (solo §2.0.3 y §6 si hace falta detalle)
- `AGENTS.md` (solo los bloques “Cuadro de mérito” y “Recuperación de contraseña y notificaciones”)

## 6. Cómo trabajar en la próxima sesión

1. **No analizar todo el repo ni leer documentación completa.** Abrir solo el archivo o
   módulo que el usuario indique.
2. No ejecutar smoke/E2E/integridad ni revisar pantallas “por si acaso”; ya están verdes.
3. No tocar `INFORME/` (documentación del usuario, no trackeada).
4. No activar 2027, no confirmar promociones y no cargar datos reales de menores.
5. Si el usuario pide un cambio: respetar MVC + DAO, SQL parametrizado, transacciones,
   respuestas uniformes y roles; commit atómico en español.
6. Si el usuario pide **“cierre final / borrar todo / iniciar desde 0”**: hacer backup,
   luego `database/demo_reset_seed_v2.sql` + `npm run uat:seed` (o recrear la base desde
   `siga_uc.sql` + migraciones). Ese es el único momento para tocar los datos de Supabase.

## 7. Prompts/decisiones que no hay que repetir

- No preguntar por la `DATABASE_URL` ni por la contraseña de Supabase: el usuario decidió
  dejar los datos como están por ahora.
- No volver a proponer el refresh del seed v2 hasta el cierre final.
- No volver a revisar la demo ni repetir las suites.
- No volver a diagnosticar la recuperación ni el mérito: ya están corregidos. El Gmail relay
  está configurado y envía a cualquier destinatario; si un correo falla, revisar la cuota de
  100/día o el secreto del relay, no el código.
- El cuadro de mérito no debe volver a promediar notas parciales: exigir todos los cursos.
- No comprar dominio para la demo: el Gmail relay cubre el requisito. Un dominio/Resend solo
  se evalúa si el colegio quiere producción con más volumen.
