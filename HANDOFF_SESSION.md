# HANDOFF_SESSION.md — SIGA-UC

> **Fecha:** 23/11/2026
> **Fase:** demostración y aprobación. **No es producción real.**
> **Código funcional:** `e010362` (zona horaria, KPI de tesorería, responsive y seed v2).
> **Render:** auto-deploy al push de `main`; verificar `/api/health` (`commit` y
> `zona_horaria`).
> **Supabase demo:** sigue con el **seed v1** hasta ejecutar el refresh con credenciales.
> **Demo local v2:** base `siga_uc_h81` con 432 pagos y notas por perfil.
> **HEAD documental:** ver `git log -1`.
> **Repo:** `https://github.com/Yarol-Bello/siga-uc.git` · rama `main`.

---

## 1. Estado actual

SIGA-UC está funcional y desplegado en la demo:

| Entorno | URL / estado |
|---|---|
| Frontend | https://siga-uc-web.onrender.com |
| Backend | https://siga-uc-api-prod.onrender.com/api |
| Health | OK, `database: "ok"`, `zona_horaria` y `commit` |
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

**Zona horaria, KPI de tesorería, responsive y seed realista.**

- **Zona horaria:** `database.js` ejecuta `SET TIME ZONE 'America/Lima'` al abrir cada
  conexión, porque el pooler de Supabase ignora `options`. `/api/health` devuelve
  `zona_horaria` y `commit`. El smoke compara `ultimo_login` con el header `Date` (±3 min).
- **KPI de tesorería:** `pendiente.monto_pendiente` suma pre-tickets y pensiones;
  `alumnos_con_deuda` y `monto_pensiones` están disponibles. El dashboard ya no muestra
  S/ 0.00 mientras la tabla marca “Moroso”.
- **Responsive:** ADMIN, SECRETARÍA y DOCENTE usan drawer <900 px, overlay y cabeceras
  dinámicas por ruta. La matriz de pensiones muestra los 12 meses a 1280 px.
- **Seed v2 (local `siga_uc_h81`):** 432 pagos de marzo a noviembre, 750 pensiones
  (357 pagadas, 386 pendientes, 7 exoneradas), S/ 95,625 pendientes y notas por perfil
  (puntajes 11–39; 28/75 alumnos con al menos una C). El seed v1 de Supabase sigue
  pendiente de refresh.
- **Pruebas:** smoke 12, integridad 36, E2E 102, `uat:verify` 22 sobre `siga_uc_h81`,
  setup 5 y build Angular OK.

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
2. **Refrescar Supabase demo al seed v2** (pendiente de credenciales): la base sigue con
   113 pagos, 38 pensiones pagadas y 10 exoneradas. El seed v2 está validado en local
   (`siga_uc_h81`): 432 pagos, 357 pagadas, 386 pendientes, 7 exoneradas y S/ 95,625.
   Sin la `DATABASE_URL`/contraseña actual no se puede ejecutar el refresh ni limpiar las
   4 aperturas/cierres de la verificación UAT.
3. **Normalizar timestamps viejos de Supabase:** el fix de zona horaria corrige los
   registros nuevos, pero los `timestamp without time zone` guardados antes del deploy
   siguen +5 h. Se corrigen con el refresh del seed o con un script de normalización
   respaldado. En Supabase conviene además
   `ALTER DATABASE postgres SET timezone = 'America/Lima';` si el pooler es transaccional.
4. **Verificar Render** después del push: `/api/health` debe devolver `commit` nuevo y
   `zona_horaria: "America/Lima"`; luego correr smoke contra la URL de producción.
5. **SIAGIE oficial** (solo si el colegio lo pide):
   - obtener la plantilla oficial de SIAGIE;
   - mapear áreas/cursos/competencias;
   - conclusiones por competencia;
   - llenar la plantilla oficial conservando su código y nombre;
   - SIAGIE valida al subir el archivo.
6. **No activar 2027** ni confirmar promociones en Supabase sin decisión.
7. **No cargar datos reales** de menores hasta la aprobación.
8. `INFORME/` es documentación del usuario y **no está trackeada**; no tocar.

---

## 7. Archivos clave

- `AGENTS.md` — resumen operativo y trampas conocidas.
- `documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md` — H80 y límites de SIAGIE.
- `documentacion/17-GUION-DEMOSTRACION.md` — guion actualizado.
- `documentacion/05-API-REST.md` — 168 endpoints.
- `documentacion/04-BASE-DE-DATOS.md` — 48 tablas y columnas H80.
- `database/migracion_h80_conclusiones_estructuradas.sql`.
- `database/demo_h80_conclusiones.sql` — solo demo.
- `siga-uc-backend/src/config/database.js` — zona horaria, pool y health.
- `siga-uc-backend/scripts/uat-seed.js` y `uat-verify.js`.
- `siga-uc-backend/scripts/smoke.js` — health, RBAC y desfase horario.
- `siga-uc-frontend/src/app/features/{admin,secretaria,docente}/layout/` — drawers y cabeceras.
- `siga-uc-frontend/src/app/features/secretaria/tesoreria/` — matriz compacta de pensiones.
- `siga-uc-frontend/src/app/features/docente/conclusiones/`.
- `siga-uc-frontend/src/app/features/admin/siagie/`.

Documentos históricos 15, 16, 18, `HANDOFF_PROMPTS.md`, `docs/INSTALACION.md` y
`docs/GUIA_TESTEO.md` fueron retirados del árbol; siguen en el historial de Git.

---

## 8. Prompt para la nueva sesión

Copiar y pegar:

```text
Estás retomando SIGA-UC, el Sistema Integrado de Gestión Académica de la
I.E.P. Unión Científica (Huancayo, Perú). Es una demo funcional, no producción
real. Lee primero AGENTS.md y HANDOFF_SESSION.md; luego consulta
documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md si el trabajo es de SIAGIE.

ESTADO ACTUAL
- Repo: https://github.com/Yarol-Bello/siga-uc.git, rama main.
- Código funcional: e010362 (H74–H80 + bloque demo v2). Verificar el commit real en
  `GET /api/health` (`commit`) tras el deploy de Render.
- Frontend: https://siga-uc-web.onrender.com
- Backend: https://siga-uc-api-prod.onrender.com/api (health OK, `zona_horaria`).
- Supabase demo `siga-uc-prod`: 48 tablas, H74–H80, 2026 ACTIVO, 2027 no activo,
  0 promociones, 1 acta ABIERTO, 75 alumnos, 6 docentes activos, 55 carga,
  145 horarios, 750 pensiones, 113 pagos (seed v1), 3 becas y 3,300 conclusiones.
- Demo local v2 en `siga_uc_h81`: 432 pagos de marzo a noviembre, 357 pensiones pagadas,
  386 pendientes, 7 exoneradas, S/ 95,625 de deuda, notas por perfil (28/75 con una C).
- Demo v2: zona horaria forzada a America/Lima por conexión, KPI de tesorería con
  pensiones, responsive ADMIN/SECRETARÍA/DOCENTE y cabeceras dinámicas.
- H80: conclusiones con nivel + avance + dificultad + sugerencia y código/hash interno
  SIAGIE. El código es interno, NO el oficial de SIAGIE.
- Tests: E2E 102, integridad 36 (UAT y h81), setup 5, smoke 12, uat:verify 22 (h81 y
  Supabase v1), build Angular OK.
- El ADMIN de Supabase conserva su contraseña real; UC2026* solo funciona en local.
  DOCENTE 73000001 / Docente2026*; ESTUDIANTE 72000001 / UC72000001;
  SECRETARIA 73000007 / Secretaria2026*.

PENDIENTE INMEDIATO
- Refrescar Supabase al seed v2 y limpiar las 4 cajas UAT: requiere la DATABASE_URL o
  la contraseña actual del proyecto.
- Normalizar los timestamps viejos (+5 h) o rehacer el seed. Los registros nuevos ya
  salen correctos.
- Verificar Render: health con `commit` nuevo y `zona_horaria: America/Lima`.

REGLAS
- No activar 2027, no confirmar promociones y no cargar datos reales de menores.
- No tocar la carpeta INFORME/ (es documentación del usuario y no está trackeada).
- Mantener MVC + DAO, SQL parametrizado, transacciones, respuestas uniformes y roles.
- Antes de cambios de esquema, leer database/README.md y documentacion/04.
- Si el pedido es SIAGIE oficial, pedir primero la plantilla oficial; no inventar
  códigos de SIAGIE.

TAREA DE ESTA SESIÓN
1. Verificar git status, health de Render y estado de Supabase sin modificar datos.
2. Revisar la demo: conclusiones, SIAGIE interno, tesorería, caja, notas y reportes.
3. Si hay credenciales, refrescar Supabase al seed v2 y normalizar timestamps.
4. Si se implementa algo: migración idempotente, backend, frontend, tests,
   documentación y commit atómico en español.
```
