// ============================================================
// SIAGA TIARA - Sistem Informasi Aduan Gangguan Air
// PERUMDAM Tirta Ardhia Rinjani - Lombok Tengah
// Versi: 10.9.43 - SYNC ADUAN TO CABANG
// ============================================================
//
// PERUBAHAN V10.9.11:
// - Session WhatsApp -> CacheService (RAM) sebagai primary, Spreadsheet backup
//   Estimasi hemat: 1-2 detik per pesan masuk
// - shouldUseInteractiveMenu_ di-cache per eksekusi (sebelumnya dipanggil 5x)
//   Estimasi hemat: ~1 detik per pesan
// - PropertiesService di-cache global per eksekusi, tidak buka koneksi ulang
//   Estimasi hemat: ~0.5 detik per pesan
// - Total estimasi percepatan: 2-4 detik per pesan
// ============================================================
//
// Hak Cipta / Copyright © 2026
// Dibuat dan dikembangkan oleh:
// Muh Sofiyan Hawari
//
// Sistem ini dibuat sebagai inovasi internal untuk mendukung
// monitoring, pencatatan, pelaporan, dan verifikasi aduan gangguan
// pada PERUMDAM Tirta Ardhia Rinjani.
//
// Dilarang menyalin, mengubah, mendistribusikan, atau menggunakan
// sistem ini di luar kebutuhan internal tanpa izin pembuat.
//
// ============================================================

// ============================================================
// KONFIGURASI SISTEM
// ============================================================
var CONFIG = {
  SHEET_NAME: 'ADUAN',
  SETTINGS_SHEET: 'SETTINGS',
  EXPORT_LOG_SHEET: 'LOG_EXPORT_PDF',
  EXPORT_DETAIL_SHEET: 'LOG_EXPORT_DETAIL',
  ARCHIVE_LOG_SHEET: 'LOG_ARSIP',
  APP_NAME: 'SIAGA TIARA',
  INPUT_SHEET_PREFIX: 'INPUT_',
  INPUT_LOG_SHEET: 'LOG_INPUT_CABANG',
  WHATSAPP_LOG_SHEET: 'LOG_WHATSAPP',
  WHATSAPP_SESSION_SHEET: 'SESSION_WHATSAPP',
  PENGUMUMAN_SHEET: 'PENGUMUMAN',
  STATUS_NOTIF_LOG_SHEET: 'LOG_NOTIF_STATUS',
  PETUGAS_CABANG_SHEET: 'PETUGAS_CABANG',
  WHATSAPP_DEFAULT_REPLY_MODE: 'AUTO',
  WHATSAPP_PROVIDER: 'KIRIMIN_ID',
  WHATSAPP_DEVICE_ID: '',
  WHATSAPP_CUSTOMER_ID_FIELD: 'customer_id',
  WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT: 'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}',
  WHATSAPP_INTERACTIVE_ENDPOINT: 'https://apiapp.kirimin.id/api/v1/public/messages/send',
  WHATSAPP_USE_INTERACTIVE_MENU: 'YA',
  BUSINESS_HOURS_ENABLED: 'YA',
  BUSINESS_HOURS_START: '08:00',
  BUSINESS_HOURS_END: '16:00',
  BUSINESS_HOURS_DAYS: '1,2,3,4,5', // 1=Senin ... 5=Jumat
  BUSINESS_HOURS_TIMEZONE: 'Asia/Makassar',
  CREATOR: 'Muh Sofiyan Hawari',
  COPYRIGHT: '© 2026 Muh Sofiyan Hawari',

  // Aduan masuk Fokus Penanganan jika sisa SLA <= 25% dari SLA.
  // Contoh: Sedang 8 jam -> masuk fokus jika sisa <= 2 jam.
  FOCUS_SLA_PERCENT: 0.25,

  // WhatsApp customer service window untuk notifikasi status gratis/free-form
  STATUS_NOTIF_WINDOW_HOURS: 24,

  // Batas aduan aktif pelanggan per nomor WhatsApp
  MAX_ACTIVE_ADUAN_PER_PHONE: 2,

  // Timeout session WhatsApp
  SESSION_TIMEOUT_MAIN_MINUTES: 15,
  SESSION_TIMEOUT_INPUT_MINUTES: 30,

  // Pengumuman Layanan
  // Ubah angka ini saja untuk mengatur jeda tampil ulang pengumuman per nomor WhatsApp.
  // Contoh: 1 = 1 jam, 6 = 6 jam, 24 = 24 jam.
  // Isi 0 jika pengumuman ingin muncul setiap kali pelanggan membuka Menu Utama.
  PENGUMUMAN_REPEAT_HOURS: 6,

  // Jika YA, pengumuman yang tanggal SELESAI-nya sudah lewat akan otomatis diubah menjadi NONAKTIF.
  // Kalau TIDAK, pengumuman hanya tidak tampil, tetapi STATUS di sheet tetap AKTIF.
  PENGUMUMAN_AUTO_NONAKTIF_EXPIRED: 'YA',

  // Sinkron otomatis INPUT cabang ke ADUAN.
  // Ubah angka ini saja untuk mengatur jeda sync.
  // Aman dipakai: 1, 5, 10, 15, atau 30 menit.
  // Default sekarang: 5 menit.
  SYNC_INPUT_INTERVAL_MINUTES: 5,

  // Kolom (1-indexed)
  COL: {
    ID: 1,
    WAKTU_MASUK: 2,
    CABANG: 3,
    WILAYAH: 4,
    DESA: 5, // Dipakai sebagai No Pelanggan mulai V10.9.4
    NO_PELANGGAN: 5,
    NAMA_PELANGGAN: 6,
    NO_HP: 7,
    JENIS_GANGGUAN: 8,
    PRIORITAS: 9,
    STATUS: 10,
    UNIT: 11,
    KETERANGAN: 12,
    CATATAN: 13,
    WAKTU_SELESAI: 14,
    SLA_JAM: 15,       // HIDDEN
    UPDATED_AT: 16,    // HIDDEN
    LATITUDE: 17,
    LONGITUDE: 18,
    LINK_MAPS: 19,
    LOKASI_DETAIL: 20
  },

  // SLA berdasarkan prioritas (jam)
  SLA: {
    'Darurat': 2,
    'Tinggi': 4,
    'Sedang': 8,
    'Rendah': 24
  },

  // Dropdown options
  CABANG: [
    'Cabang Praya',
    'Cabang Praya Tengah',
    'Cabang Praya Barat',
    'Cabang Praya Barat Daya',
    'Cabang Praya Timur',
    'Cabang Pujut',
    'Cabang Jonggat',
    'Cabang Batukliang',
    'Cabang Batukliang Utara',
    'Cabang Kopang',
    'Cabang Janapria',
    'Cabang Pringgarata'
  ],

  WILAYAH: [
    'Praya', 'Praya Tengah', 'Praya Barat', 'Praya Barat Daya',
    'Praya Timur', 'Pujut', 'Jonggat', 'Batukliang',
    'Batukliang Utara', 'Kopang', 'Janapria', 'Pringgarata', 'Lainnya'
  ],

  JENIS_GANGGUAN: [
    'Air Mati', 'Tekanan Rendah', 'Air Keruh', 'Pipa Bocor',
    'Meter Bermasalah', 'Tagihan', 'Sambungan Baru', 'Lainnya'
  ],

  PRIORITAS: ['Rendah', 'Sedang', 'Tinggi', 'Darurat'],
  STATUS: ['Baru', 'Proses', 'Selesai', 'Ditunda', 'Batal'],
  UNIT: ['Cabang', 'Hublang', 'Teknik', 'Distribusi', 'Produksi', 'IT', 'Lainnya']
};

// Mapping kode cabang untuk ID aduan.
// Format ID: KODECABANG-YYYYMMDD-0001
var CABANG_CODE = {
  'Cabang Praya': 'PRY',
  'Cabang Pujut': 'PJT',
  'Cabang Jonggat': 'JGT',
  'Cabang Kopang': 'KPG',
  'Cabang Janapria': 'JNP',
  'Cabang Batukliang': 'BTK',
  'Cabang Batukliang Utara': 'BTU',
  'Cabang Pringgarata': 'PGR',
  'Cabang Praya Barat': 'PRB',
  'Cabang Praya Barat Daya': 'PRBD',
  'Cabang Praya Timur': 'PRT',
  'Cabang Praya Tengah': 'PTE',
  'Cabang Lainnya': 'LNY'
};

// V10.9.40:
// Sheet INPUT_* tidak dipakai lagi agar spreadsheet tidak terlalu banyak sheet.
// Manual input sekarang dilakukan langsung dari sheet CABANG_*.
// Daftar lama disimpan hanya untuk fitur pembersihan/hapus sheet INPUT lama.
var LEGACY_CABANG_INPUT_SHEETS = [
  { cabang: 'Cabang Praya', sheet: 'INPUT_PRAYA', code: 'PRY' },
  { cabang: 'Cabang Pujut', sheet: 'INPUT_PUJUT', code: 'PJT' },
  { cabang: 'Cabang Jonggat', sheet: 'INPUT_JONGGAT', code: 'JGT' },
  { cabang: 'Cabang Kopang', sheet: 'INPUT_KOPANG', code: 'KPG' },
  { cabang: 'Cabang Janapria', sheet: 'INPUT_JANAPRIA', code: 'JNP' },
  { cabang: 'Cabang Batukliang', sheet: 'INPUT_BATUKLIANG', code: 'BTK' },
  { cabang: 'Cabang Batukliang Utara', sheet: 'INPUT_BATUKLIANG_UTARA', code: 'BTU' },
  { cabang: 'Cabang Pringgarata', sheet: 'INPUT_PRINGGARATA', code: 'PGR' },
  { cabang: 'Cabang Praya Barat', sheet: 'INPUT_PRAYA_BARAT', code: 'PRB' },
  { cabang: 'Cabang Praya Barat Daya', sheet: 'INPUT_PRAYA_BARAT_DAYA', code: 'PRBD' },
  { cabang: 'Cabang Praya Timur', sheet: 'INPUT_PRAYA_TIMUR', code: 'PRT' },
  { cabang: 'Cabang Praya Tengah', sheet: 'INPUT_PRAYA_TENGAH', code: 'PTE' }
];

var CABANG_INPUT_SHEETS = [];


// ============================================================
// MENU CUSTOM
// ============================================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();

  var whatsappMenu = ui.createMenu('📲 WhatsApp')
    .addItem('🔑 Simpan Konfigurasi API', 'setWhatsAppApiConfig')
    .addItem('🕒 Atur Jam Kerja Admin', 'setBusinessHoursConfig')
    .addItem('🧪 Tes Jam Kerja Admin', 'testBusinessHoursMessage')
    .addItem('🧪 Tes Kirim Pesan', 'testKiriminSendMessage')
    .addItem('🧪 Tes List Menu', 'testKiriminInteractiveMenu')
    .addSeparator()
    .addItem('📢 Setup Sheet Pengumuman', 'setupPengumumanSheet')
    .addItem('📢 Buka Sheet Pengumuman', 'openPengumumanSheet')
    .addSeparator()
    .addItem('🔔 Aktifkan Notif Status Pelanggan', 'installStatusNotificationTrigger')
    .addItem('⚙️ Atur Batas Aduan Aktif', 'setMaxActiveAduanPerPhone')
    .addItem('🧪 Cek Aduan Aktif by No WA', 'cekAduanAktifByPhone')
    .addItem('🧪 Tes Notif Status Pelanggan', 'testCustomerStatusNotificationById')
    .addItem('🧪 Cek Window 24 Jam by ID', 'cekWindow24JamPelangganById')
    .addSeparator()
    .addItem('📑 Buka Log WhatsApp', 'openWhatsAppLog')
    .addItem('🔔 Buka Log Notif Status', 'openStatusNotifLogSheet')
    .addItem('🧾 Buka Session WhatsApp', 'openWhatsAppSessionSheet');

  var petugasMenu = ui.createMenu('👷 Petugas')
    .addItem('Setup Petugas Cabang', 'setupPetugasCabangSheet')
    .addItem('Buka Petugas Cabang', 'openPetugasCabangSheet')
    .addItem('🔎 Cek Petugas Cabang Aktif', 'cekPetugasCabangAktif')
    .addItem('🧪 Tes Notifikasi Petugas', 'testDirectNotifikasiPetugasByCabang');

  var cabangMenu = ui.createMenu('🏢 Cabang')
    .addItem('Setup Sheet Aduan Cabang', 'setupCabangMirrorSheets')
    .addItem('Refresh Dropdown Status/Unit Cabang', 'refreshAllCabangMirrorDropdowns')
    .addItem('Sinkron ADUAN ke Sheet Cabang', 'syncAllAduanToCabangMirror')
    .addItem('Sinkron Manual Sheet Cabang ke ADUAN', 'syncAllCabangInputs')
    .addItem('Hapus Sheet INPUT Lama', 'deleteLegacyInputCabangSheets')
    .addItem('Perbaiki Cabang PRBD dari LNY', 'fixPrayaBaratDayaFromLny')
    .addItem('🧪 Tes Copy Aduan ke Sheet Cabang', 'testMirrorAduanToCabangSheet');

  var perbaikanMenu = ui.createMenu('🛠️ Perbaikan Data')
    .addItem('Perbaiki Share Location Lama', 'fixExistingShareLocationRows')
    .addItem('Perbaiki Prioritas / Status / Unit', 'fixExistingPriorityStatusUnitRows')
    .addItem('Update Kolom No Pelanggan', 'updateKolomNoPelanggan')
    .addSeparator()
    .addItem('Reset Fast Mode / Cache', 'resetSiagaFastCache')
    .addItem('Rebuild Counter ID Hari Ini', 'rebuildAduanIdCounterToday')
    .addItem('Bersihkan Baris Kosong', 'bersihkanBarisKosong')
    .addItem('Rapikan Sheet', 'formatSheet');

  var arsipMenu = ui.createMenu('🗄️ Arsip')
    .addItem('Arsipkan Pilih Bulan', 'archiveChooseMonth')
    .addItem('Arsipkan Bulan Lalu', 'archiveLastMonth')
    .addItem('Arsipkan Semua Selesai/Batal', 'archiveAllClosedData')
    .addItem('Arsipkan Selesai/Batal per No WA', 'archiveClosedDataByPhone')
    .addSeparator()
    .addItem('Buka Log Arsip', 'openArchiveLog');

  var lanjutanMenu = ui.createMenu('⚙️ Lanjutan')
    .addItem('Tambah Data Contoh', 'addSampleData')
    .addItem('Urutkan Data', 'sortSheet')
    .addSeparator()
    .addItem('Aktifkan Sinkron Otomatis Sheet Cabang', 'enableAutoSyncCabang1Minute')
    .addItem('Matikan Sinkron Otomatis Sheet Cabang', 'disableAutoSyncCabangTriggers')
    .addItem('Buka Log Manual Cabang', 'openInputCabangLog')
    .addSeparator()
    .addItem('Setup WhatsApp Tracking', 'setupWhatsAppTracking')
    .addItem('Setup Menu Chat WhatsApp', 'setupWhatsAppMenuBot')
    .addItem('Tes Balasan Status WhatsApp', 'testWhatsAppStatusReply')
    .addItem('Tes Menu WhatsApp', 'testWhatsAppMenuReply')
    .addItem('Tes Cari Customer by Phone', 'testKiriminResolveCustomerByPhone')
    .addItem('Tes Notifikasi Petugas by ID', 'testNotifikasiPetugasCabang')
    .addSeparator()
    .addItem('Buka Log Export PDF', 'openExportLogSheet')
    .addItem('Arsipkan Semua Data Lama', 'archiveAllOldClosedData');

  ui.createMenu('⚡ SIAGA TIARA')
    .addItem('🔧 Setup Aman', 'setupSystem')
    .addItem('🖥️ Buka Dashboard', 'openDashboard')
    .addSeparator()
    .addSubMenu(whatsappMenu)
    .addSubMenu(petugasMenu)
    .addSubMenu(cabangMenu)
    .addSubMenu(perbaikanMenu)
    .addSubMenu(arsipMenu)
    .addSeparator()
    .addSubMenu(lanjutanMenu)
    .addToUi();
}



// ============================================================
// V10.9.4 - NO PELANGGAN / RIWAYAT ADUAN
// ============================================================



// ============================================================
// V10.9.6 - FAST LOADING / PERFORMANCE HOTFIX
// ============================================================

// V10.9.12 - Runtime property cache.
// WAJIB ADA karena V10.9.11 memakai getRuntimeProp_() dan _interactiveMenuFlag.
var _runtimePropsCache = null;
var _interactiveMenuFlag = null;

function getRuntimeProp_(key) {
  key = String(key || '').trim();
  if (!key) return '';

  if (_runtimePropsCache === null) {
    try {
      _runtimePropsCache = PropertiesService.getScriptProperties().getProperties() || {};
    } catch (e) {
      _runtimePropsCache = {};
    }
  }

  return _runtimePropsCache[key] || '';
}

function clearRuntimePropCache_() {
  _runtimePropsCache = null;
  _interactiveMenuFlag = null;
}


function isSiagaFastMode_() {
  var props = PropertiesService.getScriptProperties();
  return String(props.getProperty('SIAGA_FAST_MODE') || 'YA').toUpperCase() !== 'TIDAK';
}

function getRuntimeCache_() {
  try {
    return CacheService.getScriptCache();
  } catch (e) {
    return null;
  }
}

function cacheGet_(key) {
  var cache = getRuntimeCache_();
  if (!cache) return '';
  try { return cache.get(key) || ''; } catch(e) { return ''; }
}

function cachePut_(key, value, seconds) {
  var cache = getRuntimeCache_();
  if (!cache) return;
  try { cache.put(key, String(value || '1'), Number(seconds || 21600)); } catch(e) {}
}

function getSheetRuntimeKey_(prefix, sheet) {
  try {
    return prefix + '_' + String(sheet.getSheetId());
  } catch(e) {
    return prefix + '_default';
  }
}

function ensureRuntimeHeadersFast_(sheet) {
  if (!sheet) return;

  var key = getSheetRuntimeKey_('SIAGA_RUNTIME_HEADERS_V1096', sheet);
  if (isSiagaFastMode_() && cacheGet_(key)) return;

  try {
    var noPelangganCol = CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA || 5;
    var headerNoPel = String(sheet.getRange(1, noPelangganCol).getValue() || '').trim();
    if (headerNoPel !== 'No Pelanggan') sheet.getRange(1, noPelangganCol).setValue('No Pelanggan');

    var headers = [
      { col: CONFIG.COL.LATITUDE || 17, name: 'Latitude' },
      { col: CONFIG.COL.LONGITUDE || 18, name: 'Longitude' },
      { col: CONFIG.COL.LINK_MAPS || 19, name: 'Link Maps' },
      { col: CONFIG.COL.LOKASI_DETAIL || 20, name: 'Lokasi Detail' }
    ];

    headers.forEach(function(h) {
      var current = String(sheet.getRange(1, h.col).getValue() || '').trim();
      if (!current) sheet.getRange(1, h.col).setValue(h.name);
    });

    cachePut_(key, '1', 21600);
  } catch(e) {}
}

function truncateForLog_(value, maxLength) {
  value = String(value || '');
  maxLength = Number(maxLength || 1200);
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + '... [dipotong agar webhook lebih cepat]';
}

function resetSiagaFastCache() {
  var ui = SpreadsheetApp.getUi();
  try {
    CacheService.getScriptCache().removeAll([
      'dummy'
    ]);
  } catch(e) {}

  PropertiesService.getScriptProperties().setProperty('SIAGA_FAST_MODE', 'YA');

  ui.alert(
    '✅ Fast Mode aktif',
    'Mode percepat loading sudah aktif.\n\nCatatan: cache Apps Script akan otomatis refresh sendiri. Jika ada perubahan struktur sheet besar, jalankan setup/perbaikan data manual sekali saja.',
    ui.ButtonSet.OK
  );
}

function rebuildAduanIdCounterToday() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) {
    ui.alert('Belum ada data ADUAN.');
    return;
  }

  var today = new Date();
  var datePart = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');
  var props = PropertiesService.getScriptProperties();
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var maxByCode = {};

  values.forEach(function(row) {
    var id = String(row[0] || '').trim();
    var m = id.match(/^([A-Z]+)-(\d{8})-(\d{4,})$/);
    if (!m || m[2] !== datePart) return;
    var code = m[1];
    var num = Number(m[3] || 0);
    if (!maxByCode[code] || num > maxByCode[code]) maxByCode[code] = num;
  });

  Object.keys(maxByCode).forEach(function(code) {
    props.setProperty('SEQ_' + code + '_' + datePart, String(maxByCode[code]));
  });

  ui.alert(
    '✅ Counter ID diperbarui',
    'Counter ID hari ini sudah disesuaikan dari sheet ADUAN.\n\n' + JSON.stringify(maxByCode, null, 2),
    ui.ButtonSet.OK
  );
}


function ensureNoPelangganColumnHeader_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) return;

  var __fastKey = getSheetRuntimeKey_('NOPEL_SETUP_FAST_V1096', sh);
  if (isSiagaFastMode_() && cacheGet_(__fastKey)) return;

  var col = CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA || 5;
  sh.getRange(1, col).setValue('No Pelanggan');
  try { sh.setColumnWidth(col, 130); } catch(e) {}

  // Mirror cabang juga ikut dirapikan jika sheet sudah ada.
  Object.keys(CABANG_CODE || {}).forEach(function(cabang) {
    var sheetName = getCabangMirrorSheetName_(cabang);
    var csh = ss.getSheetByName(sheetName);
    if (csh) {
      csh.getRange(1, col).setValue('No Pelanggan');
      try { csh.setColumnWidth(col, 130); } catch(e) {}
    }
  });
  cachePut_(__fastKey, '1', 21600);

}

function updateKolomNoPelanggan() {
  var ui = SpreadsheetApp.getUi();
  ensureNoPelangganColumnHeader_();
  ui.alert(
    '✅ Kolom diperbarui',
    'Kolom ke-5 pada ADUAN dan sheet cabang sudah diganti menjadi: No Pelanggan.\n\nData lama tidak dihapus dan posisi kolom tidak digeser.',
    ui.ButtonSet.OK
  );
}

function getNoPelangganFromAduan_(d) {
  d = d || {};
  return String(d.noPelanggan || d.desa || '').trim();
}


function setupSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  try {
    setupAduanSheet(ss);
    setupSettingsSheet(ss);
    setupExportLogSheet(ss);
    setupExportDetailSheet(ss);
    setupArchiveLogSheet(ss);
    setupInputCabangLogSheet(ss);
    setupWhatsAppLogSheet(ss);
    setupWhatsAppSessionSheet(ss);
    setupPetugasCabangSheet(ss);
    setupCabangMirrorSheets(ss);
    ensureNoPelangganColumnHeader_();

    ui.alert(
      '✅ Setup Berhasil!',
      'Setup aman selesai. Data lama tidak dihapus. Sheet ADUAN, SETTINGS, WhatsApp, petugas, dan kolom lokasi telah dicek.\n\n' +
      'Langkah selanjutnya:\n' +
      '1. Klik "Deploy" → "New Deployment" di Apps Script\n' +
      '2. Pilih type "Web App"\n' +
      '3. Set Execute as: Me, Who has access: Anyone\n' +
      '4. Copy URL deploy ke sheet SETTINGS\n' +
      '5. Gunakan menu "Buka Dashboard" untuk membuka dashboard',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('❌ Error: ' + e.message);
  }
}

function setupAduanSheet(ss) {
  // SAFE SETUP V9.6:
  // Jangan pernah clear sheet ADUAN karena bisa menghapus data operasional.
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  var headers = [
    'ID Aduan', 'Waktu Masuk', 'Cabang', 'Wilayah/Kecamatan',
    'No Pelanggan', 'Nama Pelanggan', 'No HP', 'Jenis Gangguan', 'Prioritas',
    'Status', 'Unit/Petugas', 'Keterangan Aduan', 'Catatan Tindak Lanjut',
    'Waktu Selesai', 'SLA Jam', 'Updated At',
    'Latitude', 'Longitude', 'Link Maps', 'Lokasi Detail'
  ];

  // Pastikan kolom cukup.
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  // Set header saja, data baris 2 dst tetap aman.
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  headerRange
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');

  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  var colWidths = [130, 140, 140, 130, 130, 140, 120, 120, 80, 80, 100, 200, 200, 140, 70, 130, 100, 100, 220, 220];
  for (var i = 0; i < colWidths.length; i++) {
    try { sheet.setColumnWidth(i + 1, colWidths[i]); } catch(e) {}
  }

  // Sembunyikan kolom teknis (SLA Jam & Updated At)
  try {
    sheet.showColumns(1, Math.min(sheet.getMaxColumns(), headers.length));
    sheet.hideColumns(CONFIG.COL.SLA_JAM, 2);
  } catch(e) {}

  // Aktifkan ulang filter tanpa menghapus data.
  try {
    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.getRange(1, 1, Math.max(safeGetLastRow_(sheet), 2), 14).createFilter();
  } catch(e) {}

  // Dropdown & formatting: jangan dipaksa jika sheet sedang memakai Google Sheets Table/typed columns.
  // Typed columns dapat menolak operasi Apps Script seperti setDataValidation/setValue tertentu.
  try {
    if (typeof addDropdownValidations === 'function') addDropdownValidations(sheet);
  } catch(e) {}
  try {
    if (typeof addConditionalFormatting === 'function') addConditionalFormatting(sheet);
  } catch(e) {}

  // Pastikan kolom lokasi tersedia tanpa clear data.
  setupLocationColumns_(sheet);

  ss.setActiveSheet(sheet);
  return sheet;

  ensureNoPelangganColumnHeader_();

}


function setupSettingsSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SETTINGS_SHEET);
    ss.setActiveSheet(ss.getSheetByName(CONFIG.SHEET_NAME));
  }

  sheet.clear();

  var settingsData = [
    ['SIAGA TIARA - Pengaturan Sistem', ''],
    ['', ''],
    ['Parameter', 'Nilai'],
    ['URL Dashboard', ''],
    ['Nama Sistem', 'SIAGA TIARA'],
    ['Instansi', 'PERUMDAM Tirta Ardhia Rinjani'],
    ['Versi', '1.0.0'],
    ['Dibuat', new Date().toLocaleDateString('id-ID')]
  ];

  sheet.getRange(1, 1, settingsData.length, 2).setValues(settingsData);

  // Style
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold').setFontColor('#1e3a5f');
  sheet.getRange(3, 1, 1, 2).setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 400);
}


function setupExportLogSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.EXPORT_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.EXPORT_LOG_SHEET);
  }

  var headers = [
    'Report ID',
    'Tanggal Export',
    'Periode',
    'Cabang',
    'Wilayah',
    'Total Aduan',
    'Aduan Aktif',
    'Selesai',
    'Lewat SLA',
    'Verification URL',
    'PDF File Name',
    'Aduan IDs'
  ];

  // Jangan clear isi log, supaya data verifikasi lama tidak hilang.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function setupExportDetailSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.EXPORT_DETAIL_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.EXPORT_DETAIL_SHEET);
  }

  var headers = [
    'Report ID',
    'No',
    'ID Aduan',
    'Waktu',
    'Cabang',
    'Wilayah',
    'Pelanggan',
    'No HP',
    'Jenis',
    'Prioritas',
    'Status',
    'Unit',
    'SLA',
    'Keterangan'
  ];

  // Jangan clear isi detail, supaya halaman verify selalu membaca snapshot saat PDF dibuat.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function openExportLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupExportLogSheet(ss);
  setupExportDetailSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.EXPORT_LOG_SHEET));
}


// ============================================================
// [REMOVED V10.9.44] Duplikasi onEdit lama dihapus.
// onEdit aktif ada di baris bawah (V10.9.38+) yang sudah handle
// CABANG mirror + enforce Priority + sync dua arah.
// ============================================================

// ============================================================
// GENERATE ID ADUAN
// ============================================================
function generateId(sheet) {
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');
  var prefix = 'ADU-' + dateStr + '-';

  var lastRow = sheet.getLastRow();
  var maxNum = 0;

  if (lastRow > 1) {
    var ids = sheet.getRange(2, CONFIG.COL.ID, lastRow - 1, 1).getValues();
    ids.forEach(function(row) {
      var id = row[0] ? String(row[0]) : '';
      if (id.startsWith(prefix)) {
        var num = parseInt(id.split('-')[3], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }

  var newNum = String(maxNum + 1).padStart(4, '0');
  return prefix + newNum;
}

// ============================================================
// WEB APP - doGet
// ============================================================
function doGet(e) {
  if (e && e.parameter && e.parameter.wa_ping) {
    return jsonOutput_({ success: true, app: CONFIG.APP_NAME, module: 'WHATSAPP_TRACKING', time: new Date().toISOString() });
  }

  if (e && e.parameter && e.parameter.track) {
    return jsonOutput_(getAduanTrackingResponse_(String(e.parameter.track || ''), String(e.parameter.phone || '')));
  }

  if (e && e.parameter && e.parameter.verify) {
    var template = HtmlService.createTemplateFromFile('Verify');
    template.report = getVerificationReport_(e.parameter.verify);

    return template.evaluate()
      .setTitle('Verifikasi Laporan - SIAGA TIARA')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('SIAGA TIARA - Dashboard Monitoring')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// ============================================================
// CLIENT API - ambil semua data dashboard
// ============================================================
function clientGetDashboardData(filters) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet || sheet.getLastRow() < 2) {
      return getEmptyData();
    }

    var lastRow = sheet.getLastRow();
    var rawData = sheet.getRange(2, 1, lastRow - 1, 16).getValues();

    // Parse & filter data
    var allData = parseData(rawData);
    var filteredData = applyFilters(allData, filters || {});

    var now = new Date();
    var todayStr = formatDateStr(now);

    // === STATISTIK CARDS ===
    var aduanHariIni = filteredData.filter(function(d) {
      return formatDateStr(d.waktuMasuk) === todayStr;
    }).length;

    var aduanAktif = filteredData.filter(function(d) {
      return d.status !== 'Selesai' && d.status !== 'Batal';
    }).length;

    var lewatSLA = filteredData.filter(function(d) {
      if (d.status === 'Selesai' || d.status === 'Batal') return false;
      if (!d.waktuMasuk || !d.slaJam) return false;
      var umurJam = (now - d.waktuMasuk) / 3600000;
      return umurJam > d.slaJam;
    }).length;

    var selesaiHariIni = filteredData.filter(function(d) {
      return d.status === 'Selesai' &&
             d.waktuSelesai &&
             formatDateStr(d.waktuSelesai) === todayStr;
    }).length;

    // === RINGKASAN SIDEBAR ===
    var now2 = new Date();
    var firstOfMonth = new Date(now2.getFullYear(), now2.getMonth(), 1);

    var aduanBulanIni = filteredData.filter(function(d) {
      return d.waktuMasuk >= firstOfMonth;
    }).length;

    var prioritasTinggi = filteredData.filter(function(d) {
      return (d.prioritas === 'Tinggi' || d.prioritas === 'Darurat') &&
             d.status !== 'Selesai' && d.status !== 'Batal';
    }).length;

    // === TREN 7 HARI ===
    var tren7Hari = getTren7Hari(filteredData, now);
    var tren7HariCabang = getTren7HariCabang(filteredData, now);

    // === STATUS CHART ===
    var statusCount = getStatusCount(filteredData);

    // === JENIS GANGGUAN ===
    var jenisCount = getJenisCount(filteredData);

    // === CABANG RANKING ===
    var cabangRanking = getCabangRanking(filteredData, firstOfMonth);

    // === TABEL FOKUS ===
    var tabelFokus = getTabelFokus(filteredData, now);

    // === TABEL TERBARU ===
    var tabelTerbaru = getTabelTerbaru(filteredData, now, todayStr);

    // === TABEL ADUAN SELESAI ===
    var tabelSelesai = getTabelSelesai(filteredData);

    return {
      success: true,
      lastUpdate: Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
      cards: {
        aduanHariIni: aduanHariIni,
        aduanAktif: aduanAktif,
        lewatSLA: lewatSLA,
        selesaiHariIni: selesaiHariIni
      },
      sidebar: {
        aduanBulanIni: aduanBulanIni,
        prioritasTinggi: prioritasTinggi,
        lewatSLA: lewatSLA
      },
      charts: {
        tren7Hari: tren7Hari,
        tren7HariCabang: tren7HariCabang,
        statusCount: statusCount,
        jenisCount: jenisCount,
        cabangRanking: cabangRanking
      },
      tables: {
        fokus: tabelFokus,
        terbaru: tabelTerbaru,
        selesai: tabelSelesai,
        laporanDetail: [] // laporan detail diambil khusus saat Export PDF agar dashboard lebih ringan
      },
      meta: {
        cabangList: CONFIG.CABANG,
        wilayahList: CONFIG.WILAYAH
      }
    };
  } catch (e) {
    Logger.log('Error clientGetDashboardData: ' + e.message + '\n' + e.stack);
    return { success: false, error: e.message };
  }
}


/**
 * Mengambil data khusus untuk Export PDF.
 * Dashboard reguler tidak mengirim laporan detail agar loading tetap ringan.
 *
 * reportOptions:
 * - period: today | this_month | last_month | custom | all
 * - startDate: yyyy-mm-dd
 * - endDate: yyyy-mm-dd
 * - cabang: Semua / nama cabang
 * - wilayah: Semua / nama wilayah
 */
function clientGetPdfReportData(reportOptions) {
  try {
    reportOptions = reportOptions || {};

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet || sheet.getLastRow() < 2) {
      var emptyMeta = buildReportMeta_(reportOptions, getReportDateRange_(reportOptions, new Date()), new Date());
      var reportIdEmpty = generateReportId_();
      var verificationUrlEmpty = buildVerificationUrl_(reportOptions.dashboardUrl || '', reportIdEmpty);
      emptyMeta.reportId = reportIdEmpty;
      emptyMeta.verificationUrl = verificationUrlEmpty;
      emptyMeta.pdfFileName = 'Laporan_Gangguan_' + (emptyMeta.fileAt || 'NA') + '.pdf';
      logExportReport_(emptyMeta, getEmptyReportStats_(), []);

      return {
        success: true,
        detailRows: [],
        cabangSummary: [],
        stats: getEmptyReportStats_(),
        meta: emptyMeta,
        qrImageDataUrl: getQrImageDataUrl_(verificationUrlEmpty)
      };
    }

    var now = new Date();
    var range = getReportDateRange_(reportOptions, now);
    var rawData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getValues();
    var allData = parseData(rawData);

    var filtered = allData.filter(function(d) {
      if (!d.waktuMasuk) return false;

      if (range.start && d.waktuMasuk < range.start) return false;
      if (range.end && d.waktuMasuk >= range.end) return false;

      if (reportOptions.cabang && reportOptions.cabang !== 'Semua' && d.cabang !== reportOptions.cabang) return false;
      if (reportOptions.wilayah && reportOptions.wilayah !== 'Semua' && d.wilayah !== reportOptions.wilayah) return false;

      return true;
    });

    var stats = buildReportStats_(filtered, now);
    var cabangSummary = buildCabangReportSummary_(filtered, now);
    var detailRows = buildReportDetailRows_(filtered, now);

    var meta = buildReportMeta_(reportOptions, range, now);
    var reportId = generateReportId_();
    var verificationUrl = buildVerificationUrl_(reportOptions.dashboardUrl || '', reportId);

    meta.reportId = reportId;
    meta.verificationUrl = verificationUrl;
    meta.pdfFileName = 'Laporan_Gangguan_' + (meta.fileAt || Date.now()) + '.pdf';

    logExportReport_(meta, stats, detailRows);

    return {
      success: true,
      stats: stats,
      cabangSummary: cabangSummary,
      detailRows: detailRows,
      meta: meta,
      qrImageDataUrl: getQrImageDataUrl_(verificationUrl)
    };
  } catch (e) {
    Logger.log('Error clientGetPdfReportData: ' + e.message + '\n' + e.stack);
    return { success: false, error: e.message };
  }
}

function getEmptyReportStats_() {
  return {
    total: 0,
    aktif: 0,
    selesai: 0,
    batal: 0,
    lewatSLA: 0,
    prioritasTinggi: 0
  };
}

function buildReportStats_(data, now) {
  var stats = getEmptyReportStats_();
  stats.total = data.length;

  data.forEach(function(d) {
    if (d.status === 'Selesai') stats.selesai++;
    if (d.status === 'Batal') stats.batal++;
    if (d.status !== 'Selesai' && d.status !== 'Batal') stats.aktif++;

    if ((d.prioritas === 'Darurat' || d.prioritas === 'Tinggi') &&
        d.status !== 'Selesai' && d.status !== 'Batal') {
      stats.prioritasTinggi++;
    }

    if (d.status !== 'Selesai' && d.status !== 'Batal') {
      var sla = getSlaInfo_(d, now);
      if (sla.overdue) stats.lewatSLA++;
    }
  });

  return stats;
}

function buildCabangReportSummary_(data, now) {
  var map = {};

  CONFIG.CABANG.forEach(function(cabang) {
    map[cabang] = {
      cabang: cabang,
      total: 0,
      aktif: 0,
      selesai: 0,
      batal: 0,
      lewatSLA: 0,
      tinggiDarurat: 0
    };
  });

  data.forEach(function(d) {
    var key = d.cabang || 'Tanpa Cabang';
    if (!map[key]) {
      map[key] = {
        cabang: key,
        total: 0,
        aktif: 0,
        selesai: 0,
        batal: 0,
        lewatSLA: 0,
        tinggiDarurat: 0
      };
    }

    map[key].total++;
    if (d.status === 'Selesai') map[key].selesai++;
    if (d.status === 'Batal') map[key].batal++;
    if (d.status !== 'Selesai' && d.status !== 'Batal') map[key].aktif++;

    if ((d.prioritas === 'Darurat' || d.prioritas === 'Tinggi') &&
        d.status !== 'Selesai' && d.status !== 'Batal') {
      map[key].tinggiDarurat++;
    }

    if (d.status !== 'Selesai' && d.status !== 'Batal') {
      var sla = getSlaInfo_(d, now);
      if (sla.overdue) map[key].lewatSLA++;
    }
  });

  return Object.keys(map)
    .map(function(k) { return map[k]; })
    .filter(function(r) { return r.total > 0; })
    .sort(function(a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return String(a.cabang || '').localeCompare(String(b.cabang || ''));
    });
}

function buildReportDetailRows_(data, now) {
  return data.slice().sort(function(a, b) {
    if (String(a.cabang || '') !== String(b.cabang || '')) {
      return String(a.cabang || '').localeCompare(String(b.cabang || ''));
    }
    return (b.waktuMasuk || 0) - (a.waktuMasuk || 0);
  }).slice(0, 1000).map(function(d) {
    var sla = getSlaInfo_(d, now);
    var slaText = '—';

    if (d.status === 'Selesai' || d.status === 'Batal') {
      slaText = d.status;
    } else if (sla.overdue) {
      slaText = 'Lewat ' + formatDurasiSla_(sla.overdueHours);
    } else {
      slaText = Math.round(sla.remainingHours * 10) / 10 + ' jam';
    }

    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      prioritas: d.prioritas,
      status: d.status,
      unit: d.unit,
      sla: slaText,
      keterangan: d.keterangan ? String(d.keterangan).substring(0, 150) : ''
    };
  });
}

function getReportDateRange_(options, now) {
  options = options || {};
  var period = options.period || 'this_month';

  var start = null;
  var end = null;
  var label = 'Semua Data';

  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    label = 'Hari Ini';
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    label = 'Bulan Ini (' + Utilities.formatDate(start, Session.getScriptTimeZone(), 'MM/yyyy') + ')';
  } else if (period === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
    label = 'Bulan Lalu (' + Utilities.formatDate(start, Session.getScriptTimeZone(), 'MM/yyyy') + ')';
  } else if (period === 'custom') {
    start = parseInputDate_(options.startDate);
    var endInput = parseInputDate_(options.endDate);

    if (start && endInput) {
      end = new Date(endInput.getFullYear(), endInput.getMonth(), endInput.getDate() + 1);
      label =
        Utilities.formatDate(start, Session.getScriptTimeZone(), 'dd/MM/yyyy') +
        ' - ' +
        Utilities.formatDate(endInput, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      label = 'Bulan Ini (' + Utilities.formatDate(start, Session.getScriptTimeZone(), 'MM/yyyy') + ')';
    }
  } else if (period === 'all') {
    label = 'Semua Data';
  }

  return {
    period: period,
    start: start,
    end: end,
    label: label
  };
}

function buildReportMeta_(options, range, now) {
  options = options || {};
  range = range || {};

  return {
    period: range.period || options.period || 'this_month',
    periodLabel: range.label || 'Bulan Ini',
    cabang: options.cabang && options.cabang !== 'Semua' ? options.cabang : 'Semua Cabang',
    wilayah: options.wilayah && options.wilayah !== 'Semua' ? options.wilayah : 'Semua Wilayah',
    printAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    fileAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmm')
  };
}

function parseInputDate_(value) {
  if (!value) return null;

  var parts = String(value).split('-');
  if (parts.length !== 3) return null;

  var y = Number(parts[0]);
  var m = Number(parts[1]);
  var d = Number(parts[2]);

  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d);
}


function generateReportId_() {
  // ID laporan dibuat unik dengan kombinasi waktu + potongan UUID.
  // Ini mencegah bentrok meskipun export dilakukan beberapa kali dalam detik yang sama.
  var now = new Date();
  var timePart = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var randomPart = Utilities.getUuid().split('-')[0].toUpperCase();
  return 'LAP-' + timePart + '-' + randomPart;
}

function buildVerificationUrl_(dashboardUrl, reportId) {
  var base = '';

  // Prioritas utama: URL resmi Web App dari Apps Script.
  // Jangan memakai window.location.href dari dashboard karena kadang terbaca sebagai URL sandbox.
  try {
    base = ScriptApp.getService().getUrl();
  } catch (err) {
    base = '';
  }

  // Fallback: URL Dashboard di sheet SETTINGS.
  if (!base) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
      if (sh) {
        base = String(sh.getRange(4, 2).getValue() || '').split('?')[0];
      }
    } catch (err2) {
      base = '';
    }
  }

  // Fallback terakhir: jika user mengirim URL dan itu memang script.google.com.
  if (!base && dashboardUrl && String(dashboardUrl).indexOf('script.google.com') !== -1) {
    base = String(dashboardUrl).split('?')[0];
  }

  if (!base) return '';

  return base + '?verify=' + encodeURIComponent(reportId);
}

function getQrImageDataUrl_(verificationUrl) {
  if (!verificationUrl) return '';

  try {
    var apiUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=240x240&chld=H|0&chl=' + encodeURIComponent(verificationUrl);
    var response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      return 'data:image/png;base64,' + Utilities.base64Encode(response.getContent());
    }
  } catch (err) {
    Logger.log('QR fetch error: ' + err.message);
  }

  return '';
}

function logExportReport_(meta, stats, detailRows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupExportLogSheet(ss);
  setupExportDetailSheet(ss);

  var sheet = ss.getSheetByName(CONFIG.EXPORT_LOG_SHEET);
  var detailSheet = ss.getSheetByName(CONFIG.EXPORT_DETAIL_SHEET);

  detailRows = detailRows || [];

  var aduanIds = [];
  if (detailRows.length) {
    aduanIds = detailRows.map(function(r) { return r.id || ''; }).filter(Boolean);
  }

  sheet.appendRow([
    meta.reportId        || '',
    meta.printAt         || '',
    meta.periodLabel     || '',
    meta.cabang          || 'Semua Cabang',
    meta.wilayah         || 'Semua Wilayah',
    Number(stats.total   || 0),
    Number(stats.aktif   || 0),
    Number(stats.selesai || 0),
    Number(stats.lewatSLA|| 0),
    meta.verificationUrl || '',
    meta.pdfFileName     || '',
    JSON.stringify(aduanIds)
  ]);

  // Snapshot detail laporan disimpan saat PDF dibuat.
  // Verify akan membaca sheet ini, bukan sheet ADUAN yang bisa berubah.
  if (detailRows.length) {
    var rows = detailRows.map(function(r, i) {
      return [
        meta.reportId || '',
        i + 1,
        r.id || '',
        r.waktu || '',
        r.cabang || '',
        r.wilayah || '',
        r.namaPelanggan || '',
        r.noHp || '',
        r.jenis || '',
        r.prioritas || '',
        r.status || '',
        r.unit || '',
        r.sla || '',
        r.keterangan || ''
      ];
    });

    detailSheet
      .getRange(detailSheet.getLastRow() + 1, 1, rows.length, 14)
      .setValues(rows);
  }
}

function getReportLogById_(reportId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.EXPORT_LOG_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(reportId)) {
      return {
        reportId       : values[i][0],
        tanggalExport  : values[i][1],
        periode        : values[i][2],
        cabang         : values[i][3],
        wilayah        : values[i][4],
        totalAduan     : values[i][5],
        aduanAktif     : values[i][6],
        selesai        : values[i][7],
        lewatSLA       : values[i][8],
        verificationUrl: values[i][9],
        pdfFileName    : values[i][10],
        aduanIds       : values[i][11] || ''
      };
    }
  }
  return null;
}



function getReportDetailSnapshot_(reportId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.EXPORT_DETAIL_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues();
  var rows = [];

  values.forEach(function(v) {
    if (String(v[0]) === String(reportId)) {
      var waktuRaw = v[3];
      var waktuFormatted = '';

      if (waktuRaw instanceof Date) {
        waktuFormatted = formatDisplayDate(waktuRaw);
      } else if (waktuRaw) {
        try {
          var tryDate = new Date(waktuRaw);
          if (!isNaN(tryDate.getTime()) && String(waktuRaw).indexOf('GMT') !== -1) {
            waktuFormatted = formatDisplayDate(tryDate);
          } else {
            waktuFormatted = String(waktuRaw);
          }
        } catch (e) {
          waktuFormatted = String(waktuRaw);
        }
      }

      rows.push({
        no: Number(v[1] || 0),
        id: String(v[2] || ''),
        waktu: waktuFormatted || '',
        cabang: String(v[4] || ''),
        wilayah: String(v[5] || ''),
        namaPelanggan: String(v[6] || ''),
        noHp: String(v[7] || ''),
        jenis: String(v[8] || ''),
        prioritas: String(v[9] || ''),
        status: String(v[10] || ''),
        unit: String(v[11] || ''),
        sla: String(v[12] || ''),
        keterangan: String(v[13] || '')
      });
    }
  });

  rows.sort(function(a, b) {
    return (a.no || 0) - (b.no || 0);
  });

  return rows;
}

function getVerificationReport_(reportId) {
  var row = getReportLogById_(reportId);

  if (!row) {
    return { found: false, reportId: reportId || '-' };
  }
  // Ambil detail dari snapshot laporan saat PDF dibuat.
  // Ini membuat halaman verify sama dengan isi PDF, walaupun sheet ADUAN sudah berubah.
  var detailRows = getReportDetailSnapshot_(reportId);

  // Format tanggal export
  var tglExportStr = '-';
  try {
    if (row.tanggalExport) {
      tglExportStr = Utilities.formatDate(new Date(row.tanggalExport), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    }
  } catch(e) {}

  return {
    found         : true,
    reportId      : String(row.reportId    || '-'),
    tanggalExport : tglExportStr,
    periode       : String(row.periode     || '-'),
    cabang        : String(row.cabang      || '-'),
    wilayah       : String(row.wilayah     || '-'),
    totalAduan    : Number(row.totalAduan  || 0),
    aduanAktif    : Number(row.aduanAktif  || 0),
    selesai       : Number(row.selesai     || 0),
    lewatSLA      : Number(row.lewatSLA    || 0),
    pdfFileName   : String(row.pdfFileName || '-'),
    rows          : detailRows
  };
}

function buildVerificationPage_(reportId) {
  var row = getReportLogById_(reportId);
  var found = !!row;

  var body = found
    ? '<div class="status ok">✅ Dokumen resmi SIAGA TIARA terverifikasi</div>' +
      '<div class="card-grid">' +
        renderVerifyItem_('ID Laporan', row.reportId) +
        renderVerifyItem_('Tanggal Export', row.tanggalExport) +
        renderVerifyItem_('Periode', row.periode) +
        renderVerifyItem_('Cabang', row.cabang) +
        renderVerifyItem_('Wilayah', row.wilayah) +
        renderVerifyItem_('Total Aduan', row.totalAduan) +
        renderVerifyItem_('Aduan Aktif', row.aduanAktif) +
        renderVerifyItem_('Selesai', row.selesai) +
        renderVerifyItem_('Lewat SLA', row.lewatSLA) +
        renderVerifyItem_('Nama File PDF', row.pdfFileName || '-') +
      '</div>'
    : '<div class="status no">⚠ ID laporan tidak ditemukan. Dokumen perlu diverifikasi ulang oleh admin.</div>';

  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Verifikasi Laporan</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:24px;color:#0f172a;}' +
      '.wrap{max-width:860px;margin:0 auto;}' +
      '.hero{background:#0f3b68;color:#fff;border-radius:18px;padding:24px 22px;box-shadow:0 12px 32px rgba(15,59,104,.18);}' +
      '.hero h1{margin:0 0 6px;font-size:24px;}' +
      '.hero p{margin:0;font-size:14px;opacity:.9;}' +
      '.status{margin:18px 0 0;padding:14px 16px;border-radius:14px;font-weight:700;}' +
      '.ok{background:#ecfdf5;color:#166534;border:1px solid #a7f3d0;}' +
      '.no{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}' +
      '.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px;}' +
      '.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 15px;box-shadow:0 8px 24px rgba(15,23,42,.05);}' +
      '.label{font-size:12px;color:#64748b;margin-bottom:5px;font-weight:700;}' +
      '.value{font-size:16px;color:#111827;font-weight:800;word-break:break-word;}' +
      '.note{margin-top:18px;font-size:13px;color:#475569;line-height:1.6;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 15px;}' +
      '.footer{margin-top:18px;font-size:12px;color:#64748b;}' +
    '</style></head><body><div class="wrap">' +
    '<div class="hero"><h1>Verifikasi Laporan Resmi</h1><p>SIAGA TIARA • PERUMDAM Tirta Ardhia Rinjani</p></div>' +
    body +
    '<div class="note">Scan QR pada PDF untuk membuka halaman verifikasi ini. Jika ID laporan ditemukan, maka dokumen tersebut tercatat sebagai laporan resmi yang dihasilkan oleh sistem SIAGA TIARA.</div>' +
    '<div class="footer">Generated by SIAGA TIARA</div>' +
    '</div></body></html>';
}

function renderVerifyItem_(label, value) {
  return '<div class="card"><div class="label">' + label + '</div><div class="value">' + (value || '-') + '</div></div>';
}


// ============================================================
// HELPER: Parse data dari sheet
// ============================================================
function parseData(rawData) {
  return rawData.map(function(row) {
    return {
      id:           row[CONFIG.COL.ID - 1],
      waktuMasuk:   row[CONFIG.COL.WAKTU_MASUK - 1] ? new Date(row[CONFIG.COL.WAKTU_MASUK - 1]) : null,
      cabang:       row[CONFIG.COL.CABANG - 1],
      wilayah:      row[CONFIG.COL.WILAYAH - 1],
      desa:         row[CONFIG.COL.DESA - 1],
      namaPelanggan: row[CONFIG.COL.NAMA_PELANGGAN - 1],
      noHp:         row[CONFIG.COL.NO_HP - 1],
      jenisGangguan: row[CONFIG.COL.JENIS_GANGGUAN - 1],
      prioritas:    row[CONFIG.COL.PRIORITAS - 1],
      status:       row[CONFIG.COL.STATUS - 1],
      unit:         row[CONFIG.COL.UNIT - 1],
      keterangan:   row[CONFIG.COL.KETERANGAN - 1],
      catatan:      row[CONFIG.COL.CATATAN - 1],
      waktuSelesai: row[CONFIG.COL.WAKTU_SELESAI - 1] ? new Date(row[CONFIG.COL.WAKTU_SELESAI - 1]) : null,
      slaJam:       row[CONFIG.COL.SLA_JAM - 1] || 8,
      updatedAt:    row[CONFIG.COL.UPDATED_AT - 1] ? new Date(row[CONFIG.COL.UPDATED_AT - 1]) : null
    };
  }).filter(function(d) {
    return d.id && d.waktuMasuk; // hanya baris dengan data valid
  });
}

function applyFilters(data, filters) {
  return data.filter(function(d) {
    if (filters.cabang && filters.cabang !== 'Semua' && d.cabang !== filters.cabang) return false;
    if (filters.wilayah && filters.wilayah !== 'Semua' && d.wilayah !== filters.wilayah) return false;
    return true;
  });
}

function formatDateStr(date) {
  if (!date) return '';
  try {
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch(e) { return ''; }
}

function formatDisplayDate(date) {
  if (!date) return '-';
  try {
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  } catch(e) { return '-'; }
}

// ============================================================
// HELPER: Chart data
// ============================================================
function getTren7Hari(data, now) {
  var labels = [];
  var counts = [];

  for (var i = 6; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var dayStr = formatDateStr(d);
    var dayLabel = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM');
    labels.push(dayLabel);

    var count = data.filter(function(item) {
      return item.waktuMasuk && formatDateStr(item.waktuMasuk) === dayStr;
    }).length;
    counts.push(count);
  }

  return { labels: labels, data: counts };
}

function getTren7HariCabang(data, now) {
  var labels = [];
  var dayKeys = [];

  for (var i = 6; i >= 0; i--) {
    var d = new Date(now);
    d.setDate(d.getDate() - i);
    var dayStr = formatDateStr(d);
    var dayLabel = Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM');

    dayKeys.push(dayStr);
    labels.push(dayLabel);
  }

  var datasets = CONFIG.CABANG.map(function(cabang) {
    var values = dayKeys.map(function(dayKey) {
      return data.filter(function(item) {
        return item.waktuMasuk &&
               item.cabang === cabang &&
               formatDateStr(item.waktuMasuk) === dayKey;
      }).length;
    });

    return {
      label: cabang,
      data: values
    };
  });

  return {
    labels: labels,
    datasets: datasets
  };
}


function getStatusCount(data) {
  var result = {};
  CONFIG.STATUS.forEach(function(s) { result[s] = 0; });
  data.forEach(function(d) {
    if (d.status && result.hasOwnProperty(d.status)) result[d.status]++;
  });
  return result;
}

function getJenisCount(data) {
  var result = {};
  CONFIG.JENIS_GANGGUAN.forEach(function(j) { result[j] = 0; });
  data.forEach(function(d) {
    if (d.jenisGangguan && result.hasOwnProperty(d.jenisGangguan)) result[d.jenisGangguan]++;
  });
  // Urutkan descending
  var sorted = Object.keys(result).map(function(k) {
    return { label: k, count: result[k] };
  }).sort(function(a, b) { return b.count - a.count; });
  return sorted;
}

function getCabangRanking(data, fromDate) {
  var result = {};
  CONFIG.CABANG.forEach(function(c) { result[c] = 0; });
  data.forEach(function(d) {
    if (d.waktuMasuk >= fromDate && result.hasOwnProperty(d.cabang)) {
      result[d.cabang]++;
    }
  });
  var sorted = Object.keys(result).map(function(k) {
    return { cabang: k, count: result[k] };
  }).sort(function(a, b) { return b.count - a.count; });
  return sorted.slice(0, 8); // Top 8
}

// ============================================================
// HELPER: Tabel data
// ============================================================

function isAduanAktif_(d) {
  return d.status !== 'Selesai' && d.status !== 'Batal';
}

function getSlaInfo_(d, now) {
  var umurJam = d.waktuMasuk ? (now - d.waktuMasuk) / 3600000 : 0;
  var slaJam = Number(d.slaJam || 0);
  var remainingHours = Math.max(0, slaJam - umurJam);
  var overdueHours = Math.max(0, umurJam - slaJam);
  var overdue = slaJam > 0 && umurJam > slaJam;
  var warningLimit = slaJam * (CONFIG.FOCUS_SLA_PERCENT || 0.25);
  var nearDeadline = !overdue && slaJam > 0 && remainingHours <= warningLimit;

  return {
    umurJam: umurJam,
    slaJam: slaJam,
    remainingHours: remainingHours,
    overdueHours: overdueHours,
    overdue: overdue,
    nearDeadline: nearDeadline
  };
}

function isFokusPenanganan_(d, now, todayStr) {
  if (!isAduanAktif_(d)) return false;
  if (!d.waktuMasuk) return false;

  var sla = getSlaInfo_(d, now);
  var isHighPriority = d.prioritas === 'Darurat' || d.prioritas === 'Tinggi';
  var isOldActive = formatDateStr(d.waktuMasuk) !== todayStr;

  // Masuk Fokus Penanganan jika:
  // 1. Sudah lewat SLA
  // 2. Sisa SLA hampir habis, default <= 25% dari SLA
  // 3. Prioritas Darurat/Tinggi
  // 4. Aduan aktif lama, bukan tanggal hari ini
  return sla.overdue || sla.nearDeadline || isHighPriority || isOldActive;
}

function mapAduanRow_(d, now, includeSla) {
  var sla = getSlaInfo_(d, now);
  var slaStatus = sla.overdue ? 'Lewat' : 'Aman';

  return {
    id: d.id,
    waktu: formatDisplayDate(d.waktuMasuk),
    cabang: d.cabang,
    wilayah: d.wilayah,
    namaPelanggan: d.namaPelanggan,
    noHp: d.noHp,
    jenis: d.jenisGangguan,
    prioritas: d.prioritas,
    status: d.status,
    slaStatus: slaStatus,
    // Kalau belum lewat, tetap tampil seperti logic lama: 0.3 jam, 2.1 jam, dst.
    // Kalau lewat, tampil dinamis: Lewat 10 menit / Lewat 1 jam 20 menit / Lewat 2 hari 3 jam.
    sisaSLA: slaStatus === 'Aman'
      ? Math.round(sla.remainingHours * 10) / 10 + ' jam'
      : 'Lewat ' + formatDurasiSla_(sla.overdueHours),
    unit: d.unit,
    keterangan: d.keterangan ? String(d.keterangan).substring(0, 100) : ''
  };
}

function getTabelFokus(data, now) {
  now = now || new Date();
  var cutoff24Jam = new Date(now.getTime() - 24 * 3600 * 1000);

  var fokus = data.filter(function(d) {
    if (d.status === 'Selesai' || d.status === 'Batal') return false;
    if (!d.waktuMasuk) return false;

    var slaInfo = getSlaInfo_(d, now);
    var isDarurat = d.prioritas === 'Darurat' || d.prioritas === 'Tinggi';
    var isSLALewat = slaInfo.overdue;
    var isNearDeadline = slaInfo.nearDeadline;
    var sudahLebih24Jam = d.waktuMasuk < cutoff24Jam;

    // Aturan Fokus Penanganan:
    // 1. Prioritas Darurat/Tinggi
    // 2. Sudah lewat SLA
    // 3. Hampir lewat SLA: sisa SLA <= CONFIG.FOCUS_SLA_PERCENT
    // 4. Aduan aktif sudah lebih dari 24 jam
    return isDarurat || isSLALewat || isNearDeadline || sudahLebih24Jam;
  });

  // Sort lebih tajam:
  // Darurat/Tinggi tetap di atas, lalu yang sudah lewat SLA,
  // lalu yang hampir lewat SLA, lalu aduan paling lama.
  fokus.sort(function(a, b) {
    var priOrder = { 'Darurat': 4, 'Tinggi': 3, 'Sedang': 2, 'Rendah': 1 };

    var aSla = getSlaInfo_(a, now);
    var bSla = getSlaInfo_(b, now);

    var priDiff = (priOrder[b.prioritas] || 0) - (priOrder[a.prioritas] || 0);
    if (priDiff !== 0) return priDiff;

    var lewatDiff = (bSla.overdue ? 1 : 0) - (aSla.overdue ? 1 : 0);
    if (lewatDiff !== 0) return lewatDiff;

    var nearDiff = (bSla.nearDeadline ? 1 : 0) - (aSla.nearDeadline ? 1 : 0);
    if (nearDiff !== 0) return nearDiff;

    return (a.waktuMasuk || 0) - (b.waktuMasuk || 0);
  });

  return fokus.slice(0, 50).map(function(d) {
    var slaInfo = getSlaInfo_(d, now);
    var slaStatus = slaInfo.overdue ? 'Lewat' : 'Aman';

    var alasanFokus = '';
    if (d.prioritas === 'Darurat') {
      alasanFokus = '🔴 Darurat';
    } else if (d.prioritas === 'Tinggi') {
      alasanFokus = '🟠 Prioritas Tinggi';
    } else if (slaInfo.overdue) {
      alasanFokus = '⏱ SLA Lewat';
    } else if (slaInfo.nearDeadline) {
      alasanFokus = '⚠ Hampir Lewat SLA';
    } else {
      alasanFokus = '📅 > 24 Jam';
    }

    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      prioritas: d.prioritas,
      status: d.status,
      slaStatus: slaStatus,
      sisaSLA: slaStatus === 'Aman'
        ? Math.round(slaInfo.remainingHours * 10) / 10 + ' jam'
        : 'Lewat ' + formatDurasiSla_(slaInfo.overdueHours),
      alasanFokus: alasanFokus,
      unit: d.unit,
      keterangan: d.keterangan ? String(d.keterangan).substring(0, 100) : ''
    };
  });
}


function formatDurasiSla_(hours) {
  var totalMinutes = Math.max(1, Math.round(Math.abs(Number(hours || 0)) * 60));

  var days = Math.floor(totalMinutes / 1440);
  var remainingAfterDays = totalMinutes % 1440;
  var jam = Math.floor(remainingAfterDays / 60);
  var menit = remainingAfterDays % 60;

  if (days > 0) {
    if (jam > 0) return days + ' hari ' + jam + ' jam';
    return days + ' hari';
  }

  if (jam > 0) {
    if (menit > 0) return jam + ' jam ' + menit + ' menit';
    return jam + ' jam';
  }

  return menit + ' menit';
}

function getTabelTerbaru(data) {
  var sorted = data.filter(function(d) {
    return d.status !== 'Selesai' && d.status !== 'Batal';
  }).sort(function(a, b) {
    return (b.waktuMasuk || 0) - (a.waktuMasuk || 0);
  });

  return sorted.slice(0, 100).map(function(d) {
    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      prioritas: d.prioritas,
      status: d.status,
      unit: d.unit
    };
  });
}


function getTabelSelesai(data) {
  var sorted = data.filter(function(d) {
    return d.status === 'Selesai';
  }).sort(function(a, b) {
    return (b.waktuSelesai || b.waktuMasuk || 0) - (a.waktuSelesai || a.waktuMasuk || 0);
  });

  return sorted.slice(0, 100).map(function(d) {
    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      waktuSelesai: formatDisplayDate(d.waktuSelesai),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      prioritas: d.prioritas,
      status: d.status,
      unit: d.unit,
      catatan: d.catatan ? String(d.catatan).substring(0, 100) : ''
    };
  });
}

function getLaporanDetail(data, fromDate) {
  return data.filter(function(d) {
    return d.waktuMasuk && d.waktuMasuk >= fromDate;
  }).sort(function(a, b) {
    if (a.cabang !== b.cabang) return String(a.cabang || '').localeCompare(String(b.cabang || ''));
    return (b.waktuMasuk || 0) - (a.waktuMasuk || 0);
  }).slice(0, 500).map(function(d) {
    return {
      id: d.id,
      waktu: formatDisplayDate(d.waktuMasuk),
      cabang: d.cabang,
      wilayah: d.wilayah,
      namaPelanggan: d.namaPelanggan,
      noHp: d.noHp,
      jenis: d.jenisGangguan,
      prioritas: d.prioritas,
      status: d.status,
      unit: d.unit,
      keterangan: d.keterangan ? String(d.keterangan).substring(0, 120) : ''
    };
  });
}

function getEmptyData() {
  return {
    success: true,
    lastUpdate: new Date().toLocaleString('id-ID'),
    cards: { aduanHariIni: 0, aduanAktif: 0, lewatSLA: 0, selesaiHariIni: 0 },
    sidebar: { aduanBulanIni: 0, prioritasTinggi: 0, lewatSLA: 0 },
    charts: {
      tren7Hari: { labels: [], data: [] },
      tren7HariCabang: { labels: [], datasets: [] },
      statusCount: { 'Baru': 0, 'Proses': 0, 'Selesai': 0, 'Ditunda': 0, 'Batal': 0 },
      jenisCount: [],
      cabangRanking: []
    },
    tables: { fokus: [], terbaru: [], selesai: [], laporanDetail: [] },
    meta: { cabangList: CONFIG.CABANG, wilayahList: CONFIG.WILAYAH }
  };
}

// ============================================================
// MENU: Buka Dashboard
// ============================================================
function openDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settingsSheet = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  var ui = SpreadsheetApp.getUi();

  var url = '';
  if (settingsSheet) {
    url = settingsSheet.getRange('B4').getValue();
  }

  if (!url) {
    ui.alert(
      '⚠️ URL Dashboard Belum Diatur',
      'Silakan deploy Web App terlebih dahulu, lalu:\n' +
      '1. Buka sheet SETTINGS\n' +
      '2. Isi URL Dashboard di baris B4\n' +
      '3. Coba lagi menu ini',
      ui.ButtonSet.OK
    );
    return;
  }

  var htmlOutput = HtmlService.createHtmlOutput(
    '<script>window.open("' + url + '"); google.script.host.close();</script>'
  ).setWidth(10).setHeight(10);
  ui.showModalDialog(htmlOutput, 'Membuka Dashboard...');
}

// ============================================================
// MENU: Tambah Data Contoh
// ============================================================
function addSampleData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var ui = SpreadsheetApp.getUi();

  if (!sheet) {
    ui.alert('Sheet ADUAN tidak ditemukan. Jalankan Setup terlebih dahulu.');
    return;
  }

  var now = new Date();
  var yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  var twoDaysAgo = new Date(now); twoDaysAgo.setDate(now.getDate() - 2);

  var samples = [
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0001', now, 'Cabang Praya', 'Praya', 'Desa Praya', 'Ahmad Fauzi', '081234567890', 'Air Mati', 'Darurat', 'Proses', 'Teknik', 'Air mati sejak subuh, seluruh kompleks terdampak', '', '', 2, now],
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0002', now, 'Cabang Pujut', 'Pujut', 'Dusun Selong', 'Siti Rahayu', '081234567891', 'Tekanan Rendah', 'Tinggi', 'Baru', 'Distribusi', 'Tekanan sangat rendah, air hanya mengalir malam hari', '', '', 4, now],
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0003', now, 'Cabang Jonggat', 'Jonggat', 'Desa Bonder', 'Hasan Basri', '081234567892', 'Pipa Bocor', 'Tinggi', 'Proses', 'Teknik', 'Pipa bocor di jalan utama, air menggenang di jalan', '', '', 4, now],
    ['ADU-' + formatDateStr(yesterday).replace(/-/g,'') + '-0001', yesterday, 'Cabang Batukliang', 'Batukliang', 'Desa Batukliang', 'Maria Ulfa', '081234567893', 'Air Keruh', 'Sedang', 'Selesai', 'Produksi', 'Air berwarna kuning kecoklatan setelah hujan deras', now, now, 8, now],
    ['ADU-' + formatDateStr(yesterday).replace(/-/g,'') + '-0002', yesterday, 'Cabang Praya Barat', 'Praya Barat', 'Desa Mangkung', 'Zainal Arifin', '081234567894', 'Meter Bermasalah', 'Rendah', 'Proses', 'Hublang', 'Meter air rusak, angka tidak bergerak padahal air mengalir', '', '', 24, now],
    ['ADU-' + formatDateStr(twoDaysAgo).replace(/-/g,'') + '-0001', twoDaysAgo, 'Cabang Kopang', 'Kopang', 'Desa Kopang', 'Nurul Hidayah', '081234567895', 'Air Mati', 'Darurat', 'Selesai', 'Teknik', 'Pompa rusak, distribusi terganggu 6 jam', now, now, 2, now],
    ['ADU-' + formatDateStr(twoDaysAgo).replace(/-/g,'') + '-0002', twoDaysAgo, 'Cabang Janapria', 'Janapria', 'Desa Janapria', 'Supardi', '081234567896', 'Tagihan', 'Rendah', 'Ditunda', 'Hublang', 'Tagihan bulan ini tidak sesuai pemakaian', '', '', 24, now],
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0004', now, 'Cabang Praya Timur', 'Praya Timur', 'Desa Sukarara', 'Dewi Anggraini', '081234567897', 'Sambungan Baru', 'Sedang', 'Baru', 'Cabang', 'Permohonan sambungan baru untuk rumah baru', '', '', 8, now],
    ['ADU-' + formatDateStr(now).replace(/-/g,'') + '-0005', now, 'Cabang Pringgarata', 'Pringgarata', 'Desa Pringgarata', 'Rudi Hartono', '081234567898', 'Pipa Bocor', 'Darurat', 'Baru', 'Teknik', 'Pipa induk bocor besar, banyak pelanggan terdampak', '', '', 2, now],
    ['ADU-' + formatDateStr(twoDaysAgo).replace(/-/g,'') + '-0003', twoDaysAgo, 'Cabang Batukliang Utara', 'Batukliang Utara', 'Desa Teratak', 'Lalu Muhamad', '081234567899', 'Tekanan Rendah', 'Sedang', 'Batal', 'Distribusi', 'Setelah dicek tekanan normal, kemungkinan instalasi dalam rumah bermasalah', '', '', 8, now]
  ];

  var startRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(startRow, 1, samples.length, samples[0].length).setValues(samples);

  // Format kolom tersembunyi
  sheet.hideColumns(CONFIG.COL.SLA_JAM, 2);

  formatSheet();
  ui.alert('✅ ' + samples.length + ' data contoh berhasil ditambahkan!');
}

// ============================================================
// MENU: Rapikan Sheet
// ============================================================
function formatSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return;

  var lastRow = sheet.getLastRow();

  // Alternating rows
  for (var r = 2; r <= lastRow; r++) {
    var bg = r % 2 === 0 ? '#f8fafc' : '#ffffff';
    sheet.getRange(r, 1, 1, 14).setBackground(bg);
  }

  // Vertical alignment semua data
  sheet.getRange(2, 1, lastRow - 1, 14).setVerticalAlignment('middle');

  // Set row height
  for (var r2 = 2; r2 <= lastRow; r2++) {
    sheet.setRowHeight(r2, 28);
  }

  // Sembunyikan kolom teknis
  sheet.hideColumns(CONFIG.COL.SLA_JAM, 2);
}

// ============================================================
// MENU: Urutkan Data
// ============================================================
function sortSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var ui = SpreadsheetApp.getUi();

  if (!sheet || sheet.getLastRow() < 2) {
    ui.alert('Tidak ada data untuk diurutkan.');
    return;
  }

  var result = ui.prompt(
    'Urutkan Data',
    'Pilih pengurutan:\n1 = Cabang (A-Z)\n2 = Wilayah (A-Z)\n3 = Waktu Masuk Terbaru',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() !== ui.Button.OK) return;

  var choice = result.getResponseText().trim();
  var lastRow = sheet.getLastRow();
  var range = sheet.getRange(2, 1, lastRow - 1, 16);

  if (choice === '1') {
    range.sort([{ column: CONFIG.COL.CABANG, ascending: true }, { column: CONFIG.COL.WAKTU_MASUK, ascending: false }]);
  } else if (choice === '2') {
    range.sort([{ column: CONFIG.COL.WILAYAH, ascending: true }, { column: CONFIG.COL.WAKTU_MASUK, ascending: false }]);
  } else {
    range.sort([{ column: CONFIG.COL.WAKTU_MASUK, ascending: false }]);
  }

  formatSheet();
  ui.alert('✅ Data berhasil diurutkan!');
}


// ============================================================
// FITUR ARSIP BULANAN
// ============================================================

/**
 * Arsipkan data bulan sebelumnya yang statusnya Selesai/Batal.
 * Contoh:
 * Jika sekarang Juni 2026, maka data Mei 2026 yang statusnya Selesai/Batal
 * akan dipindahkan dari ADUAN ke ARSIP_2026_05.
 */
function archiveLastMonth() {
  var now = new Date();
  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var archiveName = 'ARSIP_' + Utilities.formatDate(startLastMonth, Session.getScriptTimeZone(), 'yyyy_MM');

  archiveClosedData_({
    mode: 'LAST_MONTH',
    title: 'Arsipkan Bulan Lalu',
    archiveName: archiveName,
    startDate: startLastMonth,
    endDate: startCurrentMonth,
    includeOlderThanCurrentMonth: false
  });
}

function archiveChooseMonth() {
  var ui = SpreadsheetApp.getUi();
  var now = new Date();
  var defaultPeriod = Utilities.formatDate(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    Session.getScriptTimeZone(),
    'yyyy-MM'
  );

  var response = ui.prompt(
    'Arsipkan Pilih Bulan',
    'Masukkan periode arsip dengan format YYYY-MM.\n\n' +
    'Contoh: ' + defaultPeriod + '\n\n' +
    'Catatan:\n' +
    '- Hanya data status Selesai/Batal yang akan dipindahkan.\n' +
    '- Data Baru/Proses/Ditunda tetap berada di sheet ADUAN.\n' +
    '- Sistem tetap akan menampilkan konfirmasi sebelum memindahkan data.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  var input = String(response.getResponseText() || '').trim();
  var parsed = parseArchivePeriod_(input);

  if (!parsed) {
    ui.alert(
      'Format periode tidak valid',
      'Gunakan format YYYY-MM, contoh: 2026-04.',
      ui.ButtonSet.OK
    );
    return;
  }

  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (parsed.startDate >= startCurrentMonth) {
    var confirmCurrent = ui.alert(
      'Periode masih bulan berjalan / masa depan',
      'Periode yang dipilih adalah ' + parsed.label + '.\n\n' +
      'Saran sistem: arsip sebaiknya hanya untuk bulan yang sudah lewat.\n\n' +
      'Tetap lanjut menghitung data arsip periode ini?',
      ui.ButtonSet.YES_NO
    );

    if (confirmCurrent !== ui.Button.YES) return;
  }

  archiveClosedData_({
    mode: 'CHOOSE_MONTH',
    title: 'Arsipkan Pilih Bulan',
    archiveName: parsed.archiveName,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    includeOlderThanCurrentMonth: false,
    selectedPeriodLabel: parsed.label
  });
}

/**
 * Arsipkan semua data lama yang sudah Selesai/Batal dan Waktu Masuk-nya
 * sebelum bulan berjalan. Ini berguna jika admin lupa arsip beberapa bulan.
 * Data akan masuk ke sheet arsip sesuai bulan Waktu Masuk masing-masing.
 */
function archiveAllOldClosedData() {
  var now = new Date();
  var startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  archiveClosedData_({
    mode: 'ALL_OLD_CLOSED',
    title: 'Arsipkan Semua Data Lama',
    startDate: null,
    endDate: startCurrentMonth,
    includeOlderThanCurrentMonth: true
  });
}

/**
 * V10.9.37
 * Arsipkan semua data berstatus final (Selesai/Batal) tanpa batas bulan.
 * Setelah dipindahkan dari sheet ADUAN, Riwayat Aduan di WhatsApp tidak lagi menampilkan tiket final tersebut.
 */
function archiveAllClosedData() {
  archiveClosedData_({
    mode: 'ALL_CLOSED',
    title: 'Arsipkan Semua Selesai/Batal',
    startDate: null,
    endDate: null,
    includeOlderThanCurrentMonth: false
  });
}

/**
 * V10.9.37
 * Arsipkan data final (Selesai/Batal) untuk satu nomor WhatsApp.
 * Cocok untuk membersihkan Riwayat Aduan pelanggan tertentu agar di HP menjadi kosong bila semua tiketnya sudah final.
 */
function archiveClosedDataByPhone() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Arsipkan per Nomor WhatsApp',
    'Masukkan nomor WhatsApp pelanggan yang ingin diarsipkan.\n\n' +
    'Contoh: 081234567890 atau 6281234567890\n\n' +
    'Catatan: hanya aduan berstatus Selesai/Batal dari nomor ini yang dipindahkan ke arsip.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  var phone = normalizePhone_(response.getResponseText());
  if (!phone) {
    ui.alert('Nomor WhatsApp tidak valid.');
    return;
  }

  archiveClosedData_({
    mode: 'BY_PHONE_CLOSED',
    title: 'Arsipkan Selesai/Batal per No WA',
    startDate: null,
    endDate: null,
    includeOlderThanCurrentMonth: false,
    phone: phone
  });
}

function archiveClosedData_(options) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    ui.alert('Sheet ADUAN tidak ditemukan. Jalankan Setup terlebih dahulu.');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('Belum ada data aduan untuk diarsipkan.');
    return;
  }

  var lastCol = Math.max(CONFIG.COL.UPDATED_AT, sheet.getLastColumn());
  var dataRange = sheet.getRange(2, 1, lastRow - 1, CONFIG.COL.UPDATED_AT);
  var values = dataRange.getValues();

  var rowsToArchive = [];
  var groups = {};
  var targetPhone = normalizePhone_(options.phone || '');

  values.forEach(function(row, i) {
    var status = String(row[CONFIG.COL.STATUS - 1] || '').trim();
    var waktuMasuk = asDateForArchive_(row[CONFIG.COL.WAKTU_MASUK - 1]);
    var rowPhone = normalizePhone_(row[CONFIG.COL.NO_HP - 1] || '');

    if (!waktuMasuk) return;
    if (status !== 'Selesai' && status !== 'Batal') return;

    // Jika mode per nomor, hanya arsipkan nomor yang diminta.
    if (targetPhone && rowPhone !== targetPhone) return;

    var eligible = false;

    if (options.mode === 'LAST_MONTH' || options.mode === 'CHOOSE_MONTH') {
      eligible = waktuMasuk >= options.startDate && waktuMasuk < options.endDate;
    } else if (options.mode === 'ALL_OLD_CLOSED') {
      eligible = waktuMasuk < options.endDate;
    } else if (options.mode === 'ALL_CLOSED' || options.mode === 'BY_PHONE_CLOSED') {
      eligible = true;
    }

    if (!eligible) return;

    var archiveSheetName = options.archiveName ||
      ('ARSIP_' + Utilities.formatDate(waktuMasuk, Session.getScriptTimeZone(), 'yyyy_MM'));

    var item = {
      sheetRow: i + 2,
      values: row,
      archiveSheetName: archiveSheetName,
      period: Utilities.formatDate(waktuMasuk, Session.getScriptTimeZone(), 'yyyy-MM')
    };

    rowsToArchive.push(item);

    if (!groups[archiveSheetName]) groups[archiveSheetName] = [];
    groups[archiveSheetName].push(item);
  });

  if (rowsToArchive.length === 0) {
    var emptyMsg = targetPhone
      ? 'Tidak ditemukan aduan status Selesai/Batal untuk nomor ' + targetPhone + '.\n\nJika Riwayat Aduan masih muncul, kemungkinan statusnya masih Baru/Proses/Ditunda atau nomor WhatsApp berbeda.'
      : 'Tidak ditemukan aduan status Selesai/Batal yang sesuai kriteria arsip.';

    ui.alert(
      'Tidak ada data untuk diarsipkan',
      emptyMsg,
      ui.ButtonSet.OK
    );
    return;
  }

  var summary = buildArchiveConfirmationSummary_(rowsToArchive, groups, options);

  var confirm = ui.alert(
    options.title,
    summary,
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    var backupName = makeUniqueSheetName_(ss, 'BACKUP_ADUAN_' + timestamp);

    // Backup sebelum menghapus data dari ADUAN.
    var backupSheet = sheet.copyTo(ss).setName(backupName);
    backupSheet.hideSheet();

    var headers = getAduanHeaders_();

    Object.keys(groups).forEach(function(archiveSheetName) {
      var archiveSheet = getOrCreateArchiveSheet_(ss, archiveSheetName, headers);
      var groupRows = groups[archiveSheetName].map(function(item) {
        return item.values;
      });

      archiveSheet
        .getRange(archiveSheet.getLastRow() + 1, 1, groupRows.length, headers.length)
        .setValues(groupRows);

      formatArchiveSheet_(archiveSheet, headers.length);

      writeArchiveLog_({
        archiveSheetName: archiveSheetName,
        count: groupRows.length,
        backupName: backupName,
        mode: options.mode,
        period: getPeriodLabel_(groups[archiveSheetName])
      });
    });

    // Hapus dari bawah agar nomor baris tidak bergeser.
    rowsToArchive
      .map(function(item) { return item.sheetRow; })
      .sort(function(a, b) { return b - a; })
      .forEach(function(rowNumber) {
        sheet.deleteRow(rowNumber);
      });

    formatSheet();

    ui.alert(
      '✅ Arsip Berhasil',
      rowsToArchive.length + ' data selesai/batal berhasil dipindahkan ke arsip.\n\n' +
      (targetPhone ? ('Nomor WA: ' + targetPhone + '\n') : '') +
      'Backup dibuat otomatis: ' + backupName + '\n' +
      'Data aktif tetap berada di sheet ADUAN.\n\n' +
      'Catatan: Riwayat Aduan di WhatsApp hanya membaca sheet ADUAN. Jadi tiket yang sudah diarsipkan tidak akan muncul lagi di HP pelanggan.',
      ui.ButtonSet.OK
    );

  } catch (e) {
    ui.alert('❌ Gagal arsip: ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}


function parseArchivePeriod_(periodText) {
  var match = /^(\d{4})-(\d{2})$/.exec(String(periodText || '').trim());
  if (!match) return null;

  var year = Number(match[1]);
  var month = Number(match[2]);

  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;

  var startDate = new Date(year, month - 1, 1);
  var endDate = new Date(year, month, 1);

  return {
    year: year,
    month: month,
    startDate: startDate,
    endDate: endDate,
    label: Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'MMMM yyyy'),
    archiveName: 'ARSIP_' + Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyy_MM')
  };
}

function buildArchiveConfirmationSummary_(rowsToArchive, groups, options) {
  var targetSheets = Object.keys(groups).sort();
  var groupLines = targetSheets.map(function(sheetName) {
    return '- ' + sheetName + ': ' + groups[sheetName].length + ' data';
  }).join('\n');

  var periode = options.selectedPeriodLabel || '-';
  if ((options.mode === 'LAST_MONTH' || options.mode === 'CHOOSE_MONTH') && options.startDate) {
    periode = Utilities.formatDate(options.startDate, Session.getScriptTimeZone(), 'MMMM yyyy');
  } else if (options.mode === 'ALL_OLD_CLOSED' && options.endDate) {
    periode = 'Semua data sebelum ' + Utilities.formatDate(options.endDate, Session.getScriptTimeZone(), 'MMMM yyyy');
  } else if (options.mode === 'ALL_CLOSED') {
    periode = 'Semua periode';
  } else if (options.mode === 'BY_PHONE_CLOSED') {
    periode = 'Semua periode untuk No WA: ' + normalizePhone_(options.phone || '');
  }

  return (
    'Sistem menemukan data yang siap diarsipkan:\n\n' +
    'Periode: ' + periode + '\n' +
    'Status yang dipindahkan: Selesai dan Batal\n' +
    'Jumlah data: ' + rowsToArchive.length + ' aduan\n\n' +
    'Tujuan arsip:\n' +
    groupLines + '\n\n' +
    'Data aktif seperti Baru, Proses, dan Ditunda TIDAK akan dipindahkan.\n\n' +
    'Backup sheet ADUAN akan dibuat otomatis sebelum data dipindahkan.\n\n' +
    'Setelah dipindahkan, data ini tidak muncul lagi di Riwayat Aduan WhatsApp karena sudah keluar dari sheet ADUAN.\n\n' +
    'Lanjutkan arsip?'
  );
}

function setupArchiveLogSheet(ss) {
  var sh = ss.getSheetByName(CONFIG.ARCHIVE_LOG_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.ARCHIVE_LOG_SHEET);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 7).setValues([[
      'Tanggal Arsip',
      'Mode',
      'Periode',
      'Sheet Arsip',
      'Jumlah Data',
      'Backup Sheet',
      'User'
    ]]);
  }

  sh.getRange(1, 1, 1, 7)
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 7);
}

function openArchiveLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupArchiveLogSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.ARCHIVE_LOG_SHEET));
}

function writeArchiveLog_(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupArchiveLogSheet(ss);

  var sh = ss.getSheetByName(CONFIG.ARCHIVE_LOG_SHEET);
  var userEmail = '';

  try {
    userEmail = Session.getActiveUser().getEmail() || '-';
  } catch (e) {
    userEmail = '-';
  }

  sh.appendRow([
    new Date(),
    payload.mode,
    payload.period,
    payload.archiveSheetName,
    payload.count,
    payload.backupName,
    userEmail
  ]);

  sh.autoResizeColumns(1, 7);
}

function getOrCreateArchiveSheet_(ss, sheetName, headers) {
  var sh = ss.getSheetByName(sheetName);

  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var currentHeaders = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    var hasHeader = currentHeaders.some(function(v) { return String(v || '').trim() !== ''; });
    if (!hasHeader) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  formatArchiveSheet_(sh, headers.length);
  return sh;
}

function formatArchiveSheet_(sheet, headerCount) {
  var lastRow = Math.max(safeGetLastRow_(sheet), 2);

  sheet.getRange(1, 1, 1, headerCount)
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);

  var colWidths = [130, 140, 140, 130, 110, 140, 120, 120, 80, 80, 100, 200, 200, 140, 70, 130];
  for (var i = 0; i < Math.min(colWidths.length, headerCount); i++) {
    sheet.setColumnWidth(i + 1, colWidths[i]);
  }

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.min(14, headerCount)).setVerticalAlignment('middle');
  }

  try {
    if (headerCount >= CONFIG.COL.SLA_JAM) {
      sheet.hideColumns(CONFIG.COL.SLA_JAM, Math.min(2, headerCount - CONFIG.COL.SLA_JAM + 1));
    }
  } catch (e) {}
}

function getAduanHeaders_() {
  return [
    'ID Aduan',
    'Waktu Masuk',
    'Cabang',
    'Wilayah/Kecamatan',
    'No Pelanggan',
    'Nama Pelanggan',
    'No HP',
    'Jenis Gangguan',
    'Prioritas',
    'Status',
    'Unit/Petugas',
    'Keterangan Aduan',
    'Catatan Tindak Lanjut',
    'Waktu Selesai',
    'SLA Jam',
    'Updated At'
  ];
}

function getPeriodLabel_(items) {
  var periods = {};
  items.forEach(function(item) {
    periods[item.period] = true;
  });
  return Object.keys(periods).sort().join(', ');
}

function asDateForArchive_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value;

  var parsed = new Date(value);
  return isNaN(parsed) ? null : parsed;
}

function makeUniqueSheetName_(ss, baseName) {
  var name = baseName;
  var counter = 1;

  while (ss.getSheetByName(name)) {
    name = baseName + '_' + counter;
    counter++;
  }

  return name;
}


// ============================================================
// FITUR INPUT PER CABANG → ADUAN PUSAT
// ============================================================

function setupCabangInputSheets(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  CABANG_INPUT_SHEETS.forEach(function(item) {
    var sh = ss.getSheetByName(item.sheet);
    if (!sh) sh = ss.insertSheet(item.sheet);
    setupSingleCabangInputSheet_(sh, item);
  });

  setupInputCabangLogSheet(ss);

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Sheet Input Cabang Siap',
      'Sheet input cabang sudah dibuat/diperbarui.\n\nCabang cukup mengisi data pada sheet masing-masing.\nData akan masuk ke ADUAN pusat melalui menu Sinkron Input Cabang ke ADUAN.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {}
}

function setupSingleCabangInputSheet_(sh, item) {
  var headers = [
    'Tanggal Input',
    'Nama Pelanggan',
    'No HP',
    'Wilayah/Kecamatan',
    'No Pelanggan',
    'Jenis Gangguan',
    'Prioritas',
    'Keterangan Aduan',
    'Unit/Petugas',
    'Sync Status',
    'ID Aduan',
    'Waktu Sync',
    'Catatan Sistem'
  ];

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);

  // Jika sheet input sudah punya data format lama, geser otomatis ke format baru.
  migrateExistingCabangInputRows_(sh);

  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#0f3b68')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Lebar kolom input cabang
  [150,180,130,150,150,160,110,240,180,120,170,150,220].forEach(function(w, i) {
    sh.setColumnWidth(i + 1, w);
  });

  var inputRows = Math.max(500, sh.getMaxRows() - 1);

  // Bersihkan dropdown lama yang masih nempel di posisi kolom lama,
  // lalu pasang ulang dropdown sesuai struktur baru.
  refreshInputCabangDropdowns_(sh, inputRows);

  // Kolom sistem diberi warna lembut:
  // A = Tanggal Input otomatis
  // J:M = Sync Status, ID Aduan, Waktu Sync, Catatan Sistem
  sh.getRange(1, 1, Math.max(500, sh.getMaxRows()), 1).setBackground('#f1f5f9');
  sh.getRange(1, 10, Math.max(500, sh.getMaxRows()), 4).setBackground('#f1f5f9');

  sh.getRange('B2').setNote(
    'Isi Nama Pelanggan mulai kolom ini. Kolom Tanggal Input akan otomatis muncul saat Nama Pelanggan diketik. Kolom Sync Status, ID Aduan, Waktu Sync, dan Catatan Sistem akan diisi otomatis oleh sistem.'
  );

  // Proteksi kolom sistem agar cabang tidak mengubah tanggal/status sinkron secara manual.
  protectInputCabangSystemColumns_(sh);

  sh.autoResizeRows(1, 1);
}


function isCabangInputSheet_(sheetName) {
  return CABANG_INPUT_SHEETS.some(function(item) {
    return item.sheet === sheetName;
  });
}

function protectInputCabangSystemColumns_(sh) {
  try {
    var protections = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    protections.forEach(function(p) {
      var desc = p.getDescription ? p.getDescription() : '';
      if (desc === 'SIAGA_TIARA_INPUT_TANGGAL' || desc === 'SIAGA_TIARA_SYSTEM_COLUMNS') {
        p.remove();
      }
    });

    protectRangeForSystem_(sh.getRange(1, 1, sh.getMaxRows(), 1), 'SIAGA_TIARA_INPUT_TANGGAL');
    protectRangeForSystem_(sh.getRange(1, 10, sh.getMaxRows(), 4), 'SIAGA_TIARA_SYSTEM_COLUMNS');
  } catch (e) {
    // Jika proteksi penuh gagal karena akses, fallback warning saja.
    try {
      var p1 = sh.getRange(1, 1, sh.getMaxRows(), 1).protect();
      p1.setDescription('SIAGA_TIARA_INPUT_TANGGAL');
      p1.setWarningOnly(true);

      var p2 = sh.getRange(1, 10, sh.getMaxRows(), 4).protect();
      p2.setDescription('SIAGA_TIARA_SYSTEM_COLUMNS');
      p2.setWarningOnly(true);
    } catch (err) {}
  }
}

function protectRangeForSystem_(range, description) {
  var protection = range.protect();
  protection.setDescription(description);
  protection.setWarningOnly(false);

  try {
    var effectiveUser = Session.getEffectiveUser();
    protection.addEditor(effectiveUser);

    var ownerEmail = effectiveUser && effectiveUser.getEmail ? effectiveUser.getEmail() : '';
    protection.getEditors().forEach(function(editor) {
      var email = editor && editor.getEmail ? editor.getEmail() : '';
      if (email && email !== ownerEmail) {
        protection.removeEditor(editor);
      }
    });

    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
  } catch (e) {}
}

function handleInputCabangEdit_(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  if (!sheet || !isCabangInputSheet_(sheet.getName())) return;

  var row = e.range.getRow();
  var col = e.range.getColumn();

  if (row < 2) return;

  // Tanggal otomatis muncul saat Nama Pelanggan diketik.
  // Kolom input cabang:
  // A Tanggal Input, B Nama Pelanggan, C No HP, D Wilayah, E Desa,
  // F Jenis, G Prioritas, H Keterangan, I Unit/Petugas.
  if (col >= 2 && col <= 9) {
    var nama = String(sheet.getRange(row, 2).getValue() || '').trim();
    var tanggalCell = sheet.getRange(row, 1);

    if (nama && !tanggalCell.getValue()) {
      try {
        tanggalCell.setValue(new Date());
        tanggalCell.setNumberFormat('dd/MM/yyyy HH:mm:ss');
      } catch (err) {}
    }

    // Kalau semua kolom input B:I kosong dan belum tersinkron, bersihkan tanggal/status.
    var inputValues = sheet.getRange(row, 2, 1, 8).getValues()[0];
    var hasInput = inputValues.some(function(v) {
      return String(v || '').trim() !== '';
    });

    var syncStatus = String(sheet.getRange(row, 10).getValue() || '').trim();
    var idAduan = String(sheet.getRange(row, 11).getValue() || '').trim();

    if (!hasInput && !syncStatus && !idAduan) {
      try {
        sheet.getRange(row, 1).clearContent();
        sheet.getRange(row, 10, 1, 4).clearContent();
        sheet.getRange(row, 1, 1, 13).setBackground(null);
      } catch (err2) {}
    }
  }
}

// Handler untuk installable trigger.
// Dibuat agar tanggal otomatis tetap bisa ditulis meskipun kolom tanggal diproteksi.
function handleInputCabangOnEdit(e) {
  handleInputCabangEdit_(e);
}

function enableInputCabangTimestampTrigger() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Aktifkan Tanggal Otomatis Input Cabang',
    'Sistem akan mengaktifkan trigger agar kolom Tanggal Input pada sheet cabang otomatis terisi ketika Nama Pelanggan diketik.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  ensureInputCabangTimestampTrigger_();

  ui.alert(
    '✅ Tanggal Otomatis Aktif',
    'Kolom Tanggal Input akan otomatis terisi saat Nama Pelanggan diketik di sheet input cabang.',
    ui.ButtonSet.OK
  );
}

function ensureInputCabangTimestampTrigger_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  var exists = triggers.some(function(t) {
    return t.getHandlerFunction && t.getHandlerFunction() === 'handleInputCabangOnEdit';
  });

  if (!exists) {
    ScriptApp.newTrigger('handleInputCabangOnEdit')
      .forSpreadsheet(ss)
      .onEdit()
      .create();
  }
}



function refreshInputCabangDropdowns_(sh, inputRows) {
  inputRows = inputRows || Math.max(500, sh.getMaxRows() - 1);

  // Hapus semua validation lama di area input baru A:M.
  // Ini penting karena sebelumnya dropdown ada di kolom lama sebelum Tanggal Input ditambahkan.
  sh.getRange(2, 1, inputRows, 13).clearDataValidations();

  // Format tanggal input otomatis di kolom A.
  sh.getRange(2, 1, inputRows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');

  // Struktur baru:
  // A Tanggal Input
  // B Nama Pelanggan
  // C No HP
  // D Wilayah/Kecamatan
  // E No Pelanggan
  // F Jenis Gangguan
  // G Prioritas
  // H Keterangan Aduan
  // I Unit/Petugas
  // J:M Kolom sistem
  var wilayahRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.WILAYAH, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 4, inputRows, 1).setDataValidation(wilayahRule);

  var jenisRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.JENIS_GANGGUAN, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 6, inputRows, 1).setDataValidation(jenisRule);

  var priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.PRIORITAS, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 7, inputRows, 1).setDataValidation(priorityRule);

  var unitRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.UNIT, true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(2, 9, inputRows, 1).setDataValidation(unitRule);
}


function refreshAllInputCabangDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var total = 0;

  CABANG_INPUT_SHEETS.forEach(function(item) {
    var sh = ss.getSheetByName(item.sheet);
    if (!sh) return;

    refreshInputCabangDropdowns_(sh);
    protectInputCabangSystemColumns_(sh);
    total++;
  });

  SpreadsheetApp.getUi().alert(
    '✅ Dropdown Input Cabang Diperbaiki',
    'Dropdown sudah dibersihkan dari posisi lama dan dipasang ulang ke posisi kolom baru pada ' + total + ' sheet input cabang.\n\n' +
    'Posisi baru:\n' +
    '- Wilayah/Kecamatan: kolom D\n' +
    '- Jenis Gangguan: kolom F\n' +
    '- Prioritas: kolom G\n' +
    '- Unit/Petugas: kolom I',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function migrateAllInputCabangTanggalColumns() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Geser Data Lama Input Cabang',
    'Fitur ini akan mengecek semua sheet INPUT cabang.\n\n' +
    'Jika ada data lama yang masih mulai dari kolom A = Nama Pelanggan, sistem akan menggesernya ke kanan sehingga:\n\n' +
    'A = Tanggal Input\n' +
    'B = Nama Pelanggan\n' +
    'C = No HP\n' +
    'dst.\n\n' +
    'Data yang sudah format baru tidak akan digeser lagi.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var total = 0;
  var details = [];

  CABANG_INPUT_SHEETS.forEach(function(item) {
    var sh = ss.getSheetByName(item.sheet);
    if (!sh) return;

    var count = migrateExistingCabangInputRows_(sh);
    refreshInputCabangDropdowns_(sh);
    protectInputCabangSystemColumns_(sh);

    total += count;
    details.push(item.sheet + ': ' + count + ' baris digeser');
  });

  ui.alert(
    '✅ Migrasi Selesai',
    'Total baris yang digeser: ' + total + '\n\n' + details.join('\n'),
    ui.ButtonSet.OK
  );
}

function migrateExistingCabangInputRows_(sh) {
  if (!sh || sh.getLastRow() < 2) return 0;

  var lastRow = sh.getLastRow();
  var maxCols = Math.max(13, sh.getLastColumn());

  // Baca sampai 13 kolom agar format lama A:L bisa digeser ke B:M.
  var data = sh.getRange(2, 1, lastRow - 1, 13).getValues();
  var rowsToUpdate = [];
  var migrated = 0;

  data.forEach(function(row, idx) {
    var rowNumber = idx + 2;

    var colA = row[0]; // format baru = Tanggal Input, format lama = Nama Pelanggan
    var colB = row[1]; // format baru = Nama Pelanggan, format lama = No HP
    var colC = row[2]; // format baru = No HP, format lama = Wilayah

    var aText = String(colA || '').trim();
    var bText = String(colB || '').trim();
    var cText = String(colC || '').trim();

    // Baris kosong tidak perlu diproses.
    var hasAnyValue = row.some(function(v) {
      return String(v || '').trim() !== '';
    });
    if (!hasAnyValue) return;

    // Kalau kolom A sudah tanggal, berarti sudah format baru.
    if (isValidDateValue_(colA)) return;

    // Kalau A kosong dan B berisi nama, kemungkinan sudah format baru tapi tanggal belum muncul.
    // Jangan digeser.
    if (!aText && bText) return;

    // Deteksi format lama:
    // A berisi Nama Pelanggan, B berisi No HP / data lain, C biasanya Wilayah.
    // Format lama harus digeser ke kanan.
    var looksOldFormat = !!aText && !isValidDateValue_(colA);

    if (!looksOldFormat) return;

    var newRow = [
      '',      // A Tanggal Input dikosongkan dulu; nanti otomatis saat edit atau dibuat saat sinkron
      row[0],  // B Nama Pelanggan
      row[1],  // C No HP
      row[2],  // D Wilayah/Kecamatan
      row[3],  // E No Pelanggan
      row[4],  // F Jenis Gangguan
      row[5],  // G Prioritas
      row[6],  // H Keterangan Aduan
      row[7],  // I Unit/Petugas
      row[8],  // J Sync Status
      row[9],  // K ID Aduan
      row[10], // L Waktu Sync
      row[11]  // M Catatan Sistem
    ];

    rowsToUpdate.push({
      rowNumber: rowNumber,
      values: newRow
    });

    migrated++;
  });

  rowsToUpdate.forEach(function(item) {
    sh.getRange(item.rowNumber, 1, 1, 13).setValues([item.values]);
  });

  return migrated;
}

function isValidDateValue_(value) {
  if (!value) return false;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return true;

  // Hindari menganggap nama pelanggan sebagai tanggal.
  // Hanya parse jika bentuknya jelas seperti tanggal.
  var text = String(value || '').trim();
  if (!/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text) && !/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(text)) {
    return false;
  }

  var parsed = new Date(text);
  return !isNaN(parsed);
}

function setupInputCabangLogSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  var sh = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.INPUT_LOG_SHEET);

  var headers = [
    'Waktu Sync',
    'Cabang',
    'Sheet Input',
    'Baris Input',
    'ID Aduan',
    'Nama Pelanggan',
    'Jenis Gangguan',
    'Status'
  ];

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#111827')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

function openInputCabangLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupInputCabangLogSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.INPUT_LOG_SHEET));
}

function bersihkanBarisKosong() {
  var ui = SpreadsheetApp.getUi();
  try {
    var removed = removeEmptyRowsAduan();
    ui.alert('✅ Selesai', 'Baris kosong yang dihapus: ' + removed + '\nNilai default di baris tanpa data juga sudah dibersihkan.', ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('❌ Gagal: ' + e.message);
  }
}

// ============================================================
// BERSIHKAN BARIS KOSONG DI SHEET ADUAN
// ============================================================
function removeEmptyRowsAduan() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var lastRow = sheet.getLastRow();
  // Baca kolom ID (A), Cabang (C), Wilayah (D), Nama (F) sekaligus
  var data    = sheet.getRange(2, 1, lastRow - 1, CONFIG.COL.NAMA_PELANGGAN).getValues();
  var removed = 0;

  // Hapus dari bawah ke atas agar nomor baris tidak bergeser
  for (var i = data.length - 1; i >= 0; i--) {
    var idVal     = String(data[i][CONFIG.COL.ID - 1]             || '').trim();
    var cabangVal = String(data[i][CONFIG.COL.CABANG - 1]         || '').trim();
    var wilayah   = String(data[i][CONFIG.COL.WILAYAH - 1]        || '').trim();
    var nama      = String(data[i][CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim();

    // Baris dianggap kosong jika tidak ada ID DAN tidak ada data konten utama
    if (!idVal && !cabangVal && !wilayah && !nama) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }

  // Bersihkan nilai Prioritas/Status yang terlanjur terisi di baris kosong
  // (bisa terjadi karena onEdit lama sebelum fix)
  cleanOrphanDefaultValues_();

  return removed;
}

// Bersihkan Prioritas/Status/SLA di baris yang tidak punya ID & data utama
function cleanOrphanDefaultValues_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return;

  var lastRow = sheet.getLastRow();
  var data    = sheet.getRange(2, 1, lastRow - 1, 16).getValues();

  for (var i = data.length - 1; i >= 0; i--) {
    var idVal     = String(data[i][CONFIG.COL.ID - 1]             || '').trim();
    var cabangVal = String(data[i][CONFIG.COL.CABANG - 1]         || '').trim();
    var wilayah   = String(data[i][CONFIG.COL.WILAYAH - 1]        || '').trim();
    var nama      = String(data[i][CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim();
    var jenis     = String(data[i][CONFIG.COL.JENIS_GANGGUAN - 1] || '').trim();

    var isOrphan  = !idVal && !cabangVal && !wilayah && !nama && !jenis;

    if (isOrphan) {
      var sheetRow = i + 2;
      // Bersihkan nilai default yang tidak seharusnya ada
      sheet.getRange(sheetRow, CONFIG.COL.PRIORITAS,  1, 1).clearContent();
      sheet.getRange(sheetRow, CONFIG.COL.STATUS,      1, 1).clearContent();
      sheet.getRange(sheetRow, CONFIG.COL.SLA_JAM,     1, 1).clearContent();
      sheet.getRange(sheetRow, CONFIG.COL.UPDATED_AT,  1, 1).clearContent();
      sheet.getRange(sheetRow, CONFIG.COL.WAKTU_MASUK, 1, 1).clearContent();
      // Reset warna baris
      sheet.getRange(sheetRow, 1, 1, 16).setBackground(null);
    }
  }
}

function syncAllCabangInputs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Sinkron Manual Sheet Cabang ke ADUAN',
    'Sistem akan membaca baris manual baru di semua sheet CABANG_*.\n\n' +
    'Baris yang ID Aduan-nya masih kosong akan dibuatkan ID dan masuk ke ADUAN jika minimal data ini sudah lengkap:\n' +
    '- Nama Pelanggan atau No Pelanggan\n' +
    '- Jenis Gangguan\n\n' +
    'Lanjutkan sinkron?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);
    var result = syncAllCabangInputs_();

    ui.alert(
      '✅ Sinkron Selesai',
      'Total data manual baru masuk ke ADUAN: ' + result.totalSynced + '\n\nDetail:\n' + result.detailLines.join('\n'),
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('❌ Sinkron gagal: ' + e.message);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}



function syncAllCabangInputs_() {
  // V10.9.40:
  // Nama fungsi lama dipertahankan agar trigger lama tidak rusak,
  // tapi sumber datanya sekarang adalah sheet CABANG_*, bukan INPUT_*.
  return syncManualRowsFromAllCabangMirrors_();
}



function syncOneCabangInput_(inputSheet, item, aduanSheet, logSheet, syncedKeyMap, existingAduanMap) {
  var lastRow = inputSheet.getLastRow();
  if (lastRow < 2) return 0;

  syncedKeyMap      = syncedKeyMap      || {};
  existingAduanMap  = existingAduanMap  || {};

  var values = inputSheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var now = new Date();
  var syncedCount = 0;

  // ── FIX BUG #1: nextNumber dideklarasikan di sini, di luar forEach ──
  // Dihitung dari jumlah ID hari ini untuk cabang ini agar urut & tidak duplikat
  var nextNumber = getNextCabangAduanNumber_(item.code, now, aduanSheet);

  values.forEach(function(row, idx) {
    var sheetRow  = idx + 2;
    var sourceKey = item.sheet + '#' + sheetRow;
    var propKey   = makeInputSourcePropertyKey_(sourceKey);

    var tanggalInputRaw = row[0];
    var namaPelanggan = String(row[1] || '').trim();
    var noHp          = String(row[2] || '').trim();
    var wilayah       = String(row[3] || '').trim();
    var desa          = String(row[4] || '').trim();
    var jenis         = normalizeInputJenisGangguan_(row[5]);
    var prioritas     = normalizeInputPrioritas_(row[6]);
    var keterangan    = String(row[7] || '').trim();
    var unitPetugas   = normalizeInputUnit_(row[8]);
    var syncStatus    = String(row[9] || '').trim();
    var existingId    = String(row[10] || '').trim();

    // ── FIX BUG #2: tanggalInput dipakai konsisten untuk ID, fingerprint,
    //    dan Waktu Masuk di ADUAN. Fallback ke now hanya jika benar-benar kosong.
    var tanggalInput = asDateForArchive_(tanggalInputRaw) || now;

    // ── Skip baris kosong ──────────────────────────────────
    if (!namaPelanggan && !noHp && !wilayah && !jenis && !keterangan) return;

    // ── LAP ANTI DUPLIKAT 1: kolom sheet input ─────────────
    if (syncStatus === 'Terkirim' || existingId) {
      return;
    }

    // ── LAP ANTI DUPLIKAT 2: LOG_INPUT_CABANG ─────────────
    if (syncedKeyMap[sourceKey]) {
      var logId = syncedKeyMap[sourceKey].id || '';
      if (logId) {
        // Kolom input belum ditandai, perbaiki sekarang
        markInputRowSynced_(inputSheet, sheetRow, logId, now, 'Diperbaiki dari LOG_INPUT_CABANG.');
      }
      return;
    }

    // ── LAP ANTI DUPLIKAT 3: Document Properties ──────────
    var propVal = getInputSourceProperty_(propKey);
    if (propVal) {
      // Properties sudah ada tapi sheet belum ditandai
      markInputRowSynced_(inputSheet, sheetRow, propVal, now, 'Diperbaiki dari Document Properties.');
      return;
    }

    // ── LAP ANTI DUPLIKAT 4: Fingerprint di ADUAN ─────────
    var payload = {
      namaPelanggan: namaPelanggan,
      noHp: noHp,
      wilayah: wilayah,
      desa: desa,
      jenis: jenis,
      prioritas: prioritas,
      unitPetugas: unitPetugas,
      keterangan: keterangan
    };
    var fingerprint = buildInputAduanFingerprint_(item.cabang, tanggalInput, payload);
    if (existingAduanMap[fingerprint]) {
      var dupId = existingAduanMap[fingerprint].id || '';
      markInputRowSynced_(inputSheet, sheetRow, dupId, now, 'Data identik sudah ada di ADUAN.');
      return;
    }

    // ── Validasi minimal ───────────────────────────────────
    if (!namaPelanggan || !wilayah || !jenis) {
      // FIX BUG #3: was kolom 9 (Unit/Petugas) → harus kolom 10 (Sync Status)
      inputSheet.getRange(sheetRow, 10, 1, 4).setValues([[
        'Gagal', '', now, 'Nama pelanggan, wilayah, dan jenis gangguan wajib diisi.'
      ]]);
      inputSheet.getRange(sheetRow, 1, 1, 13).setBackground('#fef2f2');
      return;
    }

    // ── Generate ID ────────────────────────────────────────
    // FIX BUG #1 & #2: pakai tanggalInput (bukan now) agar ID mencerminkan
    // tanggal aduan asli dari cabang, bukan tanggal saat sinkron berjalan.
    // nextNumber sudah dideklarasikan di atas forEach.
    var idAduan = buildCabangAduanId_(item.code, tanggalInput, nextNumber);
    nextNumber++;
    var slaJam = CONFIG.SLA[prioritas] || CONFIG.SLA['Sedang'] || 8;

    // ── KUNCI: Simpan ke Document Properties DULU ─────────
    // Ini mencegah duplikat jika trigger berikutnya datang sebelum
    // penulisan ke sheet selesai
    setInputSourceProperty_(propKey, idAduan);

    // ── Tulis ke ADUAN ─────────────────────────────────────
    // FIX BUG #2: Waktu Masuk pakai tanggalInput (waktu aduan asli dari cabang)
    aduanSheet.appendRow([
      idAduan,
      tanggalInput,   // ← FIX: was 'now', sekarang pakai tanggal asli input cabang
      item.cabang,
      wilayah,
      desa,
      namaPelanggan,
      noHp,
      jenis,
      prioritas,
      'Baru',
      unitPetugas,
      keterangan,
      '',
      '',
      slaJam,
      now
    ]);

    // ── Update existingAduanMap agar batch berikutnya sadar
    existingAduanMap[fingerprint] = { id: idAduan };

    // ── Tandai baris input sebagai Terkirim ────────────────
    markInputRowSynced_(inputSheet, sheetRow, idAduan, now, 'Masuk ke ADUAN pusat.');

    // ── Tulis ke LOG_INPUT_CABANG ──────────────────────────
    appendInputCabangLog_(
      logSheet, now, item.cabang, item.sheet, sheetRow,
      idAduan, namaPelanggan, jenis, 'Terkirim'
    );

    // ── Update syncedKeyMap in-memory ──────────────────────
    syncedKeyMap[sourceKey] = { id: idAduan };

    syncedCount++;
  });

  return syncedCount;
}



function markInputRowSynced_(inputSheet, rowNumber, idAduan, time, note) {
  inputSheet.getRange(rowNumber, 10, 1, 4).setValues([[
    'Terkirim',
    idAduan,
    time,
    note || 'Masuk ke ADUAN pusat.'
  ]]);
  inputSheet.getRange(rowNumber, 1, 1, 13).setBackground('#ecfdf5');
}

function markInputRowFailed_(inputSheet, rowNumber, time, note) {
  inputSheet.getRange(rowNumber, 10, 1, 4).setValues([[
    'Gagal',
    '',
    time,
    note || 'Data belum lengkap.'
  ]]);
  inputSheet.getRange(rowNumber, 1, 1, 13).setBackground('#fef2f2');
}

function appendInputCabangLog_(logSheet, time, cabang, sheetName, rowNumber, idAduan, namaPelanggan, jenis, status) {
  logSheet.appendRow([
    time,
    cabang,
    sheetName,
    rowNumber,
    idAduan,
    namaPelanggan,
    jenis,
    status || 'Terkirim'
  ]);
}

function makeInputSourcePropertyKey_(sourceKey) {
  return 'SIAGA_SYNCED_' + Utilities.base64EncodeWebSafe(sourceKey).replace(/=+$/g, '');
}

function getInputSourceProperty_(propertyKey) {
  try {
    return PropertiesService.getDocumentProperties().getProperty(propertyKey) || '';
  } catch (e) {
    return '';
  }
}

function setInputSourceProperty_(propertyKey, idAduan) {
  try {
    PropertiesService.getDocumentProperties().setProperty(propertyKey, idAduan);
  } catch (e) {}
}

function buildInputAduanFingerprint_(cabang, dateObj, payload) {
  var datePart = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyyMMdd');
  return [
    datePart,
    normalizeTextForKey_(cabang),
    normalizeTextForKey_(payload.namaPelanggan),
    normalizeTextForKey_(payload.noHp),
    normalizeTextForKey_(payload.wilayah),
    normalizeTextForKey_(payload.desa),
    normalizeTextForKey_(payload.jenis),
    normalizeTextForKey_(payload.prioritas),
    normalizeTextForKey_(payload.unitPetugas),
    normalizeTextForKey_(payload.keterangan)
  ].join('|');
}

function normalizeTextForKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getExistingAduanFingerprintMap_(aduanSheet) {
  var map = {};
  if (!aduanSheet || aduanSheet.getLastRow() < 2) return map;

  var values = aduanSheet.getRange(2, 1, aduanSheet.getLastRow() - 1, 16).getValues();

  values.forEach(function(row) {
    var idAduan = String(row[CONFIG.COL.ID - 1] || '').trim();
    var waktuMasuk = row[CONFIG.COL.WAKTU_MASUK - 1];
    var cabang = row[CONFIG.COL.CABANG - 1];

    if (!idAduan || !waktuMasuk) return;

    var dateObj = asDateForArchive_(waktuMasuk) || new Date(waktuMasuk);
    if (!dateObj || isNaN(dateObj)) return;

    var fingerprint = buildInputAduanFingerprint_(cabang, dateObj, {
      namaPelanggan: row[CONFIG.COL.NAMA_PELANGGAN - 1],
      noHp: row[CONFIG.COL.NO_HP - 1],
      wilayah: row[CONFIG.COL.WILAYAH - 1],
      desa: row[CONFIG.COL.DESA - 1],
      jenis: row[CONFIG.COL.JENIS_GANGGUAN - 1],
      prioritas: row[CONFIG.COL.PRIORITAS - 1],
      unitPetugas: row[CONFIG.COL.UNIT - 1],
      keterangan: row[CONFIG.COL.KETERANGAN - 1]
    });

    if (!map[fingerprint]) {
      map[fingerprint] = { id: idAduan };
    }
  });

  return map;
}

function repairInputCabangSyncMarks() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Perbaiki Penanda Input Cabang',
    'Fitur ini akan mengecek LOG_INPUT_CABANG dan ADUAN, lalu memperbaiki kolom Sync Status/ID Aduan pada sheet INPUT cabang.\n\n' +
    'Gunakan ini jika data sudah masuk ke ADUAN tetapi di sheet cabang belum tertulis Terkirim.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aduanSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var logSheet = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);

  if (!aduanSheet || !logSheet) {
    ui.alert('Sheet ADUAN atau LOG_INPUT_CABANG belum tersedia.');
    return;
  }

  var syncedKeyMap = getSyncedInputKeyMap_(logSheet);
  var fixed = 0;

  CABANG_INPUT_SHEETS.forEach(function(item) {
    var inputSheet = ss.getSheetByName(item.sheet);
    if (!inputSheet) return;

    var lastRow = inputSheet.getLastRow();
    if (lastRow < 2) return;

    for (var r = 2; r <= lastRow; r++) {
      var sourceKey = item.sheet + '#' + r;
      var data = syncedKeyMap[sourceKey];

      if (data && data.id) {
        var existingId = String(inputSheet.getRange(r, 11).getValue() || '').trim();
        var existingStatus = String(inputSheet.getRange(r, 10).getValue() || '').trim();

        if (!existingId || existingStatus !== 'Terkirim') {
          markInputRowSynced_(inputSheet, r, data.id, new Date(), 'Penanda diperbaiki dari LOG_INPUT_CABANG.');
          fixed++;
        }
      }
    }
  });

  ui.alert('✅ Perbaikan selesai. Jumlah baris diperbaiki: ' + fixed);
}


function getSyncedInputKeyMap_(logSheet) {
  var map = {};
  if (!logSheet || logSheet.getLastRow() < 2) return map;

  var values = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues();

  values.forEach(function(row) {
    var sheetName = String(row[2] || '').trim();
    var rowNumber = String(row[3] || '').trim();
    var idAduan = String(row[4] || '').trim();
    var status = String(row[7] || '').trim();

    if (!sheetName || !rowNumber || !idAduan) return;
    if (status !== 'Terkirim') return;

    map[sheetName + '#' + rowNumber] = { id: idAduan };
  });

  return map;
}

function getNextCabangAduanNumber_(cabangCode, dateObj, aduanSheet) {
  var datePart = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyyMMdd');
  var prefix = cabangCode + '-' + datePart + '-';
  var propKey = 'SEQ_' + cabangCode + '_' + datePart;
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    var cached = Number(props.getProperty(propKey) || 0);
    if (cached > 0) {
      var nextCached = cached + 1;
      props.setProperty(propKey, String(nextCached));
      return nextCached;
    }

    var lastRow = aduanSheet.getLastRow();
    var maxNumber = 0;

    if (lastRow >= 2) {
      var ids = aduanSheet.getRange(2, 1, lastRow - 1, 1).getValues();

      ids.forEach(function(row) {
        var id = String(row[0] || '');
        if (id.indexOf(prefix) === 0) {
          var num = Number(id.substring(prefix.length));
          if (!isNaN(num) && num > maxNumber) maxNumber = num;
        }
      });
    }

    var nextNumber = maxNumber + 1;
    props.setProperty(propKey, String(nextNumber));
    return nextNumber;

  } catch (err) {
    // Fallback lama jika lock/cache bermasalah.
    var fallbackLastRow = aduanSheet.getLastRow();
    var fallbackMax = 0;

    if (fallbackLastRow >= 2) {
      var fallbackIds = aduanSheet.getRange(2, 1, fallbackLastRow - 1, 1).getValues();
      fallbackIds.forEach(function(row) {
        var id = String(row[0] || '');
        if (id.indexOf(prefix) === 0) {
          var num = Number(id.substring(prefix.length));
          if (!isNaN(num) && num > fallbackMax) fallbackMax = num;
        }
      });
    }

    return fallbackMax + 1;

  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function buildCabangAduanId_(cabangCode, dateObj, number) {
  var datePart = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyyMMdd');
  return cabangCode + '-' + datePart + '-' + ('0000' + number).slice(-4);
}

function normalizeInputPrioritas_(value) {
  var v = String(value || '').trim();
  if (CONFIG.SLA[v]) return v;

  var lower = v.toLowerCase();
  if (lower === 'urgent' || lower === 'darurat') return 'Darurat';
  if (lower === 'tinggi') return 'Tinggi';
  if (lower === 'rendah') return 'Rendah';
  return 'Sedang';
}

function normalizeInputJenisGangguan_(value) {
  var v = String(value || '').trim();
  if (!v) return '';

  var exact = CONFIG.JENIS_GANGGUAN.indexOf(v);
  if (exact !== -1) return v;

  var lower = v.toLowerCase();

  if (lower.indexOf('mati') !== -1 || lower.indexOf('tidak ada air') !== -1) return 'Air Mati';
  if (lower.indexOf('tekan') !== -1 || lower.indexOf('kecil') !== -1) return 'Tekanan Rendah';
  if (lower.indexOf('keruh') !== -1 || lower.indexOf('kotor') !== -1) return 'Air Keruh';
  if (lower.indexOf('bocor') !== -1 || lower.indexOf('pipa') !== -1) return 'Pipa Bocor';
  if (lower.indexOf('meter') !== -1) return 'Meter Bermasalah';
  if (lower.indexOf('tagihan') !== -1 || lower.indexOf('rekening') !== -1) return 'Tagihan';
  if (lower.indexOf('sambungan') !== -1 || lower.indexOf('pasang') !== -1) return 'Sambungan Baru';

  return 'Lainnya';
}

function normalizeInputUnit_(value) {
  var v = String(value || '').trim();
  if (!v) return '';

  if (CONFIG.UNIT.indexOf(v) !== -1) return v;

  var lower = v.toLowerCase();
  if (lower.indexOf('teknik') !== -1) return 'Teknik';
  if (lower.indexOf('hublang') !== -1 || lower.indexOf('hub') !== -1) return 'Hublang';
  if (lower.indexOf('distribusi') !== -1) return 'Distribusi';
  if (lower.indexOf('produksi') !== -1) return 'Produksi';
  if (lower.indexOf('it') !== -1) return 'IT';
  if (lower.indexOf('cabang') !== -1) return 'Cabang';

  return v;
}

function generateCabangAduanId_(cabangCode, dateObj, aduanSheet) {
  return buildCabangAduanId_(cabangCode, dateObj, getNextCabangAduanNumber_(cabangCode, dateObj, aduanSheet));
}



// ============================================================
// TRIGGER OTOMATIS SINKRON INPUT CABANG
// ============================================================

function getAutoSyncCabangIntervalMinutes_() {
  var minutes = Number(CONFIG.SYNC_INPUT_INTERVAL_MINUTES || 5);

  // Apps Script time trigger paling aman memakai pilihan ini.
  // Jika diisi angka lain, sistem cari pilihan terdekat ke atas.
  var allowed = [1, 5, 10, 15, 30];

  if (allowed.indexOf(minutes) !== -1) return minutes;

  for (var i = 0; i < allowed.length; i++) {
    if (minutes <= allowed[i]) return allowed[i];
  }

  return 30;
}

function enableAutoSyncCabang1Minute() {
  var ui = SpreadsheetApp.getUi();
  var minutes = getAutoSyncCabangIntervalMinutes_();

  var confirm = ui.alert(
    'Aktifkan Sinkron Otomatis Sheet Cabang ' + minutes + ' Menit',
    'Sistem akan otomatis mengecek semua sheet CABANG_* setiap ' + minutes + ' menit.\n\n' +
    'Jika ada baris manual baru yang sudah lengkap dan ID Aduan masih kosong, data akan otomatis masuk ke sheet ADUAN pusat.\n\n' +
    'Interval bisa diganti dari CONFIG:\n' +
    'SYNC_INPUT_INTERVAL_MINUTES: ' + minutes + ',\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  disableAutoSyncCabangTriggers_();

  ScriptApp.newTrigger('autoSyncCabangInputsEveryMinute')
    .timeBased()
    .everyMinutes(minutes)
    .create();

  ui.alert(
    '✅ Sinkron Otomatis Aktif',
    'Sheet CABANG_* akan otomatis dicek setiap ' + minutes + ' menit.\n\n' +
    'Untuk mengganti jeda sync, ubah CONFIG SYNC_INPUT_INTERVAL_MINUTES lalu aktifkan ulang sinkron otomatis.',
    ui.ButtonSet.OK
  );
}



function disableAutoSyncCabangTriggers() {
  var ui = SpreadsheetApp.getUi();

  var confirm = ui.alert(
    'Matikan Sinkron Otomatis',
    'Sinkron otomatis input cabang akan dimatikan.\n\n' +
    'Setelah dimatikan, data cabang hanya masuk ke ADUAN jika admin menjalankan menu Sinkron Input Cabang ke ADUAN secara manual.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var removed = disableAutoSyncCabangTriggers_();

  ui.alert(
    '✅ Sinkron Otomatis Dimatikan',
    'Jumlah trigger yang dihapus: ' + removed,
    ui.ButtonSet.OK
  );
}

function disableAutoSyncCabangTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === 'autoSyncCabangInputsEveryMinute') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  return removed;
}

function autoSyncCabangInputsEveryMinute() {
  // Gunakan ScriptLock agar hanya 1 instance berjalan di semua user sekaligus
  var lock = LockService.getScriptLock();

  try {
    // Jika ada proses lain yang sedang berjalan, lewati saja cycle ini
    if (!lock.tryLock(10000)) {
      Logger.log('autoSync: skip - ada proses lain sedang berjalan.');
      return;
    }

    var result = syncAllCabangInputs_();

    if (result && result.totalSynced > 0) {
      writeAutoSyncLog_(result);
    }
  } catch (e) {
    writeAutoSyncErrorLog_(e);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

function writeAutoSyncLog_(result) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupInputCabangLogSheet(ss);
  var sh = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);

  sh.appendRow([
    new Date(),
    'AUTO_SYNC',
    'TRIGGER_1_MENIT',
    '-',
    '-',
    '-',
    'Total data masuk: ' + result.totalSynced,
    'AUTO'
  ]);
}

function writeAutoSyncErrorLog_(error) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupInputCabangLogSheet(ss);
  var sh = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);

  sh.appendRow([
    new Date(),
    'AUTO_SYNC_ERROR',
    'TRIGGER_1_MENIT',
    '-',
    '-',
    '-',
    error && error.message ? error.message : String(error),
    'ERROR'
  ]);
}



// ============================================================
// WHATSAPP MENU BOT - LAYANAN PELANGGAN
// ============================================================
function setupWhatsAppMenuBot() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppLogSheet(ss);
  setupWhatsAppSessionSheet(ss);

  SpreadsheetApp.getUi().alert(
    '✅ Menu Chat WhatsApp siap',
    'Pelanggan bisa chat: halo / menu\n\n' +
    'Menu yang tersedia:\n' +
    '1. Buat aduan baru\n' +
    '2. Cek status aduan\n' +
    '3. Lihat aduan saya\n' +
    '4. Hubungi admin\n\n' +
    'Catatan: jika provider WhatsApp belum mendukung tombol/list message, sistem memakai balas angka.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function setupWhatsAppSessionSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.WHATSAPP_SESSION_SHEET);

  var __fastKey = sh ? getSheetRuntimeKey_('SESSION_SETUP_FAST_V1096', sh) : '';
  if (isSiagaFastMode_() && __fastKey && cacheGet_(__fastKey)) return sh;

  if (sh.getLastRow() === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, 5).setValues([[
      'No HP', 'State', 'Data JSON', 'Updated At', 'Catatan'
    ]]);
  }

  sh.getRange(1, 1, 1, 5)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 5);
  if (__fastKey) cachePut_(__fastKey, '1', 21600);

}

function openWhatsAppSessionSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppSessionSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET));
}

function getWhatsAppMenuResponse_(message, phone, payload) {
  payload = payload || {};
  message = String(message || '').trim();

  // FIX V9.5:
  // Kirimin kadang mengirim hasil klik List Menu sebagai teks judul/deskripsi,
  // misalnya "Buat Aduan Baru\nLaporkan gangguan air".
  // Teks itu harus dianggap sebagai angka menu.
  var mappedMenuChoice = normalizeIncomingListMenuChoice_(message);
  if (mappedMenuChoice) message = mappedMenuChoice;

  phone = normalizePhone_(phone || '');
  var lower = message.toLowerCase();

  // V10.9.31:
  // Kalau provider hanya mengirim title tombol "Kembali" tanpa id PAY_INFO,
  // pakai session halaman info untuk kembali ke List Info Layanan, bukan Menu Utama.
  if (lower === 'kembali') {
    var backSession = getWhatsAppSession_(phone);
    if (backSession && (
      backSession.state === 'INFO_LAYANAN_DETAIL' ||
      backSession.state === 'INFO_LAYANAN_MENU'
    )) {
      return handleInfoPembayaranChoice_('info pembayaran', phone);
    }
  }

  // V10.9.18:
  // Fix tombol "Cek Tiket Ini" yang pada sebagian provider terkirim sebagai title tombol,
  // bukan sebagai id CEK_TIKET_<ID>.
  if (lower === 'cek tiket ini' || lower.indexOf('cek tiket') !== -1 || lower.indexOf('tiket ini') !== -1) {
    return handleCekTiketIni_(phone);
  }

  if (
    lower === 'hubungi admin' ||
    lower === 'admin' ||
    lower.indexOf('hubungi admin') !== -1 ||
    lower.indexOf('chat admin') !== -1 ||
    lower.indexOf('admin pembayaran') !== -1
  ) {
    return handleAdminHandoff_(phone, 'Info Pembayaran');
  }

  if (
    lower === 'info pembayaran' ||
    lower === 'info layanan' ||
    lower === '4' ||
    lower.indexOf('info bayar') !== -1 ||
    lower.indexOf('info pembayaran') !== -1 ||
    lower.indexOf('info layanan') !== -1 ||
    lower.indexOf('pembayaran') !== -1 ||
    lower.indexOf('cara bayar') !== -1 ||
    lower.indexOf('kendala bayar') !== -1 ||
    lower.indexOf('kendala pembayaran') !== -1 ||
    lower.indexOf('air tangki') !== -1 ||
    lower.indexOf('balik nama') !== -1 ||
    lower.indexOf('pindah meter') !== -1 ||
    lower.indexOf('sambung kembali') !== -1 ||
    lower.indexOf('sambungan pindah') !== -1 ||
    lower.indexOf('sambungan pemindahan') !== -1 ||
    lower.indexOf('pemindahan meter') !== -1
  ) {
    return handleInfoPembayaranChoice_(lower, phone);
  }

  if (lower === 'menu' || lower === 'menu utama' || lower === 'home') {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'MAIN_MENU',
      reply: buildMainWhatsAppMenuReply_()
    };
  }


  // Perintah global
  if (isMenuCommand_(lower)) {
    setWhatsAppSession_(phone, 'MAIN', {});
    return {
      success: true,
      type: 'MAIN_MENU',
      reply: buildMainWhatsAppMenuReply_()
    };
  }

  if (['batal', 'cancel', 'reset', 'ulang'].indexOf(lower) !== -1) {
    clearWhatsAppSession_(phone);
    return {
      success: true,
      type: 'SESSION_CANCEL',
      reply: 'Baik, proses sebelumnya dibatalkan.',
      navButtons: buildNavButtons_('main')
    };
  }

  // Jika pelanggan langsung kirim ID aduan, langsung tracking.
  var directId = extractAduanId_(message);
  if (directId) {
    var aduan = findAduanById_(directId);
    if (aduan) {
      clearWhatsAppSession_(phone);
      return { success: true, type: 'STATUS_BY_ID', id: aduan.id, reply: buildWhatsAppTrackingReply_(aduan),
      navButtons: buildNavButtons_('status') };
    }
    return { success: false, type: 'NOT_FOUND_ID', id: directId, reply: buildNotFoundReply_(directId, phone),
      navButtons: buildNavButtons_('not_found') };
  }

  var session = getWhatsAppSession_(phone);
  if (!session || !session.state) {
    // V10.9.17:
    // Setelah tombol Batal ditekan, session dikosongkan.
    // Tombol seperti Buat Aduan / Cek Status / Riwayat tetap mengirim ID menu 1/2/3.
    // Jadi numeric choice harus tetap diproses meski session kosong.
    if (lower === '1' || lower === '2' || lower === '3' || lower === '4') {
      return handleMainMenuChoice_(message, phone);
    }

    // Kalau klik/ketik "status", cari aduan terakhir berdasarkan nomor WA.
    if (lower === 'status' || lower === 'cek' || lower === 'cek status' || lower === 'cek status aduan') {
      return handleMainMenuChoice_('2', phone);
    }

    if (lower === 'lihat' || lower === 'riwayat' || lower === 'riwayat aduan') {
      return handleListAduanSaya_(phone);
    }

    setWhatsAppSession_(phone, 'MAIN', {});
    return {
      success: true,
      type: 'MAIN_MENU',
      reply: buildMainWhatsAppMenuReply_()
    };
  }

  // V10.9.31 - Pilihan di List Info Layanan.
  if (session.state === 'INFO_LAYANAN_MENU') {
    return handleInfoPembayaranChoice_(message, phone);
  }

  // Pilihan menu utama
  if (session.state === 'MAIN') {
    return handleMainMenuChoice_(message, phone);
  }

  // Mode hubungi admin: bot diam agar percakapan bisa ditangani manual oleh admin/petugas.
  // Pelanggan bisa ketik "menu" untuk kembali ke layanan otomatis.
  if (session.state === 'ADMIN_HANDOFF') {
    return {
      success: true,
      type: 'ADMIN_HANDOFF_NO_REPLY',
      reply: ''
    };
  }

  if (session.state === 'AWAIT_ID') {
    // Kalau user berubah pikiran dan memilih menu lain, jangan dikunci di mode cek ID.
    if (lower === '1' || lower === '4') return handleMainMenuChoice_(message, phone);
    if (lower === 'lihat' || lower === 'riwayat' || lower === 'aduan' || lower === '3') return handleListAduanSaya_(phone);
    if (lower === '2') {
      return {
        success: true,
        type: 'ASK_ID',
        reply: buildAskIdReply_(),
        navButtons: buildAskIdNavButtons_()
      };
    }
    return {
      success: true,
      type: 'ASK_ID',
      reply: buildAskIdReply_(),
      navButtons: buildAskIdNavButtons_()
    };
  }

  if (session.state === 'PICK_ADUAN') {
    return handlePickAduan_(message, phone, session);
  }

  if (session.state.indexOf('NEW_') === 0) {
    return handleNewAduanFlow_(message, phone, session, payload);
  }

  setWhatsAppSession_(phone, 'MAIN', {});
  return {
    success: true,
    type: 'MAIN_MENU',
    reply: buildMainWhatsAppMenuReply_()
  };
}

function isMenuCommand_(lower) {
  lower = String(lower || '').trim().toLowerCase();

  // Dibuat longgar: pelanggan sering mengetik p, min, admin, cek, aduan, hallo, hallooo, dsb.
  var exact = [
    'halo', 'hallo', 'hai', 'hi', 'hello', 'menu', 'mulai', 'start', '/start',
    'siaga', 'bantuan', 'help', 'p', 'tes', 'test'
  ];
  if (exact.indexOf(lower) !== -1) return true;

  // Pola fleksibel untuk variasi kata.
  if (/^ha+l+o+$/i.test(lower)) return true;       // halo, hallo, hallooo
  if (/^he+l+o+$/i.test(lower)) return true;       // hello, helloo
  if (lower.indexOf('menu') !== -1) return true;
  if (lower.indexOf('bantuan') !== -1) return true;
  if (lower.indexOf('admin') !== -1) return true;
  if (lower.indexOf('layanan') !== -1) return true;
  if (lower.indexOf('aduan') !== -1 && lower.indexOf('status') === -1) return true;

  return false;
}


function buildAskIdReply_() {
  return [
    '🔎 *Cek Status Aduan*',
    '',
    'Silakan kirim *ID Aduan* yang ingin dicek.',
    '',
    'Contoh:',
    '*PRY-20260503-0001*'
  ].join('\n');
}

function buildAskIdNavButtons_() {
  return [
    { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}




// ============================================================
// V10.9.22 - ADMIN HANDOFF HELPER
// ============================================================

function handleAdminHandoff_(phone, context) {
  context = context || 'Admin';

  if (isRestrictedOutsideHours_()) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: 'OUTSIDE_HOURS_BLOCK_ADMIN',
      reply: buildOutsideHoursBlockedReply_('Hubungi Admin'),
      navButtons: buildNavButtons_('outside_hours')
    };
  }

  setWhatsAppSession_(phone, 'ADMIN_HANDOFF', { context: context });
  return {
    success: true,
    type: 'CONTACT_ADMIN',
    reply: [
      'Baik, Anda akan terhubung dengan admin.',
      '',
      'Silakan tuliskan kendala Anda secara singkat.',
      '',
      'Admin akan membantu pengecekan pada jam kerja.'
    ].join('\n'),
    navButtons: [
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ]
  };
}


// ============================================================
// V10.9.21 - INFO LAYANAN & PEMBAYARAN
// V10.9.24 - DETAIL LAYANAN DARI WEBSITE
// ============================================================

function buildInfoDetailButtons_() {
  return [
    { id: 'PAY_INFO', title: 'Kembali' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function buildKendalaPembayaranButtons_() {
  return [
    { id: 'PAY_ADMIN', title: 'Hubungi Admin' },
    { id: 'PAY_INFO', title: 'Kembali' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function buildInfoLayananRows_() {
  return [
    { id: 'PAY_CARA_BAYAR', title: 'Cara Bayar', description: 'Panduan pembayaran tagihan' },
    { id: 'PAY_KENDALA_BAYAR', title: 'Kendala Bayar', description: 'Sudah bayar/status belum berubah' },
    { id: 'PAY_AIR_TANGKI', title: 'Air Tangki', description: 'Daftar harga layanan air tangki' },
    { id: 'PAY_BALIK_NAMA', title: 'Balik Nama', description: 'Alur proses balik nama pelanggan' },
    { id: 'PAY_PINDAH_METER', title: 'Pindah Meter Air', description: 'Alur pemindahan water meter' },
    { id: 'PAY_SAMBUNG_KEMBALI', title: 'Sambung Kembali', description: 'Panduan sambung kembali layanan' },
    { id: 'PAY_SAMBUNG_PINDAH', title: 'Sambungan Pindah', description: 'Alur pemindahan meter air' },
    { id: 'NAV_MENU', title: 'Menu Utama', description: 'Kembali ke layanan utama' }
  ];
}

function buildInfoPembayaranReply_() {
  return [
    'ℹ️ *Info Layanan & Pembayaran*',
    '',
    'Silakan pilih informasi yang Anda butuhkan.',
    '',
    '• Cara Bayar',
    '• Kendala Bayar',
    '• Air Tangki',
    '• Balik Nama',
    '• Pindah Meter Air',
    '• Sambung Kembali',
    '• Sambungan Pemindahan Meter Air'
  ].join('\n');
}

function sendKiriminInfoLayananMenu_(phone) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk Info Layanan.' };

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: buildInfoPembayaranReply_()
      },
      action: {
        button: 'Pilih Info',
        sections: [
          {
            title: 'Info Layanan',
            rows: buildInfoLayananRows_()
          }
        ]
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function buildCaraBayarReply_() {
  return [
    '💳 *Cara Bayar Tagihan*',
    '',
    'Pembayaran tagihan air dapat dilakukan melalui:',
    '',
    '1. Loket resmi PERUMDAM',
    '2. Kantor cabang/unit pelayanan',
    '3. Mitra pembayaran resmi jika tersedia',
    '4. Kanal pembayaran digital yang bekerja sama dengan PERUMDAM jika tersedia',
    '',
    'Pastikan *No Pelanggan* sudah benar sebelum melakukan pembayaran.',
    'Simpan bukti pembayaran sampai status tagihan berhasil terkonfirmasi.',
    '',
    'Jika pembayaran sudah dilakukan tetapi status belum berubah, pilih *Kendala Bayar*.'
  ].join('\n');
}

function buildKendalaPembayaranReply_() {
  return [
    '💳 *Kendala Pembayaran*',
    '',
    'Untuk pengecekan pembayaran, mohon siapkan:',
    '',
    '• No Pelanggan',
    '• Nama pelanggan',
    '• Tanggal pembayaran',
    '• Kanal pembayaran',
    '• Nominal pembayaran',
    '• Bukti pembayaran jika ada',
    '',
    'Kendala yang bisa dibantu:',
    '• Sudah bayar tapi status belum berubah',
    '• Pembayaran gagal tetapi saldo terpotong',
    '• Salah input No Pelanggan',
    '• Tagihan terasa tidak sesuai',
    '• Pembayaran dobel',
    '',
    'Admin akan membantu pengecekan pada jam kerja.'
  ].join('\n');
}

function buildAirTangkiReply_() {
  return [
    '🚚 *Air Tangki*',
    '',
    'Berikut daftar harga layanan air tangki:',
    '',
    '*Kelompok Sosial*',
    '• 0–10 Km: Rp145.000',
    '• 11–20 Km: Rp175.000',
    '• 21–30 Km: Rp205.000',
    '• 31–40 Km: Rp230.000',
    '• >41 Km: Rp260.000',
    '',
    '*Kelompok Niaga*',
    '• 0–10 Km: Rp225.000',
    '• 11–20 Km: Rp265.000',
    '• 21–30 Km: Rp310.000',
    '• 31–40 Km: Rp355.000',
    '• >41 Km: Rp400.000'
  ].join('\n');
}

function buildBalikNamaReply_() {
  return [
    '📝 *Alur Proses Balik Nama*',
    '',
    'Berikut alur proses balik nama:',
    '',
    '1. Pelanggan mendaftar, mengisi dan menandatangani formulir di cabang dengan membawa rekening terakhir yang sudah dilunasi dan KTP.',
    '2. Membayar biaya administrasi sebesar *Rp55.500*.',
    '3. Cabang bersurat ke Bidang Hubungan Langganan untuk diproses.',
    '4. Nama pelanggan akan berubah pada bulan berikutnya.'
  ].join('\n');
}

function buildPindahMeterAirReply_() {
  return [
    '🔧 *Alur Pindah Meter Air*',
    '',
    'Berikut alur pelayanan pindah meter air pelanggan:',
    '',
    '1. Pelanggan mengajukan permohonan pemindahan water meter ke kantor cabang atau unit layanan PDAM terdekat.',
    '2. Petugas PDAM memverifikasi permohonan dan melakukan survei lokasi untuk menilai kelayakan teknis pemindahan.',
    '3. Jika disetujui, PDAM akan menentukan biaya pemindahan.',
    '4. Petugas PDAM datang ke lokasi untuk melakukan pemindahan water meter pada lokasi yang telah ditentukan.',
    '5. Pelanggan memastikan lokasi baru sudah dipersiapkan sesuai petunjuk petugas.'
  ].join('\n');
}

function buildSambungKembaliReply_() {
  return [
    '🔁 *Panduan Sambung Kembali*',
    '',
    'Panduan sambung kembali layanan yang telah terputus:',
    '',
    '1. Pelanggan wajib melunasi tunggakan dan membayar biaya administrasi sebesar *Rp50.000*.',
    '2. Petugas melakukan pemasangan water meter.'
  ].join('\n');
}

function buildSambunganPemindahanMeterReply_() {
  return [
    '🔁 *Panduan Sambungan Pemindahan Meter Air*',
    '',
    'Berikut alur sambungan pemindahan meter air:',
    '',
    '1. Berita acara pencabutan.',
    '2. Membayar seluruh tunggakan rekening yang tertunggak.',
    '3. Petugas melakukan survei.',
    '4. Pemasangan.',
    '5. Melakukan balik nama.'
  ].join('\n');
}

function handleInfoPembayaranChoice_(choice, phone) {
  choice = String(choice || '').toLowerCase();

  if (choice.indexOf('hubungi admin') !== -1 || choice === 'admin' || choice.indexOf('chat admin') !== -1) {
    return handleAdminHandoff_(phone, 'Info Layanan & Pembayaran');
  }

  if (choice.indexOf('cara') !== -1 && choice.indexOf('bayar') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'cara_bayar' });
    return {
      success: true,
      type: 'INFO_CARA_BAYAR',
      reply: buildCaraBayarReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('kendala') !== -1 || choice.indexOf('gagal') !== -1 || choice.indexOf('saldo') !== -1 || choice.indexOf('dobel') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'kendala_bayar' });
    return {
      success: true,
      type: 'INFO_KENDALA_PEMBAYARAN',
      reply: buildKendalaPembayaranReply_(),
      navButtons: buildKendalaPembayaranButtons_()
    };
  }

  if (choice.indexOf('air tangki') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'air_tangki' });
    return {
      success: true,
      type: 'INFO_AIR_TANGKI',
      reply: buildAirTangkiReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('balik nama') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'balik_nama' });
    return {
      success: true,
      type: 'INFO_BALIK_NAMA',
      reply: buildBalikNamaReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (
    choice.indexOf('sambungan pindah') !== -1 ||
    choice.indexOf('sambungan pemindahan') !== -1 ||
    choice.indexOf('pemindahan meter') !== -1
  ) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'sambungan_pemindahan_meter' });
    return {
      success: true,
      type: 'INFO_SAMBUNGAN_PINDAH_METER',
      reply: buildSambunganPemindahanMeterReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('pindah meter') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'pindah_meter' });
    return {
      success: true,
      type: 'INFO_PINDAH_METER',
      reply: buildPindahMeterAirReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  if (choice.indexOf('sambung kembali') !== -1) {
    setWhatsAppSession_(phone, 'INFO_LAYANAN_DETAIL', { page: 'sambung_kembali' });
    return {
      success: true,
      type: 'INFO_SAMBUNG_KEMBALI',
      reply: buildSambungKembaliReply_(),
      navButtons: buildInfoDetailButtons_()
    };
  }

  setWhatsAppSession_(phone, 'INFO_LAYANAN_MENU', {});
  return {
    success: true,
    type: 'INFO_LAYANAN_MENU',
    reply: buildInfoPembayaranReply_(),
    infoLayananMenu: true
  };
}


function handleMainMenuChoice_(message, phone) {
  var choice = String(message || '').trim().toLowerCase();

  if ((choice === '1' || choice.indexOf('buat') !== -1 || choice.indexOf('aduan baru') !== -1) && shouldBlockNewAduanOutsideHours_()) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: 'OUTSIDE_HOURS_BLOCK_NEW_ADUAN',
      reply: buildOutsideHoursBlockedReply_('Buat Aduan Baru'),
      navButtons: buildNavButtons_('outside_hours')
    };
  }

  if (choice === '1' || choice.indexOf('buat') !== -1 || choice.indexOf('aduan baru') !== -1) {
    var activeLimit = buildActiveLimitResult_(phone);
    if (activeLimit.blocked) return activeLimit.result;

    setWhatsAppSession_(phone, 'NEW_CABANG', {
      activeCheckedAt: new Date().getTime(),
      activeCount: activeLimit.info ? activeLimit.info.count : 0
    });
    return {
      success: true,
      type: 'ASK_CABANG',
      page: 1,
      reply: buildCabangMenuReply_(1)
    };
  }

  if (choice === '2' || choice.indexOf('cek') !== -1 || choice.indexOf('status') !== -1) {
    setWhatsAppSession_(phone, 'AWAIT_ID', {});
    return {
      success: true,
      type: 'ASK_ID',
      reply: buildAskIdReply_(),
      navButtons: buildAskIdNavButtons_()
    };
  }

  if (choice === '3' || choice.indexOf('lihat') !== -1 || choice.indexOf('riwayat') !== -1 || choice.indexOf('aduan saya') !== -1) {
    return handleListAduanSaya_(phone);
  }

  if (choice === '4' || choice.indexOf('info') !== -1 || choice.indexOf('layanan') !== -1 || choice.indexOf('pembayaran') !== -1 || choice.indexOf('bayar') !== -1 || choice.indexOf('kendala') !== -1) {
    return handleInfoPembayaranChoice_(choice, phone);
  }

  if (choice.indexOf('admin') !== -1 || choice.indexOf('petugas') !== -1 || choice.indexOf('operator') !== -1) {
    return handleAdminHandoff_(phone, 'Admin');
  }

  setWhatsAppSession_(phone, 'MAIN', {});
  return {
    success: true,
    type: 'MAIN_MENU_FALLBACK',
    reply: buildMainWhatsAppMenuReply_()
  };
}

// ============================================================
// JAM KERJA / OUTSIDE BUSINESS HOURS
// ============================================================

function getBusinessHoursConfig_() {
  var props = PropertiesService.getScriptProperties();

  return {
    enabled: String(props.getProperty('BUSINESS_HOURS_ENABLED') || CONFIG.BUSINESS_HOURS_ENABLED || 'YA').toUpperCase() !== 'TIDAK',
    start: props.getProperty('BUSINESS_HOURS_START') || CONFIG.BUSINESS_HOURS_START || '08:00',
    end: props.getProperty('BUSINESS_HOURS_END') || CONFIG.BUSINESS_HOURS_END || '16:00',
    days: props.getProperty('BUSINESS_HOURS_DAYS') || CONFIG.BUSINESS_HOURS_DAYS || '1,2,3,4,5',
    timezone: props.getProperty('BUSINESS_HOURS_TIMEZONE') || CONFIG.BUSINESS_HOURS_TIMEZONE || Session.getScriptTimeZone()
  };
}

function isWithinBusinessHours_() {
  var cfg = getBusinessHoursConfig_();
  if (!cfg.enabled) return true;

  var now = new Date();
  var tz = cfg.timezone || Session.getScriptTimeZone();

  var day = Number(Utilities.formatDate(now, tz, 'u')); // 1 Senin - 7 Minggu
  var allowedDays = String(cfg.days || '1,2,3,4,5')
    .split(',')
    .map(function(x) { return Number(String(x).trim()); })
    .filter(Boolean);

  if (allowedDays.indexOf(day) === -1) return false;

  var currentMinutes = timeTextToMinutes_(Utilities.formatDate(now, tz, 'HH:mm'));
  var startMinutes = timeTextToMinutes_(cfg.start || '08:00');
  var endMinutes = timeTextToMinutes_(cfg.end || '16:00');

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  // Untuk shift melewati tengah malam.
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function timeTextToMinutes_(text) {
  var parts = String(text || '00:00').split(':');
  var h = Number(parts[0] || 0);
  var m = Number(parts[1] || 0);
  return h * 60 + m;
}

function getBusinessHoursLabel_() {
  var cfg = getBusinessHoursConfig_();
  var dayLabel = 'Senin–Jumat';
  var days = String(cfg.days || '').replace(/\s/g, '');

  if (days === '1,2,3,4,5,6') dayLabel = 'Senin–Sabtu';
  if (days === '1,2,3,4,5,6,7') dayLabel = 'Setiap hari';

  return dayLabel + ' pukul ' + (cfg.start || '08:00') + '–' + (cfg.end || '16:00') + ' WITA';
}

function buildOutsideBusinessHoursNotice_() {
  return [
    'Saat ini layanan admin berada di luar jam kerja.',
    'Jam layanan admin: *' + getBusinessHoursLabel_() + '*.',
    '',
    'Aduan tetap dapat dibuat melalui sistem dan akan tercatat otomatis.',
    'Untuk kondisi darurat, laporan akan tetap diteruskan ke petugas/admin.'
  ].join('\n');
}

function maybeAppendBusinessHoursNotice_(reply, type) {
  // V10.9.3:
  // Di luar jam kerja tidak lagi sekadar menambah notice.
  // Akses pembuatan aduan/admin diblokir langsung di handler menu.
  // Cek status dan lihat aduan tetap bersih.
  return reply;
}


function isRestrictedOutsideHours_() {
  return !isWithinBusinessHours_();
}

function buildOutsideHoursLimitedMenuReply_() {
  return [
    'Hallo Sahabat Tiara, Selamat datang di layanan WhatsApp *PERUMDAM Tirta Ardhia Rinjani Kabupaten Lombok Tengah*.',
    '',
    'Saat ini layanan admin berada di luar jam kerja.',
    'Jam layanan admin: *' + getBusinessHoursLabel_() + '*.',
    '',
    'Di luar jam kerja, layanan yang tersedia:',
    '',
    '1. Info Layanan & Pembayaran',
    '2. Riwayat Aduan / Cek Status',
    '',
    'Silakan gunakan tombol di bawah ini.',
    'Untuk cek status, pilih *Riwayat Aduan* lalu pilih tiket.',
    'Jika sudah memiliki tiket, Anda juga bisa mengirim langsung *ID Aduan*.'
  ].join('\n');
}

function buildOutsideHoursBlockedReply_(featureName) {
  return [
    'Mohon maaf, layanan *' + (featureName || 'ini') + '* belum tersedia di luar jam kerja.',
    '',
    'Jam layanan admin: *' + getBusinessHoursLabel_() + '*.',
    '',
    'Yang masih bisa digunakan saat ini:',
    '1. *Info Layanan & Pembayaran*',
    '2. *Riwayat Aduan / Cek Status*',
    '',
    'Silakan gunakan tombol di bawah ini.',
    'Untuk cek status, pilih *Riwayat Aduan* lalu pilih tiket.',
    'Jika sudah memiliki tiket, Anda juga bisa mengirim langsung *ID Aduan*.'
  ].join('\n');
}

function shouldBlockNewAduanOutsideHours_() {
  return isRestrictedOutsideHours_();
}


function setBusinessHoursConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var enabledPrompt = ui.prompt(
    '1/4 - Aktifkan Jam Kerja?',
    'Isi YA atau TIDAK. Default: YA',
    ui.ButtonSet.OK_CANCEL
  );
  if (enabledPrompt.getSelectedButton() !== ui.Button.OK) return;

  var startPrompt = ui.prompt(
    '2/4 - Jam Mulai',
    'Contoh: 08:00',
    ui.ButtonSet.OK_CANCEL
  );
  if (startPrompt.getSelectedButton() !== ui.Button.OK) return;

  var endPrompt = ui.prompt(
    '3/4 - Jam Selesai',
    'Contoh: 16:00',
    ui.ButtonSet.OK_CANCEL
  );
  if (endPrompt.getSelectedButton() !== ui.Button.OK) return;

  var daysPrompt = ui.prompt(
    '4/4 - Hari Kerja',
    'Isi angka hari dipisah koma.\n1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 7=Minggu\n\nContoh Senin-Jumat: 1,2,3,4,5\nContoh Senin-Sabtu: 1,2,3,4,5,6',
    ui.ButtonSet.OK_CANCEL
  );
  if (daysPrompt.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty('BUSINESS_HOURS_ENABLED', enabledPrompt.getResponseText().trim().toUpperCase() || 'YA');
  props.setProperty('BUSINESS_HOURS_START', startPrompt.getResponseText().trim() || '08:00');
  props.setProperty('BUSINESS_HOURS_END', endPrompt.getResponseText().trim() || '16:00');
  props.setProperty('BUSINESS_HOURS_DAYS', daysPrompt.getResponseText().trim() || '1,2,3,4,5');
  props.setProperty('BUSINESS_HOURS_TIMEZONE', 'Asia/Makassar');

  ui.alert(
    '✅ Jam kerja tersimpan',
    'Jam layanan admin: ' + getBusinessHoursLabel_(),
    ui.ButtonSet.OK
  );
}

function testBusinessHoursMessage() {
  var ui = SpreadsheetApp.getUi();
  var inside = isWithinBusinessHours_();

  ui.alert(
    inside ? '✅ Sekarang masih dalam jam kerja' : '⚠️ Sekarang di luar jam kerja',
    'Jam layanan admin: ' + getBusinessHoursLabel_() + '\n\n' + buildOutsideBusinessHoursNotice_(),
    ui.ButtonSet.OK
  );
}


function buildMainWhatsAppMenuReply_() {
  return [
    'Hallo Sahabat Tiara, Selamat datang di layanan WhatsApp *PERUMDAM Tirta Ardhia Rinjani Kabupaten Lombok Tengah*.',
    '',
    'Saya adalah *SIAGA TIARA*, layanan informasi aduan gangguan air. Melalui chat ini, pelanggan dapat membuat aduan, mengecek progres penanganan, atau menghubungi admin.',
    '',
    'Silakan pilih layanan:',
    '',
    '*1.* Buat aduan gangguan air',
    '*2.* Cek status aduan',
    '*3.* Riwayat Aduan',
    '*4.* Info Layanan & Pembayaran',
    '',
    'Balas dengan angka *1 / 2 / 3 / 4*.',
    '',
    'Jika sudah memiliki ID aduan, kirim langsung ID tersebut.',
    'Contoh: *PRY-20260503-0001*'
  ].join('\n');
}

function handleListOrLatestAduan_(phone) {
  var list = findAduansByPhone_(phone, 10);
  if (!list.length) {
    return {
      success: false,
      type: 'NO_ADUAN_BY_PHONE',
      reply: [
        '💧 *SIAGA TIARA*',
        '',
        'Belum ada aduan yang ditemukan untuk nomor WhatsApp ini.',
        '',
        'Silakan pilih layanan yang tersedia.'
      ].join('\n'),
      navButtons: [
        { id: 'MENU_1_ADUAN', title: 'Buat Aduan' },
        { id: 'MENU_2_STATUS', title: 'Cek Status' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  if (list.length === 1) {
    return { success: true, type: 'STATUS_BY_PHONE', id: list[0].id, reply: buildWhatsAppTrackingReply_(list[0]),
      navButtons: buildNavButtons_('status') };
  }

  return handleListAduanSaya_(phone);
}

function handleListAduanSaya_(phone) {
  var allList = findAduansByPhone_(phone, 10);
  if (!allList.length) {
    setWhatsAppSession_(phone, 'MAIN', {});
    return {
      success: false,
      type: 'NO_ADUAN_BY_PHONE',
      reply: [
        '💧 *SIAGA TIARA*',
        '',
        'Belum ada aduan yang ditemukan untuk nomor WhatsApp ini.',
        '',
        'Silakan pilih layanan yang tersedia.'
      ].join('\n'),
      navButtons: [
        { id: 'MENU_1_ADUAN', title: 'Buat Aduan' },
        { id: 'MENU_2_STATUS', title: 'Cek Status' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  // WhatsApp List Menu umumnya dibatasi 10 rows.
  // Maka 9 tiket + 1 row Menu Utama.
  var list = allList.slice(0, 9);
  var ids = list.map(function(d) { return d.id; });
  setWhatsAppSession_(phone, 'PICK_ADUAN', { ids: ids });

  return {
    success: true,
    type: 'LIST_ADUAN',
    reply: buildAduanListReply_(list, allList.length),
    riwayatMenu: true,
    riwayatList: list,
    totalRiwayat: allList.length,
    navButtons: [
      { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ]
  };
}

function buildAduanListReply_(list, totalCount) {
  totalCount = Number(totalCount || (list ? list.length : 0));
  var shown = list ? list.length : 0;

  var lines = [
    '📋 *Riwayat Aduan*',
    '',
    'Ditemukan ' + totalCount + ' aduan dari nomor WhatsApp ini.'
  ];

  if (totalCount > shown) {
    lines.push('Ditampilkan ' + shown + ' riwayat terbaru.');
  }

  lines.push('');
  lines.push('Tekan tombol *Pilih Tiket* untuk membuka detail aduan.');

  return lines.join('\n');
}


function buildRiwayatAduanRows_(list) {
  list = (list || []).slice(0, 9);

  var rows = list.map(function(d, i) {
    var id = normalizeAduanIdHyphen_(d.id || '') || (d.id || '');
    var jenis = String(d.jenisGangguan || '-');
    var status = String(d.status || '-');
    var noPel = String(getNoPelangganFromAduan_(d) || '-');

    return {
      id: 'CEK_TIKET_' + id,
      title: ((i + 1) + '. ' + id).substring(0, 24),
      description: (jenis + ' - ' + status + ' | No: ' + noPel).substring(0, 72)
    };
  });

  rows.push({
    id: 'NAV_MENU',
    title: 'Menu Utama',
    description: 'Kembali ke layanan utama'
  });

  return rows;
}

function sendKiriminRiwayatAduanMenu_(phone, list) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk Riwayat Aduan.' };

  var rows = buildRiwayatAduanRows_(list || []);
  if (!rows.length) return { success: false, error: 'Data riwayat kosong.' };

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: buildAduanListReply_(list || [], (list || []).length)
      },
      action: {
        button: 'Pilih Tiket',
        sections: [
          {
            title: 'Riwayat Aduan',
            rows: rows
          }
        ]
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}


function handlePickAduan_(message, phone, session) {
  var n = parseInt(String(message || '').trim(), 10);
  var ids = session.data && session.data.ids ? session.data.ids : [];

  if (!n || n < 1 || n > ids.length) {
    return {
      success: false,
      type: 'PICK_ADUAN_INVALID',
      reply: 'Pilihan tidak tersedia. Silakan buka lagi daftar Riwayat Aduan.',
      navButtons: [
        { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' },
        { id: 'NAV_MENU', title: 'Menu Utama' }
      ]
    };
  }

  var id = ids[n - 1];
  var d = findAduanById_(id);
  if (!d) {
    return { success: false, type: 'PICK_ADUAN_NOT_FOUND', id: id, reply: buildNotFoundReply_(id, phone),
      navButtons: buildNavButtons_('not_found') };
  }

  clearWhatsAppSession_(phone);
  return { success: true, type: 'PICK_ADUAN_STATUS', id: d.id, reply: buildWhatsAppTrackingReply_(d),
      navButtons: buildNavButtons_('status') };
}



// ============================================================
// V10.9.13 - TOMBOL KONTROL INPUT ADUAN (BATAL / KEMBALI)
// ============================================================

function buildNewAduanControlButtons_() {
  return [
    { id: 'ADUAN_CANCEL', title: 'Batal' },
    { id: 'ADUAN_BACK', title: 'Kembali' }
  ];
}

function isNewAduanBackCommand_(text) {
  var lower = String(text || '').toLowerCase().trim();
  return lower === '__aduan_back__' ||
         lower === 'kembali' ||
         lower === 'back' ||
         lower === 'mundur';
}

function buildAskNamaPelangganReply_(cabangChoice) {
  return '📝 *Buat Aduan Baru*\n\n' +
    'Cabang terpilih: *' + (cabangChoice || '-') + '*\n\n' +
    'Silakan ketik *nama pelanggan*.\n\n' +
    'Contoh:\n*ERWIN*';
}

function buildAskNoPelangganReply_() {
  return 'Baik. Sekarang ketik *No Pelanggan*.';
}

function buildNoPelangganInvalidReply_() {
  return 'No Pelanggan belum sesuai.\n\n' +
    'Mohon isi hanya angka, minimal 5 digit dan maksimal 20 digit.\n\n' +
    'Contoh:\n*0102030405*\n*1234567890*';
}

function buildAskWilayahReply_() {
  return 'Baik. Sekarang ketik *wilayah/kecamatan*.\n\n' +
    'Contoh:\n*Praya*\n*Kopang*\n*Pujut*';
}

function buildAskKeteranganReply_() {
  return 'Baik. Sekarang tulis *keterangan singkat* aduan.\n\n' +
    'Contoh:\n*Air mati sejak tadi pagi*\n*Pipa bocor besar di depan rumah*';
}

function handleNewAduanBack_(phone, session, data) {
  data = data || {};
  var state = session && session.state ? String(session.state) : '';

  if (state === 'NEW_NAMA' || state === 'NEW_WILAYAH') {
    setWhatsAppSession_(phone, 'NEW_CABANG', data);
    return {
      success: true,
      type: 'ASK_CABANG',
      page: 1,
      reply: buildCabangMenuReply_(1)
    };
  }

  if (state === 'NEW_DESA') {
    delete data.noPelanggan;
    delete data.desa;
    setWhatsAppSession_(phone, 'NEW_NAMA', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_NAMA',
      reply: buildAskNamaPelangganReply_(data.cabang),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (state === 'NEW_JENIS') {
    delete data.noPelanggan;
    delete data.desa;
    setWhatsAppSession_(phone, 'NEW_DESA', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_NO_PELANGGAN',
      reply: buildAskNoPelangganReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (state === 'NEW_KETERANGAN') {
    delete data.jenis;
    setWhatsAppSession_(phone, 'NEW_JENIS', data);
    return {
      success: true,
      type: 'ASK_JENIS_GANGGUAN',
      reply: 'Silakan pilih jenis laporan/gangguan.',
      jenisMenu: true
    };
  }

  if (state === 'NEW_LOKASI') {
    delete data.keterangan;
    setWhatsAppSession_(phone, 'NEW_KETERANGAN', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_KETERANGAN',
      reply: buildAskKeteranganReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  setWhatsAppSession_(phone, 'NEW_CABANG', data);
  return {
    success: true,
    type: 'ASK_CABANG',
    page: 1,
    reply: buildCabangMenuReply_(1)
  };
}


function handleNewAduanFlow_(message, phone, session, payload) {
  payload = payload || {};
  var text = String(message || '').trim();
  var data = session.data || {};

  if (isNewAduanBackCommand_(text)) {
    return handleNewAduanBack_(phone, session, data);
  }

  if (shouldBlockNewAduanOutsideHours_()) {
    clearWhatsAppSession_(phone);
    return {
      success: false,
      type: 'OUTSIDE_HOURS_BLOCK_FLOW',
      reply: buildOutsideHoursBlockedReply_('Buat Aduan Baru'),
      navButtons: buildNavButtons_('outside_hours')
    };
  }

  // V10.9.12:
  // Jangan cek batas aduan aktif di setiap step input karena bikin tombol terasa lama.
  // Cek sudah dilakukan saat mulai Buat Aduan dan dicek ulang sekali lagi sebelum simpan final.


  if (session.state === 'NEW_CABANG') {
    var cabangChoice = normalizeIncomingCabangChoice_(text);

    if (cabangChoice === '__PAGE_2__') {
      setWhatsAppSession_(phone, 'NEW_CABANG', data);
      return {
        success: true,
        type: 'ASK_CABANG',
        page: 2,
        reply: buildCabangMenuReply_(2)
      };
    }

    if (cabangChoice === '__PAGE_1__') {
      setWhatsAppSession_(phone, 'NEW_CABANG', data);
      return {
        success: true,
        type: 'ASK_CABANG',
        page: 1,
        reply: buildCabangMenuReply_(1)
      };
    }

    if (!cabangChoice) {
      return {
        success: false,
        type: 'ASK_CABANG',
        page: 1,
        reply: buildCabangMenuReply_(1)
      };
    }

    data.cabang = cabangChoice;
    data.wilayah = cabangChoice.replace(/^Cabang\s+/i, '');
    setWhatsAppSession_(phone, 'NEW_NAMA', data);

    return {
      success: true,
      type: 'NEW_ADUAN_ASK_NAMA',
      reply: buildAskNamaPelangganReply_(cabangChoice),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_NAMA') {
    data.nama = text;

    // FIX V9.8:
    // Jika cabang sudah dipilih lewat List Menu, tidak perlu tanya wilayah/kecamatan lagi.
    // Langsung minta No Pelanggan.
    if (data.cabang) {
      if (!data.wilayah) data.wilayah = data.cabang.replace(/^Cabang\s+/i, '');
      setWhatsAppSession_(phone, 'NEW_DESA', data);
      return {
        success: true,
        type: 'NEW_ADUAN_ASK_NO_PELANGGAN',
        reply: buildAskNoPelangganReply_(),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    setWhatsAppSession_(phone, 'NEW_WILAYAH', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_WILAYAH',
      reply: buildAskWilayahReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_WILAYAH') {
    data.wilayah = text;
    if (!data.cabang) data.cabang = inferCabangByWilayah_(text);
    setWhatsAppSession_(phone, 'NEW_DESA', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_NO_PELANGGAN',
      reply: buildAskNoPelangganReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_DESA') {
    var noPelanggan = normalizeNoPelanggan_(text);
    if (!noPelanggan) {
      return {
        success: false,
        type: 'NEW_ADUAN_ASK_NO_PELANGGAN',
        reply: buildNoPelangganInvalidReply_(),
        navButtons: buildNewAduanControlButtons_()
      };
    }

    data.noPelanggan = noPelanggan;
    data.desa = noPelanggan; // kompatibel dengan struktur kolom lama: kolom 5
    setWhatsAppSession_(phone, 'NEW_JENIS', data);
    return {
      success: true,
      type: 'ASK_JENIS_GANGGUAN',
      reply: 'Silakan pilih jenis laporan/gangguan.',
      jenisMenu: true
    };
  }

  if (session.state === 'NEW_JENIS') {
    var jenis = normalizeJenisGangguanChoice_(text) || normalizeJenisGangguan_(text);
    if (!jenis) {
      return {
        success: false,
        type: 'ASK_JENIS_GANGGUAN',
        reply: 'Pilihan jenis laporan belum sesuai. Silakan pilih dari menu.',
        jenisMenu: true
      };
    }

    data.jenis = jenis;
    setWhatsAppSession_(phone, 'NEW_KETERANGAN', data);
    return {
      success: true,
      type: 'NEW_ADUAN_ASK_KETERANGAN',
      reply: buildAskKeteranganReply_(),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_KETERANGAN') {
    if (text.length < 3) {
      return {
        success: false,
        type: 'NEW_ADUAN_KETERANGAN_INVALID',
        reply: 'Keterangan terlalu pendek. Mohon ketik keterangan singkat gangguan.\n\nContoh:\n*Air mati sejak tadi pagi di rumah dan sekitar tetangga.*',
        navButtons: buildNewAduanControlButtons_()
      };
    }

    data.keterangan = text;
    setWhatsAppSession_(phone, 'NEW_LOKASI', data);

    return {
      success: true,
      type: 'NEW_ADUAN_ASK_LOKASI',
      reply: buildAskLocationReplyByJenis_(data.jenis),
      navButtons: buildNewAduanControlButtons_()
    };
  }

  if (session.state === 'NEW_LOKASI') {
    var loc = payload.location || null;

    // FIX V10.1:
    // Beberapa provider mengirim share location sebagai teks:
    // "Location: -8.703289985657, 116.2587341309"
    if ((!loc || !loc.latitude || !loc.longitude) && text) {
      loc = extractCoordinatesFromText_(text);
    }

    if (loc && loc.latitude && loc.longitude) {
      data.latitude = loc.latitude;
      data.longitude = loc.longitude;
      data.linkMaps = loc.mapsUrl || buildGoogleMapsUrl_(loc.latitude, loc.longitude);
      data.lokasiDetail = loc.address || loc.name || 'Share location WhatsApp';
    } else {
      if (!text) {
        return {
          success: false,
          type: 'NEW_ADUAN_LOKASI_EMPTY',
          reply: buildAskLocationReply_(),
          navButtons: buildNewAduanControlButtons_()
        };
      }

      var lower = text.toLowerCase();
      if (['lewati', 'skip', 'tidak ada', '-'].indexOf(lower) !== -1) {
        data.lokasiDetail = 'Tidak diisi pelanggan';
      } else {
        data.lokasiDetail = text;
      }
    }

    var activeLimitFinal = buildActiveLimitResult_(phone);
    if (activeLimitFinal.blocked) {
      activeLimitFinal.result.type = 'MAX_ACTIVE_ADUAN_LIMIT_FINAL';
      return activeLimitFinal.result;
    }

    var created = createAduanFromWhatsApp_(phone, data);
    clearWhatsAppSession_(phone);
    setLastCreatedAduanIdForPhone_(phone, created.id);

    return {
      success: true,
      type: 'NEW_ADUAN_CREATED',
      id: created.id,
      reply: buildNewAduanCreatedReply_(created),
      navButtons: buildCreatedTicketButtons_(created.id)
    };
  }

  setWhatsAppSession_(phone, 'MAIN', {});
  return {
    success: true,
    type: 'MAIN_MENU',
    reply: buildMainWhatsAppMenuReply_()
  };
}


function normalizeNoPelanggan_(text) {
  var raw = String(text || '').trim();
  if (!raw) return '';

  var lower = raw.toLowerCase();
  var blocked = ['belum tahu', 'tidak tahu', 'gak tahu', 'nggak tahu', 'ga tahu', 'tdk tahu', 'tidak ada', 'belum ada', '-'];
  if (blocked.indexOf(lower) !== -1) return '';

  // Hanya terima angka, spasi, dan tanda strip.
  // Contoh yang diterima: 0102030405, 01 020 304 05, 01-020-304-05.
  // Contoh yang ditolak: abc123, tidak tahu, 123.
  if (!/^[0-9\s-]+$/.test(raw)) return '';

  var digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 5 || digits.length > 20) return '';

  return digits;
}

function isNoPelangganValid_(text) {
  return !!normalizeNoPelanggan_(text);
}

function buildJenisGangguanRows_() {
  return [
    { id: 'JENIS_AIR_MATI', title: 'Air Mati', description: 'Aliran air tidak keluar' },
    { id: 'JENIS_TEKANAN_RENDAH', title: 'Tekanan Rendah', description: 'Air keluar kecil/lemah' },
    { id: 'JENIS_AIR_KERUH', title: 'Air Keruh', description: 'Air keruh/berwarna/berbau' },
    { id: 'JENIS_PIPA_BOCOR', title: 'Pipa Bocor', description: 'Kebocoran pipa/jaringan' },
    { id: 'JENIS_METER_BERMASALAH', title: 'Meter Bermasalah', description: 'Meter rusak/tidak normal' },
    { id: 'JENIS_TAGIHAN', title: 'Tagihan', description: 'Informasi/keluhan tagihan' },
    { id: 'JENIS_SAMBUNGAN_BARU', title: 'Sambungan Baru', description: 'Permohonan sambungan baru' },
    { id: 'JENIS_LAINNYA', title: 'Lainnya', description: 'Laporan lain terkait layanan' }
  ];
}

function sendKiriminJenisGangguanMenu_(phone) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk jenis gangguan menu.' };

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: 'Silakan pilih jenis laporan/gangguan.'
      },
      action: {
        button: 'Pilih Jenis',
        sections: [
          {
            title: 'Gangguan Teknis',
            rows: buildJenisGangguanRows_().slice(0, 5)
          },
          {
            title: 'Layanan Pelanggan',
            rows: buildJenisGangguanRows_().slice(5)
          }
        ]
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function normalizeJenisGangguanChoice_(text) {
  var raw = String(text || '').trim();
  var lower = raw.toLowerCase();

  var map = {
    '1': 'Air Mati',
    '2': 'Tekanan Rendah',
    '3': 'Air Keruh',
    '4': 'Pipa Bocor',
    '5': 'Meter Bermasalah',
    '6': 'Tagihan',
    '7': 'Sambungan Baru',
    '8': 'Lainnya',
    'jenis_air_mati': 'Air Mati',
    'jenis_tekanan_rendah': 'Tekanan Rendah',
    'jenis_air_keruh': 'Air Keruh',
    'jenis_pipa_bocor': 'Pipa Bocor',
    'jenis_meter_bermasalah': 'Meter Bermasalah',
    'jenis_tagihan': 'Tagihan',
    'jenis_sambungan_baru': 'Sambungan Baru',
    'jenis_lainnya': 'Lainnya'
  };

  if (map[lower]) return map[lower];

  if (lower.indexOf('air mati') !== -1) return 'Air Mati';
  if (lower.indexOf('tekanan rendah') !== -1) return 'Tekanan Rendah';
  if (lower.indexOf('air keruh') !== -1) return 'Air Keruh';
  if (lower.indexOf('pipa bocor') !== -1 || lower.indexOf('bocor') !== -1) return 'Pipa Bocor';
  if (lower.indexOf('meter') !== -1) return 'Meter Bermasalah';
  if (lower.indexOf('tagihan') !== -1) return 'Tagihan';
  if (lower.indexOf('sambungan baru') !== -1 || lower.indexOf('pasang baru') !== -1) return 'Sambungan Baru';
  if (lower.indexOf('lain') !== -1) return 'Lainnya';

  return '';
}


function buildJenisGangguanMenu_() {
  return [
    'Pilih *jenis gangguan* dengan balas angka:',
    '',
    '*1.* Air Mati',
    '*2.* Tekanan Rendah',
    '*3.* Air Keruh',
    '*4.* Pipa Bocor',
    '*5.* Meter Bermasalah',
    '*6.* Tagihan',
    '*7.* Sambungan Baru',
    '*8.* Lainnya',
    '',
    'Contoh balasan: *1*'
  ].join('\n');
}

function normalizeJenisFromWhatsApp_(text) {
  var map = {
    '1': 'Air Mati',
    '2': 'Tekanan Rendah',
    '3': 'Air Keruh',
    '4': 'Pipa Bocor',
    '5': 'Meter Bermasalah',
    '6': 'Tagihan',
    '7': 'Sambungan Baru',
    '8': 'Lainnya'
  };

  var key = String(text || '').trim();
  if (map[key]) return map[key];

  return normalizeInputJenisGangguan_(text) || 'Lainnya';
}

function createAduanFromWhatsApp_(phone, data) {
  // [V10.9.44] Lock untuk mencegah duplikat ID saat 2 webhook bersamaan
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch(lockErr) {
    throw new Error('LOCK_TIMEOUT: Sistem sedang memproses aduan lain. Coba lagi dalam beberapa detik.');
  }

  try {

  if (shouldBlockNewAduanOutsideHours_()) {
    throw new Error('CREATE_BLOCKED_OUTSIDE_HOURS: Pembuatan aduan baru tidak tersedia di luar jam kerja.');
  }

  var activeLimitInfo = getActiveAduanLimitInfo_(phone);
  if (activeLimitInfo.blocked) {
    throw new Error('CREATE_BLOCKED_ACTIVE_LIMIT: Nomor WhatsApp ini sudah memiliki ' + activeLimitInfo.count + ' aduan aktif. Maksimal ' + activeLimitInfo.max + '.');
  }


  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    setupAduanSheet(ss);
    sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  }
  ensureRuntimeHeadersFast_(sh);

  var now = new Date();
  var cabang = data.cabang || inferCabangByWilayah_(data.wilayah);
  var code = CABANG_CODE[cabang] || 'LNY';
  var id = generateCabangAduanId_(code, now, sh);
  var priorityInfo = determineWhatsAppPriority_(data.jenis || 'Lainnya', data.keterangan || '', data.wilayah || '', data.noPelanggan || data.desa || '');
  var prioritas = normalizePriorityValue_(priorityInfo.prioritas || 'Sedang');
  var statusAduan = normalizeStatusValue_('Baru');
  var kategoriLayanan = getKategoriLayananByJenis_(data.jenis || 'Lainnya');
  var unitAduan = getUnitByJenisGangguan_(data.jenis || 'Lainnya');
  var slaJam = CONFIG.SLA[prioritas] || 8;
  var catatanWa = 'Masuk dari WhatsApp pelanggan';
  if (!isWithinBusinessHours_()) catatanWa += ' | Di luar jam kerja';
  catatanWa += ' | Kategori: ' + kategoriLayanan;
  catatanWa += ' | Unit otomatis: ' + unitAduan;
  if (priorityInfo.alasan) {
    catatanWa += ' | Prioritas otomatis: ' + prioritas + ' (' + priorityInfo.alasan + ')';
  }

  var latitude = data.latitude || '';
  var longitude = data.longitude || '';
  var linkMaps = data.linkMaps || '';

  if ((!latitude || !longitude) && data.lokasiDetail) {
    var parsedLocFromDetail = extractCoordinatesFromText_(data.lokasiDetail);
    if (parsedLocFromDetail) {
      latitude = parsedLocFromDetail.latitude;
      longitude = parsedLocFromDetail.longitude;
      linkMaps = parsedLocFromDetail.mapsUrl;
      data.lokasiDetail = 'Share location WhatsApp';
    }
  }

  if (latitude && longitude && !linkMaps) {
    linkMaps = buildGoogleMapsUrl_(latitude, longitude);
  }

  sh.appendRow([
    id,
    now,
    cabang,
    data.wilayah || '',
    (data.noPelanggan || data.desa || ''),
    data.nama || '',
    normalizePhone_(phone),
    data.jenis || 'Lainnya',
    prioritas,
    statusAduan,
    unitAduan,
    data.keterangan || '',
    catatanWa,
    '',
    slaJam,
    now,
    latitude,
    longitude,
    linkMaps,
    data.lokasiDetail || ''
  ]);

  var insertedRow = sh.getLastRow();

  // Fast mode: nilai prioritas/status/unit/SLA sudah diisi saat appendRow, jadi tidak perlu baca-tulis ulang sel.
  if (!isSiagaFastMode_()) {
    enforcePriorityStatusUnitForRow_(sh, insertedRow);
  }

  var createdAduan = parseAduanRowForTracking_(sh.getRange(insertedRow, 1, 1, Math.max(sh.getLastColumn(), 20)).getValues()[0]);

  // Copy otomatis ke sheet aduan cabang terkait.
  try {
    mirrorAduanToCabangSheet_(createdAduan);
  } catch (mirrorErr) {
    logWhatsApp_(
      normalizePhone_(phone),
      'MIRROR_CABANG_ERROR',
      'CABANG_MIRROR_ERROR',
      createdAduan.id,
      '',
      'ERROR',
      mirrorErr.message
    );
  }

  // Kirim notifikasi otomatis ke petugas cabang terkait.
  try {
    createdAduan.notifikasiPetugas = notifyPetugasCabang_(createdAduan);
  } catch (notifyErr) {
    logWhatsApp_(
      normalizePhone_(phone),
      'NOTIF_PETUGAS_ERROR',
      'PETUGAS_NOTIFY_ERROR',
      createdAduan.id,
      '',
      'ERROR',
      notifyErr.message
    );
  }

  return createdAduan;

  } finally {
    lock.releaseLock();
  }
}

function buildNewAduanCreatedReply_(d) {
  return [
    '✅ *Aduan Berhasil Dibuat*',
    '',
    'ID Aduan:',
    '*' + d.id + '*',
    '',
    'Nama: ' + (d.namaPelanggan || '-'),
    'Cabang: ' + (d.cabang || '-'),
    'No Pelanggan: ' + (getNoPelangganFromAduan_(d) || '-'),
    'Jenis Laporan: ' + (d.jenisGangguan || '-'),
    'Kategori: ' + getKategoriLayananByJenis_(d.jenisGangguan || '-'),
    'Unit Tujuan: ' + (d.unit || getUnitByJenisGangguan_(d.jenisGangguan || '-')),
    'Prioritas: *' + (d.prioritas || 'Sedang') + '*',
    'Status: *' + (d.status || 'Baru') + '*',
    '',
    'Simpan ID aduan ini untuk tracking.',
    'Gunakan tombol *Cek Tiket Ini* untuk melihat progres tiket ini.'
  ].join('\n');
}



// ============================================================
// SHARE LOCATION WHATSAPP
// ============================================================

function setupLocationColumns_(sheet) {
  if (!sheet) return;

  var __fastKey = getSheetRuntimeKey_('LOCATION_SETUP_FAST_V1096', sheet);
  if (isSiagaFastMode_() && cacheGet_(__fastKey)) return;

  var headers = [
    { col: CONFIG.COL.LATITUDE || 17, name: 'Latitude', width: 100 },
    { col: CONFIG.COL.LONGITUDE || 18, name: 'Longitude', width: 100 },
    { col: CONFIG.COL.LINK_MAPS || 19, name: 'Link Maps', width: 220 },
    { col: CONFIG.COL.LOKASI_DETAIL || 20, name: 'Lokasi Detail', width: 220 }
  ];

  headers.forEach(function(h) {
    var cell = sheet.getRange(1, h.col);
    if (!cell.getValue()) {
      cell.setValue(h.name);
      cell
        .setBackground('#1e3a5f')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    }
    try { sheet.setColumnWidth(h.col, h.width); } catch(e) {}
  });
  cachePut_(__fastKey, '1', 21600);

}

function buildAskLocationReply_() {
  return [
    '📍 *Lokasi Gangguan*',
    '',
    'Mohon kirim lokasi gangguan agar petugas lebih mudah menemukan titik masalah.',
    '',
    'Bisa pilih salah satu:',
    '1. Kirim *Share Location* WhatsApp',
    '2. Atau ketik alamat/patokan lengkap',
    '',
    'Contoh:',
    '*Dusun Bogak, dekat masjid, rumah pagar biru*',
    '',
    'Kalau belum bisa kirim lokasi, ketik *lewati*.'
  ].join('\n');
}

function extractLocationFromPayload_(obj) {
  obj = obj || {};
  var data = obj.data || {};

  var candidates = [
    data.location,
    data.content && data.content.location,
    data.content,
    data.message && data.message.location,
    data.message,
    obj.location,
    obj.content && obj.content.location,
    obj.content,
    obj.message && obj.message.location,
    obj.message
  ];

  // Kalau content berupa string JSON lokasi, coba parse.
  if (typeof data.content === 'string' && data.content.charAt(0) === '{') {
    try { candidates.push(JSON.parse(data.content)); } catch(e) {}
  }
  if (typeof obj.content === 'string' && obj.content.charAt(0) === '{') {
    try { candidates.push(JSON.parse(obj.content)); } catch(e) {}
  }

  for (var i = 0; i < candidates.length; i++) {
    var loc = normalizeLocationObject_(candidates[i]);
    if (loc) return loc;
  }

  // Beberapa webhook meletakkan latitude/longitude langsung di data.
  return normalizeLocationObject_(data) || normalizeLocationObject_(obj);
}

function normalizeLocationObject_(obj) {
  if (!obj || typeof obj !== 'object') return null;

  var lat = obj.latitude || obj.lat || obj.latitute || obj.y || obj.location_latitude;
  var lng = obj.longitude || obj.lng || obj.lon || obj.long || obj.x || obj.location_longitude;

  // Format nested umum
  if ((!lat || !lng) && obj.coordinates) {
    lat = obj.coordinates.latitude || obj.coordinates.lat || lat;
    lng = obj.coordinates.longitude || obj.coordinates.lng || obj.coordinates.lon || lng;
  }

  lat = String(lat || '').replace(',', '.').trim();
  lng = String(lng || '').replace(',', '.').trim();

  if (!lat || !lng) return null;

  var latNum = Number(lat);
  var lngNum = Number(lng);

  if (isNaN(latNum) || isNaN(lngNum)) return null;
  if (Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) return null;

  var address = obj.address || obj.formatted_address || obj.description || obj.caption || '';
  var name = obj.name || obj.title || obj.location_name || '';

  return {
    latitude: latNum,
    longitude: lngNum,
    address: String(address || '').trim(),
    name: String(name || '').trim(),
    mapsUrl: buildGoogleMapsUrl_(latNum, lngNum)
  };
}

function buildGoogleMapsUrl_(lat, lng) {
  if (!lat || !lng) return '';
  return 'https://www.google.com/maps?q=' + encodeURIComponent(String(lat) + ',' + String(lng));
}



function extractCoordinatesFromText_(text) {
  text = String(text || '').trim();
  if (!text) return null;

  // Format umum:
  // Location: -8.703289985657, 116.2587341309
  // -8.703289985657,116.2587341309
  // https://www.google.com/maps?q=-8.703289985657,116.2587341309
  var match = text.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  if (!match) return null;

  var lat = Number(String(match[1]).replace(',', '.'));
  var lng = Number(String(match[2]).replace(',', '.'));

  if (isNaN(lat) || isNaN(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return {
    latitude: lat,
    longitude: lng,
    address: '',
    name: 'Share location WhatsApp',
    mapsUrl: buildGoogleMapsUrl_(lat, lng)
  };
}

function fixExistingShareLocationRows() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sh || safeGetLastRow_(sh) < 2) {
    ui.alert('Tidak ada data ADUAN yang bisa dicek.');
    return;
  }

  setupLocationColumns_(sh);

  var lastRow = safeGetLastRow_(sh);
  var lastCol = Math.max(sh.getLastColumn(), 20);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var fixed = 0;

  values.forEach(function(row, i) {
    var rowNumber = i + 2;

    var latitude = String(row[(CONFIG.COL.LATITUDE || 17) - 1] || '').trim();
    var longitude = String(row[(CONFIG.COL.LONGITUDE || 18) - 1] || '').trim();
    var linkMaps = String(row[(CONFIG.COL.LINK_MAPS || 19) - 1] || '').trim();
    var lokasiDetail = String(row[(CONFIG.COL.LOKASI_DETAIL || 20) - 1] || '').trim();

    if (latitude && longitude && linkMaps) return;

    var loc = null;

    // Cek Lokasi Detail dulu
    if (lokasiDetail) loc = extractCoordinatesFromText_(lokasiDetail);

    // Kalau provider menaruh lokasi di Catatan karena data lama geser/overflow
    if (!loc) {
      var catatan = String(row[(CONFIG.COL.CATATAN || 13) - 1] || '').trim();
      loc = extractCoordinatesFromText_(catatan);
    }

    // Scan semua sel di baris untuk jaga-jaga.
    if (!loc) {
      for (var c = 0; c < row.length; c++) {
        loc = extractCoordinatesFromText_(row[c]);
        if (loc) break;
      }
    }

    if (!loc) return;

    safeSetCellValue_(sh, rowNumber, CONFIG.COL.LATITUDE || 17, loc.latitude);
    safeSetCellValue_(sh, rowNumber, CONFIG.COL.LONGITUDE || 18, loc.longitude);
    safeSetCellValue_(sh, rowNumber, CONFIG.COL.LINK_MAPS || 19, loc.mapsUrl);

    if (!lokasiDetail || lokasiDetail.indexOf('Location:') !== -1) {
      safeSetCellValue_(sh, rowNumber, CONFIG.COL.LOKASI_DETAIL || 20, 'Share location WhatsApp');
    }

    fixed++;
  });

  ui.alert(
    fixed > 0 ? '✅ Lokasi berhasil diperbaiki' : 'ℹ️ Tidak ada baris yang perlu diperbaiki',
    'Jumlah baris diperbaiki: ' + fixed,
    ui.ButtonSet.OK
  );
}



function testNormalizeListMenuChoice() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Tes Baca Pilihan List Menu',
    'Tempel teks dari pilihan WhatsApp. Contoh: Buat Aduan Baru Laporkan gangguan air',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var text = prompt.getResponseText();
  var mapped = normalizeIncomingListMenuChoice_(text);

  ui.alert(
    mapped ? '✅ Terbaca sebagai menu ' + mapped : '⚠️ Belum terbaca',
    'Input:\\n' + text + '\\n\\nHasil mapping: ' + (mapped || '-'),
    ui.ButtonSet.OK
  );
}


function testParseShareLocationPayload() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Tes Payload Share Location',
    'Tempel contoh raw JSON webhook lokasi dari LOG_WHATSAPP.',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var raw = prompt.getResponseText();
  var parsed = parseIncomingPayload_(raw, {});
  ui.alert(
    parsed.location ? '✅ Lokasi terbaca' : '⚠️ Lokasi belum terbaca',
    JSON.stringify(parsed, null, 2),
    ui.ButtonSet.OK
  );
}



// ============================================================
// FIX PRIORITAS / STATUS / UNIT OTOMATIS
// ============================================================


// ============================================================
// SAFE SHEETS OPERATION UNTUK GOOGLE SHEETS TABLE / TYPED COLUMNS
// ============================================================

function isTypedColumnError_(err) {
  var msg = String((err && err.message) || err || '').toLowerCase();
  return msg.indexOf('kolom dengan jenis') !== -1 ||
         msg.indexOf('typed column') !== -1 ||
         msg.indexOf('cells in typed columns') !== -1 ||
         msg.indexOf('column with type') !== -1;
}

function safeGetLastRow_(sheet) {
  if (!sheet) return 0;

  try {
    return sheet.getLastRow();
  } catch (err) {
    // Fallback untuk sheet yang memakai Google Sheets Table/typed columns.
    try {
      var maxRows = Math.min(sheet.getMaxRows(), 5000);
      var maxCols = Math.min(sheet.getMaxColumns(), 20);
      var values = sheet.getRange(1, 1, maxRows, maxCols).getDisplayValues();

      for (var r = values.length - 1; r >= 0; r--) {
        if (values[r].join('').trim() !== '') return r + 1;
      }

      return 0;
    } catch (innerErr) {
      return 0;
    }
  }
}

function safeSetCellValue_(sheet, row, col, value) {
  try {
    sheet.getRange(row, col).setValue(value);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: String((err && err.message) || err || ''),
      typedColumn: isTypedColumnError_(err)
    };
  }
}

function safeGetCellValue_(sheet, row, col) {
  try {
    return sheet.getRange(row, col).getValue();
  } catch (err) {
    return '';
  }
}

function alertTypedTableIfNeeded_(errors) {
  errors = errors || [];
  var typed = errors.some(function(e) { return e && e.typedColumn; });

  if (!typed) return '';

  return '\\n\\nCatatan: Sheet masih memakai Google Sheets Table/typed columns. Jika masih gagal, klik nama Table di kiri atas lalu pilih Revert to unformatted data / ubah ke range biasa.';
}


function normalizePriorityValue_(value) {
  value = String(value || '').trim().toLowerCase();

  if (value === 'darurat') return 'Darurat';
  if (value === 'tinggi') return 'Tinggi';
  if (value === 'sedang') return 'Sedang';
  if (value === 'rendah') return 'Rendah';

  return 'Sedang';
}

function normalizeStatusValue_(value) {
  value = String(value || '').trim().toLowerCase();

  if (value === 'baru') return 'Baru';
  if (value === 'proses') return 'Proses';
  if (value === 'selesai') return 'Selesai';
  if (value === 'ditunda') return 'Ditunda';
  if (value === 'batal') return 'Batal';

  return 'Baru';
}

function enforcePriorityStatusUnitForRow_(sheet, rowNumber) {
  if (!sheet || rowNumber < 2) return { success: true, errors: [] };

  var errors = [];

  var jenis = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.JENIS_GANGGUAN) || '').trim();
  var prioritas = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.PRIORITAS) || '').trim();
  var status = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.STATUS) || '').trim();
  var unit = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.UNIT) || '').trim();
  var wilayah = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.WILAYAH) || '').trim();
  var desa = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.DESA) || '').trim();
  var keterangan = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.KETERANGAN) || '').trim();

  if (!prioritas) {
    var p = determineWhatsAppPriority_(jenis || 'Lainnya', keterangan, wilayah, desa);
    prioritas = normalizePriorityValue_(p.prioritas || 'Sedang');

    var resP = safeSetCellValue_(sheet, rowNumber, CONFIG.COL.PRIORITAS, prioritas);
    if (!resP.success) errors.push(resP);

    var catatan = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.CATATAN) || '').trim();
    if (p.alasan && catatan.indexOf('Prioritas otomatis') === -1) {
      var resC = safeSetCellValue_(
        sheet,
        rowNumber,
        CONFIG.COL.CATATAN,
        (catatan ? catatan + ' | ' : '') + 'Prioritas otomatis: ' + prioritas + ' (' + p.alasan + ')'
      );
      if (!resC.success) errors.push(resC);
    }
  }

  if (!status) {
    var resS = safeSetCellValue_(sheet, rowNumber, CONFIG.COL.STATUS, 'Baru');
    if (!resS.success) errors.push(resS);
  }

  if (!unit) {
    var autoUnit = getUnitByJenisGangguan_(jenis || 'Lainnya');
    var resU = safeSetCellValue_(sheet, rowNumber, CONFIG.COL.UNIT, autoUnit);
    if (!resU.success) errors.push(resU);
  }

  var sla = safeGetCellValue_(sheet, rowNumber, CONFIG.COL.SLA_JAM);
  if (!sla) {
    var finalPriority = String(safeGetCellValue_(sheet, rowNumber, CONFIG.COL.PRIORITAS) || prioritas || 'Sedang').trim();
    var resSla = safeSetCellValue_(sheet, rowNumber, CONFIG.COL.SLA_JAM, CONFIG.SLA[finalPriority] || 8);
    if (!resSla.success) errors.push(resSla);
  }

  return {
    success: errors.length === 0,
    errors: errors
  };
}


function fixExistingPriorityStatusUnitRows() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!main || safeGetLastRow_(main) < 2) {
    ui.alert('Tidak ada data ADUAN yang bisa diperbaiki.');
    return;
  }

  var resultMain = fixPriorityStatusUnitInSheet_(main);

  var totalCabang = { checked: 0, fixed: 0, errors: [] };
  ss.getSheets().forEach(function(sh) {
    if (String(sh.getName()).indexOf('CABANG_') === 0) {
      var r = fixPriorityStatusUnitInSheet_(sh);
      totalCabang.checked += r.checked;
      totalCabang.fixed += r.fixed;
      totalCabang.errors = totalCabang.errors.concat(r.errors || []);
    }
  });

  var allErrors = (resultMain.errors || []).concat(totalCabang.errors || []);

  ui.alert(
    allErrors.length ? '⚠️ Perbaikan selesai dengan catatan' : '✅ Perbaikan selesai',
    'ADUAN utama dicek: ' + resultMain.checked + ' baris\\n' +
    'ADUAN utama diperbaiki: ' + resultMain.fixed + ' baris\\n' +
    'Sheet cabang dicek: ' + totalCabang.checked + ' baris\\n' +
    'Sheet cabang diperbaiki: ' + totalCabang.fixed + ' baris\\n' +
    'Error dilewati: ' + allErrors.length +
    alertTypedTableIfNeeded_(allErrors),
    ui.ButtonSet.OK
  );
}

function fixPriorityStatusUnitInSheet_(sheet) {
  if (!sheet || safeGetLastRow_(sheet) < 2) return { checked: 0, fixed: 0, errors: [] };

  var checked = 0;
  var fixed = 0;
  var errors = [];
  var lastRow = safeGetLastRow_(sheet);

  for (var r = 2; r <= lastRow; r++) {
    var id = String(safeGetCellValue_(sheet, r, CONFIG.COL.ID) || '').trim();
    var jenis = String(safeGetCellValue_(sheet, r, CONFIG.COL.JENIS_GANGGUAN) || '').trim();

    if (!id && !jenis) continue;

    var beforeP = String(safeGetCellValue_(sheet, r, CONFIG.COL.PRIORITAS) || '').trim();
    var beforeS = String(safeGetCellValue_(sheet, r, CONFIG.COL.STATUS) || '').trim();
    var beforeU = String(safeGetCellValue_(sheet, r, CONFIG.COL.UNIT) || '').trim();

    var result = enforcePriorityStatusUnitForRow_(sheet, r);
    checked++;

    var afterP = String(safeGetCellValue_(sheet, r, CONFIG.COL.PRIORITAS) || '').trim();
    var afterS = String(safeGetCellValue_(sheet, r, CONFIG.COL.STATUS) || '').trim();
    var afterU = String(safeGetCellValue_(sheet, r, CONFIG.COL.UNIT) || '').trim();

    if ((!beforeP && afterP) || (!beforeS && afterS) || (!beforeU && afterU)) fixed++;
    if (result && result.errors && result.errors.length) errors = errors.concat(result.errors);
  }

  return {
    checked: checked,
    fixed: fixed,
    errors: errors
  };
}


function onEdit(e) {
  // V10.9.38:
  // 1. INPUT_ cabang tetap bisa isi tanggal otomatis.
  // 2. ADUAN utama tetap auto-fill Prioritas/Status/Unit.
  // 3. CABANG_ mirror sekarang punya dropdown dan perubahan Status/Unit/Catatan disinkronkan ke ADUAN.
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (!sh) return;

    var name = sh.getName();

    // Sheet input cabang: isi Tanggal Input otomatis saat Nama Pelanggan diketik.
    if (isCabangInputSheet_(name)) {
      handleInputCabangEdit_(e);
      return;
    }

    var isMainAduan = name === CONFIG.SHEET_NAME;
    var isCabangMirror = isCabangMirrorSheetName_(name);
    if (!isMainAduan && !isCabangMirror) return;

    var row = e.range.getRow();
    var col = e.range.getColumn();
    if (row < 2) return;

    // Pastikan dropdown tetap ada dan Cabang/Wilayah otomatis mengikuti sheet cabang.
    if (isCabangMirror) {
      try { applyCabangMirrorDropdowns_(sh); } catch(dropErr) {}
      try { autoFillCabangWilayahForMirrorRow_(sh, row); } catch(autoFillErr) {}
    }

    if (
      col === CONFIG.COL.JENIS_GANGGUAN ||
      col === CONFIG.COL.KETERANGAN ||
      col === CONFIG.COL.PRIORITAS ||
      col === CONFIG.COL.STATUS ||
      col === CONFIG.COL.UNIT ||
      col === CONFIG.COL.CATATAN
    ) {
      enforcePriorityStatusUnitForRow_(sh, row);
    }

    // Jika edit terjadi di ADUAN, update/cerminkan ulang ke sheet CABANG_*.
    if (isMainAduan) {
      syncAduanEditToCabangMirror_(e);
    }

    // Jika edit terjadi di CABANG_*, update balik ke ADUAN pusat.
    if (isCabangMirror) {
      syncCabangMirrorEditToAduan_(e);
    }
  } catch (err) {
    // Jangan tampilkan error ke user saat edit sheet.
  }
}


// ============================================================
// KATEGORI LAYANAN - TEKNIS VS PELANGGAN
// ============================================================

function getKategoriLayananByJenis_(jenis) {
  jenis = String(jenis || '').toLowerCase();

  if (
    jenis.indexOf('tagihan') !== -1 ||
    jenis.indexOf('sambungan baru') !== -1 ||
    jenis.indexOf('pasang baru') !== -1
  ) {
    return 'Layanan Pelanggan';
  }

  return 'Gangguan Teknis';
}

function getUnitByJenisGangguan_(jenis) {
  jenis = String(jenis || '').toLowerCase();

  if (
    jenis.indexOf('tagihan') !== -1 ||
    jenis.indexOf('sambungan baru') !== -1 ||
    jenis.indexOf('pasang baru') !== -1 ||
    jenis.indexOf('meter') !== -1
  ) {
    return 'Hublang';
  }

  if (
    jenis.indexOf('air mati') !== -1 ||
    jenis.indexOf('tekanan rendah') !== -1 ||
    jenis.indexOf('pipa bocor') !== -1 ||
    jenis.indexOf('air keruh') !== -1
  ) {
    return 'Teknik';
  }

  return 'Cabang';
}

function isLayananPelanggan_(jenis) {
  return getKategoriLayananByJenis_(jenis) === 'Layanan Pelanggan';
}

function buildAskKeteranganReplyByJenis_(jenis) {
  var kategori = getKategoriLayananByJenis_(jenis);

  if (kategori === 'Layanan Pelanggan') {
    if (String(jenis || '').toLowerCase().indexOf('tagihan') !== -1) {
      return [
        'Ketik *keterangan tagihan* yang ingin ditanyakan.',
        '',
        'Contoh:',
        '*Tagihan bulan ini naik, mohon dicek.*',
        '*Saya mau cek tagihan atas nama pelanggan ini.*'
      ].join('\n');
    }

    if (String(jenis || '').toLowerCase().indexOf('sambungan') !== -1) {
      return [
        'Ketik *keterangan kebutuhan sambungan baru*.',
        '',
        'Contoh:',
        '*Ingin pasang sambungan baru di rumah, mohon info syarat dan prosesnya.*'
      ].join('\n');
    }
  }

  return [
    'Ketik *keterangan singkat* gangguan.',
    '',
    'Contoh:',
    '*Air mati sejak tadi pagi*',
    '*Pipa bocor besar di pinggir jalan*',
    '*Air keruh dan berbau*'
  ].join('\n');
}

function buildAskLocationReplyByJenis_(jenis) {
  var kategori = getKategoriLayananByJenis_(jenis);

  if (kategori === 'Layanan Pelanggan') {
    return [
      '📍 *Alamat / Lokasi Pelanggan*',
      '',
      'Mohon ketik alamat atau patokan lokasi pelanggan.',
      '',
      'Untuk layanan pelanggan, share location tidak wajib, tapi alamat/patokan tetap membantu admin.',
      '',
      'Contoh:',
      '*Dusun Bogak, dekat masjid, rumah pagar biru*',
      '',
      'Kalau belum ada lokasi, ketik *lewati*.'
    ].join('\n');
  }

  return buildAskLocationReply_();
}


function determineWhatsAppPriority_(jenis, keterangan, wilayah, desa) {
  jenis = String(jenis || '').toLowerCase();
  var text = [
    jenis,
    keterangan || '',
    wilayah || '',
    desa || ''
  ].join(' ').toLowerCase();

  // Layanan pelanggan tidak masuk kategori darurat teknis.
  if (jenis.indexOf('tagihan') !== -1) {
    return {
      prioritas: 'Rendah',
      alasan: 'layanan pelanggan - tagihan'
    };
  }

  if (jenis.indexOf('sambungan baru') !== -1 || jenis.indexOf('pasang baru') !== -1) {
    return {
      prioritas: 'Rendah',
      alasan: 'layanan pelanggan - sambungan baru'
    };
  }

  // Kata kunci kondisi bahaya / berdampak besar.
  var emergencyKeywords = [
    'bahaya', 'darurat', 'listrik', 'tiang listrik', 'setrum',
    'banjir', 'tergenang', 'jalan tergenang', 'longsor',
    'pipa pecah', 'pecah besar', 'bocor besar', 'bocor deras',
    'semburan', 'sembur', 'jalan raya', 'mengganggu jalan',
    'rumah sakit', 'rs ', 'puskesmas', 'sekolah',
    'kantor pelayanan', 'pemadam', 'kebakaran'
  ];

  var highKeywords = [
    'air mati total', 'mati total', 'tidak mengalir',
    'satu dusun', 'satu desa', 'banyak rumah', 'banyak pelanggan',
    'semua rumah', 'seharian', 'dari kemarin', '2 hari', 'dua hari',
    'lebih dari sehari', 'total', 'parah'
  ];

  var lowKeywords = [
    'tagihan', 'rekening', 'bayar', 'pembayaran',
    'sambungan baru', 'pasang baru', 'informasi',
    'tanya', 'bertanya'
  ];

  if (containsAny_(text, emergencyKeywords)) {
    return {
      prioritas: 'Darurat',
      alasan: 'indikasi bahaya/dampak besar'
    };
  }

  if (jenis.indexOf('pipa bocor') !== -1) {
    if (containsAny_(text, ['deras', 'besar', 'jalan', 'tergenang', 'bahaya', 'pecah'])) {
      return {
        prioritas: 'Darurat',
        alasan: 'pipa bocor berisiko/dampak besar'
      };
    }
    return {
      prioritas: 'Tinggi',
      alasan: 'pipa bocor perlu penanganan cepat'
    };
  }

  if (jenis.indexOf('air mati') !== -1) {
    if (containsAny_(text, highKeywords)) {
      return {
        prioritas: 'Tinggi',
        alasan: 'air mati berdampak luas/lama'
      };
    }
    return {
      prioritas: 'Tinggi',
      alasan: 'air mati'
    };
  }

  if (jenis.indexOf('tekanan rendah') !== -1) {
    if (containsAny_(text, ['total', 'seharian', 'banyak', 'satu dusun', 'satu desa'])) {
      return {
        prioritas: 'Tinggi',
        alasan: 'tekanan rendah berdampak luas/lama'
      };
    }
    return {
      prioritas: 'Sedang',
      alasan: 'tekanan rendah'
    };
  }

  if (jenis.indexOf('air keruh') !== -1) {
    if (containsAny_(text, ['bau', 'hitam', 'berminyak', 'tidak layak', 'sakit', 'gatal'])) {
      return {
        prioritas: 'Tinggi',
        alasan: 'indikasi kualitas air serius'
      };
    }
    return {
      prioritas: 'Sedang',
      alasan: 'air keruh'
    };
  }

  if (jenis.indexOf('meter') !== -1) {
    return {
      prioritas: 'Sedang',
      alasan: 'meter bermasalah'
    };
  }

  if (containsAny_(text, lowKeywords)) {
    return {
      prioritas: 'Rendah',
      alasan: 'layanan administrasi/informasi'
    };
  }

  return {
    prioritas: 'Sedang',
    alasan: 'default aduan WhatsApp'
  };
}

function containsAny_(text, keywords) {
  text = String(text || '').toLowerCase();
  keywords = keywords || [];
  for (var i = 0; i < keywords.length; i++) {
    if (text.indexOf(String(keywords[i]).toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
}

function inferCabangByWilayah_(wilayah) {
  var w = String(wilayah || '').toLowerCase();

  if (w.indexOf('praya barat daya') !== -1) return 'Cabang Praya Barat Daya';
  if (w.indexOf('praya barat') !== -1) return 'Cabang Praya Barat';
  if (w.indexOf('praya timur') !== -1) return 'Cabang Praya Timur';
  if (w.indexOf('praya tengah') !== -1) return 'Cabang Praya Tengah';
  if (w.indexOf('praya') !== -1) return 'Cabang Praya';
  if (w.indexOf('pujut') !== -1) return 'Cabang Pujut';
  if (w.indexOf('jonggat') !== -1) return 'Cabang Jonggat';
  if (w.indexOf('kopang') !== -1) return 'Cabang Kopang';
  if (w.indexOf('janapria') !== -1) return 'Cabang Janapria';
  if (w.indexOf('batukliang utara') !== -1) return 'Cabang Batukliang Utara';
  if (w.indexOf('batukliang') !== -1) return 'Cabang Batukliang';
  if (w.indexOf('pringgarata') !== -1) return 'Cabang Pringgarata';

  return 'Cabang Lainnya';
}

function buildContactAdminReply_() {
  return [
    'Baik, Anda memilih *Hubungi Admin/Petugas*.',
    '',
    'Silakan tulis pesan atau keluhan Anda di chat ini. Admin/petugas akan menindaklanjuti pada jam layanan.',
    '',
    'Agar lebih mudah diproses, sertakan:',
    '• Nama pelanggan',
    '• Lokasi/desa/dusun',
    '• Nomor sambungan atau ID pelanggan jika ada',
    '• Keluhan singkat',
    '',
    'Ketik *menu* kapan saja untuk kembali ke layanan otomatis SIAGA TIARA.'
  ].join('\n');
}


// ============================================================
// V10.9.8 - BATAS ADUAN AKTIF PER NOMOR HP
// ============================================================

function isActiveAduanStatus_(status) {
  status = String(status || '').trim().toLowerCase();

  // Status final tidak dihitung aktif.
  if (status === 'selesai') return false;
  if (status === 'batal') return false;

  // Baru, Proses, Ditunda, Menunggu Validasi, dan status lain dianggap masih aktif.
  return true;
}

function getMaxActiveAduanPerPhone_() {
  var value = Number(getRuntimeProp_('MAX_ACTIVE_ADUAN_PER_PHONE') || CONFIG.MAX_ACTIVE_ADUAN_PER_PHONE || 2);
  return value > 0 ? value : 2;
}

function getActiveAduansByPhone_(phone, limit) {
  phone = normalizePhone_(phone || '');
  if (!phone) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];

  var lastRow = sh.getLastRow();

  // V10.9.12:
  // Untuk cek batas aduan aktif, tidak perlu baca semua 20 kolom.
  // Kolom yang dibutuhkan hanya sampai STATUS (kolom 10): ID, waktu, no HP, jenis, status.
  var lastCol = Math.max(CONFIG.COL.STATUS || 10, CONFIG.COL.NO_HP || 7, CONFIG.COL.JENIS_GANGGUAN || 8, CONFIG.COL.WAKTU_MASUK || 2);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var list = [];
  var maxList = Number(limit || 20);

  // Scan dari baris terbaru ke lama. Biasanya aduan aktif ada di data terbaru.
  for (var i = values.length - 1; i >= 0; i--) {
    var d = parseAduanRowForTracking_(values[i]);
    if (!d || normalizePhone_(d.noHp) !== phone) continue;
    if (!isActiveAduanStatus_(d.status)) continue;

    list.push(d);
    if (list.length >= maxList) break;
  }

  return list;
}

function getActiveAduanLimitInfo_(phone) {
  var maxActive = getMaxActiveAduanPerPhone_();
  var activeList = getActiveAduansByPhone_(phone, maxActive + 5);

  return {
    max: maxActive,
    count: activeList.length,
    blocked: activeList.length >= maxActive,
    list: activeList
  };
}

function buildMaxActiveAduanReply_(limitInfo) {
  limitInfo = limitInfo || {};
  var maxActive = limitInfo.max || getMaxActiveAduanPerPhone_();
  var list = limitInfo.list || [];

  var lines = [
    'Nomor WhatsApp ini masih memiliki *' + list.length + ' aduan aktif*.',
    '',
    'Untuk menghindari duplikasi laporan, pengajuan aduan baru sementara dibatasi maksimal *' + maxActive + ' aduan aktif* per nomor WhatsApp.',
    '',
    'Aduan aktif saat ini:'
  ];

  if (list.length) {
    list.slice(0, maxActive).forEach(function(d, idx) {
      lines.push(
        (idx + 1) + '. *' + (d.id || '-') + '* - ' + (d.status || '-') + ' - ' + (d.jenisGangguan || '-')
      );
    });
  } else {
    lines.push('-');
  }

  lines.push('');
  lines.push('Silakan pilih *Riwayat Aduan* atau *Cek Status* untuk melihat progres aduan yang sudah ada.');
  lines.push('');
  lines.push('Aduan baru dapat dibuat kembali setelah salah satu aduan selesai atau dibatalkan.');

  return lines.join('\n');
}

function buildActiveLimitResult_(phone) {
  var info = getActiveAduanLimitInfo_(phone);

  if (!info.blocked) {
    return {
      blocked: false,
      info: info
    };
  }

  clearWhatsAppSession_(phone);

  return {
    blocked: true,
    result: {
      success: false,
      type: 'MAX_ACTIVE_ADUAN_LIMIT',
      reply: buildMaxActiveAduanReply_(info),
      navButtons: buildNavButtons_('active_limit')
    },
    info: info
  };
}

function setMaxActiveAduanPerPhone() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Batas Aduan Aktif per Nomor WA',
    'Masukkan jumlah maksimal aduan aktif per nomor WhatsApp.\n\nDefault dan rekomendasi saat ini: 2',
    ui.ButtonSet.OK_CANCEL
  );

  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var value = Number(prompt.getResponseText());
  if (!value || value < 1) {
    ui.alert('Nilai tidak valid. Minimal 1.');
    return;
  }

  PropertiesService.getScriptProperties().setProperty('MAX_ACTIVE_ADUAN_PER_PHONE', String(value));

  ui.alert(
    '✅ Batas disimpan',
    'Maksimal aduan aktif per nomor WhatsApp sekarang: ' + value,
    ui.ButtonSet.OK
  );
}

function cekAduanAktifByPhone() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Cek Aduan Aktif Nomor WA',
    'Masukkan nomor HP/WA pelanggan. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );

  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var phone = normalizePhone_(prompt.getResponseText());
  var info = getActiveAduanLimitInfo_(phone);

  ui.alert(
    info.blocked ? '⚠️ Nomor mencapai batas aduan aktif' : '✅ Nomor masih bisa membuat aduan',
    'No WA: ' + phone + '\n' +
    'Aduan aktif: ' + info.count + '\n' +
    'Batas maksimal: ' + info.max + '\n\n' +
    info.list.map(function(d, idx) {
      return (idx + 1) + '. ' + d.id + ' - ' + d.status + ' - ' + d.jenisGangguan;
    }).join('\n'),
    ui.ButtonSet.OK
  );
}


function findAduansByPhone_(phone, limit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 20)).getValues();
  var target = normalizePhone_(phone);
  var list = [];

  for (var i = 0; i < values.length; i++) {
    var d = parseAduanRowForTracking_(values[i]);
    if (!d || normalizePhone_(d.noHp) !== target) continue;
    list.push(d);
  }

  list.sort(function(a, b) {
    var aOpen = a.status !== 'Selesai' && a.status !== 'Batal';
    var bOpen = b.status !== 'Selesai' && b.status !== 'Batal';
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return (b.waktuMasukDate || 0) - (a.waktuMasukDate || 0);
  });

  return list.slice(0, limit || 10);
}


// ============================================================
// V10.9.7 - SESSION TIMEOUT
// ============================================================

function getWhatsAppSessionTimeoutMinutes_(state) {
  state = String(state || '').trim().toUpperCase();

  // State awal / ringan.
  if (state === 'MAIN' || state === 'AWAIT_ID' || state === 'PICK_ADUAN') {
    return Number(CONFIG.SESSION_TIMEOUT_MAIN_MINUTES || 15);
  }

  // State input aduan. Lebih lama karena pelanggan bisa cari No Pelanggan / lokasi dulu.
  if (state.indexOf('NEW_') === 0) {
    return Number(CONFIG.SESSION_TIMEOUT_INPUT_MINUTES || 30);
  }

  // Mode admin/manual dibuat lebih longgar.
  if (state === 'ADMIN_HANDOFF') {
    return 60;
  }

  return Number(CONFIG.SESSION_TIMEOUT_MAIN_MINUTES || 15);
}

function isWhatsAppSessionExpired_(state, updatedAt) {
  if (!updatedAt) return false;
  var d = toSafeDate_(updatedAt) || new Date(updatedAt);
  if (!d || isNaN(d.getTime())) return false;

  var timeoutMinutes = getWhatsAppSessionTimeoutMinutes_(state);
  var diffMinutes = (new Date().getTime() - d.getTime()) / 60000;
  return diffMinutes > timeoutMinutes;
}

function buildExpiredSessionReply_(state) {
  state = String(state || '').toUpperCase();

  if (state.indexOf('NEW_') === 0) {
    return [
      'Sesi pengisian aduan sudah berakhir karena tidak ada aktivitas selama 30 menit.',
      '',
      'Silakan mulai ulang dari menu utama jika ingin membuat aduan baru.'
    ].join('\n');
  }

  return [
    'Sesi sebelumnya sudah berakhir karena tidak ada aktivitas selama 15 menit.',
    '',
    'Silakan pilih menu yang tersedia.'
  ].join('\n');
}


// ============================================================
// SESSION MANAGEMENT V10.9.11 - FAST CACHE
// CacheService (RAM Google) sebagai primary, Spreadsheet sebagai backup.
// NEW_* state: TTL 30 menit | State lain: TTL 15 menit
// ============================================================
var WA_SESSION_PREFIX_ = 'SIAGA_WA_';

function getWhatsAppSession_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;

  // 1. Coba dari Cache dulu (cepat ~20ms)
  try {
    var cached = CacheService.getScriptCache().get(WA_SESSION_PREFIX_ + phone);
    if (cached) {
      var parsed = parseJsonSafe_(cached);
      if (parsed && parsed.state) {
        return { phone: phone, state: parsed.state, data: parsed.data || {} };
      }
    }
  } catch(e) {}

  // 2. Fallback ke Spreadsheet
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupWhatsAppSessionSheet(ss);
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;

    var values = sh.getRange(2, 1, lastRow - 1, 5).getValues();
    for (var i = 0; i < values.length; i++) {
      if (normalizePhone_(values[i][0]) !== phone) continue;
      var state = String(values[i][1] || '');
      var updatedAt = values[i][3] ? new Date(values[i][3]) : null;

      if (isWhatsAppSessionExpired_(state, updatedAt)) {
        clearWhatsAppSession_(phone);
        return null;
      }

      var session = { row: i + 2, phone: phone, state: state, data: parseJsonSafe_(values[i][2]) };

      // Repopulate cache dari Spreadsheet
      try {
        var ttl = state.indexOf('NEW_') === 0 ? 1800 : 900;
        CacheService.getScriptCache().put(WA_SESSION_PREFIX_ + phone, JSON.stringify({ state: state, data: session.data }), ttl);
      } catch(e) {}

      return session;
    }
  } catch(e) {}

  return null;
}

function setWhatsAppSession_(phone, state, data) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;
  var ttl = String(state || '').indexOf('NEW_') === 0 ? 1800 : 900;
  var payload = JSON.stringify({ state: state || '', data: data || {} });

  // 1. Cache dulu (cepat)
  try {
    CacheService.getScriptCache().put(WA_SESSION_PREFIX_ + phone, payload, ttl);
  } catch(e) {}

  // 2. Backup ke Spreadsheet
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupWhatsAppSessionSheet(ss);
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
    var row = getWhatsAppSessionRow_(sh, phone);
    if (row < 2) row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 5).setValues([[phone, state || '', JSON.stringify(data || {}), new Date(), '']]);
  } catch(e) {}
}

function clearWhatsAppSession_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return;

  // 1. Hapus dari Cache
  try { CacheService.getScriptCache().remove(WA_SESSION_PREFIX_ + phone); } catch(e) {}

  // 2. Hapus dari Spreadsheet
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupWhatsAppSessionSheet(ss);
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_SESSION_SHEET);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    var values = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      if (normalizePhone_(values[i][0]) === phone) sh.deleteRow(i + 2);
    }
  } catch(e) {}
}

// Helper: cari row session di sheet tanpa rekursif
function getWhatsAppSessionRow_(sh, phone) {
  try {
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return -1;
    var vals = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (normalizePhone_(vals[i][0]) === phone) return i + 2;
    }
  } catch(e) {}
  return -1;
}

function parseJsonSafe_(value) {
  try {
    return value ? JSON.parse(String(value)) : {};
  } catch (e) {
    return {};
  }
}

function testWhatsAppMenuReply() {
  var ui = SpreadsheetApp.getUi();
  var phonePrompt = ui.prompt('Tes Menu WhatsApp', 'Masukkan nomor HP pelanggan untuk simulasi:', ui.ButtonSet.OK_CANCEL);
  if (phonePrompt.getSelectedButton() !== ui.Button.OK) return;

  var messagePrompt = ui.prompt(
    'Tes Menu WhatsApp',
    'Masukkan pesan masuk.\nContoh: halo, 1, 2, 3, status PRY-20260503-0001',
    ui.ButtonSet.OK_CANCEL
  );
  if (messagePrompt.getSelectedButton() !== ui.Button.OK) return;

  var result = getWhatsAppMenuResponse_(messagePrompt.getResponseText(), phonePrompt.getResponseText());

  ui.alert('Balasan Bot', result.reply, ui.ButtonSet.OK);
}


// ============================================================
// WHATSAPP TRACKING - CEK PROGRES ADUAN VIA CHAT
// ============================================================
// Fungsi utama:
// 1. Pelanggan kirim chat berisi ID aduan, contoh: PRY-20260503-0001
// 2. Webhook WhatsApp memanggil doPost(e)
// 3. Sistem mencari ID / nomor HP di sheet ADUAN
// 4. Sistem membalas status pengerjaan seperti resi JNE
//
// Catatan:
// Setiap provider WhatsApp punya format webhook dan endpoint berbeda.
// Modul ini dibuat fleksibel untuk format umum: message/text/body, from/sender/phone.
// Untuk kirim pesan, default payload: { phone: nomor, message: isiPesan }
// Jika provider kamu beda field, ubah properti WHATSAPP_PHONE_FIELD dan WHATSAPP_MESSAGE_FIELD.
// ============================================================

function doPost(e) {
  try {
    var result = handleWhatsAppWebhook_(e);
    return jsonOutput_(result);
  } catch (err) {
    logWhatsApp_('-', '-', 'DOPOST_ERROR', err.message || String(err), 'ERROR');
    return jsonOutput_({ success: false, error: err.message || String(err) });
  }
}

function setupWhatsAppTracking() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppLogSheet(ss);
  setupWhatsAppSessionSheet(ss);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WHATSAPP_REPLY_MODE')) props.setProperty('WHATSAPP_REPLY_MODE', CONFIG.WHATSAPP_DEFAULT_REPLY_MODE || 'AUTO');

  SpreadsheetApp.getUi().alert(
    '✅ WhatsApp Tracking siap',
    'Modul WhatsApp Tracking sudah ditambahkan.\n\n' +
    'Webhook URL yang dipakai adalah URL Web App /exec dari SIAGA TIARA.\n\n' +
    'Format chat pelanggan:\n' +
    '- halo / menu untuk pilihan layanan\n' +
    '- 1 untuk buat aduan baru\n' +
    '- 2 untuk cek status aduan\n' +
    '- 3 untuk lihat daftar aduan\n' +
    '- atau langsung ketik ID aduan: PRY-20260503-0001',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}



// ============================================================
// PILIH CABANG VIA WHATSAPP LIST MENU + MIRROR SHEET CABANG
// ============================================================

function getCabangMenuRows_(page) {
  page = Number(page || 1);

  if (page === 2) {
    return [
      { id: 'CABANG_KPG', title: 'Cabang Kopang', description: 'Wilayah layanan Kopang' },
      { id: 'CABANG_JNP', title: 'Cabang Janapria', description: 'Wilayah layanan Janapria' },
      { id: 'CABANG_PGR', title: 'Cabang Pringgarata', description: 'Wilayah layanan Pringgarata' },
      { id: 'CABANG_PAGE_1', title: 'Kembali', description: 'Lihat cabang halaman pertama' }
    ];
  }

  return [
    { id: 'CABANG_PRY', title: 'Cabang Praya', description: 'Wilayah layanan Praya' },
    { id: 'CABANG_PTE', title: 'Cabang Praya Tengah', description: 'Wilayah Praya Tengah' },
    { id: 'CABANG_PRB', title: 'Cabang Praya Barat', description: 'Wilayah Praya Barat' },
    { id: 'CABANG_PRBD', title: 'Cabang Praya Barat Daya', description: 'Wilayah Praya Barat Daya' },
    { id: 'CABANG_PRT', title: 'Cabang Praya Timur', description: 'Wilayah Praya Timur' },
    { id: 'CABANG_PJT', title: 'Cabang Pujut', description: 'Wilayah layanan Pujut' },
    { id: 'CABANG_JGT', title: 'Cabang Jonggat', description: 'Wilayah layanan Jonggat' },
    { id: 'CABANG_BTK', title: 'Cabang Batukliang', description: 'Wilayah layanan Batukliang' },
    { id: 'CABANG_BTU', title: 'Cabang Batukliang Utara', description: 'Wilayah Batukliang Utara' },
    { id: 'CABANG_PAGE_2', title: 'Lanjut Cabang', description: 'Kopang, Janapria, Pringgarata' }
  ];
}

function buildCabangMenuReply_(page) {
  page = Number(page || 1);
  var rows = getCabangMenuRows_(page);

  var lines = [
    '🏢 *Pilih Cabang Aduan*',
    '',
    'Silakan pilih cabang layanan yang sesuai dengan lokasi gangguan.',
    ''
  ];

  rows.forEach(function(r, i) {
    lines.push((i + 1) + '. ' + r.title);
  });

  lines.push('');
  lines.push('Balas dengan nama cabang atau angka pilihan.');

  return lines.join('\n');
}

function sendKiriminCabangMenu_(phone, page) {
  page = Number(page || 1);
  var props = PropertiesService.getScriptProperties();

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var phoneNumber = normalizePhone_(phone || '');
  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk List Cabang.' };

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: page === 2
          ? 'Pilih cabang layanan lanjutan untuk lokasi gangguan.'
          : 'Pilih cabang layanan sesuai lokasi gangguan.'
      },
      action: {
        button: 'Pilih Cabang',
        sections: [
          {
            title: page === 2 ? 'Cabang Lanjutan' : 'Cabang Layanan',
            rows: getCabangMenuRows_(page)
          }
        ]
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function normalizeIncomingCabangChoice_(text) {
  text = String(text || '').toLowerCase();
  text = text
    .replace(/\*/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  // Navigasi halaman.
  if (
    text.indexOf('cabang page 2') !== -1 ||
    text.indexOf('lanjut cabang') !== -1 ||
    text.indexOf('cabang lanjutan') !== -1 ||
    text.indexOf('kopang, janapria') !== -1 ||
    text === '10'
  ) return '__PAGE_2__';
  if (text.indexOf('cabang page 1') !== -1 || text.indexOf('kembali') !== -1) return '__PAGE_1__';

  // ID dari List Menu.
  if (text.indexOf('cabang pry') !== -1 || text === '1' || text.indexOf('cabang praya ') !== -1 || text === 'cabang praya' || text === 'praya') return 'Cabang Praya';
  if (text.indexOf('cabang pte') !== -1 || text === '2' || text.indexOf('praya tengah') !== -1) return 'Cabang Praya Tengah';
  if (text.indexOf('cabang prb') !== -1 || text === '3' || text.indexOf('praya barat daya') === -1 && text.indexOf('praya barat') !== -1) return 'Cabang Praya Barat';
  if (text.indexOf('cabang prbd') !== -1 || text === '4' || text.indexOf('praya barat daya') !== -1) return 'Cabang Praya Barat Daya';
  if (text.indexOf('cabang prt') !== -1 || text === '5' || text.indexOf('praya timur') !== -1) return 'Cabang Praya Timur';
  if (text.indexOf('cabang pjt') !== -1 || text === '6' || text.indexOf('pujut') !== -1) return 'Cabang Pujut';
  if (text.indexOf('cabang jgt') !== -1 || text === '7' || text.indexOf('jonggat') !== -1) return 'Cabang Jonggat';
  if (text.indexOf('cabang btk') !== -1 || text === '8' || (text.indexOf('batukliang') !== -1 && text.indexOf('utara') === -1)) return 'Cabang Batukliang';
  if (text.indexOf('cabang btu') !== -1 || text === '9' || text.indexOf('batukliang utara') !== -1) return 'Cabang Batukliang Utara';

  // Halaman 2 bisa dibalas angka 1/2/3; kalau user mengetik nama tetap aman.
  if (text.indexOf('cabang kpg') !== -1 || text.indexOf('kopang') !== -1) return 'Cabang Kopang';
  if (text.indexOf('cabang jnp') !== -1 || text.indexOf('janapria') !== -1) return 'Cabang Janapria';
  if (text.indexOf('cabang pgr') !== -1 || text.indexOf('pringgarata') !== -1) return 'Cabang Pringgarata';

  // Jika title row dikirim tanpa kata "Cabang" dari WhatsApp.
  if (text === 'praya tengah') return 'Cabang Praya Tengah';
  if (text === 'praya barat') return 'Cabang Praya Barat';
  if (text === 'praya barat daya') return 'Cabang Praya Barat Daya';
  if (text === 'praya timur') return 'Cabang Praya Timur';
  if (text === 'batukliang utara') return 'Cabang Batukliang Utara';

  return '';
}

function getCabangMirrorSheetName_(cabang) {
  cabang = String(cabang || 'Cabang Lainnya').trim();
  var code = CABANG_CODE[cabang] || 'LNY';
  return 'CABANG_' + code;
}



// ============================================================
// V10.9.40 - ONE SHEET CABANG: MANUAL INPUT + UPDATE STATUS
// ============================================================


function getDefaultWilayahByCabang_(cabang) {
  cabang = String(cabang || '').trim();
  if (!cabang) return '';

  var map = {
    'Cabang Praya': 'Praya',
    'Cabang Praya Tengah': 'Praya Tengah',
    'Cabang Praya Barat': 'Praya Barat',
    'Cabang Praya Barat Daya': 'Praya Barat Daya',
    'Cabang Praya Timur': 'Praya Timur',
    'Cabang Pujut': 'Pujut',
    'Cabang Jonggat': 'Jonggat',
    'Cabang Batukliang': 'Batukliang',
    'Cabang Batukliang Utara': 'Batukliang Utara',
    'Cabang Kopang': 'Kopang',
    'Cabang Janapria': 'Janapria',
    'Cabang Pringgarata': 'Pringgarata'
  };

  return map[cabang] || cabang.replace(/^Cabang\s+/i, '').trim();
}

function cabangMirrorRowHasManualInput_(sh, rowNumber) {
  if (!sh || rowNumber < 2) return false;

  var cols = [
    CONFIG.COL.DESA,
    CONFIG.COL.NAMA_PELANGGAN,
    CONFIG.COL.NO_HP,
    CONFIG.COL.JENIS_GANGGUAN,
    CONFIG.COL.KETERANGAN,
    CONFIG.COL.LOKASI_DETAIL
  ];

  for (var i = 0; i < cols.length; i++) {
    try {
      var v = String(sh.getRange(rowNumber, cols[i]).getValue() || '').trim();
      if (v) return true;
    } catch(e) {}
  }

  return false;
}

function autoFillCabangWilayahForMirrorRow_(sh, rowNumber) {
  if (!sh || rowNumber < 2 || !isCabangMirrorSheetName_(sh.getName())) return;

  var sheetCabang = getCabangNameByMirrorSheetName_(sh.getName());
  if (!sheetCabang) return;

  // Jangan isi baris yang benar-benar kosong agar sheet tidak penuh default.
  if (!cabangMirrorRowHasManualInput_(sh, rowNumber)) return;

  var wilayahDefault = getDefaultWilayahByCabang_(sheetCabang);

  try {
    var cabangCell = sh.getRange(rowNumber, CONFIG.COL.CABANG);
    if (!String(cabangCell.getValue() || '').trim()) {
      cabangCell.setValue(sheetCabang);
    }
  } catch(e1) {}

  try {
    var wilayahCell = sh.getRange(rowNumber, CONFIG.COL.WILAYAH);
    if (!String(wilayahCell.getValue() || '').trim()) {
      wilayahCell.setValue(wilayahDefault);
    }
  } catch(e2) {}
}


function getCabangNameByMirrorSheetName_(sheetName) {
  sheetName = String(sheetName || '').trim();
  if (sheetName.indexOf('CABANG_') !== 0) return '';

  var code = sheetName.replace(/^CABANG_/, '').trim();

  for (var cabang in CABANG_CODE) {
    if (CABANG_CODE[cabang] === code) return cabang;
  }

  return '';
}

function isCabangMirrorManualRowEmpty_(rowValues) {
  rowValues = rowValues || [];

  var colsToCheck = [
    CONFIG.COL.WILAYAH,
    CONFIG.COL.DESA,
    CONFIG.COL.NAMA_PELANGGAN,
    CONFIG.COL.NO_HP,
    CONFIG.COL.JENIS_GANGGUAN,
    CONFIG.COL.KETERANGAN,
    CONFIG.COL.LOKASI_DETAIL
  ];

  for (var i = 0; i < colsToCheck.length; i++) {
    var idx = colsToCheck[i] - 1;
    if (String(rowValues[idx] || '').trim()) return false;
  }

  return true;
}

function buildAduanObjectFromCabangRow_(rowValues) {
  rowValues = rowValues || [];
  return {
    id: String(rowValues[CONFIG.COL.ID - 1] || '').trim(),
    waktuMasukDate: rowValues[CONFIG.COL.WAKTU_MASUK - 1] || '',
    waktuMasuk: rowValues[CONFIG.COL.WAKTU_MASUK - 1] || '',
    cabang: String(rowValues[CONFIG.COL.CABANG - 1] || '').trim(),
    wilayah: String(rowValues[CONFIG.COL.WILAYAH - 1] || '').trim(),
    desa: String(rowValues[CONFIG.COL.DESA - 1] || '').trim(),
    namaPelanggan: String(rowValues[CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim(),
    noHp: normalizePhone_(rowValues[CONFIG.COL.NO_HP - 1] || ''),
    jenisGangguan: String(rowValues[CONFIG.COL.JENIS_GANGGUAN - 1] || '').trim(),
    prioritas: String(rowValues[CONFIG.COL.PRIORITAS - 1] || '').trim(),
    status: String(rowValues[CONFIG.COL.STATUS - 1] || '').trim(),
    unit: String(rowValues[CONFIG.COL.UNIT - 1] || '').trim(),
    keterangan: String(rowValues[CONFIG.COL.KETERANGAN - 1] || '').trim(),
    catatan: String(rowValues[CONFIG.COL.CATATAN - 1] || '').trim(),
    waktuSelesaiDate: rowValues[CONFIG.COL.WAKTU_SELESAI - 1] || '',
    waktuSelesai: rowValues[CONFIG.COL.WAKTU_SELESAI - 1] || '',
    slaJam: rowValues[CONFIG.COL.SLA_JAM - 1] || '',
    updatedAtDate: rowValues[CONFIG.COL.UPDATED_AT - 1] || '',
    updatedAt: rowValues[CONFIG.COL.UPDATED_AT - 1] || '',
    latitude: rowValues[CONFIG.COL.LATITUDE - 1] || '',
    longitude: rowValues[CONFIG.COL.LONGITUDE - 1] || '',
    linkMaps: rowValues[CONFIG.COL.LINK_MAPS - 1] || '',
    lokasiDetail: String(rowValues[CONFIG.COL.LOKASI_DETAIL - 1] || '').trim()
  };
}

function syncManualCabangRowToAduan_(sh, rowNumber, aduanSheet, logSheet) {
  if (!sh || rowNumber < 2) return { synced: false, reason: 'invalid row' };

  // V10.9.41:
  // Di sheet CABANG_*, kolom Cabang dan Wilayah otomatis mengikuti nama sheet.
  // Contoh: CABANG_PRY otomatis Cabang Praya + Praya.
  try { autoFillCabangWilayahForMirrorRow_(sh, rowNumber); } catch(e) {}

  aduanSheet = aduanSheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!aduanSheet) {
    setupAduanSheet(SpreadsheetApp.getActiveSpreadsheet());
    aduanSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  }

  var width = Math.max(CONFIG.COL.LOKASI_DETAIL || 20, 20);
  var rowValues = sh.getRange(rowNumber, 1, 1, width).getValues()[0];

  var existingId = String(rowValues[CONFIG.COL.ID - 1] || '').trim();
  if (existingId) return { synced: false, reason: 'row already has ID', id: existingId };

  if (isCabangMirrorManualRowEmpty_(rowValues)) {
    return { synced: false, reason: 'empty row' };
  }

  var sheetCabang = getCabangNameByMirrorSheetName_(sh.getName());
  if (!sheetCabang) return { synced: false, reason: 'unknown cabang sheet' };

  var now = new Date();
  var cabang = String(rowValues[CONFIG.COL.CABANG - 1] || '').trim() || sheetCabang;
  var wilayah = String(rowValues[CONFIG.COL.WILAYAH - 1] || '').trim() || getDefaultWilayahByCabang_(sheetCabang);
  var noPelanggan = String(rowValues[CONFIG.COL.DESA - 1] || '').trim();
  var namaPelanggan = String(rowValues[CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim();
  var noHp = normalizePhone_(rowValues[CONFIG.COL.NO_HP - 1] || '');
  var keterangan = String(rowValues[CONFIG.COL.KETERANGAN - 1] || '').trim();

  // V10.9.42:
  // Jenis Gangguan sekarang punya dropdown. Kalau masih kosong, sistem coba tebak dari Keterangan.
  // Contoh keterangan "mati terus" -> Air Mati.
  var jenis = normalizeInputJenisGangguan_(rowValues[CONFIG.COL.JENIS_GANGGUAN - 1]);
  if (!jenis && keterangan) jenis = normalizeInputJenisGangguan_(keterangan);

  var prioritas = normalizeInputPrioritas_(rowValues[CONFIG.COL.PRIORITAS - 1]);
  var status = String(rowValues[CONFIG.COL.STATUS - 1] || '').trim() || 'Baru';
  var unit = normalizeInputUnit_(rowValues[CONFIG.COL.UNIT - 1]) || getUnitByJenisGangguan_(jenis) || 'Cabang';
  var catatan = String(rowValues[CONFIG.COL.CATATAN - 1] || '').trim();
  var waktuMasuk = asDateForArchive_(rowValues[CONFIG.COL.WAKTU_MASUK - 1]) || now;
  var latitude = rowValues[CONFIG.COL.LATITUDE - 1] || '';
  var longitude = rowValues[CONFIG.COL.LONGITUDE - 1] || '';
  var linkMaps = rowValues[CONFIG.COL.LINK_MAPS - 1] || '';
  var lokasiDetail = String(rowValues[CONFIG.COL.LOKASI_DETAIL - 1] || '').trim();

  // Minimal data agar sistem tidak membuat ID saat baris masih setengah diisi.
  // Cabang/Wilayah otomatis dari sheet.
  // Cukup ada identitas pelanggan (Nama atau No Pelanggan) + Jenis Gangguan.
  if ((!namaPelanggan && !noPelanggan) || !jenis) {
    return { synced: false, pending: true, reason: 'minimal belum lengkap' };
  }

  var cabangCode = CABANG_CODE[cabang] || CABANG_CODE[sheetCabang] || 'LNY';
  var sourceKey = sh.getName() + '#' + rowNumber;
  var propKey = makeInputSourcePropertyKey_(sourceKey);
  var existingPropId = getInputSourceProperty_(propKey);
  if (existingPropId) {
    sh.getRange(rowNumber, CONFIG.COL.ID).setValue(existingPropId);
    return { synced: false, reason: 'restored from property', id: existingPropId };
  }

  var payload = {
    namaPelanggan: namaPelanggan,
    noHp: noHp,
    wilayah: wilayah,
    desa: noPelanggan,
    jenis: jenis,
    prioritas: prioritas,
    unitPetugas: unit,
    keterangan: keterangan
  };

  var existingAduanMap = getExistingAduanFingerprintMap_(aduanSheet);
  var fingerprint = buildInputAduanFingerprint_(cabang, waktuMasuk, payload);
  if (existingAduanMap[fingerprint]) {
    var dupId = existingAduanMap[fingerprint].id || '';
    if (dupId) {
      sh.getRange(rowNumber, CONFIG.COL.ID).setValue(dupId);
      sh.getRange(rowNumber, CONFIG.COL.CABANG).setValue(cabang);
      sh.getRange(rowNumber, CONFIG.COL.UPDATED_AT).setValue(now);
      return { synced: false, duplicate: true, id: dupId, reason: 'duplicate fingerprint' };
    }
  }

  var idAduan = generateCabangAduanId_(cabangCode, waktuMasuk, aduanSheet);
  setInputSourceProperty_(propKey, idAduan);

  var slaJam = CONFIG.SLA[prioritas] || CONFIG.SLA['Sedang'] || 8;
  var waktuSelesai = rowValues[CONFIG.COL.WAKTU_SELESAI - 1] || '';
  if (status === 'Selesai' && !waktuSelesai) waktuSelesai = now;

  var rowToWrite = [
    idAduan,
    waktuMasuk,
    cabang,
    wilayah,
    noPelanggan,
    namaPelanggan,
    noHp,
    jenis,
    prioritas,
    status,
    unit,
    keterangan,
    catatan,
    waktuSelesai,
    slaJam,
    now,
    latitude,
    longitude,
    linkMaps,
    lokasiDetail
  ];

  aduanSheet.appendRow(rowToWrite);
  var aduanRow = aduanSheet.getLastRow();
  try { enforcePriorityStatusUnitForRow_(aduanSheet, aduanRow); } catch(e) {}

  // Tulis balik ke sheet cabang agar baris manual berubah menjadi tiket resmi.
  sh.getRange(rowNumber, 1, 1, rowToWrite.length).setValues([rowToWrite]);
  try { enforcePriorityStatusUnitForRow_(sh, rowNumber); } catch(e2) {}
  try { applyCabangMirrorDropdowns_(sh); } catch(e3) {}
  try { sh.getRange(rowNumber, 1, 1, rowToWrite.length).setBackground('#ecfdf5'); } catch(e4) {}

  if (logSheet) {
    appendInputCabangLog_(
      logSheet, now, cabang, sh.getName(), rowNumber,
      idAduan, namaPelanggan, jenis, 'Terkirim'
    );
  }

  // Notifikasi ke petugas cabang, sama seperti aduan dari WhatsApp.
  try {
    notifyPetugasCabang_(buildAduanObjectFromCabangRow_(rowToWrite));
  } catch(notifErr) {
    try {
      logWhatsApp_('', 'Gagal notif petugas dari input manual sheet cabang', 'PETUGAS_NOTIFY_MANUAL', idAduan, '', 'ERROR', notifErr.message || String(notifErr));
    } catch(e5) {}
  }

  return { synced: true, id: idAduan, cabang: cabang };
}

function syncManualRowsFromAllCabangMirrors_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aduanSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!aduanSheet) {
    setupAduanSheet(ss);
    aduanSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  }

  setupInputCabangLogSheet(ss);
  var logSheet = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);
  var totalSynced = 0;
  var detailLines = [];

  (CONFIG.CABANG || []).forEach(function(cabang) {
    var sh = setupSingleCabangMirrorSheet_(ss, cabang);
    if (!sh) return;

    var lastRow = safeGetLastRow_(sh);
    var synced = 0;

    if (lastRow >= 2) {
      for (var r = 2; r <= lastRow; r++) {
        var result = syncManualCabangRowToAduan_(sh, r, aduanSheet, logSheet);
        if (result && result.synced) synced++;
      }
    }

    totalSynced += synced;
    detailLines.push(cabang + ': ' + synced + ' data manual');
  });

  if (totalSynced > 0) {
    try { sortSheet(); } catch(e) {}
    try { removeEmptyRowsAduan(); } catch(e2) {}
  }

  return { totalSynced: totalSynced, detailLines: detailLines };
}

function deleteLegacyInputCabangSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var existing = (LEGACY_CABANG_INPUT_SHEETS || []).filter(function(item) {
    return !!ss.getSheetByName(item.sheet);
  });

  if (!existing.length) {
    ui.alert('Tidak ada sheet INPUT lama yang ditemukan.');
    return;
  }

  var names = existing.map(function(item) { return item.sheet; }).join('\\n');

  var confirm = ui.alert(
    'Hapus Sheet INPUT Lama',
    'Sheet INPUT_* tidak dipakai lagi mulai versi ini. Manual input sekarang langsung di sheet CABANG_*.\n\n' +
    'Sheet berikut akan dihapus permanen dari spreadsheet:\\n\\n' + names + '\\n\\n' +
    'Pastikan tidak ada data penting yang belum dipindahkan. Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var deleted = 0;
  existing.forEach(function(item) {
    var sh = ss.getSheetByName(item.sheet);
    if (!sh) return;
    try {
      ss.deleteSheet(sh);
      deleted++;
    } catch(e) {}
  });

  ui.alert(
    '✅ Sheet INPUT Lama Dihapus',
    deleted + ' sheet INPUT lama sudah dihapus.\\n\\n' +
    'Mulai sekarang cabang cukup pakai sheet CABANG_* untuk input manual sekaligus update status.',
    ui.ButtonSet.OK
  );
}


// ============================================================
// V10.9.38 - DROPDOWN STATUS / UNIT DI SHEET CABANG + SYNC KE ADUAN
// ============================================================

function isCabangMirrorSheetName_(name) {
  name = String(name || '').trim();
  return name.indexOf('CABANG_') === 0;
}

function applyCabangMirrorDropdowns_(sh) {
  if (!sh) return;
  var maxRows = Math.max(500, sh.getMaxRows() - 1);

  var priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.PRIORITAS || ['Rendah', 'Sedang', 'Tinggi', 'Darurat'], true)
    .setAllowInvalid(false)
    .build();

  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.STATUS || ['Baru', 'Proses', 'Selesai', 'Ditunda', 'Batal'], true)
    .setAllowInvalid(false)
    .build();

  var unitRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.UNIT || ['Cabang', 'Hublang', 'Teknik', 'Distribusi', 'Produksi', 'IT', 'Lainnya'], true)
    .setAllowInvalid(true)
    .build();

  var jenisRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.JENIS_GANGGUAN || ['Air Mati', 'Tekanan Rendah', 'Air Keruh', 'Pipa Bocor', 'Meter Bermasalah', 'Tagihan', 'Sambungan Baru', 'Lainnya'], true)
    .setAllowInvalid(true)
    .build();

  try { sh.getRange(2, CONFIG.COL.JENIS_GANGGUAN, maxRows, 1).setDataValidation(jenisRule); } catch(e0) {}
  try { sh.getRange(2, CONFIG.COL.PRIORITAS, maxRows, 1).setDataValidation(priorityRule); } catch(e) {}
  try { sh.getRange(2, CONFIG.COL.STATUS, maxRows, 1).setDataValidation(statusRule); } catch(e2) {}
  try { sh.getRange(2, CONFIG.COL.UNIT, maxRows, 1).setDataValidation(unitRule); } catch(e3) {}

  try { sh.getRange(2, CONFIG.COL.WAKTU_SELESAI, maxRows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e4) {}
  try { sh.getRange(2, CONFIG.COL.UPDATED_AT, maxRows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss'); } catch(e5) {}
}

function refreshAllCabangMirrorDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var total = 0;

  (CONFIG.CABANG || []).forEach(function(cabang) {
    var sh = setupSingleCabangMirrorSheet_(ss, cabang);
    if (!sh) return;
    applyCabangMirrorDropdowns_(sh);

    // V10.9.42: rapikan baris existing yang sudah punya input manual tetapi Cabang/Wilayah masih kosong.
    try {
      var lastRow = safeGetLastRow_(sh);
      if (lastRow >= 2) {
        for (var r = 2; r <= lastRow; r++) {
          autoFillCabangWilayahForMirrorRow_(sh, r);
        }
      }
    } catch(e) {}

    total++;
  });

  SpreadsheetApp.getUi().alert(
    '✅ Dropdown Cabang Diperbaiki',
    'Dropdown Jenis Gangguan, Status, Unit/Petugas, dan Prioritas sudah dipasang ulang pada ' + total + ' sheet cabang.\n\n' +
    'Kolom yang memiliki dropdown:\n' +
    '- Jenis Gangguan\n' +
    '- Prioritas\n' +
    '- Status\n' +
    '- Unit/Petugas\n\n' +
    'Cabang bisa mengganti Status/Unit dari sheet CABANG_ masing-masing.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function findAduanRowNumberById_(id) {
  id = String(id || '').trim();
  if (!id) return 0;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!main || safeGetLastRow_(main) < 2) return 0;

  var values = main.getRange(2, CONFIG.COL.ID, safeGetLastRow_(main) - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id) return i + 2;
  }
  return 0;
}


// ============================================================
// V10.9.43 - SYNC ADUAN UTAMA KE SHEET CABANG
// ============================================================

function findCabangMirrorRowById_(sheet, id) {
  id = String(id || '').trim();
  if (!sheet || !id || safeGetLastRow_(sheet) < 2) return 0;

  var ids = sheet.getRange(2, CONFIG.COL.ID, safeGetLastRow_(sheet) - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === id) return i + 2;
  }

  return 0;
}

function getAduanObjectFromSheetRow_(sheet, rowNumber) {
  if (!sheet || rowNumber < 2) return null;
  var width = Math.max(sheet.getLastColumn(), CONFIG.COL.LOKASI_DETAIL || 20, 20);
  var row = sheet.getRange(rowNumber, 1, 1, width).getValues()[0];
  return parseAduanRowForTracking_(row);
}

function syncAduanRowToCabangMirror_(mainSheet, rowNumber) {
  mainSheet = mainSheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  rowNumber = Number(rowNumber || 0);
  if (!mainSheet || rowNumber < 2) return { success: false, reason: 'invalid row' };

  var aduan = getAduanObjectFromSheetRow_(mainSheet, rowNumber);
  if (!aduan || !aduan.id) return { success: false, reason: 'ID kosong' };

  // Ambil nilai mentah tanggal agar tidak berubah jadi teks format WA.
  try {
    var width = Math.max(mainSheet.getLastColumn(), CONFIG.COL.LOKASI_DETAIL || 20, 20);
    var raw = mainSheet.getRange(rowNumber, 1, 1, width).getValues()[0];
    aduan.waktuMasukDate = raw[CONFIG.COL.WAKTU_MASUK - 1] || aduan.waktuMasukDate || aduan.waktuMasuk;
    aduan.waktuSelesaiDate = raw[CONFIG.COL.WAKTU_SELESAI - 1] || aduan.waktuSelesaiDate || aduan.waktuSelesai;
    aduan.updatedAtDate = raw[CONFIG.COL.UPDATED_AT - 1] || aduan.updatedAtDate || aduan.updatedAt;
    aduan.desa = raw[CONFIG.COL.DESA - 1] || aduan.desa || aduan.noPelanggan || '';
    aduan.noPelanggan = raw[(CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA) - 1] || aduan.noPelanggan || '';
  } catch(e) {}

  return mirrorAduanToCabangSheet_(aduan);
}

function syncAduanEditToCabangMirror_(e) {
  if (!e || !e.range) return;

  var sh = e.range.getSheet();
  if (!sh || sh.getName() !== CONFIG.SHEET_NAME) return;

  var range = e.range;
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  var startCol = range.getColumn();
  var endCol = startCol + range.getNumColumns() - 1;

  if (startRow < 2) return;

  // Kolom-kolom yang kalau berubah harus dicerminkan ke sheet cabang.
  var watchedCols = [
    CONFIG.COL.CABANG,
    CONFIG.COL.WILAYAH,
    CONFIG.COL.DESA,
    CONFIG.COL.NAMA_PELANGGAN,
    CONFIG.COL.NO_HP,
    CONFIG.COL.JENIS_GANGGUAN,
    CONFIG.COL.PRIORITAS,
    CONFIG.COL.STATUS,
    CONFIG.COL.UNIT,
    CONFIG.COL.KETERANGAN,
    CONFIG.COL.CATATAN,
    CONFIG.COL.WAKTU_SELESAI,
    CONFIG.COL.LATITUDE,
    CONFIG.COL.LONGITUDE,
    CONFIG.COL.LINK_MAPS,
    CONFIG.COL.LOKASI_DETAIL
  ];

  var touched = watchedCols.some(function(c) {
    return c >= startCol && c <= endCol;
  });

  if (!touched) return;

  for (var r = startRow; r < startRow + numRows; r++) {
    if (r < 2) continue;
    try { syncAduanRowToCabangMirror_(sh, r); } catch(err) {}
  }
}

function syncAllAduanToCabangMirror() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!main || safeGetLastRow_(main) < 2) {
    ui.alert('Belum ada data ADUAN untuk disinkronkan.');
    return;
  }

  var confirm = ui.alert(
    'Sinkron ADUAN ke Sheet Cabang',
    'Fitur ini akan menyalin ulang data dari sheet ADUAN ke sheet CABANG_* berdasarkan ID Aduan.\n\n' +
    'Kalau Status/Unit/Prioritas di ADUAN sudah diubah, sheet cabang akan ikut diperbarui.\n\n' +
    'Lanjutkan?',
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  var lock = LockService.getScriptLock();
  var total = 0;
  var gagal = 0;

  try {
    lock.waitLock(30000);

    for (var r = 2; r <= safeGetLastRow_(main); r++) {
      var id = String(main.getRange(r, CONFIG.COL.ID).getValue() || '').trim();
      if (!id) continue;

      var result = syncAduanRowToCabangMirror_(main, r);
      if (result && result.success) total++;
      else gagal++;
    }

    ui.alert(
      '✅ Sinkron Selesai',
      'Data ADUAN yang disinkron ke sheet cabang: ' + total + '\n' +
      'Gagal/terlewati: ' + gagal + '\n\n' +
      'Sekarang Status di ADUAN dan CABANG_* harus sama.',
      ui.ButtonSet.OK
    );

  } catch(e) {
    ui.alert('❌ Sinkron gagal: ' + (e.message || String(e)));
  } finally {
    try { lock.releaseLock(); } catch(err) {}
  }
}


function syncCabangMirrorEditToAduan_(e) {
  if (!e || !e.range) return;

  var sh = e.range.getSheet();
  if (!sh || !isCabangMirrorSheetName_(sh.getName())) return;

  var range = e.range;
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  var startCol = range.getColumn();
  var endCol = startCol + range.getNumColumns() - 1;

  if (startRow < 2) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var main = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!main) return;

  setupInputCabangLogSheet(ss);
  var logSheet = ss.getSheetByName(CONFIG.INPUT_LOG_SHEET);

  for (var r = startRow; r < startRow + numRows; r++) {
    if (r < 2) continue;

    var id = String(sh.getRange(r, CONFIG.COL.ID).getValue() || '').trim();

    // V10.9.40:
    // Jika ID kosong, baris di CABANG_* dianggap input manual baru.
    // Setelah minimal Nama + Wilayah + Jenis Gangguan lengkap, sistem buat ID dan kirim ke ADUAN.
    if (!id) {
      syncManualCabangRowToAduan_(sh, r, main, logSheet);
      continue;
    }

    var watchedCols = [
      CONFIG.COL.PRIORITAS,
      CONFIG.COL.STATUS,
      CONFIG.COL.UNIT,
      CONFIG.COL.CATATAN
    ];

    var touched = watchedCols.some(function(c) {
      return c >= startCol && c <= endCol;
    });

    if (!touched) continue;

    var mainRow = findAduanRowNumberById_(id);
    if (!mainRow) continue;

    var oldStatus = String(main.getRange(mainRow, CONFIG.COL.STATUS).getValue() || '').trim();
    var newPrioritas = String(sh.getRange(r, CONFIG.COL.PRIORITAS).getValue() || '').trim();
    var newStatus = String(sh.getRange(r, CONFIG.COL.STATUS).getValue() || '').trim();
    var newUnit = String(sh.getRange(r, CONFIG.COL.UNIT).getValue() || '').trim();
    var newCatatan = String(sh.getRange(r, CONFIG.COL.CATATAN).getValue() || '').trim();

    if (newPrioritas) {
      main.getRange(mainRow, CONFIG.COL.PRIORITAS).setValue(newPrioritas);
      main.getRange(mainRow, CONFIG.COL.SLA_JAM).setValue(CONFIG.SLA[newPrioritas] || 8);
    }

    if (newStatus) {
      main.getRange(mainRow, CONFIG.COL.STATUS).setValue(newStatus);

      if (newStatus === 'Selesai') {
        var doneAt = sh.getRange(r, CONFIG.COL.WAKTU_SELESAI).getValue() || new Date();
        main.getRange(mainRow, CONFIG.COL.WAKTU_SELESAI).setValue(doneAt);
        sh.getRange(r, CONFIG.COL.WAKTU_SELESAI).setValue(doneAt);
      } else if (oldStatus === 'Selesai' && newStatus !== 'Selesai') {
        main.getRange(mainRow, CONFIG.COL.WAKTU_SELESAI).clearContent();
        sh.getRange(r, CONFIG.COL.WAKTU_SELESAI).clearContent();
      }
    }

    if (newUnit) main.getRange(mainRow, CONFIG.COL.UNIT).setValue(newUnit);
    main.getRange(mainRow, CONFIG.COL.CATATAN).setValue(newCatatan);

    var now = new Date();
    main.getRange(mainRow, CONFIG.COL.UPDATED_AT).setValue(now);
    sh.getRange(r, CONFIG.COL.UPDATED_AT).setValue(now);

    if (newStatus && oldStatus && oldStatus.toLowerCase() !== newStatus.toLowerCase()) {
      try {
        notifyCustomerStatusChangeByRow_(main, mainRow, oldStatus, newStatus, 'CABANG_SHEET_EDIT');
      } catch(notifErr) {
        try {
          logStatusNotif_(id, '-', oldStatus, newStatus, false, 'ERROR_CABANG_SYNC', notifErr.message || String(notifErr), '', notifErr.stack || '');
        } catch(e2) {}
      }
    }
  }
}


function getAduanHeadersForCabangMirror_() {
  return [
    'ID Aduan', 'Waktu Masuk', 'Cabang', 'Wilayah/Kecamatan',
    'No Pelanggan', 'Nama Pelanggan', 'No HP', 'Jenis Gangguan', 'Prioritas',
    'Status', 'Unit/Petugas', 'Keterangan Aduan', 'Catatan Tindak Lanjut',
    'Waktu Selesai', 'SLA Jam', 'Updated At',
    'Latitude', 'Longitude', 'Link Maps', 'Lokasi Detail'
  ];
}


// ============================================================
// V10.9.39 - FIX CABANG PRAYA BARAT DAYA / LNY
// ============================================================

function fixPrayaBaratDayaFromLny() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // Pastikan sheet resmi PRBD dibuat.
  var prbdSheet = setupSingleCabangMirrorSheet_(ss, 'Cabang Praya Barat Daya');
  applyCabangMirrorDropdowns_(prbdSheet);

  var lnySheet = ss.getSheetByName('CABANG_LNY');
  var moved = 0;

  if (lnySheet && safeGetLastRow_(lnySheet) >= 2) {
    var lastCol = Math.max(lnySheet.getLastColumn(), CONFIG.COL.LOKASI_DETAIL || 20);
    var values = lnySheet.getRange(2, 1, safeGetLastRow_(lnySheet) - 1, lastCol).getValues();
    var rowsToDelete = [];

    values.forEach(function(row, idx) {
      var cabang = String(row[CONFIG.COL.CABANG - 1] || '').trim();
      var id = String(row[CONFIG.COL.ID - 1] || '').trim();

      // Pindahkan hanya data yang memang Cabang Praya Barat Daya.
      // ID lama mungkin masih LNY karena versi sebelumnya belum punya mapping PRBD.
      if (cabang === 'Cabang Praya Barat Daya') {
        var exists = false;
        if (safeGetLastRow_(prbdSheet) >= 2) {
          var ids = prbdSheet.getRange(2, CONFIG.COL.ID, safeGetLastRow_(prbdSheet) - 1, 1).getValues();
          exists = ids.some(function(v) { return String(v[0] || '').trim() === id; });
        }
        if (!exists) prbdSheet.appendRow(row);
        rowsToDelete.push(idx + 2);
        moved++;
      }
    });

    // Hapus dari bawah agar nomor baris tidak bergeser.
    rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNum) {
      try { lnySheet.deleteRow(rowNum); } catch(e) {}
    });

    applyCabangMirrorDropdowns_(prbdSheet);
  }

  ui.alert(
    '✅ PRBD Diperbaiki',
    'Kode Cabang Praya Barat Daya sekarang adalah PRBD.\n\n' +
    'Sheet resmi yang dipakai:\n' +
    '- CABANG_PRBD\n\n' +
    'Data Praya Barat Daya yang sebelumnya masuk CABANG_LNY dipindahkan: ' + moved + ' baris.\n\n' +
    'Catatan: CABANG_LNY adalah sheet fallback/lainnya. Jika sudah kosong dan tidak dipakai, boleh dihapus manual.',
    ui.ButtonSet.OK
  );
}


function setupCabangMirrorSheets(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();

  (CONFIG.CABANG || []).forEach(function(cabang) {
    setupSingleCabangMirrorSheet_(ss, cabang);
  });

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Sheet Aduan Cabang Siap',
      'Sheet cabang resmi sudah dicek/dibuat. Mulai versi ini, sheet CABANG_* dipakai untuk melihat aduan, update status, sekaligus input manual aduan baru. Data lama tidak dihapus.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch(e) {}
}

function setupSingleCabangMirrorSheet_(ss, cabang) {
  var sheetName = getCabangMirrorSheetName_(cabang);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var headers = getAduanHeadersForCabangMirror_();
  var __fastKey = getSheetRuntimeKey_('MIRROR_SETUP_FAST_V10942', sh);
  var fastReady = isSiagaFastMode_() && cacheGet_(__fastKey);

  if (!fastReady) {
    if (sh.getMaxColumns() < headers.length) {
      sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    }

    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#123a5d')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    sh.setFrozenRows(1);
    sh.setFrozenColumns(1);

    try {
      if (!sh.getFilter()) sh.getRange(1, 1, Math.max(safeGetLastRow_(sh), 2), headers.length).createFilter();
    } catch(e) {}

    try {
      sh.setColumnWidth(CONFIG.COL.STATUS, 110);
      sh.setColumnWidth(CONFIG.COL.UNIT, 130);
      sh.setColumnWidth(CONFIG.COL.CATATAN, 220);
    } catch(e2) {}

    applyCabangMirrorDropdowns_(sh);
    cachePut_(__fastKey, '1', 21600);
  }

  return sh;
}

function mirrorAduanToCabangSheet_(aduan) {
  aduan = aduan || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cabang = aduan.cabang || 'Cabang Lainnya';
  var sh = setupSingleCabangMirrorSheet_(ss, cabang);
  var id = String(aduan.id || '').trim();
  if (!id) return { success: false, error: 'ID aduan kosong.' };

  var row = [
    aduan.id || '',
    aduan.waktuMasukDate || aduan.waktuMasuk || '',
    aduan.cabang || '',
    aduan.wilayah || '',
    aduan.desa || aduan.noPelanggan || '',
    aduan.namaPelanggan || '',
    aduan.noHp || '',
    aduan.jenisGangguan || '',
    aduan.prioritas || '',
    aduan.status || '',
    aduan.unit || '',
    aduan.keterangan || '',
    aduan.catatan || '',
    aduan.waktuSelesaiDate || aduan.waktuSelesai || '',
    aduan.slaJam || '',
    aduan.updatedAtDate || aduan.updatedAt || '',
    aduan.latitude || '',
    aduan.longitude || '',
    aduan.linkMaps || '',
    aduan.lokasiDetail || ''
  ];

  // V10.9.43:
  // Kalau ID sudah ada di sheet cabang, UPDATE barisnya.
  // Sebelumnya sistem skip, sehingga Status di CABANG_* bisa tidak sama dengan ADUAN.
  var existingRow = findCabangMirrorRowById_(sh, id);
  if (existingRow) {
    sh.getRange(existingRow, 1, 1, row.length).setValues([row]);
    enforcePriorityStatusUnitForRow_(sh, existingRow);
    try { applyCabangMirrorDropdowns_(sh); } catch(e) {}
    return { success: true, updated: true, sheet: sh.getName(), row: existingRow, id: id };
  }

  sh.appendRow(row);
  var appendedRow = sh.getLastRow();
  enforcePriorityStatusUnitForRow_(sh, appendedRow);
  try { applyCabangMirrorDropdowns_(sh); } catch(e2) {}
  return { success: true, inserted: true, sheet: sh.getName(), row: appendedRow, id: id };
}

function testMirrorAduanToCabangSheet() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt(
    'Tes Copy Aduan ke Sheet Cabang',
    'Masukkan ID Aduan yang sudah ada. Contoh: PRY-20260510-0001',
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var id = extractAduanId_(prompt.getResponseText()) || prompt.getResponseText();
  var aduan = findAduanById_(id);

  if (!aduan) {
    ui.alert('❌ ID tidak ditemukan', 'ID tidak ada di sheet ADUAN: ' + id, ui.ButtonSet.OK);
    return;
  }

  var result = mirrorAduanToCabangSheet_(aduan);
  ui.alert(result.success ? '✅ Copy selesai' : '❌ Copy gagal', JSON.stringify(result, null, 2), ui.ButtonSet.OK);
}


// ============================================================
// PETUGAS CABANG - NOTIFIKASI OTOMATIS ADUAN WHATSAPP
// ============================================================

function setupPetugasCabangSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PETUGAS_CABANG_SHEET || 'PETUGAS_CABANG';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var __fastKey = sh ? getSheetRuntimeKey_('PETUGAS_SETUP_FAST_V1096', sh) : '';
  if (isSiagaFastMode_() && __fastKey && cacheGet_(__fastKey)) return sh;

  var headers = [
    'Cabang',
    'Nama Petugas',
    'No WA',
    'Role',
    'Status',
    'Notif Aduan Baru',
    'Notif Darurat',
    'Catatan'
  ];

  if (safeGetLastRow_(sh) === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  if (safeGetLastRow_(sh) < 2) {
    var rows = [
      ['Admin Pusat', 'Admin Pusat', '', 'Admin', 'Aktif', 'YA', 'YA', 'Isi nomor admin pusat. Nomor format 628xxx, tanpa +.']
    ];

    (CONFIG.CABANG || []).forEach(function(cabang) {
      rows.push([
        cabang,
        'Petugas ' + cabang.replace('Cabang ', ''),
        '',
        'Teknisi/Koordinator',
        'Aktif',
        'YA',
        'YA',
        'Isi nomor WA petugas cabang. Petugas harus pernah chat ke bot minimal sekali.'
      ]);
    });

    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sh.getRange(1, 1, 1, headers.length)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);

  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Aktif', 'Nonaktif'], true)
    .setAllowInvalid(false)
    .build();

  var yaTidakRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['YA', 'TIDAK'], true)
    .setAllowInvalid(false)
    .build();

  try {
    sh.getRange(2, 5, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(statusRule);
    sh.getRange(2, 6, Math.max(1, sh.getMaxRows() - 1), 2).setDataValidation(yaTidakRule);
  } catch (e) {}

  return sh;
  if (__fastKey) cachePut_(__fastKey, '1', 21600);

}

function openPetugasCabangSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = setupPetugasCabangSheet(ss);
  ss.setActiveSheet(sh);
}

function notifyPetugasCabang_(aduan) {
  aduan = aduan || {};
  var petugasList = getActivePetugasForAduan_(aduan);
  var result = {
    totalPetugas: petugasList.length,
    terkirim: 0,
    gagal: 0,
    detail: []
  };

  if (!aduan.id) {
    result.error = 'ID aduan kosong.';
    return result;
  }

  if (petugasList.length === 0) {
    // FIX V9.9:
    // Kalau petugas cabang belum cocok, fallback ke Admin Pusat agar aduan tetap ada yang menerima.
    var adminFallback = getAdminPusatPetugas_();
    if (adminFallback.length > 0) {
      petugasList = adminFallback;
      result.totalPetugas = petugasList.length;
      logWhatsApp_(
        '',
        'Tidak ada petugas aktif untuk ' + (aduan.cabang || '-') + ', fallback ke Admin Pusat',
        'PETUGAS_NOTIFY',
        aduan.id,
        '',
        'FALLBACK_ADMIN_PUSAT',
        JSON.stringify({ cabang: aduan.cabang, prioritas: aduan.prioritas })
      );
    } else {
      logWhatsApp_(
        '',
        'Tidak ada petugas aktif untuk ' + (aduan.cabang || '-'),
        'PETUGAS_NOTIFY',
        aduan.id,
        '',
        'NO_PETUGAS',
        JSON.stringify({ cabang: aduan.cabang, prioritas: aduan.prioritas })
      );
      return result;
    }
  }

  var message = buildPetugasNotificationMessage_(aduan);

  petugasList.forEach(function(petugas) {
    // V10.9.6:
    // Kirimin ID sudah support kirim text via phone_number.
    // Langsung pakai phone_number agar tidak perlu lookup customer_id dulu.
    var sendResult = sendKiriminTextByPhoneNumber_(petugas.noWa, message);

    if (!sendResult || !sendResult.success) {
      sendResult = {
        success: false,
        via: 'phone_number_direct_failed',
        fallback: sendResult
      };
    }

    var ok = sendResult && sendResult.success;
    if (ok) result.terkirim++;
    else result.gagal++;

    var status = ok ? 'TERKIRIM' : 'GAGAL';
    var raw = JSON.stringify({
      petugas: petugas,
      sendResult: sendResult
    });

    logWhatsApp_(
      petugas.noWa,
      'Notifikasi aduan baru ke petugas',
      'PETUGAS_NOTIFY',
      aduan.id,
      message,
      status,
      raw
    );

    result.detail.push({
      nama: petugas.nama,
      noWa: petugas.noWa,
      cabang: petugas.cabang,
      status: status,
      response: sendResult
    });
  });

  return result;
}


function getPetugasHeaderMap_(sh) {
  var map = {};
  if (!sh || sh.getLastColumn() < 1) return map;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];

  headers.forEach(function(h, idx) {
    var key = normalizeHeaderKey_(h);
    if (!key) return;

    if (key === 'cabang') map.cabang = idx + 1;
    if (key === 'nama_petugas' || key === 'namapetugas' || key === 'nama') map.nama = idx + 1;
    if (key === 'no_wa' || key === 'nowa' || key === 'nomor_wa' || key === 'nomor_whatsapp' || key === 'whatsapp') map.noWa = idx + 1;
    if (key === 'role' || key === 'jabatan') map.role = idx + 1;
    if (key === 'status') map.status = idx + 1;
    if (key === 'notif_aduan_baru' || key === 'notifaduanbaru' || key === 'aduan_baru') map.notifBaru = idx + 1;
    if (key === 'notif_darurat' || key === 'notifdarurat' || key === 'darurat') map.notifDarurat = idx + 1;
    if (key === 'catatan') map.catatan = idx + 1;
  });

  // Fallback posisi default kalau header belum terbaca.
  map.cabang = map.cabang || 1;
  map.nama = map.nama || 2;
  map.noWa = map.noWa || 3;
  map.role = map.role || 4;
  map.status = map.status || 5;
  map.notifBaru = map.notifBaru || 6;
  map.notifDarurat = map.notifDarurat || 7;
  map.catatan = map.catatan || 8;

  return map;
}

function normalizeHeaderKey_(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '');
}

function getPetugasRows_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = setupPetugasCabangSheet(ss);
  var lastRow = safeGetLastRow_(sh);
  var lastCol = sh.getLastColumn();

  if (lastRow < 2) return [];

  var map = getPetugasHeaderMap_(sh);
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

  return values.map(function(row, i) {
    function val(col) {
      if (!col) return '';
      return String(row[col - 1] || '').trim();
    }

    return {
      rowNumber: i + 2,
      cabang: val(map.cabang),
      nama: val(map.nama),
      noWa: normalizePhone_(val(map.noWa)),
      role: val(map.role),
      status: val(map.status),
      notifBaru: val(map.notifBaru) || 'YA',
      notifDarurat: val(map.notifDarurat) || 'YA',
      catatan: val(map.catatan)
    };
  });
}

function getActivePetugasForAduan_(aduan) {
  aduan = aduan || {};
  var cabangKey = normalizeCabangKey_(aduan.cabang || '');

  var list = [];
  var seen = {};
  var rows = getPetugasRows_();

  rows.forEach(function(p) {
    if (!p.noWa) return;

    var status = String(p.status || '').trim().toLowerCase();
    var notifBaru = String(p.notifBaru || 'YA').trim().toUpperCase();

    if (status && status !== 'aktif') return;
    if (notifBaru === 'TIDAK') return;

    var rowCabangKey = normalizeCabangKey_(p.cabang);
    var sameCabang = rowCabangKey === cabangKey;
    var adminPusat = rowCabangKey === normalizeCabangKey_('Admin Pusat');

    // Admin Pusat selalu menerima semua aduan.
    // Petugas cabang menerima aduan sesuai cabangnya.
    var include = sameCabang || adminPusat;

    if (!include) return;

    if (!seen[p.noWa]) {
      seen[p.noWa] = true;
      list.push({
        cabang: p.cabang,
        nama: p.nama || 'Petugas',
        noWa: p.noWa,
        role: p.role || '-',
        rowNumber: p.rowNumber,
        tipeNotif: adminPusat ? 'ADMIN_PUSAT_MONITORING' : 'PETUGAS_CABANG'
      });
    }
  });

  return list;
}

function getAdminPusatPetugas_() {
  var list = [];
  var seen = {};
  var rows = getPetugasRows_();

  rows.forEach(function(p) {
    if (normalizeCabangKey_(p.cabang) !== normalizeCabangKey_('Admin Pusat')) return;
    if (!p.noWa) return;

    var status = String(p.status || '').trim().toLowerCase();
    var notifBaru = String(p.notifBaru || 'YA').trim().toUpperCase();

    if (status && status !== 'aktif') return;
    if (notifBaru === 'TIDAK') return;

    if (!seen[p.noWa]) {
      seen[p.noWa] = true;
      list.push({
        cabang: p.cabang || 'Admin Pusat',
        nama: p.nama || 'Admin Pusat',
        noWa: p.noWa,
        role: p.role || 'Admin',
        rowNumber: p.rowNumber,
        tipeNotif: 'ADMIN_PUSAT_MONITORING'
      });
    }
  });

  return list;
}

// [REMOVED V10.9.44] Duplikasi cekPetugasCabangAktif pertama dihapus.
// Versi aktif ada di bawah (lebih ringkas).


function sendKiriminTextByPhoneNumber_(phone, message) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!endpoint || !token) {
    return { success: false, error: 'Endpoint/API token WhatsApp belum diset.' };
  }

  if (!phoneNumber) {
    return { success: false, error: 'phone_number kosong.' };
  }

  // Format fallback Kirimin:
  // Karena interactive List Menu berhasil pakai phone_number di endpoint /messages/send,
  // notifikasi petugas juga dicoba pakai phone_number jika customer_id gagal.
  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'text',
    content: String(message || '')
  };

  try {
    var res = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(body)
    });

    var statusCode = res.getResponseCode();
    var text = res.getContentText();

    if (statusCode >= 200 && statusCode < 300) {
      return { success: true, statusCode: statusCode, response: text, requestBody: body, via: 'phone_number' };
    }

    return { success: false, statusCode: statusCode, error: text, requestBody: body, via: 'phone_number' };

  } catch (err) {
    return { success: false, error: err.message, requestBody: body, via: 'phone_number' };
  }
}


function buildPetugasNotificationMessage_(aduan) {
  aduan = aduan || {};
  var prioritas = aduan.prioritas || 'Sedang';
  var icon = prioritas === 'Darurat' ? '🚨' : (prioritas === 'Tinggi' ? '⚠️' : '📌');
  var noPelanggan = getNoPelangganFromAduan_(aduan) || '-';

  var lines = [
    icon + ' *ADUAN BARU SIAGA TIARA*',
    '',
    (String(aduan.catatan || '').indexOf('Di luar jam kerja') !== -1 ? '*DI LUAR JAM KERJA*' : ''),
    'ID Aduan: *' + (aduan.id || '-') + '*',
    'Prioritas: *' + prioritas + '*',
    'Status: *' + (aduan.status || 'Baru') + '*',
    '',
    'Cabang: ' + (aduan.cabang || '-'),
    'Nama Pelanggan: ' + (aduan.namaPelanggan || '-'),
    'No HP Pelanggan: ' + (aduan.noHp || '-'),
    'Jenis Laporan: ' + (aduan.jenisGangguan || '-'),
    'Kategori: ' + getKategoriLayananByJenis_(aduan.jenisGangguan || '-'),
    'Unit Tujuan: ' + (aduan.unit || getUnitByJenisGangguan_(aduan.jenisGangguan || '-')),
    'No Pelanggan: ' + noPelanggan,
    'Detail Lokasi: ' + (aduan.lokasiDetail || '-'),
    '',
    'Keterangan:',
    (aduan.keterangan || '-'),
    ''
  ];

  if (aduan.linkMaps) {
    lines.push('');
    lines.push('Maps: ' + aduan.linkMaps);
  }

  if (aduan.catatan) {
    lines.push('Catatan Sistem:');
    lines.push(aduan.catatan);
    lines.push('');
  }

  lines.push('Mohon segera ditindaklanjuti dan update status di dashboard SIAGA TIARA.');

  if (prioritas === 'Darurat') {
    lines.push('');
    lines.push('⚠️ *Prioritas Darurat* — mohon dipantau segera.');
  }

  return lines.join('\n');
}



function cekPetugasCabangAktif() {
  var ui = SpreadsheetApp.getUi();
  var cabangPrompt = ui.prompt(
    'Cek Petugas Cabang',
    'Masukkan cabang. Contoh: Cabang Praya',
    ui.ButtonSet.OK_CANCEL
  );
  if (cabangPrompt.getSelectedButton() !== ui.Button.OK) return;

  var cabang = cabangPrompt.getResponseText() || 'Cabang Praya';
  var dummy = {
    id: 'CEK-PETUGAS',
    cabang: cabang,
    prioritas: 'Sedang'
  };

  var list = getActivePetugasForAduan_(dummy);

  ui.alert(
    list.length ? '✅ Petugas ditemukan: ' + list.length : '⚠️ Petugas tidak ditemukan',
    JSON.stringify(list, null, 2),
    ui.ButtonSet.OK
  );
}


function testDirectNotifikasiPetugasByCabang() {
  var ui = SpreadsheetApp.getUi();

  var cabangPrompt = ui.prompt(
    'Tes Petugas Cabang',
    'Masukkan cabang. Contoh: Cabang Praya',
    ui.ButtonSet.OK_CANCEL
  );
  if (cabangPrompt.getSelectedButton() !== ui.Button.OK) return;

  var cabang = cabangPrompt.getResponseText() || 'Cabang Praya';

  var dummy = {
    id: 'TEST-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'),
    cabang: cabang,
    wilayah: cabang.replace(/^Cabang\s+/i, ''),
    desa: '0000000000',
    namaPelanggan: 'Tes Pelanggan',
    noHp: '628000000000',
    jenisGangguan: 'Tes Notifikasi',
    prioritas: 'Sedang',
    status: 'Baru',
    keterangan: 'Ini hanya tes notifikasi petugas cabang.',
    catatan: 'Tes dari menu SIAGA TIARA.',
    linkMaps: '',
    lokasiDetail: 'Tes lokasi'
  };

  var result = notifyPetugasCabang_(dummy);

  ui.alert(
    result.terkirim > 0 ? '✅ Notifikasi petugas terkirim' : '⚠️ Notifikasi belum terkirim',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


function testNotifikasiPetugasCabang() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupPetugasCabangSheet(ss);

  var idPrompt = ui.prompt(
    'Tes Notifikasi Petugas',
    'Masukkan ID Aduan yang sudah ada. Contoh: PRY-20260510-0001',
    ui.ButtonSet.OK_CANCEL
  );
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;

  var id = extractAduanId_(idPrompt.getResponseText()) || idPrompt.getResponseText();
  var aduan = findAduanById_(id);

  if (!aduan) {
    ui.alert(
      '❌ ID tidak ditemukan',
      'ID tidak ada di sheet ADUAN: ' + id,
      ui.ButtonSet.OK
    );
    return;
  }

  var result = notifyPetugasCabang_(aduan);

  ui.alert(
    result.terkirim > 0 ? '✅ Tes notifikasi selesai' : '⚠️ Tidak ada notifikasi terkirim',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}

function normalizeCabangKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^cabang\s+/, '')
    .trim();
}



// ============================================================
// V10.9.7 - NOTIFIKASI PERUBAHAN STATUS KE PELANGGAN
// ============================================================

function setupStatusNotifLogSheet_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = CONFIG.STATUS_NOTIF_LOG_SHEET || 'LOG_NOTIF_STATUS';
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, 10).setValues([[
      'Timestamp',
      'ID Aduan',
      'No HP',
      'Status Lama',
      'Status Baru',
      'Window 24 Jam',
      'Hasil',
      'Alasan',
      'Waktu Chat Terakhir',
      'Detail'
    ]]);
  }

  sh.getRange(1, 1, 1, 10)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, 10); } catch(e) {}

  return sh;
}

function openStatusNotifLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupStatusNotifLogSheet_(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.STATUS_NOTIF_LOG_SHEET || 'LOG_NOTIF_STATUS'));
}

function logStatusNotif_(idAduan, phone, oldStatus, newStatus, windowOk, result, reason, lastInboundAt, detail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = setupStatusNotifLogSheet_(ss);

    sh.getRange(sh.getLastRow() + 1, 1, 1, 10).setValues([[
      new Date(),
      idAduan || '',
      normalizePhone_(phone || ''),
      oldStatus || '',
      newStatus || '',
      windowOk ? 'AKTIF' : 'TIDAK AKTIF',
      result || '',
      reason || '',
      lastInboundAt || '',
      truncateForLog_(detail || '', 1200)
    ]]);
  } catch(e) {}
}

function getLastInboundChatAt_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return null;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;

  var lastRow = sh.getLastRow();
  var checkRows = Math.min(lastRow - 1, 600);
  var startRow = Math.max(2, lastRow - checkRows + 1);
  var values = sh.getRange(startRow, 1, checkRows, 7).getValues();

  for (var i = values.length - 1; i >= 0; i--) {
    var rowPhone = normalizePhone_(values[i][1] || '');
    var pesanMasuk = String(values[i][2] || '').trim();
    var jenis = String(values[i][3] || '').trim();

    // LOG_WHATSAPP dicatat dari webhook masuk.
    // Tetap pastikan ada pesan masuk, bukan baris error kosong.
    if (rowPhone === phone && pesanMasuk && jenis !== 'EMPTY_WEBHOOK' && jenis !== 'DOPOST_ERROR') {
      var d = toSafeDate_(values[i][0]) || new Date(values[i][0]);
      if (d && !isNaN(d.getTime())) return d;
    }
  }

  return null;
}

function isWithinWhatsApp24hWindow_(phone) {
  var lastInbound = getLastInboundChatAt_(phone);
  if (!lastInbound) {
    return { ok: false, lastInboundAt: null, reason: 'Belum ada riwayat chat masuk dari nomor ini di LOG_WHATSAPP.' };
  }

  var windowHours = Number(CONFIG.STATUS_NOTIF_WINDOW_HOURS || 24);
  var diffHours = (new Date().getTime() - lastInbound.getTime()) / 3600000;

  if (diffHours <= windowHours) {
    return {
      ok: true,
      lastInboundAt: lastInbound,
      reason: 'Window 24 jam masih aktif. Chat terakhir sekitar ' + diffHours.toFixed(1) + ' jam lalu.'
    };
  }

  return {
    ok: false,
    lastInboundAt: lastInbound,
    reason: 'Window 24 jam sudah lewat. Chat terakhir sekitar ' + diffHours.toFixed(1) + ' jam lalu.'
  };
}

function buildCustomerStatusChangeMessage_(aduan, oldStatus, newStatus) {
  aduan = aduan || {};
  var statusText = String(newStatus || aduan.status || '').trim();
  var statusLower = statusText.toLowerCase();
  var idText = aduan.id || '-';

  if (statusLower === 'selesai') {
    return [
      '*Update Status Aduan SIAGA TIARA*',
      '',
      'ID Aduan: *' + idText + '*',
      'Status: *Selesai*',
      '',
      'Laporan Anda telah selesai ditindaklanjuti oleh petugas PERUMDAM Tirta Ardhia Rinjani.',
      '',
      'Terima kasih atas partisipasi Anda dalam membantu kami meningkatkan pelayanan air bersih.'
    ].join('\n');
  }

  if (statusLower === 'ditunda') {
    return [
      '*Update Status Aduan SIAGA TIARA*',
      '',
      'ID Aduan: *' + idText + '*',
      'Status: *Ditunda*',
      '',
      'Penanganan aduan Anda untuk sementara ditunda karena masih membutuhkan pengecekan atau koordinasi lebih lanjut.',
      '',
      'Aduan tetap tercatat di sistem dan akan dilanjutkan kembali setelah proses pengecekan selesai.',
      '',
      'Anda juga bisa melihat perkembangan aduan melalui menu Riwayat Aduan.'
    ].join('\n');
  }

  var progress = buildProgressTextForWa_(statusText || aduan.status || '');
  return [
    '*Update Status Aduan SIAGA TIARA*',
    '',
    'ID Aduan: *' + idText + '*',
    'Status: *' + (statusText || '-') + '*',
    'Tahap: ' + progress,
    '',
    'Anda juga bisa cek status kapan saja dengan mengirim ID aduan ini.'
  ].join('\n');
}

function notifyCustomerStatusChange_(aduan, oldStatus, newStatus, source) {
  aduan = aduan || {};
  var id = aduan.id || '';
  var phone = normalizePhone_(aduan.noHp || '');

  oldStatus = String(oldStatus || '').trim();
  newStatus = String(newStatus || aduan.status || '').trim();

  if (!id || !phone || !newStatus) {
    logStatusNotif_(id, phone, oldStatus, newStatus, false, 'SKIP', 'ID/No HP/Status kosong.', '', JSON.stringify(aduan || {}));
    return { success: true, skipped: true, reason: 'ID/No HP/Status kosong.' };
  }

  if (oldStatus && oldStatus.toLowerCase() === newStatus.toLowerCase()) {
    logStatusNotif_(id, phone, oldStatus, newStatus, true, 'SKIP', 'Status tidak berubah.', '', '');
    return { success: true, skipped: true, reason: 'Status tidak berubah.' };
  }

  var windowInfo = isWithinWhatsApp24hWindow_(phone);
  if (!windowInfo.ok) {
    logStatusNotif_(
      id,
      phone,
      oldStatus,
      newStatus,
      false,
      'TIDAK TERKIRIM',
      windowInfo.reason + ' Pelanggan bisa cek manual.',
      windowInfo.lastInboundAt || '',
      'Source: ' + (source || '-')
    );

    return {
      success: true,
      skipped: true,
      reason: windowInfo.reason,
      windowActive: false
    };
  }

  var message = buildCustomerStatusChangeMessage_(aduan, oldStatus, newStatus);
  var navButtons = buildNavButtons_('status');
  var sendResult = sendKiriminButtonMessage_(phone, message, navButtons);

  if (sendResult && sendResult.success) {
    logStatusNotif_(
      id,
      phone,
      oldStatus,
      newStatus,
      true,
      'TERKIRIM',
      windowInfo.reason,
      windowInfo.lastInboundAt || '',
      JSON.stringify(sendResult || {})
    );

    return {
      success: true,
      sent: true,
      windowActive: true,
      result: sendResult
    };
  }

  logStatusNotif_(
    id,
    phone,
    oldStatus,
    newStatus,
    true,
    'GAGAL KIRIM',
    (sendResult && (sendResult.error || sendResult.response)) || 'Gagal kirim pesan.',
    windowInfo.lastInboundAt || '',
    JSON.stringify(sendResult || {})
  );

  return {
    success: false,
    sent: false,
    windowActive: true,
    result: sendResult
  };
}

function notifyCustomerStatusChangeByRow_(sheet, rowNumber, oldStatus, newStatus, source) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  rowNumber = Number(rowNumber || 0);
  if (!sheet || rowNumber < 2) return { success: true, skipped: true, reason: 'Sheet/row tidak valid.' };

  var lastCol = Math.max(sheet.getLastColumn(), 20);
  var row = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];
  var aduan = parseAduanRowForTracking_(row);

  newStatus = String(newStatus || aduan.status || '').trim();
  oldStatus = String(oldStatus || '').trim();

  // Update timestamp perubahan status.
  try {
    if (CONFIG.COL.UPDATED_AT) sheet.getRange(rowNumber, CONFIG.COL.UPDATED_AT).setValue(new Date());
  } catch(e) {}

  // Kalau status selesai dan waktu selesai masih kosong, isi otomatis.
  try {
    if (newStatus.toLowerCase() === 'selesai' && CONFIG.COL.WAKTU_SELESAI && !row[CONFIG.COL.WAKTU_SELESAI - 1]) {
      sheet.getRange(rowNumber, CONFIG.COL.WAKTU_SELESAI).setValue(new Date());
      aduan.waktuSelesai = formatDateForWa_(new Date());
    }
  } catch(e) {}

  aduan.status = newStatus;
  return notifyCustomerStatusChange_(aduan, oldStatus, newStatus, source || 'EDIT_SHEET');
}

function handleAduanStatusEditTrigger(e) {
  try {
    if (!e || !e.range) return;

    var range = e.range;
    var sheet = range.getSheet();
    if (!sheet || sheet.getName() !== CONFIG.SHEET_NAME) return;

    var statusCol = CONFIG.COL.STATUS || 10;
    var startCol = range.getColumn();
    var endCol = startCol + range.getNumColumns() - 1;
    if (statusCol < startCol || statusCol > endCol) return;

    var startRow = range.getRow();
    var numRows = range.getNumRows();
    if (startRow < 2) return;

    // Untuk edit satu sel, e.oldValue tersedia.
    // Untuk paste banyak baris, oldValue biasanya kosong; tetap dicatat sebagai perubahan massal.
    for (var r = startRow; r < startRow + numRows; r++) {
      if (r < 2) continue;

      var newStatus = String(sheet.getRange(r, statusCol).getValue() || '').trim();
      var oldStatus = (numRows === 1 && range.getNumColumns() === 1) ? String(e.oldValue || '').trim() : '';

      if (!newStatus) continue;
      if (oldStatus && oldStatus.toLowerCase() === newStatus.toLowerCase()) continue;

      // Pastikan sheet cabang ikut update jika status diedit langsung dari ADUAN.
      try { syncAduanRowToCabangMirror_(sheet, r); } catch(syncErr) {}

      notifyCustomerStatusChangeByRow_(sheet, r, oldStatus, newStatus, 'ON_EDIT_STATUS');
    }

  } catch(err) {
    try {
      logStatusNotif_('-', '-', '-', '-', false, 'ERROR_TRIGGER', err.message || String(err), '', err.stack || '');
    } catch(e2) {}
  }
}

function installStatusNotificationTrigger() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  setupStatusNotifLogSheet_(ss);

  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'handleAduanStatusEditTrigger') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('handleAduanStatusEditTrigger')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ui.alert(
    '✅ Trigger notifikasi status aktif',
    'Mulai sekarang, jika kolom Status di sheet ADUAN diedit manual, sistem akan mencoba mengirim notifikasi ke pelanggan hanya jika window 24 jam masih aktif.\n\nJika window sudah lewat, sistem hanya mencatat ke LOG_NOTIF_STATUS.',
    ui.ButtonSet.OK
  );
}

function testCustomerStatusNotificationById() {
  var ui = SpreadsheetApp.getUi();
  var idPrompt = ui.prompt(
    'Tes Notifikasi Status Pelanggan',
    'Masukkan ID Aduan. Contoh: PRY-20260510-0002',
    ui.ButtonSet.OK_CANCEL
  );
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;

  var id = idPrompt.getResponseText().trim();
  var aduan = findAduanById_(id);
  if (!aduan) {
    ui.alert('ID tidak ditemukan.');
    return;
  }

  var statusPrompt = ui.prompt(
    'Tes Notifikasi Status Pelanggan',
    'Masukkan status baru untuk simulasi.\nContoh: Proses / Selesai / Ditunda',
    ui.ButtonSet.OK_CANCEL
  );
  if (statusPrompt.getSelectedButton() !== ui.Button.OK) return;

  var result = notifyCustomerStatusChange_(aduan, aduan.status, statusPrompt.getResponseText().trim(), 'TEST_MANUAL');

  ui.alert(
    result.sent ? '✅ Notifikasi terkirim' : (result.skipped ? '⚠️ Notifikasi tidak dikirim' : '❌ Gagal kirim'),
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}

function cekWindow24JamPelangganById() {
  var ui = SpreadsheetApp.getUi();
  var idPrompt = ui.prompt(
    'Cek Window 24 Jam Pelanggan',
    'Masukkan ID Aduan.',
    ui.ButtonSet.OK_CANCEL
  );
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;

  var aduan = findAduanById_(idPrompt.getResponseText().trim());
  if (!aduan) {
    ui.alert('ID tidak ditemukan.');
    return;
  }

  var info = isWithinWhatsApp24hWindow_(aduan.noHp);

  ui.alert(
    info.ok ? '✅ Window 24 jam masih aktif' : '⚠️ Window 24 jam tidak aktif',
    'No HP: ' + aduan.noHp + '\n' +
    'Chat terakhir: ' + (info.lastInboundAt ? formatDateForWa_(info.lastInboundAt) : '-') + '\n' +
    'Alasan: ' + info.reason,
    ui.ButtonSet.OK
  );
}


function setupWhatsAppLogSheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.WHATSAPP_LOG_SHEET);

  var __fastKey = sh ? getSheetRuntimeKey_('LOG_SETUP_FAST_V1096', sh) : '';
  if (isSiagaFastMode_() && __fastKey && cacheGet_(__fastKey)) return sh;

  if (sh.getLastRow() === 0 || !sh.getRange(1, 1).getValue()) {
    sh.getRange(1, 1, 1, 8).setValues([[ 
      'Timestamp', 'No HP', 'Pesan Masuk', 'Jenis', 'ID Aduan', 'Balasan', 'Status Kirim', 'Raw Payload'
    ]]);
  }

  sh.getRange(1, 1, 1, 8)
    .setBackground('#0f3b5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 8);
  if (__fastKey) cachePut_(__fastKey, '1', 21600);

}

function openWhatsAppLog() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupWhatsAppLogSheet(ss);
  ss.setActiveSheet(ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET));
}

function setWhatsAppApiConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var endpointPrompt = ui.prompt(
    '1/3 - Endpoint Kirim Pesan Kirimin ID',
    'Isi ini:\nhttps://apiapp.kirimin.id/api/v1/public/messages/send',
    ui.ButtonSet.OK_CANCEL
  );
  if (endpointPrompt.getSelectedButton() !== ui.Button.OK) return;

  var tokenPrompt = ui.prompt(
    '2/3 - API Key Kirimin ID',
    'Tempel API key kamu.\n\nContoh: kc_live_xxxxx',
    ui.ButtonSet.OK_CANCEL
  );
  if (tokenPrompt.getSelectedButton() !== ui.Button.OK) return;

  var devicePrompt = ui.prompt(
    '3/3 - WhatsApp Device ID',
    'Isi Device ID dari List WhatsApp Devices.\n\nUntuk akun kamu:\ncmoz14qey0s3ny6yjoi9gt2n7',
    ui.ButtonSet.OK_CANCEL
  );
  if (devicePrompt.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty('WHATSAPP_PROVIDER', 'KIRIMIN_ID');
  props.setProperty('WHATSAPP_API_ENDPOINT', endpointPrompt.getResponseText().trim());
  props.setProperty('WHATSAPP_API_TOKEN', tokenPrompt.getResponseText().trim());
  props.setProperty('WHATSAPP_DEVICE_ID', devicePrompt.getResponseText().trim());

  props.setProperty('WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT', 'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}');
  props.setProperty('WHATSAPP_INTERACTIVE_ENDPOINT', endpointPrompt.getResponseText().trim());
  props.setProperty('WHATSAPP_USE_INTERACTIVE_MENU', 'YA');
  props.setProperty('WHATSAPP_REPLY_MODE', 'AUTO');

  ui.alert(
    '✅ Konfigurasi WhatsApp tersimpan',
    'Selesai. Menu utama akan mencoba List Menu WhatsApp lewat endpoint utama /messages/send. Jika ditolak, sistem fallback ke menu teks.',
    ui.ButtonSet.OK
  );
}

function testWhatsAppStatusReply() {
  var ui = SpreadsheetApp.getUi();
  var phone = ui.prompt('Tes WhatsApp', 'Masukkan nomor HP tujuan, contoh: 6281234567890', ui.ButtonSet.OK_CANCEL);
  if (phone.getSelectedButton() !== ui.Button.OK) return;

  var q = ui.prompt('Tes WhatsApp', 'Masukkan ID Aduan atau No HP pelanggan yang ada di sheet ADUAN.', ui.ButtonSet.OK_CANCEL);
  if (q.getSelectedButton() !== ui.Button.OK) return;

  var res = getAduanTrackingResponse_(q.getResponseText(), phone.getResponseText());
  var send = sendWhatsAppMessage_(phone.getResponseText(), res.reply);

  ui.alert(
    send.success ? '✅ Tes terkirim' : '⚠ Balasan dibuat, tapi pengiriman gagal',
    'Balasan:\n\n' + res.reply + '\n\nStatus kirim: ' + (send.success ? 'OK' : send.error),
    ui.ButtonSet.OK
  );
}

function handleWhatsAppWebhook_(e) {
  var raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
  var payload = parseIncomingPayload_(raw, e);
  var phone = normalizePhone_(payload.phone || '');
  var customerId = String(payload.customerId || '').trim();
  var message = String(payload.message || '').trim();

  if (!message && !phone && !customerId) {
    logWhatsApp_('-', raw, 'EMPTY_WEBHOOK', '-', 'SKIP', raw);
    return { success: true, skipped: true, reason: 'empty payload' };
  }

  // Untuk session, nomor HP lebih ideal. Jika webhook belum memberi phone,
  // fallback pakai customer_id agar alur chat tetap berjalan.
  var sessionKey = phone || customerId;
  var result = getWhatsAppMenuResponse_(message, sessionKey, payload);
  if (result && result.reply) {
    result.reply = maybeAppendBusinessHoursNotice_(result.reply, result.type);
  }
  var sendResult = { success: true, skipped: true };

  var mode = getRuntimeProp_('WHATSAPP_REPLY_MODE') || CONFIG.WHATSAPP_DEFAULT_REPLY_MODE || 'AUTO';
  if (mode === 'AUTO' && (customerId || phone) && result.reply) {
    var pengumumanAwal = getPengumumanForMenu_(result, phone || sessionKey);
    var pengumumanSendResult = null;

    if (pengumumanAwal && phone) {
      pengumumanSendResult = sendWhatsAppMessage_(phone, pengumumanAwal, {
        customerId: customerId,
        channel: payload.channel,
        whatsappDeviceId: payload.whatsappDeviceId
      });
      // [V10.9.44] Removed Utilities.sleep(500) - tidak perlu delay, memperlambat respons 500ms
    }

    if (shouldUseInteractiveMenu_() && result.jenisMenu && phone) {
      sendResult = sendKiriminJenisGangguanMenu_(phone);

      if (!sendResult.success) {
        var jenisMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply + '\n\n' + buildJenisGangguanMenu_(), {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.jenisMenuFallbackError = jenisMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && result.type === 'ASK_CABANG' && phone) {
      sendResult = sendKiriminCabangMenu_(phone, result.page || 1);

      if (!sendResult.success) {
        var cabangInteractiveError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.interactiveFallbackError = cabangInteractiveError;
      }

    } else if (shouldUseInteractiveMenu_() && result.infoLayananMenu && phone) {
      sendResult = sendKiriminInfoLayananMenu_(phone);

      if (!sendResult.success) {
        var infoLayananMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.infoLayananMenuFallbackError = infoLayananMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && result.riwayatMenu && phone) {
      sendResult = sendKiriminRiwayatAduanMenu_(phone, result.riwayatList || []);

      if (!sendResult.success) {
        var riwayatMenuError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.riwayatMenuFallbackError = riwayatMenuError;
      }

    } else if (shouldUseInteractiveMenu_() && isNavButtonEligible_(result) && phone) {
      sendResult = sendKiriminButtonMessage_(phone, result.reply, result.navButtons);

      if (!sendResult.success) {
        var buttonError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply + '\n\nBalas *menu* untuk kembali ke menu utama.', {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.buttonFallbackError = buttonError;
      }

    } else if (shouldUseInteractiveMenu_() && isMainMenuReply_(result.reply) && phone) {
      sendResult = sendKiriminInteractiveMenu_(phone, {
        customerId: customerId,
        customerPhone: phone,
        channel: payload.channel,
        whatsappDeviceId: payload.whatsappDeviceId
      });

      if (!sendResult.success) {
        var interactiveError = sendResult.error || sendResult.response || JSON.stringify(sendResult);
        sendResult = sendWhatsAppMessage_(phone, result.reply, {
          customerId: customerId,
          channel: payload.channel,
          whatsappDeviceId: payload.whatsappDeviceId
        });
        sendResult.interactiveFallbackError = interactiveError;
      }

    } else {
      sendResult = sendWhatsAppMessage_(phone, result.reply, {
        customerId: customerId,
        channel: payload.channel,
        whatsappDeviceId: payload.whatsappDeviceId
      });
    }
  }

  if (pengumumanSendResult) {
    try {
      sendResult.pengumumanAwal = pengumumanSendResult;
    } catch(e) {}
  }

  logWhatsApp_(
    phone || customerId,
    message,
    result.type || 'MENU',
    result.id || '-',
    result.reply,
    (result.reply ? (sendResult.success ? 'SENT' : ('FAILED: ' + sendResult.error)) : 'NO_REPLY_ADMIN_HANDOFF'),
    raw
  );

  return {
    success: true,
    phone: phone,
    customerId: customerId,
    message: message,
    type: result.type || 'MENU',
    id: result.id || '',
    reply: result.reply,
    send: sendResult
  };
}

function parseIncomingPayload_(raw, e) {
  var obj = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch (err) {
    obj = {};
  }

  var data = obj.data || {};

  var phone = data.customer_phone ||
              data.phone ||
              data.from ||
              obj.customer_phone ||
              obj.phone ||
              obj.from ||
              '';

  var message = data.content ||
                data.text ||
                data.body ||
                data.message ||
                obj.content ||
                obj.text ||
                obj.body ||
                obj.message ||
                '';

  // Reply dari List Menu / Button Interactive.
  var interactiveId =
    data.list_reply_id ||
    data.button_reply_id ||
    data.reply_id ||
    data.selected_id ||
    data.interactive_id ||
    (data.content && data.content.id) ||
    (data.content && data.content.reply && data.content.reply.id) ||
    (data.interactive && data.interactive.list_reply && data.interactive.list_reply.id) ||
    (data.interactive && data.interactive.button_reply && data.interactive.button_reply.id) ||
    (data.list_reply && data.list_reply.id) ||
    (data.button_reply && data.button_reply.id) ||
    '';

  var interactiveTitle =
    data.list_reply_title ||
    data.button_reply_title ||
    data.reply_title ||
    data.selected_title ||
    (data.content && data.content.title) ||
    (data.content && data.content.reply && data.content.reply.title) ||
    (data.interactive && data.interactive.list_reply && data.interactive.list_reply.title) ||
    (data.interactive && data.interactive.button_reply && data.interactive.button_reply.title) ||
    '';

  if (interactiveId) {
    message = mapInteractiveIdToMenuChoice_(interactiveId) || interactiveTitle || interactiveId;
  } else if (interactiveTitle) {
    message = normalizeIncomingListMenuChoice_(interactiveTitle) || interactiveTitle;
  }

  var customerId = data.customer_id ||
                   (data.customer && data.customer.id) ||
                   obj.customer_id ||
                   (obj.customer && obj.customer.id) ||
                   '';

  var channel = obj.channel || data.channel || 'whatsapp';

  var whatsappDeviceId = data.whatsapp_device_id ||
                         data.device_id ||
                         data.channel_id ||
                         obj.whatsapp_device_id ||
                         obj.device_id ||
                         obj.channel_id ||
                         '';

  if (!phone || !message || !customerId) {
    var candidates = [
      obj,
      obj.data || {},
      obj.message || {},
      obj.customer || {},
      obj.payload || {},
      obj.event || {},
      obj.data && obj.data.message ? obj.data.message : {},
      obj.data && obj.data.customer ? obj.data.customer : {}
    ];

    function first(keys) {
      for (var i = 0; i < candidates.length; i++) {
        for (var j = 0; j < keys.length; j++) {
          var v = deepGet_(candidates[i], keys[j]);
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
      }
      return '';
    }

    phone = phone || first([
      'phone', 'from', 'sender', 'sender_phone', 'customer_phone',
      'wa_id', 'number', 'msisdn', 'contact.phone', 'customer.phone',
      'data.customer_phone', 'data.customer.phone'
    ]);

    message = message || first([
      'message', 'text', 'body', 'content', 'caption',
      'message.text', 'message.body', 'message.content',
      'data.message', 'data.text', 'data.body', 'data.content',
      'data.message.text', 'data.message.body', 'data.message.content'
    ]);

    customerId = customerId || first([
      'customer_id', 'customer.id', 'data.customer_id', 'data.customer.id',
      'message.customer_id', 'payload.customer_id'
    ]);
  }

  var location = extractLocationFromPayload_(obj);

  if (typeof message === 'object') {
    if (message.id) message = mapInteractiveIdToMenuChoice_(message.id) || message.title || message.id;
    else if (message.text) message = message.text;
    else if (message.body) message = message.body;
    else if (message.content) message = message.content;
    else if (message.latitude && message.longitude) {
      location = normalizeLocationObject_(message) || location;
      message = '[LOKASI_WHATSAPP]';
    }
    else message = JSON.stringify(message);
  }

  if (!message && location && location.latitude && location.longitude) {
    message = '[LOKASI_WHATSAPP]';
  }

  return {
    phone: normalizePhone_(phone),
    message: String(message || '').trim(),
    customerId: String(customerId || '').trim(),
    channel: String(channel || ''),
    whatsappDeviceId: String(whatsappDeviceId || ''),
    location: location,
    rawObject: obj
  };
}


function normalizeIncomingListMenuChoice_(text) {
  text = String(text || '').toLowerCase();

  // Bersihkan format teks yang kadang dikirim WA/Kirimin dari List Menu.
  text = text
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  // V10.9.32:
  // Detail "Sambung Kembali" harus dicek sebelum tombol umum "Kembali".
  // Kalau tidak, kata "kembali" di "Sambung Kembali" akan dianggap tombol kembali.
  if (text.indexOf('sambung kembali') !== -1) {
    return 'sambung kembali';
  }

  if (
    text.indexOf('sambungan pindah') !== -1 ||
    text.indexOf('sambungan pemindahan') !== -1 ||
    text.indexOf('pemindahan meter') !== -1 ||
    text.indexOf('alur sambungan pemindahan') !== -1
  ) {
    return 'sambungan pemindahan meter air';
  }

  if (text.indexOf('menu utama') !== -1 || text === 'menu' || text === 'home') {
    return 'menu';
  }

  if (text === '↩ kembali' || text.indexOf('↩ kembali') !== -1 || text === 'kembali' || text.indexOf('kembali') !== -1) {
    return 'kembali';
  }

  if (text.indexOf('cek tiket') !== -1 || text.indexOf('tiket ini') !== -1) {
    return 'cek tiket ini';
  }

  if (text.indexOf('cek lagi') !== -1) {
    return '2';
  }

  // List menu SIAGA TIARA.
  if (
    text.indexOf('buat aduan') !== -1 ||
    text.indexOf('aduan baru') !== -1 ||
    text.indexOf('laporkan gangguan') !== -1 ||
    text.indexOf('lapor gangguan') !== -1
  ) {
    return '1';
  }

  if (
    text.indexOf('cek status') !== -1 ||
    text.indexOf('status aduan') !== -1 ||
    text.indexOf('cek progres') !== -1 ||
    text.indexOf('progres berdasarkan id') !== -1
  ) {
    return '2';
  }

  if (
    text.indexOf('lihat aduan') !== -1 ||
    text.indexOf('riwayat') !== -1 ||
    text.indexOf('aduan saya') !== -1 ||
    text.indexOf('daftar aduan') !== -1 ||
    text.indexOf('nomor whatsapp ini') !== -1
  ) {
    return '3';
  }

  // V10.9.31 - Detail Info Layanan harus dicek dulu sebelum menu induk.
  if (text.indexOf('cara bayar') !== -1 || text.indexOf('panduan pembayaran tagihan') !== -1) return 'cara bayar';
  if (
    text.indexOf('kendala bayar') !== -1 ||
    text.indexOf('kendala pembayaran') !== -1 ||
    text.indexOf('sudah bayar/status') !== -1 ||
    text.indexOf('status belum berubah') !== -1 ||
    text.indexOf('sudah bayar') !== -1
  ) return 'kendala pembayaran';

  if (text.indexOf('air tangki') !== -1) return 'air tangki';
  if (text.indexOf('balik nama') !== -1) return 'balik nama';
  if (
    text.indexOf('sambungan pindah') !== -1 ||
    text.indexOf('sambungan pemindahan') !== -1 ||
    text.indexOf('pemindahan meter') !== -1
  ) return 'sambungan pemindahan meter air';
  if (text.indexOf('pindah meter') !== -1) return 'pindah meter air';
  if (text.indexOf('sambung kembali') !== -1) return 'sambung kembali';

  if (
    text.indexOf('info layanan') !== -1 ||
    text.indexOf('info pembayaran') !== -1 ||
    text.indexOf('pembayaran') !== -1
  ) {
    return 'info pembayaran';
  }

  if (
    text.indexOf('hubungi admin') !== -1 ||
    text.indexOf('customer support') !== -1 ||
    text.indexOf('chat manual') !== -1 ||
    text.indexOf('admin/petugas') !== -1
  ) {
    return 'hubungi admin';
  }

  return '';
}

function mapInteractiveIdToMenuChoice_(id) {
  id = String(id || '').toUpperCase().trim();

  // V10.9.14 - tombol "Cek Tiket Ini" langsung membawa ID aduan yang baru dibuat.
  if (id.indexOf('CEK_TIKET_') === 0) {
    return id.substring('CEK_TIKET_'.length);
  }
  if (id === 'CEK_TIKET_INI' || id === 'CEK_TIKET') {
    return 'cek tiket ini';
  }

  var map = {
    'MENU_1_ADUAN': '1',
    'MENU_ADUAN_BARU': '1',
    'BUAT_ADUAN': '1',
    'ADUAN_BARU': '1',
    'ROW_ADUAN': '1',
    'ROW_ORDER': '2',

    'MENU_2_STATUS': '2',
    'MENU_CEK_STATUS': '2',
    'CEK_STATUS': '2',
    'ROW_STATUS': '2',

    'MENU_3_ADUAN_SAYA': '3',
    'MENU_LIHAT_ADUAN': '3',
    'ADUAN_SAYA': '3',
    'ROW_ADUAN_SAYA': '3',

    'MENU_4_ADMIN': 'info pembayaran',
    'MENU_4_INFO_PEMBAYARAN': 'info pembayaran',
    'INFO_PEMBAYARAN': 'info pembayaran',
    'PAY_INFO': 'info pembayaran',
    'PAY_CARA_BAYAR': 'cara bayar',
    'PAY_KENDALA_BAYAR': 'kendala pembayaran',
    'PAY_AIR_TANGKI': 'air tangki',
    'PAY_BALIK_NAMA': 'balik nama',
    'PAY_PINDAH_METER': 'pindah meter air',
    'PAY_SAMBUNG_KEMBALI': 'sambung kembali',
    'PAY_SAMBUNG_PINDAH': 'sambungan pemindahan meter air',
    'PAY_ADMIN': 'hubungi admin',
    'NAV_MENU': 'menu',
    'NAV_BACK_STATUS': '2',
    'NAV_BACK': 'menu',

    // V10.9.13 - tombol kontrol proses input aduan
    'ADUAN_CANCEL': 'batal',
    'ADUAN_BACK': '__ADUAN_BACK__',

    'MENU_HUBUNGI_ADMIN': '4',
    'HUBUNGI_ADMIN': '4',
    'ROW_SUPPORT': '4',
    'BUAT_ADUAN_BARU': '1',
    'CEK_STATUS_ADUAN': '2',
    'LIHAT_ADUAN_SAYA': '3',
    'HUBUNGI_ADMIN_PETUGAS': '4'
  };
  return map[id] || '';
}

function deepGet_(obj, path) {
  if (!obj || !path) return undefined;
  var parts = String(path).split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function normalizePhone_(phone) {
  phone = String(phone || '').trim();
  phone = phone.replace(/@c\.us|@s\.whatsapp\.net|@g\.us/gi, '');
  phone = phone.replace(/[^0-9+]/g, '');
  if (phone.indexOf('+') === 0) phone = phone.substring(1);
  if (phone.indexOf('08') === 0) phone = '62' + phone.substring(1);
  if (phone.indexOf('8') === 0) phone = '62' + phone;
  return phone;
}

function normalizeId_(id) {
  return String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}


function sendWhatsAppMessage_(phone, message, options) {
  options = options || {};
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') || '';
  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var provider = props.getProperty('WHATSAPP_PROVIDER') || CONFIG.WHATSAPP_PROVIDER || 'KIRIMIN_ID';
  var deviceId = options.whatsappDeviceId || props.getProperty('WHATSAPP_DEVICE_ID') || CONFIG.WHATSAPP_DEVICE_ID || '';
  var customerId = options.customerId || '';

  if (!endpoint || !token) {
    return { success: false, error: 'Endpoint/API token WhatsApp belum diset.' };
  }

  var body;
  var resolveInfo = null;

  if (provider === 'KIRIMIN_ID') {
    if (!customerId) {
      // V10.9.6:
      // Untuk Kirimin ID, kirim langsung via phone_number lebih cepat daripada lookup customer_id.
      var directByPhone = sendKiriminTextByPhoneNumber_(phone, message);
      directByPhone.fastMode = true;
      directByPhone.via = directByPhone.via || 'phone_number_direct';
      return directByPhone;
    }

    if (!deviceId) {
      return {
        success: false,
        error: 'whatsapp_device_id belum diset. Jalankan menu Simpan Konfigurasi API WhatsApp.'
      };
    }

    body = {
      channel: 'whatsapp',
      whatsapp_device_id: deviceId,
      customer_id: customerId,
      message_type: 'text',
      content: String(message || '')
    };

  } else {
    var phoneField = props.getProperty('WHATSAPP_PHONE_FIELD') || 'phone';
    var messageField = props.getProperty('WHATSAPP_MESSAGE_FIELD') || 'message';
    body = {};
    body[phoneField] = normalizePhone_(phone);
    body[messageField] = String(message || '');
  }

  try {
    var res = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(body)
    });

    var statusCode = res.getResponseCode();
    var text = res.getContentText();

    if (statusCode >= 200 && statusCode < 300) {
      return { success: true, statusCode: statusCode, response: text, requestBody: body, resolveInfo: resolveInfo };
    }

    return { success: false, statusCode: statusCode, error: text, requestBody: body, resolveInfo: resolveInfo };

  } catch (err) {
    return { success: false, error: err.message, requestBody: body, resolveInfo: resolveInfo };
  }
}

function resolveKiriminCustomerIdByPhone_(phone) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var rawPhone = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!rawPhone) return { success: false, error: 'Nomor HP kosong dari webhook.' };

  var endpointPattern = props.getProperty('WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT') ||
    CONFIG.WHATSAPP_CUSTOMER_BY_PHONE_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}';

  var phoneVariants = buildPhoneVariantsForKirimin_(rawPhone);
  var endpointVariants = buildCustomerByPhoneEndpointVariants_(endpointPattern, phoneVariants);
  var lastError = '';

  for (var i = 0; i < endpointVariants.length; i++) {
    var url = endpointVariants[i];

    try {
      var res = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json'
        }
      });

      var statusCode = res.getResponseCode();
      var text = res.getContentText();
      var obj = parseJsonSafe_(text);
      var customerId = extractCustomerIdFromKiriminResponse_(obj);

      if (statusCode >= 200 && statusCode < 300 && customerId) {
        return { success: true, customerId: customerId, url: url, statusCode: statusCode, raw: text };
      }

      lastError = 'HTTP ' + statusCode + ' ' + text;

    } catch (err) {
      lastError = err.message;
    }
  }

  return {
    success: false,
    error: lastError || 'Tidak ada customer_id dari semua endpoint percobaan.',
    tried: endpointVariants,
    phone: rawPhone
  };
}

function buildPhoneVariantsForKirimin_(phone) {
  phone = normalizePhone_(phone || '');
  var list = [];
  var seen = {};

  function add(v) {
    v = String(v || '').trim();
    if (v && !seen[v]) {
      seen[v] = true;
      list.push(v);
    }
  }

  add(phone);
  add('+' + phone);
  if (phone.indexOf('62') === 0) add('0' + phone.substring(2));
  return list;
}

function buildCustomerByPhoneEndpointVariants_(pattern, phones) {
  var list = [];
  var seen = {};

  function add(url) {
    url = String(url || '').trim();
    if (url && !seen[url]) {
      seen[url] = true;
      list.push(url);
    }
  }

  pattern = String(pattern || '').trim();
  if (!pattern) pattern = 'https://apiapp.kirimin.id/api/v1/public/customers/phone/{phone}';

  phones.forEach(function(p) {
    var encoded = encodeURIComponent(p);
    add(pattern.replace('{phone}', encoded));
    add('https://apiapp.kirimin.id/api/v1/public/customers/phone/' + encoded);
    add('https://apiapp.kirimin.id/api/v1/public/customers/by-phone/' + encoded);
    add('https://apiapp.kirimin.id/api/v1/public/customers?phone=' + encoded);
    add('https://apiapp.kirimin.id/api/v1/public/customers?customer_phone=' + encoded);
  });

  return list;
}

function extractCustomerIdFromKiriminResponse_(obj) {
  if (!obj) return '';

  var candidates = [
    obj.customer_id,
    obj.id,
    obj.data && obj.data.customer_id,
    obj.data && obj.data.id,
    obj.data && obj.data.customer && obj.data.customer.id,
    obj.customer && obj.customer.id,
    obj.result && obj.result.id,
    obj.result && obj.result.customer_id
  ];

  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i]) return String(candidates[i]);
  }

  if (Array.isArray(obj.data) && obj.data.length) {
    for (var j = 0; j < obj.data.length; j++) {
      var item = obj.data[j] || {};
      if (item.id) return String(item.id);
      if (item.customer_id) return String(item.customer_id);
    }
  }

  if (obj.data && Array.isArray(obj.data.customers) && obj.data.customers.length) {
    for (var k = 0; k < obj.data.customers.length; k++) {
      var c = obj.data.customers[k] || {};
      if (c.id) return String(c.id);
      if (c.customer_id) return String(c.customer_id);
    }
  }

  return '';
}

function testKiriminResolveCustomerByPhone() {
  var ui = SpreadsheetApp.getUi();
  var phonePrompt = ui.prompt(
    'Tes Kirimin ID - Cari customer_id dari No HP',
    'Masukkan nomor HP pelanggan. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (phonePrompt.getSelectedButton() !== ui.Button.OK) return;

  var result = resolveKiriminCustomerIdByPhone_(phonePrompt.getResponseText());

  ui.alert(
    result.success ? '✅ customer_id ditemukan' : '❌ customer_id belum ditemukan',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}

function testKiriminSendMessage() {
  var ui = SpreadsheetApp.getUi();

  var targetPrompt = ui.prompt(
    'Tes Kirimin ID - customer_id / No HP',
    'Masukkan customer_id dari payload webhook.\n\nJika belum punya customer_id, boleh isi nomor HP pelanggan.\nContoh nomor: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetPrompt.getSelectedButton() !== ui.Button.OK) return;

  var msgPrompt = ui.prompt(
    'Tes Kirimin ID - Pesan',
    'Masukkan isi pesan tes:',
    ui.ButtonSet.OK_CANCEL
  );
  if (msgPrompt.getSelectedButton() !== ui.Button.OK) return;

  var target = targetPrompt.getResponseText().trim();
  var isLikelyPhone = /^(\+?62|0)\d{8,15}$/.test(target);

  var result = sendWhatsAppMessage_(isLikelyPhone ? target : '', msgPrompt.getResponseText(), {
    customerId: isLikelyPhone ? '' : target
  });

  ui.alert(
    result.success ? '✅ Berhasil' : '❌ Gagal',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


// ============================================================
// V8.6 - WhatsApp Interactive Menu / List Button
// ============================================================

function shouldUseInteractiveMenu_() {
  // V10.9.11: cache hasil per eksekusi - tidak perlu buka PropertiesService 5x
  if (_interactiveMenuFlag !== null) return _interactiveMenuFlag;
  var v = getRuntimeProp_('WHATSAPP_USE_INTERACTIVE_MENU') || CONFIG.WHATSAPP_USE_INTERACTIVE_MENU || 'YA';
  _interactiveMenuFlag = String(v).toUpperCase() === 'YA';
  return _interactiveMenuFlag;
}

function isMainMenuReply_(reply) {
  reply = String(reply || '');
  return reply.indexOf('PERUMDAM Tirta Ardhia Rinjani') !== -1 &&
         (
           reply.indexOf('Buat aduan') !== -1 ||
           reply.indexOf('Buat Aduan') !== -1 ||
           reply.indexOf('Silakan pilih layanan') !== -1
         );
}


// ============================================================
// V10.9.33 - PENGUMUMAN LAYANAN SEBELUM MENU UTAMA
// ============================================================

function setupPengumumanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var headers = ['STATUS', 'JUDUL', 'ISI', 'MULAI', 'SELESAI', 'URUTAN'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 90);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(3, 520);
  sh.setColumnWidth(4, 120);
  sh.setColumnWidth(5, 120);
  sh.setColumnWidth(6, 80);

  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, 1, 6).setValues([[
      'NONAKTIF',
      'Contoh Pengumuman',
      'Isi pengumuman ditulis di sini. Ubah STATUS menjadi AKTIF agar tampil sebelum menu utama.',
      '',
      '',
      1
    ]]);
  }

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Sheet Pengumuman siap',
      'Isi sheet PENGUMUMAN lalu ubah STATUS menjadi AKTIF.\n\nKolom:\nSTATUS | JUDUL | ISI | MULAI | SELESAI | URUTAN',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch(e) {}
}

function openPengumumanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    setupPengumumanSheet();
    sh = ss.getSheetByName(sheetName);
  }
  ss.setActiveSheet(sh);
}

function parsePengumumanDate_(value, endOfDay) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    var d0 = new Date(value.getTime());
    if (endOfDay) d0.setHours(23, 59, 59, 999);
    else d0.setHours(0, 0, 0, 0);
    return d0;
  }

  var text = String(value || '').trim();
  if (!text) return null;

  var d = new Date(text);
  if (isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function getActivePengumuman_() {
  var cacheKey = 'SIAGA_ACTIVE_PENGUMUMAN_V10933';
  var cached = cacheGet_(cacheKey);
  if (cached) {
    try {
      var obj = JSON.parse(cached);
      if (obj && obj.message) return obj;
      if (obj && obj.none) return null;
    } catch(e) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = CONFIG.PENGUMUMAN_SHEET || 'PENGUMUMAN';
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) {
    cachePut_(cacheKey, JSON.stringify({ none: true }), 300);
    return null;
  }

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  var now = new Date();
  var active = [];

  var expiredRows = [];
  var autoNonaktif = String(CONFIG.PENGUMUMAN_AUTO_NONAKTIF_EXPIRED || 'YA').toUpperCase() === 'YA';

  values.forEach(function(row, idx) {
    var status = String(row[0] || '').trim().toUpperCase();
    var judul = String(row[1] || '').trim();
    var isi = String(row[2] || '').trim();
    var mulai = parsePengumumanDate_(row[3], false);
    var selesai = parsePengumumanDate_(row[4], true);
    var urutan = Number(row[5] || 999);

    if (!isi) return;
    if (['AKTIF', 'YA', 'ON', 'TRUE', '1'].indexOf(status) === -1) return;
    if (mulai && now < mulai) return;

    // V10.9.35:
    // Jika tanggal selesai sudah lewat, pengumuman tidak tampil.
    // Bila autoNonaktif aktif, STATUS di sheet ikut diubah menjadi NONAKTIF.
    if (selesai && now > selesai) {
      if (autoNonaktif) expiredRows.push(idx + 2); // data mulai dari baris 2
      return;
    }

    active.push({
      judul: judul,
      isi: isi,
      urutan: urutan
    });
  });

  if (expiredRows.length) {
    expiredRows.forEach(function(rowNumber) {
      try { sh.getRange(rowNumber, 1).setValue('NONAKTIF'); } catch(e) {}
    });
  }

  if (!active.length) {
    cachePut_(cacheKey, JSON.stringify({ none: true }), 300);
    return null;
  }

  active.sort(function(a, b) {
    return (a.urutan || 999) - (b.urutan || 999);
  });

  var item = active[0];
  var lines = ['📢 *Pengumuman Layanan*', ''];
  if (item.judul) lines.push('*' + item.judul + '*', '');
  lines.push(item.isi);

  var message = lines.join('\n');
  var result = {
    message: message,
    key: Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, message)).substring(0, 16)
  };

  cachePut_(cacheKey, JSON.stringify(result), 300);
  return result;
}

function shouldAttachPengumumanBeforeMenu_(result) {
  if (!result || !result.reply) return false;

  var type = String(result.type || '');
  if (type !== 'MAIN_MENU' && type !== 'MAIN_MENU_FALLBACK') return false;

  // Hanya untuk menu utama full list, bukan detail layanan atau pesan status.
  return isMainMenuReply_(result.reply);
}

function getPengumumanForMenu_(result, phone) {
  if (!shouldAttachPengumumanBeforeMenu_(result)) return '';

  var pengumuman = getActivePengumuman_();
  if (!pengumuman || !pengumuman.message) return '';

  // Supaya tidak terlalu spam: tampil maksimal 1x per nomor per 6 jam untuk pengumuman yang sama.
  var p = normalizePhone_(phone || '');
  if (p) {
    var sentKey = 'SIAGA_PENGUMUMAN_SENT_' + p + '_' + pengumuman.key;
    if (cacheGet_(sentKey)) return '';

    var repeatHours = Number(CONFIG.PENGUMUMAN_REPEAT_HOURS);
    if (isNaN(repeatHours)) repeatHours = 6;

    // Jika 0, tidak disimpan ke cache agar pengumuman muncul setiap buka Menu Utama.
    if (repeatHours > 0) {
      cachePut_(sentKey, '1', Math.max(60, repeatHours * 3600));
    }
  }

  return pengumuman.message;
}


function buildInteractiveMenuBody_() {
  return {
    body: 'Hallo Sahabat Tiara, Selamat datang di layanan WhatsApp *PERUMDAM Tirta Ardhia Rinjani Kabupaten Lombok Tengah*.\n\nSaya adalah *SIAGA TIARA*, layanan informasi aduan gangguan air.\n\nSilakan pilih layanan yang Anda butuhkan.',
    button: 'Pilih Layanan',
    sections: [
      {
        title: 'Layanan Utama',
        rows: [
          {
            id: 'MENU_1_ADUAN',
            title: 'Buat Aduan Baru',
            description: 'Laporkan gangguan air'
          },
          {
            id: 'MENU_2_STATUS',
            title: 'Cek Status Aduan',
            description: 'Cek progres berdasarkan ID aduan'
          },
          {
            id: 'MENU_3_ADUAN_SAYA',
            title: 'Riwayat Aduan',
            description: 'Riwayat aduan dari nomor WhatsApp ini'
          },
          {
            id: 'MENU_4_INFO_PEMBAYARAN',
            title: 'Info Layanan',
            description: 'Pembayaran dan layanan pelanggan'
          }
        ]
      }
    ]
  };
}


// ============================================================
// INTERACTIVE NAVIGATION BUTTONS - KEMBALI / MENU UTAMA
// ============================================================


// ============================================================
// HOTFIX V10.9.10 - STATUS NOTIFICATION USES 3 CLEAN NAV BUTTONS
// HOTFIX V10.9.1 - FORCE CONTEXT BUTTONS
// ============================================================


// ============================================================
// V10.9.18 - LAST CREATED TICKET CACHE
// ============================================================
// Beberapa provider WA kadang hanya mengirim title tombol "Cek Tiket Ini",
// bukan id tombol CEK_TIKET_<ID>. Karena title tidak membawa ID,
// sistem menyimpan ID tiket terakhir per nomor WA agar tombol tetap jalan.

function getLastTicketCacheKey_(phone) {
  return 'LAST_TICKET_' + normalizePhone_(phone || '');
}

function setLastCreatedAduanIdForPhone_(phone, aduanId) {
  phone = normalizePhone_(phone || '');
  aduanId = normalizeAduanIdHyphen_(aduanId || '');
  if (!phone || !aduanId) return;

  try {
    var cache = getRuntimeCache_();
    if (cache) {
      cache.put(getLastTicketCacheKey_(phone), aduanId, 21600); // 6 jam
    }
  } catch (e) {}

  try {
    PropertiesService.getScriptProperties().setProperty(getLastTicketCacheKey_(phone), aduanId);
  } catch (e2) {}
}

function getLastCreatedAduanIdForPhone_(phone) {
  phone = normalizePhone_(phone || '');
  if (!phone) return '';

  var key = getLastTicketCacheKey_(phone);

  try {
    var cache = getRuntimeCache_();
    var fromCache = cache ? cache.get(key) : '';
    if (fromCache) return normalizeAduanIdHyphen_(fromCache);
  } catch (e) {}

  try {
    return normalizeAduanIdHyphen_(PropertiesService.getScriptProperties().getProperty(key) || '');
  } catch (e2) {
    return '';
  }
}

function handleCekTiketIni_(phone) {
  var id = getLastCreatedAduanIdForPhone_(phone);
  if (id) {
    var d = findAduanById_(id);
    if (d) {
      clearWhatsAppSession_(phone);
      return {
        success: true,
        type: 'CEK_TIKET_INI',
        id: d.id,
        reply: buildWhatsAppTrackingReply_(d),
        navButtons: buildNavButtons_('status')
      };
    }
  }

  // Kalau cache hilang/cold start, fallback ke aduan terakhir nomor tersebut.
  return handleListOrLatestAduan_(phone);
}


function buildCreatedTicketButtons_(aduanId) {
  aduanId = normalizeAduanIdHyphen_(aduanId || '');
  if (!aduanId) return buildNavButtons_('created');

  return [
    { id: 'CEK_TIKET_' + aduanId, title: 'Cek Tiket Ini' },
    { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' },
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function buildNavButtons_(type) {
  type = String(type || '').toLowerCase();

  if (type === 'status') {
    return [
      { id: 'NAV_BACK_STATUS', title: 'Kembali' },
      { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'created') {
    return [
      { id: 'MENU_2_STATUS', title: 'Cek Status' },
      { id: 'MENU_1_ADUAN', title: 'Buat Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'not_found') {
    return [
      { id: 'MENU_2_STATUS', title: 'Cek Lagi' },
      { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'active_limit') {
    return [
      { id: 'MENU_2_STATUS', title: 'Cek Status' },
      { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'outside_hours') {
    // V10.9.30:
    // Tombol Menu Utama dipakai sebagai tombol kembali ke list menu utama penuh.
    return [
      { id: 'MENU_4_INFO_PEMBAYARAN', title: 'Info Layanan' },
      { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' },
      { id: 'NAV_MENU', title: 'Menu Utama' }
    ];
  }

  if (type === 'main') {
    return [
      { id: 'MENU_1_ADUAN', title: 'Buat Aduan' },
      { id: 'MENU_2_STATUS', title: 'Cek Status' },
      { id: 'MENU_3_ADUAN_SAYA', title: 'Riwayat Aduan' }
    ];
  }

  return [
    { id: 'NAV_MENU', title: 'Menu Utama' }
  ];
}

function isNavButtonEligible_(result) {
  return !!(result && result.reply && result.navButtons && result.navButtons.length);
}

function sendKiriminButtonMessage_(phone, message, buttons) {
  var props = PropertiesService.getScriptProperties();

  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';
  var phoneNumber = normalizePhone_(phone || '');

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk button message.' };

  buttons = (buttons || []).slice(0, 3).map(function(btn) {
    return {
      type: 'reply',
      reply: {
        id: String(btn.id || btn.title || '').substring(0, 256),
        title: String(btn.title || 'Menu').substring(0, 20)
      }
    };
  });

  if (buttons.length === 0) {
    buttons = buildNavButtons_('main').map(function(btn) {
      return {
        type: 'reply',
        reply: {
          id: btn.id,
          title: btn.title
        }
      };
    });
  }

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: String(message || '')
      },
      action: {
        buttons: buttons
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function testKiriminButtonMessage() {
  var ui = SpreadsheetApp.getUi();
  var targetPrompt = ui.prompt(
    'Tes Reply Button WhatsApp',
    'Masukkan nomor HP. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetPrompt.getSelectedButton() !== ui.Button.OK) return;

  var phone = targetPrompt.getResponseText();
  var result = sendKiriminButtonMessage_(
    phone,
    'Tes tombol SIAGA TIARA.\n\nPilih salah satu layanan:',
    buildNavButtons_('status')
  );

  ui.alert(
    result.success ? '✅ Tombol terkirim' : '❌ Tombol gagal',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


function sendKiriminInteractiveMenu_(phone, options) {
  options = options || {};
  var props = PropertiesService.getScriptProperties();

  var token = props.getProperty('WHATSAPP_API_TOKEN') || '';

  // FIX V9.1:
  // Kirimin menolak /messages/send/interactive dengan route not found.
  // Jadi interactive dikirim ke endpoint utama /messages/send sesuai body dokumentasi.
  var endpoint = props.getProperty('WHATSAPP_API_ENDPOINT') ||
    CONFIG.WHATSAPP_API_ENDPOINT ||
    'https://apiapp.kirimin.id/api/v1/public/messages/send';

  var phoneNumber = normalizePhone_(phone || '');
  if (!phoneNumber && options.customerPhone) phoneNumber = normalizePhone_(options.customerPhone);

  if (!token) return { success: false, error: 'API token kosong.' };
  if (!phoneNumber) return { success: false, error: 'phone_number kosong untuk List Menu.' };

  var menu = buildInteractiveMenuBody_();

  var body = {
    phone_number: phoneNumber,
    channel: 'whatsapp',
    message_type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: menu.body
      },
      action: {
        button: menu.button,
        sections: menu.sections
      }
    }
  };

  return postKiriminJson_(endpoint, token, body);
}

function postKiriminJson_(url, token, body) {
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(body)
    });

    var code = res.getResponseCode();
    var text = res.getContentText();

    return {
      success: code >= 200 && code < 300,
      statusCode: code,
      response: text,
      requestBody: body,
      url: url
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      requestBody: body,
      url: url
    };
  }
}



function testKiriminInteractiveMenu() {
  var ui = SpreadsheetApp.getUi();

  var targetPrompt = ui.prompt(
    'Tes List Menu WhatsApp',
    'Masukkan nomor HP pelanggan. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetPrompt.getSelectedButton() !== ui.Button.OK) return;

  var phone = targetPrompt.getResponseText();
  var result = sendKiriminInteractiveMenu_(phone, { customerPhone: phone });

  if (!result.success) {
    var fallback = sendWhatsAppMessage_(phone, buildMainWhatsAppMenuReply_(), {});
    ui.alert(
      fallback.success ? '⚠ List Menu belum cocok, fallback teks terkirim' : '❌ List Menu dan fallback teks gagal',
      'Response List Menu:\n' + JSON.stringify(result, null, 2) +
      '\n\nStatus fallback teks: ' + (fallback.success ? 'OK' : 'GAGAL'),
      ui.ButtonSet.OK
    );
    return;
  }

  ui.alert(
    '✅ List Menu terkirim',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}


function testWhatsAppCekStatusById() {
  var ui = SpreadsheetApp.getUi();
  var idPrompt = ui.prompt(
    'Tes Cek Status Aduan',
    'Masukkan ID Aduan. Contoh: PRY-20260506-0001',
    ui.ButtonSet.OK_CANCEL
  );
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;

  var id = extractAduanId_(idPrompt.getResponseText()) || idPrompt.getResponseText();
  var d = findAduanById_(id);

  ui.alert(
    d ? '✅ ID ditemukan' : '❌ ID tidak ditemukan',
    d ? buildWhatsAppTrackingReply_(d) : buildNotFoundReply_(id, ''),
    ui.ButtonSet.OK
  );
}

function logWhatsApp_(phone, message, jenis, idAduan, reply, status, rawPayload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);

    if (!sh) {
      setupWhatsAppLogSheet(ss);
      sh = ss.getSheetByName(CONFIG.WHATSAPP_LOG_SHEET);
    }

    var row = [
      new Date(),
      phone || '',
      truncateForLog_(message || '', 700),
      jenis || '',
      idAduan || '',
      truncateForLog_(reply || '', 1500),
      truncateForLog_(status || '', 500),
      truncateForLog_(rawPayload || '', 1200)
    ];

    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);

  } catch (err) {
    // Jangan throw agar webhook tetap balas 200.
  }
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function extractAduanId_(text) {
  text = String(text || '').trim();
  if (!text) return '';

  var upper = text.toUpperCase();

  // Format normal: PRY-20260503-0001 / ADU-20260503-0001
  var match = upper.match(/\b(?:ADU|PRY|PJT|JGT|KPG|JNP|BTK|BTU|PGR|PRB|PRT|PTE|LNY)-?\d{8}-?\d{4}\b/);
  if (match) return normalizeAduanIdHyphen_(match[0]);

  // Format longgar: "status PRY 20260503 0001"
  var loose = upper.match(/\b(ADU|PRY|PJT|JGT|KPG|JNP|BTK|BTU|PGR|PRB|PRT|PTE|LNY)[\s_-]*(\d{8})[\s_-]*(\d{4})\b/);
  if (loose) return loose[1] + '-' + loose[2] + '-' + loose[3];

  return '';
}

function normalizeAduanIdHyphen_(id) {
  id = String(id || '').toUpperCase().trim();
  var m = id.match(/^(ADU|PRY|PJT|JGT|KPG|JNP|BTK|BTU|PGR|PRB|PRT|PTE|LNY)-?(\d{8})-?(\d{4})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return id;
}

function getWebhookPayloadDebug_(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return { raw: raw || '', parseError: err.message };
  }
}


// ============================================================
// PATCH V8.8 - Tracking ID Aduan WhatsApp helpers
// ============================================================

function findAduanById_(id) {
  id = normalizeAduanIdHyphen_(id || '');
  var key = normalizeId_(id);
  if (!key) return null;

  // [V10.9.44] Cache lookup - hemat 3-5 detik pada repeated query
  var cacheKey = 'ADUAN_FIND_' + key;
  var cached = cacheGet_(cacheKey);
  if (cached) {
    try {
      var obj = JSON.parse(cached);
      if (obj && obj.id) return obj;
    } catch(e) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return null;

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 20)).getValues();

  for (var i = 0; i < values.length; i++) {
    var d = parseAduanRowForTracking_(values[i]);
    if (!d || !d.id) continue;

    if (normalizeId_(d.id) === key) {
      // Cache 5 menit agar query berikutnya tidak perlu baca sheet lagi
      try { cachePut_(cacheKey, JSON.stringify(d), 300); } catch(ce) {}
      return d;
    }
  }

  return null;
}

function parseAduanRowForTracking_(row) {
  row = row || [];

  var waktuMasuk = row[CONFIG.COL.WAKTU_MASUK - 1];
  var waktuSelesai = row[CONFIG.COL.WAKTU_SELESAI - 1];
  var updatedAt = row[CONFIG.COL.UPDATED_AT - 1];

  var waktuMasukDate = toSafeDate_(waktuMasuk);
  var waktuSelesaiDate = toSafeDate_(waktuSelesai);
  var updatedAtDate = toSafeDate_(updatedAt);

  return {
    id: String(row[CONFIG.COL.ID - 1] || '').trim(),
    waktuMasuk: formatDateForWa_(waktuMasukDate || waktuMasuk),
    waktuMasukDate: waktuMasukDate,
    cabang: String(row[CONFIG.COL.CABANG - 1] || '').trim(),
    wilayah: String(row[CONFIG.COL.WILAYAH - 1] || '').trim(),
    desa: String(row[CONFIG.COL.DESA - 1] || '').trim(),
    noPelanggan: String(row[(CONFIG.COL.NO_PELANGGAN || CONFIG.COL.DESA) - 1] || '').trim(),
    namaPelanggan: String(row[CONFIG.COL.NAMA_PELANGGAN - 1] || '').trim(),
    noHp: normalizePhone_(row[CONFIG.COL.NO_HP - 1] || ''),
    jenisGangguan: String(row[CONFIG.COL.JENIS_GANGGUAN - 1] || '').trim(),
    prioritas: String(row[CONFIG.COL.PRIORITAS - 1] || 'Sedang').trim(),
    status: String(row[CONFIG.COL.STATUS - 1] || 'Baru').trim(),
    unit: String(row[CONFIG.COL.UNIT - 1] || '').trim(),
    keterangan: String(row[CONFIG.COL.KETERANGAN - 1] || '').trim(),
    catatan: String(row[CONFIG.COL.CATATAN - 1] || '').trim(),
    waktuSelesai: formatDateForWa_(waktuSelesaiDate || waktuSelesai),
    waktuSelesaiDate: waktuSelesaiDate,
    slaJam: Number(row[CONFIG.COL.SLA_JAM - 1] || 8),
    updatedAt: formatDateForWa_(updatedAtDate || updatedAt),
    updatedAtDate: updatedAtDate,
    latitude: String(row[(CONFIG.COL.LATITUDE || 17) - 1] || '').trim(),
    longitude: String(row[(CONFIG.COL.LONGITUDE || 18) - 1] || '').trim(),
    linkMaps: String(row[(CONFIG.COL.LINK_MAPS || 19) - 1] || '').trim(),
    lokasiDetail: String(row[(CONFIG.COL.LOKASI_DETAIL || 20) - 1] || '').trim()
  };
}

function buildWhatsAppTrackingReply_(d) {
  d = d || {};
  var statusIcon = getStatusIconForWa_(d.status);
  var noPelanggan = getNoPelangganFromAduan_(d) || '-';
  var progress = buildProgressTextForWa_(d.status);

  // V10.7:
  // Balasan untuk pelanggan dibuat bersih.
  // Jangan tampilkan data internal seperti Prioritas, Unit/Petugas, dan Catatan Sistem.
  // Detail tersebut hanya untuk admin/petugas melalui notifikasi internal.
  var lines = [
    '🔎 *Status Aduan SIAGA TIARA*',
    '',
    'ID Aduan: *' + (d.id || '-') + '*',
    'Status: ' + statusIcon + ' *' + (d.status || '-') + '*',
    'Tahap: ' + progress,
    '',
    'Nama: ' + (d.namaPelanggan || '-'),
    'Cabang: ' + (d.cabang || '-'),
    'No Pelanggan: ' + noPelanggan,
    'Jenis: ' + (d.jenisGangguan || '-'),
    '',
    'Waktu masuk: ' + (d.waktuMasuk || '-')
  ];

  if (d.status === 'Selesai' && d.waktuSelesai) {
    lines.push('Waktu selesai: ' + d.waktuSelesai);
  }

  if (d.linkMaps) {
    lines.push('Maps: ' + d.linkMaps);
  }

  lines.push('');
  lines.push('Ketik *menu* untuk kembali ke layanan utama.');

  return lines.join('\n');
}


function buildNotFoundReply_(id, phone) {
  return [
    '⚠️ *ID Aduan Tidak Ditemukan*',
    '',
    'ID yang dikirim:',
    '*' + (id || '-') + '*',
    '',
    'Pastikan format ID benar.',
    'Contoh: *PRY-20260503-0001*',
    '',
    'Atau ketik *riwayat* untuk menampilkan riwayat aduan dari nomor WhatsApp ini.',
    'Ketik *menu* untuk kembali ke layanan utama.'
  ].join('\n');
}

function getStatusIconForWa_(status) {
  status = String(status || '').toLowerCase();
  if (status === 'baru') return '🆕';
  if (status === 'proses') return '🔧';
  if (status === 'selesai') return '✅';
  if (status === 'ditunda') return '⏸️';
  if (status === 'batal') return '❌';
  return 'ℹ️';
}

function buildProgressTextForWa_(status) {
  status = String(status || '').toLowerCase();
  if (status === 'baru') return 'Aduan sudah masuk dan menunggu tindak lanjut.';
  if (status === 'proses') return 'Aduan sedang dalam proses penanganan.';
  if (status === 'selesai') return 'Aduan telah selesai ditangani.';
  if (status === 'ditunda') return 'Aduan sementara ditunda.';
  if (status === 'batal') return 'Aduan dibatalkan.';
  return 'Aduan tercatat di sistem.';
}

function toSafeDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value;

  var d = new Date(value);
  if (!isNaN(d)) return d;
  return null;
}

function formatDateForWa_(value) {
  if (!value) return '';
  var d = toSafeDate_(value);
  if (!d) return String(value || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}



function testKiriminJenisGangguanMenu() {
  var ui = SpreadsheetApp.getUi();
  var targetPrompt = ui.prompt(
    'Tes Menu Jenis Gangguan',
    'Masukkan nomor HP. Contoh: 6281907941188',
    ui.ButtonSet.OK_CANCEL
  );
  if (targetPrompt.getSelectedButton() !== ui.Button.OK) return;

  var phone = targetPrompt.getResponseText();
  var result = sendKiriminJenisGangguanMenu_(phone);

  ui.alert(
    result.success ? '✅ Menu jenis gangguan terkirim' : '❌ Menu jenis gangguan gagal',
    JSON.stringify(result, null, 2),
    ui.ButtonSet.OK
  );
}

