/**
 * Celmedik WMS - Archivo automatico de PDFs de Salida en Google Drive.
 *
 * Pegue este codigo completo en un proyecto de Apps Script (script.google.com)
 * dentro de la cuenta celmedikspa@gmail.com y publiquelo como Web App.
 *
 * --- CONFIGURACION ---
 *   1) Reemplace SHARED_SECRET por una cadena aleatoria larga (p.ej. un UUID).
 *      El MISMO valor debe pegarse en el WMS -> Ajustes -> "Guardado automatico
 *      en Google Drive".
 *   2) Los IDs de carpeta ya estan configurados para Los Angeles y Stgo. Si mas
 *      adelante agrega bodegas, agregue entradas a FOLDERS_BY_BODEGA.
 *   3) Publique: Deploy -> New deployment -> type "Web app"
 *         - Execute as: Me (celmedikspa@gmail.com)
 *         - Who has access: Anyone
 *      Autorice los permisos que solicita (Drive).
 *   4) Copie la URL tipo https://script.google.com/macros/s/XXX/exec y peguela
 *      en el WMS junto al secret.
 */

var SHARED_SECRET = 'REEMPLAZAR_POR_SECRET_ALEATORIO_LARGO';

// Las claves se buscan por "contains" sobre el nombre normalizado (sin acentos,
// minusculas). Orden importa: la primera coincidencia gana, por eso los alias
// especificos (p.ej. 'stgo') van antes que los genericos.
var FOLDERS_BY_BODEGA = [
  { match: 'los angeles', folderId: '1owwGo7NWjDS6H76Wwma7nLWFMg89hpk-' },
  { match: 'angeles',     folderId: '1owwGo7NWjDS6H76Wwma7nLWFMg89hpk-' },
  { match: 'stgo',        folderId: '15ta8pQZlNZfE6AO-qv_DWFqLRAvoe9eu' },
  { match: 'santiago',    folderId: '15ta8pQZlNZfE6AO-qv_DWFqLRAvoe9eu' }
];

// Fallback cuando la bodega no coincide con ninguna entrada (evita perder PDFs).
var DEFAULT_FOLDER_ID = '1owwGo7NWjDS6H76Wwma7nLWFMg89hpk-';

// ============================================================================

function _norm(s) {
  // Minusculas, sin acentos, sin espacios extremos.
  // ̀-ͯ = combining diacritical marks (NFD deja las letras base + diacriticos).
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
}

function _pickFolderId(bodega) {
  var key = _norm(bodega);
  if (!key) return DEFAULT_FOLDER_ID;
  for (var i = 0; i < FOLDERS_BY_BODEGA.length; i++) {
    var entry = FOLDERS_BY_BODEGA[i];
    if (key.indexOf(_norm(entry.match)) !== -1) return entry.folderId;
  }
  return DEFAULT_FOLDER_ID;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Smoke test: GET al /exec responde JSON de salud (lo usa "Probar conexion" del WMS).
function doGet(e) {
  return _json({ ok: true, service: 'celmedik-drive-archive', ts: new Date().toISOString() });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ ok: false, error: 'sin cuerpo' });
    }
    var body;
    try { body = JSON.parse(e.postData.contents); }
    catch (parseErr) { return _json({ ok: false, error: 'JSON invalido' }); }

    if (body.secret !== SHARED_SECRET) {
      return _json({ ok: false, error: 'no autorizado' });
    }
    if (!body.pdfBase64) return _json({ ok: false, error: 'falta pdfBase64' });

    var filename = (body.filename || ('salida_' + Date.now() + '.pdf'))
      .toString().replace(/[\\/:*?"<>|]/g, '_');
    var folderId = _pickFolderId(body.bodega);
    var folder = DriveApp.getFolderById(folderId);

    var bytes = Utilities.base64Decode(body.pdfBase64);
    var blob = Utilities.newBlob(bytes, 'application/pdf', filename);
    var file = folder.createFile(blob);

    // Metadatos humanamente legibles en el campo Descripcion de Drive
    if (body.metadata && typeof body.metadata === 'object') {
      try {
        var lines = [];
        for (var k in body.metadata) {
          if (Object.prototype.hasOwnProperty.call(body.metadata, k)) {
            lines.push(k + ': ' + body.metadata[k]);
          }
        }
        file.setDescription(lines.join('\n'));
      } catch (descErr) { /* descripcion opcional */ }
    }

    return _json({
      ok: true,
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      folderId: folderId,
      bodega: body.bodega || ''
    });
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message || err) });
  }
}
