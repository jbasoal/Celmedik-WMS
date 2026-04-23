#!/usr/bin/env node
/**
 * Script utilitario para obtener el refresh_token de Microsoft UNA VEZ.
 * Úselo local en su PC, no en producción.
 *
 *   1) Exporte las variables:
 *        export MS_CLIENT_ID="<GUID de su app en Azure>"
 *        # si registró la app como "confidential client" exporte también:
 *        export MS_CLIENT_SECRET="<secret>"
 *
 *   2) Corra:  node seed-refresh-token.js
 *
 *   3) Abra en el navegador la URL que imprime, inicie sesión con la cuenta
 *      Microsoft DUEÑA de la carpeta destino, acepte los permisos.
 *
 *   4) Copie el parámetro ?code= que devuelve Microsoft y péguelo en la
 *      consola. El script imprime el refresh_token.
 *
 *   5) Guárdelo en Firebase como secret:
 *        firebase functions:secrets:set MS_REFRESH_TOKEN
 *        (pegue el token y Enter)
 *
 * El token dura indefinidamente mientras se use con regularidad.
 */
const http = require('http');
const readline = require('readline');
const { URL } = require('url');

const CLIENT_ID     = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || '';
const REDIRECT_URI  = 'http://localhost:53682/callback';
const SCOPES        = 'Files.ReadWrite offline_access';
const TOKEN_URL     = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const AUTH_URL      = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';

if (!CLIENT_ID) {
    console.error('Falta MS_CLIENT_ID en el entorno. Exporta MS_CLIENT_ID antes de correr.');
    process.exit(1);
}

const authUrl = new URL(AUTH_URL);
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_mode', 'query');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('prompt', 'consent');

console.log('\n1) Abre en un navegador la siguiente URL y autoriza con la cuenta Microsoft dueña de la carpeta:\n');
console.log(authUrl.toString() + '\n');
console.log('2) Quedará tu navegador intentando abrir http://localhost:53682/callback?code=...');
console.log('   Este script está escuchando ahí y capturará el code automáticamente.\n');

const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, REDIRECT_URI);
    if (u.pathname !== '/callback') { res.statusCode = 404; res.end('not found'); return; }
    const code = u.searchParams.get('code');
    const err  = u.searchParams.get('error');
    if (err) {
        res.end('Error Microsoft: ' + err + ' - ' + (u.searchParams.get('error_description')||''));
        console.error('Microsoft devolvió error:', err);
        server.close();
        return;
    }
    if (!code) { res.end('Sin code'); return; }
    res.end('<h2>OK — puede cerrar esta ventana.</h2><p>Vuelva al terminal.</p>');
    server.close();

    // Canjear code por tokens
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('scope', SCOPES);
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('grant_type', 'authorization_code');
    if (CLIENT_SECRET) params.append('client_secret', CLIENT_SECRET);

    try {
        const resp = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        const data = await resp.json();
        if (!resp.ok) {
            console.error('Error al canjear code:', data);
            process.exit(1);
        }
        console.log('\n══════════════════════════════════════════════════════════════');
        console.log('✓ refresh_token obtenido. GUÁRDELO COMO SECRET DE FIREBASE:\n');
        console.log('   firebase functions:secrets:set MS_REFRESH_TOKEN\n');
        console.log('   (cuando pregunte, pegue el siguiente valor y Enter)\n');
        console.log('──────────────────────────────────────────────────────────────');
        console.log(data.refresh_token);
        console.log('──────────────────────────────────────────────────────────────');
        console.log('\nAccess token (expira en', data.expires_in, 'seg, solo de referencia):');
        console.log(data.access_token.slice(0, 40) + '...\n');
        console.log('Scopes concedidos:', data.scope);
        console.log('══════════════════════════════════════════════════════════════\n');
        process.exit(0);
    } catch (e) {
        console.error('Fallo HTTP:', e);
        process.exit(1);
    }
});
server.listen(53682, () => { /* listening */ });
