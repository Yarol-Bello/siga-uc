# 14 — Matriz de Trazabilidad

Rastrea cada caso de uso desde la interfaz hasta la tabla. Útil para estimar impacto de
cambios y para pruebas de regresión.

---

## 1. Trazabilidad de casos de uso

| # | Caso de uso | UI / Componente | Endpoint | Controlador | Servicio | DAO | Tablas / objetos |
|---|---|---|---|---|---|---|---|
| 1 | Login | `LoginComponent` | `POST /api/auth/login` | `authController.login` | `authService.login` | `usuarioDao.findByDni`, `getAlumnoInfo`, `getPersonalInfo`, `updateUltimoLogin` | `usuarios`, `roles`, `alumnos`, `personal` |
| 2 | Perfil + QR | `HeaderComponent` | `GET /api/auth/perfil` | `authController.perfil` | `authService.getPerfil` | `usuarioDao.findById`, `getAlumnoInfo`, `getPersonalInfo`, `getCredencialQR` | `usuarios`, `roles`, `alumnos`, `personal`, `credenciales_qr` |
| 3 | Recuperar contraseña | `LoginComponent` | `POST /api/auth/recuperar-password` | `authController.solicitarRecuperacion` | `recuperacionService.solicitarRecuperacion` | `usuarioDao.findByDniOCorreo`, `recuperacionDao.crearToken` | `usuarios`, `recuperacion_password` |
| 4 | Restablecer contraseña | `ResetPasswordComponent` | `GET /validar-token/:token`, `POST /restablecer-password` | `authController` | `recuperacionService` | `recuperacionDao`, `usuarioDao.actualizarPassword` | `recuperacion_password`, `usuarios` |
| 5 | Dashboard admin | `DashboardComponent` | `GET /api/reportes/dashboard` | `reporteController.getDashboard` | `reporteService.getDashboard` | `reporteDao.getDashboardEjecutivo` | `alumnos`, `personal`, `pagos`, `pre_tickets`, `grados`, `cursos` |
| 6 | Listar alumnos | `AdminAlumnosComponent` | `GET /api/alumnos` | `alumnoController.listar` | `alumnoService.listar` | `alumnoDao.listar` | `alumnos`, `grados`, `apoderados` |
| 7 | Matricular alumno | `AdminAlumnosComponent` | `POST /api/alumnos` | `alumnoController.crear` | `alumnoService.crear` | `alumnoDao.crear` | `apoderados`, `usuarios`, `alumnos`, `expediente_alumno`, `credenciales_qr` |
| 8 | Editar alumno | `AdminAlumnosComponent` | `PUT /api/alumnos/:id` | `alumnoController.actualizar` | `alumnoService.actualizar` | `alumnoDao.actualizar` | `alumnos` |
| 9 | Retirar alumno | `AdminAlumnosComponent` | `PUT /api/alumnos/:id/retirar` | `alumnoController.retirar` | `alumnoService.retirar` | `alumnoDao.retirar` | `alumnos` |
| 10 | Reset password alumno | `AdminAlumnosComponent` | `PUT /api/auth/reset-password` | `authController.resetPassword` | `authService.resetPassword` | `usuarioDao.resetPasswordByDni` | `usuarios` |
| 11 | Listar personal | `AdminPersonalComponent` | `GET /api/personal` | `personalController.listar` | `personalService.listar` | `personalDao.listar` | `personal`, `usuarios`, `roles` |
| 12 | Crear personal | `AdminPersonalComponent` | `POST /api/personal` | `personalController.crear` | `personalService.crear` | `personalDao.crear` | `usuarios`, `personal`, `credenciales_qr` |
| 13 | Cesar personal | `AdminPersonalComponent` | `PUT /api/personal/:id/cesar` | `personalController.cesar` | `personalService.cesar` | `personalDao.cesar` | `personal`, `usuarios` |
| 14 | Reactivar personal | `AdminPersonalComponent` | `PUT /api/personal/:id/reactivar` | `personalController.reactivar` | `personalService.reactivar` | `personalDao.reactivar` | `personal`, `usuarios` |
| 15 | Ver grados/cursos | `AdminCargaCurricularComponent` | `GET /api/grados`, `GET /api/cursos` | `academicoController` | `academicoService` | `gradoDao`, `cursoDao` | `grados`, `cursos`, `competencias` |
| 16 | Listar carga por grado | `AdminCargaCurricularComponent` | `GET /api/carga-curricular/grado/:id` | `cargaCurricularController.listarPorGrado` | `cargaCurricularService.listarPorGrado` | `cargaCurricularDao.listarPorGrado` | `carga_curricular`, `cursos`, `personal`, `usuarios` |
| 17 | Asignar docente | `AdminCargaCurricularComponent` | `POST /api/carga-curricular` | `cargaCurricularController.crear` | `cargaCurricularService.crear` | `cargaCurricularDao.crear` | `carga_curricular` |
| 18 | Editar asignación | `AdminCargaCurricularComponent` | `PUT /api/carga-curricular/:id` | `cargaCurricularController.actualizar` | `cargaCurricularService.actualizar` | `cargaCurricularDao.actualizar` | `carga_curricular` |
| 19 | Eliminar asignación | `AdminCargaCurricularComponent` | `DELETE /api/carga-curricular/:id` | `cargaCurricularController.eliminar` | `cargaCurricularService.eliminar` | `cargaCurricularDao.eliminar` | `carga_curricular` |
| 20 | Asignar tutor | `AdminCargaCurricularComponent` | `POST /api/carga-curricular/tutor` | `cargaCurricularController.asignarTutor` | `cargaCurricularService.asignarTutor` | `cargaCurricularDao.asignarTutor` | `tutores_grado` |
| 21 | Listar asistencia personal | `AdminAsistenciaQrComponent` | `GET /api/asistencias/personal/todos` | `asistenciaController.listarAsistenciaPersonal` | `asistenciaService.listarAsistenciaPersonal` | `asistenciaDao.listarAsistenciaPersonal` | `personal`, `usuarios`, `roles`, `asistencia_personal` |
| 22 | Buscar personal por DNI | `AdminAsistenciaQrComponent` | `GET /api/asistencias/personal/dni/:dni` | `asistenciaController.buscarPersonalPorDni` | `asistenciaService.buscarPersonalPorDni` | `asistenciaDao.buscarPersonalPorDni` | `personal`, `usuarios`, `roles` |
| 23 | Marcar asistencia personal | `AdminAsistenciaQrComponent` | `POST /api/asistencias/personal/marcar` | `asistenciaController.registrarAsistenciaPersonal` | `asistenciaService.registrarAsistenciaPersonal` | `asistenciaDao.registrarAsistenciaPersonal` | `asistencia_personal` |
| 24 | Ver pensiones de alumno | `SecretariaTesoreriaComponent` | `GET /api/tesoreria/pensiones/alumno/:id` | `tesoreriaController.listarPensionesAlumno` | `tesoreriaService.listarPensionesAlumno` | `tesoreriaDao.listarPensionesAlumno` | `pensiones`, `conceptos_pago` |
| 25 | Registrar pago | `SecretariaTesoreriaComponent` | `POST /api/tesoreria/pagos` | `tesoreriaController.registrarPago` | `tesoreriaService.registrarPago` | `tesoreriaDao.registrarPago` | `pagos`, `boletas_electronicas`, `pre_tickets`, `pensiones`, `alumnos`, `movimientos_caja` + triggers |
| 26 | Ver caja actual | `SecretariaCajaComponent` | `GET /api/caja/actual` | `cajaController.obtenerCajaAbierta` | `cajaService.obtenerCajaAbierta` | `cajaDao.obtenerCajaAbierta` | `aperturas_caja`, `cajas`, `movimientos_caja`, `cierres_caja` |
| 27 | Aperturar caja | `SecretariaCajaComponent` | `POST /api/caja/aperturar` | `cajaController.aperturar` | `cajaService.aperturar` | `cajaDao.aperturar` | `cajas`, `aperturas_caja`, `movimientos_caja` |
| 28 | Registrar egreso | `SecretariaCajaComponent` | `POST /api/caja/egresos` | `cajaController.registrarEgreso` | `cajaService.registrarEgreso` | `cajaDao.registrarEgreso` | `movimientos_caja` |
| 29 | Cerrar caja | `SecretariaCajaComponent` | `POST /api/caja/cerrar` | `cajaController.cerrar` | `cajaService.cerrar` | `cajaDao.cerrar` | `cierres_caja`, `aperturas_caja`, `movimientos_caja`, `cajas` |
| 30 | Ver auditoría docentes | `AdminSiagieComponent` | `GET /api/reportes/auditoria-docentes/:id` | `reporteController.getAuditoriaDocentes` | `reporteService.getAuditoriaDocentes` | `reporteDao.getAuditoriaDocentes` | `carga_curricular`, `cursos`, `grados`, `personal`, `usuarios`, `notas_finales_area` |
| 31 | Notificar docente | `AdminSiagieComponent` | `POST /api/notificaciones` | `notificacionController.crear` | `notificacionService.crear` | `notificacionDao.crear`, `usuarioDao.findById` | `notificaciones`, `usuarios` |
| 32 | Generar Excel SIAGIE | `AdminSiagieComponent` | `POST /api/siagie/generar-excel` | `siagieController.generarExcel` | `siagieService.generarExcel` | `siagieDao.obtenerGrado`, `obtenerNotasParaSIAGIE`, `registrarExportacion` | `grados`, `alumnos`, `cursos`, `notas_finales_area`, `exportaciones_siagie` |
| 33 | Ver libreta | `AdminReportesComponent` | `GET /api/reportes/libreta/:id` | `reporteController.getLibreta` | `reporteService.getLibreta` | `reporteDao.getLibretaAlumno` | `alumnos`, `grados`, `apoderados`, `cursos`, `notas_finales_area`, `conclusiones_descriptivas`, `asistencia_alumnos`, `tutores_grado`, `personal`, `usuarios` |
| 34 | Cuadro de mérito | `AdminReportesComponent` | `GET /api/reportes/cuadro-merito/:id` | `reporteController.getCuadroMerito` | `reporteService.getCuadroMerito` | `reporteDao.getCuadroMerito` | `alumnos`, `notas_finales_area` |
| 35 | Alumnos en riesgo | `AdminReportesComponent` | `GET /api/reportes/alumnos-riesgo/:id` | `reporteController.getAlumnosRiesgo` | `reporteService.getAlumnosRiesgo` | `reporteDao.getAlumnosRiesgo` | `alumnos`, `grados`, `calificaciones`, `cursos`, `tutores_grado`, `personal`, `usuarios` |
| 36 | Ver bitácora | `AdminAuditoriaComponent` | `GET /api/auditoria` | `auditoriaController.listarBitacora` | `auditoriaService.listarBitacora` | `auditoriaDao.listarBitacora` | `bitacora_auditoria`, `usuarios`, `roles` |
| 37 | Cerrar acta | `AdminAuditoriaComponent` | `POST /api/auditoria/actas/cerrar` | `auditoriaController.cerrarActa` | `auditoriaService.cerrarActa` | `auditoriaDao.cerrarActa` | `actas_bimestrales` |
| 38 | Ver cursos docente | `DocenteDashboardComponent`, `DocenteNotasComponent`, `DocenteAsistenciaComponent`, `DocenteReportesComponent` | `GET /api/carga-curricular/docente/:id` | `cargaCurricularController.listarPorDocente` | `cargaCurricularService.listarPorDocente` | `cargaCurricularDao.listarPorDocente` | `carga_curricular`, `grados`, `cursos` |
| 39 | Ver matriz de notas | `DocenteNotasComponent` | `GET /api/calificaciones/curso/:id/grado/:id` | `calificacionController.obtenerPorCursoGrado` | `calificacionService.obtenerPorCursoGrado` | `calificacionDao.obtenerPorCursoGrado` | `competencias`, `alumnos`, `calificaciones` |
| 40 | Guardar notas masivo | `DocenteNotasComponent` | `POST /api/calificaciones/masivo` | `calificacionController.registrarMasivo` | `calificacionService.registrarMasivo` | `calificacionDao.registrarMasivo` | `calificaciones` + trigger `trg_calificaciones_audit` → `bitacora_auditoria` |
| 41 | Ver asistencia curso/fecha | `DocenteAsistenciaComponent` | `GET /api/asistencias/curso/:id/fecha/:fecha` | `asistenciaController.obtenerPorCursoFecha` | `asistenciaService.obtenerPorCursoFecha` | `asistenciaDao.obtenerPorCursoFecha` | `alumnos`, `asistencia_alumnos` |
| 42 | Guardar asistencia masiva | `DocenteAsistenciaComponent` | `POST /api/asistencias/masivo` | `asistenciaController.registrarMasivo` | `asistenciaService.registrarMasivo` | `asistenciaDao.registrarMasivo` | `asistencia_alumnos` |
| 43 | Buscar ficha por DNI | `DocenteFichaComponent` | `GET /api/alumnos/dni/:dni` | `alumnoController.buscarPorDni` | `alumnoService.buscarPorDni` | `alumnoDao.findByDni` | `alumnos`, `grados` |
| 44 | Ver notas finales alumno | `DocenteFichaComponent`, `EstudianteDashboardComponent` | `GET /api/calificaciones/notas-finales/alumno/:id` | `calificacionController.obtenerNotasFinales` | `calificacionService.obtenerNotasFinales` | `calificacionDao.obtenerNotasFinales`, `obtenerConclusiones` | `notas_finales_area`, `conclusiones_descriptivas`, `cursos` |
| 45 | Mi asistencia | `EstudianteAsistenciaComponent` | `GET /api/asistencias/alumno/:id/resumen`, `GET /api/asistencias/alumno/:id` | `asistenciaController` | `asistenciaService` | `asistenciaDao` | `asistencia_alumnos`, `cursos`, `personal`, `usuarios` |
| 46 | Mi horario | `EstudianteHorarioComponent` | `GET /api/horarios/grado/:id` | `academicoController.listarHorariosPorGrado` | `academicoService.listarHorariosPorGrado` | `gradoDao.listarHorariosPorGrado` | `horarios`, `cursos`, `personal`, `usuarios` |
| 47 | Campanita | `HeaderComponent` | `GET /api/notificaciones/no-leidas` | `notificacionController.contarNoLeidas` | `notificacionService.contarNoLeidas` | `notificacionDao.contarNoLeidas` | `notificaciones` |
| 48 | Buzón | `HeaderComponent` | `GET /api/notificaciones`, `PUT /:id/leer`, `PUT /leer-todas` | `notificacionController` | `notificacionService` | `notificacionDao` | `notificaciones`, `usuarios` |
| 49 | Carné QR | `HeaderComponent` | `GET /api/auth/perfil` | `authController.perfil` | `authService.getPerfil` | `usuarioDao.getCredencialQR` | `credenciales_qr`, `usuarios` |
| 50 | Cambio de contraseña | `CambiarPasswordComponent` | `PUT /api/auth/cambiar-password` | `authController.cambiarPassword` | `authService.cambiarPassword` | `usuarioDao.getPasswordHashById`, `usuarioDao.actualizarPassword` | `usuarios` |
| 51 | Año lectivo global | `ConfiguracionService` / app initializer | `GET /api/configuracion` | `configuracionController.obtener` | `configuracionService.obtenerConfiguracion` | `config/academico.getAnioLectivo` | `.env` (`ANIO_LECTIVO`) |
| 52 | PDF de libreta | `AdminReportesComponent` | `GET /api/reportes/libreta/:id_alumno/pdf` | `reporteController.getLibretaPdf` | `reporteService.getLibreta` + `libretaPdfService.generarLibretaPdf` | `reporteDao.getLibretaAlumno` | `alumnos`, `cursos`, `notas_finales_area`, `conclusiones_descriptivas`, `asistencia_alumnos`, `tutores_grado` |
| 53 | PDF de boleta | `SecretariaCajaComponent` | `GET /api/tesoreria/boletas/:id_pago/pdf` | `tesoreriaController.getBoletaPdf` | `tesoreriaService.obtenerPago` + `boletaPdfService.generarBoletaPdf` | `tesoreriaDao.findPagoById` | `pagos`, `boletas_electronicas`, `alumnos`, `grados`, `conceptos_pago`, `usuarios` |
| 54 | PDF de acta | `AdminAuditoriaComponent` | `GET /api/auditoria/actas/:id_acta/pdf` | `auditoriaController.getActaPdf` | `auditoriaService.obtenerActa` + `actaPdfService.generarActaPdf` | `auditoriaDao.findActaById`, `findActaMatriz` | `actas_bimestrales`, `alumnos`, `grados`, `cursos`, `notas_finales_area`, `usuarios` |
| 55 | Mensaje masivo | `DashboardComponent` | `POST /api/notificaciones/masivo` | `notificacionController.crearMasivo` | `notificacionService.crearMasivo` + `emailService.enviarNotificacion` | `notificacionDao.listarDestinatarios`, `crearMasivo` | `usuarios`, `alumnos`, `grados`, `notificaciones` |

---

## 2. Trazabilidad de permisos

| Capacidad | Router | Middleware | Service/DAO | Tabla |
|---|---|---|---|---|
| Matricular | `alumnoRoutes` | `verificarRol('ADMIN','SECRETARIA')` | `alumnoService` | `alumnos` |
| Crear personal | `personalRoutes` | `verificarRol('ADMIN')` | `personalService` | `personal` |
| Asignar carga | `cargaCurricularRoutes` | `verificarRol('ADMIN')` | `cargaCurricularService` | `carga_curricular` |
| Registrar nota | `calificacionRoutes` | `verificarRol('ADMIN','DOCENTE')` | `calificacionService` | `calificaciones` |
| Registrar asistencia | `asistenciaRoutes` | `verificarRol('ADMIN','DOCENTE')` | `asistenciaService` | `asistencia_alumnos` |
| Marcar personal | `asistenciaRoutes` | `verificarRol('ADMIN','SECRETARIA')` | `asistenciaService` | `asistencia_personal` |
| Cobrar | `tesoreriaRoutes` | `verificarRol('ADMIN','SECRETARIA')` | `tesoreriaService` | `pagos`, `boletas` |
| Caja | `cajaRoutes` | `verificarRol('ADMIN','SECRETARIA')` | `cajaService` | `caja*` |
| SIAGIE | `siagieRoutes` | `verificarRol('ADMIN')` | `siagieService` | `exportaciones_siagie` |
| Cerrar acta | `auditoriaRoutes` | `verificarRol('ADMIN')` | `auditoriaService` | `actas_bimestrales` |
| Enviar notificación | `notificacionRoutes` | `verificarRol('ADMIN','DOCENTE')` | `notificacionService` | `notificaciones` |
| Envío masivo | `notificacionRoutes` | `verificarRol('ADMIN')` | `notificacionService` | `notificaciones` |

---

## 3. Trazabilidad de tablas críticas

| Tabla | Escritura | Lectura | Trigger |
|---|---|---|---|
| `usuarios` | `alumnoDao`, `personalDao`, `authService`, `recuperacionService` | `usuarioDao`, `personalDao`, `notificacionDao`, reportes | `trg_usuarios_actualizar` |
| `alumnos` | `alumnoDao`, `tesoreriaDao` (matrícula) | Casi todos los reportes | — |
| `calificaciones` | `calificacionDao` | `calificacionDao`, `reporteDao` | `trg_calificaciones_audit` |
| `notas_finales_area` | `calificacionDao` | `calificacionDao`, `reporteDao`, `siagieDao` | — |
| `asistencia_alumnos` | `asistenciaDao` | `asistenciaDao`, `reporteDao` | — |
| `pagos` | `tesoreriaDao` | `tesoreriaDao`, `reporteDao`, `cajaDao` | `trg_pagos_*` (3) |
| `movimientos_caja` | `cajaDao`, trigger de pagos | `cajaDao` | — |
| `cierres_caja` | `cajaDao` | `cajaDao`, `reporteDao` | — |
| `notificaciones` | `notificacionDao` | `notificacionDao` | — |
| `bitacora_auditoria` | Trigger de calificaciones | `auditoriaDao` | — |
| `actas_bimestrales` | `auditoriaDao` | `auditoriaDao` | — |
| `exportaciones_siagie` | `siagieDao` | — | — |

---

## 4. Cómo usar esta matriz

1. **Cambio en una regla:** localizar el caso de uso, seguir UI → endpoint → service → DAO →
   tabla.
2. **Bug de permisos:** revisar router y middleware; luego el componente que oculta/muestra.
3. **Bug de datos:** revisar el DAO y los triggers asociados.
4. **Nueva funcionalidad:** copiar el patrón de una fila similar y actualizar esta matriz.
5. **Pruebas de regresión:** ejecutar los casos de uso marcados como críticos (1, 7, 25, 27,
   29, 32, 37, 40, 42).
