# HANDOFF_SESSION.md — SIGA-UC

> **Fecha:** 27/11/2026
> **Fase:** demostración y aprobación. **No es producción real.**
> **Código funcional:** `07f5bac` (recuperación de contraseña con error real y cuadro de
> mérito solo con notas completas; incluye el fix docente `65429f9` y la caja `2864531`).
> **Render:** backend verificado con `07f5bac5`; frontend con `main-DST4JNBS.js`.
> `/api/health` devuelve `status: "ok"`, `dbReady: true`, `database: "ok"`,
> `zona_horaria: "America/Lima"` y el commit del backend.
> **Supabase demo:** se deja con el **seed v1 a propósito**; el borrado total será al
> cierre final, cuando el usuario lo pida.
> **Demo local v2:** base `siga_uc_h81` con 432 pagos y notas por perfil.
> **HEAD documental:** ver `git log -1`.
> **Repo:** `https://github.com/Yarol-Bello/siga-uc.git` · rama `main`.

> **Cierre de esta sesión:** la demo, el build y las suites ya fueron verificados. Los
> datos de Supabase se dejan con el seed v1 **a propósito**; el borrado total y reinicio
> desde 0 se hará al final, cuando el usuario lo pida. La próxima sesión **no debe
> volver a revisar módulos, ni ejecutar smoke/E2E/integridad, ni pedir credenciales de
> Supabase**.

---

## 1. Estado actual

SIGA-UC está funcional y desplegado en la demo:

| Entorno | URL / estado |
|---|---|
| Frontend | https://siga-uc-web.onrender.com |
| Backend | https://siga-uc-api-prod.onrender.com/api |
| Render desplegado | Backend `07f5bac5` · Frontend `main-DST4JNBS.js` (27/11/2026) |
| Health | OK, `status: "ok"`, `dbReady: true`, `database: "ok"`, `zona_horaria: "America/Lima"`, `commit` |
| Supabase | `siga-uc-prod` (us-west-2), 48 tablas, H74–H80, seed v1 |
| Año activo | 2026 |
| 2027 | No activo |
| Promociones confirmadas | 0 |
| Acta | 1 ABIERTO |
| Caja | 0 abiertas; se puede aperturar para la demo |
| Demo local v2 | `siga_uc_h81` (seed nuevo, sin tocar Supabase) |

### Datos demo cargados

| Dato | Supabase (v1) | Local v2 (`siga_uc_h81`) |
|---|---:|---:|
| Alumnos | 75 (15 por grado) | 75 (15 por grado) |
| Docentes activos | 6 | 6 |
| Secretaria | 1 | 1 |
| Carga curricular | 55 | 55 |
| Tutores | 5 | 5 |
| Horarios publicados | 145 | 145 |
| Pensiones | 750 (38 pagadas, 10 exoneradas) | 750 (357 pagadas, 386 pendientes, 7 exoneradas) |
| Pagos | 113 (todos el 23/11) | 432 (marzo–noviembre) |
| Recaudado del mes | S/ 28,500 (todo el año) | S/ 1,750 (7 pagos de noviembre) |
| Deuda pendiente | S/ 172,875 | S/ 95,625 |
| Alumnos con deuda | 74/75 | 74/75 |
| Notas finales | 3,300 | 3,300 |
| Calificaciones | 8,700 | 8,700 |
| Asistencias | 4,125 | 4,125 |
| Becas | 3 | 3 |
| Conclusiones estructuradas | 3,300 | 3,300 |
| Longitud máxima de conclusión | 252 caracteres | 252 caracteres |

Los 5 docentes demo antiguos (`99000001`–`99000005`) quedaron **INACTIVOS**.

---

## 2. Bloques recientes

### 2.0 Caja — historial paginado y búsqueda por DNI (27/11/2026)

- `GET /api/tesoreria/pagos` acepta `page`, `pageSize`, `search`, `anio=todos`,
  `estado`, `id_alumno`, `desde` y `hasta`; `data` sigue siendo un arreglo y agrega
  `pagination` (`total`, `totalPages`).
- La caja muestra 10 pagos por página, busca por DNI/nombres/código y permite cambiar
  entre año activo y todos los años.
- Cada fila muestra fecha de pago, DNI, comprobante, monto, medio, estado y permite
  descargar la boleta PDF.
- Sin migración: H81 ya tiene los índices de pagos.

### 2.0.1 Docente — conclusiones y búsqueda de alumnos (27/11/2026)

- El selector de Conclusiones usa `id_carga`, no `id_curso`. Un mismo curso se repite
  en varios grados; con `id_curso` el sistema cargaba el primer grado de ese curso y
  ocultaba al alumno matriculado en otra sección.
- Notas y Conclusiones incluyen búsqueda local por DNI, nombre o código, contador de
  resultados y estado vacío con opción de limpiar.
- Verificado con selector de Álgebra en 1ro–4to y un alumno nuevo en 3ro; build Angular OK.

### 2.0.2 Recuperación de contraseña y cuadro de mérito (27/11/2026)

- **Recuperación:** `recuperacionService` ahora espera y revisa el resultado de
  `emailService.enviarCorreo()`. Si Resend rechaza el envío, la API responde
  `{ tieneCorreo: true, enviado: false }` y la UI pide contactar al administrador; ya no
  se muestra un falso “correo enviado”.
- **Diagnóstico:** `emailService.verificarConexion()` advierte si `EMAIL_FROM` sigue usando
  `onboarding@resend.dev`. Ese remitente de prueba **solo entrega al correo dueño de la
  cuenta Resend**; para alumnos, docentes y secretaría se requiere un dominio verificado.
- **Producción:** con `07f5bac` desplegado, `POST /api/auth/recuperar-password` para el
  alumno `76543211` responde `200` con `{ tieneCorreo: true, enviado: false }`. La lógica
  ya reporta la verdad; **falta configurar Resend en Render** (API key válida y
  `EMAIL_FROM` con dominio verificado). No es un bug de código pendiente.
- **Mérito:** `getCuadroMerito` toma los cursos de `carga_curricular` del grado/año, cuenta
  cursos distintos con nota y solo rankea a quien tiene nota final en **todos**. Un alumno
  con una sola nota ya no aparece primero.
- **UI de mérito:** nota “Solo se incluyen estudiantes con nota final en todos los cursos
  del grado”, detalle `n/total cursos` junto al nombre y estado vacío actualizado.
- **Pruebas:** con 11/11 cursos cargados temporalmente, el DAO devolvió 2 alumnos y excluyó
  a los incompletos; con una sola nota devolvió 0 filas. La UI se verificó con datos
  simulados (nota, `11/11 cursos`, 2 filas y estado vacío). Los 22 registros temporales se
  borraron; la base local quedó como estaba.
- **Sin migración.** Documentación actualizada en `01`, `05`, `08`, `09`, `10`, `12`, `22` y
  `AGENTS.md`.

### 2.1 H80

**Conclusiones descriptivas estructuradas + código de control interno SIAGIE.**

### Base de datos

`database/migracion_h80_conclusiones_estructuradas.sql` agrega a
`conclusiones_descriptivas`:

- `nivel_logro` (AD/A/B/C)
- `avance`
- `dificultad`
- `sugerencia`
- `estado` (`BORRADOR`/`PUBLICADO`)
- auditoría de actualización/publicación

Y a `exportaciones_siagie`:

- `codigo_control`
- `hash_integridad` SHA-256
- `origen`
- `detalle` JSONB

### API

- `GET /api/calificaciones/curso/:id_curso/grado/:id_grado/conclusiones`
- `PUT /api/calificaciones/conclusiones`
- `GET /api/siagie/exportaciones/:codigo/verificar`

### Frontend

- **`/docente/conclusiones`**: nivel, avance, dificultad, sugerencia, contador
  350, plantilla de sugerencia, borrador/publicado y bloqueo por acta cerrada.
- **`/admin/siagie`**: tarjeta para verificar el código de control interno.
- El Excel interno incluye 15 columnas y una hoja `Aviso` con código/hash.

### Importante

El código es **interno**. No es el código oficial de SIAGIE/MINEDU. La integración
oficial requiere la plantilla oficial y conclusiones por competencia; está
documentada en `documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md`.

### 2.2 Demo v2 (23/11/2026)

**Zona horaria, KPI de tesorería, responsive, rendimiento y seed realista.**

- **Zona horaria:** `database.js` ejecuta `SET TIME ZONE 'America/Lima'` al abrir cada
  conexión, porque el pooler de Supabase ignora `options`. `/api/health` devuelve
  `zona_horaria` y `commit`. El smoke compara `ultimo_login` con el header `Date` (±3 min).
- **KPI de tesorería:** `pendiente.monto_pendiente` suma pre-tickets y pensiones;
  `alumnos_con_deuda` y `monto_pensiones` están disponibles. El dashboard ya no muestra
  S/ 0.00 mientras la tabla marca “Moroso”.
- **Responsive:** ADMIN, SECRETARÍA y DOCENTE usan drawer <900 px, overlay y cabeceras
  dinámicas por ruta. La matriz de pensiones muestra los 12 meses a 1280 px.
- **Rendimiento (H81) y caja:** `GET /api/tesoreria/pensiones/padron` trae alumnos +
  pensiones + estado general en una sola consulta (25 por página). Tesorería pasó de 76
  peticiones a 1 (~44 ms local). `GET /api/personal?page=` pagina personal y
  `GET /api/tesoreria/pagos?page=&pageSize=&search=&anio=` pagina la caja (10 por
  página) y busca boletas por DNI/nombre. La migración
  `migracion_h81_rendimiento_paginacion.sql` agrega índices idempotentes.
- **Seed v2 (local `siga_uc_h81`):** 432 pagos de marzo a noviembre, 750 pensiones
  (357 pagadas, 386 pendientes, 7 exoneradas), S/ 95,625 pendientes y notas por perfil
  (puntajes 11–39; 28/75 alumnos con al menos una C). **Supabase se deja con el seed v1 a
  propósito**; el borrado total y el reinicio desde 0 serán al cierre final.
- **Pruebas:** smoke 12, integridad 36, E2E 102, `uat:verify` 22 sobre `siga_uc_h81`,
  setup 5 y build Angular OK. La UI se verificó con 25 filas/página, búsqueda server-side
  y una sola petición por página.

---

## 3. Credenciales

### Demo Supabase / Render

| Rol | DNI | Contraseña |
|---|---|---|
| ADMIN | `74829102`, `74616052`, `71221313` o `72096799` | **la contraseña real del dueño** |
| SECRETARIA | `73000007` | `Secretaria2026*` |
| DOCENTE | `73000001` | `Docente2026*` |
| ESTUDIANTE | `72000001` | `UC72000001` |

Estudiantes `72000002`–`72000075`: contraseña `UC<DNI>`.

> El ADMIN de Supabase conserva su contraseña original. El seed UAT usó
> `UC2026*` temporalmente y la restauró; `UC2026*` **no** funciona en Supabase.
> Si se necesita un admin demo con `UC2026*`, crear una cuenta separada.

### Local

- Base `siga_uc_uat`: ADMIN `74829102 / UC2026*`.
- Base `siga_uc`: datos demo antiguos; no usar para la demo UAT.

---

## 4. Verificación

| Suite | Resultado |
|---|---|
| `npm run test:e2e` | **102 PASS, 0 FAIL** |
| `npm run test:integridad` en `siga_uc_uat` | **36 PASS, 0 FAIL** |
| `npm run test:integridad` en `siga_uc_h81` (seed v2) | **36 PASS, 0 FAIL** |
| `npm run test:integridad` en `siga_uc` | 33 PASS, 2 FAIL de seed conocidos |
| `npm run test:setup` | **5 PASS, 0 FAIL** |
| `npm run smoke` con credenciales UAT y chequeo de hora | **12 PASS, 0 FAIL** |
| `npm run uat:verify` en `siga_uc_h81` (seed v2) | **22 PASS, 0 FAIL** |
| `npm run uat:verify` contra Supabase (seed v1) | **22 PASS, 0 FAIL** |
| Build Angular | OK (warning de budget inicial) |
| Render producción | `07f5bac5`; recuperación y mérito desplegados; health OK con `status`/`dbReady` |
| Frontend producción | `main-DST4JNBS.js`; aviso de fallo de correo y nota de mérito |
| Recuperación — envío real (local) | OK; Resend devolvió message ID |
| Recuperación — fallo (local) | Con key inválida responde `{ tieneCorreo: true, enviado: false }`; la UI pide contactar al administrador |
| Recuperación — producción | `76543211` responde `enviado: false`; **falta configurar Resend en Render** |
| Mérito — backend local | 2 alumnos con 11/11 cursos; incompletos excluidos; con 1 nota, 0 filas |
| Mérito — UI local | Nota visible, `11/11 cursos`, 2 filas y estado vacío correcto |
| `npm run smoke` local (27/11/2026) | **12 PASS, 0 FAIL, 0 SKIP** |
| Caja producción | 116 pagos, 10/página; búsqueda DNI `72000059`: 3 pagos; PDF OK |
| Docente producción | `65429f9`; selector `id_carga` corregido y búsqueda DNI/nombre verificada |
| Rendimiento H81 | Tesorería: **1 petición**, 25 filas/página; Personal paginado; Caja 10 pagos/página con búsqueda |

> **No repetir estas suites en la próxima sesión.** Ya están verdes y el deploy está
> confirmado. Solo se vuelven a ejecutar si se cambia código o si el usuario lo pide.

Pruebas nuevas de H80:

- guardar borrador y publicar;
- rechazo de nivel inconsistente (`NIVEL_NO_COINCIDE`);
- rechazo de texto > 350 (`CONCLUSION_LARGA`);
- bloqueo por acta cerrada;
- código de control válido;
- detección de cambios en los datos;
- Excel con 15 columnas y hoja `Aviso`;
- pantalla docente y tarjeta de verificación en navegador.

---

## 5. Cómo arrancar local

El backend y el frontend **no están corriendo** al momento de este handoff.

```powershell
# Backend UAT (http://localhost:3000)
cd siga-uc-backend
$env:PORT='3000'
$env:DB_NAME='siga_uc_uat'
$env:NODE_ENV='development'
$env:ANIO_LECTIVO='2026'
$env:FRONTEND_URL='http://localhost:4200'
node src/app.js
```

```powershell
# Frontend (http://localhost:4200)
cd siga-uc-frontend
npm start
```

Health: `GET http://localhost:3000/api/health`.

---

## 6. Pendientes y próximos pasos

1. **Aprobación de la demo** por la dirección del colegio.
2. **Datos de Supabase: se dejan como están por decisión del usuario.** No refrescar,
   no pedir credenciales y no ejecutar `demo:reset`/`uat:seed` en esta etapa. La base
   demo sigue con el seed v1 (113 pagos, 38 pagadas, 10 exoneradas) **a propósito**.
   Al cierre final se borrará todo y el sistema iniciará desde 0; para ese momento ya
   están listos `database/demo_reset_seed_v2.sql`, `npm run demo:reset` y
   `npm run uat:seed`.
3. **Timestamps viejos de Supabase:** también se resolverán con el borrado/reinicio
   final. No ejecutar normalizaciones ni cambios de datos ahora. Si en el futuro se
   reactiva el refresh, aplicar `database/migracion_h81_rendimiento_paginacion.sql` y
   `ALTER DATABASE postgres SET timezone = 'America/Lima';` si el pooler es transaccional.
4. ✅ **Render desplegado y verificado**: backend `07f5bac5` con health `status: "ok"`,
   `dbReady: true` y `zona_horaria: "America/Lima"`; frontend `main-DST4JNBS.js` con
   recuperación honesta y mérito completo. **No repetir la revisión de módulos ni las
   suites.**
5. ⛔ **Correo de recuperación en producción — acción del usuario:** la API ya reporta
   `enviado: false`, pero Render no puede entregar porque su configuración de Resend no
   sirve para destinatarios arbitrarios. Hay que:
   - verificar un dominio en Resend (DNS: SPF/DKIM);
   - usar `EMAIL_FROM=SIGA-UC <no-reply@dominio-verificado>`;
   - cargar una `RESEND_API_KEY` válida en Render;
   - confirmar `FRONTEND_URL=https://siga-uc-web.onrender.com`;
   - redeploy del backend y probar con un correo real de alumno/docente.
   Sin dominio verificado, `onboarding@resend.dev` solo entrega al dueño de la cuenta.
6. **SIAGIE oficial** (solo si el colegio lo pide):
   - obtener la plantilla oficial de SIAGIE;
   - mapear áreas/cursos/competencias;
   - conclusiones por competencia;
   - llenar la plantilla oficial conservando su código y nombre;
   - SIAGIE valida al subir el archivo.
7. **No activar 2027** ni confirmar promociones en Supabase sin decisión.
8. **No cargar datos reales** de menores hasta la aprobación.
9. `INFORME/` es documentación del usuario y **no está trackeada**; no tocar.

---

## 7. Archivos clave

- `AGENTS.md` — resumen operativo y trampas conocidas.
- `CONTEXTO_SESION.md` — **lectura mínima para la próxima sesión** (una página).
- `documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md` — H80 y límites de SIAGIE.
- `documentacion/17-GUION-DEMOSTRACION.md` — guion actualizado.
- `documentacion/05-API-REST.md` — 168 endpoints.
- `documentacion/04-BASE-DE-DATOS.md` — 48 tablas y columnas H80.
- `database/migracion_h80_conclusiones_estructuradas.sql`.
- `database/migracion_h81_rendimiento_paginacion.sql` — índices de H81.
- `database/demo_h80_conclusiones.sql` — solo demo.
- `siga-uc-backend/src/config/database.js` — zona horaria, pool y health.
- `siga-uc-backend/scripts/uat-seed.js` y `uat-verify.js`.
- `siga-uc-backend/scripts/demo-reset.js` — limpieza demo previa al seed.
- `siga-uc-backend/scripts/smoke.js` — health, RBAC y desfase horario.
- `siga-uc-backend/src/dao/reporteDao.js` — `getCuadroMerito` exige notas completas.
- `siga-uc-backend/src/services/recuperacionService.js` — recuperación y fallo de Resend.
- `siga-uc-backend/src/services/emailService.js` — Resend y advertencia de remitente.
- `siga-uc-frontend/src/app/features/auth/login/login.component.ts` — aviso de recuperación.
- `siga-uc-frontend/src/app/features/admin/reportes/` — cuadro de mérito y nota de cursos.
- `siga-uc-backend/src/dao/tesoreriaDao.js` — `listarPadronPensiones`.
- `siga-uc-backend/src/dao/personalDao.js` — `listarPaginado`.
- `siga-uc-frontend/src/app/features/{admin,secretaria,docente}/layout/` — drawers y cabeceras.
- `siga-uc-frontend/src/app/features/secretaria/tesoreria/` — matriz compacta y padron paginado.
- `siga-uc-frontend/src/app/features/admin/personal/` — paginación de personal.
- `siga-uc-frontend/src/app/features/docente/conclusiones/`.
- `siga-uc-frontend/src/app/features/admin/siagie/`.

Documentos históricos 15, 16, 18, `HANDOFF_PROMPTS.md`, `docs/INSTALACION.md` y
`docs/GUIA_TESTEO.md` fueron retirados del árbol; siguen en el historial de Git.

---

## 8. Prompt para la nueva sesión

Copiar y pegar:

```text
Estás retomando SIGA-UC, la demo del Sistema Integrado de Gestión Académica de la
I.E.P. Unión Científica (Huancayo, Perú). No es producción real.

NO reanalices el repo, NO leas AGENTS.md, HANDOFF_SESSION.md ni documentacion/ completos.
Lee solo CONTEXTO_SESION.md (una página) si necesitas el detalle.

ESTADO
- main = 07f5bac; Render verificado (backend 07f5bac5, frontend main-DST4JNBS.js);
  /api/health: status ok, dbReady true, database ok, zona_horaria America/Lima.
- Demo funcional y suites verdes; no las repitas.
- Supabase se queda con el seed v1 A PROPÓSITO. NO refrescar datos, NO pedir
  DATABASE_URL ni contraseñas, NO ejecutar demo:reset/uat:seed ahora.
- El borrado total y el inicio desde 0 serán al final, cuando el usuario lo pida.
- H81 ya está resuelto: /api/tesoreria/pensiones/padron (25/página, una petición),
  /api/personal?page= y /api/tesoreria/pagos?page=&pageSize=&search=&anio=
  (10/página, búsqueda por DNI). No volver a revisarlo.
- Docente: los selectores de curso usan id_carga, no id_curso. Notas y Conclusiones
  ya tienen búsqueda por DNI/nombre/código. No volver a revisarlo.
- Recuperación: la API ya distingue envío real de fallo (enviado true/false). En
  producción responde enviado=false porque Resend en Render no tiene dominio/key
  válidos. Es configuración, no código. El usuario debe verificar dominio y cargar
  RESEND_API_KEY + EMAIL_FROM en Render.
- Mérito: solo alumnos con nota final en todos los cursos de carga_curricular. Un
  alumno con una sola nota no se rankea. No volver a revisarlo.

ARCHIVOS QUE SE ESTÁN USANDO
- Backend: src/config/database.js, src/dao/tesoreriaDao.js, src/dao/personalDao.js,
  src/controllers/tesoreriaController.js, src/controllers/personalController.js,
  src/routes/tesoreriaRoutes.js, scripts/{uat-seed,uat-verify,smoke,demo-reset}.js.
- Frontend: features/secretaria/tesoreria/, features/admin/personal/,
  features/secretaria/caja/, features/{admin,secretaria,docente}/layout/,
  shared/components/{sidebar,sidebar-secretaria,sidebar-docente,header}/.
- BD: database/migracion_h81_rendimiento_paginacion.sql,
  database/demo_reset_seed_v2.sql.

CÓMO TRABAJAR
- Abre solo el archivo o módulo que se te indique; no recorras todo el proyecto.
- No ejecutes smoke/E2E/integridad ni revises pantallas “por si acaso”.
- No toques INFORME/.
- No actives 2027, no confirmes promociones y no cargues datos reales de menores.
- Si el usuario pide el cierre final: backup y luego demo_reset_seed_v2.sql +
  uat:seed, o recrear la base desde siga_uc.sql + migraciones.
```
