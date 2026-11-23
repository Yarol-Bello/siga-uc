# 21 — Conclusiones descriptivas y control interno SIAGIE

**SIGA-UC — I.E.P. Unión Científica**
**Fecha:** 23/11/2026
**Migración:** `database/migracion_h80_conclusiones_estructuradas.sql`
**Alcance:** Opción A (mejora interna). **No es una integración oficial con SIAGIE/MINEDU.**

---

## 1. Qué se implementó

La conclusión descriptiva deja de ser un único texto libre y pasa a tener
cuatro componentes pedagógicos:

| Campo | Uso |
|---|---|
| `nivel_logro` | AD, A, B o C. Se toma de la nota final del curso. |
| `avance` | Qué logró demostrar el estudiante. |
| `dificultad` | Qué necesita fortalecer. |
| `sugerencia` | Recomendación concreta para el estudiante y la familia. |
| `descripcion` | Texto compuesto que se usa en libretas y exportación interna. |

Además se agrega `estado` (`BORRADOR`/`PUBLICADO`), auditoría
(`actualizado_por`, `actualizado_en`, `publicado_por`, `publicado_en`) y un
código/hash de control interno en `exportaciones_siagie`.

La conclusión sigue siendo **por alumno, curso, bimestre y año**. No se cambió a
conclusión por competencia en esta fase; ver la sección 7.

---

## 2. Reglas de negocio

1. El nivel de logro debe ser `AD`, `A`, `B` o `C`.
2. Si el alumno ya tiene nota final en `notas_finales_area`, el nivel debe
   coincidir con esa nota. Si no coincide, la API responde
   `400 NIVEL_NO_COINCIDE`.
3. La conclusión compuesta no puede superar **350 caracteres**. La API responde
   `400 CONCLUSION_LARGA` y la UI muestra el contador.
4. Para `PUBLICADO` se exigen avance, dificultad y sugerencia. Para `BORRADOR`
   se puede guardar un avance parcial.
5. Si el acta del grado y bimestre está cerrada, no se puede guardar ni
   publicar: `409`.
6. El docente solo puede escribir conclusiones de los cursos que tiene
   asignados en `carga_curricular`. ADMIN puede revisar y corregir.
7. Cada cambio se registra en la bitácora con valor anterior y nuevo.
8. El texto compuesto se actualiza siempre desde avance + dificultad +
   sugerencia. La columna `descripcion` conserva compatibilidad con libretas y
   reportes.

---

## 3. API

| Método | Ruta | Roles | Uso |
|---|---|---|---|
| GET | `/api/calificaciones/curso/:id_curso/grado/:id_grado/conclusiones?bimestre=&anio=` | ADMIN, DOCENTE | Lista alumnos, nota final y conclusión. Devuelve `acta_cerrada`. |
| PUT | `/api/calificaciones/conclusiones` | ADMIN, DOCENTE | Guarda borrador o publica una conclusión. |
| GET | `/api/siagie/exportaciones/:codigo/verificar` | ADMIN | Verifica el código de control interno contra los datos actuales. |

El middleware `checkCursoDocente` valida que el docente tenga el curso/grado.
Las rutas siguen el formato uniforme `{ success, message, data, timestamp }`.

---

## 4. Frontend

- Ruta DOCENTE: **`/docente/conclusiones`**.
- Menú: “Conclusiones Descriptivas” en el sidebar del docente.
- Selector de curso y bimestre.
- Tabla con DNI, estudiante, nota final, nivel, conclusión y estado.
- Modal de edición con:
  - nivel de logro bloqueado cuando existe nota final;
  - avance, dificultad y sugerencia;
  - vista previa del texto compuesto y contador `x/350`;
  - botón “Generar sugerencia” con plantillas por nivel;
  - guardar borrador o publicar.
- Si el acta está cerrada, la pantalla es de solo lectura.

La pantalla ADMIN de SIAGIE incorpora una tarjeta para pegar el código de
control y verificar el archivo. El código también se completa automáticamente
al descargar el Excel.

---

## 5. Exportación interna y código de control

El Excel interno conserva el aviso:

> Exportación interna. No es una exportación oficial a SIAGIE/MINEDU.

Columnas:

`DNI`, `Alumno`, `Grado`, `Sección`, `Año`, `Bimestre`, `Curso`, `Área`,
`Nota final`, `Nivel de logro`, `Avance`, `Dificultad`, `Sugerencia`,
`Conclusión descriptiva`, `Estado`.

La hoja **Aviso** incluye:

- código de control interno (`SI-AAAA-B-HASH12`);
- hash SHA-256 del contenido exportado;
- aclaración de que **no es el código oficial de SIAGIE**;
- conteos de conclusiones publicadas y en borrador.

`exportaciones_siagie` guarda `codigo_control`, `hash_integridad`, `origen`
(`INTERNO`/`SIAGIE`) y `detalle` (JSONB). La verificación recalcula el hash con
los datos actuales: si una nota o conclusión cambió, `coincide=false`.

### Lo que este código NO hace

- No genera el código oficial de SIAGIE.
- No permite subir el archivo a SIAGIE.
- No reemplaza la plantilla oficial ni su validación.

El código oficial lo entrega SIAGIE al generar su plantilla. Para una carga
oficial hay que llenar esa plantilla y conservar su nombre/código; ver la
sección 7.

---

## 6. Datos demo

`database/demo_h80_conclusiones.sql` rellena avance, dificultad y sugerencia en
las conclusiones de demostración que aún no tienen esos campos. Respeta las
conclusiones ya editadas. Es **solo para demo/UAT**; no ejecutar en una base
con conclusiones reales.

El seed UAT (`scripts/uat-seed.js`) ya genera las 3,300 conclusiones
estructuradas para 75 alumnos, 11 cursos y 4 bimestres.

---

## 7. Pendiente para una integración oficial con SIAGIE

La Opción A es interna. Para que el colegio suba información a SIAGIE se
necesita una segunda fase:

1. Obtener la plantilla oficial de SIAGIE para Secundaria y su instructivo.
2. Mapear áreas, cursos y competencias de SIGA-UC contra las áreas y
   competencias oficiales.
3. Crear conclusiones por **competencia** (no solo por curso), porque SIAGIE
   trabaja con competencias.
4. Implementar un flujo que **llene la plantilla oficial** conservando su
   código, nombre, hojas ocultas y formato. La validación final la hace SIAGIE
   al subir el archivo.
5. Revisar la obligatoriedad: en Secundaria, la conclusión es obligatoria para
   el nivel C y opcional para B/A/AD según la RVM 048-2024 y sus actualizaciones.

No se debe inventar un “código SIAGIE”: el código oficial viene de la plantilla
de SIAGIE y no se puede generar desde SIGA-UC.

---

## 8. Verificación

| Suite | Resultado |
|---|---|
| `npm run test:integridad` (UAT) | **36 PASS, 0 FAIL** |
| `npm run test:e2e` | **102 PASS, 0 FAIL** |
| `npm run test:setup` | **5 PASS, 0 FAIL** |
| `npm run smoke` (credenciales UAT) | **12 PASS, 0 FAIL** |
| `npm run uat:verify` | **22 PASS, 0 FAIL** |
| Build Angular | OK |

Pruebas cubiertas:

- guardar borrador y publicar;
- rechazo de nivel inconsistente;
- rechazo de texto > 350;
- bloqueo por acta cerrada;
- código de control válido;
- detección de cambios en los datos;
- exportación con 15 columnas y hoja Aviso;
- pantalla DOCENTE y tarjeta de verificación en navegador.
