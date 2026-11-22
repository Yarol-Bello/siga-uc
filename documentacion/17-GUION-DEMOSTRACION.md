# 17 — Guion de Demostración y Checklist

**Fase:** demostración y aprobación por la dirección del colegio.
**No es producción real.** No hay dominio propio, no hay planes pagos y no se cargan
datos de menores.

> Documento operativo para ensayar y ejecutar la demo. Si algo del código difiere de este
> guion, manda el código.

---

## 1. Límites de esta fase

| Permitido | Fuera de alcance |
|---|---|
| Local (PostgreSQL 18) | Dominios, DNS y Resend con dominio propio |
| Render gratuito | Render Starter o Supabase pago |
| Supabase gratuito | Datos reales de alumnos, apoderados o personal |
| Datos ficticios o de prueba | Servidores del colegio o de la empresa |
| Notificaciones en la campanita | Pasarelas de pago |
| Smoke, integridad y E2E | Prometer correos reales a apoderados |

**Correo:** el remitente sigue siendo `SIGA-UC <onboarding@resend.dev>`. En modo prueba
Resend solo entrega al correo dueño de la cuenta. La notificación **sí** se guarda y se ve
en la campanita; el modal muestra el aviso de modo prueba.

**Datos:** solo ficticios. Al terminar la demo, la base de prueba se puede recrear
(ver sección 8).

---

## 2. Antes de la demo

### 2.0 Entorno recomendado

| Entorno | Datos | Cuándo usarlo |
|---|---|---|
| **Local** (`siga_uc` con `siga_uc_completo.sql`) | 21 alumnos ficticios, usuarios de los 4 roles, pagos y pensiones | **Recomendado** para el guion completo: notas, libreta, reportes y caja |
| Render + Supabase (demo) | Solo usuarios y alumno de prueba | Para mostrar que está desplegado; insuficiente para libreta/reportes si no se preparan datos |

La demo completa se ensaya en local. Si se muestra el entorno de Render, preparar antes
datos ficticios equivalentes (grados con alumnos, cursos con docente, notas y caja) y
verificar el checklist.

### 2.1 Un día antes

- [ ] Confirmar que el commit desplegado es el esperado (`git log -1 --oneline`).
- [ ] Verificar `GET https://siga-uc-api-prod.onrender.com/api/health` → `success: true`,
      `database: "ok"`.
- [ ] Abrir el frontend y hacer login con cada rol que se va a mostrar.
- [ ] Revisar que las cuentas de demo **no** estén en `requiere_cambio_password`.
- [ ] Confirmar que hay una caja aperturable y al menos una pensión `PENDIENTE`.
- [ ] Generar una libreta PDF de prueba y abrirla.
- [ ] Enviar una notificación de prueba y verla en la campanita del destinatario.
- [ ] Revisar la bitácora: deben aparecer `LOGIN`, `CREAR`, `ANULAR`, `ENVIAR` y
      `DESCARGAR`.

### 2.2 Treinta minutos antes

- [ ] **Despertar Render:** abrir el backend y esperar el health check. El plan gratuito
      puede tardar cerca de un minuto tras el sleep.
- [ ] **Despertar Supabase:** abrir el proyecto; si está pausado, reactivarlo desde el
      panel. El plan gratuito se pausa por inactividad.
- [ ] Abrir el navegador con las pestañas listas: login, dashboard, tesorería, caja,
      reportes y auditoría.
- [ ] Cerrar sesiones anteriores y dejar el zoom al 100 %.
- [ ] Tener a mano `docs/CREDENCIALES.md` (sin mostrar contraseñas en pantalla).
- [ ] Tener el guion impreso o en otra pantalla.

### 2.3 Verificación técnica local (antes de la demo)

```powershell
cd siga-uc-backend
npm run smoke              # 11 PASS, 0 FAIL, 0 SKIP (exit 0)
npm run test:integridad    # 14 invariantes; los FAIL de seed son esperados en demo
npm run test:e2e           # 27 PASS, 0 FAIL (exit 0); elimina siga_uc_e2e
```

`npm run smoke` contra Render **no** se ejecuta sin confirmación explícita: hace login y
escribe `ultimo_login` y un registro `LOGIN` en la bitácora.

Para ensayar notificaciones sin correo real, arrancar el backend con una key inválida no
vacía (`RESEND_API_KEY=re_test_no_enviar`). En PowerShell, `RESEND_API_KEY=""` elimina la
variable y `dotenv` carga la key real.

**Resultado del ensayo local (21/11/2026):**

- `npm run smoke`: **11 PASS, 0 FAIL, 0 SKIP** (exit 0), tras alinear la contraseña del
  ADMIN local `74829102` con `SMOKE_ADMIN_PASSWORD` de `.env`.
- `npm run test:integridad`: **8 PASS, 2 FAIL** esperados por el seed de demo
  (pagos sin INGRESO y pensiones `PAGADO` sin pago).
- `npm run test:e2e`: **27 PASS, 0 FAIL** (exit 0), base `siga_uc_e2e` eliminada.
- Notificación con Resend deshabilitado: **guardada 1, correos enviados 0, fallidos 1**,
  visible en la campanita. Los residuos de la prueba se eliminaron.

---

## 3. Guion de la demo (20–25 minutos)

### Paso 0 — Contexto (2 min)

Decir qué es SIGA-UC: matrícula, pensiones y caja, notas por competencias, asistencia QR,
reportes, SIAGIE, notificaciones y auditoría. Aclarar que es una **demostración con datos
ficticios** y que el correo está en modo prueba.

### Paso 1 — Login y panel (2 min)

1. Entrar como **ADMIN** (`74829102`; contraseña en el gestor, no en pantalla).
2. Mostrar el dashboard: KPIs de alumnos, personal, pagos y caja.
3. Señalar la campanita y la bitácora como mecanismos de trazabilidad.

**Mensaje:** “Todo queda auditado; la UI muestra solo lo que cada rol necesita”.

### Paso 2 — Caja abierta (2 min)

1. Ir a **Caja**.
2. Si no hay caja abierta, **Aperturar** con un fondo ficticio (por ejemplo S/ 100).
3. Mostrar los KPIs: efectivo esperado, ingresos, egresos y balance.

**Mensaje:** “Sin caja abierta no se puede cobrar; el dinero siempre tiene responsable”.

> Mantener la caja abierta hasta después de la anulación. Si se cierra antes, reabrir para
> la demostración de anulación.

### Paso 3 — Nueva matrícula (3 min)

1. Ir a **Alumnos** → **Nueva Matrícula**.
2. Completar con datos ficticios: DNI de 8 dígitos no usado, nombres, apellidos, fecha de
   nacimiento, correo personal, grado y apoderado.
3. Guardar.
4. Mostrar que el alumno queda en **`PendientePago`**.

**Mensaje:** “La matrícula no basta: el alumno se activa cuando se paga”.

### Paso 4 — Cobro de matrícula y generación de pensiones (3 min)

1. Ir a **Tesorería**.
2. Buscar al alumno recién creado.
3. Cobrar el concepto de **matrícula**; elegir forma de pago y registrar el voucher.
4. Mostrar el cambio a **`Matriculado`** y las pensiones generadas.
5. Explicar H44: el cronograma se genera **desde el mes de creación hasta diciembre**. Un
   alumno creado en noviembre solo tendrá noviembre y diciembre; no se inventan meses
   anteriores.
6. Abrir la boleta generada.

**Mensaje:** “Un solo cobro de matrícula dispara el cronograma y la boleta en la misma
transacción”.

### Paso 5 — Cobro de una pensión (2 min)

1. En la misma grilla, cobrar la pensión de noviembre (o la pendiente).
2. Mostrar la boleta y el movimiento en caja.
3. Señalar que la pensión pasa a `PAGADO`.

### Paso 6 — Anulación de un pago (3 min)

1. En **Caja** → historial de pagos, elegir el pago recién registrado.
2. **Anular pago** con un motivo de al menos 10 caracteres.
3. Mostrar:
   - la pensión vuelve a `PENDIENTE`;
   - se genera un **EGRESO** con el mismo medio de pago;
   - la boleta queda marcada **ANULADA**.
4. Mostrar el registro `ANULAR` en la bitácora.

**Mensaje:** “Anular no borra: compensa y deja rastro”.

### Paso 7 — Nota y libreta (4 min)

1. Cerrar sesión y entrar como **DOCENTE** (`20394812`).
2. Ir a **Notas**, elegir curso, grado y bimestre.
3. Registrar `AD`, `A`, `B` o `C` por competencia y **Guardar Cambios**.
4. Mostrar que la nota final se calcula al guardar.
5. Volver a **ADMIN** → **Reportes** → **Libretas Informativas**.
6. Elegir grado y bimestre → **Ver Libreta** → **Exportar PDF**.
7. Mostrar el PDF generado.

**Mensaje:** “La nota por competencia alimenta la libreta y los reportes; no se digita dos
veces”.

> Si la libreta sale vacía, faltan `notas_finales_area`. Guardar notas del bimestre antes
> de la demo y verificarlo.

### Paso 7b — Horario publicado (3 min)

1. En **ADMIN** → **Horarios**, elegir año y grado; mostrar la grilla de 8 bloques, recreo
   y almuerzo.
2. Si la carga está balanceada, usar **Generar automático**; si el preflight avisa
   sobrecarga, mostrar el mensaje y la lista de horas sin ubicar (es una validación real).
3. Revisar la grilla en **BORRADOR** y pulsar **Publicar**.
4. Entrar como **ESTUDIANTE** → **Horario de Clases**: solo debe ver su grado y lo
   publicado.
5. Entrar como **DOCENTE** → **Mi Horario**: debe ver sus bloques en varios grados.

**Mensaje:** “El docente no se duplica y el alumno no puede consultar otro grado; el
horario en borrador no es visible”.

> Para una demo completa, preparar la carga con docentes balanceados o publicar un horario
> parcial consciente. El seed de producción asigna las 55 cargas al ADMIN y el preflight
> responderá que no es posible generar.

### Paso 8 — Notificación interna (2 min)

1. En **ADMIN** → dashboard → **Nueva Notificación**.
2. Leer en voz alta el aviso: “Correo en modo prueba: la notificación se guarda, pero los
   correos solo llegan a la cuenta del administrador.”
3. Elegir **Un alumno específico** o **Un grado**, escribir asunto y mensaje, enviar.
4. Mostrar el resultado: destinatarios y correos enviados/fallidos.
5. Entrar como el estudiante destinatario y abrir la **campanita**.

**Mensaje:** “Aunque el correo falle, la notificación queda en el buzón del usuario; en
producción se verificará el dominio para que también salga el correo”.

### Paso 9 — Auditoría (2 min)

1. Ir a **Auditoría**.
2. Filtrar por acción `CREAR`, `ANULAR`, `PUBLICAR`, `GENERAR`, `ENVIAR` y `DESCARGAR`.
3. Abrir el detalle de un evento: usuario, rol, módulo, descripción, IP y fecha.

**Mensaje:** “Cada operación crítica queda con responsable y evidencia”.

### Paso 10 — Vista del estudiante (1 min)

1. Entrar con un estudiante de demo.
2. Mostrar dashboard, asistencia y horario.
3. Aclarar que la **libreta PDF** se muestra desde Reportes (ADMIN); la pantalla de libreta
   del estudiante es una mejora pendiente (H35).

### Cierre (1 min)

Resumir: matrícula → pensión → caja → nota → libreta → notificación → auditoría, todo con
datos ficticios. Pedir la aprobación y registrar observaciones de la dirección.

---

## 4. Checklist “listo para demostrar”

### Sistema

- [ ] Frontend y backend responden; health check en `ok`.
- [ ] Commit desplegado identificado y documentado.
- [ ] 41 tablas base y migraciones H32, H10/H38, H07, H45, H47, H48, H61 y H49 aplicadas
      (42 en local si existe `horarios_h47_backup`).
- [ ] Build del frontend genera `404.html` y apunta a la API correcta.
- [ ] `npm run smoke` local: **11 PASS, 0 FAIL, 0 SKIP** (exit 0).
- [ ] `npm run test:e2e` local: **27 PASS, 0 FAIL** (exit 0).
- [ ] `npm run test:integridad` revisado; los FAIL de seed están explicados.

### Datos de demo

- [ ] Cuentas ADMIN, DOCENTE, SECRETARIA y ESTUDIANTE activas y sin cambio obligatorio.
- [ ] Al menos un grado con alumnos y un curso con docente asignado.
- [ ] Al menos una pensión `PENDIENTE` para cobrar y una `PAGADO` para mostrar.
- [ ] Notas del bimestre cargadas para que la libreta no salga vacía.
- [ ] Caja aperturable y sin cierre pendiente que bloquee el cobro.
- [ ] Notificación de prueba visible en la campanita.
- [ ] Eventos de auditoría de la demo visibles.

### Discurso y seguridad

- [ ] Está claro que es una demo con datos ficticios.
- [ ] No se prometen correos a apoderados ni producción real.
- [ ] No se muestran contraseñas, tokens ni `.env` en pantalla.
- [ ] No se muestran datos personales reales.
- [ ] Se conocen las limitaciones (sección 6) y no se promete lo que no está.

---

## 5. Plan B — fallos frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El backend tarda en responder | Render gratuito dormido | Esperar el health check; no recargar en bucle |
| Error de conexión a la base | Supabase pausado | Reactivar el proyecto en el panel y reintentar |
| “Primero registre el pago de matrícula” | Alumno en `PendientePago` | Cobrar matrícula antes de pensiones |
| No deja cobrar | Caja cerrada | Aperturar caja |
| La libreta sale vacía | Sin `notas_finales_area` | Guardar notas del bimestre y regenerar |
| El correo no llega | Modo prueba de Resend | Mostrar la campanita; no prometer correo |
| “No hay notas” en SIAGIE | Faltan notas finales | No demostrar SIAGIE sin preparar datos |
| El acta cerrada permite editar | Limitación conocida (H06) | No demostrarlo como control |
| El estudiante no ve libreta | Mejora pendiente (H35) | Mostrar el PDF desde ADMIN |

---

## 6. Qué NO prometer en la demo

- Que los correos llegan a apoderados: hoy solo llegan a la cuenta dueña de Resend.
- Que el sistema es producción real: es un entorno de demostración gratuito.
- Que hay backups garantizados: Supabase gratuito no ofrece garantías de retención.
- Que el SIAGIE cubre todos los cursos: solo detecta prefijos `ARITM`, `ALGEBRA`,
  `COMUNIC` y `FISICA`.
- Que el acta cerrada bloquea notas: no lo hace (H06).
- Que existe app móvil, pasarela de pagos o integración con el colegio.

---

## 7. Después de la demo

1. Registrar observaciones y preguntas de la dirección.
2. Si piden cambios, priorizarlos como hallazgos; no improvisar en producción.
3. Si se aprueba, recién entonces planificar dominio, planes pagos y datos reales
   (ver `HANDOFF_SESSION.md`, sección 8).
4. Si no se aprueba, corregir y repetir la demo con datos ficticios.

---

## 8. Limpieza de datos de prueba

La demo usa **solo datos ficticios**. Al terminar, hay dos caminos:

### Opción A — Recrear la base de demo (recomendado)

Solo si la base **no contiene datos reales**:

```sql
-- En el SQL Editor de Supabase, proyecto de PRUEBA
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Luego aplicar en orden, a mano:

1. `database/siga_uc.sql`
2. `database/seed_produccion.sql` (con `-v admin_password`)
3. `database/migracion_h32_anulacion_pagos.sql`
4. `database/migracion_h10_h38_concurrencia_pagos.sql`
5. `database/migracion_h07_auditoria.sql`
6. `database/migracion_h45_pensiones_anuladas.sql`

> Un `git push` **no** aplica migraciones. Cada archivo se ejecuta manualmente.

### Opción B — Conservar la demo

Dejar los datos ficticios y marcar la base como “demo”. No cargar datos reales en el mismo
proyecto sin recrearlo antes.

### Opción C — Base local

```powershell
dropdb -U postgres siga_uc
createdb -U postgres siga_uc
psql -U postgres -d siga_uc -f database/siga_uc_completo.sql
# y las migraciones en orden
```

**Nunca** ejecutar la limpieza sobre una base con datos reales.

---

*Última actualización: 21/11/2026 — fase de demostración y aprobación.*
