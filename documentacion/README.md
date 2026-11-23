# Documentación Técnica y Funcional — SIGA-UC

**Sistema Integrado de Gestión Académica — I.E.P. Unión Científica (Huancayo, Junín, Perú)**

| Dato | Valor |
|---|---|
| Repositorio | `https://github.com/Yarol-Bello/siga-uc.git` (rama `main`) |
| Ruta local analizada | `C:\Users\yarol\Documents\Proyectos\siga-uc` |
| Fecha de verificación | 23/11/2026 |
| Fuente de verdad | El código y `database/siga_uc.sql` |
| Alcance de esta carpeta | Mapeo funcional, técnico, de datos, de roles y de procesos |

> Esta carpeta es la documentación detallada del sistema. El `AGENTS.md` de la raíz es
> solo un resumen operativo para asistentes/desarrolladores y apunta aquí.
> Si un documento y el código difieren, **manda el código**.

---

## 1. Cómo usar esta documentación

| Si necesitas… | Lee… |
|---|---|
| Entender el negocio, alcance y glosario | `01-VISION-GENERAL-Y-ALCANCE.md` |
| Entender capas, patrones y ciclo de una petición | `02-ARQUITECTURA-Y-PATRONES.md` |
| Ubicar archivos, controladores, servicios y DAOs | `03-ESTRUCTURA-Y-CLASES.md` |
| Conocer las 43 tablas, relaciones, triggers y seeds | `04-BASE-DE-DATOS.md` |
| Consumir o auditar la API (129 endpoints) | `05-API-REST.md` |
| Ver roles, usuarios semilla y matriz de permisos | `06-USUARIOS-ROLES-Y-PERMISOS.md` |
| Reproducir el recorrido completo de cada rol | `07-FLUJOS-POR-ROL.md` |
| Entender un proceso de negocio de inicio a fin | `08-PROCESOS-DE-NEGOCIO.md` |
| Trabajar en Angular (rutas, componentes, UI) | `09-FRONTEND-UI-Y-NAVEGACION.md` |
| Validar reglas y estados permitidos | `10-REGLAS-DE-NEGOCIO-Y-VALIDACIONES.md` |
| Revisar seguridad, auditoría y riesgos | `11-SEGURIDAD-AUDITORIA-E-INTEGRIDAD.md` |
| Instalar, configurar o desplegar | `12-CONFIGURACION-INSTALACION-DESPLIEGUE.md` |
| Operar, respaldar y probar el sistema | `13-OPERACION-MANTENIMIENTO-Y-TESTEO.md` |
| Rastrear un caso de uso hasta las tablas | `14-MATRIZ-TRAZABILIDAD.md` |
| Ver hallazgos, riesgos y mejoras priorizadas | `15-HALLAZGOS-RIESGOS-Y-MEJORAS.md` |
| Consultar el `AGENTS.md` anterior (histórico) | `16-ANEXO-AGENTS-ANTERIOR.md` |
| Preparar la demo y el checklist de aprobación | `17-GUION-DEMOSTRACION.md` |
| Auditar la producción del 22/11/2026 | `18-AUDITORIA-PRODUCCION-2026-11-22.md` |
| Entender el diseño multi-año y promoción | `19-DISENO-MULTIANIO-Y-PROMOCION.md` |
| Diseñar el módulo de configuración y ajustes | `20-MODULO-CONFIGURACION.md` |

---

## 2. Radiografía rápida del sistema

| Indicador | Valor verificado |
|---|---|
| Roles | 4 (`ADMIN`, `DOCENTE`, `SECRETARIA`, `ESTUDIANTE`) |
| Paneles frontend | 4 + autenticación |
| Tablas PostgreSQL | 45 base (46 en local con `horarios_h47_backup`) |
| Funciones + triggers | 11 objetos en el esquema base; H47/H48/H74 agregan triggers |
| Endpoints REST | 131 (72 GET, 36 POST, 18 PUT, 5 DELETE) |
| Routers backend | 17 |
| Controladores backend | 17 |
| Servicios backend | 26 |
| DAOs backend | 23 |
| Archivos backend | 98 JS |
| Archivos frontend | 151 (66 TypeScript) |
| Transacciones de negocio | Matrícula, pago+boleta, cierre de caja, carga masiva, asignación de tutor |
| Autenticación | JWT (8 h) + bcrypt (coste 10) |
| Correo transaccional | Resend (API HTTP), con degradación no bloqueante |
| Base de datos | PostgreSQL 18.4 + `pgcrypto`, `unaccent`, `uuid-ossp` |

---

## 3. Advertencias importantes (leer antes de tocar código)

1. **El año lectivo activo sale de `anios_lectivos.estado='ACTIVO'`**; `ANIO_LECTIVO` es
   bootstrap/respaldo. Se expone en `GET /api/configuracion`. No introducir literales `2026`
   en controllers, DAOs ni componentes.
2. **El correo real es `correo_personal`**; el institucional es decorativo. Todo envío usa
   `correo_personal || correo_institucional`.
3. **Muchos GET solo exigen JWT, no rol ni pertenencia**. La UI oculta módulos, pero la API
   permite lectura amplia. Ver `15-HALLAZGOS-RIESGOS-Y-MEJORAS.md`.
4. **La documentación histórica está desactualizada** en varios puntos: decía 26 tablas, 17
   servicios, 16 DAOs, 14 controladores y Nodemailer/SMTP. El estado real está en estos
   documentos y en el código.
5. **Sí existen suites automatizadas locales**: `npm run smoke` (11), `npm run
   test:integridad` (21 en base nueva), `npm run test:e2e` (75, base desechable) y
   `npm run test:h47-generador` (4). No hay CI/CD ni Docker.

---

## 4. Documentos previos que siguen vigentes

La carpeta `docs/` de la raíz conserva documentación operativa:

- `docs/INSTALACION.md` — instalación local (tiene datos desactualizados de SMTP y “26 tablas”).
- `docs/GUIA_TESTEO.md` — checklist manual por rol.
- `docs/CREDENCIALES.md` — credenciales de prueba.
- `docs/MAPEO_ENDPOINTS.txt` — mapeo previo de endpoints (histórico; el conteo vigente es 102).

Este conjunto nuevo (`documentacion/`) amplía y corrige ese material.

---

*Documentación generada a partir del análisis directo del repositorio. No se modificó código
de la aplicación para producirla.*
