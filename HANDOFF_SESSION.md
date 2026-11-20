# HANDOFF_SESSION.md — SIGA-UC

> Guía para retomar el trabajo sin perder contexto.
> **Fuente de verdad:** el código y `documentacion/`. Si este archivo difiere, manda el código.
> Fecha de cierre de sesión: **20/11/2026**.

---

## 1. STACK Y ENTORNO

| Capa | Tecnología real |
|---|---|
| Frontend | Angular **21.2** standalone + signals + Bootstrap 5 + FontAwesome |
| Backend | Node.js **20.20.2** + Express **5.3** (CommonJS) |
| Base de datos | PostgreSQL **18.4** (`pgcrypto`, `unaccent`, `uuid-ossp`) |
| Acceso a datos | `pg` con SQL crudo parametrizado, sin ORM |
| Auth | JWT (8 h) + bcrypt/`crypt` coste 10 |
| Correo | **Resend** (API HTTP); no se usa SMTP/Nodemailer en runtime |
| Excel | ExcelJS + Multer (SIAGIE) |
| Despliegue | Backend/preview en **Render**; URL de producción en `environment.prod.ts` |
| Supabase | No hay SDK de Supabase en el código. Si se usa, es solo como **PostgreSQL gestionado** compatible; la app sigue conectando por `pg`. |

### Rutas locales

```text
C:\Users\yarol\Documents\Proyectos\siga-uc
├── siga-uc-backend
├── siga-uc-frontend
├── database
├── docs                  # documentación operativa previa
├── documentacion         # documentación detallada vigente
└── AGENTS.md             # resumen operativo
```

### Levantar backend

```powershell
nvm use 20
cd C:\Users\yarol\Documents\Proyectos\siga-uc\siga-uc-backend
npm install
npm run dev
```

- API local: `http://localhost:3000`
- Health: `GET http://localhost:3000/api/health`
- Requiere `.env` con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
- Correo real: `RESEND_API_KEY`, `EMAIL_FROM`.
- `.env.example` sigue mostrando SMTP; el servicio real es Resend.

### Levantar frontend

```powershell
cd C:\Users\yarol\Documents\Proyectos\siga-uc\siga-uc-frontend
npm install
ng serve
```

- SPA local: `http://localhost:4200`
- `environment.ts` apunta a `http://localhost:3000/api`.
- `environment.prod.ts` apunta a `https://siga-uc-api.onrender.com/api`.
- `npm run build` genera `dist/siga-uc-frontend/browser` y copia `404.html`.

### Restaurar BD

```powershell
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc.sql
psql -U postgres -d siga_uc -f database/siga_uc_completo.sql
```

> `siga_uc_completo.sql` contiene datos ficticios. No usar en producción.
> `siga_uc_backup.sql` está ignorado por Git.

---

## 2. ESTADO ACTUAL DEL PROYECTO

### Commits de esta sesión

| Hash | Mensaje |
|---|---|
| `d575319` | `feat(alumnos): agregar correo de alumno para recuperacion de contraseña` |
| `12cbd22` | `fix(auth): usar DNI como contraseña por defecto en alumnos y personal` |
| `81aa521` | `fix(tesoreria): corregir flujo de matricula, pagos, caja y kpis` |
| `a7fdb57` | `fix(tesoreria): corregir kpis, filtro de meses pagados y logica de alumno nuevo` |
| `b6f4a21` | `fix(security): implementar Fase 1 (autorizacion, estado, rate limit y errores seguros)` |
| `f6772c5` | `docs: actualizar documentacion con fase 1 de seguridad (roles, auth y rate limit)` |
| `f02f88a` | `fix(academico): fase 2 (unificar nota final, bloquear acta cerrada y calculo automatico)` |

### Implementado y probado

#### Correo del alumno

- El formulario de matrícula Angular ya envía `correo_personal`.
- `alumnoDao.crear` lo guarda en `usuarios.correo_personal`; si no viene, mantiene el fallback al correo del apoderado.
- `alumnoDao.actualizar` actualiza `usuarios.correo_personal` en la misma transacción.
- Listado/ficha de alumnos devuelve `correo_personal`.
- `POST /api/auth/recuperar-password` y el login por correo usan `usuarios.correo_personal`.

#### Contraseña por defecto = DNI

- Alumnos nuevos, personal nuevo y resets usan el DNI en crudo.
- El hash sigue siendo bcrypt (`crypt(..., gen_salt('bf', 10))`).
- **Los usuarios existentes conservan su contraseña anterior**; solo cambia al crear o resetear.
- Riesgo conocido: el DNI es predecible y `requiere_cambio_password` aún no se fuerza (H18).

#### Tesorería / Caja

- La matrícula crea automáticamente un `pre_ticket` de matrícula `PENDIENTE`.
- Se corrigió la bandeja de matrículas pendientes (pre-tickets).
- El trigger `trg_pago_a_caja` imputa a la **caja abierta actual**, no a la última cerrada.
- Se validó que exista caja abierta antes de registrar pagos.
- N° de operación:
  - Digital: obligatorio.
  - Efectivo: se oculta el campo y el backend genera `EFECTIVO-YYYY-NNN`.
- Los pagos actualizan `pagos`, `boletas_electronicas`, pre-ticket/pensión, caja y KPIs.
- La generación de pensiones solo crea meses desde la `fecha_creacion` del alumno.
- El filtro de conceptos solo muestra pensiones pendientes; usa `id_concepto` real.
- El estado de matrícula se actualiza a `Matriculado` (no existe estado `Pagado` en el CHECK).

#### Fase 1 — Seguridad

- `checkRole([...])` en `authRoles.js`; ownership por alumno/curso/grado.
- Matriz aplicada:
  - ADMIN: todo.
  - SECRETARIA: alumnos, tesorería, caja, QR de personal.
  - DOCENTE: notas/asistencias de sus cursos; ficha de alumnos de sus grados.
  - ESTUDIANTE: solo sus propias notas/asistencias/libreta.
- `GET /alumnos` solo ADMIN/SECRETARIA.
- `personal` y `auditoria` solo ADMIN.
- `reportes/libreta` protegido por alumno propio.
- `verificarAutenticacion` revalida `usuarios.estado` en cada petición; inactivo/cesado → `401`.
- Rate limiting con `express-rate-limit` 8.7.5:
  - login: 5 intentos fallidos / 15 min por IP.
  - recuperación: 5 solicitudes / 15 min por IP.
  - `trust proxy` activo en producción.
- Errores 500 y PostgreSQL ya no exponen `error.message`; respuesta genérica:
  `{ success:false, message:"Ocurrió un error interno en el servidor", errors:null, timestamp }`.
- Se mantiene el JSON `{ success, message, data, timestamp }`.

#### Fase 2 — Integridad académica

- `calificacionDao.calcularNotaFinal` llama a la función SQL `public.calcular_nota_final_area`; una sola fuente de verdad.
- Algoritmo SQL: `AD >= 2 → AD`, `A >= 2 → A`, `B >= 2 → B`, si no `C`.
- Se eliminó el desempate Node por “mejor nota individual”.
- `POST /api/calificaciones` y `/masivo` recalculan automáticamente `notas_finales_area`.
- Respuesta incluye `notas_finales_calculadas` y `notas_finales_errores`.
- Si falla el cálculo, la nota individual queda guardada (el cálculo va en try/catch separado).
- Bloqueo por acta cerrada:
  - `auditoriaDao.actaEstaCerrada(id_grado, bimestre, anio)`.
  - Solo actas con `id_grado` específico; las globales `id_grado = NULL` se ignoran.
  - Notas individuales, masivas y upsert de nota final → `409`.
- Frontend docente muestra cuántas notas finales se calcularon.

### Verificaciones realizadas

- `node --check` en archivos backend: OK.
- `npm run build` Angular: OK (solo warning preexistente de presupuesto de bundle).
- Matriz de roles: ADMIN 200, SECRETARIA 403 en notas/auditoría/personal, DOCENTE 403 en curso ajeno, ESTUDIANTE 403 en datos ajenos.
- H02: usuario `INACTIVO` → 401; reactivado → 200.
- Rate limit: 5 intentos y el 6.º → 429 en login y recuperación.
- H17: error SQL forzado → 500 con mensaje genérico.
- H04: guardado individual/masivo → `notas_finales_area` poblada.
- H06: acta específica cerrada → 409 en nota individual y nota final; no se guardaron datos.
- Los datos de prueba usados para H04/H06 fueron eliminados.

---

## 3. REGLAS DE ORO APRENDIDAS

1. **Parches quirúrgicos.** No reescribir archivos completos ni hacer refactors de paso. Cambiar solo lo necesario y conservar patrones existentes.
2. **No tocar el esquema de BD sin avisar.** No agregar/quitar tablas, columnas, CHECKs ni triggers sin autorización. Para cambios de lógica, usar la función/consulta existente.
3. **No hacer backfill masivo sin pedido explícito.** Las notas históricas no se recalculan automáticamente; se llenan al volver a guardar o con el endpoint manual.
4. **Transacciones y triggers:**
   - Los pagos se imputan a la **apertura abierta** (`NOT EXISTS cierres_caja`), no a la última apertura.
   - El trigger `trg_pago_a_caja` no debe fallar ni bloquear el pago; la validación de caja se hace antes en el servicio.
   - Los pre-tickets de matrícula se resuelven automáticamente al pagar.
   - `notas_finales_area` se upserta con `ON CONFLICT`; el cálculo automático va después del guardado y con catch independiente.
5. **Actas globales:** `actas_bimestrales.id_grado = NULL` se ignora para el bloqueo. Solo bloquea un acta con `id_grado` específico. No cambiar esto sin decisión de negocio.
6. **JSON estable.** Mantener `{ success, message, data, timestamp }` en éxitos y `{ success:false, message, errors, timestamp }` en errores. Angular lee `err.error.message`.
7. **Autorización en backend, no solo UI.** `checkRole`/ownership y filtros SQL; no confiar en que Angular oculta módulos.
8. **Contexto del usuario:** `req.usuario.id_alumno` e `id_personal` se obtienen en la revalidación H02. No confiar solo en IDs de la URL/body.
9. **Rate limit:** `app.set("trust proxy", 1)` solo en producción. No probar 6 logins desde la misma IP en desarrollo sin reiniciar el backend, porque queda bloqueada 15 min.
10. **Contraseñas:** el DNI por defecto es una regla solicitada, pero es débil. H18 debe forzar el cambio.
11. **Documentación:** `documentacion/15-HALLAZGOS-RIESGOS-Y-MEJORAS.md` es la fuente de hallazgos/roadmap; `documentacion/06` roles; `04` BD; `05` API.
12. **Commits:** semánticos, atómicos, en español, un solo commit por tarea.

---

## 4. PENDIENTES (ROADMAP)

### Siguiente inmediato: H18 — Cambio obligatorio de contraseña

**Problema:** `requiere_cambio_password` se guarda y se devuelve en el login, pero no existe pantalla ni bloqueo. Los usuarios con contraseña temporal (DNI/reset) pueden seguir usando el sistema sin cambiarla.

**Prompt exacto para la nueva sesión:**

```text
Lee HANDOFF_SESSION.md y la documentación en documentacion/ (especialmente 06-USUARIOS-ROLES-Y-PERMISOS.md, 11-SEGURIDAD-AUDITORIA-E-INTEGRIDAD.md y 15-HALLAZGOS-RIESGOS-Y-MEJORAS.md).

Implementa el hallazgo H18: cambio obligatorio de contraseña.
Objetivo: si usuarios.requiere_cambio_password = TRUE, el usuario no puede usar los módulos normales hasta cambiar su contraseña.

Requisitos:
1. Backend: agregar endpoint para cambiar contraseña autenticado (verificar contraseña actual, nueva >= 6, confirmar, hashear con bcrypt/crypt, poner requiere_cambio_password = FALSE).
2. Login: seguir devolviendo requiere_cambio_password; el frontend debe redirigir a /cambiar-password cuando sea TRUE.
3. Frontend Angular: crear pantalla/componente de cambio obligatorio, protegerlo con authGuard, y hacer que authGuard/roleGuard redirijan allí si el flag está activo. Actualizar localStorage del usuario tras el cambio.
4. No permitir navegar a /admin, /docente, /estudiante ni /secretaria mientras el flag sea TRUE.
5. No cambiar el esquema de la BD ni el formato JSON { success, message, ... }.
6. Cambios quirúrgicos, sin refactors masivos.
7. Probar login con un usuario que tenga el flag TRUE, cambio exitoso, flag FALSE y acceso normal.
8. Actualizar documentacion/ (como mínimo 06 y 15) y AGENTS.md si aplica.
9. Un solo commit: "fix(auth): forzar cambio de contraseña en primer inicio".
```

### Después: Fase 4 — Operación y calidad

Tomar como fuente `documentacion/15-HALLAZGOS-RIESGOS-Y-MEJORAS.md`:

- **H12:** año lectivo 2026 hardcodeado en controllers, DAOs, frontend, SIAGIE y reportes. Parametrizar.
- **H25:** backups automáticos de PostgreSQL (script + tarea programada + prueba de restauración).
- **H23:** paginación server-side en alumnos, personal, pagos, pre-tickets y bitácora.
- **H24:** tests automatizados y CI/CD (unitarios de services, integración de endpoints, E2E de flujos críticos).
- **H11:** visibilizar errores de guardados masivos (hoy la UI solo muestra insertados).
- **H22:** eliminar N+1 de tesorería (pensiones por alumno en un endpoint agregado).
- **H05:** mapeo SIAGIE configurable (hoy solo 4 prefijos y primera hoja).
- **H34:** PDFs reales de libretas, boletas y actas (hoy `window.print()`).
- **H27:** actualizar `.env.example`, README e INSTALACION (Resend, no SMTP).
- **H29:** documentar tablas históricas no persistidas (`libretas`, `cuadro_merito`, `alumnos_riesgo`, etc.).

---

## 5. PROMPT DE INICIO PARA LA NUEVA SESIÓN

Copiar y pegar:

```text
Estás retomando SIGA-UC (PostgreSQL 18 + Angular 21 + Node/Express). Antes de escribir código, lee HANDOFF_SESSION.md en la raíz y revisa documentacion/README.md, documentacion/06-USUARIOS-ROLES-Y-PERMISOS.md, documentacion/11-SEGURIDAD-AUDITORIA-E-INTEGRIDAD.md y documentacion/15-HALLAZGOS-RIESGOS-Y-MEJORAS.md.

Contexto: Fase 1 (seguridad) y Fase 2 (integridad académica) ya están implementadas y commiteadas. La fuente de verdad es el código.

Comienza directamente con el hallazgo H18: cambio obligatorio de contraseña. Sigue el prompt H18 definido en HANDOFF_SESSION.md. No cambies el esquema de la BD, no rompas el JSON { success, message, ... }, usa parches quirúrgicos y entrega un solo commit con el mensaje indicado.

Al terminar, actualiza HANDOFF_SESSION.md con el nuevo estado y el siguiente pendiente del roadmap (Fase 4).
```
