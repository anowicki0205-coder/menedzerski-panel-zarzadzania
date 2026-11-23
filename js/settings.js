'use strict';
/* Menedżerski Panel Zarządzania — dane i ustawienia: obszary (etykiety), archiwum, eksport, import, przywracanie danych */

let setMenu = 'main';
let labelDraft = null;
const labelBoard = () => mainBoard();

A['settings-open'] = (el) => {
  if (pop.anchor === el) { closePop(); return; }
  setMenu = 'main'; labelDraft = null;
  openPop(el, settingsHTML, { w: 340 });
};
const backRow = (t) => `<div class="pop-nav"><button class="icon-btn" data-act="set-back" aria-label="Wstecz">${ico('chevl')}</button><span>${t}</span></div>`;
A['set-back'] = () => { setMenu = 'main'; labelDraft = null; refreshPop(); };
A['set-go'] = (el) => { setMenu = el.dataset.v; labelDraft = null; refreshPop(); };

function settingsHTML() {
  const b = labelBoard(); if (!b) return '';
  if (setMenu === 'labels') return backRow('Obszary zadań') + labelsManagerHTML(b);
  if (setMenu === 'archive') return backRow('Archiwum zadań') + archiveHTML();
  return `<div class="pop-t">Dane i ustawienia</div><div class="menu">
    <button data-act="set-go" data-v="labels">${ico('tag')} Obszary zadań (etykiety)</button>
    <button data-act="set-go" data-v="archive">${ico('archive')} Archiwum zadań</button>
    <hr>
    <button data-act="export-data">${ico('download')} Eksportuj dane (JSON)</button>
    <label class="menu-file">${ico('upload')} Importuj dane (JSON)<input type="file" accept=".json,application/json" data-chg="import-file" hidden></label>
    <button data-act="reset-demo">${ico('reset')} Przywróć dane przykładowe</button></div>`;
}

A['reset-demo'] = (el) => {
  confirmPop(el, P.mode === 'shared' ? 'Zastąpić dane WSZYSTKICH użytkowników danymi przykładowymi?' : 'Przywrócić dane przykładowe? Twoje zmiany zostaną utracone.', 'Przywróć', () => {
    resetDemo(); ui.tf = { q: '', status: '', member: '', due: '', label: '', group: ui.tf.group, collapsed: {} }; closeModal(); commit(); toast('Przywrócono dane przykładowe');
  });
};
A['export-data'] = async () => {
  const json = exportJSON(); const fname = `menedzerski-panel-zarzadzania-${todayStr()}.json`;
  let done = false;
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) { await dl.save({ filename: fname, data: json }); done = true; toast('Zapisano plik z danymi'); }
  } catch (e) { if (e && e.code === 'declined') return; }
  if (!done) {
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000); toast('Pobrano plik z danymi'); done = true;
    } catch (e) { /* */ }
  }
  if (!done || window.self !== window.top) {
    const ok = await copyText(json);
    if (ok && !done) toast('Dane skopiowano do schowka (JSON)');
  }
};
C['import-file'] = (el) => {
  const f = el.files && el.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { importJSON(String(r.result)); closePop(); closeModal(); commit(); toast('Zaimportowano dane'); }
    catch (e) { toast(e.message || 'Nie udało się zaimportować pliku'); }
  };
  r.readAsText(f);
};

/* edytor obszarów (etykiet) — używany w ustawieniach i w oknie zadania */
function labelEditorHTML() {
  const d = labelDraft;
  return `<label class="fld"><span>Nazwa</span><input id="lb-name" value="${esc(d.name)}" maxlength="40" data-inp="lb-name" data-enter="lb-save" placeholder="np. Pilne"></label>
    <div class="fld"><span>Kolor</span><div class="sw-grid">${Object.keys(LABEL_COLORS).map((k) => `<button class="sw lbl-${k} ${d.color === k ? 'on' : ''}" data-act="lb-color" data-color="${k}" aria-label="${LABEL_COLORS[k]}" aria-pressed="${d.color === k}">${d.color === k ? ico('check') : ''}</button>`).join('')}</div></div>
    <div class="row gap pt">${btn('lb-save', 'Zapisz', 'primary')}${btn('lb-cancel', 'Anuluj')}${d.id ? `<span class="grow"></span>${btn('lb-delete', 'Usuń', 'danger')}` : ''}</div>`;
}
function labelsManagerHTML(b) {
  if (labelDraft) return labelEditorHTML();
  return `<div class="menu">${(b.labels || []).map((l) => `<div class="lb-row"><span class="area lbl-${l.color} wide">${esc(l.name) || '&nbsp;'}</span><button class="icon-btn" data-act="lb-edit" data-id="${l.id}" aria-label="Edytuj obszar ${esc(l.name)}">${ico('edit')}</button></div>`).join('')}
    <button data-act="lb-new">${ico('plus')} Dodaj obszar</button></div>`;
}
A['lb-new'] = () => { labelDraft = { id: null, name: '', color: 'blue' }; refreshPop(); const i = $('#lb-name'); if (i) i.focus(); };
A['lb-edit'] = (el) => { const l = labelOf(labelBoard(), el.dataset.id); if (l) { labelDraft = { id: l.id, name: l.name, color: l.color }; refreshPop(); } };
A['lb-color'] = (el) => { labelDraft.color = el.dataset.color; refreshPop(); };
I['lb-name'] = (el) => { labelDraft.name = el.value; };
A['lb-cancel'] = () => { labelDraft = null; refreshPop(); };
function labelSave() {
  const b = labelBoard(); const d = labelDraft; if (!d) return;
  const name = d.name.trim();
  if (d.id) { const l = labelOf(b, d.id); if (l) { l.name = name; l.color = d.color; } }
  else { b.labels.push({ id: uid('lb'), name, color: d.color }); }
  labelDraft = null; commit(); refreshPop();
}
A['lb-save'] = labelSave; K['lb-save'] = labelSave;
A['lb-delete'] = (el) => {
  const b = labelBoard(); const id = labelDraft.id;
  confirmPop(el, 'Usunąć obszar ze wszystkich zadań?', 'Usuń obszar', () => {
    b.labels = b.labels.filter((l) => l.id !== id);
    Object.values(S.cards).forEach((c) => { if (c.labels) c.labels = c.labels.filter((x) => x !== id); });
    labelDraft = null; commit();
  });
};

function archiveHTML() {
  const cards = Object.values(S.cards).filter((c) => c.archived);
  if (!cards.length) return '<p class="muted pad">Archiwum jest puste.</p>';
  return `<div class="menu">${cards.map((c) => `<div class="ar-row"><span>${esc(c.title)}</span><span class="row gap"><button class="btn sm" data-act="restore-card" data-id="${c.id}">Przywróć</button><button class="icon-btn" data-act="del-archived-card" data-id="${c.id}" aria-label="Usuń na stałe">${ico('trash')}</button></span></div>`).join('')}</div>`;
}
A['restore-card'] = (el) => { const c = S.cards[el.dataset.id]; if (!c) return; c.archived = false; commit(); refreshPop(); };
A['del-archived-card'] = (el) => { deleteCard(el.dataset.id); commit(); refreshPop(); };
