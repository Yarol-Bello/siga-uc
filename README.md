# SIGA-UC — Sistema Integrado de Gestión Académica

Sistema web full-stack para la I.E.P. Unión Científica (Huancayo, Junín, Perú).

Digitaliza procesos académicos y administrativos: matrículas, notas por competencias MINEDU, asistencia QR, tesorería, caja, exportación interna de calificaciones, notificaciones y auditoría.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 21 + Bootstrap 5 + FontAwesome |
| Backend | Node.js 20 + Express 5 |
| Base de Datos | PostgreSQL 18 |
| Autenticación | JWT + bcrypt |
| Correo | Resend (API HTTP; modo prueba en la demo) |
| Excel | ExcelJS (exportación interna de calificaciones) |
| QR | qrcode (carné digital) |

---

## Estructura del proyecto

siga-uc/
├── database/            # esquema, seed de producción, migraciones y dump demo
├── documentacion/       # documentación técnica vigente (01–21)
├── docs/                # credenciales y mapeo histórico
├── siga-uc-backend/     # API REST (Node + Express)
├── siga-uc-frontend/    # SPA (Angular)
├── AGENTS.md            # resumen operativo para asistentes
├── HANDOFF_SESSION.md   # estado actual y próxima sesión
└── README.md

---

## Instalación

Ver `documentacion/12-CONFIGURACION-INSTALACION-DESPLIEGUE.md` para la guía paso a paso.

Resumen rápido:

Backend:

    cd siga-uc-backend
    copy .env.example .env
    notepad .env
    npm install
    npm run dev

Frontend (en otra terminal):

    cd siga-uc-frontend
    npm install
    ng serve

Abrir: http://localhost:4200

---

## Credenciales de prueba

Ver `docs/CREDENCIALES.md`. Las contraseñas no se documentan en este README.
La demo UAT usa las cuentas descritas en `HANDOFF_SESSION.md`.

---

## Testeo

Ver `documentacion/13-OPERACION-MANTENIMIENTO-Y-TESTEO.md` para las suites y el checklist.
Resumen: smoke 12, integridad 36, E2E 102, setup 5 y `uat:verify` 22.

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| ADMIN | Todos los módulos |
| SECRETARIA | Padrón, Tesorería, Caja, Asistencia QR |
| DOCENTE | Mis Cursos, Notas, Asistencia, Ficha, Reportes |
| ESTUDIANTE | Mis Cursos, Mi Asistencia, Horario |

---

## Autor

Yarol Bello Coquil — 2026
I.E.P. Unión Científica — Huancayo, Perú