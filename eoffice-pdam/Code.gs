/**
 * E-OFFICE PDAM - Main Router
 * =========================================================
 * Apps Script Web App entry point.
 * Routing by ?page= parameter.
 * =========================================================
 */

const APP_NAME = 'E-Office PDAM';
const APP_VERSION = '1.0.0';

/**
 * Web app GET handler - routes to the proper HTML page.
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'login';
  const allowed = [
    'login', 'dashboard',
    'surat-masuk', 'surat-keluar',
    'disposisi', 'tracking', 'detail',
    'scan', 'users', 'profile'
  ];

  const safePage = allowed.indexOf(page) >= 0 ? page : 'login';

  const tpl = HtmlService.createTemplateFromFile(safePage);
  tpl.page = safePage;
  tpl.params = e.parameter || {};
  tpl.webAppUrl = getWebAppUrl();

  return tpl.evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include another HTML file (for partials like styles/scripts/layout).
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Return current Web App deployment URL.
 */
function getWebAppUrl() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
}

/**
 * Global API entry-point so frontend can call one function
 * and dispatch by action name. This minimises `google.script.run`
 * binding complexity.
 */
function api(action, payload) {
  try {
    payload = payload || {};
    switch (action) {
      // ===== AUTH =====
      case 'auth.login':       return Auth_login(payload);
      case 'auth.logout':      return Auth_logout(payload);
      case 'auth.me':          return Auth_me(payload);

      // ===== SURAT MASUK =====
      case 'sm.list':          return SM_list(payload);
      case 'sm.get':           return SM_get(payload);
      case 'sm.create':        return SM_create(payload);
      case 'sm.update':        return SM_update(payload);
      case 'sm.delete':        return SM_delete(payload);

      // ===== SURAT KELUAR =====
      case 'sk.list':          return SK_list(payload);
      case 'sk.get':           return SK_get(payload);
      case 'sk.create':        return SK_create(payload);
      case 'sk.update':        return SK_update(payload);
      case 'sk.delete':        return SK_delete(payload);
      case 'sk.approve':       return SK_approve(payload);

      // ===== DISPOSISI =====
      case 'disp.list':        return Disp_list(payload);
      case 'disp.create':      return Disp_create(payload);
      case 'disp.respond':     return Disp_respond(payload);
      case 'disp.forward':     return Disp_forward(payload);

      // ===== TRACKING =====
      case 'track.timeline':   return Track_timeline(payload);
      case 'track.byBarcode':  return Track_byBarcode(payload);

      // ===== DASHBOARD =====
      case 'dash.stats':       return Dash_stats(payload);
      case 'dash.chart':       return Dash_chart(payload);
      case 'dash.recent':      return Dash_recent(payload);

      // ===== USERS =====
      case 'user.list':        return User_list(payload);
      case 'user.create':      return User_create(payload);
      case 'user.update':      return User_update(payload);
      case 'user.delete':      return User_delete(payload);

      // ===== SETUP =====
      case 'setup.init':       return Setup_init(payload);
      case 'setup.status':     return Setup_status(payload);

      default:
        return err('UNKNOWN_ACTION', 'Action tidak dikenal: ' + action);
    }
  } catch (ex) {
    Logger.log('API ERROR [' + action + ']: ' + ex);
    return err('EXCEPTION', String(ex && ex.message ? ex.message : ex));
  }
}

/**
 * Standard success response.
 */
function ok(data, meta) {
  return { ok: true, data: data || null, meta: meta || null };
}

/**
 * Standard error response.
 */
function err(code, message) {
  return { ok: false, error: { code: code, message: message } };
}
