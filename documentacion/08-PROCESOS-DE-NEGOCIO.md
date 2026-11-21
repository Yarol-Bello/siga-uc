# 08 — Procesos de Negocio (inicio a fin)

Cada proceso indica: disparador, actores, precondiciones, pasos, cálculos, efectos en BD,
salidas y excepciones. Es la referencia para mantenimiento y para explicar el sistema a
terceros.

---

## P01 — Autenticación y sesión

| Campo | Detalle |
|---|---|
| Disparador | Usuario abre el sistema e ingresa credenciales |
| Actores | Cualquier usuario registrado |
| Precondiciones | Usuario existente y `estado = ACTIVO`; contraseña correcta |
| Endpoint | `POST /api/auth/login` |
| Capas | `authController` → `authService` → `usuarioDao` |

**Pasos**

1. El frontend valida DNI (8 numéricos) y contraseña (≥6).
2. `usuarioDao.findByDni` obtiene usuario + rol (`INNER JOIN roles`).
3. Si no existe → 401 “Credenciales inválidas”.
4. Si `estado != ACTIVO` → 403 con el estado.
5. `bcrypt.compare(password, password_hash)`.
6. Obtiene información adicional:
   - ESTUDIANTE → `alumnos` por `id_usuario` (id_alumno, código, grado, estado).
   - DOCENTE/SECRETARIA → `personal` por `id_usuario` (id_personal, especialidad, cargo).
   - ADMIN → `null`.
7. Actualiza `ultimo_login = NOW()`.
8. Firma JWT con `id_usuario`, `dni`, `nombre_completo`, `correo`, `id_rol`, `rol`.
9. Devuelve usuario saneado + token + `expires_in`.
10. Frontend persiste y redirige según rol.

**Excepciones**

- Usuario cesado/inactivo: no puede entrar.
- Token expirado: 401 “Token expirado”; el guard local también lo detecta.
- Sin conexión a BD: 500.

**Mejoras recomendadas**

- Registrar LOGIN/LOGOUT en bitácora.
- Rate limiting y bloqueo por intentos.

---

## P02 — Recuperación de contraseña

| Campo | Detalle |
|---|---|
| Disparador | “¿Olvidaste tu contraseña?” en login |
| Actores | Usuario con correo registrado |
| Endpoints | `POST /recuperar-password`, `GET /validar-token/:token`, `POST /restablecer-password` |

**Solicitud**

1. Usuario ingresa DNI, correo institucional o correo personal.
2. `usuarioDao.findByDniOCorreo` busca por los tres campos.
3. Si no existe o no está ACTIVO → respuesta genérica `{ enviado: true, tieneCorreo: true }`.
4. Si existe pero no tiene correo → `{ tieneCorreo: false }` y mensaje “contacte al
   Administrador”.
5. Genera token `crypto.randomBytes(32).toString('hex')` (64 caracteres).
6. `recuperacionDao.crearToken`:
   - Marca como usados todos los tokens anteriores no usados del usuario.
   - Inserta token con `fecha_expiracion = NOW() + INTERVAL '2 hours'`.
7. Construye enlace `FRONTEND_URL/reset-password?token=...`.
8. Envía correo HTML con Resend (plantilla guindo/dorado).
9. Responde siempre de forma genérica.

**Validación**

1. `GET /validar-token/:token` busca token no usado y no expirado.
2. Devuelve nombres, apellidos y correo institucional.

**Restablecimiento**

1. Usuario ingresa nueva contraseña (≥6) y confirmación.
2. `POST /restablecer-password`.
3. Backend revalida token.
4. Actualiza `password_hash = crypt(nueva, gen_salt('bf',10))`,
   `requiere_cambio_password = FALSE`.
5. Marca token como usado.
6. Frontend muestra éxito y redirige al login en 3 s.

**Excepciones**

- Token inválido/expirado/usado → 400.
- Correo no configurado → el servicio de correo falla; la solicitud puede quedar en BD pero
  no llega el enlace.
- El mensaje `tieneCorreo:false` solo aparece para un usuario existente sin correo; puede
  filtrar existencia en ese caso límite.

---

## P03 — Matrícula de alumno

| Campo | Detalle |
|---|---|
| Disparador | Admin/Secretaría registra un alumno nuevo |
| Actores | ADMIN o SECRETARIA |
| Endpoint | `POST /api/alumnos` |
| Transacción | Sí, `alumnoDao.crear` |

**Precondiciones**

- DNI de 8 dígitos, no registrado en `alumnos` ni `usuarios`.
- Nombres, apellidos, fecha de nacimiento y grado.
- Apoderado con correo (regla de UI; backend lo acepta opcional).

**Pasos**

1. `alumnoService.crear` valida campos obligatorios.
2. `alumnoDao.findByDni` verifica duplicado → 409.
3. `BEGIN`.
4. Si hay apoderado con nombres: inserta en `apoderados`.
5. Genera correo institucional:
   `nombres.apellidos@unioncientifica.edu.pe`, sin espacios.
6. Correo personal: `data.correo_personal || apoderado.correo || null`.
7. Inserta `usuarios`:
   - rol ESTUDIANTE (subconsulta por nombre),
   - contraseña `UC<DNI>` con bcrypt,
   - `requiere_cambio_password = TRUE`,
   - estado ACTIVO.
8. Genera código `EST-XXX`:
   - `MAX(CAST(SUBSTRING(codigo_estudiante FROM 5) AS INTEGER)) + 1`,
   - rellena a 3 dígitos.
9. Inserta `alumnos` con `estado_matricula = 'PendientePago'`.
10. Inserta `expediente_alumno` (`nivel_logro_actual = NULL`, `asistencia_acumulada = 0`).
11. Inserta `credenciales_qr`:
    `QR-<DNI>-<MD5(DNI || 'SIGAUC')>`, tipo ESTUDIANTE.
12. `COMMIT`.
13. Devuelve ids, código, contraseña temporal, correos.

**Estados**

```text
Nuevo → PendientePago ──(pago MATRICULA)──> Matriculado
                                 │
                                 └──(retiro)──> Retirado
```

**Reglas**

- El alumno **no aparece** en listas de asistencia/notas hasta estar `Matriculado`.
- La contraseña temporal es `UC<DNI>`.
- El correo institucional es único; una colisión de nombres falla la transacción.

**Excepciones**

- DNI duplicado → 409.
- Correo institucional duplicado → error de BD (no hay mensaje amigable).
- Concurrencia en `getSiguienteCodigo` puede producir colisión de código.

---

## P04 — Edición y retiro de alumno

| Campo | Detalle |
|---|---|
| Endpoints | `PUT /api/alumnos/:id`, `PUT /api/alumnos/:id/retirar` |
| Actores | ADMIN/SECRETARIA |

**Edición**

- Actualiza nombres, apellidos, fecha de nacimiento, grado, condición y colegio de
  procedencia con `COALESCE`.
- Si se envían nombres/apellidos, sincroniza `usuarios.nombres` y `usuarios.apellidos` en la
  misma transacción (con `COALESCE`, sin borrar el campo que no se envíe).
- Actualiza `usuarios.correo_personal` cuando se envía.
- No valida transiciones de grado ni año.

**Retiro**

1. Valida que el alumno exista y no esté ya `Retirado`.
2. Exige `motivo_retiro` (validator).
3. En una sola transacción actualiza:
   - `alumnos`: `estado_matricula = 'Retirado'`, `fecha_retiro` (o hoy), `motivo_retiro`,
     `colegio_destino`, `resolucion_directoral`
   - `usuarios.estado = 'INACTIVO'` (login y JWT en curso quedan bloqueados)
   - `expediente_alumno.congelado = TRUE`
4. Devuelve el alumno. Si falla cualquier update, `ROLLBACK` total.

**Efectos colaterales no implementados**

- No anula pensiones/pre-tickets pendientes.
- No retira de carga/asistencia histórica (se conserva).

---

## P05 — Ciclo de vida del personal

| Campo | Detalle |
|---|---|
| Endpoints | `POST /personal`, `PUT /personal/:id`, `PUT /personal/:id/cesar`, `PUT /personal/:id/reactivar`, `PUT /personal/:id/reset-password` |
| Actores | ADMIN |

**Alta**

1. Valida DNI (8), nombres, apellidos, rol.
2. `BEGIN`.
3. Genera correo institucional si no se envía.
4. Inserta usuario con contraseña `data.password || 'UC2026*'`, estado ACTIVO.
5. Inserta `personal` con especialidad, cargo y fecha de ingreso.
6. Genera QR:
   - `id_rol = 1` → ADMIN
   - `id_rol = 3` → SECRETARIA
   - resto → DOCENTE
7. `COMMIT`.

**Edición**

- Actualiza usuario (nombres, correos, teléfono, rol) y personal (especialidad, cargo).
- No regenera QR si cambia el rol.

**Cese**

1. Valida que exista y no esté ya CESADO.
2. Exige motivo.
3. Actualiza `personal.fecha_cese`, `motivo_cese`.
4. `usuarios.estado = 'CESADO'`.
5. El login queda bloqueado.

**Reactivación**

1. `usuarios.estado = 'ACTIVO'`.
2. Limpia `fecha_cese` y `motivo_cese`.

**Reset**

- `password_hash = crypt('UC<DNI>', gen_salt('bf',10))`.
- `requiere_cambio_password = TRUE`.

**Riesgos**

- El token previo del cesado sigue válido hasta expirar.
- Cambiar rol no ajusta permisos históricos ni QR.
- No se puede eliminar personal; solo cesar.

---

## P06 — Configuración académica

### P06.1 Grados, cursos y competencias

- Los grados, cursos y competencias se cargan por seed/BD; **no hay CRUD** en la UI.
- Estructura: grado (nombre, nivel, sección, año), curso (nombre único, área, horas),
  competencia (curso, nombre, orden).
- Cada curso tiene 2–4 competencias.

### P06.2 Carga curricular

| Campo | Detalle |
|---|---|
| Endpoint | `POST /api/carga-curricular` |
| Actores | ADMIN |
| Precondición | Grado, curso y personal existen; no duplicar grado+curso+año |

1. UI selecciona grado, curso, docente y horas.
2. Backend valida campos.
3. Inserta en `carga_curricular`.
4. UNIQUE (`id_grado`, `id_curso`, `anio_lectivo`) impide duplicados.
5. Edición solo cambia docente/horas.
6. Eliminación borra la asignación.

**Impacto:** el docente ve sus cursos en dashboard, notas, asistencia y reportes. Si no hay
carga, no puede operar.

### P06.3 Tutor de grado

1. Admin elige grado y docente.
2. `asignarTutor` abre transacción.
3. Elimina tutor anterior del grado/año.
4. Inserta nuevo tutor.
5. `tutores_grado` tiene UNIQUE (grado, año).

**Impacto:** aparece en libreta, cuadro de mérito y reportes de riesgo.

### P06.4 Horarios

- Solo lectura por grado (`GET /api/horarios/grado/:id_grado`).
- Bloques con día, hora inicio/fin y tipo (`CLASE`, `RECREO`, `ALMUERZO`).
- El estudiante ve su horario; no hay pantalla de edición.

---

## P07 — Asistencia de alumnos

| Campo | Detalle |
|---|---|
| Disparador | Docente pasa lista |
| Actores | DOCENTE/ADMIN |
| Endpoints | `GET /asistencias/curso/:id/fecha/:fecha`, `POST /asistencias`, `POST /asistencias/masivo` |

**Listado**

1. Docente selecciona curso y fecha.
2. Query:
   - alumnos del grado con `estado_matricula = 'Matriculado'`,
   - `LEFT JOIN asistencia_alumnos` por alumno/curso/fecha.
3. Devuelve estado (`P/T/F` o `null`), observación y justificación.

**Registro**

1. Docente marca P/T/F por alumno.
2. Frontend envía solo los cambios.
3. Backend valida `estado ∈ {P,T,F}`.
4. Upsert:
   ```sql
   INSERT ... ON CONFLICT (id_alumno, id_curso, fecha)
   DO UPDATE SET estado, observacion, justificada, motivo_justificacion
   ```
5. Transacción por lote; errores por fila se acumulan en `errores[]` y no revierten el resto.

**Cálculos**

- Porcentaje de asistencia = presentes / total registros × 100.
- “T” y “F” no cuentan como presentes.
- `justificada` no altera el porcentaje; es informativa.

**Reglas**

- Un alumno solo puede tener un registro por curso y fecha.
- Alumno debe estar `Matriculado` para aparecer.
- No se valida que el docente tenga asignado el curso (la API acepta cualquier `id_curso`).

**Riesgos**

- El guardado masivo reporta éxito parcial; la UI no muestra `errores`.
- Fechas futuras o feriados no se validan.
- No hay bloqueo por acta cerrada.

---

## P08 — Asistencia de personal por QR

| Campo | Detalle |
|---|---|
| Actores | ADMIN/SECRETARIA |
| Endpoints | `GET /asistencias/personal/todos`, `GET /asistencias/personal/dni/:dni`, `POST /asistencias/personal/marcar` |

**Flujo**

1. Se selecciona fecha (hoy por defecto).
2. Lista personal activo con su marcación del día.
3. “Escaneo” = ingreso manual del DNI (no hay lector de cámara).
4. Backend busca personal por DNI y valida `estado = ACTIVO`.
5. Se elige estado (`Puntual`, `Tardanza`, `Falta`).
6. Se envía hora actual y observación.
7. Upsert por (`id_personal`, `fecha`).
8. Se recargan lista y resumen.

**Resumen**

- Total de personal activo.
- Conteo Puntual/Tardanza/Falta del día.
- No calcula porcentaje ni historial mensual.

**Reglas**

- Una marcación por persona y día.
- El QR real no se valida contra `credenciales_qr`; se usa el DNI como identificador.
- No hay endpoint para marcar salida (`hora_salida` no se usa en la UI).

---

## P09 — Registro de calificaciones por competencia

| Campo | Detalle |
|---|---|
| Disparador | Docente registra notas |
| Actores | DOCENTE/ADMIN |
| Endpoints | `GET /calificaciones/curso/:id_curso/grado/:id_grado`, `POST /calificaciones/masivo` |

**Matriz**

1. Se obtienen competencias del curso ordenadas.
2. Se obtienen alumnos `Matriculado` del grado.
3. Se obtienen calificaciones del curso/bimestre/año.
4. Se arma `alumnos[].calificaciones[]` con `null` si no hay nota.

**Registro**

1. UI cachea cambios.
2. Envía `registros[]`.
3. Backend valida que exista al menos un registro.
4. Upsert por (`id_alumno`, `id_curso`, `id_competencia`, `bimestre`, `anio_lectivo`).
5. Trigger `trg_calificaciones_audit` inserta en bitácora con valor anterior/nuevo.

**Reglas**

- Valores permitidos: `AD`, `A`, `B`, `C`.
- Bimestre 1–4.
- No se valida que el docente dicte el curso.
- No se valida que el alumno pertenezca al grado (se confía en el payload).
- El guardado masivo es parcial: errores por fila no revierten el lote.

**Auditoría**

- Cada INSERT/UPDATE genera un registro en `bitacora_auditoria`.
- Usuario auditado: `modificado_por` (puede ser NULL si el frontend no lo envía).
- El frontend **no envía** `modificado_por`, por lo que el registro queda con usuario NULL
  en la mayoría de casos.

---

## P10 — Nota final de área por predominancia

| Campo | Detalle |
|---|---|
| Endpoint | `POST /api/calificaciones/notas-finales` |
| Servicio | `calificacionService.calcularYGuardarNotaFinal` |
| DAO | `calificacionDao.calcularNotaFinal` + `guardarNotaFinal` |

**Algoritmo del DAO (el que usa la app)**

```text
contar AD, A, B, C del alumno/curso/bimestre/año
si AD >= 2 → AD
si A  >= 2 → A
si B  >= 2 → B
si C  >= 2 → C
si AD >= 1 → AD
si A  >= 1 → A
si B  >= 1 → B
si no      → C
```

**Algoritmo de la función SQL `calcular_nota_final_area`**

```text
si AD >= 2 → AD
si A  >= 2 → A
si B  >= 2 → B
si no      → C
```

> Divergencia: el DAO premia la mejor nota individual cuando no hay dos iguales; la función
> SQL no. Documentar y unificar antes de usar la función.

**Persistencia**

- `notas_finales_area` con UNIQUE (alumno, curso, bimestre, año).
- `calculo_automatico = true`.
- Se puede recalcular y sobrescribir.

**Estado actual de la UI**

- No hay botón que invoque este endpoint.
- Los reportes de mérito/libreta y SIAGIE leen `notas_finales_area`.
- Por tanto, si nadie llama al endpoint, esas salidas aparecen sin notas.

---

## P11 — Reportes académicos

### P11.1 Libreta

- Entrada: alumno, bimestre, año.
- Consulta alumno + grado + apoderado.
- Consulta notas finales por curso y conclusión descriptiva.
- Consulta resumen de asistencia.
- Consulta tutor del grado.
- Devuelve todo para imprimir en el navegador.
- No persiste en `libretas`.

### P11.2 Cuadro de mérito

- Filtra alumnos `Matriculado` del grado.
- Toma `notas_finales_area` del bimestre/año.
- Pondera: AD=4, A=3, B=2, C=1.
- Promedio = suma / cantidad de cursos con nota.
- Ordena por promedio DESC y cantidad de AD DESC.
- Devuelve top 10 con puesto.
- No persiste en `cuadro_merito`.

### P11.3 Alumnos en riesgo

- Filtra alumnos `Matriculado` del grado.
- Cuenta cursos distintos con al menos una calificación `C` en el bimestre.
- HAVING ≥ 2 cursos con C.
- Devuelve cursos y tutor.
- No persiste en `alumnos_riesgo`.

### P11.4 Resumen de asistencia

- Agrupa por alumno del grado.
- Cuenta P/T/F y porcentaje.
- Ordena por porcentaje ascendente.
- **Ignora el parámetro `anio`** en la consulta (bug).

### P11.5 Auditoría de docentes

- Cruza `carga_curricular` con cursos, grados, personal y usuarios.
- Cuenta alumnos matriculados.
- Cuenta alumnos con nota final distinta de NULL.
- Calcula porcentaje.
- No usa `estado_carga_docentes`.

---

## P12 — Exportación SIAGIE

| Campo | Detalle |
|---|---|
| Disparador | Admin sube plantilla MINEDU |
| Actores | ADMIN |
| Endpoint | `POST /api/siagie/generar-excel` |
| Archivo | `multipart/form-data`, campo `plantilla` |

**Precondiciones**

- Grado existente.
- Al menos una nota final registrada para grado/bimestre/año.
- Plantilla `.xlsx` o `.xls` ≤10 MB.

**Pasos**

1. Multer guarda temporal en `uploads/temp/plantilla-<timestamp>-<nombre>`.
2. Controller valida archivo y parámetros.
3. Service valida grado.
4. Consulta notas:
   - `alumnos` × `cursos` con `LEFT JOIN notas_finales_area`.
   - Solo alumnos `Matriculado` del año.
5. Abre workbook con ExcelJS (primera hoja).
6. Detecta fila de encabezado:
   - busca celda que contenga “DNI” o “DOCUMENTO”;
   - guarda número de fila y columna.
7. Detecta columnas de cursos por prefijos:
   - `ARITM`, `ALGEBRA`, `COMUNIC`, `FISICA`.
8. Si no detecta encabezado, usa fila 5 y columna 3.
9. Agrupa notas por DNI.
10. Recorre filas desde el encabezado:
    - lee DNI;
    - si coincide, escribe cada curso detectado.
    - Coincidencia de curso por primeros 5 caracteres.
11. Guarda `uploads/siagie/SIAGIE_<grado>_BIM<n>_<año>.xlsx`.
12. Registra en `exportaciones_siagie` (`GENERADO`).
13. Controller borra el temporal y descarga el archivo.

**Limitaciones**

- Solo primera hoja.
- Solo 4 prefijos de curso.
- No procesa fórmulas ni celdas combinadas.
- Si el DNI viene con espacios/formato, puede no coincidir.
- Si no hay notas finales, responde 404.
- El nombre de curso se compara por primeros 5 caracteres; nombres similares pueden
  confundirse.

---

## P13 — Tesorería: conceptos, pre-tickets, pensiones y becas

### P13.1 Conceptos

- `GET /api/tesoreria/conceptos?anio=`.
- Tipos: `MATRICULA`, `PENSION`, `OTROS`.
- Cada pensión tiene mes (1–12).
- Seed: matrícula + pensiones marzo–diciembre.

### P13.2 Pre-ticket

1. Admin/Secretaría envía `{ id_alumno, id_concepto, monto }`.
2. Backend valida campos.
3. Inserta `pre_tickets` estado `PENDIENTE`, con usuario emisor.
4. Se cobra luego desde el pago.

### P13.3 Generación mensual de pensiones

1. `POST /api/tesoreria/pensiones/generar` con `{ anio, mes, monto_base }`.
2. Valida mes 1–12.
3. `INSERT ... SELECT` de alumnos `Matriculado` del año.
4. Aplica descuento de beca activa (`monto_descuento`).
5. `monto_final = monto_base - descuento`.
6. `ON CONFLICT (id_alumno, anio, mes) DO NOTHING`.
7. Devuelve total generados.

**Reglas**

- No se genera para alumnos `PendientePago` ni `Retirado`.
- No se actualiza si ya existe.
- La beca se busca por alumno y `activo = TRUE` (la primera).
- No hay UI para ejecutar esta generación.

### P13.4 Becas

1. `POST /api/tesoreria/becas` (solo ADMIN).
2. Valida alumno, tipo, porcentaje y fecha inicio.
3. Inserta beca activa.
4. Se aplica en la próxima generación de pensiones.
5. No recalcula pensiones ya generadas.

---

## P14 — Registro de pago y boleta

| Campo | Detalle |
|---|---|
| Endpoints | `POST /api/tesoreria/pagos`, `GET /api/tesoreria/pagos` |
| Actores | ADMIN/SECRETARIA |
| Transacción | `tesoreriaDao.registrarPago` |

**Validaciones**

- `id_alumno`, `id_concepto`, `monto`, `forma_pago`.
- Alumno existe.
- Concepto existe → se obtiene `tipo`.

**Pasos**

1. `BEGIN`.
2. Inserta `pagos` con estado `PAGADO` y cobrador del token.
3. Calcula siguiente número de boleta:
   `COALESCE(MAX(numero), 4820) + 1`.
4. Genera `numero_boleta = 'B001-' + numero a 6 dígitos`.
5. Inserta `boletas_electronicas`:
   - serie `B001`, número, monto,
   - estado SUNAT `ACEPTADO`,
   - `hash_cpe = MD5(numero_boleta || NOW())`.
6. Si hay `id_preticket`: `pre_tickets.estado = 'PAGADO'`, `fecha_pago = NOW()`.
7. Si hay `id_pension`: `pensiones.estado = 'PAGADO'`.
8. Si `tipo_concepto = 'MATRICULA'`: `alumnos.estado_matricula = 'Matriculado'`.
9. `COMMIT`.
10. Trigger `trg_pago_a_caja` inserta movimiento `INGRESO` en la última apertura.
11. Triggers de pre-ticket/pensión repiten los pasos 6–7.

**Salida:** `{ pago, boleta }`.

**Riesgos**

- Concurrencia en numeración de boleta (MAX+1 sin lock) puede duplicar.
- Se permite pagar un pre-ticket/pensión de otro alumno si se envían IDs inconsistentes.
- No se valida monto contra `monto_final` de la pensión ni contra `monto_base` del concepto.
- No se valida que la caja esté abierta.
- No se puede anular un pago desde la UI (solo existe el estado `ANULADO`).
- La boleta es simulada; no se integra con SUNAT.

---

## P15 — Caja: apertura, egresos y cierre

### P15.1 Apertura

1. Valida `monto_inicial >= 0` y usuario.
2. `BEGIN`.
3. Verifica que no exista apertura sin cierre.
4. Usa `id_caja` enviada o la primera caja; si no hay, crea “Caja Principal”.
5. Inserta `aperturas_caja`.
6. Inserta movimiento `APERTURA` por el monto inicial.
7. `cajas.estado = 'ABIERTA'`.
8. `COMMIT`.

### P15.2 Ingresos

- No se registran manualmente desde caja.
- Los crea el trigger `trg_pago_a_caja` al insertar un pago.
- Medio de pago = forma de pago del pago.

### P15.3 Egresos

1. Exige concepto y monto > 0.
2. Verifica que haya caja abierta.
3. Inserta movimiento `EGRESO` con comprobante.

### P15.4 Cierre

1. Exige `efectivo_fisico >= 0` y usuario.
2. `BEGIN`.
3. Obtiene caja abierta.
4. Suma:
   - ingresos en efectivo,
   - ingresos digitales,
   - egresos.
5. Calcula:
   ```text
   efectivo_esperado = monto_inicial + ingresos_efectivo - egresos
   diferencia        = efectivo_fisico - efectivo_esperado
   total_general     = efectivo_fisico + ingresos_digital
   ```
6. Estado:
   - `CUADRADO` si |diferencia| ≤ 0.01
   - `SOBRANTE` si diferencia > 0.01
   - `FALTANTE` si diferencia < -0.01
7. Inserta `cierres_caja`.
8. `cajas.estado = 'CERRADA'`.
9. `COMMIT`.

**Riesgos**

- Solo se permite una caja abierta en todo el sistema.
- El trigger de pagos usa la última apertura aunque esté cerrada.
- No se puede reabrir un cierre.
- No hay arqueo por denominaciones.

---

## P16 — Notificaciones internas y correo

### P16.1 Envío individual

1. `POST /api/notificaciones` (ADMIN/DOCENTE).
2. Valida destino, asunto y cuerpo.
3. Inserta en `notificaciones` (`leido = false`).
4. Busca destinatario y remitente.
5. Elige `correo_personal || correo_institucional`.
6. Envía correo con plantilla institucional.
7. Si el correo falla, registra warning y devuelve la notificación igual.

### P16.2 Envío masivo

1. `POST /api/notificaciones/masivo` (ADMIN).
2. Recibe `destinos[]`.
3. Itera y crea una notificación por destino.
4. **No envía correos** (usa el DAO directamente).

### P16.3 Lectura

- `GET /notificaciones` solo devuelve las del usuario autenticado.
- `GET /no-leidas` cuenta.
- `PUT /:id/leer` y `PUT /leer-todas` actualizan.
- `DELETE /:id` elimina solo si es del usuario.

### P16.4 Campanita

- Header consulta cada 30 s.
- Abre modal tipo Gmail con lista y detalle.
- Marca leída al abrir detalle.

---

## P17 — Auditoría y cierre de actas

### P17.1 Bitácora

- Solo lectura.
- Filtros: módulo, acción, usuario, fechas, texto.
- Límite 200 registros.
- Detalle con JSONB anterior/nuevo.

**Fuentes de datos**

- Trigger de calificaciones.
- Registros semilla.
- No hay auditoría automática de login, matrícula, pagos, caja, personal ni notificaciones.

### P17.2 Cierre de acta

1. Admin selecciona acta `ABIERTO`.
2. Confirma.
3. `POST /api/auditoria/actas/cerrar` con periodo, año y grado.
4. `UPDATE actas_bimestrales`:
   - `estado = 'CERRADO'`
   - `fecha_cierre = NOW()`
   - `cerrado_por = usuario`
   - `hash_integridad = MD5(periodo || año || NOW() || grado)`
5. Devuelve acta.

**Limitaciones**

- No bloquea modificaciones de notas.
- El hash es MD5 y depende de la fecha; no es una firma digital.
- No hay validación de que todas las notas estén completas.
- No hay acta por grado si `id_grado` es NULL (seed tiene actas globales).

---

## P18 — Credencial QR

1. Al crear usuario (alumno o personal), se inserta `credenciales_qr`.
2. Código: `QR-<DNI>-<MD5(DNI || 'SIGAUC')>`.
3. `GET /api/auth/perfil` devuelve la credencial.
4. Header genera la imagen QR con la librería `qrcode` y permite imprimir.
5. Para asistencia de personal, la UI usa el DNI, no el código QR.
6. No hay endpoint público de validación de QR.

**Observación:** el código QR es determinístico y no expira; si se comparte, no hay
revocación ni rotación. `credenciales_qr.activo` no se usa en la marcación.

---

## Resumen de procesos y criticidad

| Proceso | Criticidad | Estado | Observación |
|---|---|---|---|
| P01 Login | Alta | Completo | Sin rate limiting ni auditoría |
| P02 Recuperación | Alta | Completo | Depende de Resend |
| P03 Matrícula | Alta | Completo | Transaccional |
| P04 Retiro | Media | Completo | Transaccional: usuario INACTIVO + expediente congelado |
| P05 Personal | Alta | Completo | Sin borrado |
| P06 Configuración | Alta | Parcial | Sin CRUD de horarios/competencias |
| P07 Asistencia alumnos | Alta | Completo | Éxito parcial en lote |
| P08 Asistencia personal | Media | Completo | QR simulado por DNI |
| P09 Calificaciones | Alta | Completo | Sin validación de docente-curso |
| P10 Nota final | Alta | Endpoint listo | Sin UI que lo dispare |
| P11 Reportes | Alta | Completo | Resumen ignora año |
| P12 SIAGIE | Alta | Completo con limitaciones | Solo 4 cursos |
| P13 Tesorería base | Alta | Parcial | Sin UI de pre-tickets/becas/generación |
| P14 Pago/boleta | Alta | Completo | Boleta simulada |
| P15 Caja | Alta | Completo | Una sola caja global |
| P16 Notificaciones | Media | Completo | Masivo sin correo |
| P17 Auditoría | Alta | Parcial | Solo calificaciones |
| P18 QR | Media | Completo | Sin validación real |
