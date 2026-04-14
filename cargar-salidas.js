const admin = require('./node_modules/firebase-admin');
const serviceAccount = require('C:/Users/DT BIODIAL/Downloads/celmedik-inventario-firebase-adminsdk-fbsvc-d28e408090.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://celmedik-inventario-default-rtdb.firebaseio.com'
});

const db = admin.database();
const UID = 'XxnrZJwsPpgKYtNWO78BAyoUyWM2';
const USUARIO = 'j.basoalto@grupopharmarket.com';
const BODEGA = 'CELMEDIK BIODIAL';

function parseVence(v) {
  if (!v || v.trim() === '' || v.trim().toUpperCase() === 'N/A') return '';
  const parts = v.trim().split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function parseFechaTs(f, offset) {
  const parts = f.trim().split('-');
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00.000Z`).getTime() + 900000000 + offset;
}

function parseFechaISO(f) {
  const parts = f.trim().split('-');
  return `${parts[2]}-${parts[1]}-${parts[0]}T12:00:00.000Z`;
}

function clean(v) {
  if (!v || v.trim() === '0' || v.trim().toUpperCase() === 'N/A') return '';
  return v.trim();
}

function normUbic(u) {
  if (!u || u.trim() === '') return '';
  if (u.trim().toUpperCase() === 'PISO') return 'PISO';
  return u.trim();
}

// Normaliza tipo: "SALIDA" → "Salida"
function normTipo(t) {
  const s = t.trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Columnas: fecha, tipo, ubic, sku, desc, lote, vence, qty, referencia, cliente
// "Cliente" se almacena en el campo "proveedor" del movimiento (Proveedor/Cliente)
// Aviso: "SAN BERNARDOSAN BERNARDO" corregido a "SAN BERNARDO"
// Aviso: "PUPPENTE ALTO" cargado tal cual (probable typo de "PUENTE ALTO")
// Aviso: "SALIDA" en mayúsculas normalizado a "Salida"

const rows = [
  // fecha        tipo       ubic     sku        lote              vence         qty   referencia   cliente
  ['27-03-2026','Salida',  'C-42',  'KM-001',  'SF0032308',      '01-07-2028', 1000, '5880',      ''],
  ['27-03-2026','Salida',  'C-70',  'TS-001',  '2024102501',     '24-10-2026', 10,   '5858',      'ANSOLMED'],
  ['22-03-2026','Salida',  'C-37',  'SR-001',  '20670-150',      'n/a',        1,    '2017',      'CORP AYUDA DIALIZADO'],
  ['25-03-2026','Salida',  '',      'KM-005',  '20240058',       '30-03-2029', 500,  '5887',      'Centro Medico Valparaiso'],
  ['24-03-2026','Salida',  'C-46',  'AF-004',  '2402100071',     '17-01-2027', 100,  '5835',      'Dialisis aguda Movil'],
  ['27-03-2026','Salida',  'C-40',  'PD-002',  'FS22126',        '30-05-2027', 100,  '5890',      ''],
  ['27-03-2026','Salida',  'C-72',  'KM-007',  '20240064',       '01-09-2029', 1200, 'BIO DIAL',  ''],
  ['30-03-2026','Salida',  'C-39',  'GU-004',  'IN250004303',    '30-04-2030', 2,    'BIO DIAL',  ''],
  ['30-03-2026','Salida',  'C-39',  'FCM-004', 'KO206004811-2',  '28-05-2027', 1,    '5863',      ''],
  ['30-03-2026','Salida',  'C-47',  'SUC-004', '4215106',        '30-04-2026', 8,    '74',        'ÑUÑOA'],
  ['30-03-2026','Salida',  'C-66',  'AF-007',  '241104',         '02-11-2027', 960,  '5861',      'MAGALLANES'],
  ['31-03-2026','Salida',  'C-47',  'SUC-004', '4215105',        '30-04-2026', 2,    '5858',      'TALAGANTE'],
  ['31-03-2026','Salida',  'C-51',  'KO-004',  '20250101',       '31-12-2029', 100,  '5794',      'TALAGANTE'],
  ['31-03-2026','Salida',  'C-56',  'KO-005',  '20250102',       '01-01-2030', 200,  '5794',      'SAN RAMON'],
  ['31-03-2026','Salida',  'C-56',  'KM-005',  '20250172',       '30-08-2030', 100,  '5794',      'SAN RAMON'],
  ['01-04-2026','Salida',  'C-70',  'TS-001',  '2024102501',     '24-10-2026', 2,    '5877',      'SAN BERNARDO'],
  ['01-04-2026','Salida',  'C-57',  'TS-002',  '2024102501',     '24-10-2026', 2,    '5877',      'SAN BERNARDO'],
  ['01-04-2026','Salida',  'C-39',  'GU-004',  'IN250004303',    '30-04-2030', 10,   '5877',      'SAN BERNARDO'],
  ['01-04-2026','Salida',  'C-64',  'JC-001',  '20241221',       '20-12-2029', 3,    '5877',      'SAN BERNARDO'],
  ['01-04-2026','Salida',  'C-67',  'KO-006',  '20250101',       '31-12-2029', 300,  '5877',      'SAN BERNARDO'],
  ['01-04-2026','Salida',  'C-06',  'DAF-003', '25102443',       '23-10-2028', 144,  '5911',      'LOTA'],
  ['01-04-2026','Salida',  'C-04',  'DAF-004', '25102443',       '23-10-2028', 240,  '5911',      'LOTA'],
  ['01-04-2026','Salida',  'C-05',  'DAF-005', '25101643',       '15-10-2028', 144,  '5911',      'LOTA'],
  ['01-04-2026','Salida',  'C-72',  'KM-005',  '20240058',       '30-03-2029', 800,  '5896',      'TALCA'],
  ['01-04-2026','Salida',  'C-06',  'SUC-001', 'V25U011',        '31-07-2027', 37,   '5855',      ''],
  ['01-04-2026','Salida',  'C-42',  'KM-007',  '20240058',       '30-03-2029', 500,  '',          ''],
  ['01-04-2026','Salida',  'C-64',  'T-001',   '250510',         '04-06-2028', 1000, '5858',      'TALAGANTE'],
  ['01-04-2026','Salida',  'C-64',  'JC-001',  '20241221',       '20-12-2029', 10,   '5858',      'TALAGANTE'],
  ['01-04-2026','Salida',  'C-64',  'JC-002',  '20250621',       '12-06-2030', 9,    '5859',      'TALAGANTE'],
  ['02-04-2026','Salida',  'C-21',  'AC-001',  'CT013846B',      '01-03-2027', 4,    '5920',      'TALAGANTE'],
  ['02-04-2026','Salida',  'C-64',  'JC-002',  '20250621',       '12-06-2030', 2,    '5779',      'SAN BERNARDO'],
  ['02-04-2026','Salida',  'C-51',  'KO-004',  '20250101',       '31-12-2029', 100,  '5922',      'ENEAP'],
  ['02-04-2026','Salida',  'C-67',  'KO-006',  '20250101',       '31-12-2029', 100,  '5779',      'SAN BERNARDO'],
  ['02-04-2026','Salida',  'C-67',  'KO-006',  '20250101',       '31-12-2029', 100,  '5858',      'TALAGANTE'],
  ['02-04-2026','Salida',  'C-04',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5855',      'PEUMO'],
  ['02-04-2026','Salida',  'C-20',  'AC-001',  'CTO13847B',      '01-03-2027', 12,   '5929',      'PUPPENTE ALTO'],
  ['02-04-2026','Salida',  'C-48',  'MC-001',  '20250828',       '27-08-2030', 50,   '5929',      ''],
  ['02-04-2026','Salida',  'C-39',  'GU-004',  'IN250004303',    '30-04-2030', 13,   '5929',      ''],
  ['02-04-2026','Salida',  'C-39',  'FCM-003', 'ZIM507014Q64',   '28-06-2030', 9,    '5929',      ''],
  ['02-04-2026','Salida',  'C-39',  'FCM-004', 'KO206004811-2',  '28-05-2027', 3,    '5929',      ''],
  ['02-04-2026','Salida',  'C-64',  'JC-001',  '20241221',       '20-12-2029', 20,   '5929',      ''],
  ['02-04-2026','Salida',  'C-48',  'TS-001',  '2024102501',     '24-10-2026', 15,   '5929',      ''],
  ['06-04-2026','Salida',  'C-20',  'AC-001',  'CTO13847B',      '01-03-2027', 45,   'LOS ANGELES','LOS ANGELES'],
  ['06-04-2026','Salida',  'C-48',  'TS-001',  '2024102501',     '24-10-2026', 2,    '5760',      'SAN BERNARDO'],
  ['06-04-2026','Salida',  'C-01',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5855',      ''],
  ['06-04-2026','Salida',  'C-13',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5871',      ''],
  ['06-04-2026','Salida',  'C-15',  'SUC-001', 'V25U011',        '31-07-2027', 19,   '5871',      ''],
  ['06-04-2026','Salida',  'B-49',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5808',      ''],
  ['06-04-2026','Salida',  'B-50',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5808',      'PISA'],
  ['06-04-2026','Salida',  'B-55',  'SUC-001', 'V25U011',        '31-07-2027', 50,   '5808',      'PISA'],
  ['06-04-2026','Salida',  'B-56',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5808',      'PISA'],
  ['06-04-2026','Salida',  'B-58',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5808',      'PISA'],
  ['06-04-2026','Salida',  'B-59',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5808',      'PISA'],
  ['06-04-2026','Salida',  'B-37',  'SUC-001', 'V25U011',        '31-07-2027', 50,   '5809',      'PISA'],
  ['06-04-2026','Salida',  'B-38',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5809',      'PISA'],
  ['06-04-2026','Salida',  'B-40',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5809',      'PISA'],
  ['06-04-2026','Salida',  'B-41',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5809',      'PISA'],
  ['06-04-2026','Salida',  'B-43',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5809',      'PISA'],
  ['06-04-2026','Salida',  'B-44',  'SUC-001', 'V25U011',        '31-07-2027', 40,   '5809',      'PISA'],
];

async function cargar() {
  // Obtener descripcion del maestro de productos
  const snap = await db.ref(`usuarios/${UID}/productos`).once('value');
  const productos = snap.val() || {};

  const updates = {};

  rows.forEach((r, i) => {
    const [fecha, tipo, ubicRaw, sku, lote, venceRaw, qty, referenciaRaw, clienteRaw] = r;
    const ts = parseFechaTs(fecha, i * 100);
    const prod = productos[sku];

    const mov = {
      tipo:          'Salida',
      sku:           sku.trim(),
      lote:          lote.trim(),
      descripcion:   prod?.descripcion || '',
      cantidad:      qty,
      vence:         parseVence(venceRaw),
      status:        'Aprobado',
      bodega:        BODEGA,
      ubicacion:     normUbic(ubicRaw),
      proveedor:     clean(clienteRaw),
      referencia:    clean(referenciaRaw),
      observaciones: '',
      fecha:         parseFechaISO(fecha),
      usuario:       USUARIO
    };

    updates[`usuarios/${UID}/movimientos/${ts}`] = mov;
  });

  await db.ref().update(updates);
  console.log(`✓ ${rows.length} salidas cargadas correctamente.`);
  console.log('');
  console.log('Avisos aplicados:');
  console.log('  · "SAN BERNARDOSAN BERNARDO" corregido a "SAN BERNARDO"');
  console.log('  · "SALIDA" (mayúsculas, B-56) normalizado a "Salida"');
  console.log('  · Ubicación vacía (KM-005 25-03-2026) cargada sin ubicación');
  console.log('  · Fabricante "0" → campo vacío');
  console.log('  · "PUPPENTE ALTO" cargado tal cual (revisar si es "PUENTE ALTO")');
}

cargar()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
