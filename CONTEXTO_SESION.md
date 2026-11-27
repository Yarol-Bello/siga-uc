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
- Código desplegado y verificado: **`07f5bac`** (backend health `07f5bac5`, frontend
  `main-DST4JNBS.js`). Incluye recuperación de contraseña honesta, cuadro de mérito con
  notas completas, el fix docente `65429f9` y la caja `2864531`. El `commit` del health
  corresponde al backend; no comparar con el hash del frontend.
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
- **Render:** backend `07f5bac5` y frontend `main-DST4JNBS.js`; caja, docente,
  recuperación y mérito verificados.
- **Recuperación de contraseña:** si Resend falla, la API responde
  `{ tieneCorreo: true, enviado: false }` y la UI pide contactar al administrador.
  **En producción sigue en `enviado: false`**: falta configurar en Render un dominio
  verificado de Resend, `EMAIL_FROM` con ese dominio y una `RESEND_API_KEY` válida.
  Es acción del usuario, no código pendiente.
- **Cuadro de mérito:** solo rankea alumnos con nota final en todos los cursos de
  `carga_curricular` del grado/bimestre/año. Un alumno con una sola nota ya no aparece.

## 3. Lo último implementado (recuperación + mérito, ya probado)

- **Recuperación:** `recuperacionService` espera `emailService.enviarCorreo()` y propaga
  el fallo; `emailService` advierte si `EMAIL_FROM` usa `onboarding@resend.dev`.
  `onboarding@resend.dev` solo entrega al dueño de la cuenta Resend.
- **Mérito:** `reporteDao.getCuadroMerito` cuenta cursos distintos de la carga y exige
  `total_cursos = total_cursos_carga`; agrega `total_cursos_carga` a la respuesta.
- **UI:** nota de integridad, `n/total cursos` junto al nombre y estado vacío actualizado.
- **Pruebas:** fallo simulado de Resend → `enviado:false`; envío real local OK; mérito con
  11/11 cursos devuelve 2 alumnos y excluye incompletos; con 1 nota devuelve 0.
  Build Angular y smoke 12/12 OK. Sin migración.

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
- `siga-uc-backend/src/services/recuperacionService.js` (fallo de envío real)
- `siga-uc-backend/src/services/emailService.js` (Resend y advertencia de remitente)
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
- `HANDOFF_SESSION.md` (solo §2.0.2 y §6 si hace falta detalle)
- `AGENTS.md` (solo los bloques “Cuadro de mérito” y “Recuperación de contraseña”)

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
- No volver a diagnosticar la recuperación ni el mérito: ya están corregidos. Si el correo
  sigue sin llegar, es configuración de Resend en Render, no código.
- El cuadro de mérito no debe volver a promediar notas parciales: exigir todos los cursos.
