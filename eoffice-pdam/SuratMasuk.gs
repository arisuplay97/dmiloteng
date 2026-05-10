/**
 * SuratMasuk.gs — CRUD for incoming letters.
 */

function SM_list(payload) {
  requireAuth_(payload);
  const q = String(payload.q || '').toLowerCase();
  const status = payload.status || '';
  let rows = sheetToObjects_(getSheet_(CONFIG.SHEETS.SURAT_MASUK));
  rows.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  if (status) rows = rows.filter(function (r) { return r.status === status; });
  if (q) {
    rows = rows.filter(function (r) {
      const hay = (
        String(r.noAgenda || '') + ' ' +
        String(r.noSurat || '') + ' ' +
        String(r.pengirim || '') + ' ' +
        String(r.perihal || '')
      ).toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }
  return ok(rows);
}

function SM_get(payload) {
  requireAuth_(payload);
  if (!payload.id) return err('VALIDATION', 'id wajib');
  const row = findRow_(getSheet_(CONFIG.SHEETS.SURAT_MASUK), 'id', payload.id);
  if (!row) return err('NOT_FOUND', 'Surat tidak ditemukan');
  const disp = sheetToObjects_(getSheet_(CONFIG.SHEETS.DISPOSISI))
    .filter(function (d) { return d.suratId === row.id; });
  const track = sheetToObjects_(getSheet_(CONFIG.SHEETS.TRACKING))
    .filter(function (t) { return t.suratId === row.id; })
    .sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
  return ok({ surat: row, disposisi: disp, tracking: track });
}

function SM_create(payload) {
  const s = requireAuth_(payload);
  const d = payload.data || {};
  if (!d.pengirim || !d.perihal) return err('VALIDATION', 'pengirim & perihal wajib');

  const id = Utilities.getUuid();
  const now = new Date();

  // Handle attachment
  let fileUrl = '', fileName = '';
  if (d.fileDataUrl) {
    const up = uploadBase64_(d.fileDataUrl, d.fileName || ('SM-' + id + '.pdf'));
    if (up) { fileUrl = up.url; fileName = up.name; }
  }

  const noAgenda = generateNoAgenda_('PDAM.SM');
  const barcode = generateBarcode_('SM', id);

  const row = appendRow_(CONFIG.SHEETS.SURAT_MASUK, {
    id: id,
    noAgenda: noAgenda,
    noSurat: d.noSurat || '',
    tanggalSurat: d.tanggalSurat ? new Date(d.tanggalSurat) : '',
    tanggalTerima: d.tanggalTerima ? new Date(d.tanggalTerima) : now,
    pengirim: d.pengirim,
    perihal: d.perihal,
    sifat: d.sifat || 'Biasa',
    jenis: d.jenis || 'Umum',
    fileUrl: fileUrl,
    fileName: fileName,
    barcode: barcode,
    status: 'Baru',
    keterangan: d.keterangan || '',
    createdBy: s.username,
    createdAt: now,
    updatedAt: now
  });

  track_(id, 'SuratMasuk', 'Dibuat', s.username, 'Surat masuk diinput. No agenda ' + noAgenda);
  return ok(row);
}

function SM_update(payload) {
  const s = requireAuth_(payload);
  const d = payload.data || {};
  if (!d.id) return err('VALIDATION', 'id wajib');

  const patch = {
    noSurat: d.noSurat,
    tanggalSurat: d.tanggalSurat ? new Date(d.tanggalSurat) : '',
    tanggalTerima: d.tanggalTerima ? new Date(d.tanggalTerima) : '',
    pengirim: d.pengirim,
    perihal: d.perihal,
    sifat: d.sifat,
    jenis: d.jenis,
    keterangan: d.keterangan,
    status: d.status
  };
  if (d.fileDataUrl) {
    const up = uploadBase64_(d.fileDataUrl, d.fileName || ('SM-' + d.id + '.pdf'));
    if (up) { patch.fileUrl = up.url; patch.fileName = up.name; }
  }
  const upd = updateRowById_(CONFIG.SHEETS.SURAT_MASUK, d.id, patch);
  track_(d.id, 'SuratMasuk', 'Diperbarui', s.username, 'Data diperbarui');
  return ok(upd);
}

function SM_delete(payload) {
  const s = requireRole_(payload, ['Admin', 'Sekretaris']);
  if (!payload.id) return err('VALIDATION', 'id wajib');
  const removed = deleteRowById_(CONFIG.SHEETS.SURAT_MASUK, payload.id);
  track_(payload.id, 'SuratMasuk', 'Dihapus', s.username, '');
  return ok({ removed: removed });
}
