/* ---------------------------------------------------------------------------
   auth.js — התחברות Google מול Supabase, שמירת סשן, וניתוב לפי תפקיד (v2).

   בלי ספריות חיצוניות: fetch גולמי. הזרימה היא PKCE — נשלח code_challenge
   ל-/auth/v1/authorize, והחזרה מטופלת גם כ-?code= (PKCE) וגם כ-#access_token=.

   v2 (18/09/2026):
   · שלוש רמות: super_admin / manager / staff + מחלקה. my_access מחזיר
     level, department, staff_label, can_write, pages, landing.
   · אין הגבלת דומיין: כל כתובת שרשומה ב-app.access נכנסת (גם ג'ימייל).
   · "צפייה כ": מנהלים ומעלה רואים כמו מנהל/ת מחלקה או כמו עובד/ת. הבחירה נשלחת
     גם ל-my_access וגם כ-headers על כל קריאת REST (x-view-as / x-view-dept /
     x-view-staff-b64) כדי שהסינון ב-DB יחול. בתצוגה מקדימה אין כתיבה.
   · רישום צפייה בדף (log_page_view) אחרי שהסשן וההרשאה אומתו.
   · ערכת נושא: בהיר כברירת מחדל (data-theme); מתג בסרגל הצד (nav.js) שומר ב-localStorage.

   הערה: השמירה האמיתית היא ב-DB (app.eff_level/eff_dept/eff_label בתוך
   התצוגות). ה-guard כאן הוא ניווט, לא אבטחה.
--------------------------------------------------------------------------- */
(function () {
'use strict';

// ערכת נושא: בהיר כברירת מחדל; "כהה" רק אם נבחר במפורש במתג שבסרגל הצד (nav.js,
// v4 21/09/2026) ונשמר ב-localStorage. המתג הוחזר לבקשת המשתמש והורחק מבורר
// "צפייה כ" כדי שלא ילחצו עליו בטעות. <head> של כל דף מחיל את הבחירה עוד לפני
// שהסקריפטים נטענים (בלי הבזק לבן), וכאן רק מוודאים ערך תקין.
function readTheme() { try { return localStorage.getItem('dash.theme') === 'dark' ? 'dark' : 'light'; } catch (_) { return 'light'; } }
document.documentElement.dataset.theme = readTheme();

const C = window.AUTH_CONFIG;
if (!C) { console.error('auth.js: חסר js/auth-config.js'); return; }

const SESSION_KEY = 'dash.session';
const ACCESS_KEY  = 'dash.access';
const VIEW_KEY    = 'dash.viewas';
const PKCE_KEY    = 'dash.pkce';

function readJSON(store, key) { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } }
function writeJSON(store, key, val) { if (val == null) store.removeItem(key); else store.setItem(key, JSON.stringify(val)); }

let session = readJSON(localStorage, SESSION_KEY);
let access  = readJSON(localStorage, ACCESS_KEY);
let viewAs  = readJSON(localStorage, VIEW_KEY);   // {level, dept, staff} או null
let timer   = null;

const issued = new Set();
if (session && session.access_token) issued.add(session.access_token);

function setSession(j) {
  if (!j || !j.access_token) return null;
  session = {
    access_token:  j.access_token,
    refresh_token: j.refresh_token || (session && session.refresh_token) || null,
    expires_at:    Math.floor(Date.now() / 1000) + Number(j.expires_in || 3600),
    email:         (j.user && j.user.email) || (session && session.email) || null,
  };
  issued.add(session.access_token);
  writeJSON(localStorage, SESSION_KEY, session);
  scheduleRefresh();
  return session.access_token;
}
function clearSession() {
  session = null; access = null; viewAs = null;
  localStorage.removeItem(SESSION_KEY); localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(VIEW_KEY);
  if (timer) { clearTimeout(timer); timer = null; }
}
function expired(skewSec) {
  if (!session || !session.expires_at) return true;
  return session.expires_at - (skewSec || 60) <= Math.floor(Date.now() / 1000);
}

// ------------------------------------------------------------------ קריאות API
function headers(extra) {
  const h = { apikey: C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  h.Authorization = 'Bearer ' + ((session && session.access_token) || C.SUPABASE_ANON_KEY);
  return Object.assign(h, extra || {});
}
async function rpc(name, body) {
  const r = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}) });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { /* טקסט חופשי */ }
  if (!r.ok) { const m = (j && (j.message || j.hint || j.error_description)) || txt || r.status; throw new Error(String(m)); }
  return j;
}

// ------------------------------------------------------------------ PKCE
function b64url(bytes) { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function randomVerifier() { const a = new Uint8Array(48); crypto.getRandomValues(a); return b64url(a); }
async function codeChallenge(verifier) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)); return b64url(new Uint8Array(d)); }

async function signInWithGoogle(next) {
  if (location.protocol === 'file:') throw new Error('התחברות עם Google לא עובדת מקובץ מקומי. יש לפתוח דרך השרת (https://…/login.html).');
  const verifier = randomVerifier();
  writeJSON(sessionStorage, PKCE_KEY, { v: verifier, next: next || null });
  const chal = await codeChallenge(verifier);
  const back = new URL(C.LOGIN_PAGE, location.href).toString();
  location.href = `${C.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}` +
                  `&code_challenge=${encodeURIComponent(chal)}&code_challenge_method=s256`;
}
function stripUrl() { history.replaceState(null, '', location.pathname); }

async function completeRedirect() {
  const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const qs   = new URLSearchParams(location.search);
  const pk   = readJSON(sessionStorage, PKCE_KEY) || {};
  const err = hash.get('error_description') || hash.get('error') || qs.get('error_description') || qs.get('error');
  if (err) { stripUrl(); sessionStorage.removeItem(PKCE_KEY); throw new Error(decodeURIComponent(err)); }
  if (hash.get('access_token')) {
    setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'), expires_in: hash.get('expires_in') });
    stripUrl(); sessionStorage.removeItem(PKCE_KEY);
    return pk.next || null;
  }
  const code = qs.get('code');
  if (code) {
    if (!pk.v) { stripUrl(); throw new Error('הסשן של ההתחברות אבד. נסי להתחבר שוב.'); }
    const r = await fetch(`${C.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
      method: 'POST', headers: { apikey: C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_code: code, code_verifier: pk.v }),
    });
    const j = await r.json().catch(() => ({}));
    stripUrl(); sessionStorage.removeItem(PKCE_KEY);
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || ('שגיאה ' + r.status));
    setSession(j);
    return pk.next || null;
  }
  return undefined;
}

// ------------------------------------------------------------------ רענון
async function refresh() {
  if (!session || !session.refresh_token) return null;
  try {
    const r = await fetch(`${C.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!r.ok) { clearSession(); return null; }
    return setSession(await r.json());
  } catch { return null; }
}
function scheduleRefresh() {
  if (timer) clearTimeout(timer);
  if (!session || !session.expires_at) return;
  const ms = Math.max(15000, (session.expires_at - 300) * 1000 - Date.now());
  timer = setTimeout(() => { refresh(); }, Math.min(ms, 2147483000));
}
async function ensureFresh() {
  if (!session) return null;
  if (expired(90)) return await refresh();
  return session.access_token;
}

// ------------------------------------------------------------------ ההרשאה
let accessInFlight = null;
async function loadAccess(force) {
  if (!session) return null;
  if (!force && access) return access;
  if (accessInFlight) return accessInFlight;
  accessInFlight = (async () => {
    try {
      const body = viewAs && viewAs.level
        ? { p_view_as: viewAs.level, p_view_dept: viewAs.dept || null, p_view_staff: viewAs.staff || null }
        : {};
      let a;
      try { a = await rpc('my_access', body); }
      catch (e) {
        if (!viewAs) throw e;
        viewAs = null; localStorage.removeItem(VIEW_KEY);
        a = await rpc('my_access', {});
      }
      // תצוגה מקדימה: השרת מחזיר את הרמה האפקטיבית ב-level ואת האמיתית ב-real_level
      access = a || null;
      writeJSON(localStorage, ACCESS_KEY, access);
      if (viewAs && access && !access.impersonating) { viewAs = null; localStorage.removeItem(VIEW_KEY); }
      return access;
    } finally { accessInFlight = null; }
  })();
  return accessInFlight;
}

// מעבר ל"צפייה כ" (level='manager'|'staff', dept, staff) או חזרה לעצמי (null)
async function setViewAs(level, dept, staff) {
  viewAs = level ? { level, dept: dept || null, staff: staff || null } : null;
  writeJSON(localStorage, VIEW_KEY, viewAs);
  access = null; localStorage.removeItem(ACCESS_KEY);
  const a = await loadAccess(true);
  // חותמת זמן בכתובת — השרת אינו שולח Cache-Control, והכניסה חייבת לנחות על גרסה טרייה
  const dest = (a && a.landing) || C.LOGIN_PAGE;
  location.href = dest + (dest.includes('?') ? '&' : '?') + 'b=' + Date.now();
}
function allowedHere(a, page) { return !!(a && a.authorized && (a.pages || []).some(p => p.page === page)); }

async function signOut(redirect) {
  try { if (session && session.access_token) await fetch(`${C.SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: headers() }); } catch {}
  clearSession();
  if (redirect !== false) location.replace(C.LOGIN_PAGE);
}

// ------------------------------------------------------------------ guard
function currentPage() { const p = location.pathname.split('/').pop(); return p && p.length ? p : 'index.html'; }
function goLogin(reason, page) { location.replace(`${C.LOGIN_PAGE}?${reason}=${encodeURIComponent(page)}`); }

let viewLogged = false;
function logPageView(a) {
  if (viewLogged || !a || !a.authorized || a.impersonating) return;
  viewLogged = true;
  rpc('log_page_view', { p_page: currentPage() }).catch(() => {});
}

function guard() {
  const page = currentPage();
  if (page === C.LOGIN_PAGE || page === C.NOT_FOUND_PAGE) return;
  if (!session || !session.refresh_token) return goLogin('next', page);
  if (expired(30)) return goLogin('next', page);
  if (!allowedHere(access, page)) return goLogin('denied', page);
  loadAccess(true)
    .then(a => { if (!allowedHere(a, page)) goLogin('denied', page); else logPageView(a); })
    .catch(() => { /* תקלת רשת לא מעיפה מהדף */ });
}

// ------------------------------------------------------------------ headers על כל קריאת REST
const REST_PREFIX = C.SUPABASE_URL + '/rest/v1/';
function putHeader(h, name, value) { if (typeof Headers !== 'undefined' && h instanceof Headers) h.set(name, value); else h[name] = value; }
function b64utf8(s) { const bytes = new TextEncoder().encode(String(s)); let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin); }

const nativeFetch = window.fetch.bind(window);
window.fetch = function (input, init) {
  try {
    if (viewAs && viewAs.level && typeof input === 'string' && input.startsWith(REST_PREFIX)) {
      if (!init) init = {};
      if (!init.headers) init.headers = {};
      putHeader(init.headers, 'x-view-as', viewAs.level);
      if (viewAs.dept)  putHeader(init.headers, 'x-view-dept', viewAs.dept);
      if (viewAs.staff) putHeader(init.headers, 'x-view-staff-b64', b64utf8(viewAs.staff));
    }
    const cur = session && session.access_token;
    if (cur && init && init.headers) {
      const want = 'Bearer ' + cur, h = init.headers;
      if (typeof Headers !== 'undefined' && h instanceof Headers) {
        const a = h.get('Authorization');
        if (a && a !== want && a.startsWith('Bearer ') && issued.has(a.slice(7))) h.set('Authorization', want);
      } else if (typeof h === 'object') {
        const key = ('Authorization' in h) ? 'Authorization' : (('authorization' in h) ? 'authorization' : null);
        const a = key && h[key];
        if (typeof a === 'string' && a !== want && a.startsWith('Bearer ') && issued.has(a.slice(7))) h[key] = want;
      }
    }
  } catch { /* לעולם לא להפיל בקשה בגלל התיקון הזה */ }
  return nativeFetch(input, init);
};

// ------------------------------------------------------------------ API
window.APP_AUTH = {
  config: C,
  get accessToken() { return (session && session.access_token) || null; },
  get email()       { return (session && session.email) || (access && access.email) || null; },
  get access()      { return access; },
  get viewAs()      { return viewAs; },
  get isSignedIn()  { return !!(session && session.access_token); },
  page: currentPage,
  signInWithGoogle, completeRedirect, refresh, ensureFresh,
  loadAccess, allowedHere, setViewAs, signOut, rpc, headers, guard,
  setTheme(t) {
    const v = (t === 'dark' ? 'dark' : 'light');
    document.documentElement.dataset.theme = v;
    try { localStorage.setItem('dash.theme', v); } catch (_) {}
  },
  get theme() { return document.documentElement.dataset.theme || 'light'; },
};

document.querySelectorAll('header a.brand').forEach(a => { a.href = location.href; });
scheduleRefresh();
guard();
})();
