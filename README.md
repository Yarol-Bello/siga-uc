# 🎓 SIGA-UC — Sistema Integrado de Gestión Académica

Sistema web full-stack para la gestión académica y administrativa de la **I.E.P. Unión Científica** (Huancayo, Junín).

---

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Stack Tecnológico](#-stack-tecnológico)
- [Módulos del Sistema](#-módulos-del-sistema)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación Rápida](#-instalación-rápida)
- [Credenciales de Prueba](#-credenciales-de-prueba)
- [Documentación](#-documentación)
- [Estado del Proyecto](#-estado-del-proyecto)
- [Autor](#-autor)

---

## 📖 Descripción

SIGA-UC es un sistema web que centraliza la gestión académica y administrativa del colegio, permitiendo:

- **Gestión de Alumnos:** Matrícula, retiro, expedientes, apoderados.
- **Gestión Curricular:** Asignación de cursos, docentes, horarios.
- **Registro Académico:** Notas por competencias, asistencia P/T/F.
- **Tesorería:** Cobros, pensiones, boletas electrónicas, becas.
- **Cuadre de Caja:** Apertura, movimientos, arqueo, cierre diario.
- **Reportes:** Libretas, cuadro de mérito, alumnos en riesgo.
- **SIAGIE:** Exportación de notas al MINEDU (Excel real inyectado).
- **Notificaciones:** Correos institucionales reales vía SMTP.
- **Auditoría:** Bitácora de cambios, cierre de actas con hash de integridad.

---

## 🛠️ Stack Tecnológico

| Capa                     | Tecnología              | Versión         |
| ------------------------ | ----------------------- | --------------- |
| **Frontend**             | Angular + Bootstrap     | 21.2.26 / 5.x   |
| **Backend**              | Node.js + Express       | 20.20.2 / 5.3.0 |
| **Base de Datos**        | PostgreSQL              | 18.4            |
| **Autenticación**        | JWT + bcrypt            | 9.x / 6.x       |
| **Correos**              | Nodemailer + SMTP Gmail | 6.x             |
| **Excel**                | ExcelJS                 | 4.x             |
| **Control de Versiones** | Git                     | 2.56.0          |
| **Editor**               | Visual Studio Code      | Última          |

---

## 📦 Módulos del Sistema

### 👨‍💼 Panel del Administrador (10 módulos)

- Resumen Ejecutivo (Dashboard con KPIs)
- Padrón de Alumnos (CRUD completo + matrícula + retiro)
- Personal y Usuarios (CRUD + cese + reactivar)
- Control de Asistencia QR (Escáner + KPIs)
- Carga Curricular (Asignación de cursos y tutores)
- Tesorería y Pensiones (Cobros + boletas)
- Cuadre de Caja (Apertura, egresos, cierre)
- Exportación SIAGIE (Excel inyectado real)
- Reportes y Libretas (3 pestañas: libretas, mérito, riesgo)
- Auditoría y Actas (Bitácora + cierre con hash)

### 👩‍🏫 Panel del Docente (5 módulos)

- Mis Cursos y Horarios (Dashboard)
- Control de Asistencia (Botones P/T/F)
- Registro de Notas (Por competencias MINEDU)
- Ficha del Estudiante (Búsqueda por DNI)
- Reportes de Aula (Estadísticas + buzón)

### 👨‍🎓 Panel del Estudiante (3 módulos)

- Mis Cursos y Notas (Notas finales por competencias)
- Mi Asistencia (KPIs + historial filtrado)
- Horario de Clases (Tabla semanal JEC)

### 💼 Panel de Secretaría/Tesorería (4 módulos)

- Padrón de Alumnos (Compartido con Admin)
- Tesorería y Pensiones (Cobros en ventanilla)
- Cuadre de Caja (Apertura + arqueo diario)
- Control de Asistencia QR (Compartido con Admin)

---

## 📁 Estructura del Proyecto

siga-uc/
├── database/ # Scripts SQL y backups
│ ├── siga_uc.sql # Esquema completo (26 tablas)
│ ├── siga_uc_backup.sql # Backup con datos de prueba
│ └── README.md # Documentación de la BD
├── docs/ # Documentación del sistema
│ ├── MANUAL_USUARIO.md # Guía paso a paso por rol
│ ├── MANUAL_TECNICO.md # Arquitectura, BD, endpoints
│ ├── INSTALACION.md # Guía de despliegue
│ ├── CREDENCIALES.md # Usuarios de prueba
│ └── CAPTURAS/ # Screenshots de cada módulo
├── siga-uc-backend/ # API REST (Node.js + Express)
│ ├── src/
│ │ ├── config/ # Configuración BD y env
│ │ ├── controllers/ # Controladores MVC
│ │ ├── dao/ # Data Access Object
│ │ ├── middlewares/ # JWT, validaciones
│ │ ├── routes/ # Rutas API REST
│ │ ├── services/ # Lógica de negocio
│ │ ├── utils/ # Utilidades
│ │ └── app.js # Punto de entrada
│ ├── uploads/ # Archivos temporales (SIAGIE)
│ ├── .env # Variables de entorno
│ ├── .gitignore
│ └── package.json
├── siga-uc-frontend/ # SPA (Angular)
│ ├── src/
│ │ ├── app/
│ │ │ ├── core/ # Servicios singleton, guards
│ │ │ ├── features/ # Módulos por rol
│ │ │ │ ├── auth/ # Login
│ │ │ │ ├── admin/ # Panel Administrador
│ │ │ │ ├── docente/ # Panel Docente
│ │ │ │ ├── estudiante/ # Panel Estudiante
│ │ │ │ └── secretaria/ # Panel Secretaría
│ │ │ └── shared/ # Componentes reutilizables
│ │ └── environments/ # Config por ambiente
│ └── package.json
├── .gitignore
└── README.md

---

## 🚀 Instalación Rápida

### Requisitos Previos

- Windows 11 (o Linux/macOS)
- Node.js 20 LTS
- PostgreSQL 18.4
- Angular CLI 21
- Git 2.56+

### Pasos

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd siga-uc

# 2. Configurar Backend
cd siga-uc-backend
npm install
# Configurar .env con tus credenciales de PostgreSQL y SMTP
npm run dev

# 3. Configurar Frontend (en otra terminal)
cd ../siga-uc-frontend
npm install
ng serve
```
