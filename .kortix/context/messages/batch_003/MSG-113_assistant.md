# MSG-113 [ASSISTANT]
Archived: 2026-02-18T14:30:33.536351+00:00

---

Perfecto! He corregido el problema. Las funciones `showRegisterForm()`, `closeRegisterModal()`, `showLoginError()`, `showRegisterError()`, `showLoginSuccess()` y `updateCurrentDate()` estaban siendo llamadas pero no estaban definidas en el archivo.

Ahora el botón "Crear nueva cuenta" debería funcionar correctamente. Intenta nuevamente:

1. Abre el WMS en: **https://8080-b996fc74-3d3a-4c9d-be60-7c058387de50.proxy.daytona.works/wms-nube.html**

2. Haz clic en **"Crear nueva cuenta"** - ahora debería abrirse un modal

3. Completa el formulario con:
   - **Email**: cualquier email (ej. javier@celmedik.com)
   - **Contraseña**: mínimo 6 caracteres

4. Haz clic en **"Crear Cuenta"**

5. Una vez creada, verás un mensaje de éxito y podrás iniciar sesión con esas credenciales

¿Prueba ahora y cuéntame si funciona?