# HANDOFF_PROMPTS.md — SIGA-UC (sesión de asesoría)

> **Fecha de cierre:** 22/11/2026
> **Rol de esta sesión:** asesor de prompts. No implementa código; revisa resultados
> reales y prepara prompts para la sesión de código.
> **Handoff técnico:** `HANDOFF_SESSION.md` (raíz). Este archivo no lo reemplaza:
> apunta a él y a `documentacion/18` y `documentacion/19`.

---

## 1. Rol y forma de trabajo

- Esta sesión **no modifica código, ni base de datos, ni Supabase/Render**.
- Su entregable son prompts para la sesión de código, revisiones de resultados y
  el orden de las fases.
- La sesión de código implementa, prueba y hace commits atómicos.
- Después de cada fase: push, migración manual en Supabase si aplica y verificación.
- No se cargan datos reales hasta cerrar la Fase 6 (multi-año/promoción) y la
  operación (Fase 8).

---

## 2. Estado del sistema

| Elemento | Estado |
|---|---|
| Código desplegado en Render | `cdc129e` (Fases 6.1, 6.2, 6.3, 6.3.1 y 6.4) |
| 6.4 histórico | Implementado, verificado y **desplegado**; sin migración |
| Último commit de documentación | `cdc129e` (cierre 6.4); docs de cierre en curso |
| Backend / Frontend | Live en Render (6.4); backend sin commit expuesto en `/health` |
| `/api/health` | OK, `database: "ok"` |
| Supabase demo | **43 tablas**, H49/H73 aplicadas, **0 actas**, 2026 activo, 1 política, 0 promociones |
| Horarios en Supabase | **145 PUBLICADO**, 5 docentes demo (`99000001`–`99000005`) |
| Carga en Supabase | 55 cargas, 30/30/30/30/25 h; 0 choques |
| Local `siga_uc` | 44 tablas (43 base + `horarios_h47_backup`), H49 y H73 aplicados, 54 cargas en ADMIN, 0 horarios, 10 períodos, 2026 activo |
| Fase 6.1 (multi-año base) | Desplegada en Render (`3007dbe`); H49 aplicada en Supabase |
| Fase 6.2 (rollover) | Desplegada en Render (`f05ecc5`); H49 aplicada en Supabase |
| Fase 6.3 + 6.3.1 (promoción) | Desplegadas en Render (`89eba24`); H73 aplicada en Supabase, 0 promociones |
| Fase 6.4 (histórico) | Desplegada en Render (`cdc129e`); sin migración; Supabase sin cambios |
| E2E | **65 PASS** |
| Integridad (base de producción desechable) | **20 PASS**; local 18 PASS / 2 FAIL de seed |
| Smoke / generador H47 | 11 PASS / 4 PASS |

> Recordatorio: un push que solo toca `database/` o `documentacion/` **no despliega**.
> Las migraciones se aplican a mano en Supabase.

---

## 3. Fases completadas y commits

| Fase | Hallazgos | Commits |
|---|---|---|
| **1 — Dinero y seguridad** | H50 (caja efectivo/digital), H63 (PDF actas solo ADMIN) | `2449cf3` + docs `3052f44` |
| **2 — Actas y libretas** | H48 (cierre/reapertura real, bloqueo global), H51 (bimestre en libretas) | `d9071e5` + docs `9648689` |
| **3 — Asistencia y alumno** | H56 (+H13), H61, H60, H57 | `269e1ae`…`2cf8477` + docs |
| **4 — Credibilidad UI** | H53, H54, H55, H58, H72 | `6c7c5ff`…`8ee4a7b` |
| **H64 — Deep links** | Rewrite `/* → /index.html` (200) en Render | Configuración de Render, no código |

Verificaciones: E2E 19 PASS; deep links `/login`, `/admin`, `/docente/asistencia`
responden 200; QR de personal real; impresión aislada; 404 con `returnUrl`.

---

## 4. Pendiente inmediato

La **Fase 6.1 (multi-año base)** está implementada, verificada y desplegada en Render
(`3007dbe`):

- `anios_lectivos`, `grados.orden`, UNIQUE de `alumnos` por año.
- Login/perfil con matrícula del año activo, `matricula_activa=false` y
  `403 SIN_MATRICULA_ACTIVA` en endpoints académicos propios.
- Filtros por año en alumnos, asistencia, calificaciones, reportes, tesorería,
  notificaciones y horarios; `?anio` para históricos.
- Apoderados reutilizados por DNI; retiro que no desactiva si hay otra matrícula vigente.
- Migración H49 + rollback, tests 20–27.

La **Fase 6.2 (rollover)** quedó implementada, verificada y **desplegada en Render**:

- API `/api/anios-lectivos` (solo ADMIN): catálogo, preview con hash, confirm
  transaccional/idempotente, activación auditada y reversión.
- Clona grados, conceptos, períodos, carga y tutores. No crea alumnos, pagos, notas,
  asistencia, actas ni horarios. **No agrega migración.**
- Pantalla ADMIN `/admin/anios-lectivos` con preview por secciones, checkbox `incluir OTROS`,
  confirmación con responsabilidad y modales de activación/reversión.
- Tests 28–38: **38 E2E** y **16 invariantes**; smoke 11; H47 4; build OK.
- Commits: `a670c06` (backend), `44bf200` (UI), `9b3ea6f` (tests), `05aa805` (docs) y
  cierre `f05ecc5`.

La **Fase 6.3 (promoción)** quedó implementada, verificada y **desplegada en Render**:

- Migración H73 (`promociones`, `politicas_promocion`); 43 tablas base, 44 en local.
- API `/api/promociones` (políticas, preview, confirm, listado, detalle y anulación).
  SECRETARIA puede leer/previsualizar; ADMIN confirma y anula.
- Pantalla ADMIN `/admin/promociones` con políticas, filtros, preview por alumno, override
  con motivo, confirmación con responsabilidad, historial y anulación.
- Tests 39–54: **54 E2E** al cierre de 6.3 y **20 invariantes**; smoke 11; H47 4; build OK.
- No crea usuarios/QR; no copia notas, asistencia, pagos, pensiones ni pre-tickets; no
  activa el año. Traslado = `RETIRADO` + condición `Traslado`.
- Commits: `c893e02` (DB), `cf8efb3` (backend), `8b15041` (UI), `7226003` (tests),
  `5f73049` (docs) y cierre `8492262`.
- **H73 aplicada en Supabase demo; 6.3 desplegada en Render (`89eba24`).**

La **Fase 6.3.1 (cierre de reglas de promoción)** quedó implementada, verificada y desplegada:

- Actas/notas obligatorias para PROMOVIDO, REPITENTE y EGRESADO; RETIRADO exento. Si faltan,
  PENDIENTE con bloqueo; el override permitido + motivo las exime con evidencia.
- `notas_bimestres` (1–4, default `[4]`) reemplaza a `notas_bimestre`, que se acepta como
  legado. Un curso falta si no tiene nota en cualquiera de los bimestres; la repitencia usa
  el último. Checkboxes de bimestres en la UI.
- `copiar_becas` entra en el `preview_hash`; cambiarlo sin re-preview da
  `409 PREVIEW_DESACTUALIZADA`.
- PENDIENTE no se confirma: `422 PROMOCION_PENDIENTE`; no se crean filas CONFIRMADA. La UI
  deshabilita el confirm y lista los pendientes.
- Tests 55–58: **58 E2E** (54 previas + 4 nuevas), integridad 20, smoke 11, H47 4, build y
  `node --check` OK. Commits `f1c5f71` (fix) y `f9d8d1a` (tests); docs en este cierre.

**Siguiente paso:** **Fase 7 seleccionada** (H59, H62, H65–H69) y cierre de demo.
6.4 ya está desplegada en Render (`cdc129e`) sin migración. H49/H73 siguen aplicadas en
Supabase demo (43 tablas, 2026 activo, 1 política, 0 promociones). En Supabase, probar
**solo previews** de rollover/promoción; **no confirmar promociones, no activar 2027 y no
anular** en el demo.

---

## 5. Fases pendientes

### Fase 5 — SIAGIE (H52 + H05)

- Decidir si el colegio lo usa oficialmente.
- Propuesta: **exportador/mapeo configurable por año**, no un importador rígido;
  la plantilla de MINEDU puede cambiar.
- Si no se usa: retirar el portal simulado y etiquetar la exportación como interna.

### Fase 6 — Multi-año y promoción

- **6.1 Base:** ✅ identidad vs. matrícula anual, uniques por año, `grados.orden`,
  `anios_lectivos`, login por año, inventario de consultas y apoderados.
- **6.2 Rollover:** ✅ implementado, verificado y desplegado en Render (API + UI + tests).
  Clona grados, conceptos, períodos, carga y tutores, activa el año con auditoría y revierte
  un rollover vacío. **No promueve alumnos.** H49 aplicada en Supabase.
- **6.3 Promoción:** ✅ implementado, verificado y desplegado en Render (`89eba24`);
  migración H73 aplicada en Supabase, API, UI y tests. Recomendación + confirmación humana,
  políticas configurables, egresados/repitentes, retirados/traslados, override auditado y
  anulación con reversa. **No activa el año.** **6.3.1** cerró actas/notas para
  PROMOVIDO/REPITENTE/EGRESADO, `notas_bimestres`, `copiar_becas` en el hash y el rechazo de
  PENDIENTE.
- **6.4 Histórico:** ✅ implementado, verificado y desplegado en Render (`cdc129e`); **sin
  migración**. Selector de año, modo de solo lectura en años no activos, consolidado por
  `id_usuario`/DNI y pantalla `/admin/historico`.
- Documento: `documentacion/19-DISENO-MULTIANIO-Y-PROMOCION.md`.

### Fase 7 — Quick wins P2

H59, H62, H65–H71 (campos que se pierden, notificación de docente, KPIs, textos,
logs, retirados históricos, 404/returnUrl menor).

### Fase 8 — Operación

Resend real (dominio + SPF/DKIM + `EMAIL_FROM`), planes pagos (Render/Supabase),
backups, CI (H24) y documentación (H26/H27). Después de la aprobación.

---

## 6. Decisiones tomadas

1. Un acta global `CERRADO` **bloquea todos los grados**.
2. Solo **ADMIN** cierra y reabre actas; reapertura con motivo y auditoría.
3. Pensiones completas; boletas internas (no SUNAT); anulación = `EGRESO` con el
   mismo medio de pago.
4. La auditoría registra escrituras, accesos y descargas; **no lecturas**.
5. Fase demo: sin dominio, sin datos reales, sin planes pagos; correo en modo prueba.
6. La promoción es una **recomendación + confirmación humana**; no se codifica la
   norma peruana en el sistema.

---

## 7. Decisiones pendientes

- **SIAGIE:** ¿el colegio lo usa oficialmente? ¿Se implementa real o se retira?
- **Promoción:** egresados de 5to, repitentes, deuda, transición primaria→secundaria
  (ver documento 19, sección 8).
- **Demo:** fecha y alcance exacto (qué módulos verán los directivos).

---

## 8. Protocolo de trabajo

- La sesión de código implementa; esta sesión escribe prompts y revisa.
- Revisar el **código real** antes de aprobar; no confiar solo en el informe.
- Tras cada fase: push, migración manual en Supabase y verificación.
- Un commit atómico por hallazgo o fase.
- No cargar datos reales hasta cerrar la Fase 6 y la operación.
- No incluir secretos en el repositorio; credenciales en `.env` (ignorado).

---

## 9. Comandos de verificación

```powershell
git log -1 --oneline
git status --short
curl.exe -s https://siga-uc-api-prod.onrender.com/api/health
```

- Supabase: **43 tablas**, 0 actas, 145 horarios, 5 docentes demo. **H49/H73 aplicadas; 2026 activo; 1 política; 0 promociones.**
- Local: `npm run test:e2e` (65 PASS), `npm run test:integridad` (20 PASS en base de
  producción desechable; 18/2 de seed en local), `npm run test:h47-generador` (4 PASS) y
  `npm run smoke` (11 PASS).
- Deep links: `/login`, `/admin`, `/docente/asistencia` → 200.
- UI 6.2: `/admin/anios-lectivos` probada con ADMIN (preview, confirm, activación y modal de
  reversión).
- UI 6.3: `/admin/promociones` probada con ADMIN (preview, confirm, historial y override con
  re-previsualización); H73 aplicada en `siga_uc` local. 6.3.1 verificó además checkboxes de
  bimestres, invalidación del preview al cambiar `copiar_becas` y bloqueo de confirm con
  pendientes.

---

## 10. Próximo paso exacto

1. H49/H73 ya están aplicadas en Supabase demo: 43 tablas, 2026 activo, 1 política,
   0 promociones, 0 actas, 145 horarios y 5 docentes. **No volver a aplicarlas.**
2. 6.2, 6.3 y 6.3.1 ya están desplegadas en Render (`89eba24`).
3. Probar en Supabase **solo previews** de rollover y promoción. **No confirmar, no activar
   2027 y no anular** en el demo. Con 0 actas, el preview de promoción bloqueará: es correcto.
4. La **Fase 6.4 (histórico)** ya está desplegada en Render (65 E2E); no requiere migración
   ni tocar Supabase.
5. Preparar la **Fase 7 seleccionada** (H59, H62, H65–H69) y el cierre de demo. No empezar
   Fase 5/8 sin pedido explícito.

---

## Prompt de arranque para la nueva sesión de asesoría

```text
Estás retomando la sesión de ASESORÍA de SIGA-UC, no la de código.
Tu rol: escribir prompts, revisar resultados reales y ordenar las fases.
No implementas código, no tocas Supabase ni Render.

## Lectura mínima
1. HANDOFF_PROMPTS.md (raíz).
2. documentacion/18-AUDITORIA-PRODUCCION-2026-11-22.md.
3. documentacion/19-DISENO-MULTIANIO-Y-PROMOCION.md.
4. HANDOFF_SESSION.md (estado de la sesión de código).

## Estado
- Código desplegado: cdc129e (Fases 6.1, 6.2, 6.3, 6.3.1 y 6.4). Documentación: cdc129e.
- Fases 1-4 y 6.1-6.4 desplegadas; E2E 65 PASS.
- **H49 y H73 aplicadas en Supabase demo**: 43 tablas, 2026 activo, 1 política,
  0 promociones, 0 actas, 145 horarios y 5 docentes.
- No activar 2027 en el demo.

## Tarea de esta sesión
1. Verifica el estado sin tocar producción: git, health, tablas, actas y año activo.
2. Confirma que 2026 sigue activo y que no hay promociones confirmadas en Supabase.
3. Revisa el cierre de la Fase 6.4 (histórico): selector de año, consolidado por
   `id_usuario`/DNI, históricos read-only y enlaces con `?anio`.
4. Prepara el prompt de la **Fase 7 seleccionada** (H59, H62, H65–H69) y el cierre de demo.
5. No implementes código; no toques Supabase/Render sin confirmación.
6. No confirmes promociones, no actives 2027 y no anules en Supabase en esta fase.

## Reglas
- Prompts en español, con archivos y criterios de aceptación.
- Revisar el código real antes de aprobar.
- Un commit por fase; migraciones manuales en Supabase.
- No cargar datos reales hasta cerrar la Fase 6 y la operación.
```
