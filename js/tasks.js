'use strict';
/* Menedżerski Panel Zarządzania — Zadania: tabela z filtrami i grupowaniem, zmiana statusu, zlecanie zadań */

const TONE_NAME = { todo: 'Do zrobienia', progress: 'W trakcie', done: 'Zrobione', hold: 'Wstrzymane' };
const ownerNames = (c) => (c.members || []).map(firstName).join(', ');

/* ---------- filtry ---------- */
const tfActive = () => !!(ui.tf.q || ui.tf.status || ui.tf.member || ui.tf.due || ui.tf.label);
function taskMatches(c) {
  const f = ui.tf;
  if (f.q && !norm(c.title + ' ' + (c.desc || '') + ' ' + ownerNames(c)).includes(norm(f.q))) return false;
  if (f.status && c.listId !== f.status) return false;
  if (f.member === '_none' ? (c.members || []).length : f.member && !(c.members || []).includes(f.member)) return false;
  if (f.label && !(c.labels || []).includes(f.label)) return false;
  if (f.due) {
    const ds = dueState(c); const d = c.due ? diffDays(c.due, todayStr()) : null;
    if (f.due === 'overdue' && ds !== 'overdue') return false;
    if (f.due === 'week' && !(c.due && !isCardClosed(c) && d >= 0 && d <= 7)) return false;
    if (f.due === 'none' && c.due) return false;
  }
  return true;
}
const byDue = (a, b) => ((a.due || '9999') + norm(a.title)).localeCompare((b.due || '9999') + norm(b.title));

/* ---------- elementy tabeli ---------- */
const dueChip = (c) => {
  if (!c.due) return '<span class="muted">—</span>';
  const ds = dueState(c); const d = diffDays(c.due, todayStr());
  const rel = ds === 'overdue' ? `${-d} ${plural(-d, 'dzień', 'dni', 'dni')} po terminie` : ds === 'done' ? '' : d === 0 ? 'dziś' : d === 1 ? 'jutro' : '';
  return `<span class="due due-${ds}">${ico('clock')}${fmtShort(c.due)}</span>${rel ? `<small class="rel ${ds === 'overdue' ? 'bad' : ''}">${rel}</small>` : ''}`;
};
const progressMini = (c) => { const p = cardProgress(c); return p.total ? `<span class="pm" title="Checklista: ${p.done} z ${p.total}"><span class="pm-bar ${p.done === p.total ? 'ok' : ''}"><i style="width:${Math.round(p.done / p.total * 100)}%"></i></span><small>${p.done}/${p.total}</small></span>` : '<span class="muted">—</span>'; };
const areaChips = (c) => (c.labels || []).map((id) => labelOf(null, id)).filter(Boolean).map((l) => `<span class="area lbl-${l.color}" title="${esc(l.name)}">${esc(l.name)}</span>`).join('');
const statusSelect = (c) => {
  const tone = cardTone(c) || 'todo';
  return `<select class="pill tone-${tone}" data-act="noop" data-chg="row-status" data-id="${c.id}" aria-label="Status zadania: ${esc(c.title)}">${statusLists().map((l) => `<option value="${l.id}" ${l.id === c.listId ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select>`;
};

function taskRow(c) {
  const closed = isCardClosed(c);
  const dec = c.decision && c.decision.status === 'pending' ? `<span class="tag tag-acc" title="Czeka na Twoją decyzję">${ico('gavel')} do decyzji</span>` : '';
  const src = c.source ? `<span class="tag" title="Zadanie z ustalenia po spotkaniu">${ico('calendar')}</span>` : '';
  return `<tr class="trow ${closed ? 'is-done' : ''}" data-act="open-card" data-enter="open-card" data-card="${c.id}" tabindex="0" aria-label="Zadanie: ${esc(c.title)}">
    <td class="c-t"><div class="ct-in"><button class="chkc ${closed ? 'on' : ''}" data-act="toggle-done" data-id="${c.id}" aria-pressed="${closed}" aria-label="${closed ? 'Cofnij ukończenie' : 'Oznacz jako zrobione'}">${ico('check')}</button><span class="t-text">${esc(c.title)}</span>${dec}${src}</div></td>
    <td class="c-st">${statusSelect(c)}</td>
    <td class="c-own">${(c.members || []).length ? `<span class="av-stack">${avatarStack(c.members, 'sm')}</span>` : '<span class="tag tag-warn">brak właściciela</span>'}</td>
    <td class="c-area">${areaChips(c)}</td>
    <td class="c-due">${dueChip(c)}</td>
    <td class="c-prog">${progressMini(c)}</td>
  </tr>`;
}

function tasksBodyHTML() {
  const all = taskCards();
  const list = all.filter(taskMatches);
  const g = ui.tf.group;
  let groups = [];
  if (g === 'status') groups = statusLists().map((l) => ({ k: l.id, title: l.title, tone: l.tone, rows: list.filter((c) => c.listId === l.id) }));
  else if (g === 'osoba') {
    groups = members().map((m) => ({ k: m.id, title: m.name, av: m.id, rows: list.filter((c) => (c.members || []).includes(m.id)) }));
    groups.push({ k: '_none', title: 'Bez właściciela', rows: list.filter((c) => !(c.members || []).length) });
  } else if (g === 'termin') {
    const t = todayStr();
    const b = (f) => list.filter(f);
    groups = [
      { k: 'od', title: 'Po terminie', tone: 'hold', rows: b((c) => dueState(c) === 'overdue') },
      { k: 'w', title: 'Najbliższe 7 dni', rows: b((c) => c.due && !isCardClosed(c) && diffDays(c.due, t) >= 0 && diffDays(c.due, t) <= 7) },
      { k: 'p', title: 'Później', rows: b((c) => c.due && !isCardClosed(c) && diffDays(c.due, t) > 7) },
      { k: 'n', title: 'Bez terminu', rows: b((c) => !c.due && !isCardClosed(c)) },
      { k: 'z', title: 'Zakończone', tone: 'done', rows: b(isCardClosed) },
    ];
  } else groups = [{ k: 'all', title: 'Wszystkie zadania', rows: list }];
  const rows = groups.filter((x) => x.rows.length || (g === 'status' && !tfActive())).map((x) => {
    const done = x.rows.filter(isCardClosed).length; const col = ui.tf.collapsed[g + x.k];
    const body = sortBy(x.rows, (c) => 0).sort(byDue).map(taskRow).join('');
    return `<tbody class="grp-body"><tr class="grp tone-${x.tone || 'none'}" data-act="grp-toggle" data-k="${g + x.k}" tabindex="0" data-enter="grp-toggle" aria-expanded="${!col}"><td colspan="6"><span class="grp-h">${ico(col ? 'chevr' : 'chevd')}${x.av ? avatar(x.av, 'xs') : ''}<b>${esc(x.title)}</b><span class="count">${x.rows.length}</span>${x.rows.length ? `<small>${done} z ${x.rows.length} zakończonych</small>` : ''}</span></td></tr>${col ? '' : body || `<tr><td colspan="6" class="muted empty-row">Brak zadań w tej grupie.</td></tr>`}</tbody>`;
  }).join('');
  return `<table class="tbl task-tbl"><thead><tr><th>Zadanie</th><th>Status</th><th>Odpowiedzialni</th><th>Obszar</th><th>Termin</th><th>Postęp</th></tr></thead>${rows || '<tbody><tr><td colspan="6"><div class="empty-note">Żadne zadanie nie pasuje do filtrów.</div></td></tr></tbody>'}</table>
    <p class="foot-note">Pokazano ${list.length} z ${all.length} zadań.${tfActive() ? ` ${btn('tf-clear', 'Wyczyść filtry', 'sm')}` : ''}</p>`;
}
const refreshTasks = () => { const b = $('#tasks-body'); if (b) { b.innerHTML = tasksBodyHTML(); } };

function renderTasksView() {
  const f = ui.tf; const all = taskCards(); const lists = statusLists();
  const seg = [['', 'Wszystkie', all.length]].concat(lists.map((l) => [l.id, l.title, all.filter((c) => c.listId === l.id).length]));
  const board = mainBoard() || { labels: [] };
  return `<div class="sheet flush">
    <div class="toolbar">
      <label class="search">${ico('search')}<input id="tf-q" type="search" placeholder="Szukaj zadania lub osoby…" value="${esc(f.q)}" data-inp="tf-q" aria-label="Szukaj zadania"></label>
      <button class="btn sm tb-toggle" data-act="tf-toggle" aria-expanded="${!!f.open}">${ico('filter')} Filtry${['member', 'due', 'label'].filter((k) => f[k]).length ? ` <span class="count">${['member', 'due', 'label'].filter((k) => f[k]).length}</span>` : ''}</button>
      <div class="seg" role="group" aria-label="Status">${seg.map(([v, t, n]) => `<button class="${f.status === v ? 'on' : ''}" data-act="tf-status" data-v="${v}" aria-pressed="${f.status === v}">${esc(t)} <small>${n}</small></button>`).join('')}</div>
      <div class="tb-filters ${f.open ? 'open' : ''}">
      <select data-chg="tf-member" aria-label="Osoba"><option value="">Wszystkie osoby</option>${members().map((m) => `<option value="${m.id}" ${f.member === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}<option value="_none" ${f.member === '_none' ? 'selected' : ''}>Bez właściciela</option></select>
      <select data-chg="tf-due" aria-label="Termin">${[['', 'Każdy termin'], ['overdue', 'Po terminie'], ['week', 'Najbliższe 7 dni'], ['none', 'Bez terminu']].map(([v, t]) => `<option value="${v}" ${f.due === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select data-chg="tf-label" aria-label="Obszar"><option value="">Wszystkie obszary</option>${board.labels.map((l) => `<option value="${l.id}" ${f.label === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>
      <label class="fld inline"><span>Grupuj:</span><select data-chg="tf-group" aria-label="Grupowanie">${[['status', 'wg statusu'], ['osoba', 'wg osoby'], ['termin', 'wg terminu'], ['brak', 'bez grupowania']].map(([v, t]) => `<option value="${v}" ${f.group === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <span class="grow"></span>${btn('import-open', `${ico('upload')} Importuj z Excela`, 'sm')}
      </div>
    </div>
    <div class="tbl-wrap tasks-wrap" id="tasks-body">${tasksBodyHTML()}</div></div>`;
}
I['tf-q'] = (el) => { ui.tf.q = el.value; refreshTasks(); };
A['tf-status'] = (el) => { ui.tf.status = el.dataset.v; requestRender({ only: 'main' }); };
C['tf-member'] = (el) => { ui.tf.member = el.value; refreshTasks(); };
C['tf-due'] = (el) => { ui.tf.due = el.value; refreshTasks(); };
C['tf-label'] = (el) => { ui.tf.label = el.value; refreshTasks(); };
C['tf-group'] = (el) => { ui.tf.group = el.value; saveUi(); refreshTasks(); };
A['tf-toggle'] = () => { ui.tf.open = !ui.tf.open; requestRender({ only: 'main' }); };
A['tf-clear'] = () => { Object.assign(ui.tf, { q: '', status: '', member: '', due: '', label: '' }); requestRender({ only: 'main' }); };
A['grp-toggle'] = (el) => { const k = el.dataset.k; ui.tf.collapsed[k] = !ui.tf.collapsed[k]; refreshTasks(); };
K['grp-toggle'] = A['grp-toggle'];
A.noop = () => {};

C['row-status'] = (el) => {
  const c = S.cards[el.dataset.id]; if (!c) return;
  const prev = c.listId; setStatus(c, el.value);
  commit({ only: 'main' });
  if (c.decision && c.decision.status === 'pending' && isHoldList(S.lists[prev])) { /* decyzja wciąż czeka */ }
};
A['open-card'] = (el) => { if (el.dataset.card) openCard(el.dataset.card); };
K['open-card'] = (el) => { if (el.dataset.card) openCard(el.dataset.card); };
A['toggle-done'] = (el, e) => {
  e.stopPropagation();
  const c = S.cards[el.dataset.id]; if (!c) return;
  if (isCardClosed(c)) {
    const back = S.lists[c.prevListId] && S.lists[c.prevListId].kind === 'status' && S.lists[c.prevListId].tone !== 'done' ? c.prevListId : (listByTone('todo') || {}).id;
    c.done = false; if (cardTone(c) === 'done') setStatus(c, back); else { logEvent(c, 'cofnięto ukończenie'); c.updated = nowIso(); }
  } else {
    const done = listByTone('done'); c.prevListId = c.listId;
    if (done) setStatus(c, done.id); else { c.done = true; logEvent(c, 'oznaczono jako zrobione'); }
  }
  commit();
};

/* ---------- zlecanie zadania ---------- */
let taskForm = null;
function openNewTask(pre = {}) {
  const todo = listByTone('todo') || statusLists()[0];
  taskForm = { title: '', members: pre.members || [], due: pre.due || '', status: pre.status || (todo ? todo.id : ''), labels: [], desc: '', ask: false, question: '' };
  ui.focus = 'nt-title';
  openModal(newTaskHTML, 'modal-form');
}
function newTaskHTML() {
  const f = taskForm; const board = mainBoard() || { labels: [] };
  return `<div class="modal-scroll"><header class="m-head"><h2 class="m-h2">Zleć zadanie</h2><button class="icon-btn" data-act="close-modal" aria-label="Zamknij">${ico('x')}</button></header>
    <div class="m-body">
      <label class="fld"><span>Co ma zostać zrobione?</span><input id="nt-title" value="${esc(f.title)}" maxlength="300" data-inp="nt-title" data-enter="nt-submit" placeholder="np. Przygotować makietę dashboardu"></label>
      <div class="fld"><span>Odpowiedzialni</span><div class="row gap wrap">${members().map((m) => `<label class="chk pill-pick ${f.members.includes(m.id) ? 'sel' : ''}"><input type="checkbox" data-chg="nt-member" value="${m.id}" ${f.members.includes(m.id) ? 'checked' : ''}>${avatar(m.id, 'xs')}<span>${esc(m.name)}</span></label>`).join('')}</div></div>
      <div class="form-grid two">
        <label class="fld"><span>Termin</span><input type="date" value="${f.due}" data-chg="nt-due"></label>
        <label class="fld"><span>Status</span><select data-chg="nt-status">${statusLists().map((l) => `<option value="${l.id}" ${l.id === f.status ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select></label>
      </div>
      <div class="fld"><span>Obszar</span><div class="row gap wrap">${board.labels.map((l) => `<label class="chk pill"><input type="checkbox" data-chg="nt-label" value="${l.id}" ${f.labels.includes(l.id) ? 'checked' : ''}><span class="area lbl-${l.color} ${f.labels.includes(l.id) ? 'on' : ''}">${esc(l.name)}</span></label>`).join('')}</div></div>
      <label class="fld"><span>Opis i kryterium ukończenia (opcjonalnie)</span><textarea rows="3" data-inp="nt-desc" placeholder="Po czym poznamy, że zadanie jest skończone?">${esc(f.desc)}</textarea></label>
      <div class="m-foot">${btn('close-modal', 'Anuluj')}<span class="grow"></span>${btn('nt-submit', `${ico('check')} Zleć zadanie`, 'primary')}</div>
    </div></div>`;
}
I['nt-title'] = (el) => { taskForm.title = el.value; };
I['nt-desc'] = (el) => { taskForm.desc = el.value; };
C['nt-member'] = (el) => { toggleIn(taskForm.members, el.value); renderModal(); };
C['nt-label'] = (el) => { toggleIn(taskForm.labels, el.value); renderModal(); };
C['nt-due'] = (el) => { taskForm.due = el.value; };
C['nt-status'] = (el) => { taskForm.status = el.value; };
function ntSubmit() {
  const f = taskForm; if (!f) return;
  const t = ($('#nt-title') ? $('#nt-title').value : f.title).trim();
  if (!t) { const i = $('#nt-title'); if (i) i.focus(); toast('Wpisz, co ma zostać zrobione.'); return; }
  const c = addCard(f.status, t, { members: f.members.slice(), due: f.due || null, labels: f.labels.slice(), desc: f.desc.trim() });
  taskForm = null; closeModal(); commit();
  toast(`Zlecono zadanie${c.members.length ? ': ' + ownerNames(c) : ''}`, { action: 'Otwórz', onAction: () => openCard(c.id) });
}
A['nt-submit'] = ntSubmit; K['nt-submit'] = ntSubmit;
A['new-task'] = (el) => openNewTask({ members: el && el.dataset.member ? [el.dataset.member] : [] });
