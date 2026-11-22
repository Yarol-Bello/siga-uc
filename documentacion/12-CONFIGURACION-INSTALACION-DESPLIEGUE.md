# 12 — Configuración, Instalación y Despliegue

## 1. Requisitos

| Herramienta | Versión usada | Nota |
|---|---|---|
| Git | Última | Clonado |
| nvm-windows | 1.1.12+ | Gestión de Node |
| Node.js | 20.20.2 LTS | Backend y build frontend |
| npm | 10.8.2+ | — |
| Angular CLI | 21.x | `npm i -g @angular/cli@21` |
| PostgreSQL | 18.4 | Extensiones `pgcrypto`, `unaccent`, `uuid-ossp` |
| Cuenta Resend | — | Para correos reales (opcional) |

> En cada terminal nueva: `nvm use 20`.

---

## 2. Variables de entorno (backend)

Archivo: `siga-uc-backend/.env` (ignorado por Git). Base: `.env.example`, que **está
desactualizado** (habla de SMTP; el código usa Resend).

### 2.1 Variables realmente usadas

| Variable | Obligatoria | Uso |
|---|---|---|
| `NODE_ENV` | No (default `development`) | Morgan, mensajes de error |
| `PORT` | No (default 3000) | Puerto API |
| `FRONTEND_URL` | **Sí en producción** | CORS y enlaces de recuperación (en producción aborta si falta) |
| `DB_HOST` | Sí, salvo `DATABASE_URL` | PostgreSQL |
| `DB_PORT` | Sí, salvo `DATABASE_URL` | PostgreSQL |
| `DB_USER` | Sí, salvo `DATABASE_URL` | PostgreSQL |
| `DB_PASSWORD` | Sí, salvo `DATABASE_URL` | PostgreSQL |
| `DB_NAME` | Sí, salvo `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | **Sí** | Firma de tokens; en producción exige ≥32 caracteres y valor no de ejemplo |
| `JWT_EXPIRES_IN` | No (default `8h`) | Expiración |
| `ANIO_LECTIVO` | Recomendada (default año calendario) | Año lectivo activo |
| `APP_NAME` | No (`SIGA-UC`) | Health/branding |
| `APP_VERSION` | No (`1.0.0`) | Health |
| `TZ` | Recomendada | Debe definirse en el entorno del proceso (Windows local y Render), no en JS |
| `RESEND_API_KEY` | Para correos | API Resend |
| `EMAIL_FROM` | Para correos | Remitente verificado |
| `DATABASE_URL` | Opcional (API y backup) | Cadena completa; prioridad sobre `DB_*` |
| `DB_SSL` | Opcional (API y backup) | `true` activa SSL; también se detecta `sslmode=require` en la URL |
| `DB_POOL_MAX` | No (20) | Máximo de conexiones del pool |
| `DB_IDLE_TIMEOUT_MS` | No (30000) | Cierre de conexiones inactivas |
| `DB_CONNECTION_TIMEOUT_MS` | No (5000) | Timeout para obtener conexión |
| `BACKUP_DIR` | Opcional (backup) | Carpeta de salida; default `siga-uc-backend/backups` |

### 2.2 Variables heredadas (SMTP)

`env.js` todavía exporta `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
`SMTP_PASSWORD`, `SMTP_FROM_NAME`, pero `emailService.js` **no las usa**. Usa Resend.

> Si ves `SMTP` en `.env.example`, `docs/INSTALACION.md` o `README.md`, es documentación
> histórica. El servicio real es Resend.

### 2.3 Ejemplo actualizado

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:4200

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_password
DB_NAME=siga_uc

# Opcional para backup (ver sección 9)
DATABASE_URL=
DB_SSL=false
BACKUP_DIR=

JWT_SECRET=una_clave_larga_y_aleatoria
JWT_EXPIRES_IN=8h

ANIO_LECTIVO=2026

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=SIGA-UC <no-reply@tudominio.com>

APP_NAME=SIGA-UC
APP_VERSION=1.0.0
TZ=America/Lima
```

> `env.js` exige `JWT_SECRET` y, si no hay `DATABASE_URL`, las `DB_*`. En producción además
> exige `FRONTEND_URL` y un `JWT_SECRET` de al menos 32 caracteres y distinto de los valores
> de ejemplo. `TZ` **no** se aplica desde JavaScript: debe definirse como variable de entorno
> del proceso (Render > Environment). El healthcheck consulta la BD y devuelve `503` si no
> responde.

---

## 3. Base de datos

### 3.1 Instalación nueva — dos escenarios excluyentes

#### A. Desarrollo / demostración

`siga_uc_completo.sql` es un **dump completo**: esquema (40 tablas), funciones, triggers,
índices y **datos ficticios de demostración** (21 alumnos, apoderados, pagos y pensiones de
ejemplo). **Nunca debe usarse en producción**: contiene más de 140 pensiones marcadas
`PAGADO` sin un pago que las respalde (144 medidas por `test:integridad` en la base local).

```powershell
createdb -U postgres siga_uc

psql -U postgres -d siga_uc -f database/siga_uc_completo.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
psql -U postgres -d siga_uc -f database/migracion_h45_pensiones_anuladas.sql
psql -U postgres -d siga_uc -f database/migracion_h47_horarios.sql
# ...y las migraciones futuras, en orden.
```

#### B. Producción (base nueva, sin datos ficticios)

```powershell
createdb -U postgres siga_uc

psql -U postgres -d siga_uc -f database/siga_uc.sql
psql -U postgres -d siga_uc -v admin_password="TuClaveTemporal" -f database/seed_produccion.sql
psql -U postgres -d siga_uc -f database/migracion_h32_anulacion_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h10_h38_concurrencia_pagos.sql
psql -U postgres -d siga_uc -f database/migracion_h07_auditoria.sql
psql -U postgres -d siga_uc -f database/migracion_h45_pensiones_anuladas.sql
psql -U postgres -d siga_uc -f database/migracion_h47_horarios.sql
# ...y las migraciones futuras, en orden.
```

`seed_produccion.sql` crea solo catálogos y configuración: roles, grados, cursos,
competencias, escala AD/A/B/C, conceptos de pago del año en curso, carga curricular,
una caja principal y **un único usuario ADMIN** (`74829102`) con
`requiere_cambio_password = TRUE`. La contraseña se pasa con `-v admin_password`;
si falta o está vacía, el script aborta. No crea alumnos, apoderados, pagos, pensiones,
calificaciones, asistencias, movimientos, bitácora ni becas.

> **No mezclar escenarios.** `siga_uc.sql` y `siga_uc_completo.sql` son excluyentes:
> cargar ambos duplica objetos (`ya existe una función «calcular_nota_final_area»`).

### 3.2 Verificar

```powershell
psql -U postgres -d siga_uc -c "\dt"
```

Debe listar **40 tablas** (no 26; la documentación antigua está mal).

```powershell
psql -U postgres -d siga_uc -c "SELECT indexname FROM pg_indexes WHERE indexname = 'ux_pago_pension_activo';"
```

El índice de doble pago aparece si la base no tenía duplicados históricos; la migración
avisa y lo omite si los encuentra.

En una base de producción recién sembrada, verificar además:

```sql
SELECT
  (SELECT COUNT(*) FROM usuarios) AS usuarios,   -- 1
  (SELECT COUNT(*) FROM alumnos) AS alumnos,     -- 0
  (SELECT COUNT(*) FROM pagos) AS pagos,         -- 0
  (SELECT COUNT(*) FROM pensiones) AS pensiones; -- 0
```

Y ejecutar la suite de invariantes:

```powershell
cd siga-uc-backend
npm run test:integridad   # 10 PASS, 0 FAIL
```

### 3.5 Extensiones

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

`siga_uc.sql` y el dump ya las incluyen; `seed_produccion.sql` asegura `pgcrypto`
(idempotente). `pgcrypto` es indispensable para `crypt()` y `gen_salt()`.

---

## 4. Backend local

```powershell
nvm use 20
cd siga-uc-backend
copy .env.example .env
notepad .env
npm install
npm run dev
```

Esperado:

```text
🚀 Iniciando SIGA-UC Backend...
✅ Conectado a PostgreSQL - Base de datos: siga_uc
✅ Test de conexión exitoso
🌐 Servidor: http://localhost:3000
📊 Health check: http://localhost:3000/api/health
```

El servidor arranca aunque la BD falle o el correo no esté configurado; muestra advertencias.

### Scripts

| Script | Comando |
|---|---|
| Desarrollo | `npm run dev` (nodemon) |
| Producción | `npm start` (`node src/app.js`) |
| Tests | `npm test` → no implementado |

---

## 5. Frontend local

```powershell
cd siga-uc-frontend
npm install
ng serve
```

Esperado: `http://localhost:4200`.

`environment.ts` apunta a `http://localhost:3000/api`.

### Build

```powershell
npm run build
```

- Compila a `dist/siga-uc-frontend/browser`.
- `postbuild` copia `index.html` a `404.html` para fallback SPA.

---

## 6. Orden de arranque diario

```powershell
# Terminal 1
nvm use 20
cd siga-uc-backend
npm run dev

# Terminal 2
cd siga-uc-frontend
ng serve
```

Verificar PostgreSQL:

```powershell
Get-Service *postgres*
```

Debe estar `Running`.

---

## 7. Despliegue en producción

### 7.1 Backend (Render u otro PaaS)

1. Crear Web Service desde el repo.
2. Root directory: `siga-uc-backend`.
3. Build: `npm install`.
4. Start: `npm start`.
5. Variables:
   - `NODE_ENV=production`
   - `DATABASE_URL` (recomendada) **o** `DB_*`; `DB_SSL=true` si el proveedor exige SSL
   - `JWT_SECRET` de al menos 32 caracteres, distinto de los valores de ejemplo
   - `FRONTEND_URL=https://tu-frontend` (**obligatoria**)
   - `TZ=America/Lima` como variable del proceso
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
6. Health check: `/api/health` (consulta `SELECT 1` con timeout de 2 s).
7. El servidor escucha en `0.0.0.0` y usa `process.env.PORT`.

**CORS:** `app.js` permite `localhost:4200`, `localhost:3000` y `process.env.FRONTEND_URL`.
Configurar el dominio real en `FRONTEND_URL`.

**Conexión BD:** `DATABASE_URL` tiene prioridad sobre `DB_*`; el SSL se activa con
`DB_SSL=true` o con `sslmode=require|verify-ca|verify-full` en la URL. El pool usa
`DB_POOL_MAX` (20), `DB_IDLE_TIMEOUT_MS` (30000) y `DB_CONNECTION_TIMEOUT_MS` (5000). Un error
transitorio del pool se registra y **no** tumba la API.

**Verificación TLS:** con SSL activo el pool exige un certificado válido contra la CA
indicada en `DB_SSL_CA` o, por defecto, `siga-uc-backend/certs/supabase-ca.crt` (CA pública
de Supabase, versionada en el repo). Si la CA no se puede leer, el arranque aborta. No se
usa `rejectUnauthorized: false`.

**Observabilidad:** en producción morgan usa `combined` con un id de petición de 8 caracteres
también presente en los logs de error; se registran queries de más de 500 ms (sin parámetros).
`unhandledRejection` se registra sin matar el proceso; `uncaughtException` y `SIGTERM` cierran
el servidor y el pool de forma ordenada.

**Fechas y zona horaria:** `TZ=America/Lima` debe existir en el **entorno del proceso**:

- Windows local: `$env:TZ = "America/Lima"` antes de `npm run dev` (o definirla como variable
  de usuario/sistema).
- Render: Environment → `TZ=America/Lima`.

Definir `TZ` desde JavaScript llega tarde: Node fija la zona al arrancar. Además, las columnas
de fecha/hora son `timestamp without time zone`; cambiar la zona del servidor de BD en
producción afecta a los valores **nuevos**, no a los ya guardados. El pool fija
`timezone=America/Lima` y al arrancar se verifica con `SHOW timezone` (si no coincide, solo
emite un warning).

**Base de datos:** crear la instancia PostgreSQL y, en producción, ejecutar
`database/siga_uc.sql` + `database/seed_produccion.sql` (con `-v admin_password`) +
migraciones en orden. **No** cargar `siga_uc_completo.sql` en producción: es el dump de
demo con alumnos y pensiones ficticias. Verificar extensiones y ejecutar
`npm run test:integridad` antes de abrir el servicio. El admin inicial debe cambiar su
contraseña en el primer login.

### 7.2 Frontend (Render Static Site / Vercel / Netlify)

1. Root: `siga-uc-frontend`.
2. Build: `npm run build`.
3. Publish: `dist/siga-uc-frontend/browser`.
4. Configurar `environment.prod.ts` con la URL real de la API **antes** del build.
5. Fallback SPA:
   - Render: `404.html` generado por `postbuild`.
   - Netlify: `_redirects` (`/* /index.html 200`).
   - Vercel: rewrite a `index.html`.

**URL actual en el repo:** `https://siga-uc-api.onrender.com/api`. Cambiar si el servicio
tiene otro nombre.

### 7.3 Checklist de despliegue

- [ ] PostgreSQL creado con `siga_uc.sql` + `seed_produccion.sql` + migraciones (sin dump demo).
- [ ] `npm run test:integridad` → 10 PASS, 0 FAIL.
- [ ] Confirmado: 0 alumnos, 0 pagos, 0 pensiones, 1 usuario.
- [ ] Admin inicial cambió su contraseña temporal.
- [ ] Variables de entorno cargadas.
- [ ] `JWT_SECRET` distinto al de desarrollo.
- [ ] `FRONTEND_URL` y CORS correctos.
- [ ] Resend verificado (dominio/remitente).
- [ ] API responde `/api/health`.
- [ ] Frontend apunta a la API correcta.
- [ ] Fallback SPA configurado.
- [ ] HTTPS activo.
- [ ] Backup inicial ejecutado (`npm run backup`).
- [ ] Cron Job diario 02:00 y disco persistente o almacenamiento externo configurado.
- [ ] Restauración de prueba verificada.
- [ ] Smoke test por rol.

---

## 8. Correo con Resend

1. Crear cuenta en Resend.
2. Verificar dominio o usar el remitente de pruebas.
3. Generar API key.
4. Configurar `RESEND_API_KEY` y `EMAIL_FROM`.
5. `emailService.verificarConexion()` solo comprueba que la key exista, no hace ping real.
6. Si falla, las notificaciones se guardan y el correo se omite.

**Limitación:** el remitente `onboarding@resend.dev` solo puede enviar a correos autorizados
en modo prueba. Para producción, verificar dominio.

> `app.js` conserva el mensaje histórico “SMTP verificado correctamente” aunque el servicio
> real sea Resend. No es un error funcional, solo nomenclatura heredada.

---

## 9. Backups

### 9.1 Backup local

El script genera un `.sql` en `siga-uc-backend/backups/` y **no modifica ni borra datos** de la
base:

```powershell
cd siga-uc-backend
npm run backup
```

Salida esperada:

```text
💾 Generando backup de localhost:5432/siga_uc...
   Destino: ...\siga-uc-backend\backups\backup_siga_uc_2026-11-20_02-00-00.sql
✅ Backup generado: backup_siga_uc_2026-11-20_02-00-00.sql (143.6 KB)
```

- Nombre seguro para Windows/Linux/macOS: `backup_siga_uc_YYYY-MM-DD_HH-mm-ss.sql`.
- Usa `DATABASE_URL` si está definido; si no, `DB_*`.
- Si `pg_dump` no está instalado, muestra un mensaje indicando instalar PostgreSQL Client.
- La carpeta `siga-uc-backend/backups/` está excluida por `.gitignore`.

### 9.2 Restauración de prueba

Se recomienda restaurar en una base desechable, nunca directamente sobre producción:

```powershell
createdb -U postgres siga_uc_restore_test
psql -U postgres -d siga_uc_restore_test -f backups\backup_siga_uc_2026-11-20_02-00-00.sql
psql -U postgres -d siga_uc_restore_test -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
dropdb -U postgres siga_uc_restore_test
```

La restauración de prueba debe devolver **40 tablas** y datos en `usuarios`, `alumnos`, etc.

### 9.3 Variables para Supabase

En `.env` (local) o en las variables de Render:

```env
# Opción 1: cadena de conexión (recomendada para Supabase)
DATABASE_URL=postgresql://postgres.<proyecto>:<password>@<host>:5432/postgres?sslmode=require

# Opción 2: variables individuales
DB_HOST=<host>
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<password>
DB_NAME=postgres
DB_SSL=true

# Opcional: ruta a la CA para verificar TLS (por defecto certs/supabase-ca.crt)
DB_SSL_CA=

# Opcional: carpeta de salida (por defecto siga-uc-backend/backups)
BACKUP_DIR=
```

> Para `pg_dump` usar la **conexión directa o session pooler** de Supabase (puerto 5432).
> Evitar el transaction pooler (puerto 6543): puede no soportar `pg_dump`.
> Si usas `DATABASE_URL`, no hace falta duplicar `DB_*` para el backup.

### 9.4 Render: Cron Job diario a las 02:00

1. Crear un **Render Cron Job** (no un Web Service) con schedule `0 2 * * *` y zona
   `America/Lima`.
2. Comando: `npm run backup`.
3. El entorno debe incluir `postgresql-client` (`pg_dump`). Si la imagen nativa de Render no lo
   trae, usar un Dockerfile con:

   ```dockerfile
   FROM node:20-bookworm-slim
   RUN apt-get update && apt-get install -y postgresql-client \
       && rm -rf /var/lib/apt/lists/*
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --omit=dev
   COPY . .
   CMD ["npm", "run", "backup"]
   ```

   > Este Dockerfile va en `siga-uc-backend/` y el **Root Directory** del servicio debe ser
   > `siga-uc-backend`.

   > La versión de `pg_dump` debe ser **igual o superior** a la del servidor (Supabase). Si
   > Debian instala PostgreSQL 15 y Supabase usa 17, instalar `postgresql-client-17` desde el
   > repositorio oficial de PostgreSQL (PGDG).

4. **Disco persistente:** el filesystem de Render es efímero. Agregar un **Persistent Disk** y
   montarlo, por ejemplo, en `/var/data/siga-uc-backups`; luego definir:

   ```env
   BACKUP_DIR=/var/data/siga-uc-backups
   ```

   Sin disco persistente (o sin subir el archivo a S3/Supabase Storage/Drive), el backup se
   pierde en el siguiente redeploy/restart.

5. Configurar `DATABASE_URL` de Supabase con `sslmode=require`. Si el Cron Job no tiene acceso
   a la red privada de Supabase, usar la conexión pública/directa.

> Los backups gestionados/PITR de Supabase dependen del plan. Este Cron Job es un complemento,
> no un reemplazo de las copias gestionadas del proveedor.

### 9.5 Alternativa local: Programador de tareas de Windows

Crear una tarea diaria a las 02:00:

- Programa: `npm.cmd`
- Argumentos: `run backup`
- Iniciar en: `C:\ruta\a\siga-uc\siga-uc-backend`

### 9.6 Seguridad y retención

- Los `.sql` contienen datos personales: restringir permisos y considerar cifrado en reposo.
- No subir `backups/` a Git; ya está en `.gitignore`.
- El script **no elimina backups anteriores**. La retención se gestiona manualmente o con una
  tarea externa (por ejemplo, borrar archivos con más de 30 días).
- Probar la restauración periódicamente (semanal o mensual).

---

## 10. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `node: command not found` | nvm no activado | `nvm use 20` |
| `password authentication failed` | `DB_PASSWORD` incorrecta | Corregir `.env` |
| `database siga_uc does not exist` | No se ejecutó el SQL | Crear/restaurar |
| `Port 3000 already in use` | Otro proceso | `netstat -ano \| findstr :3000` |
| `Port 4200 already in use` | Otro Angular | `ng serve --port 4300` |
| `relation "usuarios" does not exist` | SQL no ejecutado o BD equivocada | Revisar `DB_NAME` |
| `function crypt(...) does not exist` | Falta `pgcrypto` | `CREATE EXTENSION pgcrypto` |
| `\restrict: command not found` | `psql` antiguo | Usar `psql` 18 o quitar la línea |
| Correos no llegan | Resend no configurado | Revisar `RESEND_API_KEY`/`EMAIL_FROM` |
| Error 401 en todo | Token expirado | Volver a iniciar sesión |
| Pantalla en blanco tras deploy | Falta fallback SPA | Configurar `404.html`/rewrite |
| CORS bloqueado | Dominio no permitido | Ajustar `FRONTEND_URL` |
| SIAGIE sin notas | No hay `notas_finales_area` | Calcular notas finales |
| Fecha desfasada | Zona horaria | `TZ=America/Lima` en el entorno del proceso (Render), no en JS |
| `/api/health` responde 503 | La BD no responde en 2 s | Revisar credenciales, SSL (`DB_SSL`/`sslmode`) y conectividad |

---

## 11. Estructura de archivos de configuración

| Archivo | Función |
|---|---|
| `siga-uc-backend/.env` | Secretos y configuración local (no versionado) |
| `siga-uc-backend/.env.example` | Plantilla histórica (SMTP; actualizar a Resend) |
| `siga-uc-frontend/src/environments/environment.ts` | API local |
| `siga-uc-frontend/src/environments/environment.prod.ts` | API producción |
| `siga-uc-frontend/angular.json` | Build, budgets, fileReplacements |
| `database/siga_uc_completo.sql` | Demo: esquema + datos ficticios; no usar en producción |
| `database/siga_uc.sql` | Esquema base para producción (40 tablas, sin datos) |
| `database/seed_produccion.sql` | Catálogos + admin inicial; requiere `-v admin_password` |
| `database/migracion_h45_pensiones_anuladas.sql` | Añade `ANULADO` a pensiones y regulariza deuda futura de retirados |
| `database/migracion_h47_horarios.sql` | Crea `periodos_clase`, reemplaza `horarios` y agrega restricciones/triggers de horarios |
| `database/migracion_*.sql` | Parches idempotentes para bases existentes |
| `database/siga_uc_backup.sql` | Backup local (ignorado) |

---

## 12. Notas de mantenimiento

- Actualizar `environment.prod.ts` si cambia la URL de la API.
- Actualizar `FRONTEND_URL` si cambia el dominio.
- Revisar `CORS` al añadir un nuevo frontend.
- Rotar `JWT_SECRET` invalida todas las sesiones (efecto deseado en incidentes).
- Si se cambia de proveedor de correo, `emailService` es el único punto a tocar.
- Si se migra a otra BD, revisar triggers y funciones (son específicos de PostgreSQL).
