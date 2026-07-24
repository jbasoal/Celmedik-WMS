# Arquitectura — OT-Biodial

## Vista general

OT-Biodial es una **SPA HTML de un solo archivo** (`index.html`, ~2000 líneas) que corre en el navegador y persiste todos sus datos en Firebase Realtime Database. No hay backend propio ni build step.

```
Navegador (celmedik-inventario.web.app/ot-biodial/)
        │
        ▼
Firebase Hosting  ──(sirve OT-Biodial/index.html vía rewrite)
        │
        │  Firebase Auth (compat SDK 10.7.1)
        │  Firebase Realtime DB
        ▼
Proyecto Firebase: celmedik-inventario
    (compartido con la app WMS-Celmedik hermana)
```

## Rewrite de hosting

En `../firebase.json` (raíz):

```json
"rewrites": [
  { "source": "/ot-biodial/**", "destination": "/OT-Biodial/index.html" },
  { "source": "**",             "destination": "/index.html" }
]
```

- La primera regla sirve OT-Biodial en `/ot-biodial/*`.
- La segunda regla es el fallback SPA del WMS (todo lo demás → `index.html` del WMS).

## Autenticación

Aunque comparte `firebase.auth()` con el WMS, OT-Biodial **exige login manual por pestaña** para no auto-loguear con sesiones heredadas:

1. `onAuthStateChanged` chequea `sessionStorage.getItem('otBiodialAuth')`.
2. Si no está seteado a `'yes'`, se muestra la pantalla de login (aunque haya un usuario Firebase activo).
3. Al completar el login manual, `doLogin` marca la flag y `onAuthStateChanged` continúa.
4. `doLogout` limpia la flag + `auth.signOut()`.
5. Cerrar la pestaña también limpia la flag (por naturaleza de `sessionStorage`).

Ver `index.html` — funciones `_otbAuthOK / _otbAuthSet / _otbAuthClear`.

## Bootstrap del Maestro

El **dueño de los datos** (`u.uid === rootUid`) recibe perfil `Maestro` automáticamente en su primer login, y queda persistido en `usuarios/{uid}/otBiodialPerfil`. Cualquier otro usuario nuevo entra a la pantalla "Sin acceso" hasta que el Maestro le asigne un perfil.

## Modelo de datos en Realtime DB

Todo el árbol OT-Biodial vive bajo el nodo del "dueño":

```
usuarios/{rootUid}/otBiodial/
  ├── insumos/{sku}
  │     ficha extendida: sku, descripcion, categoria (Materia Prima/
  │     Material de Empaque/Etiqueta/Otro), subtipo, grado, presentacion,
  │     unidad, factorConversion, principioActivo, cas, farmacopea,
  │     requiereCA, almacenamiento, vidaUtilMeses, stockMin,
  │     fabricante, proveedor, codigoExterno, precioReferencia, notas
  │
  ├── bodegas/{id}
  │     nombre, tipo, ubicacion
  │
  ├── formulas/{skuProducto}
  │     sku, descripcion, tipo (Fabricacion/Envasado),
  │     volumenBase, unidadBase, version,
  │     items: [{ sku, cantidad, unidad, orden, notas }],
  │     pasos: [{ orden, titulo, instruccion, tiempo }],
  │     adjuntos: [{ id, tipo, nombre, mime, tamano, fecha }]
  │
  ├── ordenes/{otId}
  │     numero (OTF-YYYY-NNNNNN o OTE-...), tipo, skuProducto,
  │     descripcionProducto, formulaVersion, volumen, unidadBase, lote,
  │     bodega, fechaEmision, fechaDocumento, fechaCierre, fechaCancelacion,
  │     usuario, perfilUsuario, estado (Emitida/Cerrada/Cancelada),
  │     items: [{ sku, descripcion, requeridoTeorico, consumoTotal,
  │              unidad, loteMP, ubicacion, bodega }],
  │     pasos: [...], notas, adjuntos: [...]
  │
  ├── movimientos/{id}
  │     numero, tipo, sku, descripcion, lote, vence, cantidad, unidad,
  │     bodega, ubicacion, status, statusAnterior, precio, unidad,
  │     documentoId, proveedor, fecha, fechaDocumento, observaciones,
  │     usuario, otId, otTipo, loteFabricado, adjuntos: [...]
  │
  │     tipos: 'Entrada' | 'Ajuste' | 'Destrucción' | 'ConsumoOT'
  │            | 'AjusteInventario'
  │
  ├── contadores/{prefijo}/{año}: integer
  │     prefijos: OTF, OTE, ENT, CST, DST
  │     — actualizados vía transaction() para atomicidad
  │
  ├── auditoria/{id}
  │     fecha, accion, modulo, referencia, detalle, usuario, perfil
  │
  └── adjuntosData/{adjId}
        tipo, nombre, mime, tamano, fecha, usuario, data (base64)
```

## Cálculo de stock

`calcStock()` recorre `data.movimientos` ordenados por fecha y arma el hash `sku|lote|bodega|ubicacion → { cantidad, status, ... }`:

| Tipo movimiento | Efecto en cantidad | Efecto en status |
|---|---|---|
| `Entrada` | +qty | sobreescribe |
| `ConsumoOT` | -qty | — |
| `Destrucción` | -qty | — |
| `AjusteInventario` | +qty (puede ser negativo) | — |
| `Ajuste` (Cambio de Status) | **0 (no cambia cantidad)** | sobreescribe |

**Regla crítica** (heredada del fix del WMS de julio 2026): `Ajuste` **NO suma cantidad**, solo cambia status. Cualquier regresión aquí duplica stock cada vez que se hace un cambio de estatus.

## Permisos por rol

| Operación | Maestro | Jefatura | Visualizador |
|---|---|---|---|
| Crear/editar insumos | ✓ | | |
| Crear/editar fórmulas | ✓ | | |
| Crear bodegas | ✓ | | |
| Emitir OT | ✓ | ✓ | |
| Cerrar OT | ✓ | ✓ | |
| Consumo extra ≤ 3% | ✓ | ✓ | |
| Consumo extra > 3% | ✓ | | |
| Cancelar OT (reversión de stock) | ✓ | | |
| Asignar perfiles | ✓ | | |
| Ver todo | ✓ | ✓ | ✓ |

Verificado en runtime por: `canModifyFormulas()`, `canOperate()`, `canAdjustOver3()`.
