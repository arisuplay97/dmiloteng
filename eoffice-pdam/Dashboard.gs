/**
 * Dashboard.gs — KPI + chart data for the dashboard page.
 */

function Dash_stats(payload) {
  requireAuth_(payload);
  const sm = sheetToObjects_(getSheet_(CONFIG.SHEETS.SURAT_MASUK));
  const sk = sheetToObjects_(getSheet_(CONFIG.SHEETS.SURAT_KELUAR));
  const disp = sheetToObjects_(getSheet_(CONFIG.SHEETS.DISPOSISI));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  function countIf(arr, pred) {
    return arr.reduce(function (c, r) { return c + (pred(r) ? 1 : 0); }, 0);
  }

  return ok({
    suratMasukTotal: sm.length,
    suratMasukBulanIni: countIf(sm, function (r) { return new Date(r.createdAt) >= monthStart; }),
    suratMasukBelumDitindak: countIf(sm, function (r) { return r.status === 'Baru'; }),
    suratKeluarTotal: sk.length,
    suratKeluarBulanIni: countIf(sk, function (r) { return new Date(r.createdAt) >= monthStart; }),
    suratKeluarMenunggu: countIf(sk, function (r) { return r.status === 'Menunggu Approval'; }),
    disposisiAktif: countIf(disp, function (r) { return r.status !== 'Selesai'; }),
    disposisiSelesai: countIf(disp, function (r) { return r.status === 'Selesai'; })
  });
}

function Dash_chart(payload) {
  requireAuth_(payload);
  // Build last 6 months series
  const now = new Date();
  const labels = [];
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + (d.getMonth() + 1);
    labels.push(Utilities.formatDate(d, 'Asia/Jakarta', 'MMM yyyy'));
    months.push(key);
  }

  const sm = sheetToObjects_(getSheet_(CONFIG.SHEETS.SURAT_MASUK));
  const sk = sheetToObjects_(getSheet_(CONFIG.SHEETS.SURAT_KELUAR));

  function groupByMonth(arr) {
    const map = {};
    months.forEach(function (m) { map[m] = 0; });
    arr.forEach(function (r) {
      const d = new Date(r.createdAt);
      const key = d.getFullYear() + '-' + (d.getMonth() + 1);
      if (Object.prototype.hasOwnProperty.call(map, key)) map[key]++;
    });
    return months.map(function (m) { return map[m]; });
  }

  // Status distribution for surat masuk
  const statusMap = {};
  CONFIG.STATUS_SM.forEach(function (s) { statusMap[s] = 0; });
  sm.forEach(function (r) {
    if (statusMap.hasOwnProperty(r.status)) statusMap[r.status]++;
  });

  return ok({
    labels: labels,
    suratMasuk: groupByMonth(sm),
    suratKeluar: groupByMonth(sk),
    statusLabels: Object.keys(statusMap),
    statusValues: Object.keys(statusMap).map(function (k) { return statusMap[k]; })
  });
}

function Dash_recent(payload) {
  requireAuth_(payload);
  const sm = sheetToObjects_(getSheet_(CONFIG.SHEETS.SURAT_MASUK))
    .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
    .slice(0, 5);
  const sk = sheetToObjects_(getSheet_(CONFIG.SHEETS.SURAT_KELUAR))
    .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
    .slice(0, 5);
  const tr = sheetToObjects_(getSheet_(CONFIG.SHEETS.TRACKING))
    .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); })
    .slice(0, 10);
  return ok({ suratMasuk: sm, suratKeluar: sk, tracking: tr });
}
