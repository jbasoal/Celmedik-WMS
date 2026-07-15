# PROMPT PARA CLAUDE CODE — Celmedik WMS
## Implementación de Número Interno de Movimiento

---

## CONTEXTO DEL PROYECTO

Estoy trabajando en **Celmedik WMS**, un sistema de gestión de almacén farmacéutico desarrollado en un único archivo `index.html` con Firebase Realtime Database como backend. El sistema cumple con la Norma Técnica N°147 del ISP Chile (BPA/GDP). Está desplegado en `celmedik-inventario.web.app` vía Firebase Hosting.

**Antes de realizar cualquier cambio:**
1. Lee y analiza completamente el archivo `index.html` existente
2. Identifica la estructura actual de datos en Firebase (nodos: `movimientos`, `productos`, `bodegas`, `cuarentena`, `devoluciones`, `auditoria`)
3. Identifica cómo se guardan actualmente los movimientos y qué campos tienen
4. Propón el diseño antes de escribir código y espera mi aprobación

---

## OBJETIVO

Implementar un **número interno de movimiento** generado automáticamente por el sistema para cada operación de bodega registrada a partir de ahora. Este número es independiente del número de documento comercial (factura, guía de despacho, orden de compra) que ya existe en el sistema.

**Los datos históricos existentes NO deben modificarse.** Los movimientos anteriores mantendrán su estructura actual. El número interno aplica solo a los nuevos movimientos registrados desde la implementación.

---

## ESPECIFICACIONES TÉCNICAS

### 1. FORMATO DEL NÚMERO INTERNO

El número debe generarse automáticamente según el tipo de movimiento:

```
ENT-AAAA-NNNNN   → Entradas        (Ej: ENT-2024-00001)
SAL-AAAA-NNNNN   → Salidas         (Ej: SAL-2024-00001)
AJU-AAAA-NNNNN   → Ajustes         (Ej: AJU-2024-00001)
TRF-AAAA-NNNNN   → Transferencias  (Ej: TRF-2024-00001)
```

Donde:
- `AAAA` = año actual (4 dígitos)
- `NNNNN` = número secuencial de 5 dígitos con ceros a la izquierda, reinicia cada año por tipo
- La secuencia es **independiente por tipo** (ENT tiene su propio contador, SAL el suyo, etc.)

### 2. GENERACIÓN DEL NÚMERO EN FIREBASE

Para garantizar que el número sea único y secuencial, usar un nodo contador en Firebase:

```
usuarios/{uid}/contadores/ENT/{año}  → valor numérico actual
usuarios/{uid}/contadores/SAL/{año}  → valor numérico actual
usuarios/{uid}/contadores/AJU/{año}  → valor numérico actual
usuarios/{uid}/contadores/TRF/{año}  → valor numérico actual
```

La función debe:
1. Leer el contador actual del nodo correspondiente
2. Incrementarlo en 1 usando una transacción Firebase (`transaction()`) para evitar duplicados en caso de uso simultáneo
3. Formatear el número con el prefijo, año y padding de ceros
4. Devolver el número formateado antes de guardar el movimiento

```javascript
// Ejemplo de implementación con transacción Firebase
async function generarNumeroMovimiento(tipo) {
    const año = new Date().getFullYear();
    const prefijos = { 'Entrada': 'ENT', 'Salida': 'SAL', 'Ajuste': 'AJU', 'Transferencia': 'TRF' };
    const prefijo = prefijos[tipo] || 'MOV';
    const ref = db.ref(`usuarios/${currentUser.uid}/contadores/${prefijo}/${año}`);
    
    let numeroFinal;
    await ref.transaction(valorActual => {
        numeroFinal = (valorActual || 0) + 1;
        return numeroFinal;
    });
    
    return `${prefijo}-${año}-${String(numeroFinal).padStart(5, '0')}`;
}
```

### 3. CAMPO EN EL REGISTRO DE MOVIMIENTO

Agregar el campo `numeroMovimiento` al objeto que se guarda en Firebase:

```javascript
const movimiento = {
    numeroMovimiento: 'ENT-2024-00001',  // NUEVO CAMPO
    tipo: 'Entrada',
    sku: '...',
    lote: '...',
    // ... resto de campos existentes sin modificar
    referencia: 'FAC-2024-001',  // El número de factura SIGUE existiendo como referencia comercial
}
```

**Importante:** el campo `referencia` (número de factura/guía) debe mantenerse exactamente como está. El `numeroMovimiento` es un campo adicional, no reemplaza nada.

---

## FUNCIONALIDADES REQUERIDAS

### A. ALERTA POR NÚMERO DE DOCUMENTO DUPLICADO

Cuando el usuario ingrese un número en el campo `referencia` (factura/guía/orden), el sistema debe:

1. **Validar en tiempo real** (al salir del campo, evento `onblur` o `onchange`) si ese número de documento ya fue registrado previamente en cualquier movimiento del mismo usuario
2. Si ya existe, mostrar una **alerta visual no bloqueante** (no un `alert()`) dentro del modal, con la siguiente información:
   - Que ese número de documento ya fue utilizado anteriormente
   - Fecha del movimiento anterior donde se usó
   - Tipo de movimiento anterior (Entrada/Salida)
   - SKU y lote del movimiento anterior
   - Número interno de movimiento anterior (si lo tiene)
3. El usuario **puede continuar igualmente** — la alerta es informativa, no bloquea el guardado. Esto porque es válido que una factura tenga múltiples movimientos asociados.
4. Estilo de la alerta: usar los estilos visuales ya existentes en el sistema (`.alert-banner.warning`)

### B. VINCULACIÓN CON PEDIDOS PENDIENTES (SALIDAS)

Para los movimientos de tipo **Salida**, implementar la posibilidad de vincular con un pedido previamente registrado:

**Sub-funcionalidad B.1 — Registro de Pedidos:**
- Crear un nuevo nodo en Firebase: `usuarios/{uid}/pedidos`
- Agregar una sección o modal para registrar pedidos pendientes de despacho con los siguientes campos:
  - `numeroPedido`: número del pedido (generado automáticamente con formato `PED-AAAA-NNNNN`)
  - `numeroOrdenCompra`: número de orden de compra del cliente (campo texto libre)
  - `cliente`: nombre del cliente destinatario
  - `sku`: producto solicitado
  - `cantidad`: cantidad solicitada
  - `fechaSolicitud`: fecha en que se registró el pedido
  - `fechaRequerida`: fecha requerida de entrega
  - `status`: `Pendiente` | `Despachado` | `Despachado Parcial` | `Cancelado`
  - `observaciones`: campo libre
  - `usuario`: email del usuario que lo registró

**Sub-funcionalidad B.2 — Vincular Salida a Pedido:**
- En el modal de nuevo movimiento, cuando el tipo sea **Salida**, mostrar un campo adicional opcional: `Vincular a pedido pendiente`
- Este campo debe ser un **select/dropdown** que liste todos los pedidos con status `Pendiente`, mostrando: número de pedido, cliente, SKU, cantidad solicitada
- Al seleccionar un pedido, autocompletar automáticamente en el formulario de movimiento:
  - Campo `SKU` con el SKU del pedido
  - Campo `proveedor/cliente` con el nombre del cliente del pedido
  - Campo `referencia` con el número de orden de compra del pedido
- Al guardar el movimiento de salida vinculado:
  - Guardar en el movimiento el campo `pedidoVinculado: numeroPedido`
  - Actualizar el status del pedido a `Despachado` (o `Despachado Parcial` si la cantidad despachada es menor a la solicitada)
  - Registrar en el pedido el campo `movimientoAsociado: numeroMovimiento`

**Sub-funcionalidad B.3 — Vista de Pedidos:**
- Agregar una nueva página/sección en el menú lateral llamada **"Pedidos"** con ícono apropiado
- Mostrar tabla con todos los pedidos, filtrable por status y cliente
- Indicar visualmente el status con badges de colores (igual que el resto del sistema)
- Permitir crear nuevos pedidos desde esta vista
- Mostrar el número de movimiento asociado cuando el pedido ya fue despachado

---

## CAMBIOS EN LA INTERFAZ

### En la tabla de Movimientos:
- Agregar columna **"N° Movimiento"** como **primera columna** (antes de Fecha)
- Para movimientos históricos sin número interno, mostrar un guión `—`
- El número debe mostrarse en formato monoespaciado (`font-family: var(--mono)`) con color accent del sistema

### En el modal de Nuevo Movimiento:
- Mostrar el número interno que se va a generar como texto informativo (no editable), por ejemplo: `"Se asignará: ENT-2024-00023"` — actualizar esto dinámicamente cuando el usuario seleccione el tipo de movimiento
- Agregar el campo de vinculación a pedido (solo visible cuando tipo = Salida)
- Agregar el contenedor de alerta de documento duplicado (inicialmente oculto)

### En Trazabilidad y Retiro de Mercado:
- Incluir el número interno de movimiento en la línea de tiempo y en los reportes de retiro
- Permite identificar cada evento de forma única

### En Reportes:
- Incluir columna `N° Movimiento` en todos los reportes existentes (Inventario, Movimientos, Vencimientos)

---

## RESTRICCIONES Y CONSIDERACIONES

1. **No romper funcionalidad existente**: todos los módulos actuales (stock, alertas, cuarentena, devoluciones, FEFO, trazabilidad) deben seguir funcionando exactamente igual
2. **Retrocompatibilidad**: el código debe manejar movimientos sin `numeroMovimiento` (los históricos) sin errores — usar `m.numeroMovimiento || '—'` donde corresponda
3. **Todo en un solo archivo**: el proyecto es un único `index.html`. Todos los cambios van en ese archivo
4. **Firebase Realtime Database**: no usar Firestore. Usar `db.ref()` consistentemente como en el código actual
5. **Estilos consistentes**: usar las variables CSS ya definidas en el sistema (`:root { --accent, --mono, --surface, etc. }`) sin agregar nuevos estilos que rompan la coherencia visual
6. **El número es inmutable**: una vez generado y guardado, el `numeroMovimiento` no puede modificarse. No mostrar campo editable para él
7. **Transacción atómica**: usar `ref.transaction()` de Firebase para el contador, no un simple `set()`, para garantizar unicidad en entornos multiusuario
8. **Manejo de errores**: si falla la generación del número, mostrar error claro al usuario y no guardar el movimiento incompleto

---

## ORDEN DE IMPLEMENTACIÓN SUGERIDO

Implementar en este orden para minimizar riesgos:

1. Función `generarNumeroMovimiento()` con contadores Firebase
2. Integración en `saveMovimiento()` — agregar el número al objeto antes de guardarlo
3. Actualizar `renderMovimientos()` — agregar columna en tabla
4. Alerta de documento duplicado en el modal
5. Módulo de Pedidos (nodo Firebase + vista + modal)
6. Vinculación Salida → Pedido en `saveMovimiento()`
7. Actualizar Trazabilidad y Reportes para incluir el número
8. Pruebas de todos los módulos existentes para verificar que no se rompió nada

---

## RESULTADO ESPERADO

Al finalizar, cada nuevo movimiento registrado tendrá:
- Un número interno único e inmutable (Ej: `ENT-2024-00023`)
- Vinculación a su documento comercial (factura/guía) en el campo `referencia`
- Opcionalmente, vinculación a un pedido pendiente (para salidas)
- Alerta visual si el número de documento ya fue usado antes

Los movimientos históricos seguirán funcionando con `—` en la columna de número interno, sin ningún error.
