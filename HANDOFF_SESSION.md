# HANDOFF_SESSION.md — SIGA-UC

## 1. Cierre de sesión

- **Fecha:** 21/11/2026
- **Commit base de esta sesión:** `6fc6d3e feat(scripts): smoke test de solo lectura para verificar entornos`
- **Commit de esta sesión:** `fix(scripts): smoke test sin credenciales debe fallar y persistir SMOKE_*`
  (el hash exacto queda en `git log -1`).
- **Estado:** smoke test corregido y verificado; las credenciales locales viven en
  `siga-uc-backend/.env` (ignorado); árbol limpio tras el commit.

---

## 2. Entorno

- Todo el desarrollo es **local**:
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:4200`
  - PostgreSQL 18 local, base `siga_uc`.
- En **Render** hay una versión **ANTIGUA** con **DATOS DE PRUEBA**. **No hay datos reales.**
- **No hay staging.**
- La BD local se recreó con la secuencia oficial: **39 tablas** y el índice
  `ux_pago_pension_activo` **existe** (verificado el 21/11/2026).
- Datos locales tras la recreación: **21 alumnos, 29 usuarios, 10 pagos de seed
  (+1 pago de prueba existente), 180 pensiones, 0 pensiones duplicadas**.
- Credenciales de prueba: `docs/CREDENCIALES.md`. La clave de PostgreSQL local está en
  `siga-uc-backend/.env` (`DB_PASSWORD`); no se escribe en este documento.
- `npm run smoke` existe (`siga-uc-backend/scripts/smoke.js`): 11 pruebas de solo lectura,
  timeout de 10 s por petición. Lee las credenciales de `SMOKE_*` y de
  `siga-uc-backend/.env`; nunca las imprime. Códigos de salida: `0` solo sin FAIL y sin
  SKIP; `1` si hay FAIL; `2` si hay SKIP sin `SMOKE_ALLOW_SKIP=1`.
- Verificación local del 21/11/2026: **11 PASS, 0 FAIL, 0 SKIP** (exit 0) con las tres
  cuentas; **3 PASS, 0 FAIL, 8 SKIP** (exit 2) sin credenciales.

---

## 3. Hallazgos CERRADOS

| Hallazgo | Detalle | Commit |
|---|---|---|
| H01 | GET por rol/ownership | `b6f4a21` (+ verificación `ca5e742`) |
| H02 | Revalidar estado en cada request | `b6f4a21` |
| H03 | Rate limit en login, recuperación y validar-token | `b6f4a21`, `408c451` |
| H04 | Nota final automática al guardar | `f02f88a` |
| H06 | Acta cerrada bloquea notas | `f02f88a` |
| H07 (A+B) | Auditoría de seguridad, dinero, alumnos, personal, académico, SIAGIE, notificaciones y descargas | `d8800e4`, `76573ac` |
| H08 | Pago solo a caja abierta | `81aa521` |
| H09 | Monto, pensión, alumno y caja coherentes | `408c451` |
| H10 | Numeraciones con advisory locks | `c65770c` |
| H11 | Errores visibles en guardados masivos | `48d119a` |
| H12 | Año lectivo y conceptos centralizados | `e483245` |
| H15 | Notificaciones personalizadas + buscador de alumnos | `e099173`, `e793ee3` |
| H17 | Errores SQL no expuestos | `b6f4a21` |
| H18 | Cambio obligatorio de contraseña | `33be57a` |
| H19 | Retiro desactiva usuario y congela expediente | `e5f7055` |
| H20 | Edición sincroniza nombres en `usuarios` | `e5f7055` |
| H23 (parcial) | Paginación en alumnos y bitácora | `8a4727b` |
| H25 | Backup automático | `e6e5296` |
| H32 | Anulación de pagos | `f2c258c` |
| H34 | PDFs reales de libretas, boletas y actas | `9b70b94`, `95f08f3` |
| H37 | Concepto de pensión valida mes/año | `c65770c` |
| H38 | Doble pago concurrente bloqueado | `c65770c` |
| H39 | Fechas de negocio en hora de Lima | `399d35e` |
| H40 | Secuencia de instalación corregida | `def839e` |

---

## 4. Hallazgos PENDIENTES

| Hallazgo | Detalle | Severidad | Esfuerzo |
|---|---|---|---|
| H05 | SIAGIE limitado a 4 cursos y primera hoja | Alta | M |
| H21 | Cambio de rol no regenera QR ni permisos históricos | Media | S |
| H22 | N+1 en tesorería (pensiones por alumno) | Media | S/M |
| H23 | Paginación faltante en personal, pagos y pre-tickets | Media | M |
| H24 | Sin tests automatizados ni CI/CD | Media | L |
| H26 | Documentación histórica desactualizada | Baja | S |
| H27 | `.env.example` usa SMTP y no Resend | Baja/Media | S |
| H28 | `siga_uc.sql` con meta-orden `\restrict` de psql 18 | Baja | S |
| H29 | Tablas de reportes no persistidas | Baja | S |
| H30 | Título e identidad menores | Baja | S |
| H31 | Endpoint de logout sin uso | Baja | S |
| H33 | Sin CRUD de horarios, competencias y conclusiones | Media | L |
| H35 | Estudiantes sin pantalla de libreta | Baja | S |
| H36 | Rate limit de login por IP compartida en red escolar | Media | S |

---

## 5. Decisiones de negocio tomadas

1. Las pensiones se pagan **completas**; no existen pagos parciales.
2. Las boletas son **comprobantes internos**; no van a SUNAT.
3. La anulación de un pago genera un **EGRESO** con el mismo medio de pago.
4. La auditoría registra **escrituras, accesos y descargas**; **no lecturas**.
5. El despliegue se hará primero en el **Render actual como ensayo**, con datos de
   prueba, antes del despliegue definitivo.
6. Antes de desplegar se ejecutará un **smoke test de solo lectura**.

---

## 6. Trampas conocidas

- El backend fija la sesión de PostgreSQL en `America/Lima`; el `TZ` del **proceso**
  también debe ser `America/Lima` en Render (variable de entorno, no en JS).
- `siga_uc_completo.sql` es un **dump COMPLETO**: no cargarlo junto con `siga_uc.sql`.
- Orden oficial: `siga_uc_completo.sql` → `migracion_h32_anulacion_pagos.sql` →
  `migracion_h10_h38_concurrencia_pagos.sql` → `migracion_h07_auditoria.sql` →
  migraciones futuras, en ese orden.
- `express-rate-limit` usa memoria: reiniciar el backend limpia los contadores.
- 5 fallos de login bloquean 15 min por IP; en red escolar compartida afecta a todos
  (H36, pendiente).
- El guardado masivo devuelve `{ guardados, total_errores, errores[] }`; la UI solo
  muestra éxito si `total_errores = 0`.
- La auditoría se escribe **después** del COMMIT: un fallo de auditoría no revierte
  pagos ni caja.
- El índice `ux_pago_pension_activo` existe en local; si una base tiene pagos
  `PAGADO` duplicados, la migración H10/H38 lo omite y avisa.
- H23 es parcial: faltan personal, pagos y pre-tickets.
- `npm run smoke` carga `.env` automáticamente y no sobrescribe variables ya definidas en
  el proceso. Su único POST es `/auth/login` (actualiza `ultimo_login` y registra el LOGIN
  en la bitácora); el resto son GET. No imprime tokens ni contraseñas.
- La cuenta docente `10293847` tiene `requiere_cambio_password = TRUE` y su contraseña
  documentada anteriormente ya no es válida. Para el smoke usar otra cuenta docente activa
  (por ejemplo `20394812`), sin modificar datos ni contraseñas.
- El login correcto no consume el rate limit (`skipSuccessfulRequests`); un smoke con
  contraseña incorrecta sí consume 1 de los 5 intentos de la ventana de 15 min.

---

## 7. Próximo paso exacto

1. **Ensayo de despliegue en el Render actual** con datos de prueba:
   - Configurar `NODE_ENV=production`, `FRONTEND_URL`, `TZ=America/Lima`,
     `JWT_SECRET` largo y la conexión (`DATABASE_URL`/`DB_SSL` o `DB_*`).
   - **Resend:** verificar el dominio con SPF/DKIM. Sin eso los correos solo llegan a
     la cuenta propia.
   - **Backups:** comprobar que `pg_dump` existe en el entorno de Render; si no,
     `npm run backup` falla en producción y hay que usar los backups del proveedor.
   - **Frontend:** confirmar que `environment.prod.ts` apunta a la URL real del backend
     y que el build genera `404.html`.
   - Aplicar las migraciones pendientes en orden.
   - Configurar en Render las variables `SMOKE_BASE_URL` y `SMOKE_*` (o pasarlas solo
     al ejecutar; nunca commitearlas) y correr el smoke contra el ensayo:
     ```powershell
     $env:SMOKE_BASE_URL="https://<backend-de-ensayo>/api"
     $env:SMOKE_ADMIN_DNI="<dni>"; $env:SMOKE_ADMIN_PASSWORD="<clave>"
     $env:SMOKE_DOCENTE_DNI="<dni>"; $env:SMOKE_DOCENTE_PASSWORD="<clave>"
     $env:SMOKE_ESTUDIANTE_DNI="<dni>"; $env:SMOKE_ESTUDIANTE_PASSWORD="<clave>"
     cd siga-uc-backend
     npm run smoke
     ```
   - Criterio: **11 PASS, 0 FAIL, 0 SKIP**, exit code `0`. Un FAIL (exit 1) o un SKIP
     inesperado (exit 2) bloquea el ensayo. `SMOKE_ALLOW_SKIP=1` solo se usa para
     diagnósticos parciales, nunca como aceptación.
2. Revisar en Render los logs del backend y confirmar que el smoke no dejó escrituras
   de negocio (solo `ultimo_login` y los registros de LOGIN en la bitácora).
3. Solo si el ensayo pasa: planificar el **despliegue definitivo** y la carga de
   datos reales.

---

## 8. Verificar el entorno en 4 comandos

```powershell
git log -1 --oneline
psql -U postgres -d siga_uc -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'; SELECT indexname FROM pg_indexes WHERE indexname='ux_pago_pension_activo';"
# Requiere el backend corriendo en localhost:3000
curl.exe -s http://localhost:3000/api/health
cd siga-uc-backend; npm run smoke   # con las variables SMOKE_* definidas
```

El primero confirma el commit; el segundo debe devolver **39** y
`ux_pago_pension_activo`; el tercero debe devolver `success: true` y
`database: "ok"` **con el backend en marcha**; el cuarto debe terminar en
**11 PASS, 0 FAIL** y exit code `0`.
