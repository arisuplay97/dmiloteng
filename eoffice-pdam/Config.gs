/**
 * Config.gs
 * Global configuration for the E-Office PDAM application.
 */

const CONFIG = {
  ORG_NAME: 'PDAM Tirta Sejahtera',
  ORG_SHORT: 'PDAM',

  // PropertyService key where the Spreadsheet ID is stored
  PROP_SS_ID: 'EOFFICE_SS_ID',
  PROP_DRIVE_FOLDER_ID: 'EOFFICE_DRIVE_FOLDER_ID',

  // Sheet names
  SHEETS: {
    USERS: 'Users',
    SURAT_MASUK: 'SuratMasuk',
    SURAT_KELUAR: 'SuratKeluar',
    DISPOSISI: 'Disposisi',
    TRACKING: 'Tracking',
    SESSIONS: 'Sessions',
    SETTINGS: 'Settings'
  },

  // Default roles
  ROLES: ['Admin', 'Pimpinan', 'Sekretaris', 'Staff'],

  // Surat status
  STATUS_SM: ['Baru', 'Didisposisi', 'Diproses', 'Selesai', 'Diarsipkan'],
  STATUS_SK: ['Draft', 'Menunggu Approval', 'Disetujui', 'Ditolak', 'Terkirim', 'Diarsipkan'],
  STATUS_DISP: ['Dikirim', 'Dibaca', 'Diproses', 'Selesai'],

  // Session
  SESSION_HOURS: 8,

  // Bootstrap admin (created on first init)
  DEFAULT_ADMIN: {
    username: 'admin',
    password: 'admin123',
    nama: 'Administrator',
    email: '',
    jabatan: 'Super Admin',
    role: 'Admin'
  }
};
