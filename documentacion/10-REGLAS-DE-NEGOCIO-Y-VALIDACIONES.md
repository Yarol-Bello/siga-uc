# 10 — Reglas de Negocio y Validaciones

Catálogo consolidado. Cada regla indica dónde se aplica y qué ocurre si se incumple.
**Fuente:** código + restricciones de `siga_uc.sql`.

---

## 1. Identidad y acceso

| ID | Regla | Dónde se aplica | Si falla |
|---|---|---|---|
| RN-01 | El DNI debe tener exactamente 8 dígitos numéricos | Frontend, backend (login/alumno/personal), BD `CHECK` | 400 / error de BD |
| RN-02 | `usuarios.dni` es único | BD | Error de unicidad |
| RN-03 | `alumnos.dni` es único **por año lectivo**; la identidad `usuarios.dni` sigue siendo única | BD (`uq_alumno_dni_anio`) y `alumnoService` | 409 “Ya existe una matrícula para ese DNI en el año lectivo” |
| RN-04 | `correo_institucional` es único | BD | Error de unicidad |
| RN-05 | El usuario debe estar `ACTIVO` para login | `authService` | 403 con estado |
| RN-06 | La contraseña debe tener al menos 6 caracteres | Frontend y validadores de recuperación | 400 |
| RN-07 | El hash se guarda con bcrypt coste 10 | PostgreSQL `crypt` / `gen_salt('bf',10)` | — |
| RN-08 | El JWT expira en 8 h por defecto | `env.JWT.EXPIRES_IN` | 401 |
| RN-09 | El rol se toma del token, no de la BD en cada petición | `authMiddleware` | — |
| RN-10 | Un usuario cesado no puede iniciar sesión | `authService` | 403 |
| RN-11 | El logout es local; no invalida el token en servidor | `AuthService.logout` | — |
| RN-12 | Si `requiere_cambio_password = TRUE`, el login redirige a `/cambiar-password` y la API bloquea los demás endpoints | Auth + `authMiddleware` + UI | `403` con `errors.codigo = "CAMBIO_PASSWORD_REQUERIDO"` |

## 2. Correos

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-13 | El correo real es `correo_personal` | `notificacionService`, `recuperacionService` | Prioridad absoluta |
| RN-14 | Si no hay correo personal, se usa el institucional | Operador lógico OR en servicios | Fallback |
| RN-15 | El correo institucional es decorativo | Documentación y seeds | No recibe envíos reales |
| RN-16 | Si no hay correo, solo se guarda la notificación | `notificacionService` | No se envía |
| RN-17 | Un fallo de correo no revierte la notificación | `try/catch` | Warning en consola |
| RN-18 | La recuperación no debe revelar si el usuario existe | `recuperacionService` | Respuesta genérica |

## 3. Alumnos y matrícula

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-19 | Todo alumno nuevo nace `PendientePago` | `alumnoDao.crear` | No aparece en notas/asistencia |
| RN-20 | El pago de matrícula lo pasa a `Matriculado` | `tesoreriaDao.registrarPago` | Solo si concepto `MATRICULA` |
| RN-21 | El retiro lo pasa a `Retirado` | `alumnoDao.retirar` | Exige motivo |
| RN-22 | No se puede retirar dos veces | `alumnoService.retirar` | 400 |
| RN-23 | `condicion` solo admite Regular, Traslado, Retirado | BD `CHECK` | Error de BD |
| RN-24 | `estado_matricula` solo admite Matriculado, PendientePago, Retirado | BD `CHECK` | Error de BD |
| RN-25 | Código de estudiante `EST-XXX` único por año | BD + DAO | Colisión posible en concurrencia |
| RN-26 | Contraseña temporal del alumno = `UC<DNI>` | `alumnoDao.crear` | Se muestra una vez |
| RN-27 | La matrícula es transaccional | `BEGIN/COMMIT` | Rollback total |
| RN-28 | El expediente se crea vacío | `expediente_alumno` | Nivel NULL, asistencia 0 |
| RN-29 | El QR se genera al crear el alumno | `credenciales_qr` | `QR-<DNI>-<MD5>` |
| RN-30 | El retiro congela el expediente | `alumnoDao.retirar` (transacción) | `congelado = TRUE` |
| RN-31 | El retiro desactiva el usuario solo si no le queda otra matrícula no retirada | `alumnoDao.retirar` (transacción) | `estado = INACTIVO`; si tiene matrícula vigente en otro año, sigue `ACTIVO` |
| RN-32 | Editar nombres/apellidos sincroniza `usuarios` | `alumnoDao.actualizar` | `COALESCE` dentro de la transacción |

### 3.1 Identidad y matrícula anual (H49/6.1)

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-147 | `usuarios` es la identidad única por DNI; `alumnos` es una matrícula por año | BD | El mismo usuario puede tener 2026 y 2027 |
| RN-148 | UNIQUE de matrícula: `(dni, año)`, `(id_usuario, año)`, `(codigo_estudiante, año)` | BD (`uq_alumno_*_anio`) | 23505 si se duplica dentro del año |
| RN-149 | El `id_grado` debe pertenecer al año de la matrícula | `alumnoDao.crear` / `actualizar` | 400 |
| RN-150 | El concepto `MATRICULA` debe existir para el año de la matrícula | `alumnoDao.crear` | 400 |
| RN-151 | Un apoderado se reutiliza por DNI; no se sobrescriben sus datos | `alumnoDao` | Cero duplicados para hermanos |
| RN-152 | Un estudiante sin matrícula en el año activo puede iniciar sesión | `authService` | `matricula_activa=false` |
| RN-153 | Los endpoints académicos propios sin matrícula responden `403` | `authRoles` / `horarioService` | `errors.codigo = "SIN_MATRICULA_ACTIVA"` |
| RN-154 | Consultas operativas usan el año activo; `?anio` explícito permite históricos | Controllers/DAOs | Nunca mezclar años |
| RN-155 | `asistencia_alumnos` no tiene `anio_lectivo`; el año se deriva de `fecha` | `asistenciaDao` | `EXTRACT(YEAR FROM fecha)` |

## 4. Personal

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-32 | El personal debe tener DNI, nombres, apellidos y rol | `personalService.crear` | 400 |
| RN-33 | El rol no puede ser ESTUDIANTE al crear personal | `personalDao.listarRoles` | UI lo excluye; backend no lo impide |
| RN-34 | La contraseña por defecto es `UC2026*` | `personalDao.crear` | Configurable al crear |
| RN-35 | El cese exige motivo | `personalService.cesar` | 400 |
| RN-36 | No se puede cesar dos veces | `personalService.cesar` | 400 |
| RN-37 | El cese bloquea el login | `usuarios.estado = CESADO` | 403 |
| RN-38 | La reactivación limpia el cese | `personalDao.reactivar` | — |
| RN-39 | El QR se genera según rol | `personalDao.crear` | ADMIN/SECRETARIA/DOCENTE |
| RN-40 | Cambiar el rol no regenera el QR | Código actual | Brecha |

## 5. Configuración académica

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-41 | Un grado es único por nombre, sección y año | BD `UNIQUE` | Error |
| RN-42 | Un curso tiene nombre único | BD `UNIQUE` | Error |
| RN-43 | Un curso puede tener varias competencias ordenadas | `competencias.orden` | — |
| RN-44 | Una carga es única por grado, curso y año | BD `UNIQUE` | Error de llave duplicada |
| RN-45 | Un grado tiene un solo tutor por año | BD `UNIQUE` + reemplazo transaccional | — |
| RN-46 | Cada período debe tener `hora_fin > hora_inicio` y no solaparse con otro del mismo año | BD `CHECK` + trigger | 409/400 |
| RN-47 | Los días válidos son Lunes a Viernes | BD `CHECK` | Error |
| RN-48 | Los tipos de período son CLASE, RECREO o ALMUERZO; `horarios` solo acepta CLASE | BD `CHECK` + trigger | 409 |
| RN-49 | El año lectivo activo sale de `anios_lectivos.estado='ACTIVO'`; `ANIO_LECTIVO` es respaldo | `config/academico.js` + controllers/DAOs/UI | Configurable por tabla o `.env` |
| RN-49.1 | Un grado, un docente y un aula no se repiten en el mismo año/día/período | UNIQUE + índice parcial | 409 |
| RN-49.2 | Máximo 2 bloques del mismo curso por día (configurable) | Service + generador | 409 |
| RN-49.3 | Solo se crea/edita/genera/publica en el año lectivo activo | Service | 400 |
| RN-49.4 | BORRADOR visible solo para ADMIN/SECRETARIA; DOCENTE/ESTUDIANTE solo PUBLICADO | Queries de `mi-horario`/listado | Filtrado |
| RN-49.5 | Publicar exige horas completas, salvo `permitir_parcial` explícito | `horarioService.publicar` | 409 con faltantes |
| RN-49.6 | Cambiar docente/estructura de una carga con horario publicado exige despublicar; en BORRADOR se actualiza o elimina en la misma transacción | `cargaCurricularService` | 409 |

### 5.1 Configuración general (H74/Fase 1)

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-156 | Existe exactamente una fila de configuración institucional | BD `chk_configuracion_unica` | `id_configuracion = 1` |
| RN-157 | Solo ADMIN escribe la configuración | Router `checkRole(["ADMIN"])` | SECRETARÍA lee; DOCENTE/ESTUDIANTE 403 |
| RN-158 | El motivo es obligatorio en cambios | `configuracionService` | 10–500 caracteres; código `MOTIVO_REQUERIDO` |
| RN-159 | La auditoría se escribe en la misma transacción | `auditoriaService.registrarEnTransaccion` | Si falla, se revierte el cambio |
| RN-160 | Validaciones de institución | Service | Nombre ≤200, RUC 11 dígitos, correo, URL http(s), moneda 3 letras, zona `Intl`, locale `es-PE`, serie alfanumérica, número 0–999999 |
| RN-161 | El endpoint público no expone datos internos | `GET /api/configuracion` | Sin RUC, correo, dirección ni IDs |
| RN-162 | No se guardan secretos en configuración | Service + UI | `RESEND_API_KEY`/`JWT_SECRET` siguen en `.env` |
| RN-163 | Sin H74, la API no se cae | Controller | `503 CONFIG_NO_APLICADA` en admin; público con fallback |
| RN-164 | Guardar sin cambios no duplica auditoría | Service | `sin_cambios: true` |
| RN-165 | Una configuración por año lectivo | BD `configuracion_anio.anio` | FK a `anios_lectivos` |
| RN-166 | El componente nace responsive; el shell ADMIN sigue pausado | CSS del componente | A 768/1366 funciona; a 390 el sidebar fijo del ADMIN limita el ancho |

## 6. Asistencia de alumnos

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-50 | Estados válidos: P, T, F | Service + BD `CHECK` | 400 |
| RN-50.1 | `dia_semana` se deriva de `fecha` en el backend (ISODOW), en español; el valor del frontend se ignora | `asistenciaDao.registrar`/`registrarMasivo` | H61 |
| RN-50.2 | Las fechas `YYYY-MM-DD` se interpretan como locales; nunca con `new Date('YYYY-MM-DD')` | `fecha.util.ts` | H61 |
| RN-50.3 | Una observación exige estado P/T/F; la UI bloquea y el backend también rechaza el estado vacío | `docente-asistencia` + `asistenciaService` | H60 |
| RN-51 | Un registro por alumno, curso y fecha | BD `UNIQUE` | Upsert |
| RN-52 | Solo aparecen alumnos `Matriculado` | Query de listado | — |
| RN-53 | El guardado masivo es parcial | DAO | `insertados` + `errores[]` |
| RN-54 | `justificada` no afecta el porcentaje | Reportes | Solo informativa |
| RN-55 | Porcentaje = presentes / total × 100 | Queries | `NULLIF` evita división por cero |
| RN-55.1 | Historial, resumen, estadísticas, libreta y resumen por grado filtran por año | `asistenciaDao`, `reporteDao` | `EXTRACT(YEAR FROM fecha)` (H56) |
| RN-55.2 | Sin `?anio=` se usa el año activo (`anios_lectivos` o `ANIO_LECTIVO` de respaldo); un año explícito tiene prioridad | `asistenciaService`, controllers | H56/H49 |
| RN-56 | No se valida fecha futura | Código actual | Brecha |
| RN-57 | No se valida docente-curso | Código actual | Brecha |

## 7. Asistencia de personal

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-58 | Estados válidos: Puntual, Tardanza, Falta | Service + BD `CHECK` | 400 |
| RN-59 | Un registro por persona y fecha | BD `UNIQUE` | Upsert |
| RN-60 | Solo personal ACTIVO | `asistenciaService.buscarPersonalPorDni` | 400 |
| RN-61 | La marcación usa DNI, no el QR | UI + API | El QR no se valida |
| RN-62 | `hora_salida` no se usa en la UI | Código actual | Solo ingreso |

## 8. Calificaciones

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-63 | Valores válidos: AD, A, B, C | Service + BD `CHECK` | 400 |
| RN-64 | Bimestre entre 1 y 4 | Service + BD `CHECK` | 400 |
| RN-65 | Una nota por alumno, curso, competencia, bimestre y año | BD `UNIQUE` | Upsert |
| RN-66 | El guardado masivo es parcial | DAO | `insertados` + `errores[]` |
| RN-67 | La nota final usa predominancia | DAO | AD>A>B>C con desempate |
| RN-68 | La función SQL no tiene desempate | BD | Divergencia |
| RN-69 | El cálculo de nota final no es automático en la UI | Frontend | Brecha |
| RN-70 | Toda modificación de nota se audita | Trigger | Bitácora |
| RN-71 | La auditoría usa `modificado_por` | Trigger | Puede ser NULL |
| RN-72 | No se valida docente-curso | Código actual | Brecha |
| RN-73 | No se valida pertenencia alumno-grado | Código actual | Brecha |

### Fórmula de nota final (DAO)

```text
if AD >= 2: AD
elif A >= 2: A
elif B >= 2: B
elif C >= 2: C
elif AD >= 1: AD
elif A >= 1: A
elif B >= 1: B
else: C
```

### Promedio para mérito

```text
puntaje = AD*4 + A*3 + B*2 + C*1
promedio = puntaje / cursos_con_nota
orden = promedio DESC, total_ad DESC
top = 10
```

## 9. Reportes

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-74 | Cuadro de mérito solo alumnos matriculados | `reporteDao` | — |
| RN-75 | Mérito top 10 | `LIMIT 10` | — |
| RN-76 | Riesgo = 2+ cursos distintos con C | `HAVING >= 2` | No cuenta competencias |
| RN-77 | Libreta combina notas, conclusión y asistencia | `reporteDao` | No persiste |
| RN-77.1 | El panel del estudiante usa el grado real y los cursos de `carga_curricular`; la felicitación exige notas | `estudiante-dashboard`, `sidebar-estudiante` | H57 |
| RN-78 | Resumen de asistencia por grado filtra por año | `getResumenAsistenciaGrado` | Resuelto con H56 (`EXTRACT(YEAR FROM asis.fecha) = $2`) |
| RN-79 | Auditoría docente compara notas finales vs alumnos | `reporteDao` | No usa estado_carga |
| RN-79.1 | El dashboard separa `total_docentes` (rol 2 activo con ficha sin cese) de `total_personal` (todo el personal sin cese) | `getDashboardEjecutivo` | H65 |
| RN-79.2 | El consolidado histórico por DNI agrupa por `id_usuario` y no suma años por `id_alumno` | `getConsolidadoPorDni` | 6.4 |

## 10. Tesorería

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-80 | Tipos de concepto: MATRICULA, PENSION, OTROS | BD `CHECK` | — |
| RN-81 | Mes de pensión 1–12 | BD `CHECK` | — |
| RN-82 | Una pensión por alumno, año y mes | BD `UNIQUE` | `DO NOTHING`, salvo `ANULADO` que vuelve a `PENDIENTE` (H45) |
| RN-83 | Solo se generan pensiones para matriculados | Query | — |
| RN-84 | La beca aprobada descuenta según su alcance, modalidad, valor, tope y prioridad | `becaCalculator` | H78; no usa la primera beca activa a ciegas |
| RN-85 | `monto_final = monto_base - descuento` | Query | `EXONERADO` cuando queda en 0 (H78) |
| RN-86 | Formas de pago: Efectivo, Yape, Plin, Interbank, BCP, BBVA | BD `CHECK` | — |
| RN-87 | Pago nace `PAGADO` | DAO | — |
| RN-88 | Boleta `B001-XXXXXX` con número máximo + 1 | DAO | Concurrencia riesgosa |
| RN-89 | Boleta nace `ACEPTADO` | DAO | Simulada |
| RN-90 | Pago de pre-ticket lo marca PAGADO | DAO + trigger | Duplicado |
| RN-91 | Pago de pensión la marca PAGADO | DAO + trigger | Duplicado |
| RN-92 | Pago de matrícula matricula al alumno | DAO | — |
| RN-93 | Pago inserta ingreso en caja | Trigger | Última apertura |
| RN-94 | No se valida monto contra pensión/concepto | Código actual | Brecha |
| RN-95 | No se valida caja abierta para cobrar | Código actual | Brecha |
| RN-96 | No hay anulación de pagos en UI | Código actual | Brecha |
| RN-97 | El retiro anula pensiones `PENDIENTE` de meses posteriores al retiro | `alumnoDao.retirar` | La pensión del mes de retiro queda `PENDIENTE`; `PAGADO` no se toca |
| RN-98 | El retiro anula todos los `pre_tickets PENDIENTE` | `alumnoDao.retirar` | Los `PAGADO` no se tocan |
| RN-99 | Una pensión `ANULADO` no se puede cobrar | `tesoreriaService.registrarPago` | 400 “La pensión está anulada.” |
| RN-100 | Al regenerar el cronograma, una pensión `ANULADO` vuelve a `PENDIENTE` | `tesoreriaDao.generarPensionesAlumno` | No cambia montos ni descuentos |
| RN-101 | Solo ADMIN crea, edita, aprueba, rechaza y anula becas; SECRETARÍA lee | `configuracionRoutes` | DOCENTE/ESTUDIANTE 403 |
| RN-102 | Aprobar exige motivo de 10–500 y evidencia si el tipo la requiere | `becaService` | 400 `EVIDENCIA_REQUERIDA` |
| RN-103 | Una beca se aplica por fecha y alcance; prioridad descendente | `becaCalculator.calcular` | MATRICULA/PENSION/AMBOS |
| RN-104 | Un tipo no combinable excluye a los siguientes; el grupo de exclusividad impide sumar dos becas | `becaCalculator.calcular` | — |
| RN-105 | El descuento nunca deja el cargo negativo; el tope limita el monto | `becaCalculator.calcular` | — |
| RN-106 | Solo se recalculan cargos `PENDIENTE`/`EXONERADO` | `becaCalculator` | `PAGADO`/`ANULADO` intactos |
| RN-107 | 100% deja pensión o pre-ticket `EXONERADO` en 0; matrícula exonera y marca `Matriculado` | `becaCalculator` | H78 |
| RN-108 | Anular borra aplicaciones y devuelve pendientes a `PENDIENTE`; si la matrícula deja de estar exenta, vuelve a `PendientePago` | `becaService.revertirCobros` | H78 |
| RN-109 | La promoción copia los campos H78 de la beca y aplica la beca de matrícula al pre-ticket destino | `promocionService` | `copiar_becas` |

## 11. Caja

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-97 | Solo una caja abierta a la vez | `cajaDao.aperturar` | 409 |
| RN-98 | Monto inicial ≥ 0 | Service | 400 |
| RN-99 | Egreso exige concepto y monto > 0 | Service | 400 |
| RN-100 | Egreso exige caja abierta | DAO | 400 |
| RN-101 | Cierre exige efectivo físico ≥ 0 | Service | 400 |
| RN-102 | `efectivo_esperado = inicial + ingresos efectivo - egresos` | DAO | — |
| RN-103 | `diferencia = físico - esperado` | DAO | — |
| RN-104 | Estados: CUADRADO (±0.01), SOBRANTE (>0.01), FALTANTE (<-0.01) | DAO | — |
| RN-105 | `total_general = físico + ingresos digitales` | DAO | — |
| RN-106 | Un cierre por apertura | Lógica de caja abierta | No hay UNIQUE explícito |
| RN-107 | Los ingresos se crean solos desde pagos | Trigger | No hay ingreso manual |

## 12. SIAGIE

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-108 | Solo ADMIN exporta | Router | 403 para otros roles |
| RN-109 | La exportación es interna, no oficial | UI + Excel | Aviso obligatorio |
| RN-110 | Grado del año y al menos un curso y un alumno | Service | 404/422 |
| RN-111 | Todos los cursos de la carga curricular del grado/año | Service | Sin prefijos ni límite de 4 (H05) |
| RN-112 | Alumnos `Matriculado`/`PendientePago`; excluye `Retirado` | Service | — |
| RN-113 | Sin notas finales: celdas vacías y advertencia | Service/UI | No inventa notas |
| RN-114 | Registra exportación y auditoría | DAO | `GENERADO` + `EXPORTAR` |
| RN-115 | Borra el temporal | Controller | — |

## 13. Notificaciones

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-116 | Asunto y cuerpo obligatorios | Service | 400 |
| RN-117 | Destino obligatorio | Service | 400 |
| RN-118 | Solo el destinatario puede leer/marcar/eliminar | DAO | 404 si no es suyo |
| RN-119 | El correo se envía a personal o institucional | Service | — |
| RN-120 | El correo no bloquea el guardado | try/catch | — |
| RN-121 | El masivo solo persiste, no envía correo | DAO | Brecha |
| RN-122 | El contador se refresca cada 30 s | Header | — |

## 14. Auditoría y actas

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-123 | Solo ADMIN cierra y reabre actas | Router | 403 |
| RN-124 | El acta exige bimestre 1-4 y año lectivo; grado opcional | Service + BD `CHECK` | 400 |
| RN-125 | Un acta global (`id_grado NULL`) en `CERRADO` bloquea todos los grados | `actaEstaCerrada` | 409 al guardar notas |
| RN-126 | Cerrar un acta ya `CERRADO` devuelve 409; crear una nueva la inserta | DAO `INSERT ... ON CONFLICT` | 409 / 200 |
| RN-127 | Reabrir exige motivo de 10-250 caracteres y solo aplica a `CERRADO` | Service | 400/404/409 |
| RN-128 | El hash es MD5 de periodo+año+NOW+grado; no es firma digital | DAO | No reproducible |
| RN-129 | Reabrir limpia el hash y registra `reabierto_por`/fecha/motivo | DAO | — |
| RN-130 | Las libretas se consultan por bimestre 1-4 | Frontend + API | H51 |
| RN-131 | La bitácora se lista máximo 200 sin paginación | DAO | Con `page` usa paginación server-side |
| RN-132 | Se auditan escrituras, accesos y descargas; no lecturas | Servicios de auditoría | H07 |

## 15. Recuperación de contraseña

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-130 | Identificador: DNI, correo institucional o personal | DAO | — |
| RN-131 | Token de 32 bytes (64 hex) | Service | — |
| RN-132 | Expira en 2 h | PostgreSQL | — |
| RN-133 | Un solo uso | DAO | — |
| RN-134 | Al solicitar, invalida tokens anteriores | DAO | — |
| RN-135 | Nueva contraseña ≥6 | Service | 400 |
| RN-136 | No revelar existencia del usuario | Service | Respuesta genérica |

## 16. Reglas de infraestructura

| ID | Regla | Dónde |
|---|---|---|
| RN-137 | Respuesta uniforme `{success,message,data,timestamp}` | `utils/response` |
| RN-138 | SQL siempre parametrizado (`$1...`) | DAOs |
| RN-139 | Las operaciones multi-tabla usan transacción | DAOs |
| RN-140 | Los errores de validación devuelven 400 con detalle | Controllers |
| RN-141 | Los recursos inexistentes devuelven 404 | Services |
| RN-142 | Los conflictos devuelven 409 | Services/DAOs |
| RN-143 | El backend escucha en `0.0.0.0` | `app.js` |
| RN-144 | CORS solo permite orígenes configurados | `app.js` |
| RN-145 | Helmet está activo | `app.js` |
| RN-146 | El año activo se lee de `anios_lectivos.estado='ACTIVO'` al arrancar; `ANIO_LECTIVO` es bootstrap/respaldo. `?anio=YYYY` explícito tiene prioridad para consultas históricas | `config/academico` + controllers/DAOs | - |
