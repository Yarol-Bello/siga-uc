# Documentación Técnica y Funcional — SIGA-UC

**Sistema Integrado de Gestión Académica — I.E.P. Unión Científica (Huancayo, Junín, Perú)**

| Dato | Valor |
|---|---|
| Repositorio | `https://github.com/Yarol-Bello/siga-uc.git` (rama `main`) |
| Ruta local analizada | `C:\Users\yarol\Documents\Proyectos\siga-uc` |
| Fecha de verificación | 19/11/2026 |
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
| Consumir o auditar la API (127 endpoints) | `05-API-REST.md` |
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

---

## 2. Radiografía rápida del sistema

| Indicador | Valor verificado |
|---|---|
| Roles | 4 (`ADMIN`, `DOCENTE`, `SECRETARIA`, `ESTUDIANTE`) |
| Paneles frontend | 4 + autenticación |
| Tablas PostgreSQL | 40 |
| Funciones + triggers | 15 objetos (8 funciones, 7 triggers) |
| Endpoints REST | 114 (64 GET, 32 POST, 14 PUT, 4 DELETE) |
| Routers backend | 15 |
| Controladores backend | 15 |
| Servicios backend | 22 |
| DAOs backend | 18 |
| Archivos backend | 80 JS |
| Archivos frontend | 134 (56 TypeScript) |
| Transacciones de negocio | Matrícula, pago+boleta, cierre de caja, carga masiva, asignación de tutor |
| Autenticación | JWT (8 h) + bcrypt (coste 10) |
| Correo transaccional | Resend (API HTTP), con degradación no bloqueante |
| Base de datos | PostgreSQL 18.4 + `pgcrypto`, `unaccent`, `uuid-ossp` |

---

## 3. Advertencias importantes (leer antes de tocar código)

1. **El año lectivo se configura con `ANIO_LECTIVO`** y se expone en `GET /api/configuracion`.
   No introducir literales `2026` en controllers, DAOs ni componentes.
2. **El correo real es `correo_personal`**; el institucional es decorativo. Todo envío usa
   `correo_personal || correo_institucional`.
3. **Muchos GET solo exigen JWT, no rol ni pertenencia**. La UI oculta módulos, pero la API
   permite lectura amplia. Ver `15-HALLAZGOS-RIESGOS-Y-MEJORAS.md`.
4. **La documentación histórica está desactualizada** en varios puntos: decía 26 tablas, 17
   servicios, 16 DAOs, 14 controladores y Nodemailer/SMTP. El estado real está en estos
   documentos y en el código.
5. **No existen tests automatizados ni CI/CD**. La validación es manual con
   `docs/GUIA_TESTEO.md`.

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
