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

**Conteos actuales:** 39 tablas · 103 endpoints · 4 roles · 14 routers · 14 controladores ·
19 servicios · 15 DAOs · 72 archivos JS backend · 118 archivos frontend (49 TS).

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

# B) Producción (catálogos + admin; sin datos ficticios)
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc.sql
psql -U postgres -d siga_uc -v admin_password="TuClaveTemporal" -f database/seed_produccion.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
psql -U postgres -d siga_uc -f database/migracion_h45_pensiones_anuladas.sql
```

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
10. **Año lectivo configurable:** usar `ANIO_LECTIVO` y `getAnioLectivo()` en backend;
    `ConfiguracionService` en frontend. No introducir literales `2026`. `?anio=YYYY` explícito
    tiene prioridad para consultas históricas.
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
- La documentación antigua decía 26 tablas; son **39**.
- El correo es **Resend**, no SMTP/Nodemailer.
- La matrícula crea al alumno en **`PendientePago`**; solo el pago de matrícula lo pasa a
  `Matriculado`.
- El retiro es transaccional: pasa al alumno a `Retirado`, deja al usuario `INACTIVO` y congela
  el expediente (`H19`). La edición de nombres/apellidos sincroniza `usuarios` (`H20`).
- **No hay cálculo automático de nota final** desde la UI; sin `notas_finales_area`, los
  reportes y SIAGIE salen vacíos.
- El **cierre de acta no bloquea** la edición de notas.
- La **bitácora solo se alimenta** automáticamente desde calificaciones; el resto no se audita.
- Los **GET son amplios**: cualquier autenticado puede consultar alumnos, pagos, caja y
  bitácora. La UI oculta, la API no.
- El trigger de pagos imputa a la **última apertura de caja**, aunque esté cerrada.
- `reporteDao.getResumenAsistenciaGrado` **ignora el año**.
- El SIAGIE solo detecta cursos con prefijos `ARITM`, `ALGEBRA`, `COMUNIC`, `FISICA`.
- Los IDs de conceptos de tesorería y los meses Oct–Dic están hardcodeados en el frontend.
- Si `requiere_cambio_password = TRUE`, la API bloquea los módulos y el frontend redirige a
  `/cambiar-password`.
- No hay tests automatizados; el testeo es manual (`docs/GUIA_TESTEO.md`).

---

## 9. Dónde está cada detalle

| Tema | Documento |
|---|---|
| Visión, alcance, glosario | `documentacion/01-VISION-GENERAL-Y-ALCANCE.md` |
| Arquitectura, patrones, request lifecycle | `documentacion/02-ARQUITECTURA-Y-PATRONES.md` |
| Archivos y clases | `documentacion/03-ESTRUCTURA-Y-CLASES.md` |
| 39 tablas, triggers, seeds | `documentacion/04-BASE-DE-DATOS.md` |
| 103 endpoints y permisos | `documentacion/05-API-REST.md` |
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
