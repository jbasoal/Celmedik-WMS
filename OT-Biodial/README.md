# OT-Biodial — Aplicación de fabricación

Aplicación web para el proceso de fabricación y envasado de soluciones concentradas de diálisis en Biodial.

## Contenido de esta carpeta

| Archivo | Rol |
|---|---|
| `index.html` | **Aplicación completa** (SPA de una sola página). Único archivo con lógica ejecutable en esta carpeta. |
| `CLAUDE.md` | Instrucciones de proyecto para Claude Code cuando el cwd es esta carpeta. |
| `docs/ARQUITECTURA.md` | Cómo se conecta a Firebase compartido, subárbol de datos, perfiles. |
| `docs/DEPENDENCIAS.md` | Librerías CDN utilizadas (Firebase, jsPDF, Chart.js). |
| `docs/DEPLOY.md` | Procedimiento de despliegue (**desde la raíz del repo**, no desde acá). |
| `firebase.json.reference` | **Snapshot read-only** del `firebase.json` de la raíz. Solo para lectura del agente/humano. |
| `database.rules.reference` | Snapshot read-only del `database.rules.json` de la raíz. |
| `package.json.reference` | Snapshot read-only del `package.json` de la raíz. |

## Fuentes de verdad

Los archivos **live** que Firebase usa realmente están en la raíz del repo (`../`):
- `../firebase.json`
- `../database.rules.json`
- `../package.json`

**Cualquier cambio que deba surtir efecto debe hacerse en esos archivos de la raíz**, no en los `.reference` de acá. Si tocas la raíz, actualiza también los snapshots de esta carpeta para que no queden obsoletos (`cp ../firebase.json firebase.json.reference`).

## Cómo abrir Claude Code para trabajar solo en OT-Biodial

Apuntá el `cwd` al directorio `OT-Biodial/`:

```bash
cd "C:/Users/DT BIODIAL/Celmedik-WMS/OT-Biodial"
claude
```

Claude Code cargará automáticamente el `CLAUDE.md` de esta carpeta como contexto principal.

## URL
Producción: **`https://celmedik-inventario.web.app/ot-biodial/`**

## Relación con el WMS
Comparte proyecto Firebase (`celmedik-inventario`), auth y repositorio git con [Celmedik-WMS](../). Los datos viven en un subárbol distinto (`usuarios/{uid}/otBiodial/`) — no hay riesgo de mezcla.
