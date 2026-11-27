# 22 — Módulos y flujo de prueba de SIGA-UC

> Guía para estudiar, demostrar y sustentar el sistema en clase.
> Corte de referencia: 27/11/2026. La demo usa datos ficticios.
> Documento de apoyo: no reemplaza el código ni el informe técnico.

---

## 1. ¿Cómo se llama correctamente?

| Término | ¿Es correcto? | Uso recomendado |
|---|---|---|
| **Página web** | No para todo el sistema | Es una sola vista o documento. El login es una página; SIGA-UC es más que eso. |
| **Sitio web** | Parcial | Es un conjunto de páginas. No describe la lógica, los roles ni la base de datos. |
| **Aplicación web** | **Sí, técnicamente correcto** | Software que se ejecuta en el navegador, con lógica en un servidor y datos persistidos. |
| **Sistema web** | **Sí, correcto y claro** | Término general válido para exponer ante un jurado o en clase. |
| **Sistema de información web** | **El más preciso para clase** | Integra personas, procesos, datos, reglas y software. Es el término académico recomendado. |
| **Plataforma web** | Aceptable | Término comercial o ejecutivo; puede usarse como sinónimo. |
| **ERP escolar** | Solo con cuidado | Un ERP integra todos los recursos institucionales. SIGA-UC es un sistema de gestión académica y financiera; no conviene llamarlo ERP sin sustento. |

### Frase recomendada para clase

> “SIGA-UC es un **sistema de información web** y, técnicamente, una **aplicación web full-stack**: el usuario trabaja desde el navegador, la lógica se ejecuta en un servidor y los datos se guardan en PostgreSQL. No es una página web: una página es solo una vista; el sistema tiene módulos, roles, API, base de datos y auditoría.”

### Arquitectura en una frase

> “Angular construye la interfaz; Express expone la API REST; PostgreSQL guarda los datos; JWT y roles controlan el acceso; Render y Supabase alojan la demo.”

```
Navegador
  └── Angular 21 (interfaz, guards, signals)
        └── HTTP/JSON + JWT
              └── API REST Express 5 (Node 20)
                    └── PostgreSQL 18 (Supabase)
                          └── Render (frontend y API)
```

### Glosario mínimo para clase

| Término | Explicación corta |
|---|---|
| SPA | Aplicación de una sola página: Angular carga una vez y navega sin recargar el navegador. |
| API REST | Interfaz de servicios que intercambia datos en JSON entre el frontend y el backend. |
| JWT | Token firmado que representa la sesión del usuario. |
| RBAC | Control de acceso basado en roles. |
| DAO | Capa que contiene las consultas y operaciones de base de datos. |
| Transacción | Conjunto de operaciones que se confirman o se revierten juntas. |
| CRUD | Crear, leer, actualizar y eliminar registros. |

---

## 2. Mapa general de módulos

| Módulo | Para qué sirve | Usuarios principales | Ruta principal |
|---|---|---|---|
| Autenticación | Iniciar sesión, recuperar contraseña y cambiar clave | Todos | `/login`, `/reset-password`, `/cambiar-password` |
| Primera configuración | Crear admin, institución, año, grados y caja inicial | ADMIN inicial | `/setup` |
| Dashboard | Resumen de indicadores según el rol | Todos | `/admin`, `/secretaria`, `/docente`, `/estudiante` |
| Alumnos y padrón | Matrícula anual, ficha, retiro e histórico | ADMIN, SECRETARIA | `/admin/alumnos`, `/secretaria/padron`, `/admin/historico` |
| Personal | Usuarios internos, roles, QR, cese y reactivación | ADMIN | `/admin/personal` |
| Carga curricular | Áreas, cursos, competencias, docentes y tutores | ADMIN | `/admin/carga-curricular` |
| Horarios | Períodos, jornada, generación, conflictos y publicación | ADMIN, consulta SECRETARIA/DOCENTE/ESTUDIANTE | `/admin/horarios`, `/secretaria/horarios`, `/docente/horario`, `/estudiante/horario` |
| Años lectivos | Año activo, rollover y cierre de años | ADMIN; lectura SECRETARIA | `/admin/anios-lectivos` |
| Promociones | Evaluar y confirmar promoción, repitencia o egreso | ADMIN | `/admin/promociones` |
| Asistencia | Registrar P/T/F por curso y fecha; QR de personal | DOCENTE, ADMIN, SECRETARIA | `/docente/asistencia`, `/admin/asistencia-qr`, `/secretaria/asistencia-qr` |
| Notas | Calificar competencias AD/A/B/C y calcular nota final | DOCENTE, ADMIN | `/docente/notas` |
| Conclusiones | Redactar conclusión descriptiva por alumno y curso | DOCENTE, ADMIN | `/docente/conclusiones` |
| Tesorería | Pensiones, conceptos, becas, pagos y boletas | ADMIN, SECRETARIA | `/admin/tesoreria`, `/secretaria/tesoreria` |
| Caja | Apertura, ingresos, egresos, arqueo y cierre | ADMIN, SECRETARIA | `/admin/caja`, `/secretaria/caja` |
| Reportes | Libreta PDF, mérito, riesgo y consolidado | ADMIN, DOCENTE | `/admin/reportes`, `/docente/reportes` |
| SIAGIE interno | Exportación interna de notas y conclusiones | ADMIN | `/admin/siagie` |
| Configuración | Institución, tarifas, académico, horarios y becas | ADMIN escribe; SECRETARIA lee | `/admin/configuracion` |
| Auditoría | Bitácora de escrituras, accesos y descargas | ADMIN | `/admin/auditoria` |
| Notificaciones | Buzón interno y correo | Todos reciben; ADMIN/SECRETARIA envían | Campana del header |
| Portal del estudiante | Consulta de notas, asistencia y horario propios | ESTUDIANTE | `/estudiante` |

---

## 3. Explicación funcional de cada módulo

### 3.1 Autenticación y seguridad

**Sirve para:** identificar al usuario y aplicar permisos reales.

- Login con DNI y contraseña; JWT de 8 horas; bcrypt para el hash.
- Cambio obligatorio de contraseña cuando el usuario fue creado con clave temporal.
- Recuperación por correo con token de un solo uso y vencimiento.
- La interfaz oculta rutas, pero la API valida el rol y la pertenencia.
- Roles: ADMIN, SECRETARIA, DOCENTE, ESTUDIANTE.

**Qué probar:** login correcto, clave incorrecta, usuario inactivo, ruta sin token, ruta con rol incorrecto, cambio de contraseña.

### 3.2 Primera configuración (`/setup`)

**Sirve para:** instalar el sistema en una base vacía.

- Se activa solo si no existe un ADMIN y `setup_completado=false`.
- Exige un token de instalación.
- En una transacción crea: admin, institución, año activo, grados por nivel, caja principal y auditoría.
- Después del setup, un segundo intento responde `409`.

**Qué probar:** base vacía, token inválido, creación correcta, segundo intento rechazado y login del admin creado.

> En una demo ya configurada no se debe repetir el setup.

### 3.3 Dashboard

**Sirve para:** dar una lectura rápida del estado del colegio según el rol.

- ADMIN: alumnos, personal, docentes, grados, cursos, recaudación, deuda, retirados.
- SECRETARIA: caja, pagos del mes, pendientes y accesos rápidos.
- DOCENTE: cursos asignados, aula, notas y asistencia.
- ESTUDIANTE: notas, asistencia y horario propios.

**Qué probar:** que cada rol vea solo sus indicadores y accesos.

### 3.4 Alumnos, padrón y matrícula

**Sirve para:** administrar la matrícula anual y la ficha del estudiante.

- `alumnos` es **matrícula anual**, no identidad permanente: una fila por DNI y año.
- La matrícula crea o reutiliza usuario, apoderado, expediente, QR y pre-ticket de matrícula.
- El alumno nace en `PendientePago`; pasa a `Matriculado` cuando se paga la matrícula.
- Permite editar datos, retirar con motivo y consultar el histórico por DNI.
- El retiro congela el expediente y anula pensiones/pre-tickets futuros.

**Qué probar:** crear alumno, ver pre-ticket, pagar matrícula, ver cambio de estado, editar, retirar y consultar histórico.

### 3.5 Personal y credenciales

**Sirve para:** gestionar docentes, secretaría y administrativos.

- Crea usuario, ficha de personal, rol y QR.
- Permite cese con motivo/observación, reactivación y reset de contraseña.
- Separa `total_docentes` de `total_personal` en el dashboard.

**Qué probar:** crear docente, iniciar sesión, cesar, reactivar y resetear clave.

### 3.6 Carga curricular

**Sirve para:** definir qué se enseña, en qué grado y con qué docente.

- Áreas académicas, cursos y competencias.
- Asignación de curso + grado + sección + docente.
- Tutor de grado.
- Solo ADMIN escribe; DOCENTE consulta su propia carga.

**Qué probar:** crear curso, asociar competencias, asignar docente y tutor; ver la carga desde el docente.

### 3.7 Horarios

**Sirve para:** organizar la jornada y publicar el horario.

- Períodos de clase, días, jornada y límites.
- Generación de horario, detección de conflictos y publicación.
- Docente y estudiante ven su horario; secretaría consulta.

**Qué probar:** generar, publicar, abrir horario docente y estudiante; intentar un conflicto.

### 3.8 Años lectivos y rollover

**Sirve para:** operar varios años sin mezclar datos.

- Un solo año `ACTIVO`; los demás `PLANIFICADO` o `CERRADO`.
- Rollover clona grados, conceptos, períodos, carga y tutores.
- No crea alumnos, matrículas, pagos, notas, asistencia ni actas.
- Activar un año cierra el anterior; la reversión solo aplica a un rollover vacío.

**Qué probar:** crear año, previsualizar, ejecutar rollover, activar y revertir en base desechable.

> No activar 2027 en la demo de Supabase sin decisión institucional.

### 3.9 Promociones

**Sirve para:** recomendar el pase de año de los estudiantes.

- Política con actas, notas, asistencia, repitencia y `permite_override`.
- Resultados: PROMOVIDO, REPITENTE, EGRESADO, RETIRADO, PENDIENTE.
- El preview es solo lectura y devuelve `preview_hash`.
- El confirm crea matrícula destino, expediente y pre-ticket de matrícula; no activa el año.
- PENDIENTE no se confirma.

**Qué probar:** preview, confirmación, anulación y bloqueo por actividad en base desechable.

### 3.10 Asistencia

**Sirve para:** registrar la presencia del alumno y del personal.

- Docente registra P/T/F por curso, grado y fecha.
- ADMIN/SECRETARIA usan QR para personal.
- Estudiante consulta su propio resumen.
- El año se deriva de la fecha; no se agrega `anio_lectivo` a la tabla.

**Qué probar:** registrar P/T/F, guardar, consultar resumen y marcar QR de personal.

### 3.11 Registro de notas

**Sirve para:** calificar por competencias y obtener la nota final.

- Niveles AD, A, B, C por competencia.
- Guardado masivo por curso/bimestre.
- Al guardar, el sistema recalcula la nota final.
- Un acta cerrada bloquea la edición.
- Búsqueda local por DNI, nombre o código.

**Qué probar:** seleccionar curso correcto, calificar, guardar, ver nota final y bloqueo por acta.

### 3.12 Conclusiones descriptivas

**Sirve para:** redactar la conclusión pedagógica del alumno.

- Nivel de logro, avance, dificultad y sugerencia.
- Texto compuesto máximo 350 caracteres.
- El nivel debe coincidir con la nota final.
- Borrador o publicado; acta cerrada bloquea.
- Búsqueda por DNI, nombre o código.
- **Corrección importante:** el selector usa `id_carga`, no `id_curso`, para distinguir Álgebra de 1ro, 2do, 3ro, etc.

**Qué probar:** seleccionar el grado correcto, ver al alumno nuevo, redactar, guardar borrador, publicar y verificar en la libreta.

### 3.13 Tesorería

**Sirve para:** administrar pensiones, conceptos, becas y pagos.

- Conceptos y tarifas por grado/nivel con vigencia.
- Pre-tickets de matrícula y pensiones.
- Becas y exoneraciones.
- Pago con boleta; anulación con motivo.
- Búsqueda de pagos por DNI, nombre o código y paginación.

**Qué probar:** generar pensión, cobrar, descargar boleta, buscar por DNI y anular.

### 3.14 Caja

**Sirve para:** controlar el efectivo y los medios digitales del día.

- Apertura con fondo inicial.
- Ingresos por pagos, egresos y movimientos.
- Arqueo: efectivo esperado vs. efectivo físico.
- Cierre con reporte imprimible.
- Anulación de pago si la caja está abierta.

**Qué probar:** aperturar, cobrar, registrar egreso, cerrar y revisar diferencia.

### 3.15 Reportes

**Sirve para:** convertir los datos en documentos de gestión.

- Libreta PDF por bimestre.
- Cuadro de mérito: solo alumnos con nota final en todos los cursos de la carga.
- Reportes de mérito y riesgo.
- Consolidado histórico por DNI.
- Actas y reportes de aula.
- El reporte de cierre de caja se imprime aislado.

**Qué probar:** libreta PDF, reporte de aula, consolidado y acta.

> Sin notas finales, la libreta y SIAGIE salen vacíos: no es un fallo, faltan datos.

### 3.16 SIAGIE interno

**Sirve para:** exportar un Excel de apoyo con todos los cursos del grado.

- Incluye notas finales y conclusiones.
- Lleva código de control y hash de integridad **interno**.
- **No es una exportación oficial SIAGIE/MINEDU.**
- Solo ADMIN.

**Qué probar:** exportar, abrir el Excel y verificar el aviso y el código interno.

### 3.17 Configuración

**Sirve para:** adaptar el sistema al colegio sin cambiar código.

- General: institución, logo, moneda, zona horaria, textos.
- Tarifas: conceptos, montos, niveles, grados y vigencia.
- Académico: áreas, cursos, competencias y carga activable.
- Horarios: jornada, días y límites.
- Becas: tipos, alcance, modalidad, tope y aprobación.

ADMIN escribe; SECRETARIA lee tarifas, académico, horarios y becas.

**Qué probar:** cambiar un dato, guardar, recargar y ver el efecto en la UI/PDF.

### 3.18 Auditoría

**Sirve para:** saber quién hizo qué y cuándo.

- Registra escrituras, accesos, descargas y eventos de seguridad.
- No registra lecturas.
- Filtros por módulo, acción, usuario y fecha.
- Actas y reportes de auditoría.

**Qué probar:** crear/editar un registro, descargar un PDF y buscar el evento.

### 3.19 Notificaciones

**Sirve para:** comunicar avisos internos y correos.

- Buzón con no leídas.
- Envío a todos, grado o alumno.
- Correo real vía Resend.
- ADMIN/SECRETARIA envían; DOCENTE recibe 403 si intenta enviar.

**Qué probar:** enviar, recibir, marcar leída y verificar correo si está configurado.

### 3.20 Portales por rol

- **ADMIN:** configura, opera y audita.
- **SECRETARIA:** matricula, cobra, caja, QR y consulta.
- **DOCENTE:** notas, asistencia, conclusiones, ficha y reportes de sus cursos.
- **ESTUDIANTE:** notas, asistencia y horario propios, sin edición.

---

## 4. Matriz rápida de permisos

| Módulo | ADMIN | SECRETARIA | DOCENTE | ESTUDIANTE |
|---|---|---|---|---|
| Configuración | Escribe | Lee | — | — |
| Alumnos/padrón | Escribe | Escribe | Ficha de sus cursos | Solo propio |
| Personal | Escribe | — | — | — |
| Carga curricular | Escribe | Lee | Lee su carga | — |
| Horarios | Escribe | Lee | Lee el suyo | Lee el suyo |
| Años lectivos | Escribe | Lee | — | — |
| Promociones | Escribe | Preview por API | — | — |
| Asistencia | Lee/QR | QR personal | Escribe | Lee la propia |
| Notas | Lee | — | Escribe | Lee las propias |
| Conclusiones | Revisa | — | Escribe | Ve en libreta |
| Tesorería | Escribe | Escribe | — | — |
| Caja | Escribe | Escribe | — | — |
| Reportes | Lee | — | Lee sus aulas | Libreta propia |
| SIAGIE interno | Exporta | — | — | — |
| Auditoría | Lee | — | — | — |
| Notificaciones | Envía/recibe | Envía/recibe | Recibe | Recibe |
| Setup | Primera instalación | — | — | — |

> La UI oculta rutas, pero la API aplica `verificarAutenticacion`, `verificarRol` y ownership. No confundir “no veo el botón” con “no tengo permiso”.

---

## 5. Flujo completo de prueba

> **Recomendación:** hacer la prueba completa en una base local o desechable. En la demo de Render/Supabase, usar datos ficticios y evitar activar 2027, confirmar promociones o borrar información.

### 5.1 Antes de empezar

- [ ] PostgreSQL activo y base cargada.
- [ ] Backend en `http://localhost:3000`.
- [ ] Frontend en `http://localhost:4200`.
- [ ] `GET /api/health` responde 200 con `dbReady: true`.
- [ ] Año activo correcto (2026).
- [ ] Credenciales de ADMIN, SECRETARIA, DOCENTE y ESTUDIANTE.
- [ ] Backup o base desechable.
- [ ] Ningún dato real de menores.

### 5.2 Flujo principal (60–90 minutos)

> Si la base está vacía, empezar por `/setup` (solo primera instalación). Si ya está configurada, iniciar en el paso 2. En local, usar un DNI de prueba que no exista; en la demo de Render, usar el alumno `76543211` para no crear más datos.

| # | Fase | Rol | Acción / ruta | Resultado esperado |
|---:|---|---|---|---|
| 1 | Salud | — | `GET /api/health` | 200, `status: ok`, `dbReady: true` |
| 2 | Login | ADMIN | `/login` | Dashboard ADMIN con KPIs |
| 3 | Configuración | ADMIN | `/admin/configuracion` → General | Institución, moneda y año visibles |
| 4 | Tarifas | ADMIN | `/admin/configuracion/tarifas` | Concepto MATRICULA y pensión por grado |
| 5 | Académico | ADMIN | `/admin/configuracion/academico` | Áreas, cursos y competencias activos |
| 6 | Horarios | ADMIN | `/admin/configuracion/horarios` | Jornada y períodos definidos |
| 7 | Becas | ADMIN | `/admin/configuracion/becas` | Tipo de beca y alcance creados |
| 8 | Personal | ADMIN | `/admin/personal` | Docente creado, activo y con QR |
| 9 | Alumno | ADMIN/SECRETARIA | `/admin/alumnos` → Nueva matrícula | Alumno en `PendientePago`, con pre-ticket |
| 10 | Caja | SECRETARIA | `/secretaria/caja` → Aperturar | Caja abierta con fondo inicial |
| 11 | Matrícula | SECRETARIA | `/secretaria/tesoreria` → Cobrar matrícula | Pago + boleta; alumno pasa a `Matriculado` |
| 12 | Carga | ADMIN | `/admin/carga-curricular` | Curso, grado, sección, docente y tutor |
| 13 | Horario | ADMIN | `/admin/horarios` → Generar/Publicar | Horario sin conflictos; visible al docente |
| 14 | Asistencia | DOCENTE | `/docente/asistencia` | P/T/F guardados para la fecha |
| 15 | Notas | DOCENTE | `/docente/notas` | AD/A/B/C guardados; nota final calculada |
| 16 | Conclusiones | DOCENTE | `/docente/conclusiones` | Alumno correcto, texto guardado/publicado |
| 17 | Ficha | DOCENTE | `/docente/ficha-estudiante` | Notas, asistencia y conclusión visibles |
| 18 | Reportes | DOCENTE/ADMIN | `/docente/reportes`, `/admin/reportes` | Libreta PDF y reporte de aula |
| 19 | SIAGIE | ADMIN | `/admin/siagie` | Excel interno con código de control |
| 20 | Auditoría | ADMIN | `/admin/auditoria` | Eventos de creación, pago, nota y descarga |
| 21 | Estudiante | ESTUDIANTE | `/estudiante` | Solo sus notas, asistencia y horario |
| 22 | Caja | SECRETARIA | `/secretaria/caja` → Cerrar | Arqueo, diferencia y reporte |
| 23 | Seguridad | — | Sin token / rol incorrecto | 401/403 y redirección |
| 24 | Multi-año | ADMIN | `/admin/anios-lectivos` | Solo en base desechable: preview/rollover |
| 25 | Promociones | ADMIN | `/admin/promociones` | Solo en base desechable: preview; no confirmar en demo |

### 5.3 Pruebas negativas que conviene demostrar

| Caso | Resultado esperado |
|---|---|
| DNI duplicado en el mismo año | 409 o validación clara |
| Alumno sin pago de matrícula | `PendientePago`; no se considera matriculado |
| Pago sin caja abierta | 400 con mensaje |
| Pago de pensión ya pagada | 409 |
| Anulación sin motivo o con menos de 10 caracteres | 400 |
| Nota con acta cerrada | Bloqueo |
| Conclusión con nivel distinto a la nota final | 400 |
| Estudiante intentando ver datos de otro | 403 / no encontrado |
| DOCENTE intentando enviar notificación masiva | 403 |
| Ruta ADMIN con rol SECRETARIA | Redirección o 403 |
| Health con BD caída | 200 `degraded`; no 503 |

### 5.4 Evidencia que conviene guardar

- Captura de health.
- Captura de dashboard por rol.
- PDF de libreta.
- PDF de boleta.
- Excel SIAGIE interno.
- Captura de auditoría.
- Captura de la búsqueda de pagos por DNI.
- Captura de conclusiones con el alumno nuevo.

---

## 6. Flujo corto para clase (8–10 minutos)

> Si el aula o la feria tienen poco tiempo, no se recorre todo. Se cuenta una historia de extremo a extremo.

| Minuto | Escena | Qué mostrar | Qué decir |
|---:|---|---|---|
| 0:00–0:40 | Apertura | Login y dashboard ADMIN | “Un sistema web, cuatro roles y una sola fuente de verdad.” |
| 0:40–2:00 | Matrícula | Alumno `76543211`, 3ro, estado y pre-ticket | “La matrícula es anual y nace pendiente de pago.” |
| 2:00–3:15 | Pago | Caja abierta, pago de matrícula, boleta | “El pago emite boleta y cambia el estado a Matriculado.” |
| 3:15–4:15 | Caja | Buscar por DNI, ver pagos y descargar boleta | “Una familia que perdió su boleta la recupera por DNI.” |
| 4:15–6:00 | Docente | Asistencia, notas y conclusiones | “El docente califica por competencia y registra la conclusión.” |
| 6:00–7:00 | Reportes | Libreta PDF y SIAGIE interno | “El mismo dato se convierte en libreta y exportación interna.” |
| 7:00–8:00 | Estudiante | Notas, asistencia y horario | “El estudiante solo consulta sus datos.” |
| 8:00–9:00 | Control | Auditoría y health | “Todo queda auditado y la API está monitoreada.” |

### Versión de 5 minutos

1. Login ADMIN y dashboard.
2. Alumno creado y estado.
3. Pago + boleta + búsqueda por DNI.
4. Notas + conclusiones del alumno.
5. Estudiante y auditoría.

---

## 7. Guion de explicación para clase

### 7.1 Apertura (1 minuto)

> “SIGA-UC es un sistema de información web para la gestión académica y financiera de la I.E.P. Unión Científica. El usuario trabaja desde el navegador; Angular construye la interfaz, Express expone la API, PostgreSQL guarda los datos y JWT controla el acceso. La demo está desplegada en Render y Supabase, con datos ficticios.”

### 7.2 Problema y solución (1 minuto)

> “La institución operaba con registros separados en secretaría, docentes y tesorería. Eso generaba retrabajo, duplicidad y poca trazabilidad. SIGA-UC integra matrícula, evaluación, asistencia, tesorería, caja y reportes en una sola fuente de verdad.”

### 7.3 Módulos (2 minutos)

> “El sistema se organiza por roles. ADMIN configura, opera y audita. SECRETARIA matricula, cobra y controla caja. DOCENTE califica, registra asistencia y redacta conclusiones. ESTUDIANTE consulta sus notas, asistencia y horario. Cada módulo aplica reglas del negocio: matrícula anual, competencias MINEDU, acta cerrada, caja abierta y pagos con boleta.”

### 7.4 Demostración (4–5 minutos)

Seguir el flujo corto de la sección 6.

### 7.5 Cierre (1 minuto)

> “La demo prueba el flujo completo con 75 alumnos ficticios, 750 pensiones y 177 verificaciones automatizadas. La institución conserva la decisión; el siguiente paso es un piloto. La demo no es producción real y no reemplaza la aprobación del colegio.”

---

## 8. Preguntas típicas de clase

**1. ¿Es una página web o un sistema?**
Es un sistema de información web; técnicamente, una aplicación web full-stack. Una página web es solo una vista.

**2. ¿Por qué Angular, Express y PostgreSQL?**
Angular permite una interfaz reactiva con roles; Express es una API ligera y mantenible; PostgreSQL garantiza integridad, transacciones y SQL parametrizado.

**3. ¿Dónde está la lógica?**
En el backend: controladores, servicios, DAOs y reglas de negocio. El frontend solo presenta y valida la experiencia.

**4. ¿Cómo se protege el acceso?**
JWT de 8 horas, bcrypt, RBAC en la API, ownership por curso/alumno, auditoría y bloqueo por cambio de contraseña.

**5. ¿Qué pasa si se cae el internet?**
La demo actual requiere conectividad. Para producción se debe definir contingencia, respaldo y política de operación.

**6. ¿Qué diferencia hay entre matrícula y pensión?**
La matrícula habilita el año; la pensión es el cobro mensual. Hasta pagar matrícula, el alumno queda `PendientePago`.

**7. ¿Cómo se calcula la nota final?**
A partir de las competencias calificadas con AD/A/B/C; el sistema recalcula al guardar. La conclusión debe coincidir con esa nota.

**8. ¿Qué es SIAGIE interno?**
Una exportación interna de apoyo con código/hash; no es una exportación oficial a SIAGIE/MINEDU.

**9. ¿Qué pasa si el acta está cerrada?**
Se bloquean notas y conclusiones; solo se consulta.

**10. ¿Qué falta para producción?**
Aprobación institucional, política de datos de menores, validación con usuarios, integraciones oficiales y soporte.

---

## 9. Qué no hacer al probar

- No usar datos reales de menores.
- No activar 2027 en Supabase demo sin decisión.
- No confirmar promociones en la demo si no se va a revertir la base.
- No borrar pagos, pensiones o alumnos para “probar”.
- No probar el setup en una base ya configurada.
- No presentar la demo como producción real.
- No decir que SIAGIE o SUNAT son oficiales.
- No afirmar “100 % seguro” ni “nunca falla”.

---

## 10. Checklist final

- [ ] Sé explicar la diferencia entre página, aplicación y sistema web.
- [ ] Sé dibujar la arquitectura en tres capas.
- [ ] Sé nombrar los cuatro roles y qué hace cada uno.
- [ ] Sé explicar el flujo matrícula → pago → notas → conclusión → reporte.
- [ ] Sé mostrar la búsqueda de boletas por DNI.
- [ ] Sé explicar por qué Conclusiones usa `id_carga`.
- [ ] Sé explicar que SIAGIE es interno.
- [ ] Sé explicar los límites de la demo.
- [ ] Tengo capturas/PDF de respaldo.
- [ ] Ensayé el flujo corto con cronómetro.
