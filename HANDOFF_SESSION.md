# HANDOFF_SESSION.md — SIGA-UC

> **Fecha:** 23/11/2026
> **Fase:** demostración y aprobación. **No es producción real.**
> **Código funcional desplegado:** `85da710` (incluye H80).
> **HEAD documental:** ver `git log -1`.
> **Repo:** `https://github.com/Yarol-Bello/siga-uc.git` · rama `main`.

---

## 1. Estado actual

SIGA-UC está funcional y desplegado en la demo:

| Entorno | URL / estado |
|---|---|
| Frontend | https://siga-uc-web.onrender.com |
| Backend | https://siga-uc-api-prod.onrender.com/api |
| Health | OK, `database: "ok"` |
| Supabase | `siga-uc-prod` (us-west-2), 48 tablas, H74–H80 |
| Año activo | 2026 |
| 2027 | No activo |
| Promociones confirmadas | 0 |
| Acta | 1 ABIERTO |
| Caja | 0 abiertas; se puede aperturar para la demo |

### Datos demo cargados

| Dato | Cantidad |
|---|---:|
| Alumnos | 75 (15 por grado) |
| Docentes activos | 6 |
| Secretaria | 1 |
| Carga curricular | 55 |
| Tutores | 5 |
| Horarios publicados | 145 |
| Pensiones | 750 (38 pagadas, 10 exoneradas) |
| Pagos | 113 base (la verificación reportó 114) |
| Notas finales | 3,300 |
| Calificaciones | 8,700 |
| Asistencias | 4,125 |
| Becas | 3 |
| Conclusiones estructuradas | 3,300 |
| Longitud máxima de conclusión | 252 caracteres |

Los 5 docentes demo antiguos (`99000001`–`99000005`) quedaron **INACTIVOS**.

---

## 2. Último bloque implementado: H80

**Conclusiones descriptivas estructuradas + código de control interno SIAGIE.**

### Base de datos

`database/migracion_h80_conclusiones_estructuradas.sql` agrega a
`conclusiones_descriptivas`:

- `nivel_logro` (AD/A/B/C)
- `avance`
- `dificultad`
- `sugerencia`
- `estado` (`BORRADOR`/`PUBLICADO`)
- auditoría de actualización/publicación

Y a `exportaciones_siagie`:

- `codigo_control`
- `hash_integridad` SHA-256
- `origen`
- `detalle` JSONB

### API

- `GET /api/calificaciones/curso/:id_curso/grado/:id_grado/conclusiones`
- `PUT /api/calificaciones/conclusiones`
- `GET /api/siagie/exportaciones/:codigo/verificar`

### Frontend

- **`/docente/conclusiones`**: nivel, avance, dificultad, sugerencia, contador
  350, plantilla de sugerencia, borrador/publicado y bloqueo por acta cerrada.
- **`/admin/siagie`**: tarjeta para verificar el código de control interno.
- El Excel interno incluye 15 columnas y una hoja `Aviso` con código/hash.

### Importante

El código es **interno**. No es el código oficial de SIAGIE/MINEDU. La integración
oficial requiere la plantilla oficial y conclusiones por competencia; está
documentada en `documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md`.

---

## 3. Credenciales

### Demo Supabase / Render

| Rol | DNI | Contraseña |
|---|---|---|
| ADMIN | `74829102`, `74616052`, `71221313` o `72096799` | **la contraseña real del dueño** |
| SECRETARIA | `73000007` | `Secretaria2026*` |
| DOCENTE | `73000001` | `Docente2026*` |
| ESTUDIANTE | `72000001` | `UC72000001` |

Estudiantes `72000002`–`72000075`: contraseña `UC<DNI>`.

> El ADMIN de Supabase conserva su contraseña original. El seed UAT usó
> `UC2026*` temporalmente y la restauró; `UC2026*` **no** funciona en Supabase.
> Si se necesita un admin demo con `UC2026*`, crear una cuenta separada.

### Local

- Base `siga_uc_uat`: ADMIN `74829102 / UC2026*`.
- Base `siga_uc`: datos demo antiguos; no usar para la demo UAT.

---

## 4. Verificación

| Suite | Resultado |
|---|---|
| `npm run test:e2e` | **102 PASS, 0 FAIL** |
| `npm run test:integridad` en `siga_uc_uat` | **36 PASS, 0 FAIL** |
| `npm run test:integridad` en `siga_uc` | 33 PASS, 2 FAIL de seed conocidos |
| `npm run test:setup` | **5 PASS, 0 FAIL** |
| `npm run smoke` con credenciales UAT | **12 PASS, 0 FAIL** |
| `npm run uat:verify` local | **22 PASS, 0 FAIL** |
| `npm run uat:verify` contra Supabase | **22 PASS, 0 FAIL** |
| Build Angular | OK |

Pruebas nuevas de H80:

- guardar borrador y publicar;
- rechazo de nivel inconsistente (`NIVEL_NO_COINCIDE`);
- rechazo de texto > 350 (`CONCLUSION_LARGA`);
- bloqueo por acta cerrada;
- código de control válido;
- detección de cambios en los datos;
- Excel con 15 columnas y hoja `Aviso`;
- pantalla docente y tarjeta de verificación en navegador.

---

## 5. Cómo arrancar local

El backend y el frontend **no están corriendo** al momento de este handoff.

```powershell
# Backend UAT (http://localhost:3000)
cd siga-uc-backend
$env:PORT='3000'
$env:DB_NAME='siga_uc_uat'
$env:NODE_ENV='development'
$env:ANIO_LECTIVO='2026'
$env:FRONTEND_URL='http://localhost:4200'
node src/app.js
```

```powershell
# Frontend (http://localhost:4200)
cd siga-uc-frontend
npm start
```

Health: `GET http://localhost:3000/api/health`.

---

## 6. Pendientes y próximos pasos

1. **Aprobación de la demo** por la dirección del colegio.
2. **SIAGIE oficial** (solo si el colegio lo pide):
   - obtener la plantilla oficial de SIAGIE;
   - mapear áreas/cursos/competencias;
   - conclusiones por competencia;
   - llenar la plantilla oficial conservando su código y nombre;
   - SIAGIE valida al subir el archivo.
3. **Responsive** de ADMIN, SECRETARÍA y DOCENTE (pausado; el del ESTUDIANTE ya está).
4. **No activar 2027** ni confirmar promociones en Supabase sin decisión.
5. **No cargar datos reales** de menores hasta la aprobación.
6. `INFORME/` es documentación del usuario y **no está trackeada**; no tocar.

---

## 7. Archivos clave

- `AGENTS.md` — resumen operativo y trampas conocidas.
- `documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md` — H80 y límites de SIAGIE.
- `documentacion/17-GUION-DEMOSTRACION.md` — guion actualizado.
- `documentacion/05-API-REST.md` — 168 endpoints.
- `documentacion/04-BASE-DE-DATOS.md` — 48 tablas y columnas H80.
- `database/migracion_h80_conclusiones_estructuradas.sql`.
- `database/demo_h80_conclusiones.sql` — solo demo.
- `siga-uc-backend/scripts/uat-seed.js` y `uat-verify.js`.
- `siga-uc-frontend/src/app/features/docente/conclusiones/`.
- `siga-uc-frontend/src/app/features/admin/siagie/`.

Documentos históricos 15, 16, 18, `HANDOFF_PROMPTS.md`, `docs/INSTALACION.md` y
`docs/GUIA_TESTEO.md` fueron retirados del árbol; siguen en el historial de Git.

---

## 8. Prompt para la nueva sesión

Copiar y pegar:

```text
Estás retomando SIGA-UC, el Sistema Integrado de Gestión Académica de la
I.E.P. Unión Científica (Huancayo, Perú). Es una demo funcional, no producción
real. Lee primero AGENTS.md y HANDOFF_SESSION.md; luego consulta
documentacion/21-CONCLUSIONES-DESCRIPTIVAS-Y-SIAGIE.md si el trabajo es de SIAGIE.

ESTADO ACTUAL
- Repo: https://github.com/Yarol-Bello/siga-uc.git, rama main.
- Código funcional desplegado en Render: 85da710, con H74–H80.
- Frontend: https://siga-uc-web.onrender.com
- Backend: https://siga-uc-api-prod.onrender.com/api (health OK).
- Supabase demo `siga-uc-prod`: 48 tablas, H74–H80, 2026 ACTIVO, 2027 no activo,
  0 promociones, 1 acta ABIERTO, 75 alumnos, 6 docentes activos, 55 carga,
  145 horarios, 750 pensiones, 113 pagos base, 3 becas y 3,300 conclusiones
  estructuradas.
- H80 implementó conclusiones con nivel de logro + avance + dificultad +
  sugerencia, pantalla `/docente/conclusiones`, y código/hash de control interno
  en el Excel SIAGIE (`/admin/siagie`). El código es interno: NO es el código
  oficial de SIAGIE.
- Tests: E2E 102, integridad 36 (UAT), setup 5, smoke 12, uat:verify 22 local y
  22 contra Supabase, build Angular OK.
- El ADMIN de Supabase conserva su contraseña real; UC2026* solo funciona en local.
  DOCENTE 73000001 / Docente2026*; ESTUDIANTE 72000001 / UC72000001;
  SECRETARIA 73000007 / Secretaria2026*.

REGLAS
- No activar 2027, no confirmar promociones y no cargar datos reales de menores.
- No tocar la carpeta INFORME/ (es documentación del usuario y no está trackeada).
- Mantener MVC + DAO, SQL parametrizado, transacciones, respuestas uniformes y roles.
- Antes de cambios de esquema, leer database/README.md y documentacion/04.
- Si el pedido es SIAGIE oficial, pedir primero la plantilla oficial; no inventar
  códigos de SIAGIE.

TAREA DE ESTA SESIÓN
1. Verificar git status, health de Render y estado de Supabase sin modificar datos.
2. Revisar la demo: conclusiones, SIAGIE interno, tesorería, caja, notas y reportes.
3. Ayudar con el siguiente bloque que pida el usuario:
   a) aprobación/ajustes de demo;
   b) responsive ADMIN/SECRETARÍA/DOCENTE;
   c) integración oficial SIAGIE con plantilla oficial;
   d) correcciones o mejoras puntuales.
4. Si se implementa algo: migración idempotente, backend, frontend, tests,
   documentación y commit atómico en español.
```
