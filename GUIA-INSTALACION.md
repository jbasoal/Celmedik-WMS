# WMS para Bodega - Guía de Instalación en la Nube

Este documento te ayudará a configurar el WMS para que múltiples usuarios puedan acceder desde cualquier computador.

## Opción 1: GitHub Pages (Gratis) + Firebase (Gratis)

### Paso 1: Crear cuenta en Firebase

1. Ve a: https://console.firebase.google.com/
2. Clic en "Crear un proyecto"
3. Nombre del proyecto: `wms-bodega-[tu-nombre]`
4. Desactiva Google Analytics (opcional)
5. Espera a que se cree el proyecto

### Paso 2: Habilitar Realtime Database

1. En el menú lateral, clic en "Realtime Database"
2. Clic en "Crear base de datos"
3. Selecciona la ubicación más cercana (por ejemplo, us-central1)
4. Clic en "Siguiente"
5. **IMPORTANTE**: En las reglas de seguridad, selecciona "Modo de prueba" (esto permite lectura/escritura sin autenticación para pruebas)
6. Clic en "Habilitar"

### Paso 3: Obtener configuración de Firebase

1. Clic en el ícono de engranaje (Configuración) junto a "Resumen del proyecto"
2. Desplázate hacia abajo hasta "Tus apps"
3. Clic en el ícono web (`</>`)
4. Registra la app con nombre "WMS-Web"
5. Copia el objeto `firebaseConfig` que aparece

### Paso 4: Configurar el archivo del WMS

Edita el archivo `wms-nube.html` y busca esta sección (líneas 1060-1070):

```javascript
const firebaseConfig = {
    apiKey: "demo-api-key",
    authDomain: "demo-project.firebaseapp.com",
    databaseURL: "https://demo-project-default-rtdb.firebaseio.com",
    projectId: "demo-project",
    storageBucket: "demo-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

Reemplázala con TU configuración de Firebase:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyBlaBlaBla...",
    authDomain: "tu-proyecto.firebaseapp.com",
    databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

const DEMO_MODE = false;  // <-- CAMBIA A false
```

### Paso 5: Crear cuenta en GitHub

1. Ve a: https://github.com
2. Clic en "Sign up" y crea una cuenta gratuita
3. Verifica tu email

### Paso 6: Crear repositorio

1. Clic en el botón "+" > "New repository"
2. Nombre: `wms-bodega`
3. Descripción: "Sistema de Gestión de Almacén para Bodega Médica"
4. Selecciona "Public"
5. Clic en "Create repository"

### Paso 7: Subir archivos

1. En la página del repositorio, clic en "uploading an existing file"
2. Arrastra los archivos:
   - `wms-nube.html`
   - `wms-firebase-config.js`
3. Clic en "Commit changes"

### Paso 8: Habilitar GitHub Pages

1. Ve a Settings > Pages
2. En "Source", selecciona "main" (o "master")
3. Clic en Save
4. Espera 1-2 minutos
5. Tu sitio estará disponible en: `https://tu-usuario.github.io/wms-bodega/`

---

## Configuración de Reglas de Firebase (Producción)

**IMPORTANTE**: Antes de usar en producción, cambia las reglas de Firebase:

```json
{
  "rules": {
    "wms": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

Esto asegura que solo usuarios autenticados puedan ver y modificar datos.

---

## Agregar usuarios

### Opción A: Crear usuarios directamente en Firebase

1. En Firebase Console, ve a Authentication
2. Clic en "Add user"
3. Ingresa email y contraseña
4. Clic en "Add user"

### Opción B: Registro desde la aplicación

El WMS incluye un formulario de registro. El primer usuario registrado tendrá rol de "operador". Para cambiar a administrador:

1. Ve a Firebase Console > Realtime Database
2. Busca `wms/users/[user-id]`
3. Cambia el campo `role` a "admin"

---

## Sincronización de datos

Con esta configuración:
- ✅ Múltiples usuarios pueden acceder simultáneamente
- ✅ Los cambios se sincronizan en tiempo real
- ✅ Los datos se guardan en la nube de Firebase
- ✅ Acceso desde cualquier dispositivo con internet

---

## Costos

- **GitHub Pages**: Gratis
- **Firebase** (hasta 100 GB de transferencia/mes): Gratis
- **Límite gratuito**: 100,000 usuarios activos/mes

Para una bodega típica, el nivel gratuito es más que suficiente.

---

## Solución de problemas

### "Permission denied" al guardar datos
→ Verifica las reglas de Firebase estén en modo de prueba o que el usuario esté autenticado.

### Los cambios no se sincronizan
→ Verifica que `DEMO_MODE` esté en `false` en el archivo HTML.

### Error de CORS
→ GitHub Pages + Firebase funcionan bien juntos. Asegúrate de haber configurado correctamente el dominio en Firebase.

---

## ¿Necesitas ayuda?

Si tienes problemas con la configuración, puedo ayudarte a:
1. Revisar la configuración de Firebase
2. Configurar las reglas de seguridad
3. Solucionar errores de sincronización

Contáctame y con gusto te ayudo!

---

## Archivos incluidos

- `wms-nube.html` - Aplicación WMS completa
- `wms-firebase-config.js` - Configuración de Firebase (para referencia)
- `GUIA-INSTALACION.md` - Este archivo

---

**Fecha de creación**: Febrero 2026
**Versión**: 1.0
