# SIGA-UC — Sistema Integrado de Gestión Académica

Sistema web full-stack para la I.E.P. Unión Científica (Huancayo, Junín, Perú).

Digitaliza procesos académicos y administrativos: matrículas, notas por competencias MINEDU, asistencia QR, tesorería, caja, reportes SIAGIE, notificaciones y auditoría.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 21 + Bootstrap 5 + FontAwesome |
| Backend | Node.js 20 + Express 5 |
| Base de Datos | PostgreSQL 18 |
| Autenticación | JWT + bcrypt |
| Correo | Nodemailer + Gmail SMTP |
| Excel | ExcelJS (para SIAGIE) |
| QR | qrcode (carné digital) |

---

## Estructura del proyecto

siga-uc/
├── database/            # Scripts SQL (siga_uc.sql)
├── docs/                # Documentación
│   ├── INSTALACION.md
│   ├── GUIA_TESTEO.md
│   └── CREDENCIALES.md
├── siga-uc-backend/     # API REST (Node + Express)
├── siga-uc-frontend/    # SPA (Angular)
└── README.md

---

## Instalación

Ver docs/INSTALACION.md para la guía paso a paso.

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

Ver docs/CREDENCIALES.md.

| Rol | DNI | Contraseña |
|-----|-----|-----------|
| Administrador | 74829102 | UC2026* |
| Secretaría | 40596837 | UC2026* |
| Docente | 10293847 | UC2026* |
| Estudiante | 75918234 | UC75918234 |

---

## Testeo

Ver docs/GUIA_TESTEO.md para el checklist completo por rol.

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