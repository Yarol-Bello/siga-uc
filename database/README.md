# Base de Datos SIGA-UC

Base de datos relacional del Sistema Integrado de Gestión Académica de la I.E.P. Unión Científica.

## 📁 Archivos

| Archivo              | Descripción                                                             | Versionado en Git     |
| -------------------- | ----------------------------------------------------------------------- | --------------------- |
| `siga_uc.sql`        | Esquema completo (26 tablas, 11 funciones/triggers, índices, sin datos) | ✅ Sí                 |
| `siga_uc_backup.sql` | Backup completo con datos de prueba (~370 registros)                    | ❌ No (por seguridad) |

> **Nota**: El archivo `siga_uc_backup.sql` está ignorado por Git mediante la regla `database/*_backup.sql` en el `.gitignore`. Esto evita subir datos sensibles al repositorio.

## 🛠️ Tecnología

| Componente   | Versión           |
| ------------ | ----------------- |
| PostgreSQL   | 18.4              |
| Encoding     | UTF8              |
| Zona horaria | America/Lima      |
| Extensión    | pgcrypto (bcrypt) |

## 🗂️ Estructura de la Base de Datos

### Módulos y tablas (26 en total)

| Módulo             | Tablas                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Seguridad**      | `roles`, `usuarios`, `recuperacion_password`, `personal`, `asistencia_personal`, `bitacora_auditoria`, `notificaciones`, `credenciales_qr` |
| **Curricular**     | `grados`, `cursos`, `competencias`, `carga_curricular`, `tutores_grado`, `horarios`, `escala_calificacion`                                 |
| **Alumnos**        | `apoderados`, `alumnos`, `expediente_alumno`                                                                                               |
| **Asistencia**     | `asistencia_alumnos`, `resumen_asistencia_curso`                                                                                           |
| **Calificaciones** | `calificaciones`, `notas_finales_area`, `conclusiones_descriptivas`, `actas_bimestrales`, `libretas`                                       |
| **Tesorería**      | `conceptos_pago`, `becas`, `pensiones`, `pre_tickets`, `pagos`, `boletas_electronicas`                                                     |
| **Caja**           | `cajas`, `aperturas_caja`, `movimientos_caja`, `cierres_caja`                                                                              |
| **SIAGIE**         | `exportaciones_siagie`, `estado_carga_docentes`                                                                                            |
| **Reportes**       | `cuadro_merito`, `alumnos_riesgo`                                                                                                          |

### Funciones y Triggers (11)

| Objeto                     | Tipo    | Propósito                                |
| -------------------------- | ------- | ---------------------------------------- |
| `trg_actualizar_timestamp` | Función | Actualiza `fecha_actualizacion`          |
| `trg_usuarios_actualizar`  | Trigger | Auto-update timestamps en usuarios       |
| `trg_auditar_calificacion` | Función | Auditoría de cambios en notas            |
| `trg_calificaciones_audit` | Trigger | Registra en bitácora                     |
| `trg_actualizar_preticket` | Función | Marca pre-ticket como pagado             |
| `trg_pagos_preticket`      | Trigger | Auto-update estado                       |
| `trg_actualizar_pension`   | Función | Marca pensión como pagada                |
| `trg_pagos_pension`        | Trigger | Auto-update estado                       |
| `trg_pago_a_caja`          | Función | Registra ingreso en caja                 |
| `trg_pagos_mov_caja`       | Trigger | Auto-insert movimiento                   |
| `calcular_nota_final_area` | Función | Cálculo de predominancia de competencias |

## 🔄 Cómo restaurar la base de datos

### Opción 1: Restaurar solo estructura (recomendado para desarrollo)

```bash
psql -U postgres -h localhost -d siga_uc -f siga_uc.sql# Base de Datos SIGA-UC
```
