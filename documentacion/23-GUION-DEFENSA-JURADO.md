# SIGA-UC — Guion de defensa ante jurado

> **Para:** sustentación del Sistema Integrado de Gestión Académica de la I.E.P. Unión Científica.
> **Objetivo:** captar la atención del jurado, explicar las decisiones técnicas con criterio,
> demostrar el sistema y responder con seguridad, sin exagerar ni prometer lo que no está.
> **Uso:** léelo completo una vez; luego usa las tablas y los guiones como chuleta.
> **Regla de oro:** no leas diapositivas. Cuenta una historia, muestra el sistema y explica
> por qué cada decisión tiene sentido para un colegio real.

---

## 0. Los cinco mensajes que el jurado debe recordar

Si el jurado olvida todo lo demás, debe quedarse con estas cinco ideas:

1. **SIGA-UC no es un CRUD.** Integra matrícula, notas por competencias, asistencia QR,
   tesorería, caja, reportes, SIAGIE interno, notificaciones y auditoría en una sola
   fuente de verdad.
2. **Resuelve un problema real.** En la demo hay 75 alumnos, 750 pensiones, 3,300 notas
   finales, 8,700 calificaciones y 4,125 asistencias. No es un ejercicio vacío.
3. **La arquitectura es simple y defendible.** Angular + Express + PostgreSQL, MVC + DAO,
   SQL parametrizado y transacciones. Simple no significa improvisado.
4. **La seguridad es proporcional al riesgo.** JWT, bcrypt, roles, ownership, rate limiting,
   Helmet, CORS, auditoría y transacciones; conocemos las brechas y tenemos un plan.
5. **Es una demo honesta.** No hay datos reales de menores, el SIAGIE es interno y el correo
   necesita un dominio verificado. Sabemos qué falta y por qué.

> **Frase de cierre interna:** “No vengo a decir que el sistema es perfecto; vengo a
> demostrar que resuelve el problema, que está bien estructurado y que sé qué falta para
> producción.”
>
> **Ruta rápida si tienes poco tiempo:** lee §0, §1.4, §2.5, §3.10, §4.2, §5.3, §6.11,
> §7, §8.2, §9.6, §10.9 y §12.1. Con eso tienes la historia, las respuestas y el cierre.

---

## 1. Apertura: los primeros 90 segundos

### 1.1. El hook (elige uno)

**Opción A — el dolor operativo:**

> “Imaginen marzo en un colegio. Secretaría tiene 75 matrículas en Excel; cada docente
> tiene su cuaderno de notas; tesorería tiene otra lista de pensiones; dirección pide un
> reporte y nadie sabe cuál es la versión correcta. Ese es el problema que SIGA-UC
> resuelve.”

**Opción B — la injusticia académica:**

> “Un alumno con una sola nota podía aparecer primero en el cuadro de mérito. No es un
> detalle: es una decisión académica injusta. Corregir eso fue una de las cosas que más
> me obligó a pensar en reglas de negocio, no solo en pantallas.”

**Opción C — la trazabilidad:**

> “Si mañana se va el docente que armó el Excel, ¿quién sabe cómo se calculó la nota,
> quién la cambió o cuándo se pagó la pensión? SIGA-UC existe para que esa pregunta
> tenga una respuesta verificable.”

### 1.2. La pregunta que involucra al jurado

> “¿Cuánto tarda su institución en responder tres preguntas básicas: quién debe la
> pensión de marzo, qué alumnos tienen `C` en dos cursos y quién no tiene nota final?”

Deja que la pregunta respire dos segundos. No la respondas tú.

### 1.3. La promesa

> “En los próximos minutos les muestro cómo un colegio puede pasar de tres Excel y un
> cuaderno a un solo sistema trazable, sin contratar un ejército de TI.”

### 1.4. Guion literal de apertura (90 segundos)

> “Buenos días. Antes de mostrarles pantallas, quiero pedirles que imaginen marzo en un
> colegio. Secretaría matricula en Excel, cada docente anota en su cuaderno, tesorería
> lleva otra lista y dirección pide un reporte que tarda días en armarse.
>
> Ese es el problema que SIGA-UC resuelve. No es un CRUD bonito: es un sistema que conecta
> matrícula, notas por competencias, asistencia, tesorería, caja, reportes y auditoría en
> una sola fuente de verdad.
>
> En la demo que van a ver hay 75 alumnos, 750 pensiones, 3,300 notas finales, 8,700
> calificaciones y 4,125 asistencias. Y todo se puede auditar.
>
> Voy a mostrarles tres cosas: cómo está estructurado, qué decisiones técnicas tomé y por
> qué, y qué límites tiene. Porque un sistema serio no se demuestra solo con lo que hace,
> sino también con lo que reconoce que le falta.”

### 1.5. Lo que NO debes hacer al inicio

- No empieces con “mi sistema se llama SIGA-UC y fue hecho en Angular”.
- No leas la arquitectura en los primeros dos minutos.
- No pidas disculpas por ser una demo.
- No digas “es solo un proyecto de la universidad”; di “es una demo funcional con datos
  ficticios, diseñada para un colegio real”.
- No prometas “100% seguro”, “SIAGIE oficial” ni “producción real”.

---

## 2. Problema, usuarios y propuesta de valor

### 2.1. Los siete dolores que resuelve

| # | Dolor del colegio | Consecuencia | Módulo que lo atiende |
|---|---|---|---|
| 1 | Matrícula dispersa en Excel y papel | Duplicados, alumnos sin código, datos incompletos | Alumnos, matrícula, padrón |
| 2 | Notas en cuadernos y hojas sueltas | Errores, pérdida, difícil consolidar | Calificaciones, notas finales, actas |
| 3 | Asistencia manual | Se pierde el registro, no hay evidencia | Asistencia QR |
| 4 | Pensiones y pagos sin conciliación | No se sabe quién debe ni cuánto se cobró | Tesorería, caja, pensiones |
| 5 | Reportes armados a mano | Días de trabajo y versiones distintas | Reportes, libretas, meritocracia |
| 6 | Cambio de año lectivo | Se mezclan años o se duplica todo | Años lectivos, rollover, promociones |
| 7 | Nadie sabe quién cambió qué | Sin trazabilidad ni rendición de cuentas | Auditoría, bitácora |

### 2.2. Usuarios y roles

| Rol | ID | Qué puede hacer | Qué NO debe poder hacer |
|---|---:|---|---|
| ADMIN | 1 | Todo: configuración, años, promociones, personal, reportes, auditoría | — |
| DOCENTE | 2 | Ver sus cursos, notas, asistencia, conclusiones, reportes de su grado | Ver cursos que no tiene asignados |
| SECRETARIA | 3 | Padrón, matrícula, tesorería, caja, horarios, personal (según permisos) | Confirmar promociones ni administrar configuración |
| ESTUDIANTE | 4 | Ver sus notas, asistencia, horario y libreta propias | Ver datos de otros alumnos |

> **Idea clave:** la UI oculta botones, pero **la API manda**. El backend valida rol y
> pertenencia; no confía en que el frontend “no muestre” la opción.

### 2.3. Propuesta de valor en una tabla

| Dolor | Lo que hace SIGA-UC | Beneficio medible | Evidencia en la demo |
|---|---|---|---|
| Matrícula dispersa | Matrícula anual con validaciones y código correlativo | Menos duplicados y trazabilidad | Padrón y ficha del alumno |
| Notas en cuadernos | Notas por competencia y nota final por curso/bimestre | Consolidación inmediata | Notas del docente y libreta |
| Asistencia manual | QR por alumno y registro masivo | Menos tiempo y evidencia | Asistencia QR |
| Pensiones sin conciliación | Generación, pago, anulación, becas y caja | Estado de deuda por alumno | Tesorería y caja |
| Reportes a mano | Reportes y PDF con filtros por año/bimestre | Minutos, no días | Reportes y libretas |
| Cambio de año | Años lectivos, rollover y promoción | No se mezclan años | `/admin/anios-lectivos` |
| Sin trazabilidad | Bitácora y triggers de auditoría | Se sabe quién cambió qué | `/admin/auditoria` |

### 2.4. Alcance y límites (dilo tú antes de que lo pregunte el jurado)

**Está implementado y probado:**

- Login con roles y cambio obligatorio de contraseña.
- Matrícula anual, padrón, ficha, retiro y histórico.
- Notas por competencia, notas finales, actas, conclusiones descriptivas.
- Asistencia con QR y reportes.
- Tesorería, pensiones, pagos, caja, becas y boletas PDF.
- Reportes, libreta PDF, cuadro de mérito, alumnos en riesgo.
- SIAGIE interno con código de control y hash.
- Años lectivos, rollover, promociones y reversión.
- Configuración institucional, tarifas, académico, horarios y becas.
- Auditoría y notificaciones.

**No está implementado o es limitado:**

- SIAGIE **oficial** (solo exportación interna).
- Datos reales de menores (solo demo ficticia).
- Correo a cualquier destinatario (falta dominio verificado de Resend).
- MFA, refresh tokens, cookies HttpOnly.
- CI/CD, Docker, pruebas de carga formales.
- Backups automáticos garantizados en el plan gratuito (hay script manual).
- App móvil nativa (la web es responsive).
- Calendario de pensiones flexible: la matriz aún asume 12 meses; las tarifas por
  nivel/grado ya son configurables, pero el calendario administrable es siguiente fase.
- Cálculo automático de la nota final desde competencias: hoy se persiste la nota final;
  la UI no la deriva sola. Es una brecha conocida.

> **Cómo decirlo:** “La demo está funcional y los límites son conocidos. Eso es distinto de
> un sistema a medias: sé exactamente qué falta y en qué orden lo resolvería.”

### 2.5. Elevator pitch

**30 segundos:**

> “SIGA-UC es un sistema web para colegios que integra matrícula, notas por competencias,
> asistencia QR, tesorería, caja, reportes y auditoría. Reemplaza Excel y cuadernos por una
> sola fuente de verdad, con roles y trazabilidad. Está hecho con Angular, Express y
> PostgreSQL, y ya funciona en una demo con 75 alumnos.”

**2 minutos:** usa el guion de la sección 1.4 y añade:

> “La diferencia no es tener pantallas bonitas: es tener reglas. Por ejemplo, el cuadro de
> mérito solo rankea alumnos con nota final en todos los cursos; la promoción no se confirma
> sola, se previsualiza y se confirma con un hash; y cada pago queda auditado.”

---

## 3. Tecnologías: qué usé, por qué y qué dejé fuera

### 3.1. Stack real

| Capa | Tecnología | Versión | Rol | Por qué |
|---|---|---|---|---|
| Frontend | Angular standalone + signals | 21.2 | SPA, rutas, formularios, guards, interceptor | Framework completo y tipado |
| UI | Bootstrap 5 + FontAwesome 7 | 5.3 / 7.3 | Layout, componentes, iconos | Rápido, responsive, sin dependencia pesada |
| Backend | Node.js + Express | 20 / 5 | API REST | Ligero, mismo lenguaje que el frontend |
| Base de datos | PostgreSQL | 18.4 | Datos relacionales, transacciones | ACID, constraints, SQL potente |
| SQL | Crudo parametrizado | — | DAOs | Control y rendimiento |
| Auth | JWT + bcrypt | 8 h / coste 10 | Sesión y contraseñas | Simple y suficiente para el dominio |
| Correo | Resend (API HTTP) | 6.x | Recuperación y notificaciones | Sin SMTP, fácil en Render |
| Excel | ExcelJS | 4.x | Exportación interna | Control de hojas/columnas |
| PDF | PDFKit | 0.21 | Libretas y boletas | Sin servicio externo |
| QR | qrcode | 1.5 | Asistencia | Generación en frontend |
| Deploy | Render | — | Backend + frontend | HTTPS y deploy desde Git |
| DB cloud | Supabase | PostgreSQL | Demo administrada | Backup y disponibilidad básica |

### 3.2. Angular 21: por qué

**Lo que aporta al proyecto:**

- **Standalone components:** menos `NgModules`, estructura más clara.
- **Signals:** estado reactivo simple para usuario, filtros y carga.
- **Router con guards:** protege rutas por rol.
- **Interceptor HTTP:** agrega el token y maneja errores/401 en un solo lugar.
- **Reactive Forms:** validaciones de matrícula, notas y pagos.
- **Lazy loading:** cada módulo se carga cuando se necesita.
- **TypeScript:** detecta errores antes de ejecutar.

**Costo/limitación:** Angular es opinionado y tiene curva de aprendizaje; el bundle inicial
es más pesado que una librería mínima. Para este proyecto, la estructura y el tipado valen
más que esos costos.

**Por qué no React o Vue:**

- React exige elegir router, forms, estado, HTTP y estructura; en un proyecto académico con
  tiempo limitado, esas decisiones extra aumentan la inconsistencia.
- Vue es más simple, pero Angular ya trae DI, guards, interceptor, forms y router de forma
  integrada; el equipo lo domina.
- No hay una tecnología “mejor” en abstracto: hay ajuste al equipo, al problema y al plazo.

### 3.3. Node.js + Express 5: por qué

- **Mismo lenguaje en frontend y backend:** menos cambio de contexto.
- **Express 5:** routers, middleware, validación y errores con poca ceremonia.
- **18 routers** conviven bien con una estructura MVC + DAO.
- **Despliegue simple:** Render ejecuta `node src/app.js` sin contenedores.

**Por qué no NestJS:** NestJS es excelente para equipos grandes y arquitectura por módulos,
pero añade decoradores, DI y una curva que no se justifica para 18 routers. **Por qué no
Spring Boot/Django/Laravel:** son robustos, pero obligan a otro runtime/lenguaje y a duplicar
el modelo mental; Node permitió entregar más rápido con el mismo equipo.

### 3.4. PostgreSQL 18: por qué

Los datos del colegio son **relacionales por naturaleza**:

- Un alumno tiene matrícula por año, grado, apoderado, notas, asistencia y pensiones.
- Un pago afecta una pensión, un pre-ticket y una caja.
- Un curso se repite en varios grados y docentes.
- Un reporte necesita joins, agregaciones, CTEs y window functions.

PostgreSQL aporta:

- **ACID:** pagos, matrícula y promociones no quedan a medias.
- **Constraints:** DNI de 8 dígitos, estados válidos, bimestres 1–4, notas AD/A/B/C.
- **Transacciones y `FOR UPDATE`:** concurrencia en pagos, caja y matrícula.
- **CTEs y window functions:** cuadro de mérito, reportes, consolidados.
- **Triggers:** auditoría de calificaciones, actualización de pensión/pre-ticket, caja.
- **Extensiones:** `pgcrypto`, `unaccent`, `uuid-ossp`.

**Por qué no MongoDB:** habría que mover integridad referencial y transacciones al código;
los reportes entre años y la tesorería se vuelven más frágiles. **Por qué no Firebase:** es
cómodo para prototipos, pero el modelo relacional, los reportes y el control de datos exigen
más que un documento JSON; además hay dependencia del proveedor.

### 3.5. SQL crudo + DAO: por qué

**Ventajas:**

- Control total de la consulta y del plan de ejecución.
- Reportes con CTEs, `FILTER`, `ROW_NUMBER`, `FOR UPDATE`.
- Sin “magia” de ORM que oculte N+1 o queries inesperadas.
- SQL parametrizado (`$1, $2...`) evita inyección.

**Costo:**

- Más código de mapeo.
- Más disciplina: cada consulta debe revisarse.
- Menos ayuda automática que un ORM.

**Por qué no Prisma/TypeORM/Sequelize:** para un CRUD simple serían cómodos; para reportes
complejos y transacciones explícitas, el ORM añade fricción. La capa DAO ya aísla el SQL y
permite cambiarlo sin tocar controllers/services.

### 3.6. JWT + bcrypt: por qué

- **bcrypt coste 10:** hash lento deliberadamente; nunca se guarda la contraseña.
- **JWT 8 h:** sesión stateless; el servidor no guarda sesión en memoria.
- **Revalidación de estado:** en cada request se consulta que el usuario siga `ACTIVO`.
- **Cambio obligatorio:** si `requiere_cambio_password`, solo puede cambiar la clave.
- **Rate limiting:** 5 intentos por 15 minutos en login/recuperación.

**Por qué no Auth0/Cognito/Firebase Auth:** costo, dependencia externa y roles
institucionales simples. **Costo asumido:** no hay MFA ni refresh token; el token vive en
`localStorage` (riesgo XSS). Son mejoras de siguiente fase, no secretos.

### 3.7. Resend: por qué

- Render puede bloquear o limitar SMTP; una API HTTP es más simple y observable.
- Resend devuelve ID de mensaje y errores claros.
- El código ya distingue `enviado: true/false`; no miente al usuario.

**Por qué no Nodemailer/SMTP:** más configuración, problemas de puertos, menos trazabilidad.
**Limitación actual:** Resend exige un dominio verificado para enviar a cualquier usuario;
`onboarding@resend.dev` solo entrega al dueño de la cuenta. Es configuración, no código.

### 3.8. ExcelJS + PDFKit: por qué

- **ExcelJS:** exportación interna de calificaciones con columnas controladas, hoja de aviso
  y formato.
- **PDFKit:** libretas y boletas sin depender de un servicio externo.
- **Costo:** mantener plantillas y estilos; **beneficio:** control y privacidad.

### 3.9. Render + Supabase: por qué

- **Render:** deploy desde Git, HTTPS, health check, variables de entorno.
- **Supabase:** PostgreSQL administrado, ideal para demo.
- **Costo:** plan gratuito; **limitación:** cold start y recursos compartidos.
- **Por qué no AWS/Azure/GCP:** para una demo, la complejidad de IAM, VPC y facturación no
  aporta valor; en producción real se evaluaría.

### 3.10. “¿Por qué no usaste X?” — tabla maestra

| Alternativa | Por qué no la usé | Cuándo sí la usaría |
|---|---|---|
| React | Más decisiones de librerías; Angular ya integra router/forms/guards | Equipo con experiencia React o necesidad de ecosistema específico |
| Vue | Menos estructura para un sistema grande por roles | Proyectos pequeños o equipos Vue |
| NestJS | Overhead de módulos/DI para 18 routers | Equipo grande, arquitectura por dominios |
| Spring Boot | Otro runtime y más configuración | Empresa Java, integraciones corporativas |
| Django/Laravel | Duplicaría lenguaje y modelo | Equipo Python/PHP |
| MongoDB | Integridad y reportes relacionales | Documentos flexibles, catálogos no relacionales |
| Firebase | Lock-in y consultas/reportes limitados | Prototipo rápido sin reportes complejos |
| Prisma/TypeORM | Menos control en CTEs, `FOR UPDATE`, reportes | CRUD simple con equipo junior |
| Docker | No era necesario para un servicio en Render | Producción multi-entorno y CI/CD |
| Kubernetes | Complejidad operativa desproporcionada | Escala multi-servicio y alta disponibilidad |
| Microservicios | Un solo dominio y un solo equipo | Equipos múltiples y despliegues independientes |
| Auth0/Cognito | Costo/dependencia; roles simples | MFA, SSO, cumplimiento avanzado |
| Nodemailer/SMTP | Puertos y entrega menos observable | Infraestructura propia con SMTP dedicado |
| App móvil nativa | Web responsive cubre el caso; QR funciona en navegador | Notificaciones push intensivas o offline |
| IA/ML | No es necesario para las reglas actuales | Predicción de riesgo, detección de anomalías |
| Blockchain | No aporta al problema; la auditoría ya es inmutable a nivel de negocio | Certificación externa de documentos |

> **Frase para el jurado:** “No elegí tecnologías por moda; elegí las que me permitían
> entregar con calidad, con el equipo que tengo y con el presupuesto de un colegio.”

---

## 4. Cómo está estructurado el sistema

### 4.1. Vista general

```text
Navegador (Angular 21)
   │  HTTPS + JWT
   ▼
API REST (Express 5)
   │  middlewares: Helmet, CORS, rate limit, auth, roles, validación
   ▼
Routes → Controllers → Services → DAOs
   │  SQL parametrizado + transacciones
   ▼
PostgreSQL 18 (Supabase en demo)
```

### 4.2. Backend por capas

| Capa | Responsabilidad | Ejemplo | Regla |
|---|---|---|---|
| `routes` | Definir endpoint, validar entrada, exigir auth/rol | `alumnoRoutes.js` | Ruta fija antes que paramétrica |
| `controllers` | Traducir HTTP, status y respuesta uniforme | `alumnoController.js` | No contiene SQL |
| `services` | Reglas de negocio y orquestación | `alumnoService.js` | Transacciones y validaciones |
| `daos` | SQL parametrizado y mapeo | `alumnoDao.js` | Nunca concatenar valores |
| `middlewares` | Auth, roles, ownership, rate limit | `authMiddleware.js` | La API manda, no la UI |
| `config` | Entorno, DB, año lectivo | `database.js` | Zona horaria y pool |
| `utils` | Respuesta, errores, PDF/Excel | `response.js`, `pdfCommon` | Formato uniforme |

**Ciclo de una petición:**

1. Angular envía `Authorization: Bearer <token>`.
2. Helmet, CORS y rate limit actúan.
3. `verificarAutenticacion` valida JWT y estado del usuario.
4. `verificarRol` / `checkAlumnoPropio` / `checkCursoDocente` autorizan.
5. El validador revisa el body/params.
6. El controller llama al service.
7. El service aplica reglas y llama al DAO.
8. El DAO ejecuta SQL parametrizado; si hay varias tablas, transacción.
9. El controller responde `{ success, message, data, timestamp }`.
10. El frontend actualiza signals y muestra el resultado.

### 4.3. Frontend por capas

| Carpeta | Contenido | Para qué |
|---|---|---|
| `core/guards` | `authGuard`, `roleGuard` | Proteger rutas |
| `core/interceptors` | Token, errores, 401 | Comportamiento transversal |
| `core/services` | Auth, configuración, notificaciones | Estado y API |
| `shared/components` | Header, sidebars, selector de año | Reutilización |
| `features/auth` | Login, recuperación, setup | Acceso |
| `features/admin` | Alumnos, personal, reportes, configuración | Gestión |
| `features/secretaria` | Padrón, tesorería, caja, horarios | Operación |
| `features/docente` | Notas, asistencia, conclusiones, ficha | Aula |
| `features/estudiante` | Dashboard, notas, asistencia, horario | Autoservicio |

**Decisiones de UI:**

- Signals para estado local y usuario actual.
- `inject()` en lugar de constructores largos.
- Modales con `@if`, overlay y `stopPropagation()`.
- Loading se apaga primero en `error:` para no dejar la pantalla bloqueada.
- Responsive: drawer en móvil/tableta; tablas compactas con columnas fijas.

### 4.4. Base de datos: 48 tablas base

Agrupadas por dominio:

| Grupo | Tablas representativas | Propósito |
|---|---|---|
| Identidad | `usuarios`, `roles`, `personal`, `apoderados` | Quién es quién |
| Académico | `grados`, `cursos`, `competencias`, `carga_curricular`, `horarios` | Oferta y asignación |
| Matrícula | `alumnos`, `anios_lectivos`, `promociones` | Matrícula anual y continuidad |
| Calificaciones | `calificaciones`, `notas_finales_area`, `actas_bimestrales`, `conclusiones_descriptivas` | Notas y cierre |
| Asistencia | `asistencia_alumnos`, `asistencia_personal` | Presencia |
| Tesorería | `pensiones`, `pagos`, `pre_tickets`, `conceptos_pago`, `becas`, `aplicaciones_beca` | Cobros y descuentos |
| Caja | `cajas`, `aperturas_caja`, `movimientos_caja`, `cierres_caja` | Efectivo/digital |
| Reportes | `exportaciones_siagie`, `libretas` | Salidas |
| Configuración | `configuracion_institucional`, `tipos_beca`, `anios_lectivos` | Parametrización |
| Auditoría | `bitacora_auditoria`, `recuperacion_password` | Trazabilidad y seguridad |

**Restricciones que cuentan historias:**

- `usuarios.dni` único; `alumnos` único por `(dni, anio_lectivo)`, `(id_usuario, anio_lectivo)`
  y `(codigo_estudiante, anio_lectivo)`.
- `notas_finales_area` único por alumno/curso/bimestre/año.
- `calificaciones` único por alumno/curso/competencia/bimestre/año.
- `pensiones` con estados `PENDIENTE/PAGADO/ANULADO` y mes 1–12.
- `pagos` con estados `PAGADO/ANULADO` y formas de pago controladas.
- `actas_bimestrales` con estado `ABIERTO/CERRADO` y hash.

### 4.5. El problema difícil: multi-año

Un colegio no es “una tabla de alumnos”. Es una historia por año:

- `usuarios` es la identidad (DNI único).
- `alumnos` es la **matrícula anual**: un alumno puede repetir en 2027 y tener otra fila.
- `anios_lectivos` tiene un solo `ACTIVO`.
- El año activo se lee de la base al arrancar; `ANIO_LECTIVO` es solo respaldo.
- Los históricos usan `?anio=YYYY`; no se suman notas/pagos entre años.
- El rollover clona grados, conceptos, períodos, carga y tutores; **no** alumnos, pagos,
  notas ni asistencia.
- La promoción es recomendación + confirmación humana, con `preview_hash` y reversión.

**Por qué es innovador:** muchos sistemas “funcionan” un año y se rompen al siguiente. Aquí
el año es una dimensión de diseño, no un `WHERE anio = 2026` escondido.

### 4.6. Flujos clave

| Flujo | Entrada | Regla central | Salida |
|---|---|---|---|
| Login | DNI + contraseña | bcrypt + usuario activo + JWT | Token y perfil |
| Matrícula | Datos del alumno/apoderado | Grado y concepto del año; estado `PendientePago` | Alumno + pre-ticket |
| Notas | Curso, competencia, bimestre | Docente asignado; acta abierta | Calificación |
| Nota final | Curso/bimestre | Predominancia AD>A>B>C | `notas_finales_area` |
| Asistencia | QR o registro masivo | Alumno del grado/curso; fecha | Asistencia |
| Pago | Alumno, concepto, monto | Transacción; pensión/pre-ticket/caja | Pago + boleta |
| Caja | Apertura/cierre | Una caja abierta; movimientos | Cierre con totales |
| Mérito | Grado/bimestre/año | Todos los cursos con nota | Top 10 |
| SIAGIE | Grado/año | Exportación interna con hash | Excel + código |
| Promoción | Año origen/destino | Preview + política + confirmación | Matrícula destino |
| Auditoría | Evento | Registro posterior al commit | Bitácora |

### 4.7. Convenciones de API

**Respuesta uniforme:**

```json
{
  "success": true,
  "message": "Descripción",
  "data": {},
  "timestamp": "2026-11-27T14:00:00.000Z"
}
```

**Códigos de error de negocio:** `409` conflicto, `422` regla incumplida, `403` rol/ownership,
`404` recurso no encontrado, `503` migración no aplicada. El frontend muestra el mensaje y,
cuando aplica, un código para soporte.

**Paginación:** `page`, `pageSize`, `search`; `data` sigue siendo arreglo y se agrega
`pagination` (`total`, `totalPages`). Ejemplo H81: padrón de tesorería en **una sola consulta**.

### 4.8. Despliegue

```text
GitHub main
   ├── Render Static Site  → Angular build (404.html para SPA)
   └── Render Web Service  → Express + health check
             │
             └── Supabase PostgreSQL (SSL, pooler, TZ America/Lima)
```

- `/api/health` responde 200 incluso mientras la DB arranca; expone `status`, `dbReady`,
  `zona_horaria` y `commit`.
- El frontend reintenta el login si Render está en cold start (502/503/504/timeout).
- Variables sensibles en Render, no en el repo.
- `404.html` generado en postbuild para que las rutas de Angular no den 404.

### 4.9. Números del código (para citar con cuidado)

| Métrica | Valor |
|---|---:|
| Tablas base | 48 (49 en local con backup H47) |
| Endpoints documentados | 169 |
| Routers / controladores | 18 / 18 |
| Servicios | 31 |
| DAOs | 27 |
| Archivos JS backend | 104 |
| Archivos frontend | 169 (72 TS) |
| Roles | 4 |
| Alumnos demo | 75 (15 por grado) |
| Notas finales demo | 3,300 |
| Calificaciones demo | 8,700 |
| Asistencias demo | 4,125 |
| Pensiones demo | 750 |
| Pagos demo | 113 en Render; 432 en local v2 |

> **Consejo:** no recites la tabla completa. Usa 3 números: 48 tablas, 169 endpoints y 75
> alumnos. El resto déjalo para preguntas.

---

### 4.10. Metodología de construcción

No fue cascada ni “big bang”. Fue **incremental y verificable**:

1. **Fase 0:** alcance, actores, reglas y modelo de datos.
2. **Fases 1–5:** auth, matrícula, notas, asistencia, tesorería y reportes.
3. **Fases 6.1–6.4:** multi-año, rollover, promoción y matrícula anual.
4. **Fase 7 / H80:** conclusiones estructuradas y SIAGIE interno.
5. **Configuración (H74–H79):** institución, tarifas, académico, horarios, becas y setup.
6. **Rendimiento (H81):** índices y paginación.

Cada cambio relevante siguió el mismo patrón:

```text
migración SQL → DAO → service → controller → ruta → frontend → documentación → prueba
```

**Por qué importa:** el jurado puede ver que no hay “parches” aislados; hay un historial
H1–H81, migraciones idempotentes y documentación temática. Eso es trazabilidad de ingeniería.



### 5.1. Notas por competencias + conclusiones estructuradas

- No es solo “poner una nota”: se registra por competencia, bimestre y curso.
- La conclusión descriptiva tiene nivel de logro, avance, dificultad, sugerencia y texto
  compuesto (máx. 350).
- El nivel debe coincidir con la nota final; el acta cerrada bloquea la edición.
- El docente la edita en `/docente/conclusiones`; ADMIN puede revisar.

**Por qué importa:** se alinea con el enfoque por competencias del CNEB y reduce el “texto
copiado” de las libretas.

### 5.2. SIAGIE interno con código de control y hash

- Genera un Excel con todos los cursos de la carga, notas finales y conclusión descriptiva.
- Incluye código de control y hash SHA-256 para verificar que el archivo no cambió.
- Es **exportación interna**, no oficial. El aviso está visible.

**Por qué importa:** el colegio gana tiempo y puede verificar la integridad del archivo,
sin mentir diciendo que es una carga oficial a MINEDU.

### 5.3. Cuadro de mérito justo

- Antes: promedio sobre las notas existentes; un alumno con una sola nota podía salir primero.
- Ahora: solo entra quien tiene nota final en **todos** los cursos de `carga_curricular` del
  grado/bimestre/año.
- Orden: promedio ponderado, cantidad de AD, cursos, nombre.
- La UI muestra `n/total cursos` y explica la regla.

**Por qué importa:** el ranking compara poblaciones equivalentes; no premia la falta de datos.

### 5.4. Multi-año y promoción con control humano

- `preview` de promoción: solo lectura, con `preview_hash`.
- El `confirm` recalcula el hash dentro de la transacción; si cambió, `409`.
- La política define actas, notas, asistencia, repitencia y override.
- PENDIENTE no se confirma; egresados/retirados no crean matrícula destino.
- La reversión solo procede si el destino no tiene actividad.

**Por qué importa:** automatizar una decisión académica sin control sería peligroso. El
sistema recomienda; el humano confirma.

### 5.5. Motor de becas

- Catálogo `tipos_beca`: alcance, modalidad, tope, combinación, exclusividad, prioridad,
  evidencia y aprobación.
- Una beca aprobada se aplica a cargos `PENDIENTE/EXONERADO`; los `PAGADO/ANULADO` no se
  reprecian.
- Una beca del 100% deja el cargo en `EXONERADO` y monto 0.
- Al anular, se borran aplicaciones y los pendientes vuelven a `PENDIENTE`.

**Por qué importa:** evita descuentos “a mano” y deja rastro de quién aprobó qué.

### 5.6. Tesorería y caja con conciliación

- Pensiones, pagos, pre-tickets, conceptos y becas en un solo flujo.
- KPI de deuda: pre-tickets + pensiones + alumnos con deuda.
- Caja separa efectivo y digital; pagos imputan a caja y pensión/pre-ticket.
- Boleta PDF y búsqueda por DNI/nombre/código.

**Por qué importa:** dirección sabe cuánto se debe y cuánto se cobró, sin sumar Excel.

### 5.7. Asistencia QR

- QR por alumno; el docente registra y el sistema valida grado/curso/fecha.
- Reportes por alumno y grado.

**Por qué importa:** menos planillas, más evidencia y menos discusión.

### 5.8. Configuración sin hardcodear

- Institución, moneda, zona horaria, textos de PDF/correo.
- Tarifas por nivel/grado con vigencia.
- Áreas, cursos, competencias y carga activables.
- Jornada, días y límites de horario.
- Becas y tipos.

**Por qué importa:** el sistema no queda atado a “2026” ni a una sola estructura curricular.

### 5.9. Auditoría

- Bitácora de escrituras, accesos, descargas y eventos de seguridad.
- Triggers auditan calificaciones; login y pagos registran eventos.
- No registra cada lectura (sería ruido).

**Por qué importa:** se puede responder “quién cambió esta nota” o “quién anuló este pago”.

### 5.10. Rendimiento

- Padrón de tesorería: una consulta con alumnos + pensiones + estado (25/página).
- Personal paginado; pagos paginados con búsqueda.
- Índices H81 para las consultas frecuentes.
- Frontend con lazy loading y signals.

**Por qué importa:** la primera versión hacía 75 peticiones; ahora hace una. Eso se nota.

### 5.11. Resiliencia y errores honestos

- Health check 200 durante arranque; frontend reintenta cold start.
- Correo: si Resend falla, la API responde `enviado:false`; la UI pide contactar al admin.
- Migraciones ausentes: `503` con código claro, no 500 genérico.
- Transacciones con rollback.

**Por qué importa:** un sistema serio no oculta fallos; los hace visibles y accionables.

### 5.12. Tabla “innovación real vs. marketing”

| Función | Regla real | Evidencia |
|---|---|---|
| Mérito justo | Solo cursos completos | `reporteDao.getCuadroMerito` |
| Promoción segura | Preview + hash + confirm | `promocionService` |
| SIAGIE interno | Hash + código de control | `exportaciones_siagie` |
| Becas | Prioridad/exclusividad/reprecio | `becaCalculator` |
| Multi-año | Matrícula anual + año activo | H49/H73 |
| Auditoría | Triggers + bitácora | H07/H48 |
| Rendimiento | Una consulta + índices | H81 |

---

## 6. Seguridad y privacidad de datos

### 6.1. Modelo en una frase

> “Confianza cero en el frontend, validación en el backend, mínimo privilegio por rol,
> transacciones para el dinero y auditoría para lo académico.”

### 6.2. Autenticación

| Control | Implementación | Qué evita |
|---|---|---|
| Hash de contraseña | bcrypt coste 10 | Contraseñas en texto plano |
| Token | JWT firmado, 8 h | Sesión stateless |
| Estado del usuario | Revalidación en cada request | Usuario cesado con token vivo |
| Cambio obligatorio | `requiere_cambio_password` | Clave temporal eterna |
| Rate limit | 5 intentos / 15 min | Fuerza bruta |
| Login fallido | Bitácora `LOGIN_FALLIDO` | Falta de evidencia |

### 6.3. Autorización

- **Roles:** ADMIN, DOCENTE, SECRETARIA, ESTUDIANTE.
- **Rutas:** `verificarAutenticacion` + `verificarRol` en escrituras y reportes.
- **Ownership:**
  - `checkAlumnoPropio`: estudiante solo su matrícula; docente solo alumnos de sus cursos.
  - `checkCursoDocente`: docente solo cursos que tiene en `carga_curricular`.
  - `checkGradoDocente`: reportes solo de su grado.
- **Regla:** la UI oculta, la API valida. Un 403 es una prueba de seguridad, no un error.

### 6.4. Transporte y cabeceras

- HTTPS en Render.
- `helmet()` para cabeceras de seguridad.
- CORS con lista blanca: localhost y `FRONTEND_URL`.
- `trust proxy` para que rate limit use la IP real detrás de Render.
- `X-Request-Id` para correlacionar logs.

### 6.5. Inyección SQL e integridad

- **SQL parametrizado** en todos los DAOs (`$1, $2...`).
- **Nunca** concatenar valores de usuario.
- Validadores `express-validator` en rutas.
- **Transacciones** (`BEGIN/COMMIT/ROLLBACK`) en matrícula, pagos, caja, promoción,
  asistencia masiva, calificaciones masivas.
- **`FOR UPDATE`** en pagos, caja, matrícula, años y becas para concurrencia.
- **Constraints** en la base: DNI, estados, bimestres, notas, montos.
- **Triggers** para pensión, pre-ticket, caja y auditoría.

### 6.6. Recuperación de contraseña

- Token aleatorio de 64 hex, expira en 2 h, un solo uso.
- Invalida tokens anteriores.
- Rate limit en solicitud y validación.
- Enlace a `FRONTEND_URL/reset-password?token=...`.
- Si Resend falla, la API responde `{ tieneCorreo: true, enviado: false }`; la UI pide
  contactar al administrador.
- **Limitación:** el token se guarda en texto plano y viaja en query string; una mejora es
  hashearlo y usar un enlace de un solo uso con POST.

### 6.7. Auditoría

| Evento | Dónde | Qué registra |
|---|---|---|
| Login exitoso/fallido | `bitacora_auditoria` | Usuario, IP, fecha |
| Calificación creada/modificada | Trigger | Valor anterior/nuevo, `modificado_por` |
| Pago/anulación | Servicio + bitácora | Monto, motivo, usuario |
| Matrícula/retiro | Servicio + bitácora | Datos y motivo |
| Descarga de PDF/Excel | Servicio | Usuario y recurso |
| Configuración | Servicio | Cambio y responsable |

> **No prometas:** “auditamos cada lectura”. Hoy se auditan escrituras, accesos, descargas y
> eventos de seguridad; no cada SELECT.

### 6.8. Datos del estudiante y datos personales

**Qué datos maneja el sistema:**

- Identidad: DNI, nombres, apellidos, fecha de nacimiento.
- Contacto: correo personal/institucional, teléfono, apoderado.
- Académico: grado, sección, notas, competencias, conclusiones, asistencia.
- Financiero: pensiones, pagos, becas, deuda.
- Personal: docentes, secretaría, usuarios y roles.

**Controles actuales:**

- Acceso por rol y pertenencia.
- Contraseñas hasheadas; secretos en variables de entorno.
- HTTPS y cabeceras.
- Auditoría de cambios.
- Datos de demo ficticios; no se cargan menores reales hasta aprobación.

**Marco legal a mencionar (Perú):**

- Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento.
- Para menores, se debe evaluar la base legal y el consentimiento de padres/apoderados.
- El colegio sería el responsable del tratamiento; el sistema debe permitir acceso,
  rectificación y retención controlada.

> **No des asesoría legal:** di “es un marco que el colegio debe validar con su asesoría”.

### 6.9. Secretos y entornos

- `.env` no se versiona; `.env.example` documenta variables.
- Render guarda `JWT_SECRET`, `DB_*`, `RESEND_API_KEY`, `FRONTEND_URL`.
- `env.js` aborta en producción si falta `JWT_SECRET` o es débil.
- No se imprimen contraseñas ni tokens en logs.
- Rotar `JWT_SECRET` invalida todas las sesiones (efecto deseado en incidente).

### 6.10. Brechas conocidas y plan

| Brecha | Riesgo | Mitigación actual | Siguiente paso |
|---|---|---|---|
| Token en `localStorage` | XSS | Angular escapa por defecto; Helmet | Cookie HttpOnly + SameSite + CSP |
| Sin MFA | Robo de credenciales | Rate limit, cambio obligatorio | TOTP para ADMIN/SECRETARIA |
| Sin refresh token | Sesión fija 8 h | Expiración | Refresh rotativo + revocación |
| Logout solo local | Token vivo hasta expirar | 8 h | Lista de revocación |
| Token de recuperación en URL | Logs/historial | 2 h, un uso, rate limit | Hash en BD + POST |
| `tieneCorreo:false` | Enumera usuarios | Rate limit | Respuesta genérica siempre |
| Sin cifrado de aplicación | Acceso a BD | HTTPS, Supabase, roles | Cifrado de columnas sensibles |
| Backups free | Pérdida | Script manual | Backup programado + prueba |
| Sin CI/auditoría de dependencias | Regresiones | Suites manuales | CI + `npm audit` |
| GET de catálogo amplios | Exposición limitada | Roles en módulos sensibles | Revisión endpoint por endpoint |

### 6.11. Cómo responder “¿es seguro?”

> “No digo que sea 100% seguro, porque eso no existe. Digo que tiene controles
> proporcionales al riesgo: contraseñas hasheadas, JWT, roles, ownership, rate limiting,
> HTTPS, CORS, SQL parametrizado, transacciones y auditoría. También sé cuáles son las
> brechas: token en localStorage, falta MFA y el dominio de correo. Tengo un plan para
> cerrarlas. Y los datos reales de menores no están cargados.”

### 6.12. Lo que no debes decir

- “Nadie puede entrar.”
- “Los datos están encriptados” (si no lo están a nivel de aplicación).
- “Es producción real.”
- “Es SIAGIE oficial.”
- “El correo funciona para todos” (hoy solo para el dueño de Resend).
- “No hay riesgos.”

---

## 7. Rúbrica: cómo ganar puntos en cada criterio

> Ajusta los porcentajes a la rúbrica de tu institución. Esta tabla es una guía de evidencia.

| Criterio típico | Qué busca el jurado | Qué mostrar | Frase clave |
|---|---|---|---|
| Problema y justificación | Que el problema sea real y relevante | Dolores del colegio, datos demo | “No es un CRUD; es un proceso real” |
| Objetivos y alcance | Claridad de lo que sí y no | Módulos y límites | “Sabemos qué falta” |
| Marco teórico | Dominio de conceptos | MVC, DAO, REST, ACID, RBAC, CNEB | “Cada patrón tiene una razón” |
| Metodología | Proceso de construcción | Fases H1–H81, iteraciones, pruebas | “Incremental, con documentación” |
| Análisis y diseño | Modelo de datos y arquitectura | Diagrama, 48 tablas, multi-año | “El año es una dimensión” |
| Desarrollo | Código funcional y coherente | Demo, capas, SQL, transacciones | “MVC + DAO sin atajos” |
| Funcionalidad | Que los flujos funcionen | Matrícula, notas, QR, tesorería | “De punta a punta” |
| Innovación | Que aporte algo distinto | Mérito justo, promoción, SIAGIE interno | “Reglas, no pantallas” |
| Calidad técnica | Buenas prácticas | Validación, errores, paginación | “Simple y defendible” |
| Seguridad y privacidad | Protección de datos | JWT, roles, ownership, auditoría | “Confianza cero en el frontend” |
| Pruebas | Evidencia de verificación | Smoke 12, integridad 36, E2E 102 | “No solo ‘funciona en mi máquina’” |
| Documentación | Trazabilidad | `documentacion/01–23` | “Cada decisión está escrita” |
| Impacto y sostenibilidad | Valor para el colegio | Ahorro de tiempo, trazabilidad | “Menos Excel, más control” |
| Exposición | Claridad y seguridad | Guion, demo, Q&A | “Historia + evidencia” |
| Conclusiones y futuro | Autocrítica | Brechas y roadmap | “Sé qué sigue” |
| Bibliografía / referencias | Rigor | Docs oficiales de Angular, PostgreSQL, OWASP, MINEDU | “No inventé las reglas” |
| Recomendaciones | Visión | Dominio, MFA, CI/CD, SIAGIE oficial | “Esto es lo siguiente” |

### 7.1. Evidencia que puedes abrir en segundos

| Si preguntan por… | Abre… |
|---|---|
| Arquitectura | `documentacion/02-ARQUITECTURA-Y-PATRONES.md` |
| Base de datos | `documentacion/04-BASE-DE-DATOS.md`, `database/siga_uc.sql` |
| Endpoints | `documentacion/05-API-REST.md` |
| Roles | `documentacion/06-USUARIOS-ROLES-Y-PERMISOS.md` |
| Reglas | `documentacion/10-REGLAS-DE-NEGOCIO-Y-VALIDACIONES.md` |
| Seguridad | `documentacion/11-SEGURIDAD-AUDITORIA-E-INTEGRIDAD.md` |
| Despliegue | `documentacion/12-CONFIGURACION-INSTALACION-DESPLIEGUE.md` |
| Multi-año | `documentacion/19-DISENO-MULTIANIO-Y-PROMOCION.md` |
| SIAGIE | `documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md` |
| Flujo de prueba | `documentacion/22-MODULOS-Y-FLUJO-DE-PRUEBA.md` |

### 7.2. Checklist antes de la sustentación

**Una semana antes:**

- [ ] Probar la demo de punta a punta en el mismo entorno que usarás.
- [ ] Congelar datos (no cambiar seed el día anterior).
- [ ] Preparar capturas/video de respaldo.
- [ ] Ensayar 3 veces con cronómetro.
- [ ] Revisar que los usuarios de prueba funcionen.
- [ ] Verificar proyector, resolución y conexión.
- [ ] Ensayar la respuesta a “¿esto es producción?”.

**Un día antes:**

- [ ] Cargar la demo y dejarla “caliente”.
- [ ] Verificar `/api/health`.
- [ ] Abrir pestañas: login, admin, docente, estudiante, tesorería, reportes.
- [ ] Tener a mano credenciales de los 4 roles.
- [ ] Tener el PDF de respaldo.
- [ ] Cargar el celular para el QR.

**Una hora antes:**

- [ ] Probar internet y proyector.
- [ ] Cerrar notificaciones.
- [ ] Silenciar el celular.
- [ ] Abrir el guion en una segunda pantalla, no en la misma.
- [ ] Respirar.

---

## 8. Guion de demo (10–12 minutos)

> **Principio:** no muestres todo. Muestra 5 momentos que cuenten la historia:
> matrícula → notas → asistencia → dinero → control.

### 8.1. Antes de empezar

- Usa datos de demo, nunca reales.
- Si usas Render, ábrelo 2 minutos antes para evitar cold start.
- Ten una pestaña con capturas por si falla internet.
- No digas “esto es fácil”; di “esto es importante”.

### 8.2. Minuto a minuto

| Tiempo | Qué haces | Qué dices |
|---:|---|---|
| 0:00–1:00 | Hook y promesa | “Imaginen marzo…” |
| 1:00–2:00 | Login ADMIN y dashboard | “Una sola fuente de verdad” |
| 2:00–4:00 | Padrón / matrícula | “Cada alumno tiene matrícula anual, no un Excel” |
| 4:00–5:30 | Docente: notas | “Notas por competencia, no un promedio inventado” |
| 5:30–6:30 | Docente: conclusiones | “Texto estructurado, alineado a la nota” |
| 6:30–7:30 | Asistencia QR | “El QR no es adorno: evita planillas” |
| 7:30–9:00 | Tesorería / caja | “Deuda, pagos y caja conciliados” |
| 9:00–10:00 | Reportes / mérito | “Solo alumnos con notas completas” |
| 10:00–11:00 | SIAGIE / auditoría | “Exportación interna con hash; quién cambió qué” |
| 11:00–12:00 | Multi-año / cierre | “El año no es un hardcode; es diseño” |

### 8.3. Flujo exacto (si usas Render)

1. **Login ADMIN** (`74829102` / `UC2026*` en demo).
2. Dashboard: alumnos, docentes, deuda, asistencia.
3. `/admin/alumnos` o `/secretaria/padron`: buscar un alumno por DNI, abrir ficha.
4. **Cerrar sesión** y entrar como DOCENTE (`73000001` o el docente UAT).
5. `/docente/notas`: elegir curso/grado, mostrar notas por competencia.
6. `/docente/conclusiones`: mostrar nivel, avance, dificultad, sugerencia.
7. `/docente/asistencia`: mostrar QR / registro.
8. **Cerrar sesión** y entrar como SECRETARIA.
9. `/secretaria/tesoreria`: padrón paginado, deuda, una consulta.
10. `/secretaria/caja`: pagos, búsqueda por DNI, boleta PDF.
11. **Cerrar sesión** y entrar como ADMIN.
12. `/admin/reportes`: mérito (solo notas completas), alumnos en riesgo, libreta PDF.
13. `/admin/siagie`: exportación interna y verificación de hash.
14. `/admin/auditoria`: últimas acciones.
15. `/admin/anios-lectivos` y `/admin/promociones`: preview, no confirmes si no quieres.
16. Cierre.

### 8.4. Los dos “momentos wow” que debes elegir

**Momento A — Mérito justo:**

> “Antes, un alumno con una sola nota podía salir primero. Ahora el sistema exige nota
> final en los 11 cursos de la carga. Miren: la columna dice 11/11 y el que no tiene todo
> no aparece. Eso es una regla académica, no un adorno.”

**Momento B — Promoción con control:**

> “El sistema no promociona solo. Genera un preview con hash; si los datos cambian, el
> confirm falla con 409. La decisión sigue siendo del humano, pero con evidencia.”

**Momento C — QR:**

> “El alumno muestra su QR; el docente registra; el reporte sale sin planilla.”

**Momento D — Dinero:**

> “Tesorería antes hacía 75 peticiones; ahora una sola consulta paginada. Y cada pago
> impacta pensión, pre-ticket y caja en una transacción.”

### 8.5. Plan de respaldo

- Si falla internet: usa capturas/video locales.
- Si falla Render: usa backend local + frontend local.
- Si falla un usuario: ten otro de respaldo.
- Si falla el QR: muestra la tabla de asistencia.
- Si falla el correo: explica el dominio y muestra el mensaje de error controlado.
- Si te quedas sin tiempo: salta a mérito y cierre.

### 8.6. Frases de transición

- “Ahora que vieron el flujo, les muestro la decisión técnica detrás.”
- “ Esto no es solo una pantalla; por detrás hay una transacción.”
- “Si algo falla, el sistema lo dice; no finge éxito.”
- “Con esto cierro la parte funcional; pasemos a seguridad.”

### 8.7. Cierre de demo (30 segundos)

> “En resumen: SIGA-UC convierte un proceso disperso en un flujo trazable. No prometo que
> sea perfecto; prometo que es honesto. Los datos de menores no están cargados, el SIAGIE
> es interno y el correo necesita un dominio. Lo que sí está: matrícula, notas, asistencia,
> tesorería, reportes, seguridad y auditoría funcionando. La pregunta no es si el colegio
> puede seguir con Excel; es cuánto le cuesta seguir con Excel.”

### 8.8. Estructura de diapositivas (máximo 10)

| # | Diapositiva | Una sola idea | Qué poner |
|---:|---|---|---|
| 1 | Título | “Una sola fuente de verdad” | Nombre, una frase, tu nombre |
| 2 | Problema | “Excel + cuadernos no escalan” | 3 números y 3 dolores |
| 3 | Propuesta | “Matrícula, notas, dinero y control” | 4 pilares, no 20 módulos |
| 4 | Demo | “Esto funciona” | Pantalla o video, no bullets |
| 5 | Arquitectura | “Simple y defendible” | Diagrama de 3 capas |
| 6 | Seguridad | “Confianza cero en el frontend” | 5 controles + 2 brechas |
| 7 | Innovación | “Reglas, no pantallas” | Mérito, promoción, SIAGIE |
| 8 | Evidencia | “No solo funciona en mi máquina” | Tests, métricas, health |
| 9 | Límites y roadmap | “Sé qué falta” | 4 brechas y siguiente fase |
| 10 | Cierre | “Problema → sistema → impacto” | Frase final y gracias |

**Reglas de diseño:**

- Una idea por diapositiva; máximo 6 líneas.
- Sin código en las diapositivas; el código se muestra en la demo si preguntan.
- Números grandes, texto pequeño.
- Gráfico o diagrama antes que párrafo.
- No leas la diapositiva; úsala como apoyo.

---

## 9. Correo de recuperación: estado, alternativas y decisión

### 9.1. Estado real (dilo con transparencia)

- El código usa **Resend** (API HTTP), no SMTP.
- Render ya tiene `RESEND_API_KEY` y `EMAIL_FROM`.
- El envío al **dueño de la cuenta Resend** está verificado: el correo llega y el enlace
  apunta a `https://siga-uc-web.onrender.com/reset-password?token=...`.
- La cuenta **no tiene un dominio verificado**. Por eso `onboarding@resend.dev` solo
  entrega al dueño; para alumnos/docentes falta un dominio.
- Si el envío falla, la API responde `{ tieneCorreo: true, enviado: false }` y la UI pide
  contactar al administrador. **No hay falso éxito.**
- Existe un fallback: **ADMIN puede restablecer la contraseña** por DNI
  (`PUT /api/auth/reset-password`), previa verificación de identidad.

### 9.2. Por qué Resend exige un dominio

Para enviar a cualquier destinatario, Resend pide verificar un dominio con registros DNS
(SPF, DKIM y, opcionalmente, DMARC). Eso evita suplantación y mejora la entrega. No es un
capricho del código: es una regla del proveedor.

### 9.3. Alternativas (comparación)

| Alternativa | Cómo funciona | Costo | Tiempo | Entrega | ¿Recomendada? |
|---|---|---|---|---|---|
| **Dominio propio + Resend** | Comprar/verificar dominio; SPF/DKIM/DMARC | Dominio ~S/ 40–70/año | 1–2 h | Alta | **Sí, producción** |
| **Dominio del colegio** | Subdominio `sistema.colegio.edu.pe` | S/ 0 | Depende de DNS | Alta | **Sí, si el colegio lo tiene** |
| Resend test sender | `onboarding@resend.dev` | S/ 0 | 0 | Solo dueño | Solo demo |
| SendGrid | API; dominio autenticado | Free tier | 1–2 h | Alta | Alternativa |
| Mailgun | API; dominio | Free trial | 1–2 h | Alta | Alternativa |
| Amazon SES | API; sandbox → producción | Muy bajo | 1–2 días | Alta | Escala |
| Brevo | API/SMTP; dominio | Free tier | 1–2 h | Alta | Alternativa |
| Postmark | API; enfoque transaccional | Pagado | 1 h | Muy alta | Si hay presupuesto |
| Gmail SMTP + app password | SMTP con cuenta Gmail | S/ 0 | 30 min | Baja/riesgosa | **No** |
| Reset por ADMIN | Presencial, valida identidad | S/ 0 | Inmediato | N/A | **Fallback** |
| SMS/WhatsApp OTP | Twilio/Meta | Por mensaje | Días | Alta | Futuro |
| Preguntas secretas | Conocimiento | S/ 0 | 0 | Baja | **No** |

### 9.4. Recomendación

**Para la demo:**

1. Mantén `onboarding@resend.dev`.
2. Si el jurado pide ver el correo, envíalo al correo dueño de la cuenta (el tuyo).
3. Si el jurado pregunta por un alumno, explica el dominio y muestra el mensaje controlado.
4. Ten a mano el reset por ADMIN como fallback.

**Para producción:**

1. Verifica un dominio (del colegio o uno comprado).
2. Configura `EMAIL_FROM=SIGA-UC <no-reply@tudominio.com>`.
3. Agrega SPF/DKIM/DMARC.
4. Redeploy y prueba con 3 usuarios reales (alumno, docente, secretaría).
5. Monitorea logs de Resend y rebotes.

### 9.5. Checklist de implementación del dominio

- [ ] Elegir dominio/subdominio.
- [ ] Acceder al DNS (Cloudflare, Namecheap, GoDaddy, etc.).
- [ ] Agregar dominio en Resend.
- [ ] Copiar registros MX/TXT/SPF/DKIM.
- [ ] Esperar verificación (minutos a horas).
- [ ] Configurar `EMAIL_FROM` en Render.
- [ ] Redeploy.
- [ ] Probar recuperación con un alumno real.
- [ ] Revisar spam y logs.
- [ ] Documentar en `documentacion/12`.

### 9.6. Guion para el jurado

> “El correo es el único punto que depende de un dominio. Resend exige verificar un dominio
> para enviar a cualquier usuario; el remitente de pruebas solo llega al dueño. El código ya
> está listo: si el envío falla, la API responde `enviado:false` y la UI pide contactar al
> administrador. Para producción, el colegio debe verificar su dominio; es un trámite de
> DNS, no un cambio de arquitectura. Mientras tanto, el ADMIN puede resetear la clave
> validando identidad.”

### 9.7. Si preguntan “¿por qué no usas Gmail?”

> “Gmail SMTP tiene límites, puede bloquear puertos en Render, expone la cuenta y no da
> trazabilidad de entrega. Para un colegio, un dominio propio con SPF/DKIM es más serio y
> sostenible.”

### 9.8. Si preguntan “¿por qué no WhatsApp?”

> “WhatsApp es excelente para notificar, pero para recuperación requiere API de negocio,
> costo por mensaje y datos de teléfono verificados. Es una fase posterior; el correo con
> dominio es más simple y ya está integrado.”

### 9.9. Buenas prácticas de correo (aunque no las implementes todas)

- Respuesta genérica para no revelar si el usuario existe.
- Token hasheado en BD, no en texto plano.
- Un solo uso y expiración corta.
- No poner el token en logs.
- Enlace HTTPS.
- SPF/DKIM/DMARC.
- Monitorear rebotes y quejas.

---

## 10. Preguntas del jurado (Q&A)

> **Técnica:** responde 2–4 frases, da una evidencia y detente. Si no sabes, di “no lo medí;
> lo estimaría así” o “no está implementado; lo haría en esta fase”. No inventes.

### 10.1. Problema y alcance

**1. ¿Cuál es el problema exacto que resuelve?**
> La dispersión de matrícula, notas, asistencia y tesorería en Excel/cuadernos. SIGA-UC
> centraliza esos flujos con roles y auditoría. En la demo: 75 alumnos, 750 pensiones y
> 3,300 notas.

**2. ¿Por qué un colegio pagaría por esto?**
> Porque reduce tiempo operativo, errores y pérdida de información. Secretaría deja de
> buscar en Excel; dirección tiene reportes en minutos; tesorería concilia pagos. El valor
> es ahorro de horas y trazabilidad, no solo “tener un sistema”.

**3. ¿Esto reemplaza al personal?**
> No. Reemplaza tareas repetitivas y hojas de cálculo; el personal sigue validando,
> decidiendo y atendiendo. El sistema ordena el trabajo, no lo elimina.

**4. ¿Qué pasa con colegios con más de 75 alumnos?**
> La arquitectura es stateless y paginada; el límite no es 75. Para más escala habría que
> medir con pruebas de carga, ajustar índices y plan de Render. 75 es el tamaño de la demo,
> no el límite técnico.

**5. ¿Por qué no hiciste una app móvil?**
> Porque la web responsive cubre el caso y el QR funciona en el navegador. Una app nativa
> añade tiendas, versiones y mantenimiento; para notificaciones push intensivas sí se
> evaluaría.

### 10.2. Tecnologías

**6. ¿Por qué Angular y no React?**
> Angular ya trae router, forms, guards, interceptor y DI; para un sistema por roles eso
> reduce decisiones. React habría exigido elegir y integrar varias librerías. No es que
> React sea peor; es que Angular se ajusta mejor a este equipo y plazo.

**7. ¿Por qué Express y no NestJS?**
> Express 5 es suficiente para 18 routers y una estructura MVC clara. NestJS añade módulos
> y DI que se justifican en equipos grandes, pero aquí serían ceremonia extra.

**8. ¿Por qué PostgreSQL y no MongoDB?**
> Los datos son relacionales: alumno, matrícula, curso, nota, pago, pensión. Necesito joins,
> transacciones y constraints. MongoDB habría trasladado esa integridad al código.

**9. ¿Por qué SQL crudo y no un ORM?**
> Porque los reportes usan CTEs, window functions, `FILTER` y `FOR UPDATE`. El ORM añade
> fricción y puede ocultar el plan. La capa DAO aísla el SQL y lo hace mantenible. El costo
> es más disciplina y mapeo manual.

**10. ¿No es más lento escribir SQL a mano?**
> Para un CRUD simple, sí. Para reportes y transacciones, no: escribo exactamente lo que
> necesito y controlo el rendimiento. Además, el SQL está en un solo lugar (DAO).

**11. ¿Por qué no usaste Docker?**
> Porque Render ejecuta el servicio directamente y la demo no necesita orquestación. Docker
> sería útil para CI/CD multi-entorno y reproducibilidad; está en el roadmap.

**12. ¿Por qué no microservicios?**
> Porque hay un solo dominio, un solo equipo y un solo despliegue. Microservicios añadirían
> red, contratos, observabilidad y complejidad operativa sin beneficio claro. Si el sistema
> crece, se puede separar tesorería o reportes.

**13. ¿Por qué no Firebase?**
> Firebase es cómodo para prototipos, pero el modelo relacional y los reportes multi-año
> exigen SQL. Además, hay dependencia del proveedor y costos variables.

**14. ¿Por qué no Auth0?**
> Porque los roles son institucionales y simples; JWT + bcrypt cubren el caso. Auth0 sería
> útil para MFA/SSO, pero añade costo y dependencia. Es una mejora futura.

**15. ¿Por qué no usaste IA?**
> Porque las reglas actuales son deterministas: notas, pagos, promoción. IA podría ayudar
> después con predicción de riesgo o detección de anomalías, pero no es necesaria para el
> núcleo.

**15.1. ¿Por qué el backend está en JavaScript y no en TypeScript?**
> Por simplicidad y compatibilidad con el ecosistema CommonJS; el frontend sí es TypeScript.
> Migrar el backend a TS es posible y sería una mejora de mantenimiento, pero no era
> prioridad frente a los flujos y la seguridad.

**15.2. ¿Por qué Bootstrap y no Tailwind?**
> Bootstrap trae componentes y utilidades listos; Tailwind exige más decisiones de diseño y
> markup. Para un proyecto con tiempo acotado, Bootstrap fue pragmático. No es una decisión
> religiosa; se puede cambiar la capa visual sin tocar la lógica.

**15.3. ¿Por qué REST y no GraphQL?**
> Los recursos y reportes se mapean bien a endpoints REST; GraphQL añadiría esquema,
> resolvers y caching. Para este dominio, REST es suficiente y más fácil de cachear/auditar.

**15.4. ¿Por qué no hay tests unitarios?**
> Hay suites de integración, E2E, smoke y UAT; los tests unitarios son una mejora pendiente.
> No digo que no hagan falta: ayudan a aislar services, pero el esfuerzo se priorizó en
> flujos completos y reglas de negocio.

**15.5. ¿Por qué no usaste WebSockets?**
> No hay colaboración en tiempo real; las notificaciones se consultan. WebSockets sería útil
> para alertas instantáneas o tableros en vivo, no para el núcleo actual.

### 10.3. Arquitectura y base de datos

**16. ¿Cómo se estructura el backend?**
> `routes → controllers → services → DAOs → PostgreSQL`. Las rutas validan y autorizan; los
> controllers traducen HTTP; los services aplican reglas; los DAOs ejecutan SQL parametrizado.

**17. ¿Cómo evitas que un controller tenga SQL?**
> Por convención y revisión: el controller solo llama al service; el SQL vive en el DAO.
> Eso permite cambiar la consulta sin tocar la API y probar por capas.

**18. ¿Cómo manejas transacciones?**
> `getClient()`, `BEGIN`, `COMMIT`, `ROLLBACK`. Ejemplos: matrícula, pago, caja, promoción,
> asistencia masiva y calificaciones masivas. Si algo falla, no queda a medias.

**19. ¿Cómo manejas concurrencia?**
> Con transacciones, `FOR UPDATE` y constraints. Ejemplo: al registrar un pago se bloquea
> la pensión/pre-ticket; al matricular se bloquea el correlativo. No es perfecto en todos
> los flujos, pero los críticos están cubiertos.

**20. ¿Qué pasa si dos usuarios pagan la misma pensión?**
> La transacción y el `FOR UPDATE` serializan el acceso; la segunda operación ve el estado
> actualizado. Además, los estados y constraints evitan inconsistencias. Es un caso que
> conviene probar con carga.

**21. ¿Cómo modelaste el multi-año?**
> `usuarios` es identidad; `alumnos` es matrícula anual única por DNI/año. `anios_lectivos`
> tiene un solo activo. Los históricos usan `?anio=`. El rollover clona estructura, no
> alumnos ni pagos.

**22. ¿Por qué `alumnos` no es único por DNI?**
> Porque un alumno puede repetir o tener otra matrícula en otro año. La identidad es
> `usuarios`; la matrícula es anual. Esa distinción evita mezclar historiales.

**23. ¿Cómo se calcula la nota final?**
> Por predominancia AD > A > B > C, por curso/bimestre. Se persiste en
> `notas_finales_area`; los reportes y el SIAGIE usan esa tabla. La UI no inventa un
> promedio: si falta la nota final, el reporte sale vacío y se advierte. Es una brecha
> conocida mejorar el cálculo automático desde competencias.

**24. ¿Qué pasa si falta un acta?**
> La promoción queda PENDIENTE con bloqueo; el acta cerrada bloquea la edición de notas.
> La política define qué actas/notas se exigen. No se confirma un lote con PENDIENTE.

**25. ¿Cómo funciona el cuadro de mérito?**
> Solo alumnos `Matriculado` con nota final en todos los cursos de la carga del grado.
> Puntaje AD=4, A=3, B=2, C=1; promedio; desempate por AD y cursos. Un alumno con una sola
> nota no entra.

**26. ¿Por qué no incluyes alumnos con notas parciales?**
> Porque comparar promedios de poblaciones distintas es injusto. El ranking debe comparar
> a todos con las mismas condiciones. La UI explica la regla.

**27. ¿Cómo funciona la promoción?**
> Preview de solo lectura con `preview_hash`; el confirm recalcula el hash dentro de la
> transacción. Si cambió, 409. La política define reglas; el humano confirma. La reversión
> solo procede si el destino no tiene actividad.

**28. ¿La promoción activa el año?**
> No. Es una decisión separada. Activar 2027 sin promoción dejaría alumnos sin matrícula;
> por eso el flujo está separado y documentado.

**29. ¿Cómo se maneja el retiro?**
> Transacción: matrícula `Retirado`, expediente congelado, pensiones/pre-tickets futuros
> anulados. El usuario queda inactivo solo si no tiene otra matrícula vigente. Es un flujo
> con muchas reglas y por eso está documentado.

**30. ¿Cuántas tablas tiene?**
> 48 tablas base; 49 en local por una tabla de backup de horarios. Están agrupadas por
> identidad, académico, matrícula, calificaciones, asistencia, tesorería, caja, reportes,
> configuración y auditoría.

### 10.4. Seguridad y privacidad

**31. ¿Cómo proteges los datos de los alumnos?**
> Roles y ownership en la API, contraseñas hasheadas, JWT, HTTPS, CORS, rate limiting,
> auditoría y datos de demo ficticios. Los datos reales de menores no están cargados.
> También conozco las brechas: token en localStorage, falta MFA y dominio de correo.

**32. ¿Un alumno puede ver las notas de otro?**
> No debería: `checkAlumnoPropio` valida que el `id_alumno` sea suyo; si no, 403. La UI
> oculta, pero la API es la que manda. Es una prueba que puedo mostrar.

**33. ¿Un docente puede cambiar notas de un curso que no tiene?**
> No: `checkCursoDocente` valida `carga_curricular`; si no está asignado, 403. Además, la
> bitácora registra el cambio.

**34. ¿Cómo evitas SQL injection?**
> SQL parametrizado en todos los DAOs; nunca se concatenan valores. Los validadores revisan
> tipos y longitudes. Es una defensa en capas.

**35. ¿Dónde guardas el token?**
> En `localStorage`. Es simple, pero vulnerable a XSS. La mejora es cookie HttpOnly +
> SameSite + CSP. No lo oculto: es una brecha conocida con plan.

**36. ¿Tienes MFA?**
> No. Para ADMIN/SECRETARÍA sería la siguiente fase (TOTP). Hoy hay rate limiting, cambio
> obligatorio y roles.

**37. ¿Cómo proteges la recuperación de contraseña?**
> Token de 64 hex, 2 h, un uso, invalida anteriores, rate limit y enlace HTTPS. Limitación:
> el token se guarda en texto plano y viaja en la URL; la mejora es hashearlo y usar POST.

**38. ¿Qué pasa si se filtra la base?**
> Las contraseñas están hasheadas con bcrypt; los tokens de recuperación son el punto débil.
> Con acceso a la BD, un atacante podría usar tokens activos. Por eso la mejora es hashear
> tokens y acortar su vida. No es un riesgo de datos académicos directos, pero sí de cuentas.

**39. ¿Cumples la Ley de Protección de Datos?**
> El sistema tiene controles técnicos, pero el cumplimiento legal es del colegio: base legal,
> consentimiento de apoderados, retención y acceso. Es un tema que debe validar su asesoría.
> No cargamos datos reales de menores en la demo.

**40. ¿Cómo auditas los cambios?**
> Bitácora y triggers: login, calificaciones, pagos, matrícula, configuración y descargas.
> No auditamos cada lectura; sería ruido. La bitácora permite reconstruir quién cambió qué.

**41. ¿Qué pasa si un usuario es cesado?**
> El middleware revalida el estado en cada request; un usuario `INACTIVO` no sigue usando el
> token. Antes no se revalidaba; ahora sí. Es una mejora de seguridad.

**42. ¿Cómo manejas secretos?**
> Variables de entorno en Render; `.env` no se versiona. `env.js` aborta en producción si
> falta `JWT_SECRET` o es débil. Nunca se imprimen contraseñas/tokens.

### 10.5. Funcionalidad y negocio

**43. ¿Qué pasa si un alumno no tiene matrícula activa?**
> Puede iniciar sesión con `matricula_activa=false`; los endpoints académicos propios
> responden 403 `SIN_MATRICULA_ACTIVA`. La UI muestra “Sin matrícula {año}”.

**44. ¿Cómo se genera una pensión?**
> Por alumno, año y mes, con monto base, descuento y estado. El pago impacta pensión,
> pre-ticket y caja en una transacción. Las becas pueden dejar el cargo `EXONERADO`.

**45. ¿Cómo se anula un pago?**
> Transacción con motivo, estado `ANULADO`, reversión de pensión/pre-ticket y auditoría. No
> se borra el pago: se anula para conservar la historia.

**45.1. ¿La matriz de pensiones es configurable?**
> Hoy la tabla muestra 12 meses y las tarifas por nivel/grado ya son configurables. El
> calendario flexible (mensualidades, fechas, exoneraciones por mes) es la siguiente fase.
> No lo presento como terminado.

**45.2. ¿Cómo se calcula la nota final si la UI no la calcula sola?**
> Se persiste por curso/bimestre con predominancia AD>A>B>C; los reportes usan
> `notas_finales_area`. La UI no inventa un promedio. La mejora pendiente es derivarla
> automáticamente desde las competencias y dejar trazabilidad del cálculo.


> Apertura, movimientos, cierre; separa efectivo y digital. Un pago se imputa a la última
> apertura. Limitación conocida: si no hay caja abierta, el trigger imputa a la última; una
> mejora es exigir caja abierta o selección explícita.

**47. ¿Cómo se generan las boletas/libretas?**
> PDFKit en el backend, con datos de la institución, alumno, notas y conclusiones. La
> libreta sale por bimestre; la boleta de pago por operación.

**48. ¿Qué es el SIAGIE interno?**
> Un Excel con todos los cursos de la carga, notas finales y conclusión descriptiva, más
> código de control y hash. No es la carga oficial a MINEDU; es una exportación interna
> verificable.

**49. ¿Por qué no cargas directo a SIAGIE?**
> Porque requiere plantilla oficial, credenciales y validación de MINEDU. Prometer eso sin
> integración sería incorrecto. El sistema prepara los datos; la carga oficial es un paso
> aparte.

**50. ¿Cómo se manejan las becas?**
> Catálogo con alcance, modalidad, tope, exclusividad, prioridad y aprobación. Se aplican a
> cargos pendientes; los pagados no se reprecian. Al anular, se revierten las aplicaciones.

**51. ¿Qué reportes tiene?**
> Dashboard, mérito, alumnos en riesgo, resumen de asistencia, libreta, auditoría de docentes,
> consolidado histórico y exportación SIAGIE.

**52. ¿Cómo se busca un alumno?**
> Por DNI, nombre o código. En tesorería/caja hay búsqueda server-side y paginación; en notas
> y conclusiones hay búsqueda local.

### 10.6. Pruebas y calidad

**53. ¿Cómo probaste el sistema?**
> Suites propias: smoke 12, integridad 36, E2E 102, setup 5, UAT 22 y build Angular. Además,
> pruebas manuales por rol. No hay CI todavía; es una mejora.

**54. ¿Qué es una prueba de integridad?**
> Verifica invariantes de datos: matrícula anual, pagos/pensiones, actas, notas, promociones,
> etc. No es solo “la pantalla carga”.

**55. ¿Qué es el E2E?**
> Un flujo completo en una base desechable: login, matrícula, notas, asistencia, tesorería,
> reportes, promoción. 102 comprobaciones.

**56. ¿Qué pasa si cambias una regla?**
> Se actualiza el test y la documentación. Las suites detectan regresiones; el código es la
> fuente de verdad.

**57. ¿Por qué no hay CI?**
> Por tiempo/alcance. El siguiente paso es GitHub Actions: lint, build, suites y deploy. Hoy
> las suites se ejecutan manualmente.

### 10.7. Despliegue, costo y escala

**58. ¿Dónde está desplegado?**
> Backend en Render, frontend en Render Static Site, PostgreSQL en Supabase. HTTPS y health
> check. En demo.

**59. ¿Cuánto cuesta?**
> En demo, planes gratuitos; el único costo real sería el dominio (~S/ 40–70/año). En
> producción, Render/Supabase pagos según usuarios y backups. No es un costo alto para un
> colegio.

**60. ¿Qué pasa si Render se cae?**
> El health check y el reintento de cold start ayudan, pero no hay alta disponibilidad. Para
> producción: plan pago, backups, monitoreo y quizá otra región. Es una limitación honesta.

**61. ¿Soporta 1,000 alumnos?**
> La arquitectura no está limitada a 75; hay paginación e índices. No hice prueba de carga
> formal. Para 1,000 habría que medir, ajustar pool/índices y plan de infraestructura.

**62. ¿Cómo escalas?**
> API stateless, pool de conexiones, paginación, índices; luego caché para catálogos, colas
> para correos/reportes y réplica de lectura. No necesitas microservicios para empezar.

### 10.8. Limitaciones y ética

**63. ¿Qué no está terminado?**
> Dominio de correo, MFA, cookies HttpOnly, CI/CD, backups automáticos, SIAGIE oficial y
> pruebas de carga. Están documentados y priorizados.

**64. ¿Por qué deberían aprobarlo si faltan cosas?**
> Porque el núcleo funciona, está probado y resuelve el problema. Un proyecto serio no es el
> que no tiene brechas, sino el que las conoce y tiene plan. Además, la demo no usa datos
> reales de menores.

**65. ¿Qué harías con más tiempo?**
> 1) Dominio y correo; 2) MFA y cookies HttpOnly; 3) CI/CD y backups; 4) cálculo automático
> de nota final; 5) SIAGIE oficial; 6) pruebas de carga y accesibilidad.

**66. ¿Qué riesgo ético ves?**
> Usar datos de menores sin consentimiento o exponerlos. Por eso la demo es ficticia y el
> acceso es por rol. En producción, el colegio debe definir base legal, retención y
> consentimiento.

### 10.9. Preguntas trampa

**67. “¿Esto ya está en producción?”**
> No. Es una demo funcional con datos ficticios. Producción real requiere dominio, backups,
> MFA, datos reales autorizados y validación del colegio.

**68. “¿Es SIAGIE oficial?”**
> No. Es una exportación interna con hash; no reemplaza la carga oficial a MINEDU.

**69. “¿Es 100% seguro?”**
> No existe 100%. Tiene controles proporcionales y brechas conocidas con plan. No vendo
> humo.

**70. “¿Por qué el correo no llega a todos?”**
> Porque Resend exige un dominio verificado; el remitente de prueba solo llega al dueño. El
> código ya reporta el fallo y el ADMIN puede resetear. Es configuración, no arquitectura.

**71. “¿Por qué no usaste la última tecnología X?”**
> Porque la tecnología debe ajustarse al problema, al equipo y al plazo. Elegí un stack
> estable y defendible; cambiar por moda habría añadido riesgo sin beneficio.

**72. “¿Quién es el autor del código?”**
> Yo, con asistencia de herramientas de IA para revisión y documentación. Las decisiones y
> la validación son mías; el código está en GitHub con historial.

**73. “¿Cómo sé que no copiaste?”**
> Porque puedo explicar cada capa, cada regla y cada decisión; el historial de commits y la
> documentación muestran la evolución. Si quieren, abrimos cualquier archivo.

**74. “¿Qué pasa si el colegio quiere cambiar de proveedor?”**
> La API y la base son estándar; el frontend consume REST. Migrar Render/Supabase no cambia
> el dominio. El correo sí requiere cambiar configuración, no código.

**75. “¿Por qué deberíamos elegir tu sistema y no un software comercial?”**
> Porque está hecho para el proceso del colegio, es adaptable y no cobra licencia por alumno.
> Un comercial puede ser más completo, pero también más caro y rígido. La decisión es del
> colegio; yo muestro una alternativa viable.

### 10.10. Preguntas específicas del dominio

**76. ¿Cómo evitas que un docente cargue notas en el curso equivocado?**
> El selector usa `id_carga`, no `id_curso`. Un curso se repite en varios grados; con
> `id_curso` el sistema cargaba el primer grado y ocultaba al alumno de otra sección. Se
> corrigió y se probó con un curso repetido en 1ro–4to.

**77. ¿La asistencia tiene año lectivo?**
> No tiene columna `anio_lectivo`; el año se deriva de `fecha`. Es una decisión para no
> duplicar la dimensión. Para reportes históricos se filtra por rango de fechas.

**78. ¿Qué pasa si cambia el plan de estudios?**
> La `carga_curricular` y la configuración académica son por año. Un cambio de plan se
> refleja en la carga del año nuevo; las notas históricas conservan su curso/competencia.

**79. ¿Cómo se manejan los cursos que se repiten en varios grados?**
> Cada combinación grado/curso/docente/año es una `carga_curricular` distinta. Por eso las
> pantallas del docente usan `id_carga`; `id_curso` no alcanza para identificar la sección.

**80. ¿Qué pasa si se duplica un QR?**
> El QR identifica al alumno; el registro valida alumno/curso/grado/fecha. La validación
> revisa el registro por alumno/curso/fecha, pero no hay una constraint única explícita:
> es una mejora pendiente para blindar el caso a nivel de base de datos.

**81. ¿Cómo se maneja un cambio de año con alumnos que repiten?**
> `alumnos` es matrícula anual: el mismo `usuario` puede tener otra fila en el año nuevo.
> La promoción decide PROMOVIDO/REPITENTE/EGRESADO/RETIRADO; no se reutiliza la matrícula
> del año anterior.

**82. ¿Cómo se consultan datos históricos?**
> Con `?anio=YYYY` en los endpoints y el selector de año. El sistema no suma notas/pagos
> entre años; el consolidado agrupa por año. La UI marca “Histórico” y bloquea escrituras.

**83. ¿Qué pasa con los datos del apoderado?**
> Se guardan para contacto y matrícula; el acceso sigue roles/ownership. En producción se
> debe definir consentimiento y retención. No se exponen en la UI del estudiante.

**84. ¿Qué pasa si la caja está cerrada y entra un pago?**
> El trigger imputa el pago a la última apertura, aunque esté cerrada. Es una limitación
> conocida; la mejora es exigir caja abierta o selección explícita. Lo digo antes de que lo
> pregunte el jurado.

**85. ¿Cómo se evita que un acta cerrada se modifique?**
> El cierre de acta bloquea la edición de notas; una acta global `CERRADO` bloquea todos los
> grados. Reabrir exige motivo y queda auditado. Es una regla de integridad académica.

**86. ¿Qué pasa si un alumno se retira?**
> Transacción: matrícula `Retirado`, expediente congelado, pensiones/pre-tickets futuros
> anulados y usuario inactivo solo si no tiene otra matrícula vigente. No se borra la
> historia.

**87. ¿Qué pasa si un alumno no tiene correo?**
> La recuperación responde `tieneCorreo:false` y la UI pide contactar al administrador; el
> ADMIN puede resetear tras validar identidad. No se inventa un correo.

**88. ¿Cómo se controla el cupo de un grado?**
> La matrícula valida grado/año y el código correlativo; el cupo explícito por sección es
> una mejora futura. Hoy el control es operativo, no un límite duro configurable.

---

## 11. Frases que suman y frases que restan

| Suma | Resta |
|---|---|
| “La demo es ficticia; producción requiere X.” | “Ya está listo para producción.” |
| “Elegí X por Y; el costo es Z.” | “X es lo mejor.” |
| “Esta brecha la conozco y la mitigo así.” | “No hay riesgos.” |
| “El sistema recomienda; el humano decide.” | “El sistema decide solo.” |
| “Los datos de menores no están cargados.” | “Tenemos datos de alumnos.” |
| “Es SIAGIE interno, no oficial.” | “Exporta a SIAGIE.” |
| “El correo necesita un dominio.” | “El correo funciona para todos.” |
| “No hice prueba de carga.” | “Soporta cualquier cantidad.” |
| “La UI oculta, la API manda.” | “La seguridad está en el frontend.” |
| “No lo medí; lo estimaría.” | Inventar una métrica. |

### 11.1. Manejo de interrupciones

| Situación | Qué hacer | Frase |
|---|---|---|
| El jurado interrumpe con una pregunta | Responde en 2 frases y ofrece profundizar | “Buena pregunta; la respondo breve y luego vuelvo al flujo.” |
| No sabes la respuesta | Reconoce y da un plan | “No lo medí; lo estimaría así…” |
| La demo falla | No entres en pánico; usa respaldo | “El sistema ya reporta el fallo; tengo una captura.” |
| Se acaba el tiempo | Salta a mérito y cierre | “Con esto llego al punto central.” |
| Pregunta hostil | No defiendas con emoción; usa evidencia | “Entiendo la preocupación; el control es este.” |
| Te piden código | Abre el archivo y explica la capa | “Esto está en el DAO; el controller no tiene SQL.” |
| Te comparan con un comercial | Reconoce y diferencia | “Ellos tienen más años; esto está hecho para este proceso.” |

---

## 12. Cierre memorable

### 12.1. Guion de 30 segundos

> “SIGA-UC no es un conjunto de pantallas: es una forma de que un colegio deje de depender
> de Excel y cuadernos. Con matrícula anual, notas por competencias, asistencia QR,
> tesorería, reportes y auditoría, el colegio gana tiempo y control. La demo está funcional,
> los límites están documentados y el siguiente paso es claro. Gracias.”

### 12.2. Última diapositiva

```text
SIGA-UC
Una sola fuente de verdad para el colegio.

Problema → Sistema → Evidencia → Límites → Siguiente paso
```

### 12.3. Llamada a la acción

> “Lo que les pido no es que aprueben una idea: es que evalúen si esta solución, con sus
> límites, merece pasar a una siguiente fase con el colegio.”

---

## 13. Anexos

### A. Glosario para el jurado

| Término | Significado |
|---|---|
| API REST | Interfaz HTTP para comunicar frontend y backend |
| JWT | Token firmado que identifica al usuario |
| bcrypt | Algoritmo de hash lento para contraseñas |
| DAO | Objeto que encapsula el acceso a datos |
| MVC | Separación modelo/vista/controlador |
| ACID | Atomicidad, consistencia, aislamiento, durabilidad |
| RBAC | Control de acceso basado en roles |
| Ownership | Validación de que el usuario sea dueño del recurso |
| CTE | Consulta temporal con `WITH` |
| `FOR UPDATE` | Bloqueo de fila en una transacción |
| Hash | Huella digital de un archivo/datos |
| SPF/DKIM/DMARC | Registros DNS que autentican correo |
| SIAGIE | Sistema de MINEDU para información educativa |
| CNEB | Currículo Nacional de la Educación Básica |
| Cold start | Arranque lento de un servicio gratuito |
| Rollover | Clonar estructura de un año al siguiente |
| Preview hash | Huella que detecta cambios antes de confirmar |

### B. Números de la demo (para citar)

| Dato | Valor |
|---|---:|
| Alumnos | 75 (15 por grado) |
| Docentes activos | 6 |
| Carga curricular | 55 |
| Horarios publicados | 145 |
| Pensiones | 750 |
| Pagos | 113 Render / 432 local v2 |
| Notas finales | 3,300 |
| Calificaciones | 8,700 |
| Asistencias | 4,125 |
| Becas | 3 |
| Conclusiones | 3,300 |
| Tablas base | 48 |
| Endpoints | 169 |

> **No uses todos:** elige 3 según la historia.

### C. Cheat sheet de una página

```text
SIGA-UC
- Angular 21 + signals + Bootstrap
- Express 5 + Node 20
- PostgreSQL 18 + SQL crudo parametrizado
- MVC + DAO, transacciones, JWT/bcrypt, roles/ownership
- Render + Supabase
- 48 tablas, 169 endpoints, 4 roles
- 75 alumnos demo, 750 pensiones, 3,300 notas
- Innovación: mérito justo, promoción con hash, SIAGIE interno, becas, QR
- Seguridad: Helmet, CORS, rate limit, auditoría; brechas: localStorage, MFA, dominio
- Correo: Resend; falta dominio verificado; ADMIN reset como fallback
- Frase: “No es un CRUD; es una sola fuente de verdad con reglas y trazabilidad.”
```

### D. Versiones del pitch

**30 s:** ver 2.5.

**1 min:**

> “SIGA-UC integra matrícula, notas por competencias, asistencia QR, tesorería, caja,
> reportes y auditoría para un colegio. Reemplaza Excel y cuadernos por una sola fuente de
> verdad con roles y trazabilidad. Está hecho con Angular, Express y PostgreSQL, y ya
> funciona en una demo con 75 alumnos. La diferencia es que las reglas están en el sistema:
> mérito solo con notas completas, promoción con confirmación humana y pagos auditados.”

**3 min:** usa 1 min + un ejemplo de mérito + un ejemplo de promoción + cierre.

### E. Solución de problemas en demo

| Síntoma | Causa probable | Solución |
|---|---|---|
| Pantalla en blanco | Ruta SPA sin `404.html` | Revisar build/postbuild |
| 401 | Token expirado | Volver a login |
| 403 | Rol/ownership | Usar usuario correcto; es esperado |
| 503 | Backend arrancando | Esperar o usar local |
| Cold start | Render free | Abrir 2 min antes |
| Sin datos | Año incorrecto | Cambiar selector de año |
| Correo no llega | Sin dominio | Explicar limitación; admin reset |
| PDF no descarga | Bloqueo del navegador | Permitir descargas |
| QR no lee | Cámara/resolución | Usar código manual o tabla |

### F. Diagrama de arquitectura (para diapositiva)

```text
┌─────────────────────────────┐
│ Angular 21 (SPA)            │
│ signals · guards · intercept│
└──────────────┬──────────────┘
               │ HTTPS/JWT
┌──────────────▼──────────────┐
│ Express 5                   │
│ Helmet · CORS · rate limit  │
│ auth · roles · ownership    │
│ routes → controllers        │
│        → services → DAOs    │
└──────────────┬──────────────┘
               │ SQL parametrizado
┌──────────────▼──────────────┐
│ PostgreSQL 18               │
│ constraints · triggers      │
│ transactions · indexes      │
└─────────────────────────────┘
```

### G. Grupos de la base de datos (para diapositiva)

```text
Identidad: usuarios, roles, personal, apoderados
Académico: grados, cursos, competencias, carga, horarios
Matrícula: alumnos, anios_lectivos, promociones
Notas: calificaciones, notas_finales_area, actas, conclusiones
Asistencia: asistencia_alumnos, asistencia_personal
Dinero: pensiones, pagos, pre_tickets, conceptos, becas, caja
Salidas: libretas, exportaciones_siagie
Control: configuración, bitacora_auditoria, recuperacion_password
```

### H. Documentos de referencia

- `documentacion/01-VISION-GENERAL-Y-ALCANCE.md`
- `documentacion/02-ARQUITECTURA-Y-PATRONES.md`
- `documentacion/04-BASE-DE-DATOS.md`
- `documentacion/05-API-REST.md`
- `documentacion/06-USUARIOS-ROLES-Y-PERMISOS.md`
- `documentacion/10-REGLAS-DE-NEGOCIO-Y-VALIDACIONES.md`
- `documentacion/11-SEGURIDAD-AUDITORIA-E-INTEGRIDAD.md`
- `documentacion/12-CONFIGURACION-INSTALACION-DESPLIEGUE.md`
- `documentacion/19-DISENO-MULTIANIO-Y-PROMOCION.md`
- `documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md`
- `documentacion/22-MODULOS-Y-FLUJO-DE-PRUEBA.md`
- `AGENTS.md`
- `HANDOFF_SESSION.md`

### I. Bibliografía sugerida (para el informe o diapositivas)

- Angular. *Angular Documentation*. https://angular.dev
- Node.js. *Node.js Documentation*. https://nodejs.org/docs
- Express. *Express Documentation*. https://expressjs.com
- PostgreSQL Global Development Group. *PostgreSQL 18 Documentation*.
  https://www.postgresql.org/docs
- OWASP. *OWASP Top 10*. https://owasp.org/www-project-top-ten/
- Resend. *Documentation*. https://resend.com/docs
- Render. *Documentation*. https://render.com/docs
- Supabase. *Documentation*. https://supabase.com/docs
- MINEDU. *Currículo Nacional de la Educación Básica*.
- MINEDU. *SIAGIE — Sistema de Información de Apoyo a la Gestión de la Institución Educativa*.
- Perú. *Ley N.° 29733, Ley de Protección de Datos Personales*.
- Perú. *Reglamento de la Ley N.° 29733* (D.S. N.° 003-2013-JUS).

> Cita solo lo que hayas leído. Si el jurado pregunta por una fuente, debe poder explicarla.

---

## 14. Última recomendación

El jurado no recuerda todas tus diapositivas. Recuerda **cómo te expresaste**, **si el
sistema funcionó** y **si supiste responder lo que no sabías**. Ensaya la demo tres veces,
prepara tus dos momentos wow y repite esta idea:

> “No es un CRUD. Es una sola fuente de verdad, con reglas, seguridad y trazabilidad.”

Éxito en la sustentación.
