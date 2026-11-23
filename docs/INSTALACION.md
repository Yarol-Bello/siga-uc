# Guía de Instalación — SIGA-UC

Sistema Integrado de Gestión Académica para la I.E.P. Unión Científica.

> **Guía histórica.** Para la instalación vigente usar
> `documentacion/12-CONFIGURACION-INSTALACION-DESPLIEGUE.md` y `database/README.md`.
> El correo usa **Resend**, no SMTP; la exportación SIAGIE es interna y ya no carga
> plantillas.

Esta guía asume Windows 10/11 y primera instalación del proyecto.

---

## 1. Requisitos previos

Instala en este orden exacto:

| # | Herramienta | Versión | Enlace |
|---|-------------|---------|--------|
| 1 | Git | Última | https://git-scm.com/download/win |
| 2 | nvm-windows | 1.1.12+ | https://github.com/coreybutler/nvm-windows/releases |
| 3 | PostgreSQL | 18.x | https://www.postgresql.org/download/windows/ |
| 4 | VS Code | Última | https://code.visualstudio.com/ |

Al instalar PostgreSQL, anota la contraseña del usuario postgres y deja el puerto 5432.

---

## 2. Configurar Node.js 20 con nvm

Abre CMD como Administrador y ejecuta:

    nvm install 20.20.2
    nvm use 20.20.2

Verifica:

    node -v

Debe imprimir v20.20.2.

    npm -v

Debe imprimir 10.8.2 o superior.

Instalar Angular CLI 21 globalmente:

    npm install -g @angular/cli@21
    ng version

---

## 3. Clonar el repositorio

    cd C:\Users\TU_USUARIO\Documents\Proyectos
    git clone https://github.com/TU_USUARIO/siga-uc.git
    cd siga-uc

---

## 4. Crear la base de datos siga_uc

### Opción A — Con pgAdmin 4

1. Abre pgAdmin y conéctate al servidor local.
2. Clic derecho en Databases > Create > Database.
3. Configura: Database = siga_uc, Owner = postgres, Encoding = UTF8, Template = template0.
4. Clic derecho sobre siga_uc > Query Tool.
5. Abre `database/siga_uc_completo.sql` y ejecútalo con F5 (es el dump completo:
   esquema + datos + funciones + índices).
6. Ejecuta después, en orden, las migraciones de `database/migracion_*.sql`.

### Opción B — Con CMD

    createdb -U postgres siga_uc
    psql -U postgres -d siga_uc -f C:\ruta\a\siga-uc\database\siga_uc_completo.sql
    psql -U postgres -d siga_uc -f C:\ruta\a\siga-uc\database\migracion_h32_anulacion_pagos.sql
    psql -U postgres -d siga_uc -f C:\ruta\a\siga-uc\database\migracion_h10_h38_concurrencia_pagos.sql
    psql -U postgres -d siga_uc -f C:\ruta\a\siga-uc\database\migracion_h07_auditoria.sql

> No cargar `database/siga_uc.sql` junto con el completo: es solo la referencia del esquema
> y provocaría errores de “ya existe”.

Verificar:

    psql -U postgres -d siga_uc -c "\dt"

Debe mostrar 43 tablas base (44 en local si existe `horarios_h47_backup`).

---

## 5. Configurar el Backend

    cd siga-uc-backend
    copy .env.example .env
    notepad .env

Edita estas líneas dentro de .env:

- DB_PASSWORD: la contraseña de tu PostgreSQL.
- JWT_SECRET: una clave larga y segura.
- RESEND_API_KEY / EMAIL_FROM: opcional, solo si quieres correos reales. No hay SMTP.

Instalar y levantar:

    npm install
    npm run dev

Debe mostrar:

    Servidor en http://localhost:3000
    Base de datos conectada

---

## 6. Configurar el Frontend

Abre OTRA terminal CMD nueva.

    cd C:\Users\TU_USUARIO\Documents\Proyectos\siga-uc\siga-uc-frontend
    npm install
    ng serve

Debe mostrar:

    Compiled successfully.
    Local: http://localhost:4200/

Abre el navegador en http://localhost:4200.

---

## 7. Credenciales de prueba

Ver docs/CREDENCIALES.md.

---

## 8. Comandos de arranque diario

Terminal 1 — Backend:

    nvm use 20
    cd C:\Users\TU_USUARIO\Documents\Proyectos\siga-uc\siga-uc-backend
    npm run dev

Terminal 2 — Frontend:

    cd C:\Users\TU_USUARIO\Documents\Proyectos\siga-uc\siga-uc-frontend
    ng serve

Verificar PostgreSQL:

    Get-Service *postgres*

Debe decir Running.

---

## 9. Problemas comunes

| Error | Causa | Solución |
|-------|-------|----------|
| node: command not found | nvm no activado | nvm use 20.20.2 |
| password authentication failed | Contraseña mal en .env | Editar DB_PASSWORD |
| database siga_uc does not exist | No se ejecutó el SQL | Ejecutar database/siga_uc.sql |
| Port 3000 already in use | Otro proceso usa el puerto | netstat -ano findstr :3000 |
| Port 4200 already in use | Otro Angular corriendo | ng serve --port 4300 |
| Error de Resend | Key inválida o remitente no verificado | Revisar `RESEND_API_KEY` y `EMAIL_FROM` |

---

## 10. Resend opcional

Sin `RESEND_API_KEY`:

- Las notificaciones se guardan en BD.
- Aparecen en la campanita.
- NO se envían correos reales.

Para correos reales:

1. Crear una cuenta en Resend y una API key.
2. Configurar `RESEND_API_KEY` y `EMAIL_FROM`.
3. En modo prueba, `onboarding@resend.dev` solo entrega a la cuenta dueña de Resend.
4. Para producción, verificar un dominio (SPF/DKIM). No se usa SMTP ni Nodemailer.

---

Última actualización: Noviembre 2026 (nota de vigencia; usar `documentacion/12`).