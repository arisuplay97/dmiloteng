/**
 * Auth.gs
 * Login, session, and current-user resolver.
 */

function Auth_login(payload) {
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');
  if (!username || !password) return err('VALIDATION', 'Username & password wajib diisi');

  const sh = getSheet_(CONFIG.SHEETS.USERS);
  const user = findRow_(sh, 'username', username);
  if (!user) return err('AUTH', 'User tidak ditemukan');
  if (user.active === false || user.active === 'FALSE') return err('AUTH', 'Akun non-aktif');
  if (!verifyPassword_(password, user.password)) return err('AUTH', 'Password salah');

  // Create a session token
  const token = Utilities.getUuid().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_HOURS * 3600 * 1000);
  appendRow_(CONFIG.SHEETS.SESSIONS, {
    token: token,
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: expiresAt,
    createdAt: new Date()
  });

  return ok({
    token: token,
    user: sanitizeUser_(user),
    expiresAt: expiresAt
  });
}

function Auth_logout(payload) {
  const token = payload && payload._token;
  if (!token) return ok({ removed: false });
  const sh = getSheet_(CONFIG.SHEETS.SESSIONS);
  const row = findRow_(sh, 'token', token);
  if (row) sh.deleteRow(row._row);
  return ok({ removed: true });
}

function Auth_me(payload) {
  try {
    const s = requireAuth_(payload);
    const user = findRow_(getSheet_(CONFIG.SHEETS.USERS), 'id', s.userId);
    if (!user) return err('AUTH', 'User tidak ada');
    return ok({ user: sanitizeUser_(user), session: { expiresAt: s.expiresAt } });
  } catch (e) {
    return err('UNAUTHORIZED', String(e.message || e));
  }
}

function sanitizeUser_(u) {
  return {
    id: u.id,
    username: u.username,
    nama: u.nama,
    email: u.email,
    jabatan: u.jabatan,
    role: u.role,
    unit: u.unit
  };
}

/* ============ USER CRUD (Admin only) ============ */

function User_list(payload) {
  requireRole_(payload, ['Admin']);
  const users = sheetToObjects_(getSheet_(CONFIG.SHEETS.USERS));
  return ok(users.map(sanitizeUser_));
}

function User_create(payload) {
  requireRole_(payload, ['Admin']);
  const u = payload.user || {};
  if (!u.username || !u.password || !u.nama || !u.role) {
    return err('VALIDATION', 'username, password, nama, role wajib');
  }
  const sh = getSheet_(CONFIG.SHEETS.USERS);
  if (findRow_(sh, 'username', u.username)) {
    return err('DUPLICATE', 'Username sudah dipakai');
  }
  const now = new Date();
  const row = appendRow_(CONFIG.SHEETS.USERS, {
    id: Utilities.getUuid(),
    username: u.username,
    password: hashPassword_(u.password),
    nama: u.nama,
    email: u.email || '',
    jabatan: u.jabatan || '',
    role: u.role,
    unit: u.unit || '',
    active: true,
    createdAt: now,
    updatedAt: now
  });
  return ok(sanitizeUser_(row));
}

function User_update(payload) {
  requireRole_(payload, ['Admin']);
  const u = payload.user || {};
  if (!u.id) return err('VALIDATION', 'id user wajib');
  const patch = {
    nama: u.nama,
    email: u.email,
    jabatan: u.jabatan,
    role: u.role,
    unit: u.unit,
    active: u.active !== false
  };
  if (u.password) patch.password = hashPassword_(u.password);
  const upd = updateRowById_(CONFIG.SHEETS.USERS, u.id, patch);
  return ok(upd ? sanitizeUser_(upd) : null);
}

function User_delete(payload) {
  requireRole_(payload, ['Admin']);
  if (!payload.id) return err('VALIDATION', 'id wajib');
  const removed = deleteRowById_(CONFIG.SHEETS.USERS, payload.id);
  return ok({ removed: removed });
}
