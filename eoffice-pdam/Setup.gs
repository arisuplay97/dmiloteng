/**
 * Setup.gs
 * One-time initializer that creates the Spreadsheet database,
 * a Drive folder for attachments, and seeds the first admin user.
 *
 * Run `Setup_run()` ONCE from the Apps Script editor after creating
 * the project, or call action `setup.init` via the API.
 */

/**
 * Manual runner (click ▶ in Apps Script editor).
 */
function Setup_run() {
  const res = Setup_init({});
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/**
 * Quickly check whether the app is already initialised.
 */
function Setup_status() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty(CONFIG.PROP_SS_ID);
  const folderId = props.getProperty(CONFIG.PROP_DRIVE_FOLDER_ID);
  return ok({
    initialized: !!ssId,
    spreadsheetId: ssId || null,
    folderId: folderId || null,
    version: APP_VERSION
  });
}

/**
 * Main initializer. Idempotent — re-running will not overwrite data.
 */
function Setup_init() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(CONFIG.PROP_SS_ID);
  let folderId = props.getProperty(CONFIG.PROP_DRIVE_FOLDER_ID);
  let ss;

  // 1. Create / open the database spreadsheet
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('DB - ' + APP_NAME);
    ssId = ss.getId();
    props.setProperty(CONFIG.PROP_SS_ID, ssId);
  }

  // 2. Create / open Drive folder for attachments
  let folder;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = null;
    }
  }
  if (!folder) {
    folder = DriveApp.createFolder(APP_NAME + ' - Attachments');
    folderId = folder.getId();
    props.setProperty(CONFIG.PROP_DRIVE_FOLDER_ID, folderId);
  }

  // 3. Ensure all sheets + headers exist
  ensureSheet_(ss, CONFIG.SHEETS.USERS, [
    'id', 'username', 'password', 'nama', 'email', 'jabatan', 'role',
    'unit', 'active', 'createdAt', 'updatedAt'
  ]);
  ensureSheet_(ss, CONFIG.SHEETS.SURAT_MASUK, [
    'id', 'noAgenda', 'noSurat', 'tanggalSurat', 'tanggalTerima',
    'pengirim', 'perihal', 'sifat', 'jenis',
    'fileUrl', 'fileName', 'barcode',
    'status', 'keterangan',
    'createdBy', 'createdAt', 'updatedAt'
  ]);
  ensureSheet_(ss, CONFIG.SHEETS.SURAT_KELUAR, [
    'id', 'noSurat', 'tanggalSurat',
    'tujuan', 'perihal', 'sifat', 'jenis', 'isi',
    'fileUrl', 'fileName', 'barcode',
    'status', 'approvedBy', 'approvedAt',
    'createdBy', 'createdAt', 'updatedAt'
  ]);
  ensureSheet_(ss, CONFIG.SHEETS.DISPOSISI, [
    'id', 'suratId', 'suratType',
    'fromUser', 'toUser',
    'instruksi', 'catatan',
    'status', 'response', 'respondedAt',
    'parentId', 'createdAt'
  ]);
  ensureSheet_(ss, CONFIG.SHEETS.TRACKING, [
    'id', 'suratId', 'suratType',
    'action', 'actor', 'detail', 'timestamp'
  ]);
  ensureSheet_(ss, CONFIG.SHEETS.SESSIONS, [
    'token', 'userId', 'username', 'role', 'expiresAt', 'createdAt'
  ]);
  ensureSheet_(ss, CONFIG.SHEETS.SETTINGS, [
    'key', 'value', 'updatedAt'
  ]);

  // 4. Seed admin user if missing
  const users = getSheet_(CONFIG.SHEETS.USERS);
  const existing = findRow_(users, 'username', CONFIG.DEFAULT_ADMIN.username);
  if (!existing) {
    const now = new Date();
    users.appendRow([
      Utilities.getUuid(),
      CONFIG.DEFAULT_ADMIN.username,
      hashPassword_(CONFIG.DEFAULT_ADMIN.password),
      CONFIG.DEFAULT_ADMIN.nama,
      CONFIG.DEFAULT_ADMIN.email,
      CONFIG.DEFAULT_ADMIN.jabatan,
      CONFIG.DEFAULT_ADMIN.role,
      'IT',
      true,
      now,
      now
    ]);
  }

  return ok({
    message: 'Initialization complete',
    spreadsheetId: ssId,
    spreadsheetUrl: ss.getUrl(),
    folderId: folderId,
    folderUrl: folder.getUrl(),
    admin: {
      username: CONFIG.DEFAULT_ADMIN.username,
      password: CONFIG.DEFAULT_ADMIN.password
    }
  });
}

/**
 * Create a sheet with header row if it does not exist.
 */
function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0f172a')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
  } else {
    // If headers missing, set them on row 1
    const row1 = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn() || headers.length)).getValues()[0];
    const empty = row1.every(function (v) { return v === '' || v === null; });
    if (empty) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#0f172a')
        .setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  }
  // Default tab colour for visual grouping
  try { sh.setTabColor('#3b82f6'); } catch (_) {}
  return sh;
}

/**
 * Drop the initial spreadsheet (DANGER - only used for dev).
 */
function Setup_reset() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(CONFIG.PROP_SS_ID);
  props.deleteProperty(CONFIG.PROP_DRIVE_FOLDER_ID);
  Logger.log('Properties cleared. Run Setup_run() to rebuild.');
}
