# E-Office PDAM

Aplikasi **E-Office lengkap** berbasis Google Apps Script untuk PDAM.
Gratis, tanpa server, data tersimpan di Google Sheets & Drive milik Anda.

## ✨ Fitur

- 🔐 **Autentikasi multi-role** — Admin, Pimpinan, Sekretaris, Staff (password di-hash SHA-256)
- 📥 **Surat Masuk** — input + upload lampiran + auto-generate nomor agenda
- 📤 **Surat Keluar** — draft, approval berjenjang, auto nomor surat
- ➡️ **Disposisi berjenjang** — forward, respon, notifikasi email otomatis
- 🔍 **Tracking real-time** — timeline perjalanan setiap surat
- 📱 **QR / Barcode** — setiap surat punya QR unik, scan via kamera
- 📊 **Dashboard premium** — stat cards, grafik 6 bulan (Chart.js), doughnut status
- 🎨 **UI modern** — glassmorphism, dark/light mode, animasi halus, responsive
- 👥 **Manajemen user** — CRUD lengkap (Admin only)

## 📁 Struktur Project

```
eoffice-pdam/
├── appsscript.json        # Manifest + OAuth scopes
├── Code.gs                # Router doGet() + api() dispatcher
├── Config.gs              # Konstanta global (CONFIG)
├── Setup.gs               # Initializer (sheets, admin, drive folder)
├── Auth.gs                # Login / session / user CRUD
├── SuratMasuk.gs          # CRUD surat masuk
├── SuratKeluar.gs         # CRUD + approval surat keluar
├── Disposisi.gs           # Disposisi + forward + email notif
├── Tracking.gs            # Timeline + lookup by barcode
├── Dashboard.gs           # Statistik, chart data, recent
├── Utils.gs               # Helpers (sheet, hash, upload, barcode)
│
├── styles.html            # Design system CSS
├── scripts.html           # Runtime JS (EOF namespace)
├── layout.html            # Sidebar + topbar shared
│
├── login.html             # Halaman login premium
├── dashboard.html         # Dashboard utama
├── surat-masuk.html
├── surat-keluar.html
├── disposisi.html
├── tracking.html          # Cari by barcode
├── scan.html              # Scan QR dengan kamera
├── detail.html            # Detail surat + QR + timeline
└── users.html             # Manajemen user (Admin only)
```

## 🚀 Cara Deploy

### Opsi A — Copy-Paste ke Google Apps Script

1. Buka https://script.google.com → **New project**
2. Rename project menjadi `E-Office PDAM`
3. Di editor Apps Script, untuk **setiap file `.gs`** di folder `eoffice-pdam/`:
   - Klik tombol **+** di sebelah "Files" → pilih **Script**
   - Beri nama sesuai file (tanpa `.gs`), contoh: `Auth`, `Config`, dst.
   - Copy isi file dari repo ini, paste ke editor, Save (Ctrl+S)
4. Untuk **setiap file `.html`**:
   - Klik **+** → **HTML**
   - Nama file harus persis tanpa ekstensi, contoh: `login`, `dashboard`, `styles`, dst.
   - Paste isi file → Save
5. Buka `appsscript.json`:
   - Klik ⚙️ **Project Settings** → centang **Show "appsscript.json" manifest file**
   - Kembali ke editor, klik file `appsscript.json`, replace seluruh isinya dengan `appsscript.json` dari repo
6. Jalankan initializer sekali:
   - Di dropdown fungsi, pilih `Setup_run`
   - Klik **Run** → authorize ketika diminta (ini akan membuat 1 Spreadsheet + 1 Folder Drive)
   - Cek **Execution log** — di situ ada URL Spreadsheet & credential admin
7. Deploy sebagai Web App:
   - Klik **Deploy** → **New deployment** → **Web app**
   - Description: `E-Office PDAM v1`
   - Execute as: **Me**
   - Who has access: **Anyone** (atau `Anyone within organization` sesuai kebutuhan)
   - Klik **Deploy** → authorize → copy URL Web App
8. Buka URL tersebut → login dengan `admin` / `admin123` → **ganti password segera!**

### Opsi B — Pakai `clasp` (CLI resmi Google)

```bash
# Install CLI
npm install -g @google/clasp
clasp login

# Buat project Apps Script baru (standalone)
clasp create --type standalone --title "E-Office PDAM"

# Copy semua file ke folder project yang dibuat clasp, lalu:
clasp push

# Jalankan setup sekali
clasp run Setup_run

# Deploy web app
clasp deploy --description "E-Office PDAM v1"
```

## 🔑 Akun Default

| Field    | Value       |
|----------|-------------|
| Username | `admin`     |
| Password | `admin123`  |
| Role     | Admin       |

**Ganti password ini segera** setelah login pertama via menu Profil atau Manajemen User.

## 🔒 Role & Hak Akses

| Role        | Hak Akses |
|-------------|-----------|
| Admin       | Semua fitur + Manajemen User + hapus data |
| Pimpinan    | Approve surat keluar + buat disposisi + view all |
| Sekretaris  | Input surat masuk/keluar + disposisi + hapus |
| Staff       | View + respon disposisi untuk dirinya |

## ⚙️ Konfigurasi

Edit `Config.gs` untuk mengubah:
- `ORG_NAME` — nama PDAM Anda
- `SESSION_HOURS` — masa berlaku session login (default 8 jam)
- `DEFAULT_ADMIN` — username/password admin bootstrap

## 📊 Database (Google Sheets)

Setup otomatis membuat 1 Spreadsheet dengan 7 sheet:

| Sheet         | Isi |
|---------------|-----|
| Users         | Daftar pengguna (password ter-hash) |
| SuratMasuk    | Data surat masuk |
| SuratKeluar   | Data surat keluar |
| Disposisi     | Disposisi antar user |
| Tracking      | Log semua aktivitas untuk timeline |
| Sessions      | Token login aktif |
| Settings      | Key-value setting aplikasi |

Lampiran surat disimpan di folder Google Drive terpisah (link dibuat otomatis di field `fileUrl`).

## 🧪 Flow Testing Cepat

1. **Login** sebagai admin
2. Buat user baru di **Manajemen User** (mis. `pimpinan1` / `sekretaris1`)
3. Login sebagai `sekretaris1` → **Surat Masuk → Baru** (upload PDF uji)
4. Klik surat → **Buat Disposisi** ke `pimpinan1`
5. Logout → login sebagai `pimpinan1` → **Disposisi → Untuk Saya** → beri respon
6. Cek **Tracking** — ketik barcode dari detail surat → timeline muncul
7. **Scan Barcode** dengan kamera HP (akses URL via HTTPS)

## 🛠️ Library CDN yang Dipakai

- [Chart.js 4.4](https://cdn.jsdelivr.net/npm/chart.js@4.4.0/) — grafik dashboard
- [qrcodejs](https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/) — generate QR
- [html5-qrcode](https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/) — scan kamera
- Google Fonts: Plus Jakarta Sans

## 🐛 Troubleshooting

**"App belum di-setup"** — Jalankan `Setup_run()` sekali dari editor Apps Script.

**Kamera scan tidak jalan** — Pastikan URL di-akses via HTTPS (default Apps Script Web App sudah HTTPS). Di iOS, izinkan akses kamera di browser.

**Setelah deploy baru, URL berubah** — Gunakan **Deploy → Manage deployments → edit** lalu pilih version "New version" agar URL lama tetap valid.

**Disposisi email tidak terkirim** — Pastikan user target punya kolom `email` terisi di Manajemen User.

## 📝 Lisensi

MIT — bebas dipakai dan dimodifikasi untuk keperluan PDAM / pemerintahan / edukasi.

---

Dibuat dengan ❤️ untuk inovasi PDAM.
