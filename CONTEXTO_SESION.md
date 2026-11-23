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
- Código desplegado y verificado: **`5f3512d`** (los commits posteriores son solo
  documentación). El health siempre muestra el HEAD; no comparar el hash si solo cambió docs.
- Health: `database: "ok"`, `zona_horaria: "America/Lima"`, `commit` del HEAD.

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
- **Render:** ya desplegó `5f3512d`; no volver a desplegar si no hay cambios de código.

## 3. Lo último implementado (H81, ya probado)

- `GET /api/tesoreria/pensiones/padron?anio=&page=&pageSize=&search=&estado=`:
  alumnos + pensiones + estado general en **una sola consulta**. Tesorería carga 25 por
  página y dejó de hacer 75 peticiones.
- `GET /api/personal?page=&pageSize=`: paginación server-side; sin `page` conserva el
  arreglo histórico.
- `GET /api/tesoreria/pagos?limit=50`: la caja ya no descarga todo el historial.
- `database/migracion_h81_rendimiento_paginacion.sql`: índices idempotentes.
- Responsive ADMIN/SECRETARÍA/DOCENTE y cabeceras dinámicas ya desplegados.
- Seed v2 y reset reproducible listos, pero **no ejecutados en Supabase**.

## 4. Archivos que se están usando

Backend:
- `siga-uc-backend/src/config/database.js` (zona horaria y health)
- `siga-uc-backend/src/dao/tesoreriaDao.js` (`listarPadronPensiones`)
- `siga-uc-backend/src/dao/personalDao.js` (`listarPaginado`)
- `siga-uc-backend/src/controllers/tesoreriaController.js`
- `siga-uc-backend/src/controllers/personalController.js`
- `siga-uc-backend/src/routes/tesoreriaRoutes.js`
- `siga-uc-backend/scripts/uat-seed.js`, `scripts/uat-verify.js`, `scripts/smoke.js`
- `siga-uc-backend/scripts/demo-reset.js`

Frontend:
- `siga-uc-frontend/src/app/features/secretaria/tesoreria/`
- `siga-uc-frontend/src/app/features/admin/personal/`
- `siga-uc-frontend/src/app/features/secretaria/caja/secretaria-caja.component.ts`
- `siga-uc-frontend/src/app/features/{admin,secretaria,docente}/layout/`
- `siga-uc-frontend/src/app/shared/components/{sidebar,sidebar-secretaria,sidebar-docente,header}/`

Base de datos y documentación:
- `database/migracion_h81_rendimiento_paginacion.sql`
- `database/demo_reset_seed_v2.sql`
- `HANDOFF_SESSION.md` (solo §2.2 y §6 si hace falta detalle)
- `AGENTS.md` (solo el bloque “Rendimiento (H81)” y “Cierre 23/11/2026”)

## 5. Cómo trabajar en la próxima sesión

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

## 6. Prompts/decisiones que no hay que repetir

- No preguntar por la `DATABASE_URL` ni por la contraseña de Supabase: el usuario decidió
  dejar los datos como están por ahora.
- No volver a proponer el refresh del seed v2 hasta el cierre final.
- No volver a revisar la demo ni repetir las suites.
