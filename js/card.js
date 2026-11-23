'use strict';
/* Menedżerski Panel Zarządzania — panel zadania: status, termin, odpowiedzialni, decyzja szefa, opis, checklisty, załączniki, komentarze */

let descEditing = false;
let descDraft = null;
let commentDraft = '';
let askDraft = '';
let askOpen = false;

function openCard(id) {
  if (!S.cards[id]) return;
  ui.cardId = id; descEditing = false; descDraft = null; commentDraft = ''; askDraft = ''; askOpen = false;
  openModal(cardModalHTML, 'modal-card drawer');
}
const curCard = () => S.cards[ui.cardId];
const touchCard = (c) => { c.updated = nowIso(); };
function afterCardChange(c) { if (c) touchCard(c); commit(); }

function decisionBlock(c) {
  const d = c.decision; const isBoss = ui.me === 'boss';
  if (askOpen) return `<section class="dec-box ask"><h3>${ico('gavel')}Poproś szefa o decyzję</h3><textarea id="dc-q" rows="3" placeholder="Co dokładnie ma zostać zatwierdzone? Napisz pytanie tak, żeby wystarczyło odpowiedzieć „tak” lub „nie”." data-inp="dc-q">${esc(askDraft)}</textarea><div class="row gap pt">${btn('dc-ask', 'Wyślij prośbę', 'primary sm')}${btn('dc-ask-cancel', 'Anuluj', 'sm')}</div></section>`;
  if (!d) {
    return `<section class="dec-link">${btn('dc-ask-open', `${ico('gavel')} Poproś szefa o decyzję`, 'sm')}</section>`;
  }
  const who = memberById(d.by);
  if (d.status === 'pending') {
    return `<section class="dec-box pending"><h3>${ico('gavel')}Czeka na decyzję szefa</h3>
      <p class="dec-q">${esc(d.question)}</p><small class="muted">Prośba: ${who ? esc(who.name) : '—'}, ${relTime(d.asked)}</small>
      ${isBoss ? `<label class="fld pt"><span>Uwagi do decyzji (opcjonalnie)</span><textarea id="dc-note-${c.id}" rows="2" placeholder="Np. warunki, termin, zmiany do wprowadzenia"></textarea></label>
        <div class="row gap wrap">${btn('dc-resolve', `${ico('check')} Zatwierdzam`, 'primary', `data-id="${c.id}" data-r="approved"`)}${btn('dc-resolve', 'Wróć z uwagami', '', `data-id="${c.id}" data-r="changes"`)}${btn('dc-resolve', 'Odrzucam', 'danger', `data-id="${c.id}" data-r="rejected"`)}</div>`
        : `<div class="row gap pt">${btn('dc-withdraw', 'Wycofaj prośbę', 'sm', `data-id="${c.id}"`)}<small class="muted">Decyzję podejmuje szef (wybierz „Szef” w lewym dolnym rogu).</small></div>`}</section>`;
  }
  const label = { approved: 'Zatwierdzone', rejected: 'Odrzucone', changes: 'Zwrócone z uwagami' }[d.status];
  const tone = { approved: 'ok', rejected: 'bad', changes: 'warn' }[d.status];
  return `<section class="dec-box done ${tone}"><h3>${ico('gavel')}Decyzja: ${label}</h3><p class="dec-q">${esc(d.question)}</p>
    <small class="muted">${esc((memberById(d.resolvedBy) || { name: 'Szef' }).name)}, ${relTime(d.at)}</small>${d.note ? `<p class="dec-note">${esc(d.note)}</p>` : ''}
    <div class="row gap pt">${btn('dc-ask-open', 'Zapytaj ponownie', 'sm')}</div></section>`;
}

function cardModalHTML() {
  const c = curCard();
  if (!c) { setTimeout(closeModal, 0); return ''; }
  const meet = c.source && S.meetings[c.source.meetingId];
  const list = S.lists[c.listId];
  const kindNote = c.stage ? `Etap ${c.stage}` : list && list.kind === 'brief' ? 'Założenia projektu' : list && list.kind === 'cost' ? 'Kosztorys' : 'Zadanie';
  const isTaskCard = isTask(c);
  const desc = descEditing
    ? `<textarea id="card-desc" rows="7" placeholder="Opis i kryterium ukończenia… (wypunktowania zaczynaj od „- ”)" data-esc="desc-cancel" data-inp="desc-draft">${esc(descDraft !== null ? descDraft : (c.desc || ''))}</textarea><div class="row gap pt">${btn('desc-save', 'Zapisz', 'primary sm')}${btn('desc-cancel', 'Anuluj', 'sm')}</div>`
    : c.desc ? `<div class="desc rich" data-act="desc-edit" tabindex="0" role="button" data-enter="desc-edit" aria-label="Edytuj opis">${rich(c.desc)}</div>`
      : `<button class="desc-empty" data-act="desc-edit">Dodaj opis i kryterium ukończenia…</button>`;

  const checklists = (c.checklists || []).map((cl) => {
    const t = cl.items.length, d = cl.items.filter((i) => i.done).length; const pct = t ? Math.round(d / t * 100) : 0;
    return `<div class="cl" data-cl="${cl.id}">
      <div class="cl-h">${ico('checksq')}<input class="cl-title" value="${esc(cl.title)}" data-blur="cl-title" data-enter="cl-title" data-cl="${cl.id}" aria-label="Nazwa checklisty"><span class="cl-n">${d}/${t}</span>
        <button class="btn sm" data-act="cl-del" data-cl="${cl.id}">Usuń</button></div>
      <div class="bar ${pct === 100 ? 'ok' : ''}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
      <ul class="cl-items">${cl.items.map((it) => `<li class="${it.done ? 'done' : ''}"><input type="checkbox" id="ci-${it.id}" ${it.done ? 'checked' : ''} data-chg="cl-item" data-cl="${cl.id}" data-it="${it.id}"><label for="ci-${it.id}">${esc(it.text)}</label><button class="icon-btn sm" data-act="cl-item-del" data-cl="${cl.id}" data-it="${it.id}" aria-label="Usuń punkt">${ico('x')}</button></li>`).join('')}</ul>
      <div class="cl-add"><input id="cl-new-${cl.id}" placeholder="Dodaj punkt…" maxlength="200" data-enter="cl-item-add" data-cl="${cl.id}" aria-label="Nowy punkt checklisty">${btn('cl-item-add', 'Dodaj', 'sm', `data-cl="${cl.id}"`)}</div>
    </div>`;
  }).join('');
  const atts = (c.attachments || []).map((a) => `<li class="att">${ico('clip')}<span class="att-n">${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.name || a.url)}</a>` : esc(a.name)}</span><button class="icon-btn sm" data-act="att-del" data-id="${a.id}" aria-label="Usuń załącznik">${ico('x')}</button></li>`).join('');
  const acts = sortBy(c.comments || [], (x) => x.ts).slice().reverse();
  const actHTML = acts.map((x) => {
    if (x.kind === 'event') return `<li class="ev">${avatar(x.by, 'sm')}<div><b>${esc(firstName(x.by))}</b> ${esc(x.text)}<small>${relTime(x.ts)}</small></div></li>`;
    return `<li class="cm">${avatar(x.by, 'sm')}<div><div class="cm-h"><b>${esc((memberById(x.by) || { name: 'Ktoś' }).name)}</b><small>${relTime(x.ts)}</small></div><div class="cm-b">${rich(x.text)}</div>${x.by === ui.me ? `<button class="lnk" data-act="cm-del" data-id="${x.id}">Usuń</button>` : ''}</div></li>`;
  }).join('');
  const lbls = (c.labels || []).map((id) => labelOf(null, id)).filter(Boolean);

  return `<div class="modal-scroll">
    <header class="m-head">
      <div class="m-title-wrap"><textarea id="card-title" class="m-title" rows="1" maxlength="300" data-blur="card-title" data-enter="card-title" aria-label="Tytuł zadania">${esc(c.title)}</textarea></div>
      <button class="icon-btn" data-act="close-modal" aria-label="Zamknij">${ico('x')}</button>
      <p class="m-sub">${kindNote}${isTaskCard && isCardClosed(c) ? ' · <span class="tag tag-ok">zakończone</span>' : ''}${meet ? ` · z ustalenia: <button class="lnk" data-act="open-meeting" data-id="${meet.id}">${esc(meet.title)}</button>` : ''}</p>
    </header>
    <div class="props">
      ${isTaskCard || c.stage ? `<div class="prop"><span class="prop-l">Status</span>${isTaskCard ? `<select class="pill tone-${cardTone(c) || 'todo'}" data-chg="card-status" aria-label="Status">${statusLists().map((l) => `<option value="${l.id}" ${l.id === c.listId ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select>` : `<label class="chk"><input type="checkbox" data-chg="card-done" ${c.done ? 'checked' : ''}><span>Etap ukończony</span></label>`}</div>` : ''}
      <div class="prop"><span class="prop-l">Termin</span><div class="row gap"><input type="date" value="${c.due || ''}" data-chg="card-due" aria-label="Termin">${c.due ? `<button class="icon-btn sm" data-act="due-clear" aria-label="Usuń termin">${ico('x')}</button>` : ''}</div></div>
      <div class="prop"><span class="prop-l">Odpowiedzialni</span><div class="row gap wrap">${(c.members || []).map((id) => `<span class="mem-chip">${avatar(id, 'sm')}<span>${esc(firstName(id))}</span></span>`).join('')}<button class="icon-btn add" data-act="cp-members" aria-label="Zmień odpowiedzialnych">${ico((c.members || []).length ? 'edit' : 'plus')}</button></div></div>
      <div class="prop"><span class="prop-l">Obszar</span><div class="row gap wrap">${lbls.map((l) => `<span class="area lbl-${l.color}">${esc(l.name)}</span>`).join('')}<button class="icon-btn add" data-act="cp-labels" aria-label="Zmień obszar">${ico(lbls.length ? 'edit' : 'plus')}</button></div></div>
    </div>
    ${isTaskCard ? decisionBlock(c) : ''}
    <section><h3>${ico('desc')}Opis i kryterium ukończenia</h3>${desc}</section>
    ${checklists}
    <div class="row gap wrap pt-s">${btn('cp-check', `${ico('checksq')} Dodaj checklistę`, 'sm')}${btn('cp-attach', `${ico('clip')} Dodaj załącznik`, 'sm')}</div>
    ${atts ? `<section><h3>${ico('clip')}Załączniki</h3><ul class="att-list">${atts}</ul></section>` : ''}
    <section><h3>${ico('comment')}Komentarze i historia</h3>
      <div class="cm-new">${avatar(ui.me, 'sm')}<div class="grow"><textarea id="cm-text" rows="2" placeholder="Napisz komentarz…" data-inp="cm-draft">${esc(commentDraft)}</textarea>${btn('cm-add', 'Zapisz komentarz', 'primary sm')}</div></div>
      <ul class="acts">${actHTML}</ul></section>
    <footer class="m-foot"><button class="btn sm" data-act="card-copy">${ico('copy')} Kopiuj</button><button class="btn sm" data-act="card-archive">${ico('archive')} Archiwizuj</button><span class="grow"></span><button class="btn sm danger" data-act="card-delete">${ico('trash')} Usuń</button></footer>
  </div>`;
}

/* ---------- tytuł, opis, status, termin ---------- */
function saveTitle(el) {
  const c = curCard(); if (!c) return;
  const v = el.value.replace(/\s+/g, ' ').trim();
  if (v && v !== c.title) { c.title = v; touchCard(c); commit({ only: 'main' }); } else el.value = c.title;
}
B['card-title'] = saveTitle; K['card-title'] = (el) => { saveTitle(el); el.blur(); };
I['desc-draft'] = (el) => { descDraft = el.value; };
A['desc-edit'] = () => { descEditing = true; descDraft = null; ui.focus = 'card-desc'; renderModal(); };
K['desc-edit'] = A['desc-edit'];
A['desc-cancel'] = () => { descEditing = false; descDraft = null; renderModal(); };
K['desc-cancel'] = A['desc-cancel'];
A['desc-save'] = () => { const c = curCard(); const ta = $('#card-desc'); if (c && ta) { c.desc = ta.value.trim(); touchCard(c); } descEditing = false; descDraft = null; commit(); };
C['card-status'] = (el) => { const c = curCard(); c.prevListId = c.listId; setStatus(c, el.value); commit(); };
C['card-done'] = (el) => { const c = curCard(); c.done = el.checked; logEvent(c, c.done ? 'oznaczono jako ukończone' : 'cofnięto ukończenie'); afterCardChange(c); };
C['card-due'] = (el) => { const c = curCard(); c.due = el.value || null; logEvent(c, c.due ? `ustalono termin: ${fmtLong(c.due)}` : 'usunięto termin'); afterCardChange(c); };
A['due-clear'] = () => { const c = curCard(); c.due = null; logEvent(c, 'usunięto termin'); afterCardChange(c); };

/* ---------- checklisty ---------- */
const findCl = (c, id) => c.checklists.find((x) => x.id === id);
C['cl-item'] = (el) => {
  const c = curCard(); const cl = findCl(c, el.dataset.cl); const it = cl && cl.items.find((x) => x.id === el.dataset.it);
  if (it) { it.done = el.checked; afterCardChange(c); }
};
function clItemAdd(el) {
  const c = curCard(); const cl = findCl(c, el.dataset.cl); const inp = $(`#cl-new-${el.dataset.cl}`);
  const v = inp ? inp.value.trim() : '';
  if (!v) { if (inp) inp.focus(); return; }
  cl.items.push({ id: uid('ci'), text: v, done: false });
  ui.focus = `cl-new-${cl.id}`; afterCardChange(c);
}
A['cl-item-add'] = clItemAdd; K['cl-item-add'] = clItemAdd;
A['cl-item-del'] = (el) => { const c = curCard(); const cl = findCl(c, el.dataset.cl); cl.items = cl.items.filter((i) => i.id !== el.dataset.it); afterCardChange(c); };
function clTitle(el) { const c = curCard(); if (!c) return; const cl = findCl(c, el.dataset.cl); const v = el.value.trim(); if (cl && v && v !== cl.title) { cl.title = v; touchCard(c); commit({ only: 'main' }); } }
B['cl-title'] = clTitle; K['cl-title'] = (el) => { clTitle(el); el.blur(); };
A['cl-del'] = (el) => {
  const c = curCard(); const cl = findCl(c, el.dataset.cl);
  confirmPop(el, `Usunąć checklistę „${cl.title}”?`, 'Usuń', () => { c.checklists = c.checklists.filter((x) => x.id !== cl.id); afterCardChange(c); });
};
A['cm-del'] = (el) => { const c = curCard(); c.comments = c.comments.filter((x) => x.id !== el.dataset.id); afterCardChange(c); };
A['att-del'] = (el) => { const c = curCard(); c.attachments = c.attachments.filter((x) => x.id !== el.dataset.id); afterCardChange(c); };
I['cm-draft'] = (el) => { commentDraft = el.value; };
A['cm-add'] = () => {
  const c = curCard(); const ta = $('#cm-text'); const v = ta ? ta.value.trim() : '';
  if (!v) { if (ta) ta.focus(); return; }
  c.comments.push({ id: uid('cm'), by: ui.me, text: v, ts: nowIso(), kind: 'comment' });
  commentDraft = ''; afterCardChange(c);
};

/* ---------- dymki: odpowiedzialni, obszar, checklista, załącznik ---------- */
A['cp-members'] = (el) => {
  openPop(el, () => {
    const c = curCard();
    return `<div class="pop-t">Odpowiedzialni</div>${members().map((m) => `<label class="chk row-pick"><input type="checkbox" data-chg="cp-member" value="${m.id}" ${(c.members || []).includes(m.id) ? 'checked' : ''}>${avatar(m.id, 'sm')}<span><b>${esc(m.name)}</b><small>${esc(m.role || '')}</small></span></label>`).join('')}`;
  }, { w: 320 });
};
C['cp-member'] = (el) => {
  const c = curCard(); c.members = c.members || [];
  const had = c.members.includes(el.value); toggleIn(c.members, el.value);
  logEvent(c, `${had ? 'usunięto' : 'dodano'} osobę: ${(memberById(el.value) || {}).name}`);
  afterCardChange(c); refreshPop();
};
A['cp-labels'] = (el) => {
  labelDraft = null;
  openPop(el, () => {
    const c = curCard(); const b = mainBoard();
    if (labelDraft) return `<div class="pop-nav"><button class="icon-btn" data-act="lb-cancel" aria-label="Wstecz">${ico('chevl')}</button><span>${labelDraft.id ? 'Edytuj obszar' : 'Nowy obszar'}</span></div>` + labelEditorHTML();
    return `<div class="pop-t">Obszar zadania</div>${(b.labels || []).map((l) => `<div class="lb-pick"><label class="chk grow"><input type="checkbox" data-chg="cp-label" value="${l.id}" ${(c.labels || []).includes(l.id) ? 'checked' : ''}><span class="area lbl-${l.color} wide">${esc(l.name) || '&nbsp;'}</span></label><button class="icon-btn" data-act="lb-edit-c" data-id="${l.id}" aria-label="Edytuj obszar">${ico('edit')}</button></div>`).join('')}
      <div class="pt">${btn('lb-new', 'Dodaj nowy obszar', 'sm')}</div>`;
  }, { w: 320 });
};
C['cp-label'] = (el) => { const c = curCard(); c.labels = c.labels || []; toggleIn(c.labels, el.value); afterCardChange(c); refreshPop(); };
A['lb-edit-c'] = (el) => { const l = labelOf(null, el.dataset.id); if (l) { labelDraft = { id: l.id, name: l.name, color: l.color }; refreshPop(); } };

A['cp-check'] = (el) => {
  openPop(el, () => `<div class="pop-t">Dodaj checklistę</div><label class="fld"><span>Tytuł</span><input id="cl-title-new" value="Kryteria ukończenia" maxlength="80" data-enter="cl-add" data-autofocus></label><div class="pt">${btn('cl-add', 'Dodaj', 'primary')}</div>`, { w: 290 });
  const i = $('#cl-title-new'); if (i) { i.focus(); i.select(); }
};
function clAdd() {
  const c = curCard(); const i = $('#cl-title-new'); const t = (i ? i.value.trim() : '') || 'Checklista';
  const id = uid('k'); c.checklists = c.checklists || []; c.checklists.push({ id, title: t, items: [] });
  closePop(); ui.focus = `cl-new-${id}`; afterCardChange(c);
}
A['cl-add'] = clAdd; K['cl-add'] = clAdd;
A['cp-attach'] = (el) => {
  openPop(el, () => `<div class="pop-t">Dodaj załącznik (link)</div>
    <label class="fld"><span>Adres (opcjonalnie)</span><input id="att-url" type="url" placeholder="https://…" data-autofocus></label>
    <label class="fld"><span>Nazwa</span><input id="att-name" maxlength="120" placeholder="np. Makieta dashboardu" data-enter="att-add"></label>
    <div class="pt">${btn('att-add', 'Dodaj', 'primary')}</div>`, { w: 310 });
};
function attAdd() {
  const c = curCard(); const url = ($('#att-url').value || '').trim(); const name = ($('#att-name').value || '').trim();
  if (!url && !name) { $('#att-name').focus(); return; }
  if (url && !/^https?:\/\//i.test(url)) { toast('Adres musi zaczynać się od http:// lub https://'); return; }
  c.attachments = c.attachments || []; c.attachments.push({ id: uid('a'), name: name || url, url });
  closePop(); afterCardChange(c);
}
A['att-add'] = attAdd; K['att-add'] = attAdd;

/* ---------- działania ---------- */
A['card-copy'] = () => {
  const c = curCard(); const id = uid('c');
  const cp = clone(c); cp.id = id; cp.title = c.title + ' (kopia)'; cp.pos = c.pos + 1; cp.comments = []; cp.created = nowIso(); cp.decision = null; delete cp.decision; delete cp.stage;
  cp.checklists.forEach((cl) => { cl.id = uid('k'); cl.items.forEach((i) => { i.id = uid('ci'); i.done = false; }); });
  cp.source = null; S.cards[id] = cp; logEvent(cp, 'utworzono kopię zadania');
  commit(); toast('Skopiowano zadanie'); openCard(id);
};
A['card-archive'] = () => {
  const c = curCard(); c.archived = true; touchCard(c); closeModal(); commit();
  toast('Zadanie zarchiwizowane', { action: 'Cofnij', onAction: () => { c.archived = false; commit(); } });
};
A['card-delete'] = (el) => {
  const c = curCard();
  confirmPop(el, 'Usunąć zadanie na stałe? Tej operacji nie można cofnąć.', 'Usuń zadanie', () => { deleteCard(c.id); closeModal(); commit(); toast('Zadanie usunięte'); });
};

/* ---------- decyzje szefa ---------- */
I['dc-q'] = (el) => { askDraft = el.value; };
A['dc-ask-open'] = () => { askOpen = true; askDraft = ''; ui.focus = 'dc-q'; renderModal(); };
A['dc-ask-cancel'] = () => { askOpen = false; renderModal(); };
A['dc-ask'] = () => {
  const c = curCard(); const q = ($('#dc-q') ? $('#dc-q').value : askDraft).trim();
  if (!q) { toast('Wpisz pytanie, na które szef ma odpowiedzieć.'); return; }
  c.decision = { status: 'pending', question: q, asked: nowIso(), by: ui.me, note: '' };
  logEvent(c, 'poproszono szefa o decyzję'); askOpen = false; askDraft = '';
  afterCardChange(c); toast('Prośba o decyzję trafiła do szefa');
};
A['dc-withdraw'] = (el) => { const c = S.cards[el.dataset.id]; if (c) { delete c.decision; logEvent(c, 'wycofano prośbę o decyzję'); afterCardChange(c); } };
A['dc-resolve'] = (el) => {
  const c = S.cards[el.dataset.id]; if (!c || !c.decision) return;
  const note = ($(`#dc-note-${c.id}`) ? $(`#dc-note-${c.id}`).value : '').trim();
  const r = el.dataset.r;
  if (r !== 'approved' && !note) { const n = $(`#dc-note-${c.id}`); if (n) { n.focus(); } toast(r === 'rejected' ? 'Dodaj krótkie uzasadnienie odrzucenia.' : 'Napisz, co zespół ma poprawić.'); return; }
  Object.assign(c.decision, { status: r, note, at: nowIso(), resolvedBy: ui.me });
  const label = { approved: 'zatwierdzono', rejected: 'odrzucono', changes: 'zwrócono z uwagami' }[r];
  logEvent(c, `${label} decyzję${note ? ': ' + note : ''}`);
  const wasHold = cardTone(c) === 'hold';
  afterCardChange(c);
  if (r === 'approved' && wasHold && listByTone('progress')) {
    toast('Decyzja zatwierdzona. Zadanie było wstrzymane.', { action: 'Odblokuj', onAction: () => { setStatus(c, listByTone('progress').id); commit(); }, ms: 8000 });
  } else toast(`Decyzja zapisana: ${label}`);
};
