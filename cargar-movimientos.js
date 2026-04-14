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

// Convierte "DD-MM-YYYY" → "YYYY-MM-DD". Retorna "" si es n/a o vacío.
function parseVence(v) {
  if (!v || v.trim() === '' || v.trim().toUpperCase() === 'N/A') return '';
  const parts = v.trim().split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Convierte "DD-MM-YYYY" a timestamp (milisegundos) para usar como clave Firebase
function parseFechaTs(f, offset) {
  const parts = f.trim().split('-');
  const iso = `${parts[2]}-${parts[1]}-${parts[0]}T12:00:00.000Z`;
  return new Date(iso).getTime() + offset;
}

// Convierte "DD-MM-YYYY" a ISO string completo
function parseFechaISO(f) {
  const parts = f.trim().split('-');
  return `${parts[2]}-${parts[1]}-${parts[0]}T12:00:00.000Z`;
}

// Limpia fabricante/proveedor: "0" o "N/A" → ""
function clean(v) {
  if (!v || v.trim() === '0' || v.trim().toUpperCase() === 'N/A') return '';
  return v.trim();
}

// Normaliza ubicación: "Piso" → "PISO"
function normUbic(u) {
  if (u.trim().toUpperCase() === 'PISO') return 'PISO';
  return u.trim();
}

// ══ DATOS ══
// Columnas: fecha, ubic, sku, desc, lote, vence, qty, proveedor, referencia
// Nota: fabricante proviene del maestro, no se almacena en el movimiento
// OMITIDA: última fila (06-04-2026 CA-002 lote 84323020505-A) - cantidad "24-01-1900" es inválida
// CARGADA CON AVISO: fila SKU "yyyy" - SKU no estándar

const rows = [
  ['18-03-2026','C-37',  'SR-001',  'SILLA DE RUEDAS VITALITY',                          '20670-150',     'n/a',       2,      '',      '25'],
  ['18-03-2026','C-39',  'FCM-003', 'GUANTE S NITRILO EXAMEN',                            'ZIM507014Q64',  '28-06-2030',170,     '',      '9'],
  ['18-03-2026','C-39',  'FCM-004', 'GUANTE L NITRILO EXAMEN',                            'KO206004811-2', '28-05-2027',221,     '',      '9'],
  ['18-03-2026','C-39',  'GU-004',  'GUANTE NITRILO M MUNCARE 100U',                      'IN250004303',   '30-04-2030',25,      '',      '9'],
  ['18-03-2026','C-40',  'PD-001',  'PECHERA DESECHABLE BLANCA LARGA',                    'FS22126',       '30-05-2027',190,     '',      '11'],
  ['18-03-2026','C-40',  'PD-001',  'PECHERA DESECHABLE BLANCA LARGA',                    'FS21243',       '30-11-2026',10,      '',      '11'],
  ['18-03-2026','C-40',  'PD-002',  'PECHERA DESECHABLE BLANCA CORTA',                    'FS22126',       '30-05-2027',100,     '',      '11'],
  ['18-03-2026','C-42',  'KM-001',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA S',          'SF0032308',     '01-07-2028',1982,    '',      '18'],
  ['18-03-2026','C-43',  'CA-002',  'CINTA DE PAPEL CON DISPENSADOR 5CM X 9,1 MTS',       '84323020504-A', '28-02-2030',185,     '',      '15'],
  ['18-03-2026','C-43',  'CA-002',  'CINTA DE PAPEL CON DISPENSADOR 5CM X 9,1 MTS',       '84323020505-A', '28-02-2030',32,      '',      '15'],
  ['18-03-2026','C-45',  'KM-007',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA M',          '20240067',      '01-12-2029',2500,    '',      '5'],
  ['18-03-2026','C-46',  'AF-004',  'AGUJA FISTULA 17G DORA',                             '2402100071',    '17-01-2027',410,     '',      '27'],
  ['18-03-2026','C-46',  'KG-003',  'KIT CONEXIÓN DESCONEXIÓN FISTULA L',                 '24L015',        '28-02-2027',8,       '',      '27'],
  ['18-03-2026','C-46',  'KG-006',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER L',                 '24L015',        '20-11-2026',20,      '',      '27'],
  ['18-03-2026','C-46',  'KM-001',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA S',          '20230066',      '30-03-2028',100,     '',      '27'],
  ['18-03-2026','C-46',  'LA-001',  'L. ARTERIAL 8MM DORA',                               '2401100123',    '29-01-2027',32,      '',      '27'],
  ['18-03-2026','C-46',  'SA-001',  'SABANILLAS 2U WINROLL',                              'N/A',           'N/A',       6,       '',      '27'],
  ['18-03-2026','C-46',  'yyyy',    'KIT CONEXIÓN DESCONEXIÓN FISTULA S',                 '23L054',        '30-07-2026',99,      '',      '27'],
  ['18-03-2026','C-47',  'SUC-004', 'CLORURO DE SODIO 0.9% 20ML-AP-C40 40U',              '52W934',        '01-07-2027',2,       '',      '28'],
  ['18-03-2026','C-47',  'SUC-004', 'CLORURO DE SODIO 0.9% 20ML-AP-C40 40U',              '52W933',        '01-07-2027',1,       '',      '28'],
  ['18-03-2026','C-47',  'SUC-004', 'CLORURO DE SODIO 0.9% 20ML-AP-C40 40U',              '4215105',       '30-04-2026',4,       '',      '28'],
  ['18-03-2026','C-47',  'SUC-004', 'CLORURO DE SODIO 0.9% 20ML-AP-C40 40U',              '4215106',       '30-04-2026',52,      '',      '28'],
  ['18-03-2026','C-47',  'SUC-004', 'CLORURO DE SODIO 0.9% 20ML-AP-C40 40U',              '4215107',       '30-04-2026',60,      '',      '28'],
  ['18-03-2026','C-48',  'BSC-001', 'BAJADA SUERO MACRO GOTEO 20 GTS',                    'GT250478',      '20-05-2030',16,      '',      '19'],
  ['18-03-2026','C-48',  'GT-002',  'GASA NO TEJIDA ESTERIL 10X10 50U',                   'KP241110',      '09-11-2029',10,      '',      '19'],
  ['18-03-2026','C-48',  'GT-003',  'GASA NO TEJIDA ESTERIL 5X5 50U',                     'KP241110',      '09-11-2029',50,      '',      '19'],
  ['18-03-2026','C-48',  'MC-001',  'MASCARILLA DESECHABLE 3 PLIEGUES',                   '20250828',      '27-08-2030',76,      '',      '19'],
  ['18-03-2026','C-48',  'TS-001',  'TEST RESIDUAL ACIDO PERACÉTICO',                     '2024102501',    '24-10-2026',875,     '',      '19'],
  ['18-03-2026','C-49',  'DBF-002', 'DIALIZADOR BAJO FLUJO 1.8 DORA',                     '2503102673',    '20-07-2028',516,     '',      '14'],
  ['18-03-2026','C-51',  'KO-004',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA S',           '20250101',      '31-12-2029',2200,    '',      '10'],
  ['18-03-2026','C-52',  'KM-007',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA M',          '20240067',      '01-12-2029',2000,    '',      '7'],
  ['18-03-2026','C-53',  'DAV-001', 'DIALIZADOR ALTO FLUJO 1.8',                          'P13-T250423',   '30-03-2028',24,      '',      '22'],
  ['18-03-2026','C-53',  'DAV-002', 'DIALIZADOR ALTO FLUJO 2,0',                          'P14-T250423',   '30-03-2028',456,     '',      '22'],
  ['18-03-2026','C-55',  'CA-001',  'CIN. ADHESIVA MICROPOROSA BLANCA 25MMX9.1M',         'KP241110',      '11-09-2029',20,      '',      '26'],
  ['18-03-2026','C-55',  'CA-001',  'CIN. ADHESIVA MICROPOROSA BLANCA 25MMX9.1M',         'KP241111',      '11-10-2029',15,      '',      '26'],
  ['18-03-2026','C-55',  'DHF-200', 'DIALIZADOR ALTO FLUJO 200 OCI',                      '241040',        '17-10-2027',2,       '',      '26'],
  ['18-03-2026','C-55',  'DLF-180', 'DIALIZADOR BAJO FLUJO 180 OCI',                      '241025',        '13-10-2027',18,      '',      '26'],
  ['18-03-2026','C-55',  'DLF-200', 'DIALIZADOR BAJO FLUJO 200 OCI',                      '241036',        '16-10-2027',7,       '',      '26'],
  ['18-03-2026','C-55',  'FCM-001', 'CINTA ADHESIVA 2,5CM X 9,1 MTS',                     'CJ22207',       '31-05-2027',30,      '',      '26'],
  ['18-03-2026','C-55',  'KO-002',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA M',          '20241001',      '30-09-2029',90,      '',      '26'],
  ['18-03-2026','C-56',  'DHF-180', 'DIALIZADOR ALTO FLUJO 180 OCI',                      '250652',        '20-06-2028',72,      '',      '21'],
  ['18-03-2026','C-56',  'DHF-200', 'DIALIZADOR ALTO FLUJO 200 OCI',                      '250646',        '18-06-2028',92,      '',      '21'],
  ['18-03-2026','C-56',  'KM-005',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA M',           '20250172',      '30-08-2030',100,     '',      '21'],
  ['18-03-2026','C-56',  'KO-005',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA M',           '20241004',      '03-10-2029',40,      '',      '21'],
  ['18-03-2026','C-56',  'KO-005',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA M',           '20250102',      '01-01-2030',200,     '',      '21'],
  ['18-03-2026','C-56',  'LAV-001', 'SET DE LÍNEAS PARA HEMODIÁLISIS',                    '250509',        '06-04-2028',191,     '',      '21'],
  ['18-03-2026','C-57',  'KO-004',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA S',           '20241003',      '02-10-2029',300,     '',      '20'],
  ['18-03-2026','C-57',  'TA-001',  'TOALLAS IMPREGNADAS CON ALCOHOL AL 70%',             '2022304',       '01-03-2027',22000,   '',      '20'],
  ['18-03-2026','C-57',  'TS-002',  'TEST DE POTENCIA ACIDO PERACÉTICO',                  '2024102501',    '24-10-2026',916,     '',      '20'],
  ['18-03-2026','C-58',  'KO-004',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA S',           '20250102',      '01-01-2030',1900,    '',      '3'],
  ['18-03-2026','C-60',  'KO-001',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA S',          '20231102',      '01-11-2028',1100,    '',      '17'],
  ['18-03-2026','C-60',  'KO-001',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA S',          '20241001',      '30-09-2029',700,     '',      '17'],
  ['18-03-2026','C-61',  'KO-001',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA S',          '20231101',      '31-10-2028',1600,    '',      '16'],
  ['18-03-2026','C-61',  'KO-001',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA S',          '20241002',      '10-01-2029',700,     '',      '16'],
  ['18-03-2026','C-63',  'LAV-001', 'SET DE LÍNEAS PARA HEMODIÁLISIS',                    '240105',        '01-11-2027',616,     '',      '1'],
  ['18-03-2026','C-64',  'JC-001',  'JERINGA LUER LOCK 5 ML CON AGUJA 21G X 1 1/2',      '20241221',      '20-12-2029',34,      '',      '8'],
  ['18-03-2026','C-64',  'JC-002',  'JERINGA LUER LOCK 10 ML CON AGUJA 21G X 1 1/2',     '20250621',      '12-06-2030',11,      '',      '8'],
  ['18-03-2026','C-64',  'T-001',   'TRANSDUCTOR DE PRESIÓN (envase individual)',          '250510',        '04-06-2028',8450,    '',      '8'],
  ['18-03-2026','C-66',  'AF-001',  'AGUJA FISTULA 14G DORA',                             '240210072',     '19-01-2027',1150,    '',      '13'],
  ['18-03-2026','C-66',  'AF-003',  'AGUJA FISTULA 16G DORA',                             '2502101310',    '20-07-2028',6000,    '',      '13'],
  ['18-03-2026','C-66',  'AF-007',  'AGUJA FISTULA 15G ARTERIOVENOSA',                    '241104',        '02-11-2027',1849,    '',      '13'],
  ['18-03-2026','C-67',  'KO-006',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA L',           '20250101',      '31-12-2029',900,     '',      '4'],
  ['18-03-2026','C-67',  'KO-006',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA L',           '20250102',      '01-01-2030',200,     '',      '4'],
  ['18-03-2026','C-69',  'KM-007',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA M',          '20240058',      '30-03-2029',3000,    '',      '24'],
  ['18-03-2026','C-70',  'T-001',   'TRANSDUCTOR DE PRESIÓN (envase individual)',          'T241105B508',   '04-11-2026',157600,  '',      '12'],
  ['18-03-2026','C-72',  'KM-007',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA M',          '20240064',      '01-09-2029',1200,    '',      '23'],
  ['26-03-2026','C-42',  'KM-007',  'KIT FISTULAS CONEXIÓN DESCONEXIÓN TALLA M',          '20240058',      '30-03-2029',500,     '',      '16865'],
  ['24-03-2026','Piso',  'KM-005',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA M',           '20240058',      '30-03-2029',500,     '',      ''],
  ['25-03-2026','C-01',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5855'],
  ['25-03-2026','C-04',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5855'],
  ['25-03-2026','C-06',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',37,      'PISA',  '5855'],
  ['25-03-2026','C-13',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5871'],
  ['25-03-2026','C-15',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',19,      'PISA',  '5871'],
  ['20-03-2026','B-49',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5808'],
  ['20-03-2026','B-50',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5808'],
  ['20-03-2026','B-55',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',50,      'PISA',  '5808'],
  ['20-03-2026','B-56',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5808'],
  ['20-03-2026','B-58',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5808'],
  ['20-03-2026','B-59',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5808'],
  ['20-03-2026','B-37',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',50,      'PISA',  '5809'],
  ['20-03-2026','B-38',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5809'],
  ['20-03-2026','B-40',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5809'],
  ['20-03-2026','B-41',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5809'],
  ['20-03-2026','B-43',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5809'],
  ['20-03-2026','B-44',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25U011',       '31-07-2027',40,      'PISA',  '5809'],
  ['27-03-2026','C-37',  'SUC-001', 'SOLUCIÓN CS 0.9% 1000ML 12U',                        'V25M002',       '31-03-2027',21,      '',      ''],
  ['31-03-2026','C-04',  'DAF-004', 'DIALIZADOR ALTO FLUJO 2.0 WEGO',                     '25102443',      '23-10-2028',480,     'INVERSIONES MASAI MARA', '41'],
  ['31-03-2026','C-05',  'DAF-005', 'DIALIZADOR ALTO FLUJO 2.2 WEGO',                     '25101643',      '15-10-2028',480,     'INVERSIONES MASAI MARA', '41'],
  ['31-03-2026','C-06',  'DAF-003', 'DIALIZADOR ALTO FLUJO 1.9 WEGO',                     '25102443',      '23-10-2028',240,     'INVERSIONES MASAI MARA', '41'],
  ['01-04-2026','C-72',  'KM-005',  'KIT CONEXIÓN DESCONEXIÓN CATÉTER TALLA M',           '20240058',      '01-03-2029',800,     'EMIMED', '16889'],
  ['01-04-2026','C-21',  'AC-001',  'CITRACEL -K 21% 5 LITRO 2UNI',                       'CT013846B',     '01-03-2027',4,       'BIORENAL','22721'],
  ['02-04-2026','C-20',  'AC-001',  'CITRACEL -K 21% 5 LITRO 2UNI',                       'CTO13847B',     '01-03-2027',65,      'BIORENAL','16902'],
  ['06-04-2026','C-43',  'CA-002',  'CINTA DE PAPEL CON DISPENSADOR 5CM X 9,1 MTS',       '84323020505-A', '28-02-2030',24,      'MEDLINE', ''],
];

async function cargar() {
  const updates = {};
  let ok = 0;

  rows.forEach((r, i) => {
    const [fecha, ubicRaw, sku, desc, lote, venceRaw, qty, proveedorRaw, referenciaRaw] = r;
    const ts = parseFechaTs(fecha, i * 100); // clave única por movimiento

    const loteClean = (lote.toUpperCase() === 'N/A') ? 'N/A' : lote.trim();

    const mov = {
      tipo:         'Entrada',
      sku:          sku.trim(),
      lote:         loteClean,
      descripcion:  desc.trim(),
      cantidad:     qty,
      vence:        parseVence(venceRaw),
      status:       'Aprobado',
      bodega:       BODEGA,
      ubicacion:    normUbic(ubicRaw),
      proveedor:    clean(proveedorRaw),
      referencia:   clean(referenciaRaw),
      observaciones:'',
      fecha:        parseFechaISO(fecha),
      usuario:      USUARIO
    };

    updates[`usuarios/${UID}/movimientos/${ts}`] = mov;
    ok++;
  });

  await db.ref().update(updates);
  console.log(`✓ ${ok} movimientos cargados correctamente.`);
  console.log('');
  console.log('⚠ AVISOS:');
  console.log('  1. SKU "yyyy" (fila C-46, lote 23L054): SKU no estándar - no existe en el maestro de productos.');
  console.log('     Descripción: KIT CONEXIÓN DESCONEXIÓN FISTULA S. Verificar SKU real.');
  console.log('  2. SKU "yyyy" (C-46, lote 23L054): Cargado. Verificar SKU real en maestro.');
}

cargar()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
