# Celmedik WMS · Cloud Function para OneDrive

Sube automáticamente los PDFs de Salida a una carpeta compartida de OneDrive,
sin que los usuarios (Maestro/Farmacéutico/Operador) tengan que iniciar sesión
en Microsoft desde el navegador.

## Arquitectura

1. El navegador genera el PDF (jsPDF) y hace POST multipart a la Cloud Function
   con su Firebase ID token en `Authorization: Bearer ...`.
2. La función verifica el token, consulta `usuarios/<uid>` en RTDB y valida que
   el perfil esté en `[Maestro, Farmacéutico, Operador]`.
3. Usa un **refresh token de Microsoft** guardado como secret de Firebase para
   pedir un access token fresco y sube el PDF vía Microsoft Graph a la carpeta
   compartida configurada en otro secret.
4. Registra cada subida exitosa en `onedriveUploads/` en RTDB para auditoría.

---

## Pasos de instalación (una sola vez)

### 1. Registrar la app en Azure

1. Abre https://portal.azure.com y entra con la cuenta Microsoft que es **dueña**
   de la carpeta OneDrive.
2. Busca **"App registrations"** → **"+ New registration"**.
3. Completa:
   - **Name**: `Celmedik WMS OneDrive Uploader`
   - **Supported account types**: *"Personal Microsoft accounts only"*
     (elige esta si usas una cuenta `@outlook.com`, `@hotmail.com`, `@live.com`.
     Si usas Microsoft 365 corporativo, elige *"Accounts in any organizational directory and personal Microsoft accounts"*).
   - **Redirect URI**: tipo `Public client/native` → `http://localhost:53682/callback`
4. Click **Register**.
5. En la pantalla del registro:
   - Copia el **Application (client) ID** → ese será el valor del secret
     `MS_CLIENT_ID`.
   - Abre **"Authentication"** → al final de la página, en *"Advanced settings"*,
     asegúrate de que **"Allow public client flows"** esté en **Yes**. Save.
6. Abre **"API permissions"** → **Add a permission** → *Microsoft Graph* →
   *Delegated permissions* → marca **`Files.ReadWrite`** y **`offline_access`**.
   Click **Add permissions**.
7. (Opcional, pero recomendado) click **Grant admin consent** si tu cuenta lo
   permite.

> Si prefieres usar **confidential client** con secret, en la misma app ve a
> **"Certificates & secrets"** → *New client secret*, copia el valor y guárdalo
> en `MS_CLIENT_SECRET`. Si lo haces, en `index.js` se usará automáticamente.

### 2. Obtener el refresh token

```bash
cd functions
npm install
export MS_CLIENT_ID="tu-client-id-aqui"
# si creaste client secret, exporta también:
# export MS_CLIENT_SECRET="tu-secret"
node seed-refresh-token.js
```

El script imprime una URL. Ábrela en el navegador, inicia sesión con la cuenta
Microsoft dueña de la carpeta, acepta los permisos. Microsoft redirige a
`http://localhost:53682/callback?code=...` y el script canjea el code
automáticamente por un `refresh_token` que imprime en la terminal.

### 3. Cargar los secrets en Firebase

Tu proyecto debe estar en **plan Blaze** (pay-as-you-go; gratis para tu volumen):

```bash
firebase projects:list           # verifica que celmedik-inventario esté activo
firebase use celmedik-inventario

firebase functions:secrets:set MS_CLIENT_ID         # pega el client ID
firebase functions:secrets:set MS_REFRESH_TOKEN     # pega el refresh token del paso 2
firebase functions:secrets:set MS_SHARE_URL         # pega la URL completa de la carpeta compartida
# Solo si creaste client secret en Azure:
firebase functions:secrets:set MS_CLIENT_SECRET
```

La URL de la carpeta es la que te dio OneDrive al hacer *Share* (p.ej.
`https://1drv.ms/f/c/eb6882341e37c5fe/IgAPZr...`).

> Asegúrate de que el permiso del share sea **"Edit for anyone with the link"**,
> no solo *view*.

### 4. Desplegar la Cloud Function

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Al terminar, Firebase imprime la URL de la función, algo como:

```
Function URL (uploadSalidaPdf): https://uploadsalidapdf-<hash>-uc.a.run.app
```

### 5. Configurar el endpoint en el WMS

En el WMS, entra con tu cuenta Maestro → **Ajustes → Administración →
Guardado automático en OneDrive** → pega la URL de la función y guarda.

Listo. Desde ese momento, cada PDF de Salida que genere cualquier usuario
Maestro/Farmacéutico/Operador se subirá automáticamente a la carpeta.

---

## Mantenimiento

- **Refresh token caducado**: si alguna vez falla la subida con error `invalid_grant`,
  repite el paso 2 y actualiza el secret `MS_REFRESH_TOKEN`. El token dura
  indefinidamente mientras se use con regularidad.
- **Ver logs**:
  ```bash
  firebase functions:log --only uploadSalidaPdf
  ```
- **Auditoría**: cada subida queda en RTDB bajo `onedriveUploads/` con uid,
  email, perfil, nombre de archivo, webUrl, timestamp y metadatos del documento.

---

## Costos estimados (plan Blaze)

- **Cloud Functions**: 2M invocaciones gratis/mes. A volumen típico (< 200 salidas/mes),
  costo $0.
- **Egreso de red**: los PDFs son pequeños (< 500 KB), coste despreciable.
- **Secret Manager**: 10,000 accesos gratis/mes.

Para tu operación el costo real esperado es **$0–$2 USD/mes**.
