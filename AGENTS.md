# AGENTS.md — Contexto del Proyecto SIGA-UC

> **Propósito**: Que cualquier asistente de IA (o desarrollador) tenga TODO el contexto del
> sistema al instante, sin volver a preguntar. Orientado a ayudar en: **documentación**,
> **mejoras** y **nuevas funcionalidades**.
>
> **⚠️ FUENTE DE VERDAD TÉCNICA = EL CÓDIGO** (`C:\Users\yarol\Documents\Proyectos\siga-uc`).
> Si este archivo y el código difieren, EL CÓDIGO manda. Este archivo se actualiza con él.
>
> **Documentos externos** (en `C:\Users\yarol\Documents\PROYECTOS_OPENCOUDE\PROYECTO JS\`):
> - `DOCUMENTO MAESTRO DEFINITIVO - SIGA-UC.txt` → contexto histórico detallado (útil para
>   decisiones pasadas y lecciones aprendidas), pero su conteo de tablas/endpoints está
>   desactualizado.
> - `AVANCE - JS - SEMANA 05.pdf` → SOLO es válido para **contexto de negocio** (nombre del
>   proyecto, empresa, problema, objetivos). El resto (alcance de 4 módulos, stack "React",
>   cifras de planificación) está **SUPERADO** por el proyecto real.
> - `CHAT1–4.txt` → consolidados históricos de desarrollo.
> - `ESTRUCTURA INTEGRAL DEL CICLO DE VIDA... .docx` → guía/rúbrica del curso.

---

## 1. Contexto de Negocio (de donde proviene el proyecto)

| Elemento | Detalle |
|----------|---------|
| **Proyecto** | SIGA-UC — Sistema Integrado de Gestión Académica |
| **Institución** | I.E.P. Unión Científica — Huancayo, Junín, Perú (~150 estudiantes, 17 docentes, 5 directivos) |
| **Origen académico** | Proyecto final del curso *JavaScript Avanzado* — Escuela Profesional de Ingeniería de Sistemas e Informática (2026). Docente: Mg. Mora Bonilla, Anthony |
| **Equipo** | Yarol Bello Coquil (Product Owner/PM), Alexander Grados Castro (Arquitecto/Backend), Franz Roger Ramón Ayala (Frontend), Jeanfranco Jesús Ramos Uñaupe (Analista/QA) |
| **Repo** | `https://github.com/Yarol-Bello/siga-uc.git` (rama `main`) |
| **Estado actual** | ~99% funcional. Los 4 paneles (Admin, Docente, Estudiante, Secretaría) están al 100%. Faltan: documentación final, despliegue en producción y mejoras evolutivas |

### El problema que resuelve (según el acta de constitución)
La I.E. operaba con **Excel aislados, listas en papel y software monousuario** en secretaría:
- **200 horas-hombre/mes** de transcripción manual de datos.
- **8% de actas** con errores de digitación.
- **10 días** para emitir libretas.
- **Cero concurrencia** (un usuario a la vez en el sistema monousuario).

### Objetivos originales (medibles)
- **OE1**: Reducir 70% el tiempo de registro de notas.
- **OE2**: Asistencia en <5 clics con 95% de precisión.
- **OE3**: 3 perfiles con segregación total de acceso (el sistema real tiene 4: ADMIN, DOCENTE, SECRETARIA, ESTUDIANTE).
- **OE4**: Libretas/PDF en <30 s.
- **OE5**: Autenticación robusta y control por roles.

> Nota: el alcance inicial eran 4 módulos y declaraba "fuera de alcance" tesorería, SIAGIE y
> pasarelas de pago. **El proyecto real superó ese alcance** (ya incluye Tesorería, Caja,
> SIAGIE, notificaciones, auditoría, carné QR). Solo la **pasarela de pago en línea** sigue
> fuera de alcance (posible mejora futura, ver §13).

---

## 2. Qué es SIGA-UC (funcionalidades actuales)

Aplicación web full-stack que digitaliza los procesos académicos y administrativos del colegio:

- Gestión de alumnos, apoderados, matrículas y retiros.
- Gestión de personal docente y administrativo (cese, reactivación).
- Carga curricular y horarios.
- **Notas por competencias MINEDU** (AD/A/B/C) con cálculo de nota final por predominancia.
- Control de asistencia (P/T/F) con **carné digital QR** (estudiantes y personal).
- Tesorería: pensiones, becas, pre-tickets, pagos y boletas electrónicas.
- Cuadre de caja diario (apertura/egresos/cierre con arqueo y estado CUADRADO/SOBRANTE/FALTANTE).
- Reportes: libretas imprimibles, cuadro de mérito, alumnos en riesgo.
- **Exportación SIAGIE** (MINEDU): inyecta notas en plantillas oficiales .xlsx.
- Notificaciones internas (campanita + buzón tipo Gmail) + correos reales (SMTP Gmail).
- Auditoría (bitácora con JSONB) y cierre de actas bimestrales con hash de integridad.
- Recuperación de contraseña por correo con tokens.

**Identidad visual**: guindo `#800020`, dorado `#D4AF37`, naranja Secretaría `#B45309`,
fondos `#F8FAFC` / `#fffbeb`.

---

## 3. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Angular (standalone + signals + SCSS) + Bootstrap + FontAwesome | 21.2.26 / 5.x |
| Backend | Node.js + Express (CommonJS) | 20.20.2 LTS / 5.3.0 |
| Base de datos | PostgreSQL (pgcrypto, uuid-ossp, unaccent) | 18.4 |
| Auth | JWT (expira 8h) + bcrypt (cost 10) | 9.x / 6.x |
| Correos | Nodemailer + Gmail SMTP (App Password) | 10.x |
| Excel | ExcelJS + Multer (subida de plantillas) | 4.x / 1.x |
| QR | qrcode (generado en el frontend) | 1.x |
| Validación | express-validator | 7.x |
| Seguridad | helmet + CORS | 8.x |
| Dev | nodemon (backend), Angular CLI (frontend) | — |

**NO se usa** (decisiones conscientes): ORM (SQL crudo parametrizado), Docker, CI/CD,
WebSocket/chat en tiempo real, tests automatizados. El testing es manual vía
`docs/GUIA_TESTEO.md`.

---

## 4. Estructura del Proyecto (monorepositorio)

```
C:\Users\yarol\Documents\Proyectos\siga-uc\
├── database/                  # Scripts SQL
│   ├── siga_uc.sql            # Esquema completo SIN datos (versionado)
│   ├── siga_uc_backup.sql     # Backup completo (ignorado por Git)
│   ├── siga_uc_completo.sql   # Esquema + 517 INSERTs de prueba
│   └── README.md              # Doc del modelo de datos
├── docs/                      # INSTALACION.md, GUIA_TESTEO.md, CREDENCIALES.md,
│                              # MAPEO_ENDPOINTS.txt
├── AGENTS.md                  # ← este archivo
├── siga-uc-backend/           # API REST
│   ├── .env / .env.example
│   ├── uploads/               # SIAGIE y temporales (ignorado en Git)
│   └── src/
│       ├── app.js             # Servidor + registro de 13 rutas + errores globales
│       ├── config/            # database.js (pool pg), env.js (valida .env y aborta si falta)
│       ├── routes/            # 13 archivos (auth, academico, alumno, personal, ...)
│       ├── controllers/       # 14 controladores HTTP
│       ├── services/          # 17 servicios (lógica de negocio)
│       ├── dao/               # 16 DAOs (SQL crudo parametrizado $1, $2...)
│       ├── middlewares/       # authMiddleware.js (verificarAutenticacion + verificarRol)
│       └── utils/response.js  # Respuestas uniformes {success, message, data}
└── siga-uc-frontend/          # SPA Angular
    └── src/app/
        ├── core/              # guards/ (auth, rol), interceptors/ (JWT),
        │                      # services/ (auth, notificacion), models/ (usuario)
        ├── shared/components/ # header (campanita + carné QR), 4 sidebars por rol
        ├── features/          # admin/ (10 módulos), docente/ (5), estudiante/ (3),
        │                      # secretaria/ (5), auth/ (login, reset-password),
        │                      # en-construccion/
        ├── app.routes.ts      # Rutas lazy loading por rol con guards
        ├── app.config.ts      # provideHttpClient(withInterceptors([authInterceptor]))
        └── environments/       # environment.ts (dev: localhost:3000),
                               # environment.prod.ts (producción)
```

**Escala actual**: ~7,400 líneas backend (61 archivos JS) · ~18,800 líneas frontend (47
archivos TS/HTML/SCSS) · 53 commits con convención semántica.

---

## 5. Arquitectura

### Backend — MVC + DAO (por módulo)
```
Routes → Controllers → Services → DAOs → PostgreSQL
```
- **Routes**: endpoints + `express-validator` + `verificarAutenticacion` / `verificarRol(...)`.
- **Controllers**: reciben HTTP, validan `validationResult`, llaman al servicio, responden con
  `utils/response.js`.
- **Services**: lógica de negocio (`siagieService`, `emailService`, `recuperacionService`,
  `authService`, `tesoreriaService`, `cajaService`, etc.).
- **DAOs**: SQL crudo con `$1, $2...` (sin inyección SQL), pueden construir `WHERE` dinámico.

### Frontend — Angular 21 standalone + signals
- **Routing**: lazy loading (`loadComponent`) por rol: `/admin`, `/docente`, `/estudiante`,
  `/secretaria` con layouts propios.
- **Guards**: `authGuard` + `roleGuard(['ADMIN'])` etc.
- **Interceptor JWT** (`auth.interceptor.ts`, HttpInterceptorFn): añade
  `Authorization: Bearer <token>`; token en `localStorage` (`siga_uc_token`).
- **Signals** para todo estado reactivo; `inject()` en vez de constructor.
- **Modales**: `@if (senal())` + `.modal-overlay` con `stopPropagation()`.
- **Patrón Wrapper** (DRY) para módulos compartidos entre roles (componente standalone de ~10
  líneas que renderiza el original):
  - `AdminTesoreriaComponent` → `SecretariaTesoreriaComponent`
  - `AdminCajaComponent` → `SecretariaCajaComponent`
  - `SecretariaPadronComponent` → `AdminAlumnosComponent`
  - `SecretariaAsistenciaQrComponent` → `AdminAsistenciaQrComponent`

### Flujo de autenticación
1. Login (DNI + password) → `bcrypt.compare()` → JWT con payload
   `{ id_usuario, dni, nombre_completo, correo, id_rol, rol }`.
2. Frontend guarda token en `localStorage`; interceptor lo adjunta a cada petición.
3. `verificarAutenticacion` extrae/valida el token; `verificarRol(...roles)` valida permisos.

---

## 6. Roles y Módulos

| Rol | Módulos (frontend) | Acceso backend típico |
|-----|--------------------|-----------------------|
| **ADMIN** | Dashboard, Alumnos, Personal, Carga Curricular, Asistencia QR, Tesorería(wrapper), Caja(wrapper), SIAGIE, Reportes, Auditoría | Control total |
| **SECRETARIA** | Dashboard, Padrón(wrapper), Tesorería, Caja, Asistencia QR(wrapper) | Padrón, finanzas, QR |
| **DOCENTE** | Dashboard, Notas, Asistencia, Ficha Estudiante, Reportes de Aula | Registro académico |
| **ESTUDIANTE** | Dashboard, Mi Asistencia, Horario | Solo consulta |

La restricción de rol es en backend (`verificarRol`) y en frontend (`roleGuard`). Donde dos
roles aplican, el backend no restringe; la separación es de UI por panel.

---

## 7. Base de Datos (39 tablas — esquema actual en `database/siga_uc.sql`)

> ⚠️ El documento maestro dice "26 tablas"; el esquema real vigente tiene **39**. Verificar
> siempre contra el SQL.

| Módulo | Tablas |
|--------|--------|
| Seguridad (8) | `roles`, `usuarios`, `recuperacion_password`, `personal`, `asistencia_personal`, `bitacora_auditoria`, `notificaciones`, `credenciales_qr` |
| Curricular (7) | `grados`, `cursos`, `competencias`, `carga_curricular`, `tutores_grado`, `horarios`, `escala_calificacion` |
| Alumnos (3) | `apoderados`, `alumnos`, `expediente_alumno` |
| Asistencia (2) | `asistencia_alumnos`, `resumen_asistencia_curso` |
| Calificaciones (5) | `calificaciones`, `notas_finales_area`, `conclusiones_descriptivas`, `actas_bimestrales`, `libretas` |
| Tesorería (6) | `conceptos_pago`, `becas`, `pensiones`, `pre_tickets`, `pagos`, `boletas_electronicas` |
| Caja (4) | `cajas`, `aperturas_caja`, `movimientos_caja`, `cierres_caja` |
| SIAGIE (2) | `exportaciones_siagie`, `estado_carga_docentes` |
| Reportes (2) | `cuadro_merito`, `alumnos_riesgo` |

**Triggers y funciones (11 objetos)** — lógica de negocio embebida:
- `trg_actualizar_timestamp()` — auto-update `fecha_actualizacion`.
- `trg_auditar_calificacion()` — auditoría en bitácora al modificar notas.
- `trg_actualizar_preticket()` — marca pre-ticket PAGADO al insertar pago.
- `trg_actualizar_pension()` — marca pensión PAGADA (por `id_pension` o concepto+mes).
- `trg_pago_a_caja()` — registra automáticamente ingreso en `movimientos_caja`.
- `calcular_nota_final_area()` — nota final por **predominancia** (AD > A > B > C).

**Reglas de negocio en BD**:
- Escala `AD/A/B/C` (CHECK). Asistencia `P/T/F`. Actas `ABIERTO/CERRADO`. Caja
  `CUADRADO/SOBRANTE/FALTANTE`.
- Auditoría con `valor_anterior`/`valor_nuevo` en **JSONB**.
- `ON CONFLICT (...) DO UPDATE` para upserts (asistencia/calificaciones masivas).
- Casteo explícito de parámetros NULLables (`$1::INT`, `$2::DECIMAL`).
- Datos de prueba: 517 registros en `siga_uc_completo.sql` (21 alumnos, 29 usuarios, etc.).
- ~40 índices btree sobre DNI, fechas, estados.

---

## 8. API REST (97 endpoints — detalle en `docs/MAPEO_ENDPOINTS.txt`)

**Prefijos (montados en `app.js`)**:
```
GET  /                 GET  /api/health
/api/auth              /api (grados, cursos, horarios, escala)
/api/alumnos           /api/personal
/api/carga-curricular  /api/asistencias
/api/calificaciones    /api/tesoreria
/api/caja              /api/reportes
/api/auditoria         /api/siagie (POST /generar-excel, multipart)
/api/notificaciones
```

**Distribución**: 60 GET · 25 POST · 10 PUT · 2 DELETE · 6 públicos · 43 solo JWT · 48 por rol.

**Respuesta uniforme** (`utils/response.js`): `{ success, message, data }` con métodos
`success()`, `error()`, `validationError()`, `unauthorized()`, `forbidden()`, `notFound()`.

**Endpoints destacados por lógica**:
- `POST /api/alumnos` → matrícula **transaccional** (apoderado → usuario → alumno → expediente
  → credencial QR); genera código `EST-XXX`; contraseña temporal `UC+DNI`.
- `POST /api/tesoreria/pagos` → pago **transaccional** (pago → boleta electrónica →
  actualiza pre-ticket/pensión vía trigger → actualiza matrícula si es matrícula).
- `POST /api/caja/cerrar` → cálculo `efectivo_esperado = monto_inicial + ingresos - egresos`;
  `diferencia = fisico - esperado` → CUADRADO/SOBRANTE/FALTANTE.
- `POST /api/siagie/generar-excel` → sube plantilla .xlsx (multer, 10MB), detecta fila de
  encabezados ("DNI"/"DOCUMENTO") y columnas por prefijos (ARITM, ALGEBRA, COMUNIC, FISICA),
  inyecta notas cruzando por DNI, descarga `SIAGIE_{grado}_BIM{bim}_{anio}.xlsx`.
- `POST /api/auth/recuperar-password` → token 64 chars, expira 2h, un solo uso, invalida
  anteriores, **no revela existencia** del usuario.

---

## 9. Reglas Críticas (RESPETAR SIEMPRE)

1. **MVC+DAO obligatorio** en backend. No saltear capas al agregar endpoints.
2. **`correo_personal` (real) vs `correo_institucional` (decorativo)**:
   - Institucional (@unioncientifica.edu.pe): ficticio, solo carnés/reportes.
   - Personal: real, para correos (notificaciones, recuperación).
   - Envío: `correo_personal || correo_institucional`. Sin correo → solo notificación en BD.
   - **Al agregar columnas a `usuarios`, incluirlas en TODOS los SELECT del DAO**
     (`findByDni`, `findByCorreo`, `findById`, ...).
3. **`Number()` en frontend**: PostgreSQL devuelve números/`COUNT(*)` como string →
   siempre `Number(x) || 0` antes de operar.
4. **Orden de rutas**: específicas ANTES de paramétricas (`/personal/todos` antes de
   `/personal/dni/:dni` y `/:id`). En Angular, `reset-password` ANTES de `**`.
5. **Modales**: envueltos en `@if (senal())` + `.modal-overlay` con `stopPropagation()`.
6. **Loading en errores**: desactivar PRIMERO en el bloque `error:`
   (`this.guardando.set(false)`).
7. **Triggers con IDs explícitos**: enviar `id_pension` desde el frontend (más robusto).
8. **Correos no bloqueantes**: fallo SMTP no impide guardar la notificación (try/catch).
9. **No revelar existencia de usuarios** en recuperación de contraseña.
10. **Commits**: `feat:/Fix:/Add:/DB:/docs:/chore:` + descripción en español con módulo,
    atómicos.
11. **NO cambiar el stack sin justificación.** Ante un bug, revisar §10 primero.
12. **Terminal nueva**: `nvm use 20` antes de node/npm/ng.
13. **Arquitectura de correos**: el backend llama a `emailService` tras guardar en BD;
    `emailService.verificarConexion()` se ejecuta al arrancar el servidor.

---

## 10. Correcciones Históricas (verificar antes de diagnosticar)

| Área | Problema → Solución |
|------|---------------------|
| BD | `correo_personal` agregado a `usuarios`; `ON CONFLICT` en asistencia; casteo `::INT` en pagos |
| Backend | `correo_personal` faltante en SELECTs de `usuarioDao` → correos a direcciones ficticias → agregar en `findByDni/findByCorreo/findById` |
| Frontend | Strings de PostgreSQL sin `Number()`; `import 'zone.js'` primera línea de `main.ts`; `rootDir: "./src"` en `tsconfig.app.json` para environments |
| Rutas | Ruta registrada sin existir el componente (rompe build); ruta después de `**` pierde query params |
| Carné QR | Backend devuelve `nombres`+`apellidos` (no `nombre_completo`) y `nombre_rol` (no `rol`) → construir en template |
| SIAGIE | Totales como string → `Number()`; limpiar archivo al cambiar filtros (`limpiarArchivo()`) |
| SMTP | Error 535 → App Password con espacios (regenerar 16 chars sin espacios) |
| UI | Columna de acciones oculta por scroll → `position: sticky; right: 0` |
| Compilación | Componente importado sin archivo → crear wrapper o el componente |

---

## 11. Cómo Ejecutar

```cmd
:: Requisitos: PostgreSQL corriendo (Get-Service *postgres* → Running)
:: En CADA terminal nueva:
nvm use 20

:: Terminal 1 — Backend (puerto 3000)
cd C:\Users\yarol\Documents\Proyectos\siga-uc\siga-uc-backend
npm install
npm run dev          # nodemon → http://localhost:3000
# Debe mostrar: ✅ Servicio de correo SMTP conectado correctamente

:: Terminal 2 — Frontend (puerto 4200)
cd C:\Users\yarol\Documents\Proyectos\siga-uc\siga-uc-frontend
npm install
ng serve             # → http://localhost:4200
```

**.env** (`siga-uc-backend/.env`, ver `.env.example`): `PORT`, `NODE_ENV`,
`DB_HOST/PORT/USER/PASSWORD/NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SMTP_HOST/PORT/USER/
PASSWORD`, `TZ=America/Lima`. `env.js` aborta si falta una requerida.

**Base de datos**: crear `siga_uc` → ejecutar `database/siga_uc.sql` (esquema) +
`siga_uc_completo.sql` (datos) o restaurar el backup.

**CORS**: permite `localhost:4200` y `localhost:3000`.

---

## 12. Credenciales de Prueba

(Detalle en `docs/CREDENCIALES.md`)

| Rol | DNI | Contraseña |
|-----|-----|-----------|
| Administrador | 74829102 | `UC2026*` |
| Secretaría | 40596837 | `UC2026*` |
| Docentes | 10293847, 20394812, 30192847, 50182736 | `UC2026*` |
| Estudiantes | 75918234, 74829103, 76829401 | `UC + DNI` (ej. `UC75918234`) |
| Estudiantes generados | 70000001–70000015 | `UC + DNI` |

---

## 13. Estado Actual y Pendientes

### Hecho (100%)
- Los 4 paneles completos: Admin (10 módulos), Docente (5), Estudiante (3), Secretaría (5).
- Módulos compartidos (wrappers), SIAGIE real, notificaciones SMTP, campanita + buzón,
  carné digital QR, recuperación de contraseña, auditoría + actas con hash.

### Pendiente (por prioridad)
| # | Tarea | Prioridad | Estimación |
|---|-------|-----------|-----------|
| 1 | Documentación (Manual de Usuario + Manual Técnico) | 🔴 Alta | ~2–3 h |
| 2 | Despliegue en producción (backend+BD en cloud tipo Railway/Render; frontend en Vercel/Netlify) | 🟡 Media | ~4–6 h |
| 3 | CORS/dominios productivos + HTTPS + dominio personalizado | 🟡 Media | ~1 h |
| 4 | `pg_dump` automatizado para respaldos diarios | 🟢 Baja | ~30 min |
| 5 | Descarga real de PDFs (Reportes y Caja) | 🟢 Baja | ~3 h |
| 6 | Tests automatizados (hoy no existen) | 🟢 Baja | — |
| 7 | Integración pasarela de pago (Culqi/Niubiz/Izipay) — fase evolutiva | 🟢 Baja | — |

### Mejoras menores detectadas en revisión de código
- `database/README.md` dice "26 tablas" → actualizar a 39.
- Archivo vacío `siga-uc-frontend/src/app/features/secretaria/tesoreria/secretaria-tes` → eliminar.
- `docs/MAPEO_ENDPOINTS.txt` y `AGENTS.md` sin commitear (untracked).

---

## 14. Cómo Ayudar (guía para el asistente)

Cuando el usuario pida:

### 📄 Documentación del sistema
- El sistema necesita: **Manual de Usuario** (por rol, con capturas, procedimientos paso a
  paso) y **Manual Técnico** (arquitectura, BD, API, configuración, mantenimiento).
- Base existente: `docs/INSTALACION.md`, `docs/GUIA_TESTEO.md` (checklist por rol de 342
  líneas), `docs/CREDENCIALES.md`, `docs/MAPEO_ENDPOINTS.txt`, `AGENTS.md`.
- Plantilla/rúbrica del curso (§ docx del ciclo de vida): si se necesita entregar formato
  académico, incluye: arquitectura, componentes, navegación, interfaces, modelado de datos,
  diagramas UML, estándares de desarrollo, documentación de API, ADR, plan de pruebas,
  manuales y FAQ.
- Usar español, tono técnico-académico, identidad guindo/dorado en plantillas de correo.

### 🔧 Mejoras al sistema existente
- Respetar patrón MVC+DAO y convenciones (§9). Verificar correcciones históricas (§10) antes
  de proponer fixes.
- Mantener formato de respuesta `{success, message, data}` y seguridad JWT/roles.
- Al tocar BD: revisar triggers/funciones existentes antes de duplicar lógica en JS.

### ✨ Nuevas funcionalidades (ideas coherentes con el dominio)
- **Pasarela de pago en línea** (Culqi/Niubiz/Izipay) para pensiones/matrículas — la única
  "fuera de alcance" que queda, natural como evolución.
- **Generación de PDFs reales** (libretas, boletas, actas) con pdfkit/puppeteer.
- **Dashboard con gráficos** (chart.js ya está en dependencias) para notas/asistencia/finanzas.
- **Exportación a Excel/PDF** de reportes y listados.
- **Gestión de horarios completa** (hoy solo consulta por grado).
- **Modulo de admisión/prospectos**.
- **Backup/restauración automatizados** y métricas de uso.
- **App móvil** o PWA para consulta de estudiantes (calificaciones, asistencia).
- Para cualquier nueva feature: definir primero el rol que la usa, los endpoints necesarios,
  las tablas implicadas y el impacto en auditoría/seguridad.

### 🐛 Reporte de bugs
1. Verificar §10 (correcciones históricas) — puede estar ya resuelto.
2. Reproducir con credenciales de §12.
3. Revisar backend (DAO/SQL) vs frontend (Number(), orden de rutas, modales).
4. Corregir siguiendo convenciones; commit atómico.

---

*Archivo generado el 14/10/2026. Actualizarlo cada vez que el código cambie significativamente
(nuevas tablas, endpoints, módulos o reglas).*
