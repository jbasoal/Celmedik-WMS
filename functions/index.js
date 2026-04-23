// Cloud Function: uploadSalidaPdf
// Recibe un PDF generado en el cliente y lo sube a una carpeta de OneDrive
// usando Microsoft Graph. Autenticación: refresh token OAuth2 guardado como
// secret de Firebase.
//
// Flujo:
//   1. Verifica que el caller esté autenticado en Firebase y tenga perfil
//      autorizado (Maestro | Farmacéutico | Operador) leyendo usuarios/{uid}.
//   2. Parsea el multipart (busboy) para obtener el PDF y los metadatos.
//   3. Intercambia refreshToken -> accessToken contra Microsoft identity.
//   4. Resuelve el share link -> driveId + folderId (una vez, cacheado).
//   5. PUT /drives/{driveId}/items/{folderId}:/{filename}:/content
//   6. Responde JSON con webUrl, id, size.

const functions = require('firebase-functions/v2/https');
const admin     = require('firebase-admin');
const Busboy    = require('busboy');
const fetch     = require('node-fetch');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const MS_CLIENT_ID     = defineSecret('MS_CLIENT_ID');
const MS_CLIENT_SECRET = defineSecret('MS_CLIENT_SECRET'); // opcional: usa solo si registraste "confidential client"
const MS_REFRESH_TOKEN = defineSecret('MS_REFRESH_TOKEN');
const MS_SHARE_URL     = defineSecret('MS_SHARE_URL');     // URL compartida de la carpeta destino

const PERFILES_PERMITIDOS = ['Maestro', 'Farmacéutico', 'Operador'];
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const SCOPES = 'Files.ReadWrite offline_access';

// Cache en memoria (warm start) para evitar pedir un access_token por cada request.
let cachedAccessToken = null;
let cachedAccessExpires = 0;
let cachedShareItem = null; // { driveId, itemId }

function encodeShareUrl(url) {
    // Graph pide "u!" + base64url de la URL para resolver shares.
    const b64 = Buffer.from(url, 'utf8').toString('base64')
        .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    return 'u!' + b64;
}

async function getAccessToken() {
    const now = Date.now();
    if (cachedAccessToken && now < cachedAccessExpires - 60000) return cachedAccessToken;
    const params = new URLSearchParams();
    params.append('client_id', MS_CLIENT_ID.value());
    params.append('scope', SCOPES);
    params.append('refresh_token', MS_REFRESH_TOKEN.value());
    params.append('grant_type', 'refresh_token');
    // Si hay client_secret (flujo confidencial), inclúyelo. Si la app es "public client", omítelo.
    try {
        const sec = MS_CLIENT_SECRET.value();
        if (sec) params.append('client_secret', sec);
    } catch(_) { /* secret opcional no definido */ }

    const resp = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });
    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(`Token refresh falló: ${resp.status} ${data.error || ''} ${data.error_description || JSON.stringify(data)}`);
    }
    cachedAccessToken = data.access_token;
    cachedAccessExpires = now + (data.expires_in * 1000);
    return cachedAccessToken;
}

async function resolveShareFolder(accessToken) {
    if (cachedShareItem) return cachedShareItem;
    const shareId = encodeShareUrl(MS_SHARE_URL.value());
    const resp = await fetch(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'redeemSharingLink'
        }
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(`resolveShareFolder: ${resp.status} ${JSON.stringify(data)}`);
    cachedShareItem = {
        driveId: data.parentReference && data.parentReference.driveId ? data.parentReference.driveId : (data.remoteItem && data.remoteItem.parentReference && data.remoteItem.parentReference.driveId),
        itemId:  data.id || (data.remoteItem && data.remoteItem.id)
    };
    if (!cachedShareItem.driveId || !cachedShareItem.itemId) {
        throw new Error('No se pudo extraer driveId/itemId del share: ' + JSON.stringify(data));
    }
    return cachedShareItem;
}

async function uploadToOneDrive(accessToken, folder, filename, buffer) {
    // Simple upload (< 4 MB). Las salidas suelen ser < 200 KB, sobra.
    const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
    const url = `https://graph.microsoft.com/v1.0/drives/${folder.driveId}/items/${folder.itemId}:/${encodeURIComponent(safeName)}:/content`;
    const resp = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/pdf'
        },
        body: buffer
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(`upload: ${resp.status} ${JSON.stringify(data)}`);
    return data; // incluye id, webUrl, size, etc.
}

async function verificarPerfil(uid) {
    const snap = await admin.database().ref(`usuarios/${uid}`).once('value');
    const info = snap.val() || {};
    if (!PERFILES_PERMITIDOS.includes(info.perfil)) {
        throw Object.assign(new Error(`Perfil no autorizado: ${info.perfil || 'ninguno'}`), { httpStatus: 403 });
    }
    return info;
}

async function verificarIdToken(req) {
    const auth = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match) throw Object.assign(new Error('Falta token'), { httpStatus: 401 });
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded;
}

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const bb = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
        const fields = {};
        let fileBuffer = null;
        let fileInfo = null;
        bb.on('field', (name, val) => { fields[name] = val; });
        bb.on('file', (name, stream, info) => {
            fileInfo = info;
            const chunks = [];
            stream.on('data', c => chunks.push(c));
            stream.on('limit', () => reject(new Error('PDF excede el límite de 10 MB')));
            stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
        });
        bb.on('finish', () => resolve({ fields, fileBuffer, fileInfo }));
        bb.on('error', reject);
        if (req.rawBody) bb.end(req.rawBody); else req.pipe(bb);
    });
}

exports.uploadSalidaPdf = functions.onRequest(
    {
        region: 'us-central1',
        cors: true,
        secrets: [MS_CLIENT_ID, MS_CLIENT_SECRET, MS_REFRESH_TOKEN, MS_SHARE_URL],
        timeoutSeconds: 60,
        memory: '256MiB'
    },
    async (req, res) => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        if (req.method !== 'POST')   { res.status(405).json({ error: 'Use POST' }); return; }
        try {
            const decoded = await verificarIdToken(req);
            const perfilInfo = await verificarPerfil(decoded.uid);
            const { fields, fileBuffer, fileInfo } = await parseMultipart(req);
            if (!fileBuffer || !fileBuffer.length) throw Object.assign(new Error('No se recibió archivo PDF'), { httpStatus: 400 });
            const filename = (fields.filename || (fileInfo && fileInfo.filename) || `salida_${Date.now()}.pdf`).toString();

            const accessToken = await getAccessToken();
            const folder = await resolveShareFolder(accessToken);
            const uploaded = await uploadToOneDrive(accessToken, folder, filename, fileBuffer);

            // Log opcional: guardar en RTDB la confirmación
            try {
                await admin.database().ref('onedriveUploads').push({
                    fecha: new Date().toISOString(),
                    uid: decoded.uid,
                    email: decoded.email || perfilInfo.email || '',
                    perfil: perfilInfo.perfil,
                    filename,
                    webUrl: uploaded.webUrl || '',
                    itemId: uploaded.id || '',
                    size: uploaded.size || fileBuffer.length,
                    metadata: fields.metadata ? safeJson(fields.metadata) : null
                });
            } catch(e) { /* log opcional */ }

            res.status(200).json({
                ok: true,
                id: uploaded.id,
                webUrl: uploaded.webUrl,
                name: uploaded.name,
                size: uploaded.size
            });
        } catch (err) {
            const status = err.httpStatus || 500;
            console.error('uploadSalidaPdf error:', err.message);
            res.status(status).json({ error: err.message });
        }
    }
);

function safeJson(s) { try { return JSON.parse(s); } catch(_) { return String(s); } }
