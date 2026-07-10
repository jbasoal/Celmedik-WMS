// Corrección de dos Salidas registradas en cajas (1 caja = 3 uds) en vez
// de unidades. Aplicable a las Salidas cuyos documentoId/referencia son
// '6723' y '6748' (facturas por despachar del mismo N°).
//
// Objetivo funcional:
//   1) La cantidad de cada línea de Salida pase a ser cantidad * 3, para
//      que corresponda a unidades reales despachadas.
//   2) La factura por despachar 6723 / 6748 refleje el nuevo despachado
//      real → su pendiente se recalcula automáticamente al recargar la
//      app (helpers _despachadoPorFacturaSKU/_pendientePorSKUFactura).
//   3) El stock actual disponible NO cambie: por cada Salida modificada
//      se agrega un AjusteInventario positivo por la delta (cantidad*2)
//      en el mismo lote/bodega/ubicación, compensando exactamente lo
//      que la Salida triplicada resta al stock.
//
// Movimientos originales:
//   - La Salida se MODIFICA in-place (campos cantidad, observaciones,
//     correccionCajaAUnidad, cantidadOriginalAntesCorreccion).
//   - Se agrega un movimiento nuevo tipo AjusteInventario 'Positivo'
//     que compensa el stock. Este ajuste queda vinculado a la Salida
//     via correccionSalidaMovId + observaciones explicativas.
//
// Ejecución:
//   node scripts/ajuste-salidas-6723-6748.js           (dry-run)
//   node scripts/ajuste-salidas-6723-6748.js --apply   (aplica cambios)
//
// Requiere GOOGLE_APPLICATION_CREDENTIALS.

const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://celmedik-inventario-default-rtdb.firebaseio.com'
  });
}
const db = admin.database();

const ROOT_UID   = 'XxnrZJwsPpgKYtNWO78BAyoUyWM2';
const FACTURAS   = ['6723', '6748'];    // documentoId / referencia
const FACTOR     = 3;                    // 1 caja = 3 uds → multiplicar Salida por 3
const USUARIO    = 'j.basoalto@grupopharmarket.com';
const FECHA_ISO  = new Date().toISOString();
const FECHA_DOC  = FECHA_ISO.slice(0, 10);
const OBS_SALIDA_APPEND =
  ' | [Corrección box→unidad: cantidad registrada originalmente en cajas (x1); corregida a unidades (x3) por ingreso incorrecto de unidad de venta].';
const OBS_AJUSTE =
  'Compensación de stock por corrección box→unidad en Salida. Sin efecto neto en stock: la Salida asociada fue multiplicada por 3 y este ajuste (+cantidad_original*2) compensa la diferencia.';

function matchFactura(m, numero) {
  const docId = (m.documentoId || '').trim();
  const ref   = (m.referencia  || '').trim();
  return docId === numero || ref === numero;
}

async function main() {
  console.log('');
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log(`  CORRECCIÓN box→unidad · Salidas de facturas ${FACTURAS.join(', ')}`);
  console.log(`  Modo: ${APPLY ? 'APPLY (se ESCRIBIRÁN los cambios)' : 'DRY-RUN (solo lista)'}`);
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log('');

  const movSnap = await db.ref(`usuarios/${ROOT_UID}/movimientos`).once('value');
  const movimientos = movSnap.val() || {};

  // Detectar si ya se corrió esta corrección (para no doble-aplicarla).
  const yaCorregidas = [];
  Object.entries(movimientos).forEach(([id, m]) => {
    if (m && m.tipo === 'Salida' && m.correccionCajaAUnidad === true && FACTURAS.some(n => matchFactura(m, n))) {
      yaCorregidas.push(id);
    }
  });
  if (yaCorregidas.length) {
    console.log(`⚠ Ya hay ${yaCorregidas.length} Salida(s) marcada(s) como corregida(s) (correccionCajaAUnidad=true).`);
    console.log(`  IDs: ${yaCorregidas.slice(0, 5).join(', ')}${yaCorregidas.length > 5 ? ' ...' : ''}`);
    console.log(`  Estas líneas serán OMITIDAS para evitar doble corrección.`);
    console.log('');
  }

  // Salidas objetivo por factura.
  const porFactura = {};
  FACTURAS.forEach(f => { porFactura[f] = []; });

  Object.entries(movimientos).forEach(([id, m]) => {
    if (!m || m.tipo !== 'Salida') return;
    if (m.correccionCajaAUnidad === true) return; // ya corregida
    const q = parseFloat(m.cantidad) || 0;
    if (q <= 0) return;
    for (const numero of FACTURAS) {
      if (matchFactura(m, numero)) {
        porFactura[numero].push({ id, ...m });
        break;
      }
    }
  });

  let totalLineas = 0;
  let totalDelta  = 0;

  for (const numero of FACTURAS) {
    const salidas = porFactura[numero];
    console.log(`── Factura ${numero} · ${salidas.length} línea(s) de Salida ────────────────────────────────`);
    if (!salidas.length) { console.log(`  (Sin Salidas encontradas para el N° ${numero})`); console.log(''); continue; }

    console.log(`  SKU           LOTE                UBICACION       BODEGA                ACTUAL      NUEVO (x3)    +AJUSTE`);
    console.log(`  ────────────────────────────────────────────────────────────────────────────────────────────────────────────`);
    salidas.sort((a, b) => (a.sku || '').localeCompare(b.sku || '') || (a.lote || '').localeCompare(b.lote || ''));
    let sub = 0;
    salidas.forEach(s => {
      const q = parseFloat(s.cantidad) || 0;
      const nuevaQty = q * FACTOR;
      const delta    = q * (FACTOR - 1);
      sub += delta;
      totalLineas++;
      totalDelta += delta;
      const line = [
        String(s.sku || '').padEnd(13),
        String(s.lote || '').padEnd(19),
        String(s.ubicacion || '').padEnd(15),
        String(s.bodega || '').padEnd(20),
        String(q).padStart(9),
        String(nuevaQty).padStart(12),
        String(delta).padStart(10)
      ].join('  ');
      console.log('  ' + line);
    });
    console.log(`  ────────────────────────────────────────────────────────────────────────────────────────────────────────────`);
    console.log(`  Delta factura ${numero}: +${sub} ud (a agregar como AjusteInventario positivo para compensar stock)`);
    console.log('');
  }

  console.log(`  TOTAL a corregir: ${totalLineas} línea(s) · Delta neto en despacho: +${totalDelta} ud`);
  console.log(`  (Cada delta genera un AjusteInventario positivo para NO alterar el stock actual)`);
  console.log('');

  if (!totalLineas) { console.log('Nada que hacer.'); process.exit(0); }
  if (!APPLY) {
    console.log('DRY-RUN completado. Ejecute con --apply para escribir los cambios.');
    process.exit(0);
  }

  // ── Aplicar ────────────────────────────────────────────────────────
  const ts0 = Date.now();
  const updates = {};
  let idxAjuste = 0;

  for (const numero of FACTURAS) {
    porFactura[numero].forEach(s => {
      const qOriginal = parseFloat(s.cantidad) || 0;
      const nuevaQty  = qOriginal * FACTOR;
      const delta     = qOriginal * (FACTOR - 1);

      // 1) Actualizar la Salida en su lugar.
      const nuevaObs = ((s.observaciones || '') + OBS_SALIDA_APPEND).slice(0, 500);
      updates[`usuarios/${ROOT_UID}/movimientos/${s.id}/cantidad`] = nuevaQty;
      updates[`usuarios/${ROOT_UID}/movimientos/${s.id}/observaciones`] = nuevaObs;
      updates[`usuarios/${ROOT_UID}/movimientos/${s.id}/correccionCajaAUnidad`] = true;
      updates[`usuarios/${ROOT_UID}/movimientos/${s.id}/cantidadOriginalAntesCorreccion`] = qOriginal;
      updates[`usuarios/${ROOT_UID}/movimientos/${s.id}/correccionFecha`] = FECHA_ISO;
      updates[`usuarios/${ROOT_UID}/movimientos/${s.id}/correccionUsuario`] = USUARIO;

      // 2) Ajuste positivo compensatorio.
      const ajusteMov = {
        tipo: 'AjusteInventario',
        ajusteTipo: 'Positivo',
        sku: s.sku,
        lote: s.lote,
        vence: s.vence || '',
        descripcion: s.descripcion || '',
        cantidad: delta,
        bodega: s.bodega || '',
        ubicacion: s.ubicacion || '',
        observaciones: `${OBS_AJUSTE} Salida referencia ${numero}, mov id ${s.id}, cantidad original ${qOriginal} → corregida ${nuevaQty}.`,
        fecha: FECHA_ISO,
        usuario: USUARIO,
        status: 'Aprobado',
        correccionSalidaMovId: s.id,
        correccionSalidaFactura: numero,
        fechaDocumento: FECHA_DOC
      };
      updates[`usuarios/${ROOT_UID}/movimientos/${ts0 + idxAjuste}`] = ajusteMov;
      idxAjuste++;
    });
  }

  console.log(`Escribiendo ${totalLineas} corrección(es) de Salida + ${idxAjuste} ajuste(s) compensatorio(s)…`);
  await db.ref().update(updates);

  // Auditoría resumen.
  const auditId = ts0 + 5000000;
  await db.ref(`usuarios/${ROOT_UID}/auditoria/${auditId}`).set({
    fecha: FECHA_ISO,
    accion: 'Corrección box→unidad en Salidas',
    modulo: 'Movimientos',
    sku: `${FACTURAS.length} factura(s)`,
    lote: '',
    detalle: `Facturas ${FACTURAS.join(', ')} · ${totalLineas} Salida(s) corregidas (x3) + ${idxAjuste} ajuste(s) compensatorio(s). Delta despacho: +${totalDelta} ud. Stock actual sin cambio.`,
    usuario: USUARIO
  });

  console.log('');
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log(`  ✓ Salidas corregidas:  ${totalLineas}`);
  console.log(`  ✓ Ajustes compensat.:  ${idxAjuste}`);
  console.log(`  ✓ Auditoría:           id ${auditId}`);
  console.log(`  ✓ Stock actual:         SIN CAMBIO (compensado línea a línea)`);
  console.log(`  ✓ Facturas 6723/6748:   pendiente recalcula automáticamente en la app`);
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Nota: al recargar la app, las Facturas por Despachar 6723 y 6748 mostrarán');
  console.log('el pendiente actualizado. Si alguna quedó totalmente cubierta, su estatus');
  console.log('cambiará a "Despachada" en el próximo movimiento de Salida (o manualmente).');
  console.log('El estatus persistido no se toca por este script — la vista se actualiza sola.');
  process.exit(0);
}

main().catch(err => { console.error('FALLO:', err); process.exit(1); });
