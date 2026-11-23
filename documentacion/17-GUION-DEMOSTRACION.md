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
| **Local** (`siga_uc_uat`) | 75 alumnos ficticios, 6 docentes, notas, asistencia, horarios, pensiones y pagos | Para ensayar sin depender de Render/Supabase |
| **Render + Supabase (demo)** | Los mismos 75 alumnos, 6 docentes activos, 55 carga, 145 horarios, 750 pensiones y 113 pagos | **Recomendado** para la demo desplegada: los datos ya están cargados |

La demo completa se puede ejecutar en Render/Supabase con los 75 alumnos cargados. El
entorno local `siga_uc_uat` conserva el mismo dataset para ensayo. El ADMIN de Supabase
conserva su contraseña real; las cuentas UAT de SECRETARÍA, DOCENTE y ESTUDIANTE usan las
credenciales entregadas en la sesión.

### 2.1 Un día antes

- [ ] Confirmar que el commit desplegado es el esperado (`git log -1 --oneline`).
- [ ] Verificar `GET https://siga-uc-api-prod.onrender.com/api/health` → `success: true`,
      `database: "ok"`.
- [ ] Abrir el frontend y hacer login con cada rol que se va a mostrar.
- [ ] Revisar que las cuentas de demo **no** estén en `requiere_cambio_password`.
- [ ] Confirmar que hay una caja aperturable y al menos una pensión `PENDIENTE`.
- [ ] Confirmar en Supabase: **75 alumnos**, **6 docentes activos**, **55 carga**,
      **145 horarios publicados**, **750 pensiones**, **113 pagos** y **1 acta ABIERTO**.
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
npm run test:integridad    # 21 invariantes; en local se esperan 19 PASS y 2 FAIL de seed
npm run test:e2e           # 75 PASS, 0 FAIL (exit 0); elimina siga_uc_e2e
npm run test:h47-generador # 4 PASS; no toca la BD
```

`npm run smoke` contra Render **no** se ejecuta sin confirmación explícita: hace login y
escribe `ultimo_login` y un registro `LOGIN` en la bitácora.

Para ensayar notificaciones sin correo real, arrancar el backend con una key inválida no
vacía (`RESEND_API_KEY=re_test_no_enviar`). En PowerShell, `RESEND_API_KEY=""` elimina la
variable y `dotenv` carga la key real.

**Resultado del ensayo local (22/11/2026, cierre de demo):**

- `npm run smoke`: **11 PASS, 0 FAIL, 0 SKIP** (exit 0), con la contraseña del ADMIN local
  alineada a `SMOKE_ADMIN_PASSWORD` de `.env`.
- `npm run test:integridad`: **19 PASS, 2 FAIL** esperados por el seed de demo
  (pagos sin INGRESO y pensiones `PAGADO` sin pago). En una base nueva: **21 PASS**.
- `npm run test:e2e`: **75 PASS, 0 FAIL** (exit 0), base `siga_uc_e2e` eliminada.
- `npm run test:h47-generador`: **4 PASS**.
- Notificación con Resend deshabilitado: guardada y visible en la campanita; correos
  fallidos sin romper el flujo. Los residuos de la prueba se eliminaron.
- SIAGIE interno: Excel descargado desde la UI y abierto con ExcelJS; 11 cursos, 4 alumnos,
  nota final y conclusión. Hoja `Aviso` con el texto de exportación interna.

---

## 3. Guion de la demo (20–25 minutos)

### Paso 0 — Contexto (2 min)

Decir qué es SIGA-UC: matrícula, pensiones y caja, notas por competencias, asistencia QR,
reportes, exportación interna de calificaciones, notificaciones y auditoría. Aclarar que es
una **demostración con datos ficticios**, que el correo está en modo prueba y que la
exportación **no es oficial ante SIAGIE/MINEDU**.

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

1. Cerrar sesión y entrar como **DOCENTE** (`73000001` / `Docente2026*` en la UAT).
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

### Paso 7a — Conclusiones descriptivas y código de control (3 min)

1. En **DOCENTE** → **Conclusiones Descriptivas**, elegir un curso y bimestre.
2. Abrir un estudiante. Mostrar que el **nivel de logro** se toma de la nota final y que
   los campos son **Avance**, **Dificultad** y **Sugerencia**.
3. Pulsar **Generar sugerencia**, editar brevemente y mostrar el contador `x/350`.
4. **Publicar** y ver el estado “Publicada”.
5. En **ADMIN** → **Exportación interna**, exportar el Excel del grado/bimestre.
6. Mostrar la hoja **Aviso**: código de control interno y hash SHA-256. Pegar el código en
   la tarjeta **Verificar código de control interno** y mostrar “Código válido”.
7. Recalcar: el código es **interno**; no es el código oficial de SIAGIE/MINEDU. Para una
   carga oficial se necesita la plantilla oficial de SIAGIE.

**Mensaje:** “La conclusión ya no es un texto suelto: tiene nivel, avance, dificultad y
sugerencia, y el Excel interno se puede verificar”.

> Si el acta está cerrada, la pantalla se vuelve de solo lectura. Es el comportamiento
> esperado.

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

### Paso 7c — Años lectivos y rollover (solo preview, 2 min)

1. En **ADMIN** → **Años Lectivos y Rollover**, mostrar el catálogo: año activo, años
   planificados/cerrados y conteos de oferta y actividad.
2. Elegir origen 2026 y destino 2027. Pulsar **Previsualizar**.
3. Recorrer el resumen y las secciones: grados, conceptos `MATRICULA`/`PENSION`, períodos,
   carga y tutores. Señalar el hash de previsualización y que la operación es de solo
   lectura.
4. Mostrar un bloqueo real si existe (docente sobrecargado o inactivo, oferta distinta en el
   destino, falta de `MATRICULA`). Explicar que el botón de confirmar queda deshabilitado.
5. **No confirmar, no activar y no revertir en Supabase durante la demo.** El objetivo es
   mostrar que el sistema exige revisión humana y no promueve alumnos solo.

**Mensaje:** “El rollover prepara la oferta del año siguiente; la promoción de alumnos es
una fase separada y se confirmará con dirección. En esta demo solo mostramos la
previsualización.”

### Paso 7d — Promoción de alumnos (solo preview, 3 min)

1. En **ADMIN** → **Promoción de Alumnos**, elegir origen 2026, destino con oferta (por
   ejemplo 2027/2028), una política y un grado. Pulsar **Previsualizar**.
2. Recorrer la tabla: DNI, grado, estado, actas, notas, asistencia, deuda, beca, resultado
   sugerido, resultado final y bloqueos. Señalar que el preview no escribe nada.
3. Mostrar un bloqueo real: actas/notas faltantes, transición sin configurar o alumno ya
   matriculado en el destino. Explicar que el confirm queda bloqueado.
4. Si la política permite override, cambiar un resultado, escribir un motivo y volver a
   previsualizar. Mostrar que el hash cambia y que el override queda auditado.
5. **No confirmar la promoción en Supabase durante la demo.** La confirmación crea
   matrículas del año destino; se prueba en una base desechable con dirección.
6. Recalcar que la promoción **no activa el año** ni copia notas, pagos, pensiones,
   asistencia ni QR.

**Mensaje:** “El sistema recomienda, pero la decisión es humana. La promoción crea la
matrícula del año siguiente; activar el año es una acción separada de la Fase 6.2.”

### Paso 7e — Histórico por estudiante (2 min)

1. En **ADMIN** → **Histórico por Estudiante**, buscar el DNI de un alumno con más de un año
   (en local/E2E; en Supabase demo puede no haber dos años del mismo alumno).
2. Mostrar la tarjeta de identidad y la tabla de una fila por año: grado, estado, promoción,
   notas AD/A/B/C, % de asistencia, pagado, deuda y pensiones.
3. Abrir **Libreta** del año: navega a Reportes con `?anio=&dni=&grado=` y abre el modal.
   Abrir **Asistencia**: modal con la asistencia de ese año.
4. Volver al padrón y cambiar el selector a un año anterior: aparece el badge **Histórico**
   y desaparecen **Nueva matrícula**, editar, retirar y reset. En Tesorería ocurre lo mismo
   con Cobrar/Generar pensiones.
5. Recalcar que la identidad se agrupa por DNI/`id_usuario` y que los pagos y notas de un año
   no se suman con los de otro.

**Mensaje:** “El sistema conserva la trayectoria completa del estudiante sin mezclar
matrículas anuales. Los años cerrados se consultan, pero no se editan.”

### Paso 7f — Exportación interna de calificaciones (2 min)

1. En **ADMIN** → **Exportación interna**, leer en voz alta el aviso:
   “Exportación interna. No es una exportación oficial a SIAGIE/MINEDU.”
2. Elegir año, grado (por ejemplo 3ro) y bimestre. Mostrar el resumen: cursos, alumnos,
   notas finales y conclusiones; si faltan notas, el sistema lo advierte y no inventa datos.
3. Señalar que **no hay portal, plantilla ni archivo que subir**: el Excel se genera desde
   la base de datos de SIGA-UC.
4. Pulsar **Exportar Excel interno** y abrir el archivo. Verificar que aparecen todos los
   cursos del grado (no solo Matemática/Comunicación), con DNI, alumno, grado, sección,
   año, bimestre, curso, nota final y conclusión descriptiva.
5. Abrir la hoja **Aviso** y mostrar el texto de exportación interna.
6. Mostrar en **Auditoría** el evento `SIAGIE`/`EXPORTAR` con el nombre del archivo y los
   conteos.

**Mensaje:** “Es una herramienta interna de apoyo y respaldo; no reemplaza la exportación
oficial del colegio ni sube datos a MINEDU. Incluye todos los cursos del grado.”

> Si el grado no tiene notas finales, el Excel se genera con celdas vacías y una
> advertencia. No prometer que el SIAGIE oficial ya está integrado.

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
- [ ] 43 tablas base y migraciones H32, H10/H38, H07, H45, H47, H48, H61, H49, H73, H59 y
      H71 aplicadas (44 en local si existe `horarios_h47_backup`).
- [ ] Build del frontend genera `404.html` y apunta a la API correcta.
- [ ] `npm run smoke` local: **11 PASS, 0 FAIL, 0 SKIP** (exit 0).
- [ ] `npm run test:e2e` local: **102 PASS, 0 FAIL** (exit 0).
- [ ] `npm run test:h47-generador`: **4 PASS**.
- [ ] `npm run test:integridad` revisado; **36 PASS** en base nueva (UAT) y los fallos
      de seed local explicados.
- [ ] SIAGIE interno sin portal ni plantilla; el Excel incluye todos los cursos, columnas
      estructuradas y el aviso de exportación interna.
- [ ] Conclusiones descriptivas: 3,300 estructuradas en la demo; código de control interno
      visible y verificable (no es el código oficial de SIAGIE).
- [ ] Selector de año visible en Reportes, Padrón y Tesorería; un año no activo muestra
      **Histórico** y oculta las escrituras.
- [ ] `/admin/historico` responde por DNI y los enlaces abren libreta/asistencia/tesorería
      con `?anio=`.

### Datos de demo

- [ ] Cuentas ADMIN, DOCENTE, SECRETARIA y ESTUDIANTE activas y sin cambio obligatorio.
- [ ] Al menos un grado con alumnos y un curso con docente asignado.
- [ ] Al menos una pensión `PENDIENTE` para cobrar y una `PAGADO` para mostrar.
- [ ] Notas del bimestre cargadas para que la libreta no salga vacía.
- [ ] Caja aperturable y sin cierre pendiente que bloquee el cobro.
- [ ] Notificación de prueba visible en la campanita.
- [ ] Dashboard: “Estudiantes matriculados”, “Plana Docente” y “Personal activo” con cifras
      coherentes; panel “Cobranza y expedientes” sin badge de filtro falso.
- [ ] Grado con notas finales cargadas para que la exportación interna no salga vacía.
- [ ] Carga equilibrada o consciente: en local las 142 h están en el ADMIN y el docente no
      ve cursos; para la demo docente, reasignar cargas a docentes o usar una base de ensayo.
- [ ] Personal: cese con observación y ficha del cesado muestran el texto guardado.
- [ ] Textos de demo corregidos: sin “Facturación”, “Decorativo”, “11 cursos”, “firma
      digital”, “Abrir Portal” ni “mapeado correctamente”; `index.html` con `lang="es"` y
      título del colegio.
- [ ] Correo en modo prueba y logs sin correos, tokens ni contraseñas.
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
| El Excel interno sale sin notas | Faltan `notas_finales_area` | Cargar notas del bimestre; el sistema avisa y no inventa datos |
| El estudiante no ve libreta | Mejora pendiente (H35) | Mostrar el PDF desde ADMIN |

---

## 6. Qué NO prometer en la demo

- Que los correos llegan a apoderados: hoy solo llegan a la cuenta dueña de Resend.
- Que el sistema es producción real: es un entorno de demostración gratuito.
- Que hay backups garantizados: Supabase gratuito no ofrece garantías de retención.
- Que la exportación interna es oficial o sube datos a SIAGIE/MINEDU: no lo es y no lo
  hace. Los cursos sí se incluyen todos.
- Que el sistema ya está integrado con el portal del MINEDU: no hay integración oficial.
- Que existe app móvil, pasarela de pagos o integración con el colegio.
- Que el correo ya llega a apoderados: en modo prueba solo llega a la cuenta dueña de
  Resend; la campanita sí funciona.

---

## 7. Después de la demo

1. Registrar observaciones y preguntas de la dirección.
2. Si piden cambios, priorizarlos como hallazgos; no improvisar en producción.
3. Si se aprueba, recién entonces planificar dominio, planes pagos y datos reales
   (ver `HANDOFF_SESSION.md`, sección 8).
4. Si no se aprueba, corregir y repetir la demo con datos ficticios.

---

## 8. Limpieza de datos de prueba

La demo usa **solo datos ficticios**. Antes de tocar nada, hacer backup:

```powershell
cd siga-uc-backend
npm run backup   # backups/backup_siga_uc_YYYY-MM-DD_HH-mm-ss.sql
```

> El backup local no reemplaza el backup del proveedor. En Supabase, verificar el backup o
> exportar antes de cualquier limpieza. **Nunca** ejecutar la limpieza sobre datos reales.

### Opción A — Recrear la base de demo (recomendado)

Solo si la base **no contiene datos reales**:

```sql
-- En el SQL Editor de Supabase, proyecto de PRUEBA
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Luego aplicar en orden, a mano:

1. `database/siga_uc.sql`
2. `database/seed_produccion.sql` (con `-v anio_lectivo=YYYY -v admin_password=...`)
3. `database/migracion_h32_anulacion_pagos.sql`
4. `database/migracion_h10_h38_concurrencia_pagos.sql`
5. `database/migracion_h07_auditoria.sql`
6. `database/migracion_h45_pensiones_anuladas.sql`
7. `database/migracion_h47_horarios.sql`
8. `database/migracion_h48_actas.sql`
9. `database/migracion_h61_dia_semana.sql`
10. `database/migracion_h49_multianio_base.sql` (editar `_param_anio` al año)
11. `database/migracion_h73_promociones.sql`
12. `database/migracion_h59_observaciones_personal.sql`
13. `database/migracion_h71_retirados_historicos.sql`

> Un `git push` **no** aplica migraciones. Cada archivo se ejecuta manualmente y en orden.
> `database/rollback_h49_multianio_base.sql` y `database/rollback_h73_promociones.sql` son
> **solo para bases desechables**; en una base real se restaura el backup.

### Opción B — Conservar la demo

Dejar los datos ficticios y marcar la base como “demo”. No cargar datos reales en el mismo
proyecto sin recrearlo antes. Mantener 2026 como ACTIVO; 2027 no se activa en Supabase.

### Opción C — Base local

```powershell
dropdb -U postgres siga_uc
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
psql -U postgres -d siga_uc -f database/migracion_h73_promociones.sql
psql -U postgres -d siga_uc -f database/migracion_h59_observaciones_personal.sql
psql -U postgres -d siga_uc -f database/migracion_h71_retirados_historicos.sql
```

### Plan de reinicio rápido

1. Detener backend y frontend.
2. Hacer backup (`npm run backup`) o exportar Supabase.
3. Recrear la base (Opción A/C) o restaurar el backup.
4. Arrancar el backend y esperar `/api/health` con `database: "ok"`.
5. Ejecutar `npm run test:integridad` (21 PASS en base nueva; 19/2 en demo local).
6. Ejecutar `npm run smoke` (11 PASS) y `npm run test:e2e` (75 PASS).
7. Borrar `database/siga_uc_e2e` si el script no pudo hacerlo.

---

## 9. UAT de cierre (22/11/2026)

### Cuentas usadas

| Rol | DNI | Contraseña |
|---|---|---|
| ADMIN | `74829102` | La de `SMOKE_ADMIN_PASSWORD` en `.env` (no se documenta) |
| SECRETARIA | `40596837` | La misma clave de demo del ADMIN |
| DOCENTE | `20394812` | La de `SMOKE_DOCENTE_PASSWORD` en `.env` |
| ESTUDIANTE | `75918234` (3ro) | `UC75918234` (demo local) |

En Supabase demo no se usan estas claves: la base es de prueba y no debe rotarse ni
cargarse con datos reales.

### Resultado

| Área | Resultado |
|---|---|
| Login 4 roles | ✅ ADMIN, SECRETARIA, DOCENTE y ESTUDIANTE entran y ven su panel |
| Login responsive | ✅ Probado de 320×568 a 1920×1080; móvil con marca compacta, inputs de 16 px y modal adaptativo |
| Sidebar | ✅ En 1024×600 y 1024×500 el menú hace scroll y el bloque de usuario/cerrar sesión sigue visible; probado en los cuatro roles |
| Módulos del estudiante | ✅ Dashboard, asistencia y horario probados de 320×568 a 1366×768; drawer móvil, header compacto, tablas con scroll interno y horario con columna fija |
| Padrón y matrícula | ✅ 21 alumnos, alta/edición/retiro disponibles; E2E cubre alta, pago y retiro |
| Tesorería y caja | ✅ Cobro, boleta, movimientos y cierre; efectivo/digital separados (H50) |
| Notas, actas y libretas | ✅ E2E 9–19; UI de reportes lista 4 alumnos de 3ro y PDF de libreta |
| Asistencia y horarios | ✅ Estudiante ve su asistencia; horario vacío porque no hay bloques publicados |
| Rollover | ✅ Preview 2026→2027 con hash y bloqueo real por sobrecapacidad (142 h en ADMIN) |
| Promoción | ✅ Flujo completo en E2E (preview, confirmación, egresados, repitentes, anulación); en local falta oferta 2027 para previsualizar |
| Histórico | ✅ Búsqueda por DNI, una fila por año, enlaces a libreta/asistencia/tesorería |
| SIAGIE interno | ✅ Excel descargado desde la UI, abierto con ExcelJS: 11 cursos, 4 alumnos, nota y conclusión; auditoría `EXPORTAR` |
| Sin 503 / botones muertos | ✅ Las pantallas probadas cargan datos o un estado vacío honesto; no hay éxito falso |
| Consola | ✅ Sin errores de JavaScript en las pantallas probadas |

### Limitaciones conocidas del demo

1. **SIAGIE no es oficial**: no hay integración con MINEDU; el Excel es interno.
2. **Correo en modo prueba**: solo llega a la cuenta dueña de Resend; la campanita sí.
3. **Datos ficticios**: no cargar alumnos, apoderados ni personal reales.
4. **Supabase demo**: 1 alumno, 0 actas, 0 promociones; sirve para previews y consultas,
   no para confirmar promociones ni para el flujo completo.
5. **Local**: las 142 h de carga están en el ADMIN; para la demo docente hay que reasignar
   cargas a docentes. El horario local está en 0 bloques hasta generarlo/publicarlo.
6. **Sin notas finales** el Excel y las libretas salen vacíos; no se inventan notas.
7. **Sin CI/Docker**: las suites son manuales y la base de demo no tiene backups pagos.

---

*Última actualización: 22/11/2026 — cierre de demo: SIAGIE interno, H70/H71, UAT y plan de reinicio.*
