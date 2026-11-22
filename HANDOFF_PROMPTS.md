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
| Código desplegado en Render | `8ee4a7b` (Fase 4) |
| Último commit de documentación | `f352fe2` (diseño 19) |
| Backend / Frontend | Live en Render |
| `/api/health` | OK, `database: "ok"` |
| Supabase demo | 40 tablas, H48 aplicado, **0 actas** |
| Horarios en Supabase | **145 PUBLICADO**, 5 docentes demo (`99000001`–`99000005`) |
| Carga en Supabase | 55 cargas, 30/30/30/30/25 h; 0 choques |
| Local `siga_uc` | 42 tablas (41 base + `horarios_h47_backup`), H49 aplicado, 54 cargas en ADMIN, 0 horarios, 10 períodos, 14 asistencias normalizadas, 2026 activo |
| E2E | **27 PASS** |
| Integridad (base de producción desechable) | **14 PASS** |
| Smoke / generador H47 | 11 PASS / 4 PASS |
| Fase 6.1 (multi-año base) | Implementada, verificada y **desplegada en Render** (`3007dbe`); H49 **no aplicada en Supabase** |

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

La **Fase 6.1 (multi-año base)** quedó implementada y verificada en local:

- `anios_lectivos`, `grados.orden`, UNIQUE de `alumnos` por año.
- Login/perfil con matrícula del año activo, `matricula_activa=false` y
  `403 SIN_MATRICULA_ACTIVA` en endpoints académicos propios.
- Filtros por año en alumnos, asistencia, calificaciones, reportes, tesorería,
  notificaciones y horarios; `?anio` para históricos.
- Apoderados reutilizados por DNI; retiro que no desactiva si hay otra matrícula vigente.
- Migración H49 + rollback, tests 20–27, integridad 14 invariantes.

**Siguiente paso:** H49 ya está desplegado en Render (`3007dbe`); falta aplicarlo en
Supabase con autorización y backup previo. Después, preparar el prompt de **Fase 6.2
(rollover)**.

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
- **6.2 Rollover:** clonar grados, conceptos, períodos, carga y tutores.
- **6.3 Promoción:** previsualización, confirmación, fichas del año destino,
  egresados, repitentes, becas, pre-tickets.
- **6.4 Histórico:** selector de año y consolidados por `id_usuario`/DNI.
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

- Supabase: 40 tablas, 0 actas, 145 horarios, 5 docentes demo. **H49 no aplicado.**
- Local: `npm run test:e2e` (27 PASS), `npm run test:integridad` (14 PASS en base de
  producción desechable), `npm run test:h47-generador` (4 PASS).
- Deep links: `/login`, `/admin`, `/docente/asistencia` → 200.

---

## 10. Próximo paso exacto

1. Revisar el cierre de **Fase 6.1** contra el código y las suites (27 E2E, 14 integridad).
2. Verificar que H49 **no** se aplicó en Supabase y que el rollback solo se usó en bases
   desechables. El código ya está desplegado en Render (`3007dbe`).
3. Preparar el prompt de **Fase 6.2 (rollover)** con: clonado de grados/conceptos/períodos/
   carga/tutores, activación auditada del año, previsualización, idempotencia y plan de
   pruebas. Sin promoción todavía (6.3).

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
- Código desplegado: 8ee4a7b. Documentación: f352fe2.
- Fases 1–4 desplegadas; E2E 19 PASS en el despliegue.
- **Fase 6.1 implementada y verificada solo en local** (H49): E2E 27 PASS, integridad 14 PASS.
  No aplicada en Supabase ni Render.
- Supabase demo: 40 tablas, 145 horarios publicados, 5 docentes demo, 0 actas.
- Pendiente: commitear 6.1 y preparar Fase 6.2 (rollover); 6.3 promoción después.

## Tarea de esta sesión
1. Verifica el estado sin tocar producción: git, health, tablas y actas.
2. Revisa el cierre de Fase 6.1 contra el código real y las suites.
3. Si está correcto, prepara el prompt de Fase 6.2 (rollover) con:
   clonado de grados/conceptos/períodos/carga/tutores, activación auditada,
   idempotencia, previsualización y plan de pruebas.
4. No implementes código; no toques Supabase/Render sin confirmación.

## Reglas
- Prompts en español, con archivos y criterios de aceptación.
- Revisar el código real antes de aprobar.
- Un commit por fase; migraciones manuales en Supabase.
- No cargar datos reales hasta cerrar la Fase 6 y la operación.
```
