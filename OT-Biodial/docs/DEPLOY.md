# Deploy — OT-Biodial

## Regla de oro

**El deploy se ejecuta desde la raíz del repositorio**, no desde esta carpeta. El mismo comando publica el WMS y OT-Biodial juntos, porque comparten `firebase.json`.

## Prerrequisitos

- `firebase-tools` instalado y autenticado (`firebase login`).
- `git` configurado con acceso a `github.com/jbasoal/Celmedik-WMS`.
- Estar en la rama `main`.

## Procedimiento

Desde la raíz del repo `C:\Users\DT BIODIAL\Celmedik-WMS\`:

```bash
# 1. Verificar cambios
git status

# 2. Añadir sólo los archivos de OT-Biodial (si sólo tocaste esto)
git add OT-Biodial/

# 3. Commit descriptivo
git commit -m "feat(ot-biodial): <descripción>"

# 4. Push
git push

# 5. Deploy a producción
firebase deploy --only hosting
```

El deploy sube **todos** los archivos servidos (`index.html` del WMS + `OT-Biodial/index.html` + `conductor.html` + `seguimiento.html` + `transporte.html`).

## URLs resultantes

| App | URL |
|---|---|
| WMS Celmedik | https://celmedik-inventario.web.app/ |
| OT-Biodial | https://celmedik-inventario.web.app/ot-biodial/ |

## Cache

`firebase.json` fuerza `Cache-Control: no-cache` para todos los `*.html`, así que basta con `Ctrl-F5` en el navegador tras un deploy — no hay que esperar propagación de CDN para el HTML.

## Rollback rápido

```bash
# Ver historial de deploys
firebase hosting:channel:list

# Volver al deploy anterior
firebase hosting:rollback
```

O revertir el commit y redesplegar:
```bash
git revert <commit-hash>
git push
firebase deploy --only hosting
```

## No desplegar solo OT-Biodial

Firebase Hosting no permite desplegar "solo un archivo" o "solo una subcarpeta" — sube el snapshot completo. Si necesitas evitar que un cambio del WMS suba, hazlo por separado en commits/deploys distintos.

## Reglas de base de datos

Las reglas de RTDB (`database.rules.json` en la raíz) se despliegan con:

```bash
firebase deploy --only database
```

**No modifiques `OT-Biodial/database.rules.reference`** — es solo un snapshot informativo. La fuente de verdad está en `../database.rules.json`.

## Chequeos post-deploy

1. Abrir `https://celmedik-inventario.web.app/ot-biodial/` en incógnito.
2. Confirmar que aparece la pantalla de login (no auto-login).
3. Ingresar con Maestro → verificar Dashboard, Maestro de Insumos y Órdenes de Trabajo.
4. Si tocaste `calcStock` o consumos, verificar en `Stock Actual` que las cifras cuadren.
