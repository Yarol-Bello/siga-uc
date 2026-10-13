\# Guía de Testeo — SIGA-UC



Objetivo: probar cada módulo por rol, encontrar bugs e inconsistencias, y reportarlos de forma ordenada.



\---



\## 1. Antes de empezar



1\. Verifica que tienes el proyecto instalado (ver INSTALACION.md).

2\. Backend corriendo en http://localhost:3000

3\. Frontend corriendo en http://localhost:4200

4\. Ten a mano las credenciales de prueba (CREDENCIALES.md).

5\. Abre la consola del navegador con F12 (pestaña Console y Network).

6\. Ten abierta la terminal del backend para ver logs.



\---



\## 2. Cómo reportar un bug



Ve a GitHub, pestaña Issues, New Issue. Usa esta plantilla:



Título: \[MÓDULO] Descripción corta



Rol: ADMIN / DOCENTE / SECRETARIA / ESTUDIANTE



Prioridad: Alta / Media / Baja



Pasos para reproducir:

1\. Entrar a ...

2\. Hacer clic en ...

3\. ...



Resultado esperado: ...



Resultado actual: ...



Captura / video: (adjuntar)



Consola del navegador (F12): (pegar errores)



Logs del backend: (pegar líneas relevantes)



NO subir capturas con contraseñas visibles.



\---



\## 3. Checklist por rol



\### ADMIN



\- \[ ] Login funciona con DNI 74829102 / UC2026\*

\- \[ ] Dashboard carga KPIs

\- \[ ] Alumnos:

&#x20; - \[ ] Listar (20+ registros)

&#x20; - \[ ] Filtrar por grado/DNI/nombre

&#x20; - \[ ] Ver ficha completa

&#x20; - \[ ] Editar alumno

&#x20; - \[ ] Reset password

&#x20; - \[ ] Retirar alumno

&#x20; - \[ ] Nueva matrícula

\- \[ ] Personal:

&#x20; - \[ ] Listar (5 trabajadores)

&#x20; - \[ ] Crear nuevo

&#x20; - \[ ] Editar

&#x20; - \[ ] Cesar

&#x20; - \[ ] Reactivar

&#x20; - \[ ] Reset password

&#x20; - \[ ] Ver carné QR

\- \[ ] Carga Curricular:

&#x20; - \[ ] Selector de grado funciona

&#x20; - \[ ] Tabla de 11 cursos carga

&#x20; - \[ ] Tutor del grado se muestra

&#x20; - \[ ] Asignar docente a curso

&#x20; - \[ ] Asignar tutor

\- \[ ] Asistencia QR:

&#x20; - \[ ] Estación de escaneo (input DNI)

&#x20; - \[ ] Botones P/T/F funcionan

&#x20; - \[ ] KPIs actualizados

\- \[ ] Tesorería:

&#x20; - \[ ] Ver pensiones por alumno

&#x20; - \[ ] Cobrar pensión

&#x20; - \[ ] Ver boleta generada

\- \[ ] Caja:

&#x20; - \[ ] Aperturar caja

&#x20; - \[ ] Registrar egreso

&#x20; - \[ ] Cerrar caja con arqueo

\- \[ ] SIAGIE:

&#x20; - \[ ] Subir plantilla .xlsx

&#x20; - \[ ] Auditoría de docentes carga

&#x20; - \[ ] Notificar a profesor

&#x20; - \[ ] Generar Excel con notas inyectadas

\- \[ ] Reportes:

&#x20; - \[ ] Libretas

&#x20; - \[ ] Cuadro de mérito

&#x20; - \[ ] Alumnos en riesgo

\- \[ ] Auditoría:

&#x20; - \[ ] Ver bitácora

&#x20; - \[ ] Filtrar por módulo

&#x20; - \[ ] Cerrar acta bimestral con hash



\### SECRETARIA



\- \[ ] Login funciona con DNI 40596837 / UC2026\*

\- \[ ] Dashboard financiero carga

\- \[ ] Padrón (mismo comportamiento que Admin > Alumnos)

\- \[ ] Tesorería completa (cobros, pensiones, boletas)

\- \[ ] Caja:

&#x20; - \[ ] Aperturar

&#x20; - \[ ] Egreso

&#x20; - \[ ] Cierre con arqueo

\- \[ ] Asistencia QR (mismo comportamiento que Admin)



\### DOCENTE



\- \[ ] Login funciona con DNI 10293847 / UC2026\*

\- \[ ] Dashboard muestra cursos asignados (5x5 = 25)

\- \[ ] Notas:

&#x20; - \[ ] Selector curso/grado/bimestre

&#x20; - \[ ] Registrar nota AD/A/B/C por competencia

&#x20; - \[ ] Guardado masivo funciona

&#x20; - \[ ] Notas finales calculadas por predominancia

\- \[ ] Asistencia:

&#x20; - \[ ] Selector curso/fecha

&#x20; - \[ ] Botones P/T/F

&#x20; - \[ ] Botón Todos Presentes

&#x20; - \[ ] Guardado masivo

\- \[ ] Ficha Estudiante:

&#x20; - \[ ] Buscar por DNI

&#x20; - \[ ] Ver perfil

&#x20; - \[ ] KPIs de asistencia

&#x20; - \[ ] Notas finales

\- \[ ] Reportes de aula + campanita notificaciones



\### ESTUDIANTE



\- \[ ] Login funciona con DNI 75918234 / UC75918234

\- \[ ] Dashboard con promedio y notas por curso

\- \[ ] Mi Asistencia (por asignatura)

\- \[ ] Horario semanal (Lunes a Viernes)



\---



\## 4. Casos especiales a probar



\- \[ ] Recuperación de contraseña desde login

\- \[ ] Cambio de contraseña obligatorio si requiere\_cambio\_password

\- \[ ] Carné digital QR (clic en el ícono del header)

\- \[ ] Campanita de notificaciones (contador + modal buzón)

\- \[ ] Cerrar sesión

\- \[ ] Intentar acceder a URL de otro rol (debe redirigir)

\- \[ ] Recargar página en mitad de sesión (debe mantener sesión)



\---



\## 5. Cómo probar responsive



\- \[ ] Reducir la ventana a \~768px (tablet)

\- \[ ] Reducir a \~375px (celular)

\- \[ ] Probar con F12 > Toggle Device Toolbar



\---



\## 6. Qué NO es un bug



\- Errores de SMTP si no configuraste correo (es esperado).

\- Que la campanita no marque nada si no hay notificaciones nuevas.

\- Datos de prueba "raros" (nombres ficticios, correos genéricos).



\---



Última actualización: Octubre 2026

