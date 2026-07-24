# Dependencias — OT-Biodial

Todas las librerías se cargan por **CDN** desde `<head>` en `index.html`. No hay `package.json` propio ni `node_modules` en esta carpeta.

## Firebase (SDK compat v10.7.1)

```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>
```

Config Firebase (compartida con WMS-Celmedik):
```js
const firebaseConfig = {
  apiKey: "AIzaSyCJ73iFZQaqCGVMZEnUA45HmSpXD_Z0oiE",
  authDomain: "celmedik-inventario.firebaseapp.com",
  projectId: "celmedik-inventario",
  storageBucket: "celmedik-inventario.firebasestorage.app",
  messagingSenderId: "1069071656431",
  appId: "1:1069071656431:web:5ef4c84416c016a934821a",
  databaseURL: "https://celmedik-inventario-default-rtdb.firebaseio.com"
};
```

**Servicios usados:**
- `firebase.auth()` — email/password. Login manual con flag por-pestaña.
- `firebase.database()` — todos los datos + adjuntos (base64) van acá.

**Servicios NO usados:**
- `firebase.storage()` — requiere plan Blaze (de pago). Los adjuntos van como base64 en RTDB con límite 3 MB por archivo.

## Generación de PDFs

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
```

Uso principal:
- `generarPDFOTById(otId)` — PDF de OT con encabezado, tabla de insumos, pasos y firmas.
- `generarPDFMov(documentoId)` — PDF de movimientos (Entrada / Cambio de Status / Destrucción / ConsumoOT).

## Gráficos

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
```

Uso: gráfico de barras "Consumo por mes (últimos 6 meses)" en Dashboard.

## Fuentes

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- **Inter** para UI general.
- **JetBrains Mono** para SKUs, lotes y números.

## Persistencia adicional del navegador

- `sessionStorage['otBiodialAuth']`: flag por-pestaña que fuerza login manual. Ver Auth en ARQUITECTURA.md.

## Sin build step

- Editar `index.html` directamente.
- No hay bundler, no hay TypeScript, no hay transpilación.
- El deploy publica el archivo tal cual está en el disco.
