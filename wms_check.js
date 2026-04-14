// ══ FIREBASE ══
const firebaseConfig = {
    apiKey: "AIzaSyCJ73iFZQaqCGVMZEnUA45HmSpXD_Z0oiE",
    authDomain: "celmedik-inventario.firebaseapp.com",
    projectId: "celmedik-inventario",
    storageBucket: "celmedik-inventario.firebasestorage.app",
    messagingSenderId: "1069071656431",
    appId: "1:1069071656431:web:5ef4c84416c016a934821a",
    databaseURL: "https://celmedik-inventario-default-rtdb.firebaseio.com"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null, userPerfil = null;
let data = { productos:{}, bodegas:{}, movimientos:{}, cuarentena:{}, devoluciones:{}, auditoria:{} };
let selectedBodega = 'TOTAL';
let movDocItems = [];

// ══ AUTH ══
document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    auth.onAuthStateChanged(u => {
        if (u) { currentUser = u; loadProfile(); }
        else { currentUser = null; detachListeners(); showScreen('login'); }
    });
});

function loadProfile() {
    db.ref(`usuarios/${currentUser.uid}/perfil`).once('value', s => {
        userPerfil = s.val() || 'Maestro';
        document.getElementById('userRole').textContent = `Perfil: ${userPerfil}`;
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userInitial').textContent = currentUser.email[0].toUpperCase();
        showScreen('app');
        attachListeners();
    });
}

function showScreen(which) {
    document.getElementById('loginScreen').style.display = which === 'login' ? 'flex' : 'none';
    document.getElementById('appScreen').classList.toggle('active', which === 'app');
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    setLoginStatus('', '');
    auth.signInWithEmailAndPassword(email, pass)
        .catch(err => setLoginStatus('error', translateError(err.code)));
}

function handleRegister() {
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPassword').value;
    const perfil = document.getElementById('regPerfil').value;
    if (!email || !pass || !perfil) return setLoginStatus('error', 'Complete todos los campos');
    auth.createUserWithEmailAndPassword(email, pass)
        .then(c => { db.ref(`usuarios/${c.user.uid}/perfil`).set(perfil); setLoginStatus('success', 'Cuenta creada. Iniciando sesión...'); toggleRegister(); })
        .catch(err => setLoginStatus('error', translateError(err.code)));
}

function handleLogout() { detachListeners(); auth.signOut(); }

function setLoginStatus(type, msg) {
    const el = document.getElementById('loginStatus');
    el.className = 'status-msg' + (type ? ' ' + type : '');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

function toggleRegister() {
    const p = document.getElementById('registerPanel');
    p.style.display = p.style.display === 'none' || !p.style.display ? 'block' : 'none';
}

function translateError(code) {
    const m = { 'auth/user-not-found':'Usuario no encontrado','auth/wrong-password':'Contraseña incorrecta','auth/invalid-credential':'Credenciales inválidas','auth/email-already-in-use':'Email ya registrado','auth/weak-password':'Contraseña muy corta','auth/too-many-requests':'Demasiados intentos. Espere.' };
    return m[code] || code;
}

// ══ NAVIGATION ══
function setupNav() {
    document.querySelectorAll('.nav-link[data-page]').forEach(l => {
        l.addEventListener('click', e => { e.preventDefault(); navigateTo(l.dataset.page); });
    });
}

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const pg = document.getElementById(page);
    if (pg) pg.classList.add('active');
    const lnk = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (lnk) lnk.classList.add('active');
    const titles = { dashboard:'Dashboard', productos:'Productos Maestro', stock:'Stock Actual', bodegas:'Bodegas', movimientos:'Movimientos', cuarentena:'Cuarentena', devoluciones:'Devoluciones', retiro:'Retiro de Mercado', trazabilidad:'Trazabilidad de Lotes', alertas:'Alertas', reportes:'Reportes ISP', auditoria:'Auditoría', dashComercial:'Dashboard Comercial' };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    if (page === 'alertas') renderAlertas();
    if (page === 'auditoria') renderAuditoria();
    if (page === 'dashComercial') renderDashComercial();
}

// ══ DATA LISTENERS ══
function attachListeners() {
    const uid = currentUser.uid;
    db.ref(`usuarios/${uid}/productos`).on('value', s => { data.productos = s.val()||{}; renderProductos(); updateStats(); renderStock(); });
    db.ref(`usuarios/${uid}/bodegas`).on('value', s => { data.bodegas = s.val()||{}; renderBodegas(); renderBodegaBtns(); updateBodegaSelect(); updateStats(); });
    db.ref(`usuarios/${uid}/movimientos`).on('value', s => { data.movimientos = s.val()||{}; renderMovimientos(); renderStock(); updateStats(); });
    db.ref(`usuarios/${uid}/cuarentena`).on('value', s => { data.cuarentena = s.val()||{}; renderCuarentena(); updateStats(); });
    db.ref(`usuarios/${uid}/devoluciones`).on('value', s => { data.devoluciones = s.val()||{}; renderDevoluciones(); });
}

function detachListeners() {
    if (!currentUser) return;
    const uid = currentUser.uid;
    ['productos','bodegas','movimientos','cuarentena','devoluciones'].forEach(k => db.ref(`usuarios/${uid}/${k}`).off());
}

// ══ AUDIT LOG ══
function logAudit(accion, modulo, sku, lote, detalle) {
    if (!currentUser) return;
    const entry = { fecha: new Date().toISOString(), accion, modulo, sku: sku||'', lote: lote||'', detalle: detalle||'', usuario: currentUser.email };
    db.ref(`usuarios/${currentUser.uid}/auditoria`).push(entry);
}

// ══ STATS ══
function updateStats() {
    const prods = Object.keys(data.productos||{}).length;
    const movs = Object.keys(data.movimientos||{}).length;
    // Calcular lotes en stock
    const stockMap = calcStock();
    const lotesEnStock = Object.values(stockMap).filter(s => s.cantidad > 0).length;
    const cuarCount = Object.values(data.cuarentena||{}).filter(q => q.status === 'Pendiente').length;
    const alertCount = calcAlertas().length;

    document.getElementById('st-productos').textContent = prods;
    document.getElementById('st-lotes').textContent = lotesEnStock;
    document.getElementById('st-movimientos').textContent = movs;
    document.getElementById('st-alertas').textContent = alertCount;
    document.getElementById('st-cuarentena').textContent = cuarCount;

    const badge = document.getElementById('alertBadge');
    badge.textContent = alertCount;
    badge.style.display = alertCount > 0 ? 'inline-block' : 'none';

    renderDashAlertas();
}

// ══ STOCK CALC (FEFO) ══
function calcStock() {
    const stock = {};
    const movsList = Object.values(data.movimientos||{}).sort((a,b) => new Date(a.fecha)-new Date(b.fecha));
    movsList.forEach(m => {
        const key = `${m.sku}|${m.lote}|${m.bodega||''}|${m.ubicacion||''}`;
        if (m.tipo === 'Entrada') {
            if (!stock[key]) stock[key] = { sku:m.sku, lote:m.lote, cantidad:0, vence:m.vence, bodega:m.bodega||'', ubicacion:m.ubicacion||'', status:'Aprobado' };
            stock[key].cantidad += parseInt(m.cantidad)||0;
            stock[key].status = m.status || 'Aprobado';
        } else if (m.tipo === 'Salida' || m.tipo === 'Destrucción') {
            if (stock[key]) stock[key].cantidad -= parseInt(m.cantidad)||0;
        } else if (m.tipo === 'Ajuste') {
            if (!stock[key]) stock[key] = { sku:m.sku, lote:m.lote, cantidad:0, vence:m.vence, bodega:m.bodega||'', ubicacion:m.ubicacion||'', status:'Aprobado' };
            stock[key].cantidad += parseInt(m.cantidad)||0;
            stock[key].status = m.status || 'Aprobado';
        } else if (m.tipo === 'CambioEstado') {
            if (stock[key]) stock[key].status = m.status || stock[key].status;
        }
    });
    return stock;
}

function getLoteStatus(s) {
    if (s.vence) {
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        if (new Date(s.vence + 'T00:00:00') < hoy) return 'Vencido';
    }
    return s.status || 'Aprobado';
}

function statusBadgeHTML(st) {
    const map = {
        'Aprobado':          { cls:'badge-success', icon:'✓' },
        'Cuarentena':        { cls:'badge-warning',  icon:'🔒' },
        'Rechazado':         { cls:'badge-danger',   icon:'⚠' },
        'Vencido':           { cls:'badge-gray',     icon:'⏱' },
        'Retiro de mercado': { cls:'badge-danger',   icon:'⚠' },
        'Falsificado':       { cls:'badge-danger',   icon:'⛔' }
    };
    const d = map[st] || { cls:'badge-gray', icon:'' };
    return `<span class="badge ${d.cls}">${d.icon} ${st}</span>`;
}

// ══ ALERTAS CALC ══
function calcAlertas() {
    const alertas = [];
    const hoy = new Date();
    const stock = calcStock();
    const prods = data.productos||{};

    Object.values(stock).filter(s => s.cantidad > 0).forEach(s => {
        if (!s.vence) return;
        const vD = new Date(s.vence + 'T00:00:00');
        const dias = Math.ceil((vD - hoy) / 86400000);
        const desc = prods[s.sku]?.descripcion || s.sku;
        if (dias < 0) alertas.push({ tipo:'exp', titulo:`VENCIDO: ${desc}`, texto:`Lote ${s.lote} — vencido hace ${Math.abs(dias)} días. Stock: ${s.cantidad} ud.`, dias });
        else if (dias <= 30) alertas.push({ tipo:'danger', titulo:`Vence en ${dias} días: ${desc}`, texto:`Lote ${s.lote} — vence el ${fmtDate(s.vence)}. Stock: ${s.cantidad} ud.`, dias });
        else if (dias <= 90) alertas.push({ tipo:'warning', titulo:`Próximo a vencer: ${desc}`, texto:`Lote ${s.lote} — vence en ${dias} días (${fmtDate(s.vence)}). Stock: ${s.cantidad} ud.`, dias });
    });

    // Stock bajo mínimo
    Object.values(prods).forEach(p => {
        if (!p.stockMin || p.stockMin <= 0) return;
        const totalStock = Object.values(stock).filter(s => s.sku === p.sku && s.cantidad > 0).reduce((a, s) => a + s.cantidad, 0);
        if (totalStock < p.stockMin) alertas.push({ tipo:'info', titulo:`Stock bajo mínimo: ${p.descripcion}`, texto:`Stock actual: ${totalStock} ud. Mínimo: ${p.stockMin} ud.`, dias: 9999 });
    });

    alertas.sort((a, b) => a.dias - b.dias);
    return alertas;
}

function renderDashAlertas() {
    const c = document.getElementById('dashAlertasContainer');
    const alertas = calcAlertas().slice(0, 5);
    if (!alertas.length) { c.innerHTML = '<p class="text-muted text-sm">Sin alertas activas ✓</p>'; return; }
    c.innerHTML = alertas.map(a => {
        const cls = a.tipo === 'exp' || a.tipo === 'danger' ? 'danger' : a.tipo === 'warning' ? 'warning' : 'success';
        return `<div class="alert-banner ${cls}"><div class="alert-banner-icon">${cls === 'danger' ? '⚠' : '◉'}</div><div><div class="alert-banner-title">${a.titulo}</div><div class="alert-banner-text">${a.texto}</div></div></div>`;
    }).join('');
}

function renderAlertas() {
    const c = document.getElementById('alertasContainer');
    const alertas = calcAlertas();
    if (!alertas.length) { c.innerHTML = '<p class="text-muted text-sm">✓ Sin alertas activas</p>'; return; }
    c.innerHTML = alertas.map(a => {
        const cls = a.tipo === 'exp' || a.tipo === 'danger' ? 'danger' : a.tipo === 'warning' ? 'warning' : 'success';
        return `<div class="alert-banner ${cls}"><div class="alert-banner-icon">${cls === 'danger' ? '⚠' : '◉'}</div><div><div class="alert-banner-title">${a.titulo}</div><div class="alert-banner-text">${a.texto}</div></div></div>`;
    }).join('');
}

// ══ PRODUCTOS ══
function renderProductos() {
    const fSKU = (document.getElementById('fProdSKU')?.value||'').toLowerCase();
    const fDesc = (document.getElementById('fProdDesc')?.value||'').toLowerCase();
    const rows = Object.values(data.productos||{}).filter(p =>
        p.sku.toLowerCase().includes(fSKU) && (p.descripcion||'').toLowerCase().includes(fDesc)
    );
    const tb = document.getElementById('tProductos');
    if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="11">No hay productos registrados</td></tr>'; return; }
    tb.innerHTML = rows.map(p => `
        <tr>
            <td class="text-mono" style="color:var(--accent2)">${p.sku}</td>
            <td style="color:var(--text);font-weight:500">${p.descripcion}</td>
            <td>${p.registroSanitario ? `<span class="rs-number">${p.registroSanitario}</span>` : '<span class="text-muted">—</span>'}</td>
            <td>${badgeTipo(p.tipo)}</td>
            <td>${p.fabricante||'—'}</td>
            <td>${p.proveedor||'—'}</td>
            <td>${p.presentacion||'—'}</td>
            <td>${p.unidadVenta||'—'}</td>
            <td>${p.stockMin > 0 ? p.stockMin : '—'}</td>
            <td><span class="badge badge-gray" style="font-size:10px">${p.almacenamiento||'Ambiente'}</span></td>
            <td><button class="btn btn-sm btn-icon" onclick="editProducto('${p.sku}')">✎</button></td>
        </tr>`).join('');
}

function badgeTipo(tipo) {
    const m = { 'Medicamento':'badge-success','Dispositivo Médico':'badge-blue','Insumo':'badge-gray','Psicotrópico':'badge-danger' };
    return `<span class="badge ${m[tipo]||'badge-gray'}">${tipo||'—'}</span>`;
}

function saveProducto(e) {
    e.preventDefault();
    const sku = document.getElementById('p-sku').value.trim().toUpperCase();
    if (!sku) return;
    const p = {
        sku, descripcion: document.getElementById('p-desc').value.trim(),
        registroSanitario: document.getElementById('p-rs').value.trim(),
        tipo: document.getElementById('p-tipo').value,
        fabricante: document.getElementById('p-fab').value.trim(),
        proveedor: document.getElementById('p-proveedor').value.trim(),
        presentacion: document.getElementById('p-pres').value.trim(),
        unidadVenta: document.getElementById('p-udv').value.trim(),
        almacenamiento: document.getElementById('p-almac').value,
        stockMin: parseInt(document.getElementById('p-min').value)||0,
        principioActivo: document.getElementById('p-principio').value.trim(),
        fecha: new Date().toISOString()
    };
    db.ref(`usuarios/${currentUser.uid}/productos/${sku}`).set(p)
        .then(() => { logAudit('Crear/Editar', 'Productos', sku, '', p.descripcion); closeModal('productModal'); })
        .catch(err => alert('Error: ' + err.message));
}

function editProducto(sku) {
    const p = data.productos[sku]; if (!p) return;
    document.getElementById('p-sku').value = p.sku; document.getElementById('p-sku').disabled = true;
    document.getElementById('p-rs').value = p.registroSanitario||'';
    document.getElementById('p-desc').value = p.descripcion||'';
    document.getElementById('p-fab').value = p.fabricante||'';
    document.getElementById('p-proveedor').value = p.proveedor||'';
    document.getElementById('p-tipo').value = p.tipo||'';
    document.getElementById('p-pres').value = p.presentacion||'';
    document.getElementById('p-udv').value = p.unidadVenta||'';
    document.getElementById('p-almac').value = p.almacenamiento||'Temperatura Ambiente';
    document.getElementById('p-min').value = p.stockMin||0;
    document.getElementById('p-principio').value = p.principioActivo||'';
    openModal('productModal');
}

// ══ BODEGAS ══
function saveBodega(e) {
    e.preventDefault();
    const b = {
        nombre: document.getElementById('b-nombre').value.trim(),
        tipo: document.getElementById('b-tipo').value,
        ubicacion: document.getElementById('b-ubic').value.trim(),
        capacidad: document.getElementById('b-cap').value||'',
        fecha: new Date().toISOString()
    };
    db.ref(`usuarios/${currentUser.uid}/bodegas/${Date.now()}`).set(b)
        .then(() => { logAudit('Crear', 'Bodegas', '', '', b.nombre); closeModal('bodegaModal'); });
}

function renderBodegas() {
    const tb = document.getElementById('tBodegas');
    const rows = Object.entries(data.bodegas||{});
    if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="6">No hay bodegas registradas</td></tr>'; return; }
    tb.innerHTML = rows.map(([id, b]) => `
        <tr>
            <td style="color:var(--text);font-weight:500">${b.nombre}</td>
            <td>${b.ubicacion}</td>
            <td>${b.capacidad ? b.capacidad + ' m³' : '—'}</td>
            <td><span class="badge ${b.tipo === 'Cuarentena' ? 'badge-warning' : b.tipo === 'Rechazados' ? 'badge-danger' : 'badge-success'}">${b.tipo||'General'}</span></td>
            <td><span class="badge badge-success">Activa</span></td>
            <td><button class="btn btn-sm btn-danger-sm" onclick="deleteBodega('${id}')">Eliminar</button></td>
        </tr>`).join('');
}

function deleteBodega(id) {
    if (confirm('¿Eliminar esta bodega?')) db.ref(`usuarios/${currentUser.uid}/bodegas/${id}`).remove();
}

function renderBodegaBtns() {
    const c = document.getElementById('bodegaBtns');
    c.querySelectorAll('[data-bodega-btn]').forEach(b => b.remove());
    Object.entries(data.bodegas||{}).forEach(([id, b]) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-icon'; btn.dataset.bodegaBtn = id;
        btn.textContent = b.nombre;
        btn.style.cssText = selectedBodega === b.nombre ? 'background:var(--accent);color:white;border-color:var(--accent)' : '';
        btn.onclick = () => selBodega(b.nombre);
        c.appendChild(btn);
    });
}

function selBodega(nombre) {
    selectedBodega = nombre;
    document.getElementById('btnTOTAL').style.cssText = nombre === 'TOTAL' ? 'background:var(--accent);color:white;border-color:var(--accent)' : '';
    document.querySelectorAll('[data-bodega-btn]').forEach(b => {
        b.style.cssText = b.textContent === nombre ? 'background:var(--accent);color:white;border-color:var(--accent)' : '';
    });
    renderStock();
}

function updateBodegaSelect() {
    ['md-bodega'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="">Seleccionar...</option>';
        Object.values(data.bodegas||{}).forEach(b => {
            const o = document.createElement('option'); o.value = b.nombre; o.textContent = b.nombre; sel.appendChild(o);
        });
        if (cur) sel.value = cur;
    });
}

// ══ MOVIMIENTOS ══
function onDocBodegaChange() {
    const nombre = document.getElementById('md-bodega').value;
    const bodega = Object.values(data.bodegas || {}).find(b => b.nombre === nombre);
    const wrap = document.getElementById('md-ubic-wrap');
    if (bodega && Array.isArray(bodega.ubicaciones) && bodega.ubicaciones.length) {
        const sel = document.createElement('select');
        sel.className = 'form-select'; sel.id = 'md-ubic';
        sel.innerHTML = '<option value="">Seleccionar ubicación...</option>';
        bodega.ubicaciones.forEach(u => {
            const opt = document.createElement('option'); opt.value = u; opt.textContent = u; sel.appendChild(opt);
        });
        wrap.innerHTML = ''; wrap.appendChild(sel);
    } else {
        wrap.innerHTML = '<input type="text" class="form-input" id="md-ubic" placeholder="Ej: Estante A-3">';
    }
}

function onMdTipoChange() {
    const tipo = document.getElementById('md-tipo').value;

    _refreshMiStatusField(tipo);

    // Ocultar fecha vencimiento en Salida (se toma del lote existente)
    const venceGroup = document.getElementById('mi-vence-group');
    if (venceGroup) venceGroup.style.display = tipo === 'Salida' ? 'none' : '';

    resetItemForm();
    movDocItems = [];
    renderDocItems();
}

// Actualiza opciones y visibilidad del campo Estatus por ítem
function _refreshMiStatusField(tipo) {
    const miStatusGroup = document.getElementById('mi-status-group');
    const miStatus      = document.getElementById('mi-status');
    const miUbicGroup   = document.getElementById('mi-ubic-group');
    const miUbicLabel   = document.getElementById('mi-ubic-label');
    if (!miStatusGroup || !miStatus) return;

    if (tipo === 'Entrada') {
        miStatus.innerHTML =
            '<option value="Aprobado">✓ Aprobado</option>' +
            '<option value="Cuarentena">🔒 Cuarentena</option>' +
            '<option value="Falsificado">⛔ Falsificado</option>';
        miStatus.value = 'Aprobado';
        if (miUbicGroup)  miUbicGroup.style.display  = 'block';
        if (miStatusGroup) miStatusGroup.style.display = 'block';
        if (miUbicLabel)  miUbicLabel.innerHTML = 'Ubicación <span style="color:var(--danger)">*</span>';
    } else if (tipo === 'Ajuste') {
        miStatus.innerHTML =
            '<option value="Cuarentena">🔒 Cuarentena</option>' +
            '<option value="Rechazado">⚠ Rechazado</option>' +
            '<option value="Falsificado">⛔ Falsificado</option>' +
            '<option value="Vencido">⏱ Vencido</option>';
        miStatus.value = 'Cuarentena';
        if (miUbicGroup)  miUbicGroup.style.display  = 'block';
        if (miStatusGroup) miStatusGroup.style.display = 'block';
        if (miUbicLabel)  miUbicLabel.innerHTML = 'Ubicación <span style="color:var(--text3);font-weight:400">(opc.)</span>';
    } else if (tipo === 'Devolución') {
        miStatus.innerHTML =
            '<option value="Cuarentena">🔒 Cuarentena</option>' +
            '<option value="Aprobado">✓ Aprobado</option>' +
            '<option value="Rechazado">⚠ Rechazado</option>';
        miStatus.value = 'Cuarentena';
        if (miUbicGroup)  miUbicGroup.style.display  = 'block';
        if (miStatusGroup) miStatusGroup.style.display = 'block';
        if (miUbicLabel)  miUbicLabel.innerHTML = 'Ubicación <span style="color:var(--text3);font-weight:400">(opc.)</span>';
    } else {
        // Salida u otro: ocultar ambos campos
        if (miStatusGroup) miStatusGroup.style.display = 'none';
        if (miUbicGroup)  miUbicGroup.style.display  = 'none';
    }
}

// Alias para compatibilidad con el selector de tipo
function actualizarOpcionesStatus() { _refreshMiStatusField(document.getElementById('md-tipo')?.value || ''); }

function onMiSKUChange() {
    const sku = document.getElementById('mi-sku').value.trim().toUpperCase();
    document.getElementById('mi-sku').value = sku;
    const prod = data.productos[sku];
    const info = document.getElementById('mi-sku-info');
    const descEl = document.getElementById('mi-desc');
    if (prod) {
        if (descEl) descEl.value = prod.descripcion || '';
        document.getElementById('mi-sku-info-text').innerHTML = `<strong style="color:var(--text)">${prod.descripcion}</strong> — ${prod.tipo} · ${prod.fabricante}${prod.registroSanitario ? ` · RS: <span class="rs-number">${prod.registroSanitario}</span>` : ''}`;
        info.style.display = 'block';
        const tipo = document.getElementById('md-tipo').value;
        if (tipo === 'Salida') loadMiLotesDisponibles(sku);
    } else if (sku) {
        if (descEl) descEl.value = '';
        document.getElementById('mi-sku-info-text').innerHTML = `<span style="color:var(--danger)">⚠ SKU no encontrado en maestro de productos</span>`;
        info.style.display = 'block';
    } else {
        if (descEl) descEl.value = '';
        info.style.display = 'none';
    }
}

function loadMiLotesDisponibles(sku) {
    const stock = calcStock();
    const lotes = Object.values(stock)
        .filter(s => s.sku === sku && s.cantidad > 0)
        .sort((a, b) => new Date(a.vence||'9999') - new Date(b.vence||'9999'));

    const wrap = document.getElementById('mi-lote-wrap');

    if (!lotes.length) {
        wrap.innerHTML = '<div class="alert-banner danger" style="padding:8px 12px"><div class="alert-banner-text">Sin stock disponible para este SKU</div></div><input type="hidden" id="mi-lote" value=""><input type="hidden" id="mi-lote-status" value="">';
        return;
    }

    let html = '<input type="hidden" id="mi-lote" value=""><input type="hidden" id="mi-lote-status" value=""><div class="lote-selector-list">';
    lotes.forEach(l => {
        const st = getLoteStatus(l);
        const dias = l.vence ? Math.ceil((new Date(l.vence+'T00:00:00') - new Date()) / 86400000) : null;
        const isCuarentena  = st === 'Cuarentena';
        const isDestruccion = st === 'Rechazado' || st === 'Vencido' || st === 'Retiro de mercado' || st === 'Falsificado';
        const cls = st === 'Aprobado' ? 'lote-ok' : isCuarentena ? 'lote-cuarentena' : 'lote-rechazado';
        const disabledCls = isCuarentena ? 'lote-disabled' : '';
        let onclick = '';
        if (!isCuarentena) {
            onclick = isDestruccion
                ? `onmousedown="selectLoteDestruccion('${sku}','${l.lote}','${l.vence||''}','${st}',${l.cantidad})"`
                : `onmousedown="selectLoteNormal('${l.lote}','${l.vence||''}','${st}',${l.cantidad})"`;
        }
        const diasLabel = dias !== null ? (dias < 0 ? '<span style="color:var(--danger);font-weight:600">VENCIDO</span>' : `${dias}d`) : '—';
        html += `<div class="lote-selector-item ${cls} ${disabledCls}" ${onclick} id="lotecard-${l.lote.replace(/[^a-zA-Z0-9]/g,'_')}">
            <div class="lote-sel-top">
                <span class="text-mono" style="font-weight:600;font-size:13px">${l.lote}</span>
                ${statusBadgeHTML(st)}
            </div>
            <div class="lote-sel-meta">
                Vence: ${l.vence ? fmtDate(l.vence) : '—'} (${diasLabel}) · Stock disponible: <strong>${l.cantidad}</strong>
                ${isCuarentena ? '<div class="lote-warn-msg" style="color:var(--warning)">🔒 En cuarentena — No puede despacharse. Liberar o rechazar en módulo Cuarentena.</div>' : ''}
                ${isDestruccion ? '<div class="lote-warn-msg" style="color:var(--danger)">⚠ Solo permite salida por destrucción — Click para registrar Acta de Destrucción ISP</div>' : ''}
            </div>
        </div>`;
    });
    html += '</div>';
    wrap.innerHTML = html;
}

function selectLoteNormal(lote, vence, status, stock) {
    document.getElementById('mi-lote').value = lote;
    document.getElementById('mi-lote-status').value = status;
    if (vence) document.getElementById('mi-vence').value = vence;
    // Highlight selected
    document.querySelectorAll('.lote-selector-item').forEach(el => el.classList.remove('lote-sel-active'));
    const card = document.getElementById('lotecard-' + lote.replace(/[^a-zA-Z0-9]/g,'_'));
    if (card) card.classList.add('lote-sel-active');
}

function selectLoteDestruccion(sku, lote, vence, status, stockQty) {
    // Open destrucción modal
    document.getElementById('dest-sku').value = sku;
    document.getElementById('dest-sku').dataset.cuarId = ''; // not from cuarentena
    document.getElementById('dest-lote').value = lote;
    document.getElementById('dest-estado').value = status;
    document.getElementById('dest-stock').value = stockQty + ' unidades';
    document.getElementById('dest-qty').value = stockQty;
    document.getElementById('dest-qty').max = stockQty;
    document.getElementById('dest-header-title').textContent = `Lote ${lote} — Estado: ${status}`;
    document.getElementById('dest-header-desc').textContent = 'Este lote no puede despacharse normalmente. Complete el acta de destrucción para registrar su salida.';
    ['dest-motivo','dest-empresa','dest-acta','dest-resp','dest-obs'].forEach(id => { const el=document.getElementById(id); if(el&&el.tagName==='SELECT') el.value=''; else if(el) el.value=''; });
    const fechaEl = document.getElementById('dest-fecha');
    if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];
    if (status === 'Vencido') {
        document.getElementById('dest-motivo').value = 'Vencido';
    }
    document.getElementById('dest-err').style.display = 'none';
    openModal('destruccionModal');
}

function addItemToDoc() {
    const sku    = document.getElementById('mi-sku').value.trim().toUpperCase();
    const loteEl = document.getElementById('mi-lote');
    const lote   = loteEl ? loteEl.value.trim() : '';
    const vence  = document.getElementById('mi-vence')?.value || '';
    const qty    = parseInt(document.getElementById('mi-qty').value) || 0;
    const precio = parseFloat(document.getElementById('mi-precio').value) || 0;
    const tipo   = document.getElementById('md-tipo').value;
    const miUbic = (document.getElementById('mi-ubic')?.value || '').trim();

    if (!tipo)  { showFormError('movModal-err', 'Seleccione el tipo de movimiento primero.'); return; }
    if (!sku)   { showFormError('mi-err', 'Ingrese el SKU del producto.'); return; }
    if (!data.productos[sku]) { showFormError('mi-err', `SKU "${sku}" no existe en el maestro de productos.`); return; }
    if (!lote)  { showFormError('mi-err', tipo === 'Salida' ? 'Seleccione un lote de la lista.' : 'Ingrese el número de lote.'); return; }
    if (!qty || qty < 1) { showFormError('mi-err', 'La cantidad debe ser mayor a cero.'); return; }

    if (tipo === 'Entrada') {
        if (!vence) { showFormError('mi-err', 'La fecha de vencimiento es obligatoria para entradas.'); return; }
        const vD = new Date(vence + 'T00:00:00'); const hoy = new Date(); hoy.setHours(0,0,0,0);
        if (vD < hoy) { showFormError('mi-err', 'La fecha de vencimiento no puede ser pasada para una entrada.'); return; }
        if (!miUbic) { showFormError('mi-err', 'La ubicación es obligatoria para entradas.'); return; }
    }

    // Estatus: obligatorio para Entrada y Ajuste
    let itemStatus = 'Aprobado';
    if (tipo === 'Entrada' || tipo === 'Ajuste') {
        itemStatus = document.getElementById('mi-status')?.value || '';
        if (!itemStatus) { showFormError('mi-err', 'Seleccione el estatus del producto.'); return; }
    }

    // Ubicación del ítem (para Salida la tomamos del stock para mantener consistencia de clave)
    let itemUbic = miUbic;

    if (tipo === 'Salida') {
        const stock = calcStock();
        const loteStock = Object.values(stock).find(s => s.sku === sku && s.lote === lote);
        if (!loteStock) { showFormError('mi-err', 'Lote no encontrado en stock.'); return; }
        const st = getLoteStatus(loteStock);
        itemUbic = loteStock.ubicacion || '';  // clave consistente con entrada

        if (st === 'Cuarentena') {
            showFormError('mi-err', '🔒 Producto en CUARENTENA — No se puede despachar. Debe ser liberado o rechazado por el responsable QA antes de continuar.');
            return;
        }
        if (st === 'Rechazado' || st === 'Vencido' || st === 'Retiro de mercado' || st === 'Falsificado') {
            showFormError('mi-err', `⚠ Lote en estado "${st}" — Solo permite salida por destrucción. Seleccione el lote en la lista para abrir el Acta de Destrucción.`);
            return;
        }
        const enDoc = movDocItems.filter(i => i.sku === sku && i.lote === lote).reduce((a, i) => a + i.qty, 0);
        const disponible = Object.values(stock)
            .filter(s => s.sku === sku && s.lote === lote && getLoteStatus(s) === 'Aprobado')
            .reduce((a, s) => a + s.cantidad, 0);
        if (qty + enDoc > disponible) {
            showFormError('mi-err', `Stock insuficiente. Disponible aprobado para lote ${lote}: ${disponible} ud. Ya en documento: ${enDoc}. Máximo: ${disponible - enDoc} ud.`);
            return;
        }
    }

    const prod = data.productos[sku];
    const itemData = { sku, descripcion: prod?.descripcion || '', lote, vence, qty, precio, status: itemStatus, ubicacion: itemUbic };

    // Alerta especial para Falsificado
    if (itemStatus === 'Falsificado') {
        showConfirm(
            '⚠ Advertencia: Producto Falsificado',
            'Esta acción quedará registrada en auditoría',
            '⚠️ Está registrando un producto como <strong>FALSIFICADO</strong>. Esta acción quedará registrada en auditoría e informada al responsable QA. ¿Confirma el registro?',
            'Confirmar — Registrar Falsificado',
            'btn-danger',
            () => { movDocItems.push(itemData); renderDocItems(); resetItemForm(); logAudit('Alerta Falsificado', 'Movimientos', sku, lote, 'Ítem registrado como FALSIFICADO'); }
        );
    } else {
        movDocItems.push(itemData);
        renderDocItems();
        resetItemForm();
    }
}

function removeItemFromDoc(idx) {
    movDocItems.splice(idx, 1);
    renderDocItems();
}

function renderDocItems() {
    const wrap = document.getElementById('doc-items-wrap');
    const tb = document.getElementById('tDocItems');
    const totalEl = document.getElementById('doc-items-total');
    const saveBtn = document.getElementById('btn-save-doc');
    if (!movDocItems.length) { wrap.style.display = 'none'; if (saveBtn) saveBtn.disabled = true; return; }
    wrap.style.display = 'block';
    if (saveBtn) saveBtn.disabled = false;
    const totalQty = movDocItems.reduce((a, i) => a + i.qty, 0);
    const totalPrecio = movDocItems.reduce((a, i) => a + (i.precio * i.qty), 0);
    tb.innerHTML = movDocItems.map((item, idx) => `
        <tr>
            <td class="text-mono" style="color:var(--accent2)">${item.sku}</td>
            <td>${item.descripcion||'—'}</td>
            <td class="text-mono" style="font-size:11px">${item.lote}</td>
            <td>${item.vence ? fmtDate(item.vence) : '—'}</td>
            <td style="font-weight:600;color:var(--text)">${item.qty}</td>
            <td>${item.precio > 0 ? '$' + item.precio.toLocaleString('es-CL') : '—'}</td>
            <td>${statusBadgeHTML(item.status || 'Aprobado')}</td>
            <td style="font-size:11px;color:var(--text2)">${item.ubicacion||'—'}</td>
            <td><button class="btn btn-sm btn-danger-sm" onclick="removeItemFromDoc(${idx})">✕</button></td>
        </tr>`).join('');
    let tot = `Total: <strong>${totalQty}</strong> unidades`;
    if (totalPrecio > 0) tot += ` · Total neto: <strong>$${totalPrecio.toLocaleString('es-CL')}</strong>`;
    totalEl.innerHTML = tot;
}

function resetItemForm() {
    ['mi-sku','mi-desc','mi-vence','mi-qty','mi-precio','mi-ubic'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('mi-lote-wrap').innerHTML = '<input type="text" class="form-input" id="mi-lote" placeholder="Número de lote">';
    const info = document.getElementById('mi-sku-info'); if (info) info.style.display = 'none';
    const err = document.getElementById('mi-err'); if (err) err.style.display = 'none';
    // Restore Estatus field visibility and default value for current tipo
    const tipo = document.getElementById('md-tipo')?.value || '';
    _refreshMiStatusField(tipo);
}

function saveDocumento() {
    const tipo = document.getElementById('md-tipo').value;
    const numDoc = document.getElementById('md-numdoc').value.trim();
    const proveedor = document.getElementById('md-proveedor').value.trim();
    const fechaDoc = document.getElementById('md-fecha').value;
    const bodega = document.getElementById('md-bodega').value;
    const ubicEl = document.getElementById('md-ubic'); const ubic = ubicEl ? ubicEl.value.trim() : '';
    const obs = document.getElementById('md-obs').value.trim();

    if (!tipo) { showFormError('movModal-err', 'Seleccione el tipo de movimiento.'); return; }
    if (!bodega) { showFormError('movModal-err', 'Seleccione la bodega.'); return; }
    if (!movDocItems.length) { showFormError('movModal-err', 'Debe agregar al menos un producto al documento.'); return; }

    const documentoId = numDoc || `DOC-${Date.now()}`;
    const fechaISO = new Date().toISOString();
    const uid = currentUser.uid;
    const usuario = currentUser.email;
    const totalUnidades = movDocItems.reduce((a, i) => a + i.qty, 0);

    const confirmBody = `
        <strong>${tipo}: ${movDocItems.length} producto(s)</strong><br>
        <span style="color:var(--text3)">Documento:</span> <strong>${documentoId}</strong><br>
        <span style="color:var(--text3)">Bodega:</span> ${bodega}<br>
        <span style="color:var(--text3)">Proveedor/Destino:</span> ${proveedor||'—'}<br>
        <span style="color:var(--text3)">Total unidades:</span> <strong>${totalUnidades}</strong>`;

    showConfirm(
        `Confirmar ${tipo}`,
        'Revise los datos antes de guardar',
        confirmBody,
        `Guardar ${tipo}`,
        tipo === 'Salida' ? 'btn-danger' : 'btn-primary',
        () => {
            const updates = {};
            const ts0 = Date.now();
            movDocItems.forEach((item, i) => {
                const mov = {
                    tipo, sku: item.sku, lote: item.lote,
                    descripcion: item.descripcion,
                    cantidad: item.qty,
                    vence: item.vence,
                    precio: item.precio || 0,
                    status: item.status || 'Aprobado',
                    bodega, ubicacion: item.ubicacion || ubic,
                    proveedor, referencia: numDoc,
                    observaciones: obs,
                    fecha: fechaISO,
                    usuario,
                    documentoId,
                    fechaDocumento: fechaDoc || ''
                };
                updates[`usuarios/${uid}/movimientos/${ts0 + i}`] = mov;
            });
            db.ref().update(updates)
                .then(() => {
                    logAudit(tipo, 'Movimientos', `${movDocItems.length} SKUs`, documentoId, `Total: ${totalUnidades} ud.`);
                    const docData = {
                        documentoId, tipo, numDoc, fecha: fechaISO, fechaDoc,
                        proveedor, bodega, ubic, obs,
                        items: [...movDocItems], usuario
                    };
                    closeModal('movModal');
                    generatePDF(docData);
                })
                .catch(err => showFormError('movModal-err', 'Error al guardar: ' + err.message));
        }
    );
}

function generatePDF(docData) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        alert('No se pudo cargar la librería PDF. Verifique su conexión a internet.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;

    // Encabezado
    doc.setFillColor(29, 45, 62);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Celmedik WMS', margin, 13);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Gestión de Almacén Farmacéutico · NT 147 BPA ISP Chile', margin, 20);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(`DOCUMENTO DE ${docData.tipo.toUpperCase()}`, pageW - margin, 13, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(docData.documentoId, pageW - margin, 20, { align: 'right' });

    // Info del documento
    doc.setTextColor(29, 45, 62);
    let y = 40;
    const col2 = pageW / 2;
    const addInfo = (label, value, x, yPos, lw) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(label, x, yPos);
        doc.setFont('helvetica', 'normal'); doc.text(String(value||'—'), x + (lw||28), yPos);
    };
    addInfo('N° Documento:', docData.documentoId, margin, y, 35);
    addInfo('Tipo:', docData.tipo, col2, y, 15);
    y += 6;
    addInfo('Fecha registro:', new Date(docData.fecha).toLocaleString('es-CL'), margin, y, 35);
    addInfo('Fecha documento:', docData.fechaDoc ? fmtDate(docData.fechaDoc) : '—', col2, y, 38);
    y += 6;
    addInfo('Proveedor/Destinatario:', docData.proveedor || '—', margin, y, 52);
    y += 6;
    addInfo('Bodega:', docData.bodega || '—', margin, y, 20);
    addInfo('Ubicación:', docData.ubic || '—', col2, y, 22);
    y += 6;
    addInfo('Usuario:', docData.usuario || '—', margin, y, 20);
    if (docData.obs) {
        y += 6;
        addInfo('Observaciones:', docData.obs, margin, y, 35);
    }

    // Tabla de productos
    y += 12;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(29, 45, 62);
    doc.text('DETALLE DE PRODUCTOS', margin, y);
    y += 2;

    doc.autoTable({
        startY: y,
        head: [['SKU', 'Descripción', 'Lote', 'Vencimiento', 'Cant.', 'Precio Unit.', 'Estatus', 'Ubicación']],
        body: docData.items.map(item => [
            item.sku,
            item.descripcion || '—',
            item.lote,
            item.vence ? fmtDate(item.vence) : '—',
            String(item.qty),
            item.precio > 0 ? '$' + item.precio.toLocaleString('es-CL') : '—',
            item.status || 'Aprobado',
            item.ubicacion || '—'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [8, 84, 160], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: [29, 45, 62] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
            0: { cellWidth: 18, fontStyle: 'bold' },
            1: { cellWidth: 42 },
            2: { cellWidth: 22 },
            3: { cellWidth: 22 },
            4: { cellWidth: 14, halign: 'center' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 20, halign: 'center' },
            7: { cellWidth: 18, halign: 'center' }
        },
        margin: { left: margin, right: margin }
    });

    y = doc.lastAutoTable.finalY + 8;
    const totalQty = docData.items.reduce((a, i) => a + i.qty, 0);
    const totalPrecio = docData.items.reduce((a, i) => a + (i.precio * i.qty), 0);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(29, 45, 62);
    doc.text(`Total unidades: ${totalQty}`, pageW - margin, y, { align: 'right' });
    if (totalPrecio > 0) { y += 5; doc.text(`Total neto: $${totalPrecio.toLocaleString('es-CL')}`, pageW - margin, y, { align: 'right' }); }

    // Sección de firmas
    y += 20;
    const pageH = doc.internal.pageSize.getHeight();
    if (y > pageH - 55) { doc.addPage(); y = 20; }
    doc.setDrawColor(180, 180, 180);
    const sigW = (pageW - margin * 2 - 20) / 2;
    doc.line(margin, y, margin + sigW, y);
    doc.line(pageW - margin - sigW, y, pageW - margin, y);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
    doc.text('Entregado por / Despachador', margin, y + 5);
    doc.text('Recibido por / Receptor', pageW - margin - sigW, y + 5);
    y += 12;
    doc.text('Nombre: _______________________________', margin, y);
    doc.text('Nombre: _______________________________', pageW - margin - sigW, y);
    y += 6;
    doc.text('RUT: _____________  Fecha: ____________', margin, y);
    doc.text('RUT: _____________  Fecha: ____________', pageW - margin - sigW, y);

    // Pie de página
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, pageH - 16, pageW - margin, pageH - 16);
    doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text('Documento generado por Celmedik WMS · Normativa ISP Chile · Norma Técnica N°147 BPA', pageW / 2, pageH - 10, { align: 'center' });
    doc.text(`${new Date().toLocaleString('es-CL')} · ${docData.usuario}`, pageW / 2, pageH - 5, { align: 'center' });

    doc.save(`${docData.tipo}_${docData.documentoId}_${new Date().toISOString().split('T')[0]}.pdf`);
}

function regenerarPDF(documentoId) {
    const movs = Object.values(data.movimientos || {}).filter(m => m.documentoId === documentoId);
    if (!movs.length) { alert('No se encontraron movimientos para este documento.'); return; }
    const ref = movs[0];
    generatePDF({
        documentoId,
        tipo: ref.tipo,
        numDoc: ref.referencia,
        fecha: ref.fecha,
        fechaDoc: ref.fechaDocumento || '',
        proveedor: ref.proveedor || '',
        bodega: ref.bodega || '',
        ubic: ref.ubicacion || '',
        obs: ref.observaciones || '',
        items: movs.map(m => ({ sku: m.sku, descripcion: m.descripcion||'', lote: m.lote, vence: m.vence||'', qty: m.cantidad, precio: m.precio||0, status: m.status||'', ubicacion: m.ubicacion||'' })),
        usuario: ref.usuario || ''
    });
}

function clearFiltrosMovimientos() {
    ['fMovSKU','fMovLote','fMovFechaDesde','fMovFechaHasta'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('fMovTipo').value = '';
    renderMovimientos();
}

function renderMovimientos() {
    const fTipo = document.getElementById('fMovTipo')?.value||'';
    const fSKU = (document.getElementById('fMovSKU')?.value||'').toLowerCase();
    const fLote = (document.getElementById('fMovLote')?.value||'').toLowerCase();
    const fDesde = document.getElementById('fMovFechaDesde')?.value||'';
    const fHasta = document.getElementById('fMovFechaHasta')?.value||'';
    let rows = Object.values(data.movimientos||{});
    if (fTipo) rows = rows.filter(m => m.tipo === fTipo);
    if (fSKU) rows = rows.filter(m => (m.sku||'').toLowerCase().includes(fSKU));
    if (fLote) rows = rows.filter(m => (m.lote||'').toLowerCase().includes(fLote));
    if (fDesde) rows = rows.filter(m => m.fecha && m.fecha.slice(0,10) >= fDesde);
    if (fHasta) rows = rows.filter(m => m.fecha && m.fecha.slice(0,10) <= fHasta);
    rows.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const tb = document.getElementById('tMovimientos');
    if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="15">No hay movimientos</td></tr>'; return; }
    // Track which documentoIds already have a PDF button rendered to avoid duplicates
    const pdfRendered = new Set();
    tb.innerHTML = rows.map(m => {
        const tC = m.tipo === 'Entrada' ? 'badge-success' : m.tipo === 'Salida' ? 'badge-danger' : m.tipo === 'Destrucción' ? 'badge-danger' : m.tipo === 'CambioEstado' ? 'badge-gray' : 'badge-warning';
        const sC = m.status === 'Aprobado' ? 'badge-success' : m.status === 'Rechazado' ? 'badge-danger' : 'badge-warning';
        let pdfCell = '—';
        if (m.documentoId) {
            if (!pdfRendered.has(m.documentoId)) {
                pdfRendered.add(m.documentoId);
                pdfCell = `<button class="btn btn-sm btn-icon" style="font-size:10px;white-space:nowrap" onclick="regenerarPDF('${m.documentoId.replace(/'/g,"\\'")}')">PDF</button>`;
            } else {
                pdfCell = `<span style="color:var(--text3);font-size:10px">${m.documentoId}</span>`;
            }
        }
        return `<tr>
            <td class="text-mono" style="font-size:11px">${fmtDateTime(m.fecha)}</td>
            <td><span class="badge ${tC}">${m.tipo}</span></td>
            <td class="text-mono" style="color:var(--accent2)">${m.sku}</td>
            <td>${m.descripcion||'—'}</td>
            <td class="text-mono" style="font-size:11px">${m.lote||'—'}</td>
            <td>${m.vence ? fmtDate(m.vence) : '—'}</td>
            <td style="font-weight:600;color:var(--text)">${m.cantidad}</td>
            <td>${m.bodega||'—'}</td>
            <td>${m.ubicacion||'—'}</td>
            <td>${m.proveedor||'—'}</td>
            <td>${m.referencia||'—'}</td>
            <td><span class="badge ${sC}">${m.status||'—'}</span></td>
            <td style="font-size:11px;color:var(--text3)">${m.usuario||'—'}</td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.observaciones||'—'}</td>
            <td>${pdfCell}</td>
        </tr>`;
    }).join('');
}

// ══ STOCK ══
function renderStock() {
    const fSKU = (document.getElementById('fStockSKU')?.value||'').toLowerCase();
    const fLote = (document.getElementById('fStockLote')?.value||'').toLowerCase();
    const fUbic = (document.getElementById('fStockUbic')?.value||'').toLowerCase();
    const sortBy = document.getElementById('fStockSort')?.value || 'fefo';
    const stock = calcStock();
    const prods = data.productos||{};
    const hoy = new Date();

    let rows = Object.values(stock).filter(s => {
        const bMatch = selectedBodega === 'TOTAL' || s.bodega === selectedBodega;
        return s.cantidad > 0 && bMatch &&
            s.sku.toLowerCase().includes(fSKU) &&
            (s.lote||'').toLowerCase().includes(fLote) &&
            (s.ubicacion||'').toLowerCase().includes(fUbic);
    });

    const subtitleEl = document.getElementById('stockSortSubtitle');
    if (sortBy === 'fefo') {
        rows.sort((a, b) => {
            if (!a.vence) return 1;
            if (!b.vence) return -1;
            return new Date(a.vence + 'T00:00:00') - new Date(b.vence + 'T00:00:00');
        });
        if (subtitleEl) subtitleEl.textContent = 'Ordenado por FEFO — Vencimiento más próximo primero';
    } else if (sortBy === 'sku') {
        rows.sort((a, b) => a.sku.localeCompare(b.sku));
        if (subtitleEl) subtitleEl.textContent = 'Ordenado por SKU — A a Z';
    } else if (sortBy === 'desc') {
        rows.sort((a, b) => {
            const dA = (prods[a.sku]?.descripcion || a.sku).toLowerCase();
            const dB = (prods[b.sku]?.descripcion || b.sku).toLowerCase();
            return dA.localeCompare(dB);
        });
        if (subtitleEl) subtitleEl.textContent = 'Ordenado por Descripción — A a Z';
    }

    const tb = document.getElementById('tStock');
    if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="13">No hay stock registrado</td></tr>'; return; }

    tb.innerHTML = rows.map((s, i) => {
        const vD = s.vence ? new Date(s.vence + 'T00:00:00') : null;
        const dias = vD ? Math.ceil((vD - hoy) / 86400000) : null;
        const dotCls = dias === null ? '' : dias < 0 ? 'exp' : dias <= 30 ? 'exp' : dias <= 90 ? 'warn' : 'ok';
        const isFirst = sortBy === 'fefo' && i === 0;
        const statusCls = s.status === 'Aprobado' ? 'badge-success' : s.status === 'Rechazado' ? 'badge-danger' : 'badge-warning';
        const rs = prods[s.sku]?.registroSanitario;
        return `<tr>
            <td><div class="fefo-indicator"><div class="fefo-dot ${isFirst ? 'first' : dotCls}"></div>${isFirst ? '<span style="color:var(--accent2);font-size:10px;font-weight:600">FEFO</span>' : ''}</div></td>
            <td class="text-mono" style="color:var(--accent2)">${s.sku}</td>
            <td style="color:var(--text)">${prods[s.sku]?.descripcion||'—'}</td>
            <td>${rs ? `<span class="rs-number">${rs}</span>` : '<span class="text-muted">—</span>'}</td>
            <td class="text-mono" style="font-size:11px">${s.lote}</td>
            <td>${vD ? fmtDate(s.vence) : '—'}</td>
            <td style="font-weight:600;color:var(--text)">${s.cantidad}</td>
            <td>${prods[s.sku]?.unidadVenta||'—'}</td>
            <td style="font-size:12px;color:var(--text2)">${prods[s.sku]?.presentacion||'—'}</td>
            <td><span class="badge ${statusCls}">${s.status}</span></td>
            <td>${s.bodega||'—'}</td>
            <td>${s.ubicacion||'—'}</td>
            <td><button class="btn btn-sm btn-icon" style="font-size:10px" onclick="verTrazabilidadLote('${s.sku}','${s.lote}')">Trazar</button></td>
        </tr>`;
    }).join('');
}

function clearStockFilters() {
    ['fStockSKU','fStockLote','fStockUbic'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    const sort = document.getElementById('fStockSort'); if(sort) sort.value = 'fefo';
    renderStock();
}

// ══ CUARENTENA ══
function saveCuarentena(e) {
    e.preventDefault();
    const sku = document.getElementById('q-sku').value.trim().toUpperCase();
    const q = {
        sku, lote: document.getElementById('q-lote').value.trim(),
        cantidad: parseInt(document.getElementById('q-qty').value),
        motivo: document.getElementById('q-motivo').value,
        responsable: document.getElementById('q-resp').value.trim(),
        observaciones: document.getElementById('q-obs').value.trim(),
        descripcion: data.productos[sku]?.descripcion || '',
        status: 'Pendiente',
        fechaIngreso: new Date().toISOString(),
        usuario: currentUser.email
    };
    db.ref(`usuarios/${currentUser.uid}/cuarentena`).push(q)
        .then(() => { logAudit('Ingresar', 'Cuarentena', sku, q.lote, q.motivo); closeModal('cuarModal'); })
        .catch(err => alert('Error: ' + err.message));
}

function renderCuarentena() {
    const tb = document.getElementById('tCuarentena');
    const rows = Object.entries(data.cuarentena||{}).sort((a, b) => new Date(b[1].fechaIngreso) - new Date(a[1].fechaIngreso));
    if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="10">No hay lotes en cuarentena</td></tr>'; return; }
    tb.innerHTML = rows.map(([id, q]) => `
        <tr>
            <td class="text-mono" style="font-size:11px">${fmtDate(q.fechaIngreso)}</td>
            <td class="text-mono" style="color:var(--accent2)">${q.sku}</td>
            <td>${q.descripcion||'—'}</td>
            <td class="text-mono" style="font-size:11px">${q.lote}</td>
            <td style="font-weight:600;color:var(--text)">${q.cantidad}</td>
            <td>${q.motivo}</td>
            <td>${q.responsable||'—'}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.observaciones||'—'}</td>
            <td><span class="badge ${q.status==='Liberado'?'badge-success':q.status==='Destruido'?'badge-danger':'badge-warning'}">${q.status}</span></td>
            <td style="display:flex;gap:4px;flex-wrap:wrap">
                ${q.status==='Pendiente'?`<button class="btn btn-sm btn-success-sm" onclick="liberarCuarentena('${id}')">✓ Liberar</button><button class="btn btn-sm btn-danger-sm" onclick="abrirRechazoCuarentena('${id}')">✕ Rechazar</button><button class="btn btn-sm btn-danger-sm" onclick="abrirDestruccionCuarentena('${id}')" style="background:rgba(107,47,190,0.1);color:var(--purple);border-color:rgba(107,47,190,0.3)">⚠ Destruir</button>`:''}
            </td>
        </tr>`).join('');
}

function liberarCuarentena(id) {
    const q = data.cuarentena[id]; if (!q) return;
    showConfirm(
        'Liberar lote de cuarentena',
        `SKU: ${q.sku} · Lote: ${q.lote}`,
        `<strong>¿Confirmar liberación?</strong><br>El lote quedará en estado <span style="color:var(--success);font-weight:600">APROBADO</span> y podrá despacharse normalmente.<br><span style="color:var(--text3);font-size:12px">Se registrará un evento de cambio de estado en trazabilidad.</span>`,
        'Confirmar liberación', 'btn-success-sm',
        () => {
            const uid = currentUser.uid;
            const ahora = new Date().toISOString();
            const stock = calcStock();
            const stockItem = Object.values(stock).find(s => s.sku === q.sku && s.lote === q.lote);
            const updates = {};
            updates[`usuarios/${uid}/cuarentena/${id}/status`] = 'Liberado';
            updates[`usuarios/${uid}/cuarentena/${id}/fechaLiberacion`] = ahora;
            updates[`usuarios/${uid}/cuarentena/${id}/usuarioLibera`] = currentUser.email;
            // CambioEstado movement for trazabilidad
            updates[`usuarios/${uid}/movimientos/${Date.now()}`] = {
                tipo: 'CambioEstado', sku: q.sku, lote: q.lote,
                descripcion: q.descripcion || data.productos[q.sku]?.descripcion || '',
                cantidad: q.cantidad, vence: stockItem?.vence || '',
                status: 'Aprobado', statusAnterior: 'Cuarentena',
                bodega: stockItem?.bodega || '', ubicacion: stockItem?.ubicacion || '',
                proveedor: '', referencia: '',
                observaciones: `Liberado de cuarentena por QA. Motivo original: ${q.motivo}`,
                fecha: ahora, usuario: currentUser.email
            };
            db.ref().update(updates).then(() => {
                logAudit('Liberar', 'Cuarentena', q.sku, q.lote, 'Liberado → Aprobado por QA');
            });
        }
    );
}

function abrirRechazoCuarentena(id) {
    const q = data.cuarentena[id]; if (!q) return;
    document.getElementById('rcq-id').value = id;
    document.getElementById('rcq-motivo').value = '';
    document.getElementById('rcq-resp').value = '';
    document.getElementById('rcq-obs').value = '';
    openModal('rechazarCuarModal');
}

function confirmarRechazoCuarentena() {
    const id = document.getElementById('rcq-id').value;
    const motivo = document.getElementById('rcq-motivo').value;
    const resp = document.getElementById('rcq-resp').value.trim();
    const obs = document.getElementById('rcq-obs').value.trim();
    if (!motivo) { alert('Seleccione el motivo de rechazo.'); return; }
    if (!resp) { alert('Ingrese el nombre del responsable QA.'); return; }
    const q = data.cuarentena[id]; if (!q) return;
    const uid = currentUser.uid;
    const ahora = new Date().toISOString();
    const stock = calcStock();
    const stockItem = Object.values(stock).find(s => s.sku === q.sku && s.lote === q.lote);
    const updates = {};
    updates[`usuarios/${uid}/cuarentena/${id}/status`] = 'Rechazado';
    updates[`usuarios/${uid}/cuarentena/${id}/motivoRechazo`] = motivo;
    updates[`usuarios/${uid}/cuarentena/${id}/responsableRechazo`] = resp;
    updates[`usuarios/${uid}/cuarentena/${id}/observacionesRechazo`] = obs;
    updates[`usuarios/${uid}/cuarentena/${id}/fechaRechazo`] = ahora;
    updates[`usuarios/${uid}/cuarentena/${id}/usuarioRechazo`] = currentUser.email;
    // CambioEstado movement
    updates[`usuarios/${uid}/movimientos/${Date.now()}`] = {
        tipo: 'CambioEstado', sku: q.sku, lote: q.lote,
        descripcion: q.descripcion || data.productos[q.sku]?.descripcion || '',
        cantidad: q.cantidad, vence: stockItem?.vence || '',
        status: 'Rechazado', statusAnterior: 'Cuarentena',
        bodega: stockItem?.bodega || '', ubicacion: stockItem?.ubicacion || '',
        proveedor: resp, referencia: '',
        observaciones: `Rechazado por QA. Motivo: ${motivo}. ${obs}`,
        fecha: ahora, usuario: currentUser.email
    };
    db.ref().update(updates).then(() => {
        logAudit('Rechazar', 'Cuarentena', q.sku, q.lote, `Rechazado → ${motivo} · Resp: ${resp}`);
        closeModal('rechazarCuarModal');
    });
}

function abrirDestruccionCuarentena(id) {
    const q = data.cuarentena[id]; if (!q) return;
    const stock = calcStock();
    const stockItem = Object.values(stock).find(s => s.sku === q.sku && s.lote === q.lote);
    document.getElementById('dest-sku').value = q.sku;
    document.getElementById('dest-lote').value = q.lote;
    document.getElementById('dest-estado').value = stockItem ? getLoteStatus(stockItem) : 'Cuarentena';
    document.getElementById('dest-stock').value = (stockItem?.cantidad || q.cantidad) + ' unidades';
    document.getElementById('dest-qty').value = stockItem?.cantidad || q.cantidad;
    document.getElementById('dest-qty').max = stockItem?.cantidad || q.cantidad;
    document.getElementById('dest-header-title').textContent = `Lote ${q.lote} — Desde cuarentena`;
    document.getElementById('dest-header-desc').textContent = 'Se registrará la destrucción y se actualizará el stock. Complete todos los campos del acta.';
    ['dest-motivo','dest-empresa','dest-acta','dest-resp','dest-obs'].forEach(id => { const el=document.getElementById(id); if(el&&el.tagName==='SELECT') el.value=''; else if(el) el.value=''; });
    document.getElementById('dest-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('dest-err').style.display = 'none';
    // Store cuarentena id for later update
    document.getElementById('dest-sku').dataset.cuarId = id;
    openModal('destruccionModal');
}

// ══ DESTRUCCIÓN ISP ══
function saveDestruccion() {
    const sku      = document.getElementById('dest-sku').value.trim();
    const lote     = document.getElementById('dest-lote').value.trim();
    const estado   = document.getElementById('dest-estado').value.trim();
    const qty      = parseInt(document.getElementById('dest-qty').value) || 0;
    const motivo   = document.getElementById('dest-motivo').value;
    const empresa  = document.getElementById('dest-empresa').value.trim();
    const acta     = document.getElementById('dest-acta').value.trim();
    const fechaDest = document.getElementById('dest-fecha').value;
    const resp     = document.getElementById('dest-resp').value.trim();
    const obs      = document.getElementById('dest-obs').value.trim();
    const cuarId   = document.getElementById('dest-sku').dataset.cuarId || '';

    if (!qty || qty < 1) { showFormError('dest-err', 'La cantidad a destruir debe ser mayor a cero.'); return; }
    if (!motivo) { showFormError('dest-err', 'Seleccione el motivo de rechazo.'); return; }
    if (!empresa) { showFormError('dest-err', 'Ingrese la empresa destructora.'); return; }
    if (!acta) { showFormError('dest-err', 'Ingrese el número de acta de destrucción.'); return; }
    if (!fechaDest) { showFormError('dest-err', 'Seleccione la fecha programada de destrucción.'); return; }
    if (!resp) { showFormError('dest-err', 'Ingrese el responsable QA que autoriza.'); return; }
    if (!obs) { showFormError('dest-err', 'Las observaciones son obligatorias.'); return; }

    const maxQty = parseInt(document.getElementById('dest-qty').max) || Infinity;
    if (qty > maxQty) { showFormError('dest-err', `Cantidad excede el stock disponible (${maxQty} unidades).`); return; }

    const uid = currentUser.uid;
    const ahora = new Date().toISOString();
    const stock = calcStock();
    const stockItem = Object.values(stock).find(s => s.sku === sku && s.lote === lote);
    const documentoId = `DEST-${acta}-${Date.now()}`;

    const mov = {
        tipo: 'Destrucción', sku, lote,
        descripcion: data.productos[sku]?.descripcion || '',
        cantidad: qty, vence: stockItem?.vence || '',
        status: estado,
        bodega: stockItem?.bodega || '',
        ubicacion: stockItem?.ubicacion || '',
        proveedor: empresa,
        referencia: acta,
        observaciones: `DESTRUCCIÓN ISP · Motivo: ${motivo} · Empresa: ${empresa} · Acta: ${acta} · Fecha dest.: ${fechaDest} · Resp. QA: ${resp} · ${obs}`,
        fecha: ahora,
        usuario: currentUser.email,
        documentoId,
        actaDestruccion: { motivo, empresa, acta, fechaDest, resp, obs }
    };

    const updates = {};
    updates[`usuarios/${uid}/movimientos/${Date.now()}`] = mov;

    // If came from cuarentena, mark it as Destruido
    if (cuarId && data.cuarentena[cuarId]) {
        updates[`usuarios/${uid}/cuarentena/${cuarId}/status`] = 'Destruido';
        updates[`usuarios/${uid}/cuarentena/${cuarId}/fechaDestroy`] = ahora;
        updates[`usuarios/${uid}/cuarentena/${cuarId}/usuarioDestroy`] = currentUser.email;
        updates[`usuarios/${uid}/cuarentena/${cuarId}/actaDestruccion`] = acta;
    }

    // CambioEstado: mark remaining stock as Rechazado if partial destruction
    const remaining = (stockItem?.cantidad || 0) - qty;
    if (remaining > 0) {
        updates[`usuarios/${uid}/movimientos/${Date.now() + 1}`] = {
            tipo: 'CambioEstado', sku, lote,
            descripcion: data.productos[sku]?.descripcion || '',
            cantidad: remaining, vence: stockItem?.vence || '',
            status: 'Rechazado', statusAnterior: estado,
            bodega: stockItem?.bodega || '', ubicacion: stockItem?.ubicacion || '',
            proveedor: '', referencia: acta,
            observaciones: `Stock residual post-destrucción parcial. Acta: ${acta}`,
            fecha: ahora, usuario: currentUser.email
        };
    }

    db.ref().update(updates).then(() => {
        logAudit('Destrucción', 'Movimientos', sku, lote, `Acta: ${acta} · ${qty} ud · Motivo: ${motivo} · Empresa: ${empresa}`);
        const actaData = { documentoId, sku, lote, descripcion: data.productos[sku]?.descripcion||'', qty, estado, motivo, empresa, acta, fechaDest, resp, obs, fecha: ahora, usuario: currentUser.email };
        closeModal('destruccionModal');
        closeModal('movModal');
        generateActaPDF(actaData);
    }).catch(err => showFormError('dest-err', 'Error al guardar: ' + err.message));
}

function generateActaPDF(d) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
        alert('No se pudo cargar la librería PDF.'); return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;

    // Encabezado rojo
    doc.setFillColor(187, 0, 0);
    doc.rect(0, 0, pageW, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text('ACTA DE DESTRUCCIÓN', margin, 13);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Celmedik WMS · Norma Técnica N°147 ISP Chile · Trazabilidad BPA', margin, 20);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(d.documentoId, pageW - margin, 13, { align: 'right' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(new Date(d.fecha).toLocaleString('es-CL'), pageW - margin, 20, { align: 'right' });

    doc.setTextColor(187, 0, 0);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('⚠ DOCUMENTO OFICIAL DE DESTRUCCIÓN — ARCHIVO OBLIGATORIO ISP', pageW / 2, 30, { align: 'center' });

    doc.setTextColor(29, 45, 62);
    let y = 42;
    const addField = (label, value, x, yPos, lw) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(89, 89, 89);
        doc.text(label.toUpperCase(), x, yPos);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(29, 45, 62);
        doc.text(String(value || '—'), x, yPos + 5);
    };

    const col2 = pageW / 2 + 4;

    // Producto
    doc.setFillColor(245, 245, 245); doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(29, 45, 62);
    doc.text('IDENTIFICACIÓN DEL PRODUCTO', margin + 2, y + 1);
    y += 10;

    addField('SKU', d.sku, margin, y); addField('Lote', d.lote, col2, y);
    y += 12;
    addField('Descripción', d.descripcion, margin, y);
    y += 12;
    addField('Estado al destruir', d.estado, margin, y); addField('Cantidad destruida', d.qty + ' unidades', col2, y);
    y += 14;

    // Destrucción
    doc.setFillColor(245, 245, 245); doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(29, 45, 62);
    doc.text('DATOS DE LA DESTRUCCIÓN', margin + 2, y + 1);
    y += 10;

    addField('Motivo de rechazo', d.motivo, margin, y); addField('N° Acta', d.acta, col2, y);
    y += 12;
    addField('Empresa destructora', d.empresa, margin, y); addField('Fecha programada', d.fechaDest ? new Date(d.fechaDest + 'T00:00:00').toLocaleDateString('es-CL') : '—', col2, y);
    y += 12;
    addField('Responsable QA autoriza', d.resp, margin, y);
    y += 12;
    const obsLines = doc.splitTextToSize('Observaciones: ' + (d.obs || '—'), pageW - margin * 2 - 10);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 5 + 6;

    // Firmas
    y += 8;
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    doc.setFillColor(245, 245, 245); doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(29, 45, 62);
    doc.text('FIRMAS Y CERTIFICACIÓN', margin + 2, y + 1);
    y += 14;

    const sigW = (pageW - margin * 2 - 16) / 3;
    doc.setDrawColor(180, 180, 180);
    [margin, margin + sigW + 8, margin + (sigW + 8) * 2].forEach((x, i) => {
        doc.line(x, y, x + sigW, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100);
        const labels = ['Responsable QA / Autoriza', 'Operador bodega', 'Empresa destructora'];
        doc.text(labels[i], x, y + 4);
        doc.text('Nombre: _____________________', x, y + 10);
        doc.text('RUT: ____________ Firma: _____', x, y + 16);
    });

    // Pie
    y = pageH - 18;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    doc.setFontSize(7); doc.setTextColor(140, 140, 140);
    doc.text('Documento oficial de destrucción — Celmedik WMS · ISP Chile · NT 147 BPA · Archivo obligatorio 5 años', pageW / 2, y + 5, { align: 'center' });
    doc.text(`${new Date(d.fecha).toLocaleString('es-CL')} · Generado por: ${d.usuario}`, pageW / 2, y + 10, { align: 'center' });

    doc.save(`Acta_Destruccion_${d.acta}_${d.lote}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ══ DEVOLUCIONES ══
function saveDevolucion(e) {
    e.preventDefault();
    const sku = document.getElementById('d-sku').value.trim().toUpperCase();
    const dev = {
        sku, lote: document.getElementById('d-lote').value.trim(),
        cantidad: parseInt(document.getElementById('d-qty').value),
        motivo: document.getElementById('d-motivo').value,
        status: document.getElementById('d-status').value,
        observaciones: document.getElementById('d-obs').value.trim(),
        descripcion: data.productos[sku]?.descripcion || '',
        fecha: new Date().toISOString(),
        usuario: currentUser.email
    };
    db.ref(`usuarios/${currentUser.uid}/devoluciones`).push(dev)
        .then(() => { logAudit('Devolución', 'Devoluciones', sku, dev.lote, dev.motivo); closeModal('devModal'); });
}

function renderDevoluciones() {
    const fSKU = (document.getElementById('fDevSKU')?.value||'').toLowerCase();
    const fLote = (document.getElementById('fDevLote')?.value||'').toLowerCase();
    const rows = Object.entries(data.devoluciones||{})
        .filter(([,d]) => (d.sku||'').toLowerCase().includes(fSKU) && (d.lote||'').toLowerCase().includes(fLote))
        .sort((a, b) => new Date(b[1].fecha) - new Date(a[1].fecha));
    const tb = document.getElementById('tDevoluciones');
    if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="8">No hay devoluciones</td></tr>'; return; }
    tb.innerHTML = rows.map(([id, d]) => {
        const sC = d.status === 'Aprobado' ? 'badge-success' : d.status === 'Rechazado' ? 'badge-danger' : 'badge-warning';
        return `<tr>
            <td class="text-mono" style="font-size:11px">${fmtDate(d.fecha)}</td>
            <td class="text-mono" style="color:var(--accent2)">${d.sku}</td>
            <td>${d.descripcion||'—'}</td>
            <td class="text-mono" style="font-size:11px">${d.lote}</td>
            <td style="font-weight:600;color:var(--text)">${d.cantidad}</td>
            <td>${d.motivo}</td>
            <td><span class="badge ${sC}">${d.status}</span></td>
            <td><button class="btn btn-sm btn-danger-sm" onclick="deleteDevolucion('${id}')">Eliminar</button></td>
        </tr>`;
    }).join('');
}

function deleteDevolucion(id) {
    if (confirm('¿Eliminar esta devolución?')) db.ref(`usuarios/${currentUser.uid}/devoluciones/${id}`).remove();
}

// ══ RETIRO DE MERCADO ══
function ejecutarRetiro() {
    const lote = document.getElementById('retiroLote').value.trim();
    const sku = document.getElementById('retiroSKU').value.trim().toUpperCase();
    const c = document.getElementById('retiroResults');
    if (!lote) { c.innerHTML = '<p class="text-muted text-sm">Ingrese un número de lote.</p>'; return; }

    const movs = Object.values(data.movimientos||{}).filter(m =>
        m.lote === lote && (!sku || m.sku === sku)
    ).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    if (!movs.length) { c.innerHTML = `<div class="alert-banner success"><div class="alert-banner-icon">✓</div><div><div class="alert-banner-title">Sin registros encontrados</div><div class="alert-banner-text">El lote ${lote} no tiene movimientos registrados en el sistema.</div></div></div>`; return; }

    const entradas = movs.filter(m => m.tipo === 'Entrada');
    const salidas = movs.filter(m => m.tipo === 'Salida');
    const stockActual = entradas.reduce((a, m) => a + (parseInt(m.cantidad)||0), 0) - salidas.reduce((a, m) => a + (parseInt(m.cantidad)||0), 0);

    c.innerHTML = `
        <div class="alert-banner danger" style="margin-bottom:16px">
            <div class="alert-banner-icon">⚠</div>
            <div>
                <div class="alert-banner-title">Reporte de retiro — Lote: ${lote}</div>
                <div class="alert-banner-text">Generado: ${new Date().toLocaleString('es-CL')} | Stock actual localizado: ${stockActual} ud.</div>
            </div>
        </div>
        <div class="card" style="margin-bottom:12px">
            <div class="card-header"><div class="card-title">Entradas (${entradas.length})</div></div>
            ${entradas.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>SKU</th><th>Qty</th><th>Bodega</th><th>Proveedor</th><th>Referencia</th><th>Usuario</th></tr></thead><tbody>
                ${entradas.map(m => `<tr><td class="text-mono" style="font-size:11px">${fmtDateTime(m.fecha)}</td><td>${m.sku}</td><td style="font-weight:600">${m.cantidad}</td><td>${m.bodega||'—'}</td><td>${m.proveedor||'—'}</td><td>${m.referencia||'—'}</td><td style="font-size:11px">${m.usuario||'—'}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="text-muted text-sm">Sin entradas</p>'}
        </div>
        <div class="card">
            <div class="card-header"><div class="card-title">Salidas / Distribución (${salidas.length})</div></div>
            ${salidas.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>SKU</th><th>Qty</th><th>Destino</th><th>Referencia</th><th>Usuario</th></tr></thead><tbody>
                ${salidas.map(m => `<tr><td class="text-mono" style="font-size:11px">${fmtDateTime(m.fecha)}</td><td>${m.sku}</td><td style="font-weight:600;color:var(--danger)">${m.cantidad}</td><td>${m.proveedor||'—'}</td><td>${m.referencia||'—'}</td><td style="font-size:11px">${m.usuario||'—'}</td></tr>`).join('')}
            </tbody></table></div>` : '<p class="text-muted text-sm">Sin salidas registradas — producto aún en bodega</p>'}
        </div>`;

    logAudit('Retiro mercado', 'Retiro', sku||'VARIOS', lote, `Simulación retiro — Stock localizado: ${stockActual}`);
}

// ══ TRAZABILIDAD ══
function buscarTrazabilidad() {
    const lote = document.getElementById('trazLote').value.trim();
    const sku = document.getElementById('trazSKU').value.trim().toUpperCase();
    verTrazabilidadLote(sku, lote);
}

function verTrazabilidadLote(sku, lote) {
    if (sku) document.getElementById('trazSKU').value = sku;
    if (lote) document.getElementById('trazLote').value = lote;
    navigateTo('trazabilidad');

    const c = document.getElementById('trazResults');
    if (!lote) { c.innerHTML = '<p class="text-muted text-sm">Ingrese un número de lote.</p>'; return; }

    const movs = Object.values(data.movimientos||{})
        .filter(m => m.lote === lote && (!sku || m.sku === sku))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const cuars = Object.values(data.cuarentena||{}).filter(q => q.lote === lote && (!sku || q.sku === sku));
    const devs = Object.values(data.devoluciones||{}).filter(d => d.lote === lote && (!sku || d.sku === sku));

    if (!movs.length && !cuars.length && !devs.length) {
        c.innerHTML = `<p class="text-muted text-sm">Sin registros para el lote "${lote}".</p>`;
        return;
    }

    const items = [
        ...movs.map(m => {
            let desc, meta, clase;
            if (m.tipo === 'CambioEstado') {
                desc = `Cambio de estado: ${m.statusAnterior || '?'} → <strong style="color:${m.status==='Aprobado'?'var(--success)':m.status==='Rechazado'?'var(--danger)':'var(--warning)'}">${m.status}</strong>`;
                meta = `Motivo: ${m.observaciones||'—'} | Resp: ${m.proveedor||'—'}`;
                clase = 'ajuste';
            } else if (m.tipo === 'Destrucción') {
                desc = `Destrucción ISP: ${m.cantidad} ud. — Acta: ${m.referencia||'—'}`;
                meta = `Empresa: ${m.proveedor||'—'} | ${m.observaciones||''}`;
                clase = 'salida';
            } else {
                desc = `${m.tipo}: ${m.cantidad} ud. en ${m.bodega||'—'} / ${m.ubicacion||'—'}`;
                meta = `Ref: ${m.referencia||'—'} | Proveedor/Cliente: ${m.proveedor||'—'} | Status: ${m.status}`;
                clase = m.tipo === 'Salida' ? 'salida' : m.tipo === 'Ajuste' ? 'ajuste' : '';
            }
            return { fecha: m.fecha, tipo: m.tipo, desc, meta, usuario: m.usuario, clase };
        }),
        ...cuars.map(q => ({ fecha: q.fechaIngreso, tipo: 'Cuarentena', desc: `Ingreso a cuarentena: ${q.cantidad} ud.`, meta: `Motivo: ${q.motivo} | Status: ${q.status}${q.motivoRechazo?' | Rechazo: '+q.motivoRechazo:''}`, usuario: q.usuario, clase: 'ajuste' })),
        ...devs.map(d => ({ fecha: d.fecha, tipo: 'Devolución', desc: `Devolución: ${d.cantidad} ud.`, meta: `Motivo: ${d.motivo} | Status: ${d.status}`, usuario: d.usuario, clase: 'salida' })),
    ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const prod = sku ? data.productos[sku] : null;
    c.innerHTML = `
        <div class="card" style="margin-bottom:12px">
            <div class="flex-between"><div><div class="card-title">Lote: <span class="text-mono" style="color:var(--accent2)">${lote}</span>${sku ? ` — ${sku}` : ''}</div>${prod?`<div class="card-subtitle">${prod.descripcion} · ${prod.fabricante}${prod.registroSanitario?` · RS: <span class="rs-number">${prod.registroSanitario}</span>`:''}</div>`:''}</div><span class="badge badge-blue">${items.length} eventos</span></div>
        </div>
        <div class="card">
            <ul class="lot-timeline">
                ${items.map(it => `
                    <li class="lot-timeline-item ${it.clase}">
                        <div class="lot-timeline-date">${fmtDateTime(it.fecha)} — <span class="badge badge-${it.tipo==='Destrucción'?'danger':it.tipo==='CambioEstado'?'purple':it.clase==='salida'?'danger':it.clase==='ajuste'?'warning':'success'}" style="font-size:10px">${it.tipo}</span></div>
                        <div class="lot-timeline-desc">${it.desc}</div>
                        <div class="lot-timeline-meta">${it.meta} | Usuario: ${it.usuario||'—'}</div>
                    </li>`).join('')}
            </ul>
        </div>`;
}

// ══ REPORTES ══
function rptTable(title, headers, rows, subtitle) {
    const hdr = headers.map(h => `<th>${h}</th>`).join('');
    const bdy = rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr class="empty-row"><td colspan="${headers.length}">Sin datos</td></tr>`;
    document.getElementById('rptContainer').innerHTML = `<div class="card"><div class="card-header"><div><div class="card-title">${title}</div>${subtitle?`<div class="card-subtitle">${subtitle}</div>`:''}</div><span class="badge badge-blue">${new Date().toLocaleDateString('es-CL')}</span></div><div class="table-wrap"><table><thead><tr>${hdr}</tr></thead><tbody>${bdy}</tbody></table></div></div>`;
}

function rptInventario() {
    const stock = calcStock();
    const prods = data.productos||{};
    const rows = Object.values(stock).filter(s => s.cantidad > 0)
        .sort((a, b) => new Date(a.vence+'T00:00:00') - new Date(b.vence+'T00:00:00'))
        .map(s => [s.sku, prods[s.sku]?.descripcion||'—', prods[s.sku]?.registroSanitario||'—', s.lote, s.cantidad, s.vence?fmtDate(s.vence):'—', s.bodega||'—', s.ubicacion||'—', s.status]);
    rptTable('Inventario General (FEFO)', ['SKU','Descripción','N° Reg. ISP','Lote','Qty','Vencimiento','Bodega','Ubicación','Status'], rows, 'Ordenado por vencimiento — Norma Técnica N°147');
}

function rptVencimientos() {
    const stock = calcStock();
    const prods = data.productos||{};
    const hoy = new Date();
    const rows = Object.values(stock).filter(s => s.cantidad > 0 && s.vence)
        .sort((a, b) => new Date(a.vence+'T00:00:00') - new Date(b.vence+'T00:00:00'))
        .map(s => {
            const dias = Math.ceil((new Date(s.vence+'T00:00:00') - hoy) / 86400000);
            const est = dias < 0 ? '⚠ VENCIDO' : dias <= 30 ? '⚠ Crítico' : dias <= 90 ? '◉ Próximo' : '✓ OK';
            return [s.sku, prods[s.sku]?.descripcion||'—', s.lote, s.cantidad, fmtDate(s.vence), `${dias}d`, est, s.bodega||'—'];
        });
    rptTable('Reporte de Vencimientos', ['SKU','Descripción','Lote','Qty','Vencimiento','Días','Estado','Bodega'], rows, 'Alerta 90 días — NT 147 / NT 208');
}

function showRptMovFiltros() {
    document.getElementById('rptMovFiltros').style.display = 'block';
    rptMovimientos();
}

function clearRptMovFiltros() {
    ['rptFMovSKU','rptFMovLote'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    document.getElementById('rptFMovTipo').value = '';
    rptMovimientos();
}

function rptMovimientos() {
    const fSKU  = (document.getElementById('rptFMovSKU')?.value||'').trim().toLowerCase();
    const fLote = (document.getElementById('rptFMovLote')?.value||'').trim().toLowerCase();
    const fTipo = (document.getElementById('rptFMovTipo')?.value||'');

    let movs = Object.values(data.movimientos||{});
    if (fSKU)  movs = movs.filter(m => (m.sku||'').toLowerCase().includes(fSKU));
    if (fLote) movs = movs.filter(m => (m.lote||'').toLowerCase().includes(fLote));
    if (fTipo) movs = movs.filter(m => m.tipo === fTipo);

    movs.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    const subtitle = [
        'Trazabilidad completa — NT 147',
        fSKU  ? `SKU: ${fSKU.toUpperCase()}` : '',
        fLote ? `Lote: ${fLote.toUpperCase()}` : '',
        fTipo ? `Tipo: ${fTipo}` : ''
    ].filter(Boolean).join(' · ');

    const rows = movs.map(m => [fmtDate(m.fecha), m.tipo, m.sku, m.descripcion||'—', m.lote||'—', m.cantidad, m.bodega||'—', m.proveedor||'—', m.referencia||'—', m.status||'—', m.usuario||'—']);
    rptTable('Reporte de Movimientos', ['Fecha','Tipo','SKU','Descripción','Lote','Qty','Bodega','Prov/Cliente','Referencia','Status','Usuario'], rows, subtitle);
}

function rptCuarentena() {
    const rows = Object.values(data.cuarentena||{}).sort((a,b) => new Date(b.fechaIngreso)-new Date(a.fechaIngreso))
        .map(q => [fmtDate(q.fechaIngreso), q.sku, q.descripcion||'—', q.lote, q.cantidad, q.motivo, q.responsable||'—', q.status]);
    rptTable('Reporte de Cuarentena', ['Fecha ingreso','SKU','Descripción','Lote','Qty','Motivo','Responsable','Status'], rows, 'Gestión QA — NT 147');
}

// ══ AUDITORÍA ══
function renderAuditoria() {
    db.ref(`usuarios/${currentUser.uid}/auditoria`).orderByChild('fecha').limitToLast(200).once('value', s => {
        const rows = [];
        s.forEach(c => rows.unshift(c.val()));
        const tb = document.getElementById('tAuditoria');
        if (!rows.length) { tb.innerHTML = '<tr class="empty-row"><td colspan="7">Sin registros</td></tr>'; return; }
        tb.innerHTML = rows.map(r => `<tr>
            <td class="text-mono" style="font-size:11px">${fmtDateTime(r.fecha)}</td>
            <td><span class="badge badge-blue" style="font-size:10px">${r.accion}</span></td>
            <td style="font-size:11px;color:var(--text3)">${r.modulo}</td>
            <td class="text-mono" style="color:var(--accent2);font-size:11px">${r.sku||'—'}</td>
            <td class="text-mono" style="font-size:11px">${r.lote||'—'}</td>
            <td style="font-size:12px">${r.detalle||'—'}</td>
            <td style="font-size:11px;color:var(--text3)">${r.usuario||'—'}</td>
        </tr>`).join('');
    });
}

// ══ SKU AUTOCOMPLETE ══
function skuAutocomplete(input, dropdownId, infoId) {
    const val = input.value.trim().toUpperCase();
    const dropdown = document.getElementById(dropdownId);
    if (!val) { dropdown.style.display = 'none'; if(infoId){ const i=document.getElementById(infoId); if(i) i.textContent=''; } return; }

    const matches = Object.values(data.productos||{}).filter(p =>
        p.sku.includes(val) ||
        (p.descripcion||'').toUpperCase().includes(val) ||
        (p.principioActivo||'').toUpperCase().includes(val) ||
        (p.fabricante||'').toUpperCase().includes(val)
    ).slice(0, 10);

    if (!matches.length) {
        dropdown.innerHTML = '<div class="sku-dropdown-empty">No se encontraron productos con ese criterio</div>';
        dropdown.style.display = 'block';
        return;
    }
    dropdown.innerHTML = matches.map(p => `
        <div class="sku-dropdown-item" onmousedown="selectSKUInto('${p.sku}','${input.id}','${dropdownId}','${infoId||''}')">
            <div class="sku-dropdown-sku">${p.sku}</div>
            <div class="sku-dropdown-desc">${p.descripcion||''}</div>
            <div class="sku-dropdown-meta">${p.tipo||''} · ${p.fabricante||''}${p.registroSanitario ? ' · RS: '+p.registroSanitario : ''}${p.proveedor ? ' · '+p.proveedor : ''}</div>
        </div>`).join('');
    dropdown.style.display = 'block';
}

function hideDropdown(dropdownId) {
    const d = document.getElementById(dropdownId); if(d) d.style.display='none';
}

function selectSKUInto(sku, inputId, dropdownId, infoId) {
    const input = document.getElementById(inputId);
    if (input) input.value = sku;
    hideDropdown(dropdownId);
    // Fill info label for secondary modals
    if (infoId) {
        const prod = data.productos[sku];
        const info = document.getElementById(infoId);
        if (info && prod) info.innerHTML = `<span style="color:var(--accent2);font-weight:600">${prod.descripcion}</span> · ${prod.fabricante||''}${prod.registroSanitario?' · RS: '+prod.registroSanitario:''}`;
    }
    // Multi-product document modal SKU field
    if (inputId === 'mi-sku') {
        onMiSKUChange();
    }
}

// ══ FORM ERRORS ══
function showFormError(bannerId, msg) {
    const el = document.getElementById(bannerId);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => { el.style.display = 'none'; }, 6000);
}

// ══ CONFIRM DIALOG ══
let _confirmCb = null;
function showConfirm(title, subtitle, bodyHtml, btnLabel, btnCls, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmSubtitle').textContent = subtitle || '';
    document.getElementById('confirmBody').innerHTML = bodyHtml;
    const btn = document.getElementById('confirmBtn');
    btn.textContent = btnLabel || 'Confirmar';
    btn.className = `btn ${btnCls||'btn-primary'}`;
    _confirmCb = callback;
    btn.onclick = () => { closeModal('confirmModal'); if(_confirmCb) _confirmCb(); };
    openModal('confirmModal');
}

// ══ PRINT REPORT ══
function printReport() {
    const rpt = document.getElementById('rptContainer');
    if (!rpt || !rpt.innerHTML.trim()) { alert('Primero genere un reporte.'); return; }
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte Celmedik WMS</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#111}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#1a2a4a;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
    td{padding:6px 10px;border-bottom:1px solid #ddd}tr:nth-child(even){background:#f5f7fa}
    h2{color:#1a2a4a}.subtitle{color:#555;font-size:11px;margin-top:3px}
    .badge{padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600}
    .footer{margin-top:20px;font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:8px}
    @media print{.no-print{display:none}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div><strong style="font-size:16px;color:#1a2a4a">Celmedik WMS</strong><br><span style="color:#555;font-size:11px">Sistema de Gestión de Almacén Farmacéutico · NT 147 BPA</span></div>
        <div style="text-align:right;font-size:11px;color:#555">Generado: ${new Date().toLocaleString('es-CL')}<br>Usuario: ${currentUser?.email||'—'}</div>
    </div>
    ${rpt.innerHTML}
    <div class="footer">Documento generado por Celmedik WMS · Norma Técnica N°147 ISP Chile · ${new Date().toLocaleDateString('es-CL')}</div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
    w.document.close();
}

// ══ MODAL HELPERS ══
function openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add('active'); if (id === 'movModal') { resetMovModal(); updateBodegaSelect(); } }
}

function closeModal(id) {
    const m = document.getElementById(id); if (m) m.classList.remove('active');
    if (id === 'productModal') {
        ['p-sku','p-rs','p-desc','p-fab','p-proveedor','p-tipo','p-pres','p-udv','p-principio'].forEach(i => { const el = document.getElementById(i); if(el) { el.value=''; el.disabled=false; } });
        document.getElementById('p-min').value = '0';
    }
}

function resetMovModal() {
    movDocItems = [];
    ['md-tipo','md-numdoc','md-proveedor','md-obs'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const fechaEl = document.getElementById('md-fecha');
    if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];
    const bodegaEl = document.getElementById('md-bodega'); if (bodegaEl) bodegaEl.value = '';
    const ubicWrap = document.getElementById('md-ubic-wrap');
    if (ubicWrap) ubicWrap.innerHTML = '<input type="text" class="form-input" id="md-ubic" placeholder="Ej: Estante A-3">';
    const errEl = document.getElementById('movModal-err'); if (errEl) errEl.style.display = 'none';
    resetItemForm();
    _refreshMiStatusField(document.getElementById('md-tipo').value || 'Entrada');
    renderDocItems();
}

// Cerrar modal al click fondo
document.addEventListener('click', e => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); });

// ══ DASHBOARD COMERCIAL ══
let _dcCharts = {};

function _dcDestroy(id) { if (_dcCharts[id]) { _dcCharts[id].destroy(); delete _dcCharts[id]; } }

function getDCRango() {
    const periodo = document.getElementById('dcPeriodo')?.value || 'mes';
    const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    let desdeDate, hastaDate = new Date(hoy), desdeAnt, hastaAnt;

    if (periodo === 'hoy') {
        desdeDate = new Date(start);
        desdeAnt = new Date(start); desdeAnt.setDate(desdeAnt.getDate() - 1);
        hastaAnt = new Date(desdeAnt); hastaAnt.setHours(23, 59, 59, 999);
    } else if (periodo === 'semana') {
        desdeDate = new Date(start);
        const dow = start.getDay() === 0 ? 6 : start.getDay() - 1;
        desdeDate.setDate(desdeDate.getDate() - dow);
        const nDias = Math.round((hastaDate - desdeDate) / 86400000);
        desdeAnt = new Date(desdeDate); desdeAnt.setDate(desdeAnt.getDate() - nDias - 1);
        hastaAnt = new Date(desdeDate); hastaAnt.setDate(hastaAnt.getDate() - 1); hastaAnt.setHours(23, 59, 59, 999);
    } else if (periodo === 'mes') {
        desdeDate = new Date(start.getFullYear(), start.getMonth(), 1);
        desdeAnt = new Date(start.getFullYear(), start.getMonth() - 1, 1);
        hastaAnt = new Date(start.getFullYear(), start.getMonth(), 0); hastaAnt.setHours(23, 59, 59, 999);
    } else if (periodo === 'año') {
        desdeDate = new Date(start.getFullYear(), 0, 1);
        desdeAnt = new Date(start.getFullYear() - 1, 0, 1);
        hastaAnt = new Date(start.getFullYear() - 1, 11, 31); hastaAnt.setHours(23, 59, 59, 999);
    } else {
        const dv = document.getElementById('dcDesde')?.value;
        const hv = document.getElementById('dcHasta')?.value;
        desdeDate = dv ? new Date(dv + 'T00:00:00') : new Date(start.getFullYear(), 0, 1);
        hastaDate = hv ? new Date(hv + 'T23:59:59') : new Date(hoy);
        const diff = hastaDate - desdeDate;
        hastaAnt = new Date(desdeDate.getTime() - 1); hastaAnt.setHours(23, 59, 59, 999);
        desdeAnt = new Date(hastaAnt.getTime() - diff);
    }
    return { desdeDate, hastaDate, desdeAnt, hastaAnt };
}

function getDCSalidas(desde, hasta) {
    return Object.values(data.movimientos || {}).filter(m => {
        if (m.tipo !== 'Salida') return false;
        const f = new Date(m.fecha);
        return f >= desde && f <= hasta;
    });
}

function dcVarHTML(val, ant) {
    if (!ant) return '';
    const pct = Math.round(((val - ant) / ant) * 100);
    const up = pct >= 0;
    return `<div class="dc-kpi-var"><span class="dc-var-${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(pct)}%</span><span class="dc-var-label"> vs per. ant.</span></div>`;
}

function renderDCKPIs(salidas, salidasAnt) {
    const totalMovs   = salidas.length;
    const totalUnid   = salidas.reduce((a, m) => a + (parseInt(m.cantidad) || 0), 0);
    const totalProds  = new Set(salidas.map(m => m.sku)).size;
    const totalCl     = new Set(salidas.filter(m => m.proveedor?.trim()).map(m => m.proveedor.trim().toUpperCase())).size;
    const antMovs     = salidasAnt.length;
    const antUnid     = salidasAnt.reduce((a, m) => a + (parseInt(m.cantidad) || 0), 0);
    const antProds    = new Set(salidasAnt.map(m => m.sku)).size;
    const antCl       = new Set(salidasAnt.filter(m => m.proveedor?.trim()).map(m => m.proveedor.trim().toUpperCase())).size;

    const setKPI = (id, val, ant, icon, label, bg, color) => {
        const el = document.getElementById(id); if (!el) return;
        el.innerHTML = `<div class="dc-kpi-icon" style="background:${bg};color:${color}">${icon}</div>
            <div class="dc-kpi-body">
                <div class="dc-kpi-label">${label}</div>
                <div class="dc-kpi-value">${val.toLocaleString('es-CL')}</div>
                ${dcVarHTML(val, ant)}
            </div>`;
    };
    setKPI('dcKpi1', totalMovs,  antMovs,  '↗', 'Despachos realizados',    '#e8f1fd', '#0070F2');
    setKPI('dcKpi2', totalUnid,  antUnid,  '▦', 'Unidades despachadas',    '#e6f4ec', '#107E3E');
    setKPI('dcKpi3', totalProds, antProds, '◈', 'Productos distintos',     '#fdf0e7', '#E9730C');
    setKPI('dcKpi4', totalCl,    antCl,    '✦', 'Clientes atendidos',      '#f0eafa', '#6B2FBE');
}

function _dcAggProds(salidas) {
    const map = {};
    salidas.forEach(m => {
        if (!map[m.sku]) map[m.sku] = { sku: m.sku, unidades: 0, movs: 0, ultimo: '' };
        map[m.sku].unidades += parseInt(m.cantidad) || 0;
        map[m.sku].movs++;
        if (!map[m.sku].ultimo || m.fecha > map[m.sku].ultimo) map[m.sku].ultimo = m.fecha;
    });
    return Object.values(map);
}

function renderDCProductos(salidas) {
    const top  = parseInt(document.getElementById('dcTopProds')?.value || 10);
    const prods = data.productos || {};
    const rows = _dcAggProds(salidas).sort((a, b) => b.unidades - a.unidades).slice(0, top);

    const tb = document.getElementById('dcTbProductos');
    if (tb) {
        tb.innerHTML = !rows.length
            ? '<tr class="empty-row"><td colspan="7">Sin salidas en el período</td></tr>'
            : rows.map((r, i) => `<tr>
                <td style="font-weight:700;color:var(--accent2);text-align:center">${i + 1}</td>
                <td class="text-mono" style="color:var(--accent2)">${r.sku}</td>
                <td>${prods[r.sku]?.descripcion || '—'}</td>
                <td style="font-size:11px;color:var(--text3)">${prods[r.sku]?.principioActivo || '—'}</td>
                <td style="font-weight:700;text-align:right">${r.unidades.toLocaleString('es-CL')}</td>
                <td style="text-align:center">${r.movs}</td>
                <td style="font-size:11px">${fmtDate(r.ultimo)}</td>
              </tr>`).join('');
    }

    _dcDestroy('chartProds');
    const ctx = document.getElementById('dcChartProds')?.getContext('2d');
    if (!ctx || !rows.length) return;
    const palette = rows.map((_, i) => `hsla(${210 + i * 9},75%,52%,0.85)`);
    _dcCharts['chartProds'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: rows.map(r => r.sku),
            datasets: [{ label: 'Unidades', data: rows.map(r => r.unidades), backgroundColor: palette, borderRadius: 4, borderSkipped: false }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: {
                    title: ctx => { const r = rows[ctx[0].dataIndex]; return `${r.sku} — ${prods[r.sku]?.descripcion || ''}`; },
                    label: ctx => ` ${ctx.raw.toLocaleString('es-CL')} unidades`,
                    afterLabel: ctx => ` ${rows[ctx.dataIndex].movs} movimiento(s)`
                }}
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } }, beginAtZero: true }
            }
        }
    });
}

function _dcAggClients(salidas) {
    const map = {};
    salidas.forEach(m => {
        const cl = (m.proveedor || '').trim().toUpperCase() || '(Sin cliente)';
        if (!map[cl]) map[cl] = { cliente: cl, unidades: 0, despachos: 0, prods: new Set(), ultimo: '' };
        map[cl].unidades += parseInt(m.cantidad) || 0;
        map[cl].despachos++;
        map[cl].prods.add(m.sku);
        if (!map[cl].ultimo || m.fecha > map[cl].ultimo) map[cl].ultimo = m.fecha;
    });
    return Object.values(map);
}

function renderDCClientes(salidas) {
    const top  = parseInt(document.getElementById('dcTopClients')?.value || 10);
    const rows = _dcAggClients(salidas).sort((a, b) => b.unidades - a.unidades).slice(0, top);

    const tb = document.getElementById('dcTbClientes');
    if (tb) {
        tb.innerHTML = !rows.length
            ? '<tr class="empty-row"><td colspan="6">Sin salidas en el período</td></tr>'
            : rows.map((r, i) => `<tr>
                <td style="font-weight:700;color:var(--accent2);text-align:center">${i + 1}</td>
                <td style="font-weight:500">${r.cliente}</td>
                <td style="font-weight:700;text-align:right">${r.unidades.toLocaleString('es-CL')}</td>
                <td style="text-align:center">${r.despachos}</td>
                <td style="text-align:center">${r.prods.size}</td>
                <td style="font-size:11px">${fmtDate(r.ultimo)}</td>
              </tr>`).join('');
    }

    _dcDestroy('chartClients');
    const ctx = document.getElementById('dcChartClients')?.getContext('2d');
    if (!ctx || !rows.length) return;
    const palette = rows.map((_, i) => `hsla(${148 + i * 8},62%,45%,0.85)`);
    _dcCharts['chartClients'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: rows.map(r => r.cliente.length > 18 ? r.cliente.slice(0, 18) + '…' : r.cliente),
            datasets: [{ label: 'Unidades', data: rows.map(r => r.unidades), backgroundColor: palette, borderRadius: 4, borderSkipped: false }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: {
                    title: ctx => rows[ctx[0].dataIndex].cliente,
                    label: ctx => ` ${ctx.raw.toLocaleString('es-CL')} unidades`,
                    afterLabel: ctx => ` ${rows[ctx.dataIndex].despachos} despacho(s)`
                }}
            },
            scales: {
                x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } }, beginAtZero: true },
                y: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

function renderDCEvolucion(salidas, desdeDate, hastaDate) {
    const agrup = document.getElementById('dcAgrupacion')?.value || 'dia';
    const map = {};

    if (agrup === 'dia') {
        const d = new Date(desdeDate); d.setHours(0, 0, 0, 0);
        const fin = new Date(hastaDate); fin.setHours(0, 0, 0, 0);
        while (d <= fin) { map[d.toISOString().slice(0, 10)] = 0; d.setDate(d.getDate() + 1); }
        salidas.forEach(m => { const k = m.fecha.slice(0, 10); if (k in map) map[k] += parseInt(m.cantidad) || 0; });
    } else {
        const d = new Date(desdeDate.getFullYear(), desdeDate.getMonth(), 1);
        const fin = new Date(hastaDate.getFullYear(), hastaDate.getMonth() + 1, 0);
        while (d <= fin) {
            map[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
            d.setMonth(d.getMonth() + 1);
        }
        salidas.forEach(m => { const k = m.fecha.slice(0, 7); if (k in map) map[k] += parseInt(m.cantidad) || 0; });
    }

    const labels = Object.keys(map).sort();
    const values = labels.map(k => map[k]);
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const fmt = l => agrup === 'dia'
        ? `${l.slice(8)}/${l.slice(5, 7)}`
        : `${meses[parseInt(l.slice(5, 7)) - 1]} ${l.slice(0, 4)}`;

    const subtitleEl = document.getElementById('dcEvolSubtitle');
    if (subtitleEl) subtitleEl.textContent = `Total: ${values.reduce((a,v)=>a+v,0).toLocaleString('es-CL')} unidades — ${agrup === 'dia' ? 'vista diaria' : 'vista mensual'}`;

    _dcDestroy('chartEvol');
    const ctx = document.getElementById('dcChartEvol')?.getContext('2d');
    if (!ctx) return;
    const useBar = labels.length > 60;
    _dcCharts['chartEvol'] = new Chart(ctx, {
        type: useBar ? 'bar' : 'line',
        data: {
            labels: labels.map(fmt),
            datasets: [{
                label: 'Unidades despachadas',
                data: values,
                borderColor: '#0070F2',
                backgroundColor: useBar ? 'rgba(0,112,242,0.75)' : 'rgba(0,112,242,0.08)',
                fill: !useBar,
                tension: 0.35,
                pointRadius: labels.length > 45 ? 0 : 3,
                pointHoverRadius: 5,
                borderWidth: 2,
                borderRadius: useBar ? 3 : 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${ctx.raw.toLocaleString('es-CL')} unidades` } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, maxTicksLimit: 30 } },
                y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } }, beginAtZero: true }
            }
        }
    });
}

function renderDCAlertas() {
    const dias = parseInt(document.getElementById('dcAlertDias')?.value || 30);
    const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
    const stock = calcStock();
    const prods = data.productos || {};
    const movs  = Object.values(data.movimientos || {});

    // 1. Sin rotación
    const sinRotacion = Object.keys(prods).map(sku => {
        const ultSalida = movs.filter(m => m.tipo === 'Salida' && m.sku === sku)
            .reduce((max, m) => m.fecha > max ? m.fecha : max, '');
        const diasSin = ultSalida ? Math.ceil((hoy - new Date(ultSalida)) / 86400000) : null;
        return { sku, diasSin, ultimo: ultSalida };
    }).filter(r => r.diasSin === null || r.diasSin >= dias)
      .sort((a, b) => (b.diasSin ?? 99999) - (a.diasSin ?? 99999));

    // 2. Stock bajo mínimo
    const bajoMin = Object.values(prods).filter(p => {
        if (!p.stockMin || p.stockMin <= 0) return false;
        return Object.values(stock).filter(s => s.sku === p.sku && s.cantidad > 0).reduce((a, s) => a + s.cantidad, 0) < p.stockMin;
    });

    // 3. Próximos a vencer (≤ 90d)
    const proxVencer = Object.values(stock)
        .filter(s => s.vence && s.cantidad > 0)
        .map(s => ({ ...s, dias: Math.ceil((new Date(s.vence + 'T00:00:00') - hoy) / 86400000) }))
        .filter(s => s.dias <= 90)
        .sort((a, b) => a.dias - b.dias);

    const c = document.getElementById('dcAlertasContainer'); if (!c) return;
    let html = '';

    if (sinRotacion.length) {
        html += `<div class="card" style="margin:0 0 12px;border:1px solid var(--border)">
            <div class="card-header"><div class="card-title" style="font-size:12px;color:var(--warning)">⚠ Sin rotación ≥ ${dias} días — ${sinRotacion.length} producto(s)</div></div>
            <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Descripción</th><th>Días sin salida</th><th>Último despacho</th></tr></thead><tbody>
            ${sinRotacion.slice(0, 25).map(r => `<tr>
                <td class="text-mono" style="color:var(--accent2)">${r.sku}</td>
                <td>${prods[r.sku]?.descripcion || '—'}</td>
                <td><span class="badge badge-warning">${r.diasSin === null ? 'Sin despachos' : r.diasSin + 'd'}</span></td>
                <td style="font-size:11px">${r.ultimo ? fmtDate(r.ultimo) : '—'}</td>
            </tr>`).join('')}
            </tbody></table></div></div>`;
    }

    if (bajoMin.length) {
        html += `<div class="card" style="margin:0 0 12px;border:1px solid var(--border)">
            <div class="card-header"><div class="card-title" style="font-size:12px;color:var(--danger)">▼ Stock bajo mínimo — ${bajoMin.length} producto(s)</div></div>
            <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Descripción</th><th style="text-align:center">Stock actual</th><th style="text-align:center">Mínimo</th></tr></thead><tbody>
            ${bajoMin.map(p => {
                const total = Object.values(stock).filter(s => s.sku === p.sku && s.cantidad > 0).reduce((a, s) => a + s.cantidad, 0);
                return `<tr>
                    <td class="text-mono" style="color:var(--accent2)">${p.sku}</td>
                    <td>${p.descripcion}</td>
                    <td style="text-align:center"><span class="badge badge-danger">${total}</span></td>
                    <td style="text-align:center;color:var(--text2)">${p.stockMin}</td>
                </tr>`;
            }).join('')}
            </tbody></table></div></div>`;
    }

    if (proxVencer.length) {
        html += `<div class="card" style="margin:0 0 4px;border:1px solid var(--border)">
            <div class="card-header"><div class="card-title" style="font-size:12px;color:var(--danger)">⏱ Próximos a vencer (≤ 90 días) — ${proxVencer.length} lote(s)</div></div>
            <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Descripción</th><th>Lote</th><th>Vencimiento</th><th style="text-align:center">Días</th><th style="text-align:center">Stock</th></tr></thead><tbody>
            ${proxVencer.map(s => {
                const cls = s.dias < 0 ? 'badge-danger' : s.dias <= 30 ? 'badge-danger' : 'badge-warning';
                return `<tr>
                    <td class="text-mono" style="color:var(--accent2)">${s.sku}</td>
                    <td>${prods[s.sku]?.descripcion || '—'}</td>
                    <td class="text-mono" style="font-size:11px">${s.lote}</td>
                    <td>${fmtDate(s.vence)}</td>
                    <td style="text-align:center"><span class="badge ${cls}">${s.dias < 0 ? 'VENCIDO' : s.dias + 'd'}</span></td>
                    <td style="text-align:center;font-weight:600">${s.cantidad}</td>
                </tr>`;
            }).join('')}
            </tbody></table></div></div>`;
    }

    if (!html) html = '<div class="alert-banner success" style="margin:8px 0"><div class="alert-banner-icon">✓</div><div><div class="alert-banner-title">Sin alertas comerciales activas</div><div class="alert-banner-text">Todos los productos tienen movimiento reciente y parámetros dentro de rango.</div></div></div>';
    c.innerHTML = html;
}

function renderDashComercial() {
    const { desdeDate, hastaDate, desdeAnt, hastaAnt } = getDCRango();
    const salidas    = getDCSalidas(desdeDate, hastaDate);
    const salidasAnt = getDCSalidas(desdeAnt, hastaAnt);

    renderDCKPIs(salidas, salidasAnt);
    renderDCProductos(salidas);
    renderDCClientes(salidas);
    renderDCEvolucion(salidas, desdeDate, hastaDate);
    renderDCAlertas();

    const lbl = document.getElementById('dcPeriodoLabel');
    if (lbl) lbl.textContent = `${desdeDate.toLocaleDateString('es-CL')} — ${hastaDate.toLocaleDateString('es-CL')}`;
}

function dcOnPeriodoChange() {
    const custom = document.getElementById('dcPeriodo').value === 'custom';
    document.getElementById('dcRangoCustom').style.display = custom ? 'flex' : 'none';
    renderDashComercial();
}
function dcRefreshProds()   { const { desdeDate, hastaDate } = getDCRango(); renderDCProductos(getDCSalidas(desdeDate, hastaDate)); }
function dcRefreshClients() { const { desdeDate, hastaDate } = getDCRango(); renderDCClientes(getDCSalidas(desdeDate, hastaDate)); }
function dcRefreshEvol()    { const { desdeDate, hastaDate } = getDCRango(); renderDCEvolucion(getDCSalidas(desdeDate, hastaDate), desdeDate, hastaDate); }

function exportDCTableCSV(type) {
    const { desdeDate, hastaDate } = getDCRango();
    const salidas = getDCSalidas(desdeDate, hastaDate);
    const prods   = data.productos || {};
    let headers, rows;

    if (type === 'productos') {
        const top  = parseInt(document.getElementById('dcTopProds')?.value || 10);
        const data_rows = _dcAggProds(salidas).sort((a, b) => b.unidades - a.unidades).slice(0, top);
        headers = ['Ranking','SKU','Nombre','Principio Activo','Total Unidades','Movimientos','Último Despacho'];
        rows = data_rows.map((r, i) => [i+1, r.sku, prods[r.sku]?.descripcion||'', prods[r.sku]?.principioActivo||'', r.unidades, r.movs, r.ultimo ? fmtDate(r.ultimo) : '']);
    } else {
        const top  = parseInt(document.getElementById('dcTopClients')?.value || 10);
        const data_rows = _dcAggClients(salidas).sort((a, b) => b.unidades - a.unidades).slice(0, top);
        headers = ['Ranking','Cliente','Total Unidades','Despachos','Productos Distintos','Último Despacho'];
        rows = data_rows.map((r, i) => [i+1, r.cliente, r.unidades, r.despachos, r.prods.size, r.ultimo ? fmtDate(r.ultimo) : '']);
    }

    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `celmedik_${type}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

async function exportDCPDF() {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('Librerías PDF no disponibles. Verifique su conexión a internet.'); return;
    }
    const { jsPDF } = window.jspdf;
    const { desdeDate, hastaDate } = getDCRango();
    const el = document.getElementById('dcContent');
    if (!el) return;

    const btn = document.querySelector('[onclick="exportDCPDF()"]');
    if (btn) { btn.textContent = '⏳ Generando…'; btn.disabled = true; }

    try {
        const canvas = await html2canvas(el, { scale: 1.4, useCORS: true, backgroundColor: '#F5F5F5', logging: false });
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 14;

        doc.setFillColor(29, 45, 62);
        doc.rect(0, 0, pageW, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('Celmedik WMS — Dashboard Comercial', margin, 11);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text(`Período: ${desdeDate.toLocaleDateString('es-CL')} — ${hastaDate.toLocaleDateString('es-CL')}  ·  Generado: ${new Date().toLocaleString('es-CL')}  ·  Usuario: ${currentUser?.email||'—'}`, margin, 19);

        const imgW  = pageW - margin * 2;
        const ratio = imgW / canvas.width;
        const fullH = canvas.height * ratio;
        let srcY = 0, pageNum = 1, yOffset = 28;

        while (srcY < canvas.height) {
            const availH  = pageH - yOffset - 12;
            const slicePx = Math.min(availH / ratio, canvas.height - srcY);
            const tmp = document.createElement('canvas');
            tmp.width = canvas.width; tmp.height = slicePx;
            tmp.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
            doc.addImage(tmp.toDataURL('image/png'), 'PNG', margin, yOffset, imgW, slicePx * ratio);
            srcY += slicePx;
            if (srcY < canvas.height) { doc.addPage(); yOffset = 12; pageNum++; }
        }

        const total = doc.internal.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
            doc.setPage(i);
            doc.setFontSize(7); doc.setTextColor(150, 150, 150);
            doc.text(`Celmedik WMS · Dashboard Comercial · Normativa ISP Chile  —  Página ${i} de ${total}`, pageW / 2, pageH - 5, { align: 'center' });
        }
        doc.save(`dashboard_comercial_${new Date().toISOString().slice(0,10)}.pdf`);
    } finally {
        if (btn) { btn.textContent = '↓ Exportar PDF'; btn.disabled = false; }
    }
}

// ══ UTILS ══
function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' }) + ' ' + d.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
}
