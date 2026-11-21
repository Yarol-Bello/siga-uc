# Credenciales de Prueba — SIGA-UC

> **Aviso:** estas cuentas son solo para desarrollo local. En producción deben rotarse.
>
> Las contraseñas **no se documentan en este archivo**. El smoke test las lee de
> `siga-uc-backend/.env` (`SMOKE_ADMIN_*`, `SMOKE_DOCENTE_*`, `SMOKE_ESTUDIANTE_*`),
> archivo ignorado por git. No copies esos valores a `.env.example`, a la documentación
> ni al código.

## Cuentas principales

| Rol | DNI | Correo personal | Estado |
|---|---|---|---|
| Administrador | 74829102 | yarolbellocoquil@gmail.com | Activo — referencia para el smoke |
| Secretaría | 40596837 | yarolbellocoquil@gmail.com | Activo |
| Docente (referencia) | 20394812 | yarolbellocoquil@gmail.com | Activo — usar en pruebas y smoke |
| Docente (Matemática) | 10293847 | yarolbellocoquil@gmail.com | ⚠️ `requiere_cambio_password = TRUE`; su contraseña documentada anteriormente ya no es válida |
| Docente (Ciencias) | 30192847 | yarolbellocoquil@gmail.com | Activo |
| Docente (Comunicación) | 50182736 | yarolbellocoquil@gmail.com | Activo |

## Estudiantes

| Rol | DNI |
|---|---|
| Estudiante 3ro Sec | 75918234 |
| Estudiante 2do Sec | 74829103 |
| Estudiante 5to Sec | 76829401 |

Estudiantes adicionales del seed: DNI `70000001` a `70000015`.

Los estudiantes generados reciben una contraseña temporal derivada de su DNI y deben
cambiarla cuando `requiere_cambio_password = TRUE`. No se documentan contraseñas aquí.

## Smoke test

`npm run smoke` obtiene las credenciales de `siga-uc-backend/.env`; en una terminal nueva
no hace falta definir `SMOKE_*` manualmente. Si faltan credenciales, las pruebas
dependientes se marcan como SKIP y el script termina con código **2** (resultado parcial).

`npm run test:e2e` usa esas mismas credenciales del seed, pero las aplica a una base
desechable `siga_uc_e2e` que crea y elimina automáticamente.

Para ejecutarlo contra otro entorno, define `SMOKE_BASE_URL` y las variables `SMOKE_*`
solo en la sesión de la terminal; nunca las agregues al repositorio.

## Notas

- El correo institucional (`@unioncientifica.edu.pe`) es ficticio y solo se usa de forma
  decorativa.
- El correo personal es el funcional (recibe notificaciones y recuperación de contraseña).
- Sin `RESEND_API_KEY` configurada, el envío de correos no funciona, pero el resto del
  sistema sí.
- La cuenta `10293847` no debe usarse para pruebas hasta que se restablezca su contraseña.
  Usar `20394812` como docente de referencia.

## Cómo probar la recuperación de contraseña

1. Cerrar sesión.
2. En el login, hacer clic en "¿Olvidaste tu contraseña?".
3. Ingresar DNI o correo personal.
4. Revisar el correo y hacer clic en el enlace.
5. Cambiar la contraseña.
6. Volver a iniciar sesión con la nueva contraseña.

Si no hay correo configurado, el sistema responderá "Contacte al Administrador" cuando el
usuario no tenga correo.

---

Última actualización: 21/11/2026
