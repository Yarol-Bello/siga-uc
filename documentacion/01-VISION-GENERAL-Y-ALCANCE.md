# 01 — Visión General y Alcance

## 1. Identidad del proyecto

| Elemento | Detalle |
|---|---|
| Nombre | **SIGA-UC** — Sistema Integrado de Gestión Académica |
| Institución | I.E.P. Unión Científica — Huancayo, Junín, Perú |
| Contexto | Proyecto final del curso *JavaScript Avanzado* — Escuela Profesional de Ingeniería de Sistemas e Informática (2026) |
| Docente | Mg. Mora Bonilla, Anthony |
| Equipo | Yarol Bello Coquil (Product Owner/PM), Alexander Grados Castro (Arquitecto/Backend), Franz Roger Ramón Ayala (Frontend), Jeanfranco Jesús Ramos Uñaupe (Analista/QA) |
| Estado | Funcional, en fase de documentación, despliegue y mejoras evolutivas |
| Repositorio | `https://github.com/Yarol-Bello/siga-uc.git` |

## 2. Problema de negocio

La institución operaba con Excel aislados, listas de asistencia en papel y un sistema
monousuario en secretaría. Esto producía:

- ~200 horas-hombre/mes de transcripción manual.
- 8 % de actas con errores de digitación.
- Hasta 10 días para emitir libretas.
- Cero concurrencia: un solo usuario podía usar el sistema a la vez.
- Información financiera y académica dispersa, sin trazabilidad.

## 3. Objetivos originales y cumplimiento

| Objetivo | Meta original | Cómo lo cubre SIGA-UC |
|---|---|---|
| OE1 | Reducir 70 % el tiempo de registro de notas | Matriz de notas por competencias, guardado masivo y notas finales automáticas por predominancia |
| OE2 | Asistencia en <5 clics con 95 % de precisión | Lista por curso/fecha, botones P/T/F, “Todos presentes”, guardado masivo y QR para personal |
| OE3 | 3 perfiles con segregación total | 4 roles reales con guardas de ruta y middleware de rol (con brechas de API documentadas) |
| OE4 | Libretas/PDF en <30 s | Libreta imprimible generada desde consultas en tiempo real |
| OE5 | Autenticación robusta y control por roles | JWT 8 h, bcrypt, guards, middleware y recuperación de contraseña por correo |

> El alcance real superó el planteamiento inicial: incluye tesorería, caja, SIAGIE,
> notificaciones, auditoría, actas con hash y carné QR. La única exclusión histórica que
> sigue pendiente es la **pasarela de pago en línea**.

## 4. Alcance funcional actual

### 4.1 Gestión académica

- Grados de secundaria (1.º a 5.º, sección única, año 2026).
- Cursos agrupados por área académica.
- Competencias por curso (metodología MINEDU).
- Carga curricular: asignación docente–curso–grado por año.
- Tutor de grado por año.
- Horarios semanales por grado (consulta; no hay CRUD de horarios).

### 4.2 Gestión de alumnos

- Matrícula transaccional: apoderado, usuario, alumno, expediente y credencial QR.
- Ficha del alumno con apoderado y estado de matrícula.
- Edición de datos y retiro con motivo, fecha y colegio destino.
- Restablecimiento de contraseña por DNI.
- Credencial digital QR para estudiante y personal.

### 4.3 Evaluación

- Calificaciones por competencia y bimestre: `AD`, `A`, `B`, `C`.
- Guardado individual y masivo (upsert).
- Nota final de área por predominancia.
- Conclusiones descriptivas (estructura disponible; sin UI de captura).
- Actas bimestrales con cierre y hash de integridad.

### 4.4 Asistencia

- Asistencia de alumnos por curso y fecha: `P` (presente), `T` (tardanza), `F` (falta).
- Registro individual/masivo con justificación y observación.
- Historial y resumen por alumno/curso.
- Asistencia de personal por QR (o DNI manual): `Puntual`, `Tardanza`, `Falta`.
- Resumen diario de personal.

### 4.5 Tesorería

- Conceptos de pago: matrícula, pensiones y otros.
- Pre-tickets de cobro.
- Generación mensual de pensiones con becas.
- Registro de pagos con múltiples formas de pago.
- Boleta electrónica simulada (`B001-XXXXXX`) con hash CPE.
- Actualización automática de pre-ticket, pensión y matrícula.
- Estadísticas de recaudación y pendientes.

### 4.6 Caja

- Apertura con fondo inicial.
- Registro de egresos con comprobante.
- Ingresos automáticos desde pagos (trigger).
- Cierre con arqueo: `CUADRADO`, `SOBRANTE`, `FALTANTE`.
- Historial de aperturas, movimientos y cierres.

### 4.7 Reportes e integración

- Dashboard ejecutivo con KPIs.
- Libreta imprimible por alumno/bimestre.
- Cuadro de mérito (top 10 por promedio ponderado, solo con notas completas del grado).
- Alumnos en riesgo (2+ cursos con `C`).
- Resumen de asistencia por grado.
- Auditoría de avance de carga de notas por docente.
- **Exportación interna de calificaciones** en `.xlsx` (no es una exportación oficial a
  SIAGIE/MINEDU): incluye todos los cursos del grado, nota final y conclusión descriptiva.

### 4.8 Comunicación y trazabilidad

- Notificaciones internas (campanita + buzón) y correo real vía Resend.
- Envío masivo (solo ADMIN, solo persiste en BD; ver hallazgos).
- Bitácora de auditoría con valores anterior/nuevo en JSONB.
- Recuperación de contraseña con token de un solo uso y 2 h de vigencia.

## 5. Actores y responsabilidades

| Actor | Responsabilidad principal |
|---|---|
| **ADMIN** | Configuración académica, personal, carga curricular, supervisión, exportación interna, auditoría y control total |
| **SECRETARIA** | Padrón, matrículas, tesorería, caja y asistencia del personal |
| **DOCENTE** | Asistencia y calificaciones de sus cursos, ficha de estudiantes y reportes de aula |
| **ESTUDIANTE** | Consulta de notas, asistencia y horario propios |
| **Apoderado** | No tiene cuenta; se registra como dato de contacto del alumno |

## 6. Fuera de alcance / pendiente

| Tema | Estado |
|---|---|
| Pasarela de pago en línea (Culqi/Niubiz/Izipay) | Pendiente, evolución natural |
| PDFs reales de libretas, boletas y actas | Pendiente; hoy se imprime desde el navegador |
| CRUD completo de horarios | Solo consulta por grado |
| Módulo de admisión/prospectos | No existe |
| App móvil/PWA | No existe |
| Tests automatizados y CI/CD | No existen |
| Docker | No se usa |
| WebSocket/chat en tiempo real | No se usa |

## 7. Glosario

| Término | Significado |
|---|---|
| **AD / A / B / C** | Escala de logro MINEDU: Logro Destacado, Logro Esperado, En Proceso, En Inicio |
| **P / T / F** | Presente, Tardanza, Falta (asistencia de alumnos) |
| **Bimestre** | Periodo académico 1–4 |
| **Competencia** | Unidad evaluable de un curso, con orden |
| **Nota final de área** | Resultado por predominancia de competencias en un bimestre |
| **Pre-ticket** | Cobro pendiente emitido antes del pago |
| **Boleta electrónica** | Comprobante simulado generado al registrar un pago |
| **Acta bimestral** | Documento de cierre con hash de integridad |
| **SIAGIE** | Sistema de Información de Apoyo a la Gestión de la Institución Educativa (MINEDU) |
| **Carga curricular** | Asignación de un docente a un curso y grado en un año |
| **Tutor de grado** | Docente responsable de un grado |
| **Expediente del alumno** | Registro complementario con nivel de logro y asistencia acumulada |
| **Credencial QR** | Código único para identificación y marcación de asistencia |
| **Bitácora** | Registro histórico de auditoría |

## 8. Identidad visual

| Elemento | Valor |
|---|---|
| Guindo institucional | `#800020` |
| Dorado | `#D4AF37` |
| Naranja Secretaría | `#B45309` |
| Fondo general | `#F8FAFC` |
| Fondo cálido | `#fffbeb` |

La identidad se aplica en login, layouts, sidebars, tarjetas, correos y libretas.
