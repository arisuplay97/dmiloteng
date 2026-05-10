/**
 * Tracking.gs — Unified timeline for a letter.
 * Combines tracking events + dispositions into a single chronological list.
 */

function Track_timeline(payload) {
  requireAuth_(payload);
  if (!payload.suratId) return err('VALIDATION', 'suratId wajib');
  const trackRows = sheetToObjects_(getSheet_(CONFIG.SHEETS.TRACKING))
    .filter(function (t) { return t.suratId === payload.suratId; });
  const dispRows = sheetToObjects_(getSheet_(CONFIG.SHEETS.DISPOSISI))
    .filter(function (d) { return d.suratId === payload.suratId; });

  const events = trackRows.map(function (t) {
    return {
      type: 'track',
      action: t.action,
      actor: t.actor,
      detail: t.detail,
      timestamp: t.timestamp
    };
  });

  dispRows.forEach(function (d) {
    events.push({
      type: 'disposisi',
      action: 'Disposisi: ' + (d.fromUser || '') + ' → ' + (d.toUser || ''),
      actor: d.fromUser,
      detail: d.instruksi + (d.response ? ' | Respon: ' + d.response : ''),
      timestamp: d.createdAt
    });
    if (d.respondedAt) {
      events.push({
        type: 'disposisi',
        action: 'Disposisi ' + d.status,
        actor: d.toUser,
        detail: d.response || '',
        timestamp: d.respondedAt
      });
    }
  });

  events.sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
  return ok(events);
}

/**
 * Lookup by barcode value (from QR scan).
 */
function Track_byBarcode(payload) {
  requireAuth_(payload);
  const code = String(payload.barcode || '').trim();
  if (!code) return err('VALIDATION', 'barcode wajib');

  const sm = findRow_(getSheet_(CONFIG.SHEETS.SURAT_MASUK), 'barcode', code);
  if (sm) return ok({ type: 'SuratMasuk', surat: sm });

  const sk = findRow_(getSheet_(CONFIG.SHEETS.SURAT_KELUAR), 'barcode', code);
  if (sk) return ok({ type: 'SuratKeluar', surat: sk });

  return err('NOT_FOUND', 'Barcode tidak ditemukan');
}
