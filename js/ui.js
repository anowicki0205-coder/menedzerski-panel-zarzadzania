'use strict';
/* Menedżerski Panel Zarządzania — wspólne elementy interfejsu: stan widoku, okna, dymki, powiadomienia, zdarzenia */

const ui = {
  view: 'overview', me: 'boss', meChosen: false, navOpen: false,
  tf: { q: '', status: '', member: '', due: '', label: '', group: 'status', collapsed: {}, open: false },
  cardId: null, meetingId: null, strategyTab: 'pestel', calMonth: null, plannerMode: 'month', focus: null,
};
const PERSIST = ['view', 'me', 'meChosen', 'plannerMode', 'strategyTab'];
function loadUi() {
  try {
    const j = JSON.parse(lsGet(LS_UI) || '{}');
    PERSIST.forEach((k) => { if (j[k] !== undefined) ui[k] = j[k]; });
    if (j.group) ui.tf.group = j.group;
  } catch (e) { /* */ }
}
function saveUi() {
  const o = {}; PERSIST.forEach((k) => { o[k] = ui[k]; }); o.group = ui.tf.group;
  lsSet(LS_UI, JSON.stringify(o));
}

/* ---------- małe komponenty ---------- */
function avatar(id, cls = '') {
  const m = memberById(id); if (!m) return '';
  return `<span class="av ${cls}" style="--c:${m.color}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
}
const avatarStack = (ids, cls = '') => (ids || []).map((id) => avatar(id, cls)).join('');
const firstName = (id) => (memberById(id) ? memberById(id).name.split(' ')[0] : '—');
function labelBar(l, expanded) {
  if (!l) return '';
  return expanded ? `<span class="lbl lbl-${l.color} lbl-open" title="${esc(l.name)}">${esc(l.name)}</span>` : `<span class="lbl lbl-${l.color}" title="${esc(l.name)}"></span>`;
}
const btn = (act, text, cls = '', extra = '') => `<button class="btn ${cls}" data-act="${act}" ${extra}>${text}</button>`;

/* ---------- rejestry zdarzeń: A = klik, C = zmiana, K = Enter, B = utrata fokusu, I = wpisywanie ---------- */
const A = {}, C = {}, K = {}, B = {}, I = {};
const dragState = { justDragged: false };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (dragState.justDragged) { e.preventDefault(); return; }
  const fn = A[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-chg]'); if (el && C[el.dataset.chg]) C[el.dataset.chg](el, e); });
document.addEventListener('input', (e) => { const el = e.target.closest('[data-inp]'); if (el && I[el.dataset.inp]) I[el.dataset.inp](el, e); });
document.addEventListener('focusout', (e) => { const el = e.target.closest && e.target.closest('[data-blur]'); if (el && B[el.dataset.blur]) B[el.dataset.blur](el, e); });
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (e.key === 'Enter' && t.closest) {
    const el = t.closest('[data-enter]');
    if (el && t === el && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (K[el.dataset.enter]) K[el.dataset.enter](el, e); return; }
  }
  if (e.key === 'Escape') {
    const el = t.closest && t.closest('[data-esc]');
    if (el && K[el.dataset.esc]) { e.preventDefault(); K[el.dataset.esc](el, e); return; }
    if (pop.el) { closePop(); return; }
    if (modal.render) { closeModal(); return; }
  }
});

/* ---------- dymki (popover) ---------- */
const pop = { el: null, anchor: null, rect: null, render: null, opts: {}, confirm: null };
function openPop(anchor, render, opts = {}) {
  closePop();
  pop.anchor = anchor; pop.rect = anchor.getBoundingClientRect(); pop.render = render; pop.opts = opts;
  const el = document.createElement('div');
  el.className = 'pop' + (opts.cls ? ' ' + opts.cls : '');
  el.setAttribute('role', 'dialog');
  $('#pop-root').appendChild(el);
  pop.el = el; document.body.classList.add('has-pop');
  refreshPop();
  const f = el.querySelector('[data-autofocus]'); if (f) f.focus();
}
function closePop() { if (pop.el) pop.el.remove(); pop.el = null; pop.anchor = null; pop.render = null; pop.confirm = null; document.body.classList.remove('has-pop'); }
function refreshPop() {
  if (!pop.el) return;
  const st = pop.el.scrollTop;
  const hadFocus = document.activeElement && pop.el.contains(document.activeElement) ? document.activeElement.id : null;
  pop.el.innerHTML = pop.render();
  pop.el.scrollTop = st;
  if (hadFocus) { const f = document.getElementById(hadFocus); if (f && f.focus) f.focus(); }
  placePop();
}
function placePop() {
  const el = pop.el; if (!el) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(pop.opts.w || 300, vw - 16);
  el.style.width = w + 'px';
  const r = pop.anchor && pop.anchor.isConnected ? pop.anchor.getBoundingClientRect() : pop.rect;
  pop.rect = r;
  let left = pop.opts.alignRight ? r.right - w : r.left;
  left = clamp(left, 8, vw - w - 8);
  const h = el.offsetHeight;
  let top = r.bottom + 6;
  if (top + h > vh - 8) top = Math.max(8, r.top - h - 6 > 8 ? r.top - h - 6 : vh - h - 8);
  el.style.left = left + 'px'; el.style.top = top + 'px';
}
document.addEventListener('pointerdown', (e) => {
  if (!pop.el) return;
  if (pop.el.contains(e.target)) return;
  if (pop.anchor && pop.anchor.contains(e.target)) return;
  closePop();
}, true);
window.addEventListener('resize', () => placePop());
A['pop-close'] = () => closePop();

function confirmPop(anchor, message, label, fn) {
  openPop(anchor, () => `<div class="pop-t">${esc(message)}</div><div class="row gap pt">${btn('confirm-yes', esc(label || 'Usuń'), 'danger')}${btn('pop-close', 'Anuluj')}</div>`, { w: 270 });
  pop.confirm = fn;
}
A['confirm-yes'] = () => { const f = pop.confirm; closePop(); if (f) f(); };

/* ---------- okno modalne ---------- */
const modal = { render: null, cls: '' };
function openModal(render, cls = '') { modal.render = render; modal.cls = cls; renderModal(); }
function renderModal() {
  const root = $('#modal-root');
  if (!modal.render) { root.innerHTML = ''; document.body.classList.remove('modal-open'); return; }
  const prev = $('.modal-scroll', root);
  const st = prev ? prev.scrollTop : 0;
  const hadFocus = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;
  root.innerHTML = `<div class="overlay ${modal.cls.includes('drawer') ? 'ov-drawer' : ''}" data-act="backdrop"><div class="modal ${modal.cls}" role="dialog" aria-modal="true">${modal.render()}</div></div>`;
  document.body.classList.add('modal-open');
  const sc = $('.modal-scroll', root); if (sc) sc.scrollTop = st;
  if (hadFocus && !ui.focus) { const f = document.getElementById(hadFocus); if (f && f.focus) f.focus({ preventScroll: true }); }
  applyFocus();
}
function applyFocus() {
  if (!ui.focus) return;
  const f = document.getElementById(ui.focus);
  if (!f) return;
  f.focus({ preventScroll: false });
  if (typeof f.value === 'string' && f.setSelectionRange) { try { const n = f.value.length; f.setSelectionRange(n, n); } catch (e) { /* */ } }
  ui.focus = null;
}
function closeModal() {
  modal.render = null; ui.cardId = null; ui.meetingId = null;
  renderModal(); closePop();
}
A.backdrop = (el, e) => { if (e.target === el) closeModal(); };
A['close-modal'] = () => closeModal();

/* ---------- powiadomienia ---------- */
let toastTimer = 0;
function toast(msg, opts = {}) {
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${opts.action ? `<button class="toast-btn" data-act="toast-action">${esc(opts.action)}</button>` : ''}</div>`;
  toast.fn = opts.onAction || null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, opts.ms || 3800);
}
A['toast-action'] = () => { const f = toast.fn; $('#toast-root').innerHTML = ''; if (f) f(); };

/* ---------- pomoc: kopiowanie ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* awaryjnie */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

/* czy użytkownik właśnie coś wpisuje (nie przerysowuj wtedy widoku) */
function isTyping() {
  const a = document.activeElement;
  return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('#app, #modal-root, #pop-root');
}
