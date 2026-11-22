# AGENTS.md — SIGA-UC (resumen operativo)

> Documentación detallada: **`documentacion/README.md`**.
> Fuente de verdad: **el código** (`siga-uc-backend`, `siga-uc-frontend`),
> `database/siga_uc.sql` (esquema base) y `database/seed_produccion.sql` (catálogos).
> `database/siga_uc_completo.sql` es solo el dump de demo. Si este resumen difiere del
> código, manda el código.

---

## 1. Qué es

**SIGA-UC** — Sistema Integrado de Gestión Académica de la I.E.P. Unión Científica
(Huancayo, Junín, Perú). Digitaliza matrícula, notas por competencias MINEDU, asistencia QR,
tesorería, caja, reportes, SIAGIE, notificaciones y auditoría.

- Repo: `https://github.com/Yarol-Bello/siga-uc.git` (rama `main`)
- Ruta local: `C:\Users\yarol\Documents\Proyectos\siga-uc`
- Estado: funcional; pendiente documentación final, despliegue y mejoras.

---

## 2. Stack real (verificado)

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21.2 standalone + signals + Bootstrap 5 + FontAwesome 7 + qrcode |
| Backend | Node.js 20 + Express 5 (CommonJS) |
| Base de datos | PostgreSQL 18.4 (`pgcrypto`, `unaccent`, `uuid-ossp`) |
| Auth | JWT 8 h + bcrypt coste 10 |
| Correo | **Resend** (API HTTP), no Nodemailer/SMTP |
| Excel | ExcelJS + Multer (SIAGIE) |
| PDF | PDFKit + fuentes estándar (libretas) |
| SQL | Crudo parametrizado (sin ORM) |
| Tests/CI/Docker | No existen |

**Conteos actuales:** 41 tablas base (42 en local con `horarios_h47_backup`) · 119 endpoints ·
4 roles · 16 routers · 16 controladores · 24 servicios · 20 DAOs · 86 archivos JS backend ·
142 archivos frontend (59 TS).

---

## 3. Estructura

```text
siga-uc/
├── database/          siga_uc.sql (esquema), seed_produccion.sql (producción), siga_uc_completo.sql (demo), migraciones
├── docs/              documentación operativa previa (parcialmente desactualizada)
├── documentacion/     documentación detallada y vigente
├── siga-uc-backend/   API REST
└── siga-uc-frontend/  SPA Angular
```

Backend: `routes → controllers → services → DAOs → PostgreSQL`.
Frontend: `core/` (guards, interceptor, servicios), `shared/` (header, sidebars),
`features/` (admin, docente, estudiante, secretaria, auth).

---

## 4. Cómo ejecutar

Requisitos: Node 20.20.2, PostgreSQL 18, Angular CLI 21.

```powershell
# Terminal 1 — Backend (http://localhost:3000)
nvm use 20
cd siga-uc-backend
copy .env.example .env   # completar DB_*, JWT_SECRET, ANIO_LECTIVO y RESEND_API_KEY
npm install
npm run dev

# Terminal 2 — Frontend (http://localhost:4200)
cd siga-uc-frontend
npm install
ng serve
```

Base de datos — **dos escenarios excluyentes**:

```powershell
# A) Desarrollo / demo (datos ficticios; NUNCA en producción)
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc_completo.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
psql -U postgres -d siga_uc -f database/migracion_h45_pensiones_anuladas.sql
psql -U postgres -d siga_uc -f database/migracion_h47_horarios.sql
psql -U postgres -d siga_uc -f database/migracion_h48_actas.sql
psql -U postgres -d siga_uc -f database/migracion_h61_dia_semana.sql
psql -U postgres -d siga_uc -f database/migracion_h49_multianio_base.sql

# B) Producción (catálogos + admin; sin datos ficticios)
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc.sql
psql -U postgres -d siga_uc -v anio_lectivo=2027 -v admin_password="TuClaveTemporal" -f database/seed_produccion.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
psql -U postgres -d siga_uc -f database/migracion_h45_pensiones_anuladas.sql
psql -U postgres -d siga_uc -f database/migracion_h47_horarios.sql
psql -U postgres -d siga_uc -f database/migracion_h48_actas.sql
psql -U postgres -d siga_uc -f database/migracion_h61_dia_semana.sql
psql -U postgres -d siga_uc -f database/migracion_h49_multianio_base.sql
```

> **H49:** antes de ejecutar `migracion_h49_multianio_base.sql`, editar `_param_anio` al año
> de la instalación (`2026` en demo, `2027` en producción). El seed exige
> `-v anio_lectivo`; si falta, aborta y no usa el año calendario.

> `siga_uc_completo.sql` es el **dump de demo** (esquema + 21 alumnos ficticios +
> pagos/pensiones de ejemplo). No usar en producción: contiene pensiones `PAGADO`
> sin pago que las respalde. Producción usa `siga_uc.sql` + `seed_produccion.sql`,
> que crea solo catálogos, una caja y un admin con cambio de contraseña obligatorio.
> No mezclar ambos escenarios. Detalle en `database/README.md`.

Health check: `GET http://localhost:3000/api/health`.

Backup de la base (requiere `pg_dump`):

```powershell
cd siga-uc-backend
npm run backup   # genera backups/backup_siga_uc_YYYY-MM-DD_HH-mm-ss.sql
```

> `.env.example` todavía muestra SMTP. El correo real usa `RESEND_API_KEY` y `EMAIL_FROM`.

---

## 5. Roles

| Rol | ID | Acceso |
|---|---|---|
| ADMIN | 1 | Todos los módulos |
| DOCENTE | 2 | Cursos, notas, asistencia, ficha, reportes de aula |
| SECRETARIA | 3 | Padrón, tesorería, caja, QR de personal |
| ESTUDIANTE | 4 | Notas, asistencia y horario propios |

Credenciales de prueba: `docs/CREDENCIALES.md`.
Admin: `74829102 / UC2026*`. Estudiantes: `UC<DNI>`.

---

## 6. Reglas críticas para cambios

1. **MVC + DAO obligatorio** en backend. No saltar capas.
2. **SQL parametrizado** (`$1, $2...`). Nunca concatenar valores.
3. **Transacciones** (`getClient` + `BEGIN/COMMIT/ROLLBACK`) en operaciones multi-tabla.
4. **Respuesta uniforme:** `{ success, message, data, timestamp }`.
5. **Correo real = `correo_personal || correo_institucional`.** El institucional es decorativo.
6. **JWT + roles:** `verificarAutenticacion` en todos los routers; `verificarRol(...)` en
   escrituras y reportes.
7. **Frontend:** signals, `inject()`, modales con `@if` + `.modal-overlay` +
   `stopPropagation()`, loading apagado primero en `error:`.
8. **Números de PostgreSQL:** usar `Number(x) || 0`.
9. **Orden de rutas:** fijas antes de paramétricas (`/roles` antes de `/:id`; `reset-password`
   antes de `**`).
10. **Año lectivo configurable:** `ANIO_LECTIVO` es bootstrap/fallback; la fuente principal
    es `anios_lectivos.estado='ACTIVO'`, cargada por `cargarAnioActivo()` al arrancar.
    `getAnioLectivo()` sigue siendo síncrona; `ConfiguracionService` en frontend. No
    introducir literales `2026`. `?anio=YYYY` explícito tiene prioridad para históricos.
    `alumnos` es matrícula anual: no asumir un alumno por persona sin filtrar año.
11. **No cambiar el stack** sin justificación.
12. **Commits:** `feat:`, `Fix:`, `Add:`, `DB:`, `docs:`, `chore:` + módulo + descripción en
    español, atómicos.

---

## 7. Mapa rápido de módulos

| Módulo | Backend | Frontend |
|---|---|---|
| Auth | `authRoutes/Controller/Service` | `features/auth`, `core/services/auth.service` |
| Alumnos | `alumnoRoutes/Controller/Service/Dao` | `admin/alumnos`, `secretaria/padron` |
| Personal | `personalRoutes/...` | `admin/personal` |
| Carga curricular | `cargaCurricularRoutes/...` | `admin/carga-curricular` |
| Horarios | `horarioRoutes/...` | `admin/horarios`, `secretaria/horarios`, `docente/horario`, `estudiante/horario` |
| Años lectivos / Rollover | `anioLectivoRoutes/Controller/Service`, `rolloverService/Dao` | `admin/anios-lectivos` |
| Asistencia | `asistenciaRoutes/...` | `docente/asistencia`, `admin/asistencia-qr`, `estudiante/asistencia` |
| Calificaciones | `calificacionRoutes/...` | `docente/notas`, `estudiante/dashboard`, `docente/ficha` |
| Tesorería | `tesoreriaRoutes/...` | `secretaria/tesoreria` (wrapper admin) |
| Caja | `cajaRoutes/...` | `secretaria/caja` (wrapper admin) |
| Reportes | `reporteRoutes/...` | `admin/reportes`, `docente/reportes` |
| Auditoría | `auditoriaRoutes/...` | `admin/auditoria` |
| SIAGIE | `siagieRoutes/...` | `admin/siagie` |
| Notificaciones | `notificacionRoutes/...` | header + `core/services/notificacion.service` |

---

## 8. Trampas conocidas (revisar antes de diagnosticar)

- `siga_uc_completo.sql` es **solo demo**: 21 alumnos ficticios y más de 140 pensiones
  `PAGADO` sin pago. Producción se instala con `siga_uc.sql` + `seed_produccion.sql`.
  No cargar ambos escenarios en la misma base.
- La documentación antigua decía 26 tablas; son **41 base** (42 en local con
  `horarios_h47_backup`).
- El correo es **Resend**, no SMTP/Nodemailer.
- **`alumnos` es matrícula anual**, no identidad: `usuarios` es único por DNI; `alumnos` es
  único por `(dni, anio_lectivo)`, `(id_usuario, anio_lectivo)` y
  `(codigo_estudiante, anio_lectivo)` desde H49. No asumir un alumno por persona sin filtrar
  año; los históricos usan `?anio=YYYY`.
- El **año activo** se lee de `anios_lectivos.estado='ACTIVO'` al arrancar; `ANIO_LECTIVO`
  es bootstrap/respaldo. Desde 6.2, la activación desde la UI/API actualiza la caché sin
  reiniciar; un cambio manual por SQL sí exige reiniciar el backend.
- **6.1 y 6.2 están desplegadas en Render** (código `f05ecc5`; frontend 6.2 verificado).
  **H49 no está aplicado en Supabase** (demo con 40 tablas): la pantalla
  `/admin/anios-lectivos` responde `503 H49_NO_APLICADO` hasta aplicarlo. No aplicar la
  migración allí sin autorización y backup previo. El rollback H49 es solo para bases
  desechables. 2026 sigue activo en Supabase.
- **6.2 no agrega migración**: opera sobre H49 desde `/admin/anios-lectivos`. Si la tabla
  `anios_lectivos` no existe, los endpoints responden `503 H49_NO_APLICADO`, no 500.
- El rollover clona solo **grados, conceptos, períodos, carga y tutores**. No crea alumnos,
  matrículas, pagos, notas, asistencia, actas, becas, QR ni horarios. La promoción es 6.3.
- La activación solo acepta `PLANIFICADO → ACTIVO`, exige 1 grado y 1 concepto `MATRICULA`,
  cierra el año activo anterior y deja un solo `ACTIVO`. No reactivar `CERRADO` en 6.2.
  **No activar 2027 en Supabase** sin 6.3; los alumnos sin matrícula del año nuevo quedan
  con `matricula_activa=false`.
- La reversión solo borra un rollover vacío y exacto: año `PLANIFICADO`, no activo, sin
  matrículas/pagos/notas/asistencia/actas/horarios y con la marca `Rollover desde YYYY` en
  `anios_lectivos.observacion`. Una oferta manual distinta aborta con `409`.
- El `preview_hash` se recalcula dentro de la transacción. Si cambió la fuente, la actividad
  o los conflictos, el confirm responde `409 PREVIEW_DESACTUALIZADA`. El hash no incluye la
  oferta del destino para que el confirm repetido sea idempotente.
- En local `siga_uc` las 142 h de carga están en el ADMIN y el preview bloquea por
  sobrecapacidad; es correcto. La demo de Supabase tiene 5 docentes con 30/30/30/30/25 h y
  el E2E reequilibra su base desechable.
- La matrícula crea al alumno en **`PendientePago`**; solo el pago de matrícula lo pasa a
  `Matriculado`. El grado y el concepto `MATRICULA` deben ser del año de la matrícula.
- El retiro es transaccional: pasa la matrícula a `Retirado`, congela el expediente (`H19`) y
  anula pensiones/pre-tickets futuros (`H45`). Deja al usuario `INACTIVO` **solo si no tiene
  otra matrícula no retirada** en otro año (`H49`). La edición de nombres/apellidos
  sincroniza `usuarios` (`H20`).
- Un **ESTUDIANTE sin matrícula del año activo** puede iniciar sesión con
  `matricula_activa=false`; los endpoints académicos propios responden
  `403 SIN_MATRICULA_ACTIVA`. La UI muestra “Sin matrícula {año}”.
- **No hay cálculo automático de nota final** desde la UI; sin `notas_finales_area`, los
  reportes y SIAGIE salen vacíos.
- El **cierre de acta sí bloquea** la edición de notas (H06/H48); una acta global `CERRADO`
  bloquea todos los grados.
- La **bitácora** registra escrituras, accesos, descargas y eventos de seguridad (H07); no
  registra lecturas.
- Varios **GET de catálogo** siguen abiertos a cualquier autenticado; los módulos sensibles
  usan `verificarRol` y ownership (`checkAlumnoPropio`, `checkCursoDocente`, etc.). La UI
  oculta, la API manda.
- El trigger de pagos imputa a la **última apertura de caja**, aunque esté cerrada.
- `asistencia_alumnos` **no tiene `anio_lectivo`**: el año se deriva de `fecha`
  (`EXTRACT(YEAR FROM fecha)`). No agregar la columna en 6.1.
- El SIAGIE solo detecta cursos con prefijos `ARITM`, `ALGEBRA`, `COMUNIC`, `FISICA`.
- Algunos IDs de conceptos de tesorería y los meses Oct–Dic siguen hardcodeados en el
  frontend.
- Si `requiere_cambio_password = TRUE`, la API bloquea los módulos y el frontend redirige a
  `/cambiar-password`.
- Sí hay suites automatizadas: `npm run smoke` (11), `npm run test:integridad` (16) y
  `npm run test:e2e` (38, base desechable); el resto del testeo es manual.

---

## 9. Dónde está cada detalle

| Tema | Documento |
|---|---|
| Visión, alcance, glosario | `documentacion/01-VISION-GENERAL-Y-ALCANCE.md` |
| Arquitectura, patrones, request lifecycle | `documentacion/02-ARQUITECTURA-Y-PATRONES.md` |
| Archivos y clases | `documentacion/03-ESTRUCTURA-Y-CLASES.md` |
| 41 tablas, triggers, seeds | `documentacion/04-BASE-DE-DATOS.md` |
| 119 endpoints y permisos | `documentacion/05-API-REST.md` |
| Usuarios, roles, matriz de permisos | `documentacion/06-USUARIOS-ROLES-Y-PERMISOS.md` |
| Flujos por rol | `documentacion/07-FLUJOS-POR-ROL.md` |
| Procesos de negocio | `documentacion/08-PROCESOS-DE-NEGOCIO.md` |
| Frontend, rutas, componentes | `documentacion/09-FRONTEND-UI-Y-NAVEGACION.md` |
| Reglas y validaciones | `documentacion/10-REGLAS-DE-NEGOCIO-Y-VALIDACIONES.md` |
| Seguridad y auditoría | `documentacion/11-SEGURIDAD-AUDITORIA-E-INTEGRIDAD.md` |
| Instalación y despliegue | `documentacion/12-CONFIGURACION-INSTALACION-DESPLIEGUE.md` |
| Operación, backup, testeo | `documentacion/13-OPERACION-MANTENIMIENTO-Y-TESTEO.md` |
| Trazabilidad UI→BD | `documentacion/14-MATRIZ-TRAZABILIDAD.md` |
| Hallazgos y roadmap | `documentacion/15-HALLAZGOS-RIESGOS-Y-MEJORAS.md` |
| Guion de demo y checklist | `documentacion/17-GUION-DEMOSTRACION.md` |

---

## 10. Protocolo para un asistente de IA

1. Antes de proponer cambios, leer el documento temático correspondiente.
2. Verificar el código real; no confiar en `docs/` ni en el `AGENTS.md` histórico.
3. No cambiar el stack ni introducir ORM/Docker/tests sin pedido explícito.
4. Respetar MVC+DAO, transacciones, respuestas uniformes y roles.
5. Si se toca la BD, revisar triggers/funciones antes de duplicar lógica.
6. Si se agrega un endpoint: ruta → validador → controlador → servicio → DAO → permiso →
   documentación.
7. Si se agrega una columna a `usuarios`, incluirla en todos los SELECT de `usuarioDao`.
8. Mantener el español en mensajes, documentación y commits.
9. Actualizar `documentacion/` y este resumen cuando cambie el sistema.
10. No asumir que la UI refleja los permisos reales: revisar el router y el middleware.
