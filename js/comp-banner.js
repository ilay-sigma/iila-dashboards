/* ---------------------------------------------------------------------------
   comp-banner.js — פס התחרות בראש הדשבורד, לכל עובד/ת בכל מחלקה.

   מה הוא מציג: שם התחרות, פרק הזמן, התנאים במילים, כמה יש לי עד עכשיו,
   כמה חסר ליעד הבא, ואילו יעדים כבר הושגו. הכול מגיע מ-public.competition_progress
   שכבר מסונן ב-DB לשורה של המשתמש/ת (app.person_visible).

   נטען אחרי ui.js בכל דף דשבורד. למי שאין שורה אישית (סופר אדמין/מנהל בלי
   staff_label) הפס פשוט לא מוצג.
--------------------------------------------------------------------------- */
(function () {
'use strict';
if (!window.UI) return;

const FMT = {
  paid: UI.money, performance: UI.money, avg_paid_per_offer: UI.money,
  close_pct: v => UI.pct(v, 0),
  arrivals: UI.int, closings: UI.int, bookings: UI.int, fifty: UI.int, offers: UI.int,
};
const METRIC_NAME = {
  arrivals: 'הגעות', closings: 'סגירות', bookings: 'קביעות', fifty: 'אשראי 50 ₪',
  close_pct: 'אחוז סגירה', paid: 'שולם', offers: 'הצעות',
  avg_paid_per_offer: 'ממוצע להצעה', performance: 'מכירות',
};
const fmtOf = m => FMT[m] || UI.int;
const dm = d => d ? UI.dm(d) : '';

function daysLeft(ends) {
  if (!ends) return null;
  const end = new Date(ends + 'T23:59:59'), now = new Date();
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

function card(c) {
  const f = fmtOf(c.metric), val = Number(c.value) || 0;
  const goals = [[c.goal1_value, c.goal1_label], [c.goal2_value, c.goal2_label], [c.goal3_value, c.goal3_label]]
    .filter(g => g[0] != null).map(g => ({ v: Number(g[0]), label: g[1] || '' }))
    .sort((a, b) => a.v - b.v);
  const next = c.next_goal == null ? null : Number(c.next_goal);
  const done = goals.filter(g => val >= g.v).length;
  const top = goals.length ? goals[goals.length - 1].v : 0;
  const pctAll = top ? Math.min(100, val / top * 100) : 0;
  const nextLabel = next == null ? '' : (goals.find(g => g.v === next) || {}).label || '';
  const left = daysLeft(c.ends_on);
  const all = next == null && goals.length;

  return `<div class="compbar ${all ? 'all-done' : ''}">
    <div class="cb-head">
      <span class="cb-cup">🏆</span>
      <span class="cb-title">${UI.esc(c.title)}</span>
      ${c.starts_on || c.ends_on ? `<span class="cb-when">${UI.esc(dm(c.starts_on))}–${UI.esc(dm(c.ends_on))}${left != null ? ` · נותרו ${UI.int(left)} ימים` : ''}</span>` : ''}
      <span class="cb-now">${f(val)} <em>${UI.esc(METRIC_NAME[c.metric] || '')}</em></span>
    </div>
    ${c.rule_text ? `<div class="cb-rule">${UI.esc(c.rule_text)}</div>` : ''}
    <div class="cb-track" role="img" aria-label="התקדמות בתחרות">
      <i style="--w:${pctAll.toFixed(1)}%"></i>
      ${goals.map(g => `<b class="cb-goal ${val >= g.v ? 'on' : ''}" style="inset-inline-start:${top ? Math.min(100, g.v / top * 100).toFixed(1) : 0}%"
           title="${UI.esc(f(g.v) + (g.label ? ' · ' + g.label : ''))}"></b>`).join('')}
    </div>
    <div class="cb-goals">
      ${goals.map((g, i) => `<span class="cb-chip ${val >= g.v ? 'done' : ''}">${val >= g.v ? '✓' : `יעד ${i + 1}`} ${f(g.v)}${g.label ? ` · ${UI.esc(g.label)}` : ''}</span>`).join('')}
      ${all ? `<span class="cb-left win">🎉 עברת את כל היעדים!</span>`
            : next != null ? `<span class="cb-left">עוד <b>${f(Math.max(0, next - val))}</b> ${nextLabel ? `ל${UI.esc(nextLabel)}` : 'ליעד הבא'}</span>` : ''}
    </div>
  </div>`;
}

async function render() {
  try {
    const a = UI.access();
    if (!a || !a.staff_label) return;
    const month = UI.thisMonth();
    const rows = await UI.rest(`competition_progress?period_month=eq.${month}&order=comp_id`);
    const mine = (rows || []).filter(r => String(r.staff_label || '').trim() === String(a.staff_label).trim());
    document.querySelectorAll('.compbar-host').forEach(el => el.remove());
    if (!mine.length) return;
    const host = document.createElement('div');
    host.className = 'compbar-host';
    host.innerHTML = mine.map(card).join('');
    const wrap = document.querySelector('.wrap');
    if (wrap) wrap.insertBefore(host, wrap.firstChild);
    requestAnimationFrame(() => host.querySelectorAll('.cb-track i').forEach(i => i.classList.add('go')));
  } catch (_) { /* תחרויות הן תוספת — כישלון כאן לא מפריע לדוח */ }
}

document.addEventListener('access-ready', render);
if (window.APP_AUTH && APP_AUTH.access && APP_AUTH.access.staff_label) render();
})();
