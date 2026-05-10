/**
 * SuratKeluar.gs — CRUD for outgoing letters + approval flow.
 */

function SK_list(payload) {
  requireAuth_(payload);
  const q = String(payload.q || '').toLowerCase();
  const status = payload.status || '';
  let rows = sheetToObjects_(getSheet_(CONFIG.SHEETS.SURAT_KELUAR));
  rows.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  if (status) rows = rows.filter(function (r) { return r.status === status; });
  if (q) {
    rows = rows.filter(function (r) {
      const hay = (
        String(r.noSurat || '') + ' ' +
        String(r.tujuan || '') + ' ' +
        String(r.perihal || '')
      ).toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }
  return ok(rows);
}

function SK_get(payload) {
  requireAuth_(payload);
  if (!payload.id) return err('VALIDATION', 'id wajib');
  const row = findRow_(getSheet_(CONFIG.SHEETS.SURAT_KELUAR), 'id', payload.id);
  if (!row) return err('NOT_FOUND', 'Surat tidak ditemukan');
  const track = sheetToObjects_(getSheet_(CONFIG.SHEETS.TRACKING))
    .filter(function (t) { return t.suratId === row.id; })
    .sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
  return ok({ surat: row, tracking: track });
}

function SK_create(payload) {
  const s = requireAuth_(payload);
  const d = payload.data || {};
  if (!d.tujuan || !d.perihal) return err('VALIDATION', 'tujuan & perihal wajib');

  const id = Utilities.getUuid();
  const now = new Date();
  let fileUrl = '', fileName = '';
  if (d.fileDataUrl) {
    const up = uploadBase64_(d.fileDataUrl, d.fileName || ('SK-' + id + '.pdf'));
    if (up) { fileUrl = up.url; fileName = up.name; }
  }

  const noSurat = d.noSurat || generateNoSuratKeluar_('PDAM.SK');
  const barcode = generateBarcode_('SK', id);

  const row = appendRow_(CONFIG.SHEETS.SURAT_KELUAR, {
    id: id,
    noSurat: noSurat,
    tanggalSurat: d.tanggalSurat ? new Date(d.tanggalSurat) : now,
    tujuan: d.tujuan,
    perihal: d.perihal,
    sifat: d.sifat || 'Biasa',
    jenis: d.jenis || 'Umum',
    isi: d.isi || '',
    fileUrl: fileUrl,
    fileName: fileName,
    barcode: barcode,
    status: d.status === 'Menunggu Approval' ? 'Menunggu Approval' : 'Draft',
    approvedBy: '',
    approvedAt: '',
    createdBy: s.username,
    createdAt: now,
    updatedAt: now
  });
  track_(id, 'SuratKeluar', 'Dibuat', s.username, 'Surat keluar dibuat. No ' + noSurat);
  return ok(row);
}

function SK_update(payload) {
  const s = requireAuth_(payload);
  const d = payload.data || {};
  if (!d.id) return err('VALIDATION', 'id wajib');
  const patch = {
    noSurat: d.noSurat,
    tanggalSurat: d.tanggalSurat ? new Date(d.tanggalSurat) : '',
    tujuan: d.tujuan,
    perihal: d.perihal,
    sifat: d.sifat,
    jenis: d.jenis,
    isi: d.isi,
    status: d.status
  };
  if (d.fileDataUrl) {
    const up = uploadBase64_(d.fileDataUrl, d.fileName || ('SK-' + d.id + '.pdf'));
    if (up) { patch.fileUrl = up.url; patch.fileName = up.name; }
  }
  const upd = updateRowById_(CONFIG.SHEETS.SURAT_KELUAR, d.id, patch);
  track_(d.id, 'SuratKeluar', 'Diperbarui', s.username, 'Data diperbarui');
  return ok(upd);
}

function SK_approve(payload) {
  const s = requireRole_(payload, ['Admin', 'Pimpinan']);
  if (!payload.id) return err('VALIDATION', 'id wajib');
  const approve = payload.approve !== false;
  const patch = approve
    ? { status: 'Disetujui', approvedBy: s.username, approvedAt: new Date() }
    : { status: 'Ditolak', approvedBy: s.username, approvedAt: new Date() };
  const upd = updateRowById_(CONFIG.SHEETS.SURAT_KELUAR, payload.id, patch);
  track_(payload.id, 'SuratKeluar', approve ? 'Disetujui' : 'Ditolak',
    s.username, payload.note || '');
  return ok(upd);
}

function SK_delete(payload) {
  const s = requireRole_(payload, ['Admin', 'Sekretaris']);
  if (!payload.id) return err('VALIDATION', 'id wajib');
  const removed = deleteRowById_(CONFIG.SHEETS.SURAT_KELUAR, payload.id);
  track_(payload.id, 'SuratKeluar', 'Dihapus', s.username, '');
  return ok({ removed: removed });
}
