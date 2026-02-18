# MSG-018 [ASSISTANT]
Archived: 2026-02-13T15:51:33.017717+00:00

---

Buena pregunta! OneDrive no funciona bien para esto porque:

- Solo almacena archivos, no es una base de datos
- Si dos personas editan el mismo archivo, hay conflictos
- No permite sincronización en tiempo real

---

## Solución: Hospedar en web + Base de datos en la nube

Tengo una **opción gratis** que te puede funcionar:

### Stack que propongo:
1. **Frontend (WMS)**: GitHub Pages (gratis) - Aloja el archivo HTML
2. **Base de datos**: Firebase (gratis para proyectos pequeños) - Guarda los datos en la nube

### Beneficios:
- ✅ Acceso desde cualquier computador
- ✅ Multiples usuarios al mismo tiempo
- ✅ Datos sincronizados en tiempo real
- ✅ Sin costo mensual
- ✅ Respaldo automatico en la nube

### Limitación (versión gratuita):
- Hasta 100,000 usuarios activos/mes
- 1 GB de almacenamiento
- Suficiente para tu bodega

---

## Alternativa simple (gratis)

Si prefieres algo mas simple por ahora:

- Subir el archivo a **GitHub Pages** (gratis)
- Los datos se guardan localmente en cada navegador
- Para compartir datos, los usuarios harian export/import de Excel

---

 cual opcion te interesa mas?

1. **Version completa** - GitHub Pages + Firebase (multiples usuarios, datos sincronizados)
2. **Version simple** - Solo GitHub Pages (datos locales, con export/import)

Te puedo ayudar a configurar cualquiera de las dos!