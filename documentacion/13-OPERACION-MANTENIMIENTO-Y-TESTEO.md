# 13 — Operación, Mantenimiento y Testeo

## 1. Operación diaria

### 1.1 Antes de abrir

- [ ] PostgreSQL `Running`.
- [ ] Backend arriba (`/api/health`).
- [ ] Frontend arriba.
- [ ] Fecha/hora y zona `America/Lima` correctas.
- [ ] Caja del día aperturada (si se cobrará).
- [ ] Correo configurado (si se notificará).

### 1.2 Health check

```http
GET /api/health
```

Respuesta esperada:

```json
{
  "success": true,
  "message": "SIGA-UC API funcionando correctamente",
  "data": { "app": "SIGA-UC", "version": "1.0.0", "environment": "production", "timestamp": "..." }
}
```

### 1.3 Monitoreo mínimo

| Señal | Dónde | Frecuencia |
|---|---|---|
| API viva | `/api/health` | Cada 5 min |
| Errores backend | Logs del proceso | Diario |
| Espacio en disco | Servidor | Semanal |
| Conexiones PostgreSQL | `pg_stat_activity` | Semanal |
| Cola de correos/fallos | Logs Resend | Diario |
| Backups | Almacenamiento | Diario |
| Intentos de login fallidos | Logs (no hay tabla) | Diario |

### 1.4 Logs

- `morgan("dev")` en desarrollo; en producción no hay logger estructurado.
- Los errores se imprimen con `console.error` (mensaje + stack).
- No hay correlación por request ID.
- **Recomendación:** añadir `pino`/`winston`, niveles y rotación.

---

## 2. Tareas periódicas

| Tarea | Frecuencia | Responsable | Comando/acción |
|---|---|---|---|
| Backup completo | Diario | TI | `npm run backup` (`scripts/backup.js`) |
| Verificar backup | Semanal | TI | Restaurar en entorno de prueba |
| Revisar logs de error | Diario | TI | Consola/plataforma |
| Revisar usuarios inactivos | Mensual | Admin | Módulo Personal |
| Revisar pensiones pendientes | Mensual | Secretaría | Tesorería |
| Generar pensiones del mes | Mensual | Secretaría/Admin | `POST /pensiones/generar` (sin UI) |
| Cerrar actas | Bimestral | Admin | Auditoría |
| Exportar SIAGIE | Bimestral | Admin | SIAGIE |
| Rotar contraseñas de prueba | Al desplegar | TI | Admin |
| `npm audit` | Mensual | TI | Backend/frontend |
| Actualizar dependencias | Trimestral | TI | Revisar breaking changes |
| Revisar `JWT_SECRET` | Anual/incidente | TI | Rotación |

---

## 3. Preparación de un año lectivo nuevo

El código ya no tiene el año hardcodeado. Para operar en 2027:

1. Actualizar `ANIO_LECTIVO=2027` en el `.env` local y en las variables de Render.
2. Reiniciar/redeployar el backend. El frontend **no requiere rebuild**: obtiene el año de
   `GET /api/configuracion` al iniciar.
3. Crear los datos del nuevo año: `grados`, `carga_curricular`, `tutores_grado` y
   `conceptos_pago`.
4. Preparar los conceptos de matrícula y pensiones con el script idempotente:

   ```powershell
   psql -U postgres -d siga_uc -v anio=2027 -f database/preparar_anio_lectivo.sql
   ```

   El script copia los conceptos del año anterior y no modifica los datos históricos.
5. Verificar `GET /api/configuracion` → `{ "anio_lectivo": 2027 }`.
6. Los datos de 2026 conservan su `anio_lectivo`; las consultas históricas siguen aceptando
   `?anio=2026` en la API.

| Lugar | Qué revisar |
|---|---|
| `grados` | Insertar grados del nuevo año |
| `alumnos.anio_lectivo` | Se asigna al matricular con el año configurado |
| `carga_curricular.anio_lectivo` | Nuevas asignaciones usan el año configurado |
| `tutores_grado.anio_lectivo` | Nuevos tutores |
| `conceptos_pago.anio_lectivo` | Script `preparar_anio_lectivo.sql` |
| `calificaciones` / `notas_finales_area` | Se registran con el año configurado |
| `pensiones.anio_lectivo` | Se generan con el año configurado |
| Frontend / SIAGIE / reportes | Leen el año desde `ConfiguracionService` |

**Recomendación:** no volver a introducir literales `2026` en controllers, DAOs ni componentes;
usar `getAnioLectivo()` en backend y `ConfiguracionService.anioLectivo` en frontend.

---

## 4. Testeo manual

El proyecto **no tiene tests automatizados**. La estrategia es manual y por rol.

### 4.1 Preparación

1. BD restaurada con `siga_uc_completo.sql`.
2. Backend y frontend corriendo.
3. Credenciales de `docs/CREDENCIALES.md`.
4. Consola del navegador (F12) abierta.
5. Logs del backend visibles.

### 4.2 Smoke test (15 minutos)

| # | Caso | Pasos | Esperado |
|---|---|---|---|
| 1 | Health | `GET /api/health` | 200 + app/version |
| 2 | Login Admin | 74829102 / `UC2026*` | Dashboard con KPIs |
| 3 | Login Docente | 10293847 / `UC2026*` | Dashboard con cursos |
| 4 | Login Estudiante | 75918234 / `UC75918234` | Notas del alumno |
| 5 | Login Secretaría | 40596837 / `UC2026*` | Dashboard financiero |
| 6 | Ruta cruzada | Estando como estudiante, ir a `/admin` | Redirige a `/estudiante` |
| 7 | Campanita | Abrir buzón | Lista y contador |
| 8 | Carné | Abrir carné | QR visible |
| 9 | Logout | Cerrar sesión | Vuelve a login |
| 10 | Recuperación | Solicitar por DNI con correo | Alerta genérica |

### 4.3 Checklist ADMIN

- [ ] Dashboard carga KPIs.
- [ ] Alumnos: listar, filtrar, ver ficha.
- [ ] Alumnos: crear matrícula (probar DNI duplicado).
- [ ] Alumnos: editar, retirar, reset password.
- [ ] Personal: listar, crear, editar.
- [ ] Personal: cesar, reactivar, reset.
- [ ] Carga: seleccionar grado, ver 11 cursos.
- [ ] Carga: asignar docente, editar, eliminar.
- [ ] Carga: asignar tutor.
- [ ] QR: listar personal, marcar Puntual/Tardanza/Falta.
- [ ] Tesorería: ver pensiones, cobrar, ver boleta.
- [ ] Caja: aperturar, egreso, cerrar, ver diferencia.
- [ ] SIAGIE: ver auditoría, notificar docente, subir plantilla, descargar.
- [ ] Reportes: libreta, mérito, riesgo.
- [ ] Auditoría: bitácora, filtros, detalle.
- [ ] Auditoría: cerrar acta.

### 4.4 Checklist SECRETARÍA

- [ ] Dashboard financiero.
- [ ] Padrón (mismo que Admin).
- [ ] Tesorería: cobrar pensión/matrícula.
- [ ] Caja: aperturar, egreso, cierre.
- [ ] QR: marcar personal.
- [ ] Verificar que no accede por UI a Personal/Carga/SIAGIE/Reportes.

### 4.5 Checklist DOCENTE

- [ ] Dashboard con cursos asignados.
- [ ] Notas: selector curso/bimestre.
- [ ] Notas: cambiar AD/A/B/C y guardar masivo.
- [ ] Notas: verificar persistencia al recargar.
- [ ] Asistencia: selector curso/fecha.
- [ ] Asistencia: P/T/F, “todos presentes”, guardar.
- [ ] Ficha: buscar por DNI, ver notas y asistencia.
- [ ] Reportes: estadísticas por competencia.
- [ ] Campanita: recibir recordatorio.
- [ ] Verificar que no accede a Admin/Secretaría.

### 4.6 Checklist ESTUDIANTE

- [ ] Dashboard: notas por curso y promedio.
- [ ] Asistencia: resumen por curso y detalle.
- [ ] Horario: bloques Lunes–Viernes.
- [ ] Carné QR.
- [ ] Verificar que no accede a Admin/Docente/Secretaría.

### 4.7 Casos borde

| Caso | Resultado esperado |
|---|---|
| DNI duplicado al matricular | 409, mensaje claro |
| DNI con letras | 400 validación |
| Contraseña corta | 400 validación |
| Token expirado | 401 + redirección |
| Token manipulado | 401 |
| Usuario cesado | 403 |
| Caja ya abierta | 409 |
| Egreso sin caja | 400 |
| Cierre sin caja | 400 |
| Pago sin número de operación (UI) | Bloqueado en frontend |
| Pago con monto 0 | Backend no lo impide (brecha) |
| Nota inválida | 400 |
| Bimestre 5 | 400 |
| SIAGIE sin notas | 404 |
| Archivo SIAGIE PDF | 400 multer |
| Archivo >10 MB | 400 multer |
| Notificación ajena | 404 |
| Acta ya cerrada | UI bloquea; backend no valida estado |
| Curso duplicado en carga | Error de llave duplicada |

### 4.8 Regresión mínima tras cambios

1. Login de los 4 roles.
2. Matrícula + pago de matrícula.
3. Asistencia + nota de un alumno.
4. Reporte de libreta.
5. Caja apertura/cierre.
6. Campanita.
7. SIAGIE con plantilla de prueba.

---

## 5. Diagnóstico de datos

### 5.1 Alumno no aparece en asistencia/notas

```sql
SELECT id_alumno, nombres, apellidos, estado_matricula, id_grado, anio_lectivo
FROM alumnos WHERE dni = 'XXXXXXXX';
```

Debe estar `Matriculado`. Si está `PendientePago`, cobrar matrícula.

### 5.2 Docente no ve cursos

```sql
SELECT cc.*, c.nombre_curso, g.nombre_grado
FROM carga_curricular cc
JOIN cursos c ON c.id_curso = cc.id_curso
JOIN grados g ON g.id_grado = cc.id_grado
JOIN personal p ON p.id_personal = cc.id_personal
JOIN usuarios u ON u.id_usuario = p.id_usuario
WHERE u.dni = '10293847' AND cc.anio_lectivo = 2026;
```

### 5.3 No hay notas finales

```sql
SELECT a.dni, c.nombre_curso, nf.bimestre, nf.nota_final
FROM alumnos a
CROSS JOIN cursos c
LEFT JOIN notas_finales_area nf
  ON nf.id_alumno = a.id_alumno AND nf.id_curso = c.id_curso
 AND nf.bimestre = 2 AND nf.anio_lectivo = 2026
WHERE a.id_grado = 2 AND a.estado_matricula = 'Matriculado';
```

Si `nota_final` es NULL, ejecutar el cálculo por alumno/curso o revisar si el docente guardó.

### 5.4 Caja descuadrada

```sql
SELECT tipo, medio_pago, SUM(monto)
FROM movimientos_caja
WHERE id_apertura = 2
GROUP BY tipo, medio_pago;
```

Comparar con el cierre. Revisar pagos sin caja abierta:

```sql
SELECT p.* FROM pagos p
LEFT JOIN movimientos_caja m ON m.id_pago = p.id_pago
WHERE m.id_movimiento IS NULL;
```

### 5.5 Notificaciones no llegan por correo

- Revisar `RESEND_API_KEY`.
- Revisar `EMAIL_FROM`.
- Revisar que el usuario tenga `correo_personal` o `correo_institucional`.
- Revisar logs `📧`/`❌`.
- En modo prueba de Resend, el destinatario debe estar autorizado.

---

## 6. Mantenimiento de datos

| Tarea | SQL/Acción |
|---|---|
| Alumnos por estado | `SELECT estado_matricula, COUNT(*) FROM alumnos GROUP BY 1;` |
| Pensiones pendientes | `SELECT COUNT(*), SUM(monto_final) FROM pensiones WHERE estado='PENDIENTE';` |
| Pagos sin boleta | `SELECT p.* FROM pagos p LEFT JOIN boletas_electronicas b ON b.id_pago=p.id_pago WHERE b.id_boleta IS NULL;` |
| Movimientos sin pago | `SELECT * FROM movimientos_caja WHERE tipo='INGRESO' AND id_pago IS NULL;` |
| Bitácora por módulo | `SELECT modulo_afectado, COUNT(*) FROM bitacora_auditoria GROUP BY 1;` |
| Usuarios sin QR | `SELECT u.id_usuario FROM usuarios u LEFT JOIN credenciales_qr c ON c.id_usuario=u.id_usuario WHERE c.id_credencial IS NULL;` |
| Alumnos sin expediente | `SELECT a.id_alumno FROM alumnos a LEFT JOIN expediente_alumno e ON e.id_alumno=a.id_alumno WHERE e.id_expediente IS NULL;` |

---

## 7. Incidentes y recuperación

### 7.1 La API no arranca

1. Revisar que `.env` exista y tenga `DB_*` + `JWT_SECRET`.
2. `npm install`.
3. Verificar PostgreSQL.
4. Revisar puerto.
5. Revisar logs.

### 7.2 La API arranca pero todo da 500

- BD caída o credenciales mal.
- Esquema incompleto (faltan tablas/funciones).
- `pgcrypto` ausente.

### 7.3 Pérdida de datos

1. Detener aplicación.
2. Restaurar último backup.
3. Verificar integridad (conteos, FKs).
4. Revisar causa.

### 7.4 Token comprometido

1. Rotar `JWT_SECRET` (invalida todos los tokens).
2. Cambiar contraseñas afectadas.
3. Revisar bitácora (limitada).
4. Revisar logs.

### 7.5 Correo masivo accidental

- No hay cancelación; el envío es síncrono por notificación.
- Revisar `notificaciones` y logs.
- Comunicar a los afectados.

---

## 8. Calidad y mejoras de testeo

| Mejora | Beneficio |
|---|---|
| Tests unitarios de services | Validar reglas sin BD |
| Tests de integración de endpoints | Contratos y permisos |
| Tests E2E (Playwright/Cypress) | Flujos por rol |
| Seed reproducible | Tests consistentes |
| CI en GitHub Actions | Build + lint + tests |
| Cobertura de autorización | Evitar GET amplios |
| Pruebas de carga | 150 alumnos / 17 docentes es bajo, pero validar concurrencia |

---

## 9. Contacto y responsabilidades

| Rol | Responsable | Ámbito |
|---|---|---|
| Product Owner/PM | Yarol Bello Coquil | Alcance, prioridades, despliegue |
| Arquitecto/Backend | Alexander Grados Castro | API, BD, seguridad |
| Frontend | Franz Roger Ramón Ayala | Angular, UI/UX |
| Analista/QA | Jeanfranco Jesús Ramos Uñaupe | Pruebas, documentación |
| Docente del curso | Mg. Mora Bonilla, Anthony | Evaluación académica |
