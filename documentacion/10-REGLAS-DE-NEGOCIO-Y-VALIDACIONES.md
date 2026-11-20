# 10 — Reglas de Negocio y Validaciones

Catálogo consolidado. Cada regla indica dónde se aplica y qué ocurre si se incumple.
**Fuente:** código + restricciones de `siga_uc.sql`.

---

## 1. Identidad y acceso

| ID | Regla | Dónde se aplica | Si falla |
|---|---|---|---|
| RN-01 | El DNI debe tener exactamente 8 dígitos numéricos | Frontend, backend (login/alumno/personal), BD `CHECK` | 400 / error de BD |
| RN-02 | `usuarios.dni` es único | BD | Error de unicidad |
| RN-03 | `alumnos.dni` es único | BD y `alumnoService` | 409 “Ya existe un alumno con ese DNI” |
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
| RN-25 | Código de estudiante `EST-XXX` único | BD + DAO | Colisión posible en concurrencia |
| RN-26 | Contraseña temporal del alumno = `UC<DNI>` | `alumnoDao.crear` | Se muestra una vez |
| RN-27 | La matrícula es transaccional | `BEGIN/COMMIT` | Rollback total |
| RN-28 | El expediente se crea vacío | `expediente_alumno` | Nivel NULL, asistencia 0 |
| RN-29 | El QR se genera al crear el alumno | `credenciales_qr` | `QR-<DNI>-<MD5>` |
| RN-30 | El retiro no congela el expediente | Código actual | Brecha |
| RN-31 | El retiro no desactiva el usuario | Código actual | Brecha |

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
| RN-46 | El horario debe tener `hora_fin > hora_inicio` | BD `CHECK` | Error |
| RN-47 | Los días válidos son Lunes a Sábado | BD `CHECK` | Error |
| RN-48 | Los bloques son CLASE, RECREO o ALMUERZO | BD `CHECK` | Error |
| RN-49 | El año lectivo por defecto sale de `ANIO_LECTIVO` | `config/academico.js` + controllers/DAOs/UI | Configurable por `.env` |

## 6. Asistencia de alumnos

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-50 | Estados válidos: P, T, F | Service + BD `CHECK` | 400 |
| RN-51 | Un registro por alumno, curso y fecha | BD `UNIQUE` | Upsert |
| RN-52 | Solo aparecen alumnos `Matriculado` | Query de listado | — |
| RN-53 | El guardado masivo es parcial | DAO | `insertados` + `errores[]` |
| RN-54 | `justificada` no afecta el porcentaje | Reportes | Solo informativa |
| RN-55 | Porcentaje = presentes / total × 100 | Queries | `NULLIF` evita división por cero |
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
| RN-78 | Resumen de asistencia ignora el año | `getResumenAsistenciaGrado` | Bug |
| RN-79 | Auditoría docente compara notas finales vs alumnos | `reporteDao` | No usa estado_carga |

## 10. Tesorería

| ID | Regla | Dónde | Detalle |
|---|---|---|---|
| RN-80 | Tipos de concepto: MATRICULA, PENSION, OTROS | BD `CHECK` | — |
| RN-81 | Mes de pensión 1–12 | BD `CHECK` | — |
| RN-82 | Una pensión por alumno, año y mes | BD `UNIQUE` | `DO NOTHING` |
| RN-83 | Solo se generan pensiones para matriculados | Query | — |
| RN-84 | La beca activa descuenta `monto_descuento` | Query de generación | Primera beca activa |
| RN-85 | `monto_final = monto_base - descuento` | Query | — |
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
| RN-108 | Solo ADMIN exporta | Router | 403 |
| RN-109 | Plantilla `.xlsx/.xls` ≤10 MB | Multer | Error |
| RN-110 | Debe existir grado y notas finales | Service | 404 |
| RN-111 | Detecta encabezado por DNI/DOCUMENTO | Service | Fallback fila 5 |
| RN-112 | Detecta cursos por prefijos ARITM/ALGEBRA/COMUNIC/FISICA | Service | Solo 4 |
| RN-113 | Cruza por DNI exacto | Service | Sin normalización |
| RN-114 | Registra exportación | DAO | Estado GENERADO |
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
| RN-123 | Solo ADMIN cierra actas | Router | 403 |
| RN-124 | El acta debe tener periodo y año | Service | 400 |
| RN-125 | El cierre genera hash MD5 | DAO | No es firma digital |
| RN-126 | El hash depende de la fecha de cierre | DAO | No reproducible |
| RN-127 | El cierre no bloquea notas | Código actual | Brecha |
| RN-128 | La bitácora se lista máximo 200 | DAO | — |
| RN-129 | Solo calificaciones se auditan automáticamente | Trigger | Brecha |

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
| RN-146 | El año lectivo se configura con `ANIO_LECTIVO`; `?anio=YYYY` explícito tiene prioridad para consultas históricas | `.env` + controllers/DAOs | — |
