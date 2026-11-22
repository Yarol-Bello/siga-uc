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
| Local `siga_uc` | 41 tablas (incluye `horarios_h47_backup`), 54 cargas en ADMIN, 0 horarios, 10 períodos, 14 asistencias normalizadas |
| E2E | **19 PASS** |
| Smoke / integridad / generador H47 | Verificados |

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

La sesión de código está aplicando las **correcciones al documento 19**:

- a) `UNIQUE` parcial en `promociones` para permitir re-promover tras una anulación.
- b) `TRASLADADO` en `resultado`/CHECK (o decisión de usar `RETIRADO`).
- c) Inventario de consultas por DNI/usuario que deben filtrar por año activo.
- d) Corrección: `asistencia_alumnos` **no** tiene `anio_lectivo`.
- e) Apoderados: reutilizar por DNI para hermanos (`alumnoDao.crear` hoy inserta uno nuevo).
- f) Menores: `politicas_promocion` (nullable) y `permite_override` por defecto.

**Siguiente paso:** cuando el usuario pegue la respuesta, revisarla contra el código
real. Si está completa, preparar el prompt de **Fase 6.1 (multi-año base)**. Si falta
algo, pedir el ajuste antes de avanzar.

---

## 5. Fases pendientes

### Fase 5 — SIAGIE (H52 + H05)

- Decidir si el colegio lo usa oficialmente.
- Propuesta: **exportador/mapeo configurable por año**, no un importador rígido;
  la plantilla de MINEDU puede cambiar.
- Si no se usa: retirar el portal simulado y etiquetar la exportación como interna.

### Fase 6 — Multi-año y promoción

- **6.1 Base:** uniques por año, `grados.orden`, `anios_lectivos`, login por año,
  inventario de consultas, apoderados.
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

- Supabase: 40 tablas, 0 actas, 145 horarios, 5 docentes demo.
- Local: `npm run test:e2e` (19 PASS), `npm run test:integridad`,
  `npm run test:h47-generador`.
- Deep links: `/login`, `/admin`, `/docente/asistencia` → 200.

---

## 10. Próximo paso exacto

1. Revisar la respuesta de la sesión de código sobre las correcciones del documento 19.
2. Si está completa, preparar el prompt de **Fase 6.1 (multi-año base)** con:
   migración, uniques por año, `grados.orden`, `anios_lectivos`, login por año,
   inventario de consultas, apoderados, plan de pruebas y rollback.
3. Si falta alguna corrección, pedir el ajuste antes de avanzar.

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
- Fases 1–4 desplegadas; E2E 19 PASS.
- Supabase demo: 40 tablas, 145 horarios publicados, 5 docentes demo, 0 actas.
- Pendiente: correcciones del diseño 19 y Fase 6 (multi-año y promoción).

## Tarea de esta sesión
1. Verifica el estado sin tocar producción: git, health, tablas y actas.
2. Lee la respuesta de la sesión de código sobre las 5 correcciones del
   documento 19. Revísala contra el código y el diseño.
3. Si está correcta, prepara el prompt de Fase 6.1 (multi-año base) con:
   migración, uniques por año, grados.orden, anios_lectivos, login por año,
   inventario de consultas, apoderados, plan de pruebas y rollback.
4. Si falta alguna corrección, pide el ajuste antes de avanzar.
5. No implementes código; no toques Supabase/Render sin confirmación.

## Reglas
- Prompts en español, con archivos y criterios de aceptación.
- Revisar el código real antes de aprobar.
- Un commit por fase; migraciones manuales en Supabase.
- No cargar datos reales hasta cerrar la Fase 6 y la operación.
```
