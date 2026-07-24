# Proyecto: OT-Biodial

Aplicación para el proceso de **fabricación y envasado de soluciones concentradas de diálisis** en Biodial.

## Ubicación
- Carpeta del proyecto: `C:\Users\DT BIODIAL\Celmedik-WMS\OT-Biodial\`
- Todo el código de OT-Biodial vive en `OT-Biodial/index.html` (una sola SPA).
- Este proyecto **comparte el repositorio git** y la **infraestructura Firebase** con el proyecto hermano [Celmedik-WMS](../CLAUDE.md), pero sus datos, UI y flujos son independientes.

## Stack tecnológico
- HTML + JavaScript (una sola página `index.html`, ~2000 líneas).
- Firebase compat SDK v10.7.1: Auth + Realtime Database.
- jsPDF 2.5.1 + jspdf-autotable 3.8.2 (PDFs de OT y movimientos).
- Chart.js 4.4.2 (dashboard).
- Todo por CDN — sin `node_modules` propio.
- Persistencia adicional: `sessionStorage.otBiodialAuth` (flag por-pestaña que fuerza login manual, ver `Auth` más abajo).

## URL de acceso
- Producción: **`https://celmedik-inventario.web.app/ot-biodial/`**
- Rewrite en `../firebase.json`: `/ot-biodial/**` → `/OT-Biodial/index.html`.

## Relación con celmedik-inventario
- **Mismo proyecto Firebase** (`celmedik-inventario`) — mismos usuarios/auth.
- **Base de datos separada por subárbol**: los datos de OT-Biodial viven bajo `usuarios/{rootUid}/otBiodial/…` (no chocan con WMS).
- Un usuario puede tener rol distinto en cada app (ver Perfiles).
- El `firebase.json` y las `database.rules.json` **viven en la raíz del repo**. Aquí hay copias `.reference` sólo como snapshot para lectura.

## Datos en Realtime DB

```
usuarios/{uid}/
  otBiodialPerfil            # 'Maestro' | 'Jefatura' | 'Visualizador'
  otBiodialPerfilAt          # ISO timestamp de última asignación
  maestroUid                 # (heredado del WMS) uid del dueño de los datos

usuarios/{rootUid}/otBiodial/
  insumos/{sku}              # Maestro extendido (MP, empaque, etiquetas...)
  bodegas/{id}
  formulas/{sku}             # BOM + pasos + adjuntos, versionada
  ordenes/{otId}             # OT emitidas (Fabricacion / Envasado)
  movimientos/{id}           # Entrada, Ajuste, Destrucción, ConsumoOT, AjusteInventario
  contadores/{OTF|OTE|ENT|CST|DST}/{año}
  auditoria/{id}             # Log inmutable
  adjuntosData/{adjId}       # Base64 (limite 3 MB por archivo)
```

## Perfiles
- **Maestro**: puede modificar insumos, fórmulas y OTs; asignar perfiles; hacer ajustes de consumo > 3%; cancelar OTs.
- **Jefatura**: puede ingresar insumos, emitir/cerrar OTs, agregar consumo extra ≤ 3%.
- **Visualizador**: solo lectura.

Guards en JS: `canModifyFormulas()`, `canOperate()`, `canAdjustOver3()`.  
Selectores CSS: `.only-maestro` / `.not-visualizador` — se togglean vía `applyRoleVisibility()` al login.

## Auth
- **Login manual obligatorio por pestaña**: aunque Firebase Auth mantenga sesión compartida con el WMS, `onAuthStateChanged` solo deja pasar al usuario si `sessionStorage.otBiodialAuth === 'yes'`. Ese flag se marca únicamente cuando el usuario completa el formulario `#loginScreen`. Al hacer *Salir* se limpia el flag + `auth.signOut()`.
- **Bootstrap automático**: el dueño de los datos (usuario cuyo `uid === rootUid` — usualmente el Maestro del WMS) recibe perfil `Maestro` OT-Biodial automáticamente en su primer login, y queda persistido en `usuarios/{uid}/otBiodialPerfil`.
- **Sin acceso**: si un usuario válido no tiene perfil OT-Biodial, se muestra la pantalla `#noAccessScreen` con botón para cerrar sesión.

## Reglas de negocio importantes
- **FEFO** al asignar lote de materia prima en la emisión de OT (`recalcOTItems`, ordenar por vencimiento).
- **Cambio de Status (`tipo:'Ajuste'`) NO altera cantidad** — solo actualiza el status. Este es el fix heredado del WMS (evita duplicar stock — ver historial de commits del WMS, incidente 2026-07-21 lote HC-002).
- **Consumo extra**: excedente > 3% del teórico requiere perfil Maestro (`canAdjustOver3()`).
- **Cancelación de OT**: solo Maestro. Genera `AjusteInventario` positivos que revierten el `ConsumoOT` original.
- **Adjuntos**: máx 3 MB por archivo, guardados como base64 en `adjuntosData/`. No usar Firebase Storage (requiere plan Blaze).

## Numeración correlativa
Vía `siguienteCorrelativo(prefijo)` con `db.ref().transaction`:
- **OTF-YYYY-NNNNNN**: Órdenes de Fabricación
- **OTE-YYYY-NNNNNN**: Órdenes de Envasado
- **ENT-YYYY-NNNNNN**: Entradas de insumos
- **CST-YYYY-NNNNNN**: Cambios de status
- **DST-YYYY-NNNNNN**: Destrucciones

## Deploy
**No se despliega desde esta carpeta.** El deploy se hace desde la raíz del repo:

```bash
cd C:/Users/DT\ BIODIAL/Celmedik-WMS
git add . && git commit -m "..." && git push
firebase deploy --only hosting
```

El hosting sirve **ambas apps** (WMS + OT-Biodial) en el mismo deploy. Ver `docs/DEPLOY.md`.

## Convenciones al modificar código
- Prefiere editar `OT-Biodial/index.html` — no crear archivos nuevos salvo que la funcionalidad lo justifique.
- Reusa helpers existentes: `$()`, `openModal`, `closeModal`, `showConfirm`, `showFormError`, `fmtNum`, `fmtDate`, `fmtDateTime`, `logAudit`, `siguienteCorrelativo`, `saveAdjuntosBase64`, `downloadAdjuntoRTDB`, `calcStock`, `stockDe`.
- Cualquier operación que **descuenta stock** debe pasar por `ConsumoOT` o `AjusteInventario` (nunca modificar `Entrada` directamente).
- Cualquier operación relevante debe llamar `logAudit(accion, modulo, referencia, detalle)`.
- **NO** vuelvas a introducir la lógica bugueada del WMS donde `Ajuste` sumaba cantidad. Ver `calcStock` línea que trata `tipo === 'Ajuste'`.

## Docs adicionales
- `docs/ARQUITECTURA.md`: arquitectura, subárbol de datos, integración con Firebase compartido.
- `docs/DEPENDENCIAS.md`: librerías CDN utilizadas.
- `docs/DEPLOY.md`: procedimiento de despliegue.
- `firebase.json.reference`, `database.rules.reference`, `package.json.reference`: snapshots read-only de los configs de la raíz.
