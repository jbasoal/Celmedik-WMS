# Guardado automático de PDFs de Salida en Google Drive

Esta guía te acompaña para activar la subida automática de cada PDF de Salida
a las carpetas de Drive por bodega (Los Ángeles / Stgo), sin tarjeta de crédito
y sin login por usuario.

## Qué vas a hacer

1. Pegar el script de `apps-script-drive.gs` en script.google.com (cuenta `celmedikspa@gmail.com`).
2. Publicarlo como Web App.
3. Copiar la URL pública + el secret al WMS (Ajustes → Administración → "Guardado automático en Google Drive").

Tiempo estimado: **10 minutos.**

---

## Paso 1. Generar un secret aleatorio

Abre un terminal y genera una cadena aleatoria (usa esto para tu `SHARED_SECRET`):

```bash
# Cualquiera de estas formas sirve:
openssl rand -hex 32
# o en PowerShell:
[Guid]::NewGuid().ToString() + [Guid]::NewGuid().ToString()
```

Guarda ese valor — lo usaremos dos veces.

## Paso 2. Crear el Apps Script

1. Entra a https://script.google.com con la cuenta **celmedikspa@gmail.com**.
2. Botón **"Nuevo proyecto"** → se abre el editor.
3. Ponle nombre arriba a la izquierda: `Celmedik WMS - Drive Uploader`.
4. Borra todo el contenido por defecto.
5. Copia y pega **íntegro** el contenido de `scripts/apps-script-drive.gs`.
6. **Reemplaza** la línea:
   ```javascript
   var SHARED_SECRET = 'REEMPLAZAR_POR_SECRET_ALEATORIO_LARGO';
   ```
   por el valor aleatorio que generaste en el paso 1.
7. Click en el ícono de **Guardar** (💾) arriba.

## Paso 3. Desplegar como Web App

1. En el editor, arriba a la derecha: **Implementar** → **Nueva implementación**.
2. Click en el ícono del engranaje (⚙) junto a "Tipo" → elige **Aplicación web**.
3. Completa:
   - **Descripción**: `v1 - uploader WMS`
   - **Ejecutar como**: **Yo (celmedikspa@gmail.com)**
   - **Quién tiene acceso**: **Cualquier usuario**
4. Click **Implementar**.
5. Google te pedirá autorización. Acepta todo (verás "Esta app no se ha verificado" → *Configuración avanzada* → *Ir a Celmedik WMS* → *Permitir*).
6. Al terminar, copia la **URL de aplicación web** que termina en `/exec`. Debe verse así:
   ```
   https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxx/exec
   ```

## Paso 4. Configurar el WMS

1. Entra al WMS (celmedik-inventario.web.app) con tu cuenta Maestro.
2. Ve a **Ajustes** → verás la tarjeta **"Guardado automático en Google Drive"**.
3. Pega:
   - **URL del Web App**: la URL `/exec` del paso 3.
   - **Secret compartido**: el mismo secret del paso 1.
4. Click **🧪 Probar conexión** — debe mostrarte "Conexión OK".
5. Click **Guardar configuración**.

## Paso 5. Probar con una Salida real

Genera una Salida desde la bodega Los Ángeles. Al guardar deberías ver:

- Un toast azul "Subiendo a Google Drive..."
- Luego un toast verde "✓ guardado en Drive"
- El PDF aparecerá en **tu carpeta de Los Ángeles** dentro de segundos.

Lo mismo para Santiago. Las auditorías de subidas quedan en RTDB en
`usuarios/<tu-uid>/driveUploads/`.

---

## Cuando agregues más bodegas

Edita el Apps Script y añade entradas a `FOLDERS_BY_BODEGA`:

```javascript
var FOLDERS_BY_BODEGA = [
  { match: 'los angeles', folderId: '...' },
  { match: 'stgo',        folderId: '...' },
  { match: 'concepcion',  folderId: 'nuevo-id-de-carpeta' }, // ← nueva
  ...
];
```

Después: **Implementar → Administrar implementaciones → editar la existente →
Nueva versión → Implementar**. La URL se mantiene; no necesitas tocar el WMS.

## Rotar el secret

Si sospechas filtración:

1. Genera un nuevo secret.
2. Actualízalo en el `.gs` + redeploy.
3. Actualízalo en el WMS (Ajustes → "Guardado automático en Google Drive").

## Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `no autorizado` | secret del WMS ≠ secret del script | Revisa que ambos coincidan exactamente (sin espacios) |
| `HTTP 401`/redirect | Web App no está publicado como *"Cualquier usuario"* | Vuelve al paso 3.3 |
| PDF no llega a la carpeta correcta | Nombre de bodega diferente al `match` | Agrega alias en `FOLDERS_BY_BODEGA` o renombra la bodega en el WMS |
| Falla sin mensaje | Autorización de Drive caducada (ocurre cada 6 meses) | Recibes email de Google → 1 clic para renovar |

## Cuota

Apps Script Web App en cuenta gratuita Gmail:
- **20.000 ejecuciones/día** (muy superior a tu uso)
- **50 MB por solicitud** (PDFs reales son <500 KB)
- **6 min de ejecución por invocación** (cada subida toma <2 s)
