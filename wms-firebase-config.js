// ==========================================
// CONFIGURACIÓN DE FIREBASE - WMS BODEGA
// ==========================================
// Instrucciones:
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un nuevo proyecto llamado "WMS-Bodega"
// 3. Habilita "Realtime Database" 
// 4. Copia tu configuración aquí
// 5. En las reglas de Firebase, usa:
// {
//   "rules": {
//     ".read": false,
//     ".write": false,
//     "wms": {
//       ".read": "auth != null",
//       ".write": "auth != null"
//     }
//   }
// }
// ==========================================

// CONFIGURACIÓN - REEMPLAZA CON TUS DATOS
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// INICIALIZACIÓN (NO MODIFICAR)
let app = null;
let database = null;
let auth = null;

// Verificar si Firebase está configurado
function isFirebaseConfigured() {
  return firebaseConfig.apiKey !== "TU_API_KEY_AQUI";
}

// Inicializar Firebase (llamar desde app.js)
function initializeFirebase() {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase no configurado. Usando modo local.');
    return false;
  }
  
  try {
    app = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    auth = firebase.auth();
    console.log('Firebase inicializado correctamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar Firebase:', error);
    return false;
  }
}

// Funciones de base de datos
const WMSDB = {
  // Productos
  products: {
    getAll: () => database.ref('wms/products').once('value').then(s => s.val() || {}),
    get: (id) => database.ref(`wms/products/${id}`).once('value').then(s => s.val()),
    set: (id, data) => database.ref(`wms/products/${id}`).set(data),
    remove: (id) => database.ref(`wms/products/${id}`).remove(),
    push: (data) => database.ref('wms/products').push(data),
    watch: (callback) => database.ref('wms/products').on('value', s => callback(s.val() || {}))
  },
  
  // Ubicaciones
  locations: {
    getAll: () => database.ref('wms/locations').once('value').then(s => s.val() || {}),
    set: (id, data) => database.ref(`wms/locations/${id}`).set(data),
    remove: (id) => database.ref(`wms/locations/${id}`).remove(),
    push: (data) => database.ref('wms/locations').push(data),
    watch: (callback) => database.ref('wms/locations').on('value', s => callback(s.val() || {}))
  },
  
  // Inventario
  inventory: {
    getAll: () => database.ref('wms/inventory').once('value').then(s => s.val() || {}),
    set: (id, data) => database.ref(`wms/inventory/${id}`).set(data),
    remove: (id) => database.ref(`wms/inventory/${id}`).remove(),
    push: (data) => database.ref('wms/inventory').push(data),
    watch: (callback) => database.ref('wms/inventory').on('value', s => callback(s.val() || {}))
  },
  
  // Entradas
  entries: {
    getAll: () => database.ref('wms/entries').once('value').then(s => s.val() || {}),
    push: (data) => database.ref('wms/entries').push(data),
    watch: (callback) => database.ref('wms/entries').on('value', s => callback(s.val() || {}))
  },
  
  // Salidas
  exits: {
    getAll: () => database.ref('wms/exits').once('value').then(s => s.val() || {}),
    push: (data) => database.ref('wms/exits').push(data),
    watch: (callback) => database.ref('wms/exits').on('value', s => callback(s.val() || {}))
  },
  
  // Movimientos
  movements: {
    push: (data) => database.ref('wms/movements').push(data),
    getAll: () => database.ref('wms/movements').once('value').then(s => s.val() || {}),
    watch: (callback) => database.ref('wms/movements').on('value', s => callback(s.val() || {}))
  },
  
  // Usuarios
  users: {
    getAll: () => database.ref('wms/users').once('value').then(s => s.val() || {}),
    set: (id, data) => database.ref(`wms/users/${id}`).set(data),
    get: (id) => database.ref(`wms/users/${id}`).once('value').then(s => s.val()),
    watch: (callback) => database.ref('wms/users').on('value', s => callback(s.val() || {}))
  },
  
  // Alertas
  alerts: {
    set: (data) => database.ref('wms/alerts').set(data),
    get: () => database.ref('wms/alerts').once('value').then(s => s.val()),
    watch: (callback) => database.ref('wms/alerts').on('value', s => callback(s.val()))
  }
};

// Funciones de autenticación
const Auth = {
  login: (email, password) => auth.signInWithEmailAndPassword(email, password),
  logout: () => auth.signOut(),
  register: (email, password) => auth.createUserWithEmailAndPassword(email, password),
  currentUser: () => auth.currentUser,
  onAuthStateChanged: (callback) => auth.onAuthStateChanged(callback),
  resetPassword: (email) => auth.sendPasswordResetEmail(email)
};

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.firebaseConfig = firebaseConfig;
  window.WMSDB = WMSDB;
  window.Auth = Auth;
  window.initializeFirebase = initializeFirebase;
  window.isFirebaseConfigured = isFirebaseConfigured;
}
