// Escribe version.json en la raíz del proyecto para que la app pueda detectar
// cuando hay una nueva versión desplegada. Se ejecuta antes de firebase deploy.
// La versión es un timestamp (ISO) y el hash corto del último commit (si está
// disponible). El archivo se sirve sin caché (ver firebase.json).

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function safeGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString().trim();
  } catch (_) { return ''; }
}

const buildTime = new Date().toISOString();
const commit    = safeGitCommit();
const version   = commit ? `${buildTime}-${commit}` : buildTime;

const payload = { version, buildTime, commit };
const out = path.join(__dirname, '..', 'version.json');
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('version.json escrito:', payload);
