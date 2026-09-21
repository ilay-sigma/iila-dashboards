/* ---------------------------------------------------------------------------
   ui.js — הספרייה המשותפת של הדשבורדים (v2, 18/09/2026).

   REST/RPC מול Supabase, פורמטים (₪, K, %), "?" עם הסבר החישוב (explain.js),
   מונים מונפשים, גביעים, מדי ביצוע ומילוי יחסי, מודאל/טוסט/קונפטי, גרפי SVG
   (עמודות, קווים, קצב מול יעד) עם טולטיפ, ורישום צפייה בדף.

   נטען אחרי auth.js/nav.js ולפני הסקריפט של הדף. אין תלות בספריות חיצוניות.
--------------------------------------------------------------------------- */
(function () {
'use strict';

const CFG = window.AUTH_CONFIG || {};
const A = () => window.APP_AUTH || null;
const UI = {};

// ------------------------------------------------------------------ בסיס
UI.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
UI.reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
UI.debounce = (fn, ms=200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
UI.today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
UI.termRep  = 'מתאמת פגישות';
UI.termReps = 'מתאמות פגישות';

// ------------------------------------------------------------------ REST
UI.rest = async function (path, opts = {}) {
  const tok = (A() && A().accessToken) || CFG.SUPABASE_ANON_KEY;
  const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}`,
               'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { const j = await r.json(); msg = j.message || j.hint || j.details || j.error_description || msg; } catch (_) {}
    throw new Error(msg);
  }
  return r.status === 204 ? null : r.json();
};
UI.rpc = (name, body) => UI.rest(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body || {}) });

// ------------------------------------------------------------------ הרשאות
UI.access   = () => (A() && A().access) || {};
UI.level    = () => UI.access().level || null;
UI.dept     = () => UI.access().department || null;
UI.label    = () => UI.access().staff_label || null;
UI.canWrite = () => !!UI.access().can_write;
UI.isStaff  = () => UI.level() === 'staff';
// יעדים: סופר אדמין וגם מנהל/ת אמיתי/ת (לא ב"צפייה כ") — הצד השרתי (set_target) בודק גם מחלקה
UI.canEditTargets = () => ['super_admin', 'manager'].includes(UI.access().real_level || UI.level());   // גם בזמן "צפייה כ"
UI.isMgr    = () => UI.level() === 'super_admin' || UI.level() === 'manager';
UI.deptTitle = key => { const d = (UI.access().departments || []).find(x => x.dept_key === key); return d ? d.title : (key || ''); };

// מסתיר אלמנטים שדורשים הרשאת כתיבה ([data-write]) או רמה ([data-level="a,b"])
UI.applyVisibility = function (root) {
  const a = UI.access();
  (root || document).querySelectorAll('[data-write]').forEach(el => { if (!a.can_write) el.remove(); });
  (root || document).querySelectorAll('[data-level]').forEach(el => {
    const ok = el.dataset.level.split(',').map(s => s.trim()).includes(a.level);
    if (!ok) el.remove();
  });
};

UI.logView = function () {
  try {
    const a = UI.access();
    if (!a.authorized || a.impersonating) return;
    const page = A().page();
    UI.rpc('log_page_view', { p_page: page }).catch(() => {});
  } catch (_) {}
};

// ------------------------------------------------------------------ פורמטים
const nf0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });
UI.nf0 = nf0; UI.nf1 = nf1;
UI.HEB = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
UI.DOW = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
UI.DOW_FULL = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const isNil = v => v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v));
UI.money = v => isNil(v) ? '—' : `₪ ${nf0.format(Math.round(Number(v)))}`;
// בונוס שמקבלים: תמיד "₪ 5,000" (לא K), ירוק, עם נצנצים — כי זה כסף שמגיע לכיס
UI.bonusHtml = (v, opts = {}) => {
  if (isNil(v) || !Number(v)) return opts.zero ?? '<span class="dash">—</span>';
  return `<span class="bonus-win" title="בונוס">${UI.money(v)}</span>`;
};
UI.moneyS = v => isNil(v) ? '—' : `${Number(v) > 0 ? '+' : ''}₪ ${nf0.format(Math.round(Number(v)))}`;
UI.k = function (v, opts = {}) {                       // ₪ 12.3K — הפורמט של ריכוז מרכז
  if (isNil(v)) return '—';
  const n = Number(v), a = Math.abs(n), sign = n < 0 ? '−' : '';
  const cur = opts.plain ? '' : '₪ ';
  if (a >= 1e6) return `${cur}${sign}${nf1.format(a / 1e6)}M`;
  if (a >= 1000) return `${cur}${sign}${nf1.format(a / 1000)}K`;
  return `${cur}${sign}${nf0.format(a)}`;
};
UI.int = v => isNil(v) ? '—' : nf0.format(Number(v));
UI.one = v => isNil(v) ? '—' : nf1.format(Number(v));
UI.two = v => isNil(v) ? '—' : nf2.format(Number(v));
UI.pct = (v, d = 1) => isNil(v) ? '—' : `${(Number(v) * 100).toFixed(d)}%`;
UI.pctSigned = (v, d = 1) => isNil(v) ? '—' : `${Number(v) > 0 ? '+' : ''}${(Number(v) * 100).toFixed(d)}%`;
UI.dm  = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
UI.dmy = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}`; };
UI.dow = iso => { if (!iso) return ''; return UI.DOW[new Date(iso).getUTCDay()]; };
UI.heb = m => { if (!m) return ''; const d = new Date(m); return `${UI.HEB[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
UI.weekRange = function (iso) {           // '2026-09-13' → '13–19/9'
  if (!iso) return '';
  const a = new Date(iso + 'T00:00:00Z'), b = new Date(a.getTime() + 6 * 864e5);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()}/${b.getUTCMonth() + 1}`
    : `${a.getUTCDate()}/${a.getUTCMonth() + 1}–${b.getUTCDate()}/${b.getUTCMonth() + 1}`;
};
UI.shortMonth = m => { if (!m) return ''; const d = new Date(m); return `${UI.HEB[d.getUTCMonth()].slice(0, 3)}׳${String(d.getUTCFullYear()).slice(2)}`; };
UI.time = iso => !iso ? '—' : new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
UI.prevMonth = m => { const d = new Date(m); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); };
UI.nextMonth = m => { const d = new Date(m); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };
UI.thisMonth = () => UI.today().slice(0, 7) + '-01';
UI.fmt = (v, kind) => {
  switch (kind) {
    case 'money': return UI.money(v);
    case 'k': return UI.k(v);
    case 'int': return UI.int(v);
    case 'one': return UI.one(v);
    case 'pct': return UI.pct(v);
    case 'pct0': return UI.pct(v, 0);
    case 'pctS': return UI.pctSigned(v);
    case 'date': return UI.dm(v);
    default: return UI.esc(v);
  }
};

// ------------------------------------------------------------------ סטטוס / צבע הקצב
// ≥100% ירוק · 70%–100% כתום · <70% אדום (מסמך ההערות)
UI.paceCls = ratio => (isNil(ratio) ? '' : Number(ratio) >= 1 ? 'pos' : Number(ratio) >= 0.7 ? 'warn' : 'neg');
UI.paceWord = ratio => (isNil(ratio) ? '' : Number(ratio) >= 1 ? 'מעל היעד' : Number(ratio) >= 0.7 ? 'קרוב ליעד' : 'רחוק מהיעד');
UI.statusPill = (ratio, text) => `<span class="pill-status ${UI.paceCls(ratio)}"><span class="dot ${UI.paceCls(ratio)}"></span>${UI.esc(text ?? UI.paceWord(ratio))}</span>`;
// שורת "חודש שעבר" בתוך אריח: הערך הקודם והשינוי. בלי נתון קודם — שורה ריקה,
// ולא "0", כדי שלא ייראה כאילו חודש שעבר לא היה כלום.
UI.prevLine = function (cur, prev, fmt, label) {
  if (prev === null || prev === undefined || prev === '' || !isFinite(Number(prev)))
    return '<div class="prevline dash">אין נתון לחודש שעבר</div>';
  const f = fmt || UI.money, p = Number(prev), c = Number(cur) || 0, diff = c - p;
  const cls = diff > 0 ? 'pos' : diff < 0 ? 'neg' : '';
  const pctTxt = p ? `${diff >= 0 ? '▲' : '▼'} ${UI.pct(Math.abs(diff / p), 0)}` : '';
  return `<div class="prevline"><span class="lbl">${UI.esc(label || 'חודש שעבר')}</span>` +
         `<b>${f(p)}</b>${pctTxt ? ` <span class="${cls}">${pctTxt}</span>` : ''}</div>`;
};

UI.delta = (cur, prev) => (isNil(cur) || isNil(prev) || Number(prev) === 0) ? null : Number(cur) / Number(prev) - 1;
UI.deltaHtml = d => isNil(d) ? '<span class="dash">—</span>' : `<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${UI.pct(Math.abs(d), 1)}</span>`;

// ------------------------------------------------------------------ "?" — הסבר החישוב
let popEl = null, popKey = null;
UI.q = (key, extra) => window.EXPLAIN && window.EXPLAIN[key]
  ? `<button type="button" class="q" data-q="${UI.esc(key)}"${extra ? ` data-extra="${UI.esc(extra)}"` : ''} aria-label="הסבר החישוב" title="${UI.esc(window.EXPLAIN[key].t)}">?</button>` : '';
function showPop(btn) {
  const key = btn.dataset.q, ex = window.EXPLAIN && window.EXPLAIN[key];
  if (!ex) return;
  if (!popEl) {
    popEl = document.createElement('div'); popEl.className = 'pop'; popEl.setAttribute('role', 'dialog');
    document.body.appendChild(popEl);
  }
  if (popKey === key && popEl.classList.contains('show')) { hidePop(); return; }
  popKey = key;
  popEl.innerHTML = `<button class="x" type="button" aria-label="סגירה">×</button><h4>❔ ${UI.esc(ex.t)}</h4>` +
    `<p>${UI.esc(ex.d)}</p>` + (ex.f ? `<code>${UI.esc(ex.f)}</code>` : '') +
    (btn.dataset.extra ? `<p class="sub">${UI.esc(btn.dataset.extra)}</p>` : '');
  popEl.querySelector('.x').onclick = hidePop;
  const r = btn.getBoundingClientRect();
  popEl.style.visibility = 'hidden'; popEl.classList.add('show');
  const w = popEl.offsetWidth, h = popEl.offsetHeight;
  let left = r.right - w, top = r.bottom + 8;
  if (left < 8) left = 8;
  if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
  popEl.style.left = left + 'px'; popEl.style.top = top + 'px'; popEl.style.visibility = '';
  document.querySelectorAll('.q.open').forEach(b => b.classList.remove('open'));
  btn.classList.add('open');
}
function hidePop() { if (popEl) popEl.classList.remove('show'); popKey = null; document.querySelectorAll('.q.open').forEach(b => b.classList.remove('open')); }
document.addEventListener('click', e => {
  const b = e.target.closest('button.q');
  if (b) { e.preventDefault(); e.stopPropagation(); showPop(b); return; }
  if (popEl && !e.target.closest('.pop')) hidePop();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { hidePop(); UI.closeModal(); } });
window.addEventListener('scroll', hidePop, { passive: true });
UI.hidePop = hidePop;

// ------------------------------------------------------------------ מונים מונפשים
UI.countUp = function (root) {
  const els = (root || document).querySelectorAll('[data-count]');
  els.forEach(el => {
    const target = Number(el.dataset.count); const kind = el.dataset.fmt || 'int';
    if (!isFinite(target)) { el.textContent = UI.fmt(el.dataset.count, kind); return; }
    if (UI.reduced() || Math.abs(target) < 1) { el.textContent = UI.fmt(target, kind); return; }
    const t0 = performance.now(), dur = 900;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = UI.fmt(target * e, kind);
      if (p < 1) requestAnimationFrame(step); else el.textContent = UI.fmt(target, kind);
    };
    requestAnimationFrame(step);
  });
};

// ------------------------------------------------------------------ גביעים, פודיום, מדים
// שתי משפחות סמלים, כדי ששני דירוגים במקביל לא יתבלבלו זה בזה:
//   kind:'cup'   — גביעים (זהב/כסף/ארד ע"י צבע), למדד איכות כמו ממוצע לפגישה
//   kind:'medal' — מדליות, לכמות הכסף שהתקבל בפועל
UI.rank = function (i, opts = {}) {
  const kind = opts.kind === 'medal' ? 'medal' : 'cup';
  const icons = kind === 'medal' ? { 1: '🥇', 2: '🥈', 3: '🥉' } : { 1: '🏆', 2: '🏆', 3: '🏆' };
  const title = (kind === 'medal' ? 'מדליה' : 'גביע') + ' — מקום ' + i + (opts.what ? ' ב' + opts.what : '');
  if (i >= 1 && i <= 3)
    return `<span class="rank ${kind} r${i}" title="${UI.esc(title)}"><span class="cup">${icons[i]}</span>` +
           `${opts.noNum ? '' : `<span class="n">${i}</span>`}</span>` +
           (opts.me ? ' <span class="chip lemon wow">😊 וואו זו את!</span>' : '');
  if (opts.hideOthers) return '';
  return `<span class="rank rn"><span class="n">${i}</span></span>`;
};
// כוכב זהב למי שעברה סף — למשל 80% סגירת פגישות.
UI.star = (on, title) => on ? `<span class="goldstar" title="${UI.esc(title || '')}">⭐</span>` : '';
UI.podium = function (items, opts = {}) {
  const fmt = opts.fmt || UI.money;
  const icons = opts.kind === 'medal' ? ['', '🥇', '🥈', '🥉'] : ['', '🏆', '🏆', '🏆'];
  const p = (it, n) => it ? `<div class="p p${n} ${opts.kind === 'medal' ? 'medal' : 'cup'}"><span class="cup">${icons[n]}</span>` +
    `<div class="nm">${UI.esc(it.name)}${it.name === UI.label() ? ' <span class="chip lemon wow">😊 וואו זו את!</span>' : ''}</div><div class="vl">${fmt(it.value)}</div>${it.sub ? `<div class="sb">${UI.esc(it.sub)}</div>` : ''}</div>` : '<div></div>';
  return `<div class="podium">${p(items[0], 1)}${p(items[1], 2)}${p(items[2], 3)}</div>`;
};
UI.databar = function (v, max, cls, text) {
  const w = (!max || isNil(v)) ? 0 : Math.max(0, Math.min(100, Number(v) / Number(max) * 100));
  return `<span class="databar ${cls || 'accent'}" style="--w:${w.toFixed(1)}%"><span>${text ?? UI.money(v)}</span></span>`;
};
/* מספר בפועל ＋ תוספת שניתנה בתחרות = סה״כ.
   הפרס הוא הכרה בלבד — הקצב, היעד והאחוזים תמיד מחושבים לפי המספר בפועל. */
UI.plusComp = function (base, extra, fmt) {
  const f = fmt || UI.int, b = Number(base) || 0, e = Number(extra) || 0;
  if (!e) return f(b);
  return `<span class="pluscomp" title="בפועל ＋ תוספת מתחרות = סה״כ · הקצב והיעד מחושבים לפי המספר בפועל בלבד">` +
         `${f(b)}<i>＋ ${f(e)}</i> = <b>${f(b + e)}</b></span>`;
};
UI.meter = function (ratio, text) {
  const r = isNil(ratio) ? 0 : Number(ratio);
  return `<div class="meter"><span class="track"><span class="fill ${UI.paceCls(r)}" style="width:${Math.min(100, r * 100).toFixed(1)}%"></span></span>` +
         `<span class="pct">${text ?? UI.pct(r)}</span></div>`;
};
UI.progress = function (ratio, opts = {}) {
  const r = isNil(ratio) ? 0 : Number(ratio), w = Math.min(100, r * 100);
  const ms = [25, 50, 75, 100].map(m => `<span class="ms" style="right:${m}%" data-l="${m}%"></span>`).join('');
  const flag = opts.flag !== false ? `<span class="flag" style="right:${w}%">${opts.flagText ?? UI.pct(r, 0)}</span>` : '';
  return `<div class="progress" title="${UI.esc(opts.title || '')}"><span class="fill ${UI.paceCls(r)}" style="width:${w.toFixed(1)}%"></span>${ms}${flag}</div>`;
};

// ------------------------------------------------------------------ מודאל / טוסט / קונפטי
let modalEl = null;
UI.modal = function ({ title, body, footer, wide, onClose }) {
  UI.closeModal();
  modalEl = document.createElement('div'); modalEl.className = 'modal-bg';
  modalEl.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">` +
    `<div class="mh"><h3>${title || ''}</h3><button class="iconbtn" type="button" aria-label="סגירה">✕</button></div>` +
    `<div class="mb">${body || ''}</div>${footer ? `<div class="mf">${footer}</div>` : ''}</div>`;
  modalEl.addEventListener('click', e => { if (e.target === modalEl) UI.closeModal(); });
  modalEl.querySelector('.mh .iconbtn').onclick = UI.closeModal;
  modalEl._onClose = onClose;
  document.body.appendChild(modalEl);
  document.body.style.overflow = 'hidden';
  return modalEl;
};
UI.closeModal = function () {
  if (!modalEl) return;
  const cb = modalEl._onClose; modalEl.remove(); modalEl = null; document.body.style.overflow = '';
  if (cb) cb();
};
UI.modalBody = () => modalEl ? modalEl.querySelector('.mb') : null;
let toastEl = null, toastT = null;
UI.toast = function (msg, kind) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
  toastEl.className = 'toast ' + (kind || ''); toastEl.textContent = msg;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
};
UI.confetti = function (n = 70) {
  if (UI.reduced()) return;
  const cols = ['#F0157E', '#FFCF5C', '#1FA774', '#7A5AF8', '#2F86EB', '#FF6FAE', '#EA6A3F'];
  const box = document.createElement('div'); box.className = 'spark';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.background = cols[i % cols.length];
    s.style.animationDuration = (1.4 + Math.random() * 1.4) + 's';
    s.style.animationDelay = (Math.random() * .4) + 's';
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3200);
};
UI.celebrateOnce = function (key) {
  try { const k = 'dash.celebrated.' + key; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (_) {}
  UI.confetti();
};

// ------------------------------------------------------------------ טאבים
UI.tabs = function (navEl, onChange) {
  const nav = typeof navEl === 'string' ? document.querySelector(navEl) : navEl;
  if (!nav) return;
  const activate = (name, fire = true) => {
    const btns = [...nav.querySelectorAll('button[data-tab]')];
    const b = btns.find(x => x.dataset.tab === name) || btns[0];
    if (!b) return;
    btns.forEach(x => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('section[id^="tab-"]').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + b.dataset.tab));
    if (fire && onChange) onChange(b.dataset.tab);
    try { history.replaceState(null, '', '#' + b.dataset.tab); } catch (_) {}
    hidePop();
  };
  nav.addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) activate(b.dataset.tab); });
  const h = (location.hash || '').slice(1);
  if (h && nav.querySelector(`button[data-tab="${h}"]`)) activate(h, false);
  return { activate, current: () => (nav.querySelector('button[aria-selected="true"]') || {}).dataset?.tab };
};

// ------------------------------------------------------------------ בורר חודשים
UI.fillMonths = function (sel, months, cur) {
  sel.innerHTML = months.map(m => `<option value="${m}">${UI.heb(m)}</option>`).join('');
  if (cur && months.includes(cur)) sel.value = cur;
};

// ------------------------------------------------------------------ טולטיפ לגרפים
let tipEl = null;
function tip(html, x, y) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chart-tip'; document.body.appendChild(tipEl); }
  tipEl.innerHTML = html;
  tipEl.classList.add('show');
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let left = x - w / 2, top = y - h - 14;
  if (left < 6) left = 6; if (left + w > window.innerWidth - 6) left = window.innerWidth - w - 6;
  if (top < 6) top = y + 16;
  tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
}
function untip() { if (tipEl) tipEl.classList.remove('show'); }
UI.tip = tip; UI.untip = untip;

// ------------------------------------------------------------------ גרפים
UI.chart = {};
const CSER = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
UI.chart.colors = CSER;

// מדרגות מול יעד (עיקרון "מירוץ היעד"): גובה = המספר, צבע = המצב. ≥100% ירוק עם הילה
// וסימון וי · 75–99% זהב · 50–74% סגול · <50% אפור שקט (לא מאשים). כל מדרגה נקראת גם בטקסט.
UI.TIERS = [
  { min: 1.00, cls: 't4', name: 'יעד הושג',     range: '100% ומעלה' },
  { min: 0.75, cls: 't3', name: 'כמעט ביעד',    range: '75–99%' },
  { min: 0.50, cls: 't2', name: 'בתנופה',       range: '50–74%' },
  { min: 0,    cls: 't1', name: 'בתחילת הדרך',  range: '0–49%' },
];
UI.tier = ratio => { const r = Number(ratio); if (!isFinite(r)) return null; return UI.TIERS.find(t => r >= t.min) || UI.TIERS[UI.TIERS.length - 1]; };
UI.tierCls = ratio => { const t = UI.tier(ratio); return t ? t.cls : ''; };
UI.tierName = ratio => { const t = UI.tier(ratio); return t ? t.name : ''; };
UI.gapText = (ratio, fmtPct) => {
  const r = Number(ratio); if (!isFinite(r)) return '';
  const d = Math.round((r - 1) * 100);
  return d > 0 ? `${d}% מעל היעד` : d === 0 ? 'בדיוק על קו היעד' : `חסרים ${Math.abs(d)}% ליעד`;
};
UI.tierLegend = () => `<div class="chart-legend tiers">` + UI.TIERS.map(t =>
  `<span><span class="sw ${t.cls}"></span>${t.name} <em>${t.range}</em></span>`).join('') + `</div>`;

// עמודות: items=[{label, value, cls?, sub?, sel?, goal?}] · RTL: הראשון מימין
// goal: מספר (קו יעד אחד) או פונקציה(item)→מספר (יעד לכל עמודה — מסומן בקו קצר).
// עם goal הצבע נקבע לפי המדרגה (tiers) אלא אם tiers:false.
UI.chart.bars = function (host, { items, fmt, yfmt, title, height = 300, labelAll = true, colorBy, goal, goalLabel, tiers, tracks }) {
  host = typeof host === 'string' ? document.querySelector(host) : host;
  if (!items || !items.length) { host.innerHTML = '<div class="empty">אין נתונים</div>'; return; }
  const f = fmt || UI.money, yf = yfmt || (v => UI.k(v, { plain: true }));
  const goalOf = typeof goal === 'function' ? goal : (goal != null ? () => Number(goal) : null);
  const useTiers = goalOf ? tiers !== false : !!tiers;
  const oneGoal = goalOf && typeof goal !== 'function' ? Number(goal) : null;
  const W = 900, H = height, ML = 12, MR = 70, MT = oneGoal ? 34 : 26, MB = 40, iw = W - ML - MR, ih = H - MT - MB;
  const vals = items.map(i => Number(i.value) || 0);
  const goals = goalOf ? items.map(it => { const g = Number(goalOf(it)); return isFinite(g) && g > 0 ? g : null; }) : [];
  let max = Math.max(...vals, 0, ...goals.filter(Boolean)), min = Math.min(...vals, 0);
  if (goalOf) max = max * 1.08;                                   // אוויר מעל קו היעד
  const span = (max - min) || 1;
  const y = v => MT + ih - ((v - min) / span) * ih, zero = y(0);
  const step = iw / items.length, bw = Math.min(56, step * .62);
  const grid = [0, .25, .5, .75, 1].map(fr => { const t = min + span * fr;
    return `<line class="gridline" x1="${ML}" x2="${ML + iw}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>` +
           `<text class="axis" x="${ML + iw + 8}" y="${(y(t) + 4).toFixed(1)}">${yf(t)}</text>`; }).join('');
  // קו היעד: אזור עדין מעליו, קו זהוב, ותווית גלולה בקצה השמאלי
  let goalSvg = '';
  if (oneGoal) {
    const gy = y(oneGoal);
    const lbl = goalLabel || ('קו היעד · ' + yf(oneGoal));
    goalSvg = `<rect class="goal-zone" x="${ML}" y="${MT}" width="${iw}" height="${Math.max(0, gy - MT).toFixed(1)}" rx="6"/>` +
      `<line class="goal" x1="${ML}" x2="${ML + iw}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}"/>` +
      `<g class="goal-pill" transform="translate(${ML + 8},${(gy - 12).toFixed(1)})"><rect rx="12" ry="12" width="${(lbl.length * 7.6 + 26).toFixed(0)}" height="24"/><text x="13" y="16.5">${UI.esc(lbl)}</text></g>`;
  }
  const bars = items.map((it, i) => {
    const cx = ML + iw - (i + .5) * step;                     // RTL
    const v = vals[i], top = y(Math.max(v, 0)), h = Math.max(2, Math.abs(zero - y(v)));
    const g = goals[i], ratio = g ? v / g : null;
    const tier = useTiers && ratio != null ? UI.tier(ratio) : null;
    const cls = (tier ? tier.cls : '') || it.cls || (colorBy ? colorBy(it, i) : '') || '';
    const style = it.color && !tier ? ` style="fill:${it.color}"` : '';
    const track = (tracks || useTiers) ? `<rect class="track" x="${(cx - bw / 2).toFixed(1)}" y="${MT}" width="${bw.toFixed(1)}" height="${ih}" rx="4" ry="4"></rect>` : '';
    const tick = (g && oneGoal == null) ? `<line class="goal-tick" x1="${(cx - bw / 2 - 4).toFixed(1)}" x2="${(cx + bw / 2 + 4).toFixed(1)}" y1="${y(g).toFixed(1)}" y2="${y(g).toFixed(1)}"/>` : '';
    const check = tier && tier.cls === 't4' ? `<path class="goal-check" d="M${(cx + 4).toFixed(1)} ${(top - 20).toFixed(1)} l3 3 l6 -6" />` : '';
    const lblX = tier && tier.cls === 't4' ? cx - 4 : cx;
    return `<g data-i="${i}">${track}<rect class="bar ${cls}${it.sel ? ' sel' : ''}"${style} x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" ry="4"></rect>${tick}` +
      (labelAll || it.sel ? `<text class="val" x="${lblX.toFixed(1)}" y="${(top - 7).toFixed(1)}" text-anchor="middle">${yf(v)}</text>${check}` : '') +
      `<text class="axis" x="${cx.toFixed(1)}" y="${(MT + ih + 18).toFixed(1)}" text-anchor="middle">${UI.esc(it.label)}</text>` +
      (tier ? `<text class="axis tiername ${tier.cls}" x="${cx.toFixed(1)}" y="${(MT + ih + 32).toFixed(1)}" text-anchor="middle">${tier.name}</text>` : '') +
      `<rect class="hit" x="${(cx - step / 2).toFixed(1)}" y="${MT}" width="${step.toFixed(1)}" height="${ih}"></rect></g>`;
  }).join('');
  const Hh = useTiers ? H + 14 : H;
  host.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${UI.esc(title || '')}"${useTiers ? ' class="tiered"' : ''}>${grid}${goalSvg}<line class="gridline" x1="${ML}" x2="${ML + iw}" y1="${zero.toFixed(1)}" y2="${zero.toFixed(1)}"/>${bars}</svg>` +
    (useTiers ? UI.tierLegend() : '');
  host.querySelectorAll('g[data-i]').forEach(g => {
    const i = Number(g.dataset.i), it = items[i], gl = goals[i], ratio = gl ? vals[i] / gl : null, tier = ratio != null ? UI.tier(ratio) : null;
    g.addEventListener('mousemove', e => tip(`<div>${UI.esc(it.label)}</div><b>${f(it.value)}</b>` +
      (tier ? `<div class="sub tierline"><span class="sw ${tier.cls}"></span>${tier.name} · ${UI.gapText(ratio)}</div>` : '') +
      (it.sub ? `<div class="sub">${UI.esc(it.sub)}</div>` : ''), e.clientX, e.clientY));
    g.addEventListener('mouseleave', untip);
    if (it.onClick) { g.style.cursor = 'pointer'; g.addEventListener('click', () => it.onClick(it)); }
  });
};

// צבע לסדרה מספר i — שש צבעי הבסיס, ואז אותם צבעים בגוון בהיר יותר
UI.chart.seriesColor = i => i < CSER.length ? CSER[i] : `color-mix(in srgb, ${CSER[i % CSER.length]} 55%, #ffffff)`;

// עמודות מוערמות: labels=[...], series=[{name, values:[...], color?}] · RTL: הראשון מימין
// כל עמודה מחולקת לפי הסדרות, עם מקרא וטולטיפ שמפרט מי תרם כמה.
UI.chart.stacked = function (host, { labels, series, fmt, yfmt, title, height = 300, legend = true }) {
  host = typeof host === 'string' ? document.querySelector(host) : host;
  if (!host) return;
  const f = fmt || UI.money, yf = yfmt || (v => UI.k(v, { plain: true }));
  const cols = (labels || []).length, ser = (series || []).filter(s => s && s.values);
  if (!cols || !ser.length) { host.innerHTML = '<div class="empty">אין נתונים</div>'; return; }
  const val = (s, i) => Math.max(0, Number(s.values[i]) || 0);
  const totals = labels.map((_, i) => ser.reduce((a, s) => a + val(s, i), 0));
  const max = Math.max(...totals, 0) || 1;
  const W = 900, H = height, ML = 12, MR = 70, MT = 26, MB = 40, iw = W - ML - MR, ih = H - MT - MB;
  const y = v => MT + ih - (v / max) * ih;
  const step = iw / cols, bw = Math.min(56, step * .62);
  const grid = [0, .25, .5, .75, 1].map(fr => { const t = max * fr;
    return `<line class="gridline" x1="${ML}" x2="${ML + iw}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>` +
           `<text class="axis" x="${ML + iw + 8}" y="${(y(t) + 4).toFixed(1)}">${yf(t)}</text>`; }).join('');
  const cells = labels.map((lbl, i) => {
    const cx = ML + iw - (i + .5) * step;                       // RTL: הראשון מימין
    let acc = 0;
    const segs = ser.map((s, si) => {
      const v = val(s, i); if (v <= 0) return '';
      const y0 = y(acc), y1 = y(acc + v); acc += v;
      const h = Math.max(1, y0 - y1);
      const rect = `<rect class="seg" data-s="${si}" x="${(cx - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" style="fill:${s.color || UI.chart.seriesColor(si)}"></rect>`;
      // שם בתוך המקטע — רק אם יש מקום, וגודל הכתב לפי גודל המקטע (מכירה גדולה = שם גדול)
      let name = '';
      if (h >= 13) {
        const fs = Math.max(8, Math.min(15, h * 0.4));
        const fits = txt => txt.length * fs * 0.52 <= bw - 6;
        const full = String(s.name || ''), first = full.split(/\s+/)[0];
        const txt = fits(full) ? full : (fits(first) ? first : '');
        if (txt) name = `<text class="segname" x="${cx.toFixed(1)}" y="${(y1 + h / 2 + fs * 0.35).toFixed(1)}" text-anchor="middle" style="font-size:${fs.toFixed(1)}px">${UI.esc(txt)}</text>`;
      }
      return rect + name;
    }).join('');
    const top = y(totals[i]);
    return `<g data-i="${i}">${segs}` +
      `<text class="val" x="${cx.toFixed(1)}" y="${(top - 7).toFixed(1)}" text-anchor="middle">${totals[i] ? yf(totals[i]) : ''}</text>` +
      `<text class="axis" x="${cx.toFixed(1)}" y="${(MT + ih + 18).toFixed(1)}" text-anchor="middle">${UI.esc(lbl)}</text>` +
      `<rect class="hit" x="${(cx - step / 2).toFixed(1)}" y="${MT}" width="${step.toFixed(1)}" height="${ih}"></rect></g>`;
  }).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${UI.esc(title || '')}" class="stacked">${grid}${cells}</svg>` +
    (legend ? `<div class="chart-legend">` + ser.map((s, si) =>
      `<span data-s="${si}"><span class="sw" style="background:${s.color || UI.chart.seriesColor(si)}"></span>${UI.esc(s.name)}</span>`).join('') + `</div>` : '');
  const svg = host.querySelector('svg');
  host.querySelectorAll('g[data-i]').forEach(g => {
    const i = Number(g.dataset.i);
    const parts = ser.map((s, si) => ({ name: s.name, v: val(s, i), si })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    g.addEventListener('mousemove', e => tip(`<div>${UI.esc(labels[i])}</div><b>${f(totals[i])}</b>` +
      parts.map(x => `<div class="sub"><span class="sw" style="background:${ser[x.si].color || UI.chart.seriesColor(x.si)}"></span>${UI.esc(x.name)} · ${f(x.v)}</div>`).join(''), e.clientX, e.clientY));
    g.addEventListener('mouseleave', untip);
  });
  // ריחוף על המקרא מדגיש את הסדרה בכל העמודות
  host.querySelectorAll('.chart-legend span[data-s]').forEach(el => {
    const si = el.dataset.s;
    el.addEventListener('mouseenter', () => svg.querySelectorAll('rect.seg').forEach(r => r.classList.toggle('dim', r.dataset.s !== si)));
    el.addEventListener('mouseleave', () => svg.querySelectorAll('rect.seg').forEach(r => r.classList.remove('dim')));
  });
};

// קווים (נקודות מחוברות): labels=[...], series=[{name, values:[...], color?, dashed?}] · RTL: הראשון מימין
// callout: כיתוב קבוע בתוך גוף הגרף — {text, sub, tone:'pos'|'warn'|'neg'}.
// יושב בפינה הימנית-עליונה (תחילת החודש ב-RTL), שם הקווים עדיין נמוכים והמקום פנוי.
UI.chart.lines = function (host, { labels, series, fmt, yfmt, title, height = 300, area = false, legend = true, minZero = true, showValues, callout }) {
  host = typeof host === 'string' ? document.querySelector(host) : host;
  const svgHost = host;
  if (!labels || !labels.length || !series || !series.length) { svgHost.innerHTML = '<div class="empty">אין נתונים</div>'; return; }
  const f = fmt || UI.money, yf = yfmt || (v => UI.k(v, { plain: true }));
  const W = 900, H = height, ML = 12, MR = 70, MT = 20, MB = 40, iw = W - ML - MR, ih = H - MT - MB;
  const all = series.flatMap(s => s.values).map(Number).filter(isFinite);
  let max = Math.max(...all, 0), min = minZero ? Math.min(0, ...all) : Math.min(...all);
  if (max === min) max = min + 1;
  const span = max - min;
  const y = v => MT + ih - ((v - min) / span) * ih;
  const n = labels.length, step = n > 1 ? iw / (n - 1) : 0;
  const x = i => ML + iw - i * step;                                // RTL
  const grid = [0, .25, .5, .75, 1].map(fr => { const t = min + span * fr;
    return `<line class="gridline" x1="${ML}" x2="${ML + iw}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>` +
           `<text class="axis" x="${ML + iw + 8}" y="${(y(t) + 4).toFixed(1)}">${yf(t)}</text>`; }).join('');
  const every = Math.max(1, Math.ceil(n / 14));
  const xl = labels.map((l, i) => (i % every === 0 || i === n - 1) ? `<text class="axis" x="${x(i).toFixed(1)}" y="${MT + ih + 18}" text-anchor="middle">${UI.esc(l)}</text>` : '').join('');
  const paths = series.map((s, si) => {
    const col = s.color || CSER[si % CSER.length];
    const pts = s.values.map((v, i) => (v === null || v === undefined || !isFinite(Number(v))) ? null : [x(i), y(Number(v))]);
    let d = '', started = false;
    pts.forEach(p => { if (!p) { started = false; return; } d += (started ? ' L' : ' M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); started = true; });
    const areaD = area && pts.filter(Boolean).length ? d + ` L${pts.filter(Boolean).slice(-1)[0][0].toFixed(1)} ${y(min).toFixed(1)} L${pts.filter(Boolean)[0][0].toFixed(1)} ${y(min).toFixed(1)} Z` : '';
    const dots = pts.map((p, i) => p ? `<circle class="dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${n > 40 ? 2.5 : 4}" style="fill:${col}"/>` : '').join('');
    // הערך מודפס ליד הנקודה. ברירת המחדל: כשיש עד שתי סדרות ועד 14 נקודות —
    // מעבר לזה המספרים נדחסים זה על זה ומזיקים יותר משהם עוזרים.
    const wantVals = showValues === undefined ? (series.length <= 2 && n <= 14) : !!showValues;
    const vals = (wantVals && !s.noValues && !s.noDots) ? pts.map((p, i) => {
      if (!p) return '';
      const above = p[1] > MT + 22;                       // קרוב לתקרה? להדפיס מתחת
      // הנקודה הראשונה יושבת על הציר הימני והאחרונה על השמאלי — שם התווית
      // מוסטת פנימה, אחרת היא נחתכת או נופלת על מספרי הציר.
      const anchor = i === 0 ? 'end' : (i === n - 1 ? 'start' : 'middle');
      const dx = i === 0 ? -6 : (i === n - 1 ? 6 : 0);
      return `<text class="val pt" x="${(p[0] + dx).toFixed(1)}" y="${(above ? p[1] - 10 : p[1] + 18).toFixed(1)}" text-anchor="${anchor}">${UI.esc(yf(s.values[i]))}</text>`;
    }).join('') : '';
    return (areaD ? `<path class="area" d="${areaD}" style="fill:${col}"/>` : '') +
           `<path class="line ${s.dashed ? 'dashed' : ''}" d="${d}" style="stroke:${col}"/>${s.noDots ? '' : dots}${vals}`;
  }).join('');
  const hits = labels.map((l, i) => `<rect class="hit" data-i="${i}" x="${(x(i) - step / 2).toFixed(1)}" y="${MT}" width="${Math.max(step, 6).toFixed(1)}" height="${ih}"></rect>`).join('');
  svgHost.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${UI.esc(title || '')}">${grid}${xl}${paths}<line class="xline" id="xl" x1="0" x2="0" y1="${MT}" y2="${MT + ih}" style="opacity:0"/>${hits}</svg>` +
    (legend && series.length > 1 ? `<div class="chart-legend">${series.map((s, si) => `<span><span class="sw" style="background:${s.color || CSER[si % CSER.length]}"></span>${UI.esc(s.name)}</span>`).join('')}</div>` : '') +
    (callout && callout.text ? `<div class="chart-callout ${callout.tone || ''}"${callout.title ? ` title="${UI.esc(callout.title)}"` : ''}><b>${UI.esc(callout.text)}</b>${callout.sub ? `<span>${UI.esc(callout.sub)}</span>` : ''}</div>` : '');
  const xline = svgHost.querySelector('#xl');
  svgHost.querySelectorAll('rect.hit').forEach(r => {
    const i = Number(r.dataset.i);
    r.addEventListener('mousemove', e => {
      xline.setAttribute('x1', x(i)); xline.setAttribute('x2', x(i)); xline.style.opacity = 1;
      const rows = series.map((s, si) => `<div><span class="sw" style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${s.color || CSER[si % CSER.length]};margin-inline-end:6px"></span>${UI.esc(s.name)}: <b>${f(s.values[i])}</b></div>`).join('');
      tip(`<div class="sub">${UI.esc(labels[i])}</div>${rows}`, e.clientX, e.clientY);
    });
    r.addEventListener('mouseleave', () => { xline.style.opacity = 0; untip(); });
  });
};

// קצב מול יעד: days=[{date, actual (מצטבר), required (נדרש מצטבר)}], target, pace
UI.chart.pace = function (host, { days, target, pace, fmt, title }) {
  const labels = days.map(d => UI.dm(d.date));
  const series = [
    { name: 'מצטבר בפועל', values: days.map(d => d.actual), color: 'var(--c1)' },
    { name: 'נדרש ליעד', values: days.map(d => d.required), color: 'var(--c3)', dashed: true, noDots: true },
  ];
  if (pace && days.length) {
    const p = days.map((d, i) => (i === days.length - 1 ? pace : null));
    series.push({ name: 'קצב (צפי)', values: p, color: 'var(--c4)' });
  }
  UI.chart.lines(host, { labels: labels.slice().reverse().reverse(), series, fmt: fmt || UI.money, title, area: true, minZero: true });
};

// עמודות מקובצות בשתי סדרות (למשל קצב מול יעד לפי מחלקה)
UI.chart.pairs = function (host, { items, names, fmt, yfmt, title, height = 300 }) {
  host = typeof host === 'string' ? document.querySelector(host) : host;
  if (!items || !items.length) { host.innerHTML = '<div class="empty">אין נתונים</div>'; return; }
  const f = fmt || UI.money, yf = yfmt || (v => UI.k(v, { plain: true }));
  const W = 900, H = height, ML = 12, MR = 70, MT = 26, MB = 40, iw = W - ML - MR, ih = H - MT - MB;
  const vals = items.flatMap(i => [Number(i.a) || 0, Number(i.b) || 0]);
  const max = Math.max(...vals, 0), min = 0, span = (max - min) || 1;
  const y = v => MT + ih - ((v - min) / span) * ih, zero = y(0);
  const step = iw / items.length, bw = Math.min(26, step * .3);
  const grid = [0, .25, .5, .75, 1].map(fr => { const t = min + span * fr;
    return `<line class="gridline" x1="${ML}" x2="${ML + iw}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="axis" x="${ML + iw + 8}" y="${(y(t) + 4).toFixed(1)}">${yf(t)}</text>`; }).join('');
  const g = items.map((it, i) => {
    const cx = ML + iw - (i + .5) * step;
    const ba = `<rect class="bar ${it.clsA || ''}" style="fill:${it.colorA || 'var(--c1)'}" x="${(cx - bw - 2).toFixed(1)}" y="${y(Math.max(it.a, 0)).toFixed(1)}" width="${bw}" height="${Math.max(2, zero - y(it.a)).toFixed(1)}" rx="4"/>`;
    const bb = `<rect class="bar" style="fill:${it.colorB || 'var(--c3)'};opacity:.55" x="${(cx + 2).toFixed(1)}" y="${y(Math.max(it.b, 0)).toFixed(1)}" width="${bw}" height="${Math.max(2, zero - y(it.b)).toFixed(1)}" rx="4"/>`;
    // המספר מעל כל עמודה — גם בפועל וגם היעד, כדי לא לחייב ריחוף
    const la = `<text class="val" x="${(cx - bw / 2 - 2).toFixed(1)}" y="${(y(Math.max(it.a, 0)) - 6).toFixed(1)}" text-anchor="middle">${yf(it.a)}</text>`;
    const lb = `<text class="val soft" x="${(cx + bw / 2 + 2).toFixed(1)}" y="${(y(Math.max(it.b, 0)) - 6).toFixed(1)}" text-anchor="middle">${yf(it.b)}</text>`;
    return `<g data-i="${i}">${ba}${bb}${la}${lb}<text class="axis" x="${cx.toFixed(1)}" y="${MT + ih + 18}" text-anchor="middle">${UI.esc(it.label)}</text><rect class="hit" x="${(cx - step / 2).toFixed(1)}" y="${MT}" width="${step.toFixed(1)}" height="${ih}"/></g>`;
  }).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${UI.esc(title || '')}">${grid}${g}</svg>` +
    `<div class="chart-legend"><span><span class="sw" style="background:var(--c1)"></span>${UI.esc(names[0])}</span><span><span class="sw" style="background:var(--c3);opacity:.55"></span>${UI.esc(names[1])}</span></div>`;
  host.querySelectorAll('g[data-i]').forEach(el => {
    const it = items[Number(el.dataset.i)];
    el.addEventListener('mousemove', e => tip(`<div>${UI.esc(it.label)}</div><div>${UI.esc(names[0])}: <b>${f(it.a)}</b></div><div>${UI.esc(names[1])}: <b>${f(it.b)}</b></div>${it.sub ? `<div class="sub">${UI.esc(it.sub)}</div>` : ''}`, e.clientX, e.clientY));
    el.addEventListener('mouseleave', untip);
  });
};

UI.sparkline = function (values, w = 90, h = 24, color = 'var(--accent)') {
  const v = values.map(Number).filter(isFinite); if (v.length < 2) return '';
  const max = Math.max(...v), min = Math.min(...v), span = (max - min) || 1;
  const pts = v.map((x, i) => `${(w - i * (w / (v.length - 1))).toFixed(1)},${(h - 2 - ((x - min) / span) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="direction:ltr;vertical-align:middle"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" points="${pts}"/></svg>`;
};

// ------------------------------------------------------------------ קיבוץ לפי ימים (details מתקפל)
UI.dayGroups = function (rows, dateKey, renderRows, opts = {}) {
  const by = new Map();
  rows.forEach(r => { const k = String(r[dateKey] || '').slice(0, 10); if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
  const days = [...by.keys()].sort().reverse();
  if (!days.length) return `<div class="empty">${UI.esc(opts.empty || 'אין שורות')}</div>`;
  return days.map((d, i) => {
    const rs = by.get(d);
    const head = opts.summary ? opts.summary(d, rs) : `${rs.length} שורות`;
    return `<details class="daygroup" ${opts.open === 'first' && i === 0 ? 'open' : opts.open === true ? 'open' : ''}>` +
      `<summary><span>${UI.dow(d)} ${UI.dm(d)}</span><span class="cnt">${head}</span></summary><div class="rows">${renderRows(rs, d)}</div></details>`;
  }).join('');
};

// ------------------------------------------------------------------ מיון טבלה בלחיצה על כותרת
// מיון בלחיצה על כותרת. שלושה מצבים במחזור: מהגבוה לנמוך, מהנמוך לגבוה,
// וחזרה לסדר הטבעי של הדוח — כדי שתמיד אפשר לחזור למצב ההתחלתי.
UI.sortOn = function (thead, state, redraw, def) {
  if (!thead || thead.dataset.sortReady) return;
  thead.dataset.sortReady = '1';
  thead.addEventListener('click', e => {
    const th = e.target.closest('th[data-key]');
    if (!th || e.target.closest('button, a, select, input')) return;
    const key = th.dataset.key;
    if (state.key !== key) { state.key = key; state.dir = 'desc'; }
    else if (state.dir === 'desc') state.dir = 'asc';
    else { state.key = def ? def.key : null; state.dir = def ? def.dir : null; }
    redraw();
  });
};
UI.applySort = function (rows, state) {
  if (!state || !state.key) return rows;
  const k = state.key, sign = state.dir === 'asc' ? 1 : -1;
  const empty = v => v === null || v === undefined || v === '';
  return rows.slice().sort((a, b) => {
    const va = a[k], vb = b[k];
    if (empty(va) && empty(vb)) return 0;
    if (empty(va)) return 1;                       // ריקים תמיד בסוף, בשני הכיוונים
    if (empty(vb)) return -1;
    const na = Number(va), nb = Number(vb);
    const cmp = (isFinite(na) && isFinite(nb)) ? na - nb : String(va).localeCompare(String(vb), 'he');
    return sign * cmp;
  });
};
// התכונות שצריך לשים על <th> כדי שיהיה ניתן למיון (כולל החץ של המצב הנוכחי)
UI.sortTh = function (state, key, title) {
  if (!key) return '';
  const dir = state && state.key === key ? ` data-dir="${state.dir}"` : '';
  return ` class="sortable" data-key="${UI.esc(key)}"${dir} title="${UI.esc(title || 'מיון לפי העמודה')}"`;
};

UI.sortable = function (table, getRows, render) {
  const thead = table.querySelector('thead');
  thead.addEventListener('click', e => {
    const th = e.target.closest('th.sortable'); if (!th) return;
    const key = th.dataset.key; const dir = th.dataset.dir === 'desc' ? 'asc' : 'desc';
    thead.querySelectorAll('th.sortable').forEach(x => x.removeAttribute('data-dir'));
    th.dataset.dir = dir;
    const rows = getRows().slice().sort((a, b) => {
      const va = a[key], vb = b[key];
      const na = Number(va), nb = Number(vb);
      const cmp = (isFinite(na) && isFinite(nb) && va !== null && vb !== null) ? na - nb : String(va ?? '').localeCompare(String(vb ?? ''), 'he');
      return dir === 'asc' ? cmp : -cmp;
    });
    render(rows);
  });
};

// ------------------------------------------------------------------ עריכה במקום (סופר אדמין)
// UI.inlineNumber({value, fmt, onSave}) → span עם עיפרון; לחיצה הופכת לשדה מספר
UI.inlineNumber = function ({ value, fmt, onSave, title, step = 1000, min = 0, id, allow }) {
  const may = allow === undefined ? UI.canWrite() : !!allow;
  const f = fmt || UI.money;
  const wrap = document.createElement('span'); wrap.className = 'inline-edit';
  const show = () => {
    wrap.innerHTML = `<span class="val">${f(value)}</span>` + (may ? `<button class="pencil" type="button" title="${UI.esc(title || 'עריכה')}">✎</button>` : '');
    const p = wrap.querySelector('.pencil');
    if (p) p.onclick = () => {
      wrap.innerHTML = `<input class="editnum" type="number" step="${step}" min="${min}" value="${value ?? ''}" /><button class="btn xs" type="button">שמירה</button><button class="btn ghost xs" type="button">ביטול</button>`;
      const inp = wrap.querySelector('input'); inp.focus(); inp.select();
      const [save, cancel] = wrap.querySelectorAll('button');
      const doSave = async () => {
        const v = inp.value === '' ? null : Number(inp.value);
        save.disabled = true;
        try { await onSave(v); value = v; UI.toast('נשמר ✓', 'good'); } catch (e) { UI.toast('שמירה נכשלה: ' + e.message, 'bad'); }
        show();
      };
      save.onclick = doSave; cancel.onclick = show;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') show(); });
    };
  };
  show();
  return wrap;
};

// ------------------------------------------------------------------ ייצוא
window.UI = UI;
})();
