const admin = require('./node_modules/firebase-admin');
const serviceAccount = require('C:/Users/DT BIODIAL/Downloads/celmedik-inventario-firebase-adminsdk-fbsvc-d28e408090.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://celmedik-inventario-default-rtdb.firebaseio.com'
});

const db = admin.database();
const UID = 'XxnrZJwsPpgKYtNWO78BAyoUyWM2';
const BODEGA_KEY = '1773335088081'; // CELMEDIK BIODIAL

const rawList = [
  'A-01','A-02','A-03','A-04','A-05','A-06','A-07','A-08','A-09','A-10',
  'A-11','A-12','A-13','A-14','A-15','A-16','A-17','A-18','A-19','A-20',
  'A-21','A-22','A-23','A-24','A-25','A-26','A-27','A-28','A-29','A-30',
  'A-31','A-32','A-33','A-34','A-35','A-36','A-37','A-38','A-39','A-40',
  'A-41','A-42','A-43','A-44','A-45','A-46','A-47','A-48','A-49','A-50',
  'A-51','A-52','A-53','A-54','A-55','A-56','A-57','A-58','A-59','A-60',
  'A-61','A-62','A-63','A-64','A-65','A-66','A-67','A-68','A-69','A-70',
  'A-71','A-72',
  'B-01','B-02','B-03','B-04','B-05','B-06','B-07','B-08','B-09','B-10',
  'B-11','B-12','B-13','B-14','B-15','B-16','B-17','B-18','B-19','B-20',
  'B-21','B-22','B-23','B-24','B-25','B-26','B-27','B-28','B-29','B-30',
  'B-31','B-32','B-33','B-34','B-35','B-36','B-37','B-38','B-39','B-40',
  'B-41','B-42','B-43','B-44','B-45','B-46','B-47','B-48','B-49','B-50',
  'B-51','B-52','B-53','B-54','B-55','B-56','B-57','B-58','B-59','B-60',
  'B-61','B-62','B-63','B-64','B-65','B-66','B-67','B-68','B-69','B-70',
  'B-71','B-72',
  'C-01','C-02','C-03','C-04','C-05','C-06','C-07','C-08','C-09','C-10',
  'C-11','C-12','C-13','C-14','C-15','C-16','C-17','C-18','C-19','C-20',
  'C-21','C-22','C-23','C-24','C-25','C-26','C-27','C-28','C-29','C-30',
  'C-31','C-32','C-33','C-34','C-35','C-36','C-37','C-38','C-39','C-40',
  'C-41','C-42','C-43','C-44','C-45','C-46','C-47','C-48','C-49','C-50',
  'C-51','C-52','C-53','C-54','C-55','C-56','C-57','C-58','C-59','C-60',
  'C-61','C-62','C-63','C-64','C-65','C-66','C-67','C-68','C-69','C-70',
  'C-71','C-72',
  'D-01','D-02','D-03','D-04','D-05','D-06','D-07','D-08','D-09','D-10',
  'D-11','D-12','D-13','D-14','D-15','D-16','D-17','D-18','D-19','D-20',
  'D-21','D-22','D-23','D-24','D-25','D-26','D-27','D-28','D-29','D-30',
  'D-31','D-32','D-33','D-34','D-35','D-36','D-37','D-38','D-39','D-40',
  'D-41','D-42','D-43','D-44','D-45','D-46','D-47','D-48','D-49','D-50',
  'D-51','D-52','D-53','D-54',
  'E-01','E-02','E-03','E-04','E-05','E-06','E-07','E-08','E-09','E-10',
  'E-11','E-12','E-13','E-14','E-15','E-16','E-17','E-18','E-19','E-20',
  'E-21','E-22','E-23','E-24','E-25','E-26','E-27',
  'PISO'
];

const ubicaciones = [...new Set(rawList)];
console.log('Total ubicaciones:', ubicaciones.length);

db.ref(`usuarios/${UID}/bodegas/${BODEGA_KEY}/ubicaciones`).set(ubicaciones)
  .then(() => { console.log('Ubicaciones CELMEDIK BIODIAL guardadas OK'); process.exit(0); })
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
