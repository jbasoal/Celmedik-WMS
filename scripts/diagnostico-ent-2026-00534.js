// Diagnóstico focalizado: Entrada ENT-2026-00534 (2026-11-05) y el item
// KG-003 lote 20250174 reportado como "no aparece en stock".
//
// USO — Consola del navegador en celmedik-inventario.web.app (sesión Maestro):
//   1) F12 → Console
//   2) Pegar todo el bloque entre /* y */ y ejecutar
//
// Qué revisa:
//   A) Movimiento ENT-2026-00534: ¿existe?, ¿qué líneas tiene?
//   B) KG-003 lote 20250174 (y variante 2025174): ¿aparece en calcStock?
//   C) Si no aparece, busca la causa: cantidad 0, status, AjusteInventario
//      (anulación), AJM que cambió sku/lote/bodega, Salida/Destrucción posterior.
//   D) Compara todas las Entradas del 2026-11-05 vs calcStock para detectar
//      si el problema afecta a otros productos del mismo día.

/*
await (async () => {
  const NUM_MOV = 'ENT-2026-00534';
  const SKU_FOCUS   = 'KG-003';
  const LOTES_FOCUS = ['20250174', '2025174']; // ambas variantes por si hay typo

  const movs = Object.values(data.movimientos || {});
  const stock = calcStock();

  // ── A) El movimiento ──────────────────────────────────────────────────────
  const ent = movs.filter(m => (m.numeroMovimiento || '') === NUM_MOV);
  console.log(`%c═══ ${NUM_MOV} — ${ent.length} línea(s) ═══`,
    'color:#0854A0;font-weight:bold;font-size:13px');
  if (!ent.length) {
    console.warn(`❌ No se encontró ningún movimiento con N° ${NUM_MOV}. Verifique el N°.`);
    const porDoc = movs.filter(m => (m.documentoId || '') === NUM_MOV);
    if (porDoc.length) console.log(`(Sí hay ${porDoc.length} por documentoId; es registro histórico sin N° Movimiento.)`);
    return;
  }
  const ref0 = ent[0];
  console.log(`Fecha ${ref0.fecha} · Bodega ${ref0.bodega} · Tipo ${ref0.tipo} · Referencia ${ref0.referencia || '—'} · DocId ${ref0.documentoId}`);
  console.table(ent.map(m => ({
    SKU: m.sku, Lote: m.lote, Qty: m.cantidad, Bodega: m.bodega, Ubic: m.ubicacion,
    Status: m.status, Vence: m.vence, Precio: m.precio, Tipo: m.tipo,
    ajusteNumMov: m.ajusteNumMov || '', ajusteMotivo: m.ajusteMotivo || ''
  })));

  // ── B) KG-003 lote focus en calcStock ─────────────────────────────────────
  console.log('%c─── Stock virtual KG-003 ───', 'color:#0854A0;font-weight:bold');
  const kg = Object.values(stock).filter(s => s.sku === SKU_FOCUS);
  if (!kg.length) console.warn(`calcStock() NO tiene filas para ${SKU_FOCUS}`);
  console.table(kg.map(s => ({
    Lote: s.lote, Bodega: s.bodega, Ubic: s.ubicacion, Cant: s.cantidad,
    Status: s.status, Vence: s.vence
  })));

  // ── C) Movimientos completos del foco (todos los lotes) ──────────────────
  console.log(`%c─── Todos los movs ${SKU_FOCUS} (cualquier lote) ───`, 'color:#0854A0;font-weight:bold');
  const movsSku = movs.filter(m => m.sku === SKU_FOCUS)
                      .sort((a,b) => new Date(a.fecha||0) - new Date(b.fecha||0));
  console.table(movsSku.map(m => ({
    Fecha: (m.fecha||'').slice(0,16).replace('T',' '),
    'N°Mov': m.numeroMovimiento || '—',
    Tipo: m.tipo, Lote: m.lote, Qty: m.cantidad,
    Bodega: m.bodega, Ubic: m.ubicacion, Status: m.status,
    Ref: m.referencia || '—'
  })));

  // Balance manual por (lote, bodega, ubic) para el SKU foco
  const bal = {};
  movsSku.forEach(m => {
    const key = `${m.lote} · ${m.bodega||''} · ${m.ubicacion||''}`;
    const q = parseFloat(m.cantidad) || 0;
    if (m.tipo === 'Entrada' || m.tipo === 'AjusteInventario' || m.tipo === 'Devolución') bal[key] = (bal[key]||0) + q;
    else if (m.tipo === 'Salida' || m.tipo === 'Destrucción') bal[key] = (bal[key]||0) - q;
    else if (m.tipo === 'CambioUbicacion') {
      const kO = `${m.lote} · ${m.bodega||''} · ${m.ubicacionOrigen||''}`;
      bal[kO] = (bal[kO]||0) - q;
      bal[key] = (bal[key]||0) + q;
    }
  });
  console.log(`%c─── Balance manual ${SKU_FOCUS} por (lote·bodega·ubic) ───`, 'color:#0854A0;font-weight:bold');
  console.table(Object.entries(bal).filter(([,v]) => Math.abs(v) > 1e-6).map(([k,v]) => ({ clave: k, balance: v })));

  // ── D) ¿Hubo AJM o AjusteInventario que anuló la Entrada? ────────────────
  const ajms = Object.values(data.ajustesMovimiento || {})
    .filter(a => a && (a.numeroMovimiento === NUM_MOV || a.documentoId === ref0.documentoId));
  if (ajms.length) {
    console.log('%c─── Ajustes de Movimiento sobre esta Entrada ───', 'color:#B25E00;font-weight:bold');
    console.table(ajms.map(a => ({
      Fecha: a.fecha, Usuario: a.usuario, Motivo: a.motivoAjuste,
      TotalCambios: a.totalCambios, N°AJM: a.ajusteNumeroMovimiento, origen: a.origen || ''
    })));
    ajms.forEach(a => console.log('Cambios de', a.ajusteNumeroMovimiento, a.resumen));
  }
  const anulaciones = movs.filter(m => m.tipo === 'AjusteInventario' &&
    (m.anulacionDeNumMov === NUM_MOV || m.anulacionDe === ref0.documentoId));
  if (anulaciones.length) {
    console.log('%c⚠ Hay anulaciones (AjusteInventario) asociadas a esta Entrada', 'color:#B91C1C;font-weight:bold');
    console.table(anulaciones.map(m => ({
      Fecha: m.fecha, SKU: m.sku, Lote: m.lote, Qty: m.cantidad, Motivo: m.anulacionMotivo || m.observaciones
    })));
  }

  // ── E) ¿Alguna otra Entrada del 2026-11-05 "desaparecida" del stock? ─────
  const dia = '2026-11-05';
  const entDia = movs.filter(m => m.tipo === 'Entrada' && (m.fecha || '').slice(0,10) === dia);
  const faltantes = [];
  entDia.forEach(m => {
    const key = `${m.sku}|${m.lote}|${m.bodega||''}|${m.ubicacion||''}`;
    const q = parseFloat(m.cantidad) || 0;
    if (q <= 0) { faltantes.push({ reason:'cantidad=0', ...m }); return; }
    const s = stock[key];
    if (!s) { faltantes.push({ reason:'sin fila en stock', m }); return; }
    if ((parseFloat(s.cantidad)||0) <= 0) faltantes.push({ reason:`stock neto=${s.cantidad}`, m });
  });
  console.log(`%c─── Entradas del ${dia}: ${entDia.length} línea(s), ${faltantes.length} con problemas ───`,
    'color:#0854A0;font-weight:bold');
  if (faltantes.length) console.table(faltantes.map(x => ({
    reason: x.reason,
    SKU: x.m ? x.m.sku : x.sku,
    Lote: x.m ? x.m.lote : x.lote,
    Qty: x.m ? x.m.cantidad : x.cantidad,
    Bodega: x.m ? x.m.bodega : x.bodega,
    Ubic: x.m ? x.m.ubicacion : x.ubicacion,
    N°Mov: x.m ? x.m.numeroMovimiento : x.numeroMovimiento
  })));

  // ── F) Búsqueda flexible por lote(s) foco, por si el SKU se ingresó mal ──
  LOTES_FOCUS.forEach(L => {
    const hits = movs.filter(m => String(m.lote) === L);
    console.log(`%c─── Movs con lote "${L}" (cualquier SKU): ${hits.length} ───`, 'color:#0854A0;font-weight:bold');
    if (hits.length) console.table(hits.map(m => ({
      Fecha: (m.fecha||'').slice(0,10), 'N°Mov': m.numeroMovimiento||'—',
      Tipo: m.tipo, SKU: m.sku, Lote: m.lote, Qty: m.cantidad,
      Bodega: m.bodega, Ubic: m.ubicacion, Status: m.status
    })));
  });
})();
*/
