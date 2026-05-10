/**
 * Utils.gs
 * Helpers for Spreadsheet access, hashing, dates, file upload, etc.
 */

function getSpreadsheet_() {
  const ssId = PropertiesService.getScriptProperties().getProperty(CONFIG.PROP_SS_ID);
  if (!ssId) throw new Error('App belum di-setup. Jalankan Setup_run().');
  return SpreadsheetApp.openById(ssId);
}

function getSheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Sheet tidak ditemukan: ' + name);
  return sh;
}

function getDriveFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty(CONFIG.PROP_DRIVE_FOLDER_ID);
  if (!id) throw new Error('Drive folder belum di-setup.');
  return DriveApp.getFolderById(id);
}

/**
 * Returns every row in the given sheet as array-of-objects keyed by the
 * header row.
 */
function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    obj._row = i + 1; // 1-indexed sheet row
    out.push(obj);
  }
  return out;
}

/**
 * Find a single row where column `col` equals `value`.
 * Returns an object with the full row + _row index, or null.
 */
function findRow_(sheet, col, value) {
  const all = sheetToObjects_(sheet);
  for (let i = 0; i < all.length; i++) {
    if (String(all[i][col]) === String(value)) return all[i];
  }
  return null;
}

/**
 * Update a single row in place by id.
 */
function updateRowById_(sheetName, id, patch) {
  const sh = getSheet_(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idIdx = headers.indexOf('id');
  if (idIdx < 0) throw new Error('Sheet ' + sheetName + ' tidak punya kolom id');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === String(id)) {
      const rowNum = i + 1;
      const newRow = headers.map(function (h, idx) {
        if (Object.prototype.hasOwnProperty.call(patch, h)) return patch[h];
        return values[i][idx];
      });
      if (headers.indexOf('updatedAt') >= 0) {
        newRow[headers.indexOf('updatedAt')] = new Date();
      }
      sh.getRange(rowNum, 1, 1, headers.length).setValues([newRow]);
      const obj = {};
      headers.forEach(function (h, idx) { obj[h] = newRow[idx]; });
      obj._row = rowNum;
      return obj;
    }
  }
  return null;
}

function deleteRowById_(sheetName, id) {
  const sh = getSheet_(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idIdx = headers.indexOf('id');
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][idIdx]) === String(id)) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function appendRow_(sheetName, obj) {
  const sh = getSheet_(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '';
  });
  sh.appendRow(row);
  const out = Object.assign({}, obj);
  out._row = sh.getLastRow();
  return out;
}

// ===== Hash =====
function hashPassword_(pw) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    'eoffice-pdam-salt::' + String(pw)
  );
  return raw.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function verifyPassword_(plain, hashed) {
  return hashPassword_(plain) === hashed;
}

// ===== Date =====
function fmtDate_(d, pattern) {
  if (!d) return '';
  if (!(d instanceof Date)) d = new Date(d);
  return Utilities.formatDate(d, 'Asia/Jakarta', pattern || 'dd-MM-yyyy HH:mm');
}

function yyyymmdd_(d) {
  if (!d) d = new Date();
  if (!(d instanceof Date)) d = new Date(d);
  return Utilities.formatDate(d, 'Asia/Jakarta', 'yyyyMMdd');
}

// ===== Auto numbering =====
/**
 * Generates next agenda / surat number per type per year.
 * Format: {prefix}/{seq4}/{roman-month}/{year}
 * e.g. PDAM.SM/0012/V/2026
 */
function generateNoAgenda_(prefix) {
  const year = new Date().getFullYear();
  const sh = getSheet_(CONFIG.SHEETS.SURAT_MASUK);
  const data = sheetToObjects_(sh);
  let seq = 0;
  data.forEach(function (r) {
    if (r.noAgenda && String(r.noAgenda).indexOf('/' + year) > -1) seq++;
  });
  const next = seq + 1;
  return prefix + '/' + pad4_(next) + '/' + romanMonth_(new Date()) + '/' + year;
}

function generateNoSuratKeluar_(prefix) {
  const year = new Date().getFullYear();
  const sh = getSheet_(CONFIG.SHEETS.SURAT_KELUAR);
  const data = sheetToObjects_(sh);
  let seq = 0;
  data.forEach(function (r) {
    if (r.noSurat && String(r.noSurat).indexOf('/' + year) > -1) seq++;
  });
  const next = seq + 1;
  return prefix + '/' + pad4_(next) + '/' + romanMonth_(new Date()) + '/' + year;
}

function pad4_(n) { return ('0000' + n).slice(-4); }

function romanMonth_(d) {
  const r = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return r[d.getMonth() + 1];
}

/**
 * Upload a base64 data URL to the app's Drive folder.
 * Returns { url, name, id }.
 */
function uploadBase64_(dataUrl, filename) {
  if (!dataUrl || dataUrl.indexOf('base64,') < 0) return null;
  const parts = dataUrl.split('base64,');
  const meta = parts[0];
  const b64 = parts[1];
  const mime = (meta.match(/data:(.*?);/) || [])[1] || 'application/octet-stream';
  const bytes = Utilities.base64Decode(b64);
  const blob = Utilities.newBlob(bytes, mime, filename || ('file-' + Date.now()));
  const file = getDriveFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    id: file.getId(),
    name: file.getName(),
    url: 'https://drive.google.com/file/d/' + file.getId() + '/view'
  };
}

/**
 * Append a tracking entry for a letter.
 */
function track_(suratId, suratType, action, actor, detail) {
  appendRow_(CONFIG.SHEETS.TRACKING, {
    id: Utilities.getUuid(),
    suratId: suratId,
    suratType: suratType,
    action: action,
    actor: actor || '',
    detail: detail || '',
    timestamp: new Date()
  });
}

/**
 * Generate a short barcode/QR payload for a letter.
 * The payload is a short unique code the frontend will render as QR.
 */
function generateBarcode_(prefix, id) {
  const shortId = String(id).replace(/-/g, '').substring(0, 8).toUpperCase();
  return (prefix || 'EOFF') + '-' + yyyymmdd_(new Date()) + '-' + shortId;
}

/**
 * Safely resolve the session from a token payload.
 */
function requireAuth_(payload) {
  const token = payload && payload._token;
  if (!token) throw new Error('UNAUTHORIZED: token kosong');
  const sh = getSheet_(CONFIG.SHEETS.SESSIONS);
  const row = findRow_(sh, 'token', token);
  if (!row) throw new Error('UNAUTHORIZED: session tidak ditemukan');
  const exp = new Date(row.expiresAt);
  if (exp < new Date()) throw new Error('UNAUTHORIZED: session expired');
  return row;
}

function requireRole_(payload, roles) {
  const s = requireAuth_(payload);
  if (roles && roles.indexOf(s.role) < 0) throw new Error('FORBIDDEN: role tidak diizinkan');
  return s;
}
