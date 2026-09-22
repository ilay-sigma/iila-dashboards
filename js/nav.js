/* ---------------------------------------------------------------------------
   nav.js — סרגל צד + באנר עליון (v4, 21/09/2026, סגנון "Lector").
   סרגל הצד (מימין, RTL): לוגו על גרדיאנט, קישורי הדוחות עם אייקונים, כרטיס
   המשתמש, מתג בהיר/כהה ויציאה. הבאנר העליון: המבורגר (מובייל), "צפייה כ",
   זהות קצרה. הרשימה נבנית מהדפים שהרמה/המחלקה של המשתמש מורשית לראות
   (my_access.pages).

   מתג ערכת הנושא חזר לבקשת המשתמש (21/09) — הוא יושב בתחתית סרגל הצד, רחוק
   מבורר "צפייה כ" שבבאנר, כדי שלחיצה בטעות לא תקרה. הבחירה נשמרת ב-localStorage
   (dash.theme) ומוחלת מוקדם ע"י סקריפט קטן ב-<head> של כל דף, ואז ע"י auth.js.

   הסתרה לפי הרשאה (הסתרה בלבד — ההגנה היא ב-DB):
     [data-write]        — מוצג רק כשיש הרשאת כתיבה (סופר אדמין, לא בתצוגה מקדימה)
     [data-level="a,b"]  — מוצג רק לרמות ברשימה (super_admin / manager / staff)
     [data-roles="…"]    — תאימות לאחור: manager / front_consultant / phone_rep
--------------------------------------------------------------------------- */
(function () {
// --- דף ישן מהמטמון? ---------------------------------------------------------
// השרת החי לא תמיד שולח Cache-Control, והדפדפן שומר HTML ישן לפי ניחוש. publish.ps1
// מזריק לכל דף <meta name="build">; כאן שואלים את השרת (בלי מטמון) מה ה-build העדכני,
// ואם הדף שבדפדפן ישן — טוענים מחדש פעם אחת. עולה בקשה קטנה אחת לכל טעינת דף.
(async function staleGuard() {
  try {
    // בלי חותמת בדף = עותק ישן מלפני שהחותמת הוזרקה; בכל מקרה משווים מול השרת
    const mine = document.querySelector('meta[name="build"]')?.content || '';
    const key = 'dash.reloaded.' + location.pathname;
    const r = await fetch(location.pathname + '?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
    if (!r.ok) return;
    const m = (await r.text()).match(/<meta name="build" content="([^"]+)"/);
    if (m && m[1] !== mine && sessionStorage.getItem(key) !== m[1]) {
      sessionStorage.setItem(key, m[1]);
      location.reload();
    }
  } catch (_) { /* בלי רשת — ממשיכים עם מה שיש */ }
})();
'use strict';

const A = window.APP_AUTH;
const C = window.AUTH_CONFIG || {};
if (!A) return;

const page = A.page();
// המטמון של הדפדפן מגיש HTML ישן (השרת אינו שולח Cache-Control), ולכן כל מעבר בין
// דוחות נושא את חותמת ה-build — כתובת חדשה = טעינה טרייה.
const BUILD = document.querySelector('meta[name="build"]')?.content || '';
const withBuild = href => BUILD ? href + (href.includes('?') ? '&' : '?') + 'b=' + encodeURIComponent(BUILD) : href;
if (page === C.LOGIN_PAGE) return;

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- אייקונים (Lucide-style, קו 2px) — sprite אחד לכל הדף --------------------
const ICONS = {
  home:        'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  chart:       'M3 3v18h18M7 16v-5M12 16V8M17 16v-3',
  store:       'M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6',
  users:       'M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  phone:       'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z',
  pen:         'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  check:       'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  card:        'M2 5h20v14H2zM2 10h20',
  refresh:     'M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5',
  usercog:     'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  sun:         'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon:        'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  logout:      'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu:        'M3 6h18M3 12h18M3 18h18',
  eye:         'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  bell:        'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  sparkles:    'M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
  x:           'M18 6 6 18M6 6l12 12',
  chevR:       'M9 18l6-6-6-6',
  chevL:       'M15 18l-6-6 6-6',
};
const ico = (name, cls) => `<svg class="ico ${cls || ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
function injectSprite() {
  if (document.getElementById('dash-icons')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'dash-icons'; svg.setAttribute('aria-hidden', 'true'); svg.style.display = 'none';
  svg.innerHTML = Object.entries(ICONS).map(([k, d]) =>
    `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></symbol>`).join('');
  document.body.insertBefore(svg, document.body.firstChild);
}
const PAGE_ICON = {
  'index.html': 'chart', 'center.html': 'store', 'front-consultants.html': 'users', 'phone-reps.html': 'phone',
  'signatures.html': 'pen', 'completions.html': 'check', 'payments.html': 'card', 'sync-log.html': 'refresh', 'users.html': 'usercog',
};

// --- ערכת נושא ------------------------------------------------------------------
function themeButton() {
  const dark = A.theme === 'dark';
  return `<button class="theme-toggle" type="button" role="switch" aria-checked="${dark}" title="${dark ? 'מעבר לתצוגה בהירה' : 'מעבר לתצוגה כהה'}">` +
    `${ico('sun', 'sun')}${ico('moon', 'moon')}<span class="knob"></span></button>`;
}
function bindTheme(root) {
  root.querySelectorAll('.theme-toggle').forEach(b => b.addEventListener('click', () => {
    const next = A.theme === 'dark' ? 'light' : 'dark';
    A.setTheme(next);
    document.querySelectorAll('.theme-toggle').forEach(x => { x.setAttribute('aria-checked', next === 'dark'); x.title = next === 'dark' ? 'מעבר לתצוגה בהירה' : 'מעבר לתצוגה כהה'; });
    document.documentElement.classList.add('theme-anim');
    setTimeout(() => document.documentElement.classList.remove('theme-anim'), 700);
  }));
}

// --- סרגל צד ----------------------------------------------------------------------
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (parts[0] ? parts[0][0] : '') + (parts[1] ? parts[1][0] : '');
}
function renderSidebar(a) {
  document.querySelectorAll('.sidebar, .side-bg').forEach(el => el.remove());
  const pages = a.pages || [];
  const pageTitle = (p, acc) => {
    if (p.page !== 'center.html') return p.title;
    const d = (acc.departments || []).find(x => x.dept_key === acc.department);
    return d && ['office', 'cosmetics', 'mtl', 'mtl_active'].includes(d.dept_key) ? 'מכירות ' + d.title : p.title;
  };
  const lvl = a.level === 'super_admin' ? 'סופר אדמין' : a.level === 'manager' ? 'מנהל/ת' : 'חבר/ת צוות';
  const aside = document.createElement('aside');
  aside.className = 'sidebar'; aside.id = 'sidebar';
  aside.innerHTML =
    `<div class="side-brand"><a class="brand" href="${esc(a.landing || 'index.html')}" aria-label="אילה ברלין — Pro Cosmetics"></a>` +
      `<span class="side-name">מעקב המכירות</span>` +
      `<button class="side-collapse" type="button" aria-label="צמצום התפריט" aria-expanded="true" title="צמצום התפריט">${ico('chevR', 'cr')}${ico('chevL', 'cl')}</button></div>` +
    `<nav class="side-nav" aria-label="דוחות">` +
      pages.map((p, i) => `<a class="side-link${p.page === page ? ' active' : ''}" href="${esc(withBuild(p.page))}" style="--i:${i}" data-title="${esc(pageTitle(p, a))}">` +
        `<span class="side-ico">${ico(PAGE_ICON[p.page] || 'home')}</span><span class="side-lbl">${esc(pageTitle(p, a))}</span></a>`).join('') +
    `</nav>` +
    `<div class="side-foot">` +
      `<div class="side-user" title="${esc(a.email)}"><span class="avatar">${esc(initials(a.display_name || a.email))}</span>` +
        `<span class="who">${esc(a.display_name || a.email)}<em>${esc(a.impersonating ? 'בתצוגה כ' + a.role_title : a.role_title)}</em></span>` +
        `<span class="lvl">${esc(lvl)}</span></div>` +
      `<div class="side-actions">${themeButton()}<button class="side-out" type="button" data-title="יציאה">${ico('logout')}<span>יציאה</span></button></div>` +
    `</div>`;
  const bg = document.createElement('div'); bg.className = 'side-bg';
  document.body.appendChild(aside); document.body.appendChild(bg);
  document.body.classList.add('has-side');
  document.body.classList.remove('side-hidden');
  syncSide();
  const close = () => { document.body.classList.remove('side-open'); hideTip(); };
  bg.addEventListener('click', close);
  aside.querySelector('.side-collapse').addEventListener('click', () => {
    hideTip();
    // במסך צר הסרגל תמיד גלוי כמסילה, והכפתור פותח וסוגר את המגירה הרחבה
    if (narrow()) { document.body.classList.toggle('side-open'); return; }
    setRail(!document.body.classList.contains('side-rail'), true);
  });
  aside.querySelector('.side-out').addEventListener('click', () => A.signOut());
  aside.querySelectorAll('.side-link').forEach(l => l.addEventListener('click', close));
  bindRailTips(aside);
  bindTheme(aside);
}

// --- מצב מסילה: רק אייקונים, והכותרת מופיעה בריחוף --------------------------------
// אין יותר כפתור "סגירה" — הסרגל מצטמצם פנימה ונשאר נגיש. במסך צר הוא תמיד
// מסילה, כדי שלא יכסה את התוכן (היה קורה בדוח מתאמות הפגישות).
const SIDE_KEY = 'dash.side';
const narrow = () => window.matchMedia('(max-width:1100px)').matches;
function sidePref() {
  try { const v = localStorage.getItem(SIDE_KEY); return v === 'hidden' ? 'rail' : (v || 'open'); } catch (_) { return 'open'; }
}
function setRail(on, persist) {
  document.body.classList.toggle('side-rail', !!on);
  if (persist) { try { localStorage.setItem(SIDE_KEY, on ? 'rail' : 'open'); } catch (_) {} }
  const b = document.querySelector('.side-collapse');
  if (b) {
    const t = on ? 'הרחבת התפריט' : 'צמצום התפריט';
    b.setAttribute('aria-expanded', String(!on)); b.setAttribute('aria-label', t); b.title = t;
  }
}
function syncSide() { setRail(narrow() ? true : sidePref() === 'rail', false); }
window.addEventListener('resize', () => { syncSide(); hideTip(); });

let TIP = null;
function hideTip() { if (TIP) { TIP.remove(); TIP = null; } }
function railNow() { return document.body.classList.contains('side-rail') && !document.body.classList.contains('side-open'); }
function showTip(el, text) {
  hideTip();
  TIP = document.createElement('div'); TIP.className = 'side-tip'; TIP.textContent = text;
  document.body.appendChild(TIP);
  const r = el.getBoundingClientRect(), t = TIP.getBoundingClientRect();
  const rtl = getComputedStyle(document.documentElement).direction !== 'ltr';
  TIP.style.top = Math.max(8, Math.min(r.top + (r.height - t.height) / 2, innerHeight - t.height - 8)) + 'px';
  TIP.style.left = (rtl ? Math.max(8, r.left - t.width - 10) : Math.min(innerWidth - t.width - 8, r.right + 10)) + 'px';
  requestAnimationFrame(() => { if (TIP) TIP.classList.add('on'); });
}
function bindRailTips(root) {
  root.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-title]');
    if (el && railNow()) showTip(el, el.dataset.title);
  });
  root.addEventListener('mouseout', e => { if (e.target.closest('[data-title]')) hideTip(); });
  root.addEventListener('focusin', e => { const el = e.target.closest('[data-title]'); if (el && railNow()) showTip(el, el.dataset.title); });
  root.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });
}

// --- באנר עליון -------------------------------------------------------------------
function render(a) {
  if (!a || !a.authorized) return;
  const header = document.querySelector('header');
  if (!header) return;
  injectSprite();
  renderSidebar(a);

  header.querySelectorAll('.navbox, .menubtn').forEach(el => el.remove());
  const menu = document.createElement('button');
  menu.className = 'menubtn'; menu.type = 'button'; menu.setAttribute('aria-label', 'תפריט');
  menu.innerHTML = ico('menu');
  // במסך רחב הכפתור מסתיר/מציג את הסרגל (הבחירה נשמרת); במסך צר הוא פותח מגירה
  menu.addEventListener('click', () => {
    hideTip();
    if (narrow()) { document.body.classList.toggle('side-open'); return; }
    setRail(!document.body.classList.contains('side-rail'), true);
  });
  header.insertBefore(menu, header.firstChild);

  // "צפייה כ" — למנהלים ומעלה. הערך: level|dept|label
  const opts = a.can_impersonate ? (a.preview_options || []) : [];
  const cur  = a.impersonating ? `${a.level}|${a.department || ''}|${a.staff_label || ''}` : '';
  const grp = (title, items) => items.length ? `<optgroup label="${esc(title)}">${items.map(o => {
      const val = `${o.level}|${o.dept || ''}|${o.label || ''}`;
      return `<option value="${esc(val)}"${val === cur ? ' selected' : ''}>${esc(o.title)}</option>`; }).join('')}</optgroup>` : '';
  const viewAs = opts.length
    ? `<label class="navview-wrap" title="צפייה כתפקיד">${ico('eye')}<select class="navview" aria-label="צפייה כתפקיד">` +
      `<option value=""${cur ? '' : ' selected'}>עצמי — ${esc(a.real_role_title)}</option>` +
      grp('מנהל/ת מחלקה', opts.filter(o => o.level === 'manager')) +
      grp('חבר/ת צוות', opts.filter(o => o.level === 'staff')) + `</select></label>`
    : '';

  const box = document.createElement('span');
  box.className = 'navbox';
  box.innerHTML = viewAs +
    `<span class="navwho" title="${esc(a.email)}"><span class="avatar">${esc(initials(a.display_name || a.email))}</span>` +
    `<span class="navname">${esc(a.display_name || a.email)}<em>${esc(a.impersonating ? 'בתצוגה כ' + a.role_title : a.role_title)}</em></span></span>` +
    `<button class="iconbtn navout" type="button" title="יציאה" aria-label="יציאה">${ico('logout')}</button>`;
  header.appendChild(box);

  const vsel = box.querySelector('.navview');
  if (vsel) vsel.addEventListener('change', e => {
    const [level, dept, label] = (e.target.value || '').split('|');
    A.setViewAs(level || null, dept || null, label || null);
  });
  box.querySelector('.navout').addEventListener('click', () => A.signOut());

  renderPreviewBar(a);
}

function renderPreviewBar(a) {
  const old = document.querySelector('.previewbar');
  if (old) old.remove();
  if (!a.impersonating) return;
  const bar = document.createElement('div');
  bar.className = 'previewbar';
  bar.innerHTML =
    `<span>${ico('eye')} תצוגה מקדימה — רואים בדיוק את מה ש<b>${esc(a.role_title)}` +
    (a.staff_label ? ` · ${esc(a.staff_label)}` : '') +
    `</b> רואה, כולל סינון הנתונים. אין עריכה במצב הזה.</span>` +
    `<button class="btn ghost" type="button">חזרה לתצוגה שלי</button>`;
  bar.querySelector('button').addEventListener('click', () => A.setViewAs(null));
  document.body.insertBefore(bar, document.body.firstChild);
}

function applyVisibility(a) {
  const role = (a && a.role) || null, level = (a && a.level) || null, canWrite = !!(a && a.can_write);
  document.querySelectorAll('[data-roles]').forEach(el => {
    const allowed = el.dataset.roles.split(',').map(s => s.trim()).filter(Boolean);
    if (!role || !allowed.includes(role)) el.remove();
  });
  document.querySelectorAll('[data-level]').forEach(el => {
    const allowed = el.dataset.level.split(',').map(s => s.trim()).filter(Boolean);
    if (!level || !allowed.includes(level)) el.remove();
  });
  document.querySelectorAll('[data-write]').forEach(el => { if (!canWrite) el.remove(); });
}

function paint(a) { render(a); applyVisibility(a); document.dispatchEvent(new CustomEvent('access-ready', { detail: a })); }

// Esc סוגר את סרגל הצד במובייל
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.body.classList.remove('side-open'); hideTip(); } });

paint(A.access);
A.loadAccess(true).then(paint).catch(() => {});
})();
