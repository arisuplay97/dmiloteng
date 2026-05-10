/**
 * Disposisi.gs — Hierarchical dispositions for incoming letters.
 * A disposition can be forwarded (creates a child row with parentId).
 */

function Disp_list(payload) {
  requireAuth_(payload);
  let rows = sheetToObjects_(getSheet_(CONFIG.SHEETS.DISPOSISI));
  if (payload.suratId) rows = rows.filter(function (d) { return d.suratId === payload.suratId; });
  if (payload.toUser) rows = rows.filter(function (d) { return d.toUser === payload.toUser; });
  rows.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return ok(rows);
}

function Disp_create(payload) {
  const s = requireAuth_(payload);
  const d = payload.data || {};
  if (!d.suratId || !d.toUser || !d.instruksi) {
    return err('VALIDATION', 'suratId, toUser, instruksi wajib');
  }

  const id = Utilities.getUuid();
  const now = new Date();
  const row = appendRow_(CONFIG.SHEETS.DISPOSISI, {
    id: id,
    suratId: d.suratId,
    suratType: d.suratType || 'SuratMasuk',
    fromUser: s.username,
    toUser: d.toUser,
    instruksi: d.instruksi,
    catatan: d.catatan || '',
    status: 'Dikirim',
    response: '',
    respondedAt: '',
    parentId: d.parentId || '',
    createdAt: now
  });

  // Update parent surat status if surat masuk
  if (d.suratType !== 'SuratKeluar') {
    updateRowById_(CONFIG.SHEETS.SURAT_MASUK, d.suratId,
      { status: 'Didisposisi' });
  }
  track_(d.suratId, d.suratType || 'SuratMasuk', 'Didisposisi',
    s.username, 'Disposisi ke ' + d.toUser + ': ' + d.instruksi);

  // Email notification (best-effort)
  try {
    const target = findRow_(getSheet_(CONFIG.SHEETS.USERS), 'username', d.toUser);
    if (target && target.email) {
      MailApp.sendEmail({
        to: target.email,
        subject: '[E-Office PDAM] Disposisi Baru untuk Anda',
        htmlBody: '<p>Halo ' + target.nama + ',</p>' +
                  '<p>Anda menerima disposisi baru dari <b>' + s.username + '</b>.</p>' +
                  '<p><b>Instruksi:</b> ' + d.instruksi + '</p>' +
                  '<p>Silakan login ke E-Office PDAM untuk menindaklanjuti.</p>'
      });
    }
  } catch (_) {}

  return ok(row);
}

function Disp_respond(payload) {
  const s = requireAuth_(payload);
  const d = payload.data || {};
  if (!d.id || !d.response) return err('VALIDATION', 'id & response wajib');
  const upd = updateRowById_(CONFIG.SHEETS.DISPOSISI, d.id, {
    status: d.status || 'Selesai',
    response: d.response,
    respondedAt: new Date()
  });
  if (upd) {
    track_(upd.suratId, upd.suratType || 'SuratMasuk', 'Disposisi ' + (d.status || 'Selesai'),
      s.username, d.response);
    // Mark parent surat as Diproses/Selesai
    if (d.status === 'Selesai') {
      updateRowById_(CONFIG.SHEETS.SURAT_MASUK, upd.suratId, { status: 'Selesai' });
    } else {
      updateRowById_(CONFIG.SHEETS.SURAT_MASUK, upd.suratId, { status: 'Diproses' });
    }
  }
  return ok(upd);
}

function Disp_forward(payload) {
  // Forwarding creates a new disposition with parentId
  const s = requireAuth_(payload);
  const d = payload.data || {};
  if (!d.parentId || !d.toUser || !d.instruksi) {
    return err('VALIDATION', 'parentId, toUser, instruksi wajib');
  }
  const parent = findRow_(getSheet_(CONFIG.SHEETS.DISPOSISI), 'id', d.parentId);
  if (!parent) return err('NOT_FOUND', 'Disposisi asal tidak ditemukan');
  return Disp_create({
    _token: payload._token,
    data: {
      suratId: parent.suratId,
      suratType: parent.suratType,
      toUser: d.toUser,
      instruksi: d.instruksi,
      catatan: d.catatan,
      parentId: parent.id
    }
  });
}
