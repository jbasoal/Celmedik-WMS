// Importa el archivo "Maestro Clientes.xlsx" a Firebase RTDB
//
// Uso:
//   node import-clientes.js
//
// Requisitos:
//   - node_modules/firebase-admin (ya instalado)
//   - node_modules/xlsx (instalar con: npm install xlsx --no-save)
//   - Service account JSON en la ruta indicada en SERVICE_ACCOUNT
//
// Comportamiento:
//   - Un documento por RUT (agrupa múltiples filas del Excel con el mismo RUT)
//   - Toma el primer nombre encontrado para cada RUT (si hay divergencias, se
//     imprime advertencia y prevalece el primero para no borrar datos manuales
//     que el usuario pudo haber corregido después)
//   - Convierte la vigencia (serial Excel o texto) a "dd-mm-aaaa" o mantiene el texto
//   - Modo por defecto: MERGE — no sobrescribe destinos ya cargados manualmente.
//     Si un cliente ya existe, sólo se agregan destinos nuevos (comparando por
//     dirección+comuna normalizadas). Cambiar OVERWRITE=true al inicio del script
//     para reescribir completamente cada cliente desde el Excel.

const path = require('path');
const admin = require('./node_modules/firebase-admin');
const XLSX  = require('./node_modules/xlsx');

const SERVICE_ACCOUNT = 'C:/Users/DT BIODIAL/Downloads/celmedik-inventario-firebase-adminsdk-fbsvc-d28e408090.json';
const DATABASE_URL    = 'https://celmedik-inventario-default-rtdb.firebaseio.com';
const UID_MAESTRO     = 'XxnrZJwsPpgKYtNWO78BAyoUyWM2'; // dueño de los datos
const EXCEL_PATH      = path.join(__dirname, 'Maestro Clientes.xlsx');
const OVERWRITE       = false; // true = reescribir cada cliente completo; false = merge por destino

// ── Helpers ───────────────────────────────────────────────────────────────────
function rutKey(rut) {
    return String(rut||'').replace(/[.\s]/g,'').replace(/-/g,'').toUpperCase();
}
function formatRut(rut) {
    const raw = rutKey(rut);
    if (raw.length < 2) return String(rut||'').trim();
    const dv = raw.slice(-1);
    let num = raw.slice(0, -1);
    let out = '';
    while (num.length > 3) { out = '.' + num.slice(-3) + out; num = num.slice(0,-3); }
    out = num + out;
    return `${out}-${dv}`;
}
function isRutValido(rut) {
    const raw = rutKey(rut);
    if (raw.length < 2) return false;
    const dv = raw.slice(-1);
    const num = raw.slice(0, -1);
    if (!/^\d+$/.test(num)) return false;
    let s = 0, m = 2;
    for (let i = num.length - 1; i >= 0; i--) { s += parseInt(num[i],10) * m; m = m === 7 ? 2 : m + 1; }
    const r = 11 - (s % 11);
    const dvCalc = r === 11 ? '0' : (r === 10 ? 'K' : String(r));
    return dvCalc === dv;
}
function fmtVigencia(v) {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(s)) return s;
    if (/^\d+(\.\d+)?$/.test(s)) {
        const n = parseFloat(s);
        const ms = Math.round((n - 25569) * 86400 * 1000);
        const d = new Date(ms);
        if (!isNaN(d)) {
            const dd = String(d.getUTCDate()).padStart(2,'0');
            const mm = String(d.getUTCMonth()+1).padStart(2,'0');
            const yy = d.getUTCFullYear();
            return `${dd}-${mm}-${yy}`;
        }
    }
    return s;
}
function normDest(direccion, comuna) {
    return (String(direccion||'').trim().toLowerCase() + '|' + String(comuna||'').trim().toLowerCase()).replace(/\s+/g,' ');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('→ Leyendo Excel:', EXCEL_PATH);
    const wb = XLSX.readFile(EXCEL_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rows.length) { console.error('Excel vacío.'); process.exit(1); }
    const [head, ...body] = rows;
    console.log('  Encabezados:', head);
    console.log('  Filas de datos:', body.length);

    // Agrupar por RUT
    const grouped = new Map();
    const warnNombres = [];
    let invalidos = 0;
    body.forEach((r, i) => {
        const rut = String(r[0]||'').trim();
        if (!rut) return;
        if (!isRutValido(rut)) { invalidos++; console.warn(`  ⚠ Fila ${i+2}: RUT ${rut} no valida DV — se importa igual.`); }
        const nombre = String(r[1]||'').trim();
        const direccion  = String(r[2]||'').trim();
        const comuna     = String(r[3]||'').trim();
        const registro   = String(r[4]||'').trim();
        const resolucion = String(r[5]||'').trim();
        const vigencia   = fmtVigencia(r[6]);
        const referencia = String(r[7]||'').trim();
        const key = rutKey(rut);
        if (!grouped.has(key)) grouped.set(key, { rutFmt: formatRut(rut), nombre, destinos: [] });
        else if (grouped.get(key).nombre !== nombre && nombre) {
            warnNombres.push({ rut: formatRut(rut), original: grouped.get(key).nombre, otro: nombre });
        }
        // sólo agrega el destino si tiene al menos algo
        if (direccion || comuna || registro || resolucion || vigencia || referencia) {
            grouped.get(key).destinos.push({ direccion, comuna, registro, resolucion, vigencia, referencia });
        }
    });
    console.log(`  ✓ Agrupados: ${grouped.size} clientes únicos (RUTs no válidos: ${invalidos}).`);
    if (warnNombres.length) {
        console.log('\n  ⚠ Nombres distintos para el mismo RUT (se conserva el primero):');
        warnNombres.forEach(w => console.log(`    - ${w.rut}: «${w.original}» ≠ «${w.otro}»`));
    }

    // Inicializar Firebase Admin
    const serviceAccount = require(SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: DATABASE_URL
    });
    const db = admin.database();

    // Leer clientes existentes
    console.log(`\n→ Leyendo clientes existentes de RTDB (uid ${UID_MAESTRO})...`);
    const snap = await db.ref(`usuarios/${UID_MAESTRO}/clientes`).once('value');
    const existing = snap.val() || {};
    console.log(`  Existentes: ${Object.keys(existing).length} cliente(s).`);

    // Preparar updates
    const updates = {};
    const ahora = new Date().toISOString();
    let creados = 0, actualizados = 0, destinosAgregados = 0, sinCambios = 0;

    for (const [key, g] of grouped) {
        const path = `usuarios/${UID_MAESTRO}/clientes/${key}`;
        const prev = existing[key];

        if (!prev || OVERWRITE) {
            // Crear (o sobrescribir completo)
            const destinos = {};
            g.destinos.forEach((d, i) => {
                const id = `d${Date.now()}${key.slice(-4)}${i}`;
                const obj = {};
                if (d.direccion)  obj.direccion  = d.direccion;
                if (d.comuna)     obj.comuna     = d.comuna;
                if (d.registro)   obj.registroISP = d.registro;
                if (d.resolucion) obj.resolucionSanitaria = d.resolucion;
                if (d.vigencia)   obj.vigencia   = d.vigencia;
                if (d.referencia) obj.referencia = d.referencia;
                if (Object.keys(obj).length) destinos[id] = obj;
            });
            updates[path] = { rut: g.rutFmt, nombre: g.nombre, fecha: ahora, destinos };
            if (prev) actualizados++; else creados++;
        } else {
            // MERGE — sólo agregar destinos nuevos (comparando por dirección+comuna)
            const prevDests = prev.destinos || {};
            const existentesNorm = new Set(Object.values(prevDests).map(d => normDest(d.direccion, d.comuna)));
            const nuevosDests = {};
            g.destinos.forEach((d, i) => {
                const n = normDest(d.direccion, d.comuna);
                if (existentesNorm.has(n)) return;
                const id = `d${Date.now()}${key.slice(-4)}${i}n`;
                const obj = {};
                if (d.direccion)  obj.direccion  = d.direccion;
                if (d.comuna)     obj.comuna     = d.comuna;
                if (d.registro)   obj.registroISP = d.registro;
                if (d.resolucion) obj.resolucionSanitaria = d.resolucion;
                if (d.vigencia)   obj.vigencia   = d.vigencia;
                if (d.referencia) obj.referencia = d.referencia;
                if (Object.keys(obj).length) nuevosDests[id] = obj;
            });
            const cnt = Object.keys(nuevosDests).length;
            if (cnt) {
                Object.entries(nuevosDests).forEach(([did, d]) => {
                    updates[`${path}/destinos/${did}`] = d;
                });
                destinosAgregados += cnt;
                actualizados++;
            } else {
                sinCambios++;
            }
        }
    }

    console.log('\n→ Resumen a aplicar:');
    console.log(`   Clientes nuevos:          ${creados}`);
    console.log(`   Clientes con actualización: ${actualizados}`);
    console.log(`   Destinos nuevos añadidos: ${destinosAgregados}`);
    console.log(`   Sin cambios:              ${sinCambios}`);
    console.log(`   Writes totales:           ${Object.keys(updates).length}`);
    if (!Object.keys(updates).length) {
        console.log('\n✓ Nada que actualizar.');
        process.exit(0);
    }
    console.log('\n→ Escribiendo en RTDB...');
    await db.ref().update(updates);
    console.log('✓ Importación completada.');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
