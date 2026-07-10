// Ajuste de inventario: TRIPLICA (x3) el stock de todos los lotes de
// productos SANOPLEX en la bodega CELMEDIK LOS ANGELES.
//
// Motivo: los ingresos previos se registraron por caja (3 ud/caja) en vez
// de por unidad. Este script no toca el historial: agrega un movimiento
// tipo "AjusteInventario" positivo por cada (SKU|lote|bodega|ubicación)
// con cantidad_actual > 0. El ajuste = cantidad_actual * 2 (para pasar de
// x1 a x3). Los movimientos originales quedan intactos para trazabilidad.
//
// Alcance confirmado por el usuario:
//   - Todos los lotes con cantidad > 0 (cualquier estatus).
//   - Solo bodega CELMEDIK LOS ANGELES.
//   - No modifica facturas por despachar.
//   - Salidas históricas también estaban en cajas -> "stock_actual * 3"
//     representa las unidades reales.
//
// Ejecución:
//   node scripts/ajuste-sanoplex-losangeles.js           (dry-run: solo lista, no escribe)
//   node scripts/ajuste-sanoplex-losangeles.js --apply   (escribe los ajustes en Firebase)
//
// Requiere GOOGLE_APPLICATION_CREDENTIALS apuntando a una service-account
// key del proyecto celmedik-inventario.

const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://celmedik-inventario-default-rtdb.firebaseio.com'
  });
}
const db = admin.database();

// ── Configuración ─────────────────────────────────────────────────────
const ROOT_UID     = 'XxnrZJwsPpgKYtNWO78BAyoUyWM2';
const BODEGA       = 'CELMEDIK LOS ANGELES';
const PREFIJO_NOM  = 'SANOPLEX';   // match sobre descripcion del producto (case-insensitive)
const FACTOR       = 3;             // multiplicador objetivo (x3 = triplicar)
const USUARIO      = 'j.basoalto@grupopharmarket.com';
const FECHA_ISO    = new Date().toISOString();
const FECHA_DOC    = FECHA_ISO.slice(0, 10);
const OBSERVACIONES = 'Ajuste unidad de venta: los ingresos se registraron por caja (3 ud/caja) en vez de por unidad. Se triplica el stock del lote/ubicacion para reflejar unidades reales.';

// ── Replica de calcStock() del cliente ────────────────────────────────
// La clave es exactamente la misma que usa la app: `${sku}|${lote}|${bodega}|${ubicacion}`.
function calcStock(movimientos, devoluciones) {
  const stock = {};
  const movsList = Object.values(movimientos || {})
    .sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));

  movsList.forEach(m => {
    if (!m || !m.sku) return;
    const key = `${m.sku}|${m.lote}|${m.bodega || ''}|${m.ubicacion || ''}`;
    if (m.tipo === 'Entrada') {
      if (!stock[key]) stock[key] = { sku: m.sku, lote: m.lote, cantidad: 0, vence: m.vence, bodega: m.bodega || '', ubicacion: m.ubicacion || '', status: 'Aprobado' };
      stock[key].cantidad += parseFloat(m.cantidad) || 0;
      stock[key].status = m.status || 'Aprobado';
    } else if (m.tipo === 'Salida' || m.tipo === 'Destrucción') {
      if (stock[key]) stock[key].cantidad -= parseFloat(m.cantidad) || 0;
    } else if (m.tipo === 'Ajuste') {
      if (!stock[key]) stock[key] = { sku: m.sku, lote: m.lote, cantidad: 0, vence: m.vence, bodega: m.bodega || '', ubicacion: m.ubicacion || '', status: 'Aprobado' };
      stock[key].cantidad += parseFloat(m.cantidad) || 0;
      stock[key].status = m.status || 'Aprobado';
    } else if (m.tipo === 'AjusteInventario') {
      if (!stock[key]) stock[key] = { sku: m.sku, lote: m.lote, cantidad: 0, vence: m.vence, bodega: m.bodega || '', ubicacion: m.ubicacion || '', status: 'Aprobado' };
      stock[key].cantidad += parseFloat(m.cantidad) || 0;
    } else if (m.tipo === 'CambioEstado') {
      if (stock[key] && stock[key].status !== 'Retiro de mercado') {
        stock[key].status = m.status || stock[key].status;
      }
    } else if (m.tipo === 'Devolución') {
      if (!stock[key]) stock[key] = { sku: m.sku, lote: m.lote, cantidad: 0, vence: m.vence || '', bodega: m.bodega || '', ubicacion: m.ubicacion || '', status: m.status || 'Aprobado' };
      stock[key].cantidad += parseFloat(m.cantidad) || 0;
      if (m.vence && !stock[key].vence) stock[key].vence = m.vence;
    } else if (m.tipo === 'CambioUbicacion') {
      const qty = parseFloat(m.cantidad) || 0;
      const keyOri = `${m.sku}|${m.lote}|${m.bodega || ''}|${m.ubicacionOrigen || ''}`;
      const keyDst = `${m.sku}|${m.lote}|${m.bodega || ''}|${m.ubicacion || ''}`;
      const baseStatus = (stock[keyOri] && stock[keyOri].status) || m.status || 'Aprobado';
      const baseVence  = (stock[keyOri] && stock[keyOri].vence)  || m.vence || '';
      if (stock[keyOri]) stock[keyOri].cantidad -= qty;
      if (!stock[keyDst]) stock[keyDst] = { sku: m.sku, lote: m.lote, cantidad: 0, vence: baseVence, bodega: m.bodega || '', ubicacion: m.ubicacion || '', status: baseStatus };
      stock[keyDst].cantidad += qty;
    }
  });

  // Devoluciones aprobadas suman al stock (mismo criterio que la app)
  Object.values(devoluciones || {}).forEach(d => {
    if (!d || d.status !== 'Aprobado') return;
    const matchKey = Object.keys(stock).find(k => {
      const [s, l] = k.split('|');
      return s === d.sku && l === d.lote;
    });
    const key = matchKey || `${d.sku}|${d.lote}||`;
    if (!stock[key]) stock[key] = { sku: d.sku, lote: d.lote, cantidad: 0, vence: '', bodega: '', ubicacion: '', status: 'Aprobado' };
    stock[key].cantidad += parseFloat(d.cantidad) || 0;
  });

  return stock;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log(`  AJUSTE SANOPLEX x${FACTOR} · Bodega: ${BODEGA}`);
  console.log(`  Modo: ${APPLY ? 'APPLY (se ESCRIBIRAN los ajustes en Firebase)' : 'DRY-RUN (solo lista, no escribe)'}`);
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log('');

  // 1) Cargar productos, movimientos y devoluciones.
  const [prodSnap, movSnap, devSnap] = await Promise.all([
    db.ref(`usuarios/${ROOT_UID}/productos`).once('value'),
    db.ref(`usuarios/${ROOT_UID}/movimientos`).once('value'),
    db.ref(`usuarios/${ROOT_UID}/devoluciones`).once('value')
  ]);
  const productos    = prodSnap.val() || {};
  const movimientos  = movSnap.val()  || {};
  const devoluciones = devSnap.val()  || {};

  // 2) Set de SKUs cuyo nombre (descripcion) comienza con SANOPLEX.
  const skusSanoplex = new Set();
  Object.values(productos).forEach(p => {
    const desc = String(p.descripcion || '').trim().toUpperCase();
    if (desc.startsWith(PREFIJO_NOM)) skusSanoplex.add(p.sku);
  });
  console.log(`SKUs SANOPLEX en maestro: ${skusSanoplex.size}`);
  Array.from(skusSanoplex).sort().forEach(sku => {
    console.log(`  · ${sku}  ${productos[sku].descripcion}`);
  });
  console.log('');

  if (!skusSanoplex.size) {
    console.log('No se encontraron productos SANOPLEX en el maestro. Nada que hacer.');
    process.exit(0);
  }

  // 3) Stock actual completo → filtrar los que corresponden.
  const stock = calcStock(movimientos, devoluciones);
  const candidatos = Object.values(stock).filter(s =>
    skusSanoplex.has(s.sku) &&
    (s.bodega || '') === BODEGA &&
    (parseFloat(s.cantidad) || 0) > 0
  );

  if (!candidatos.length) {
    console.log(`No hay lotes SANOPLEX con stock > 0 en la bodega ${BODEGA}. Nada que hacer.`);
    process.exit(0);
  }

  candidatos.sort((a, b) =>
    a.sku.localeCompare(b.sku) ||
    a.lote.localeCompare(b.lote) ||
    (a.ubicacion || '').localeCompare(b.ubicacion || '')
  );

  // 4) Listado detallado.
  console.log('Lotes/ubicaciones a ajustar:');
  console.log('');
  console.log('  SKU           LOTE                UBICACION       STATUS       ACTUAL       +AJUSTE      FINAL');
  console.log('  ─────────────────────────────────────────────────────────────────────────────────────────────────');
  let totalActual = 0;
  let totalAjuste = 0;
  let totalFinal  = 0;
  candidatos.forEach(s => {
    const actual = parseFloat(s.cantidad) || 0;
    const ajuste = actual * (FACTOR - 1);
    const final  = actual * FACTOR;
    totalActual += actual;
    totalAjuste += ajuste;
    totalFinal  += final;
    const line = [
      s.sku.padEnd(13),
      String(s.lote || '').padEnd(19),
      String(s.ubicacion || '').padEnd(15),
      String(s.status || '').padEnd(12),
      String(actual).padStart(9),
      String(ajuste).padStart(11),
      String(final).padStart(11)
    ].join('  ');
    console.log('  ' + line);
  });
  console.log('  ─────────────────────────────────────────────────────────────────────────────────────────────────');
  console.log(`  ${candidatos.length} línea(s)`.padEnd(70) + `Total: ${totalActual}  → +${totalAjuste}  = ${totalFinal}`);
  console.log('');

  if (!APPLY) {
    console.log('DRY-RUN completado. Ejecute con --apply para escribir los ajustes en Firebase.');
    process.exit(0);
  }

  // 5) Escribir los AjusteInventario positivos.
  const ts0 = Date.now();
  const updates = {};
  let idx = 0;
  candidatos.forEach(s => {
    const actual = parseFloat(s.cantidad) || 0;
    const ajuste = actual * (FACTOR - 1);
    if (ajuste <= 0) return;
    const mov = {
      tipo: 'AjusteInventario',
      ajusteTipo: 'Positivo',
      sku: s.sku,
      lote: s.lote,
      vence: s.vence || '',
      descripcion: productos[s.sku]?.descripcion || '',
      cantidad: ajuste,
      bodega: BODEGA,
      ubicacion: s.ubicacion || '',
      observaciones: OBSERVACIONES,
      fecha: FECHA_ISO,
      usuario: USUARIO,
      status: 'Aprobado',
      fechaDocumento: FECHA_DOC
    };
    updates[`usuarios/${ROOT_UID}/movimientos/${ts0 + idx}`] = mov;
    idx++;
  });

  console.log(`Escribiendo ${idx} ajustes en Firebase…`);
  await db.ref().update(updates);

  // 6) Auditoría.
  const auditId = ts0 + 1000000;
  await db.ref(`usuarios/${ROOT_UID}/auditoria/${auditId}`).set({
    fecha: FECHA_ISO,
    accion: 'AjusteInventario masivo',
    modulo: 'Movimientos',
    sku: `${skusSanoplex.size} SKUs SANOPLEX`,
    lote: '',
    detalle: `Triplicado (x3) por unidad-caja. ${idx} lote/ubicación · Total ajuste: +${totalAjuste} ud · Bodega: ${BODEGA}`,
    usuario: USUARIO
  });

  console.log('');
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log(`  ✓ Ajustes aplicados: ${idx} líneas`);
  console.log(`  ✓ Total agregado al stock: +${totalAjuste} ud`);
  console.log(`  ✓ Registro en Auditoría: id ${auditId}`);
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Los movimientos originales de Entrada/Salida permanecen intactos para trazabilidad.');
  console.log('Cada ajuste aparece en la página Movimientos como tipo "Ajuste".');
  process.exit(0);
}

main().catch(err => { console.error('FALLO:', err); process.exit(1); });
