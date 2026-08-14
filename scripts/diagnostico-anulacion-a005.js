// Diagnóstico de la anulación de movimientos 014120826 (Entrada) y 7091
// (Salida) sobre el producto A-005. Solo lectura — no modifica datos.
//
// Objetivo: entender exactamente qué movimientos existen para esos
// documentos, qué ajustes de anulación se generaron, y qué saldo real
// tiene A-005 vs. el saldo esperado (403 uds).
//
// Ejecución:
//   node scripts/diagnostico-anulacion-a005.js
//
// Requiere GOOGLE_APPLICATION_CREDENTIALS.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://celmedik-inventario-default-rtdb.firebaseio.com'
  });
}
const db = admin.database();

const ROOT_UID = 'XxnrZJwsPpgKYtNWO78BAyoUyWM2';
const DOCS = ['014120826', '7091'];
const SKU_FOCO = 'A-005';
const SALDO_ESPERADO = 403;

function pad(s, n) { return String(s == null ? '' : s).padEnd(n); }
function padR(s, n) { return String(s == null ? '' : s).padStart(n); }

async function main() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════════════════════════');
  console.log(`  DIAGNÓSTICO · docs ${DOCS.join(', ')} · SKU ${SKU_FOCO} · saldo esperado ${SALDO_ESPERADO}`);
  console.log('════════════════════════════════════════════════════════════════════════════════════');

  const [movSnap, ajSnap] = await Promise.all([
    db.ref(`usuarios/${ROOT_UID}/movimientos`).once('value'),
    db.ref(`usuarios/${ROOT_UID}/ajustesMovimiento`).once('value')
  ]);
  const movimientos = movSnap.val() || {};
  const ajustes     = ajSnap.val() || {};

  // ── 1) Movimientos con los documentos objetivo ─────────────────────────
  const relacionados = [];
  Object.entries(movimientos).forEach(([id, m]) => {
    if (!m) return;
    const docId = (m.documentoId || '').trim();
    const ref   = (m.referencia  || '').trim();
    const anul  = (m.anulacionDe || '').trim();
    if (DOCS.includes(docId) || DOCS.includes(ref) || DOCS.includes(anul)) {
      relacionados.push({ id, ...m });
    }
  });
  relacionados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  console.log('');
  console.log('── (1) MOVIMIENTOS RELACIONADOS con documentos 014120826 / 7091 ─────────────────────');
  console.log('FECHA                 TIPO              AJUSTE      SKU          LOTE           BOD          UBIC          CANT       DOC/REF          ANULA_DE');
  console.log('────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────');
  relacionados.forEach(m => {
    const f = m.fecha ? new Date(m.fecha).toISOString().slice(0, 19).replace('T', ' ') : '';
    const tipo = m.tipo || '';
    const at   = m.ajusteTipo || '';
    const doc  = (m.documentoId || m.referencia || '');
    console.log([
      pad(f, 20),
      pad(tipo, 17),
      pad(at, 11),
      pad(m.sku, 12),
      pad(m.lote, 14),
      pad(m.bodega, 12),
      pad(m.ubicacion, 13),
      padR(m.cantidad, 8),
      '  ' + pad(doc, 16),
      pad(m.anulacionDe || '', 12)
    ].join(' '));
  });
  console.log(`  Total movimientos relacionados: ${relacionados.length}`);

  // ── 2) Ajustes registrados en el Historial de Ajustes ──────────────────
  const ajRelacionados = [];
  Object.entries(ajustes).forEach(([id, a]) => {
    if (!a) return;
    const docId = (a.documentoId || '').trim();
    if (DOCS.includes(docId)) ajRelacionados.push({ id, ...a });
  });
  ajRelacionados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  console.log('');
  console.log('── (2) REGISTROS en Historial de Ajustes (ajustesMovimiento) ────────────────────────');
  ajRelacionados.forEach(a => {
    const f = a.fecha ? new Date(a.fecha).toISOString().slice(0, 19).replace('T', ' ') : '';
    console.log(`  ${f}  ${pad(a.tipoMovimiento, 20)}  doc ${pad(a.documentoId, 12)}  numMov=${a.numeroMovimiento||''}  motivo="${(a.motivoAjuste||'').slice(0, 60)}"`);
  });
  console.log(`  Total: ${ajRelacionados.length}`);

  // ── 3) Recalcular stock del SKU_FOCO ───────────────────────────────────
  // Replicamos calcStock() del index.html para AjusteInventario (usa cantidad
  // con signo tal como está en la base — el bug consiste precisamente en que
  // las anulaciones de entrada guardan cantidad positiva).
  const stock = {}; // key: sku|lote|bodega|ubicacion
  const movsOrd = Object.values(movimientos).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  movsOrd.forEach(m => {
    if (!m || m.sku !== SKU_FOCO) return;
    const key = `${m.sku}|${m.lote}|${m.bodega||''}|${m.ubicacion||''}`;
    const qty = parseFloat(m.cantidad) || 0;
    if (m.tipo === 'Entrada') {
      if (!stock[key]) stock[key] = { sku: m.sku, lote: m.lote, bodega: m.bodega||'', ubicacion: m.ubicacion||'', cantidad: 0 };
      stock[key].cantidad += qty;
    } else if (m.tipo === 'Salida' || m.tipo === 'Destrucción') {
      if (stock[key]) stock[key].cantidad -= qty;
    } else if (m.tipo === 'AjusteInventario') {
      if (!stock[key]) stock[key] = { sku: m.sku, lote: m.lote, bodega: m.bodega||'', ubicacion: m.ubicacion||'', cantidad: 0 };
      stock[key].cantidad += qty; // aquí está el bug si la anulación guarda positivo
    } else if (m.tipo === 'Devolución') {
      if (!stock[key]) stock[key] = { sku: m.sku, lote: m.lote, bodega: m.bodega||'', ubicacion: m.ubicacion||'', cantidad: 0 };
      stock[key].cantidad += qty;
    } else if (m.tipo === 'CambioUbicacion') {
      const keyOri = `${m.sku}|${m.lote}|${m.bodega||''}|${m.ubicacionOrigen||''}`;
      const keyDst = `${m.sku}|${m.lote}|${m.bodega||''}|${m.ubicacion||''}`;
      if (stock[keyOri]) stock[keyOri].cantidad -= qty;
      if (!stock[keyDst]) stock[keyDst] = { sku: m.sku, lote: m.lote, bodega: m.bodega||'', ubicacion: m.ubicacion||'', cantidad: 0 };
      stock[keyDst].cantidad += qty;
    }
  });
  const rows = Object.values(stock).filter(r => Math.abs(r.cantidad) > 0.0001);
  const totalActual = rows.reduce((a, r) => a + r.cantidad, 0);

  console.log('');
  console.log(`── (3) STOCK ACTUAL RECALCULADO para ${SKU_FOCO} (según lo que hay hoy en la BD) ────`);
  console.log('LOTE                 BODEGA           UBICACION            CANTIDAD');
  console.log('──────────────────────────────────────────────────────────────────');
  rows.sort((a, b) => (a.lote||'').localeCompare(b.lote||'') || (a.bodega||'').localeCompare(b.bodega||''));
  rows.forEach(r => {
    console.log(`  ${pad(r.lote, 20)} ${pad(r.bodega, 16)} ${pad(r.ubicacion, 20)} ${padR(r.cantidad, 10)}`);
  });
  console.log(`  TOTAL ACTUAL ${SKU_FOCO}: ${totalActual} ud`);
  console.log(`  SALDO ESPERADO         : ${SALDO_ESPERADO} ud`);
  console.log(`  DELTA (actual - esperado): ${totalActual - SALDO_ESPERADO} ud`);

  // ── 4) Simulación: recalcular tratando las anulaciones de entrada con signo ─
  // Aquí simulamos QUE HUBIERA PASADO si el signo estuviera bien (el fix).
  const stockFix = {};
  movsOrd.forEach(m => {
    if (!m || m.sku !== SKU_FOCO) return;
    const key = `${m.sku}|${m.lote}|${m.bodega||''}|${m.ubicacion||''}`;
    const qty = parseFloat(m.cantidad) || 0;
    if (m.tipo === 'Entrada') {
      if (!stockFix[key]) stockFix[key] = { sku: m.sku, lote: m.lote, bodega: m.bodega||'', ubicacion: m.ubicacion||'', cantidad: 0 };
      stockFix[key].cantidad += qty;
    } else if (m.tipo === 'Salida' || m.tipo === 'Destrucción') {
      if (stockFix[key]) stockFix[key].cantidad -= qty;
    } else if (m.tipo === 'AjusteInventario') {
      if (!stockFix[key]) stockFix[key] = { sku: m.sku, lote: m.lote, bodega: m.bodega||'', ubicacion: m.ubicacion||'', cantidad: 0 };
      const esAnulEntrada = (m.observaciones || '').startsWith('Anulación entrada') || m.ajusteTipo === 'Negativo';
      const qFix = esAnulEntrada && qty > 0 ? -qty : qty; // aplicar signo si venía en positivo
      stockFix[key].cantidad += qFix;
    } else if (m.tipo === 'Devolución') {
      if (!stockFix[key]) stockFix[key] = { sku: m.sku, lote: m.lote, bodega: m.bodega||'', ubicacion: m.ubicacion||'', cantidad: 0 };
      stockFix[key].cantidad += qty;
    } else if (m.tipo === 'CambioUbicacion') {
      const keyOri = `${m.sku}|${m.lote}|${m.bodega||''}|${m.ubicacionOrigen||''}`;
      const keyDst = `${m.sku}|${m.lote}|${m.bodega||''}|${m.ubicacion||''}`;
      if (stockFix[keyOri]) stockFix[keyOri].cantidad -= qty;
      if (!stockFix[keyDst]) stockFix[keyDst] = { sku: m.sku, lote: m.lote, bodega: m.bodega||'', ubicacion: m.ubicacion||'', cantidad: 0 };
      stockFix[keyDst].cantidad += qty;
    }
  });
  const rowsFix = Object.values(stockFix).filter(r => Math.abs(r.cantidad) > 0.0001);
  const totalFix = rowsFix.reduce((a, r) => a + r.cantidad, 0);

  console.log('');
  console.log(`── (4) SIMULACIÓN si el signo de la Anulación de Entrada estuviera correcto ─────────`);
  console.log('LOTE                 BODEGA           UBICACION            CANTIDAD');
  console.log('──────────────────────────────────────────────────────────────────');
  rowsFix.sort((a, b) => (a.lote||'').localeCompare(b.lote||'') || (a.bodega||'').localeCompare(b.bodega||''));
  rowsFix.forEach(r => {
    console.log(`  ${pad(r.lote, 20)} ${pad(r.bodega, 16)} ${pad(r.ubicacion, 20)} ${padR(r.cantidad, 10)}`);
  });
  console.log(`  TOTAL SIMULADO ${SKU_FOCO}: ${totalFix} ud`);
  console.log(`  vs. saldo esperado (${SALDO_ESPERADO}): delta = ${totalFix - SALDO_ESPERADO} ud`);

  console.log('');
  console.log('════════════════════════════════════════════════════════════════════════════════════');
  console.log('  FIN DIAGNÓSTICO (solo lectura — no se modificó nada)');
  console.log('════════════════════════════════════════════════════════════════════════════════════');
  process.exit(0);
}

main().catch(err => { console.error('FALLO:', err); process.exit(1); });
