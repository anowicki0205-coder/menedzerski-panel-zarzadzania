'use strict';
/* Menedżerski Panel Zarządzania — start aplikacji, menu boczne, nagłówek strony, routing, tryb wspólny */

const NAV = [
  { group: 'Zarządzanie', items: ['overview', 'decisions', 'tasks', 'team', 'schedule'] },
  { group: 'Kontrola', items: ['risks', 'budget', 'scorecard', 'report'] },
  { group: 'Analiza i plan', items: ['strategy', 'plan', 'project'] },
];
const VIEWS = {
  overview: { hash: 'przeglad', label: 'Przegląd', icon: 'gauge', title: 'Przegląd projektu', sub: () => `Stan na ${fmtLong(todayStr())}`, render: () => renderOverviewView() },
  decisions: { hash: 'decyzje', label: 'Do decyzji', icon: 'gavel', title: 'Do decyzji', sub: () => 'Prośby zespołu o zatwierdzenie i sygnały, które wymagają Twojej uwagi', render: () => renderDecisionsView() },
  tasks: { hash: 'zadania', label: 'Zadania', icon: 'table', title: 'Zadania', sub: () => 'Wszystkie zadania projektu: status, odpowiedzialni, terminy i postęp', render: () => renderTasksView() },
  team: { hash: 'zespol', label: 'Zespół', icon: 'users', title: 'Zespół', sub: () => 'Obciążenie i odpowiedzialność osób w projekcie', render: () => renderTeamView() },
  schedule: { hash: 'harmonogram', label: 'Harmonogram', icon: 'calendar', title: 'Harmonogram i spotkania', sub: () => 'Terminy, spotkania, sale i ustalenia zamieniane w zadania', render: () => renderPlannerView() },
  risks: { hash: 'ryzyka', label: 'Ryzyka', icon: 'shield', title: 'Rejestr ryzyk', sub: () => 'Ocena = prawdopodobieństwo × wpływ, skala 1–5', render: () => renderRisksView() },
  budget: { hash: 'budzet', label: 'Budżet', icon: 'coin', title: 'Budżet', sub: () => 'Szacunek wobec wydatków rzeczywistych', render: () => renderBudgetView() },
  scorecard: { hash: 'wyniki', label: 'Karta wyników', icon: 'target', title: 'Karta wyników', sub: () => 'Wskaźniki projektu: cel, wartość bieżąca i stan', render: () => renderScorecardView() },
  report: { hash: 'raport', label: 'Raport statusowy', icon: 'file', title: 'Raport statusowy', sub: () => `Stan na ${fmtLong(todayStr())}`, render: () => renderReportView() },
  strategy: { hash: 'analiza', label: 'PESTEL i SWOT', icon: 'layers', title: 'PESTEL i SWOT', sub: () => 'Otoczenie projektu i analiza sytuacji', render: () => renderStrategyView() },
  plan: { hash: 'plan', label: 'Plan działań', icon: 'flag', title: 'Plan działań', sub: () => 'Re-baseline 14–28 listopada 2026', render: () => renderPlanView() },
  project: { hash: 'projekt', label: 'Karta projektu', icon: 'briefcase', title: 'Karta projektu', sub: () => 'Cel, zakres MVP, zespół i założenia', render: () => renderProjectView() },
};
const viewHash = () => VIEWS[ui.view].hash;
const setHash = (h) => { try { if (location.hash !== '#' + h) history.replaceState(null, '', '#' + h); } catch (e) { /* */ } };
function setView(v) {
  if (!VIEWS[v]) return;
  ui.view = v; ui.navOpen = false; saveUi(); closePop(); setHash(VIEWS[v].hash); requestRender();
  const m = $('#main'); if (m && m.firstElementChild) m.firstElementChild.scrollTop = 0;
}
function applyHash() {
  const h = (location.hash || '').replace('#', '');
  const v = Object.keys(VIEWS).find((k) => VIEWS[k].hash === h);
  if (v) ui.view = v;
}
window.addEventListener('hashchange', () => { applyHash(); requestRender(); });
A.nav = (el) => setView(el.dataset.v);
A['nav-toggle'] = () => { ui.navOpen = !ui.navOpen; requestRender({ only: 'chrome' }); };
A['nav-close'] = () => { ui.navOpen = false; requestRender({ only: 'chrome' }); };

/* ---------- renderowanie ---------- */
let pendingR = null, rafR = 0;
function requestRender(opts = {}) {
  const only = (opts && opts.only) || 'all';
  if (only === 'none') return;
  pendingR = pendingR || { all: false, main: false, chrome: false };
  pendingR[only] = true;
  if (rafR) return;
  rafR = requestAnimationFrame(() => { rafR = 0; const r = pendingR; pendingR = null; if (r) doRender(r); });
}
function doRender(r) {
  if (r.all || r.chrome) renderChrome();
  if (r.all || r.main) renderMain();
  if (r.all) { renderModal(); refreshPop(); }
}

/* podpisy komórek tabel (na telefonie wiersze stają się kartami z etykietami pól) */
function labelCells(root) {
  $$('table.tbl', root).forEach((t) => {
    const hs = $$('thead th', t).map((th) => th.textContent.trim());
    $$('tbody tr', t).forEach((tr) => {
      Array.from(tr.children).forEach((td, i) => { if (td.tagName === 'TD' && td.colSpan <= 1 && hs[i]) td.setAttribute('data-l', hs[i]); });
    });
  });
}

function renderMain() {
  const root = $('#main');
  const keep = {};
  $$('[data-keep]', root).forEach((el) => { keep[el.dataset.keep] = [el.scrollLeft, el.scrollTop]; });
  let html = '';
  try { html = VIEWS[ui.view].render(); } catch (e) {
    console.error(e);
    html = `<div class="sheet"><div class="empty-note">Wystąpił błąd podczas rysowania widoku. ${esc(e.message)}</div></div>`;
  }
  root.innerHTML = `<div class="view view-${ui.view}" data-keep="view">${html}</div>`;
  labelCells(root);
  $$('[data-keep]', root).forEach((el) => { const k = keep[el.dataset.keep]; if (k) { el.scrollLeft = k[0]; el.scrollTop = k[1]; } });
  applyFocus();
}

const SYNC = {
  local: ['lock', 'Zapis lokalny', 'Dane są zapisywane tylko w tej przeglądarce.'],
  connecting: ['cloud', 'Łączenie…', 'Łączenie ze wspólną bazą zespołu.'],
  synced: ['cloud', 'Dane wspólne', 'Zmiany widzą wszyscy użytkownicy tego panelu.'],
  saving: ['cloud', 'Zapisywanie…', 'Zapisywanie zmian we wspólnej bazie.'],
  offline: ['warn', 'Brak połączenia', 'Zmiany mogą się nie zapisać. Odśwież stronę po odzyskaniu połączenia.'],
  readonly: ['eye', 'Tylko odczyt', 'Nie masz uprawnień do edycji. Poproś właściciela o rolę Współautora.'],
  error: ['warn', 'Błąd zapisu', 'Nie udało się zapisać zmian.'],
};

function navBadge(k) {
  if (k === 'decisions') { const n = decisionsPending().length; return n ? `<i class="nbadge acc" title="Prośby czekające na decyzję">${n}</i>` : ''; }
  if (k === 'tasks') { const n = taskCards().filter((c) => !isCardClosed(c) && dueState(c) === 'overdue').length; return n ? `<i class="nbadge bad" title="Zadania po terminie">${n}</i>` : ''; }
  return '';
}

function renderChrome() {
  const v = VIEWS[ui.view];
  const sy = SYNC[P.state] || SYNC.local;
  const me = memberById(ui.me) || BOSS;
  $('#app').classList.toggle('nav-open', !!ui.navOpen);
  $('#sidebar').innerHTML = `
    <div class="sb-brand"><span class="logo">${LOGO}</span><span class="sb-name">Menedżerski Panel Zarządzania</span></div>
    <div class="demo-tag" title="Osoby, firmy w roli klientów, liczby i zdarzenia w tym panelu są wymyślone, aby pokazać możliwości systemu.">Dane demonstracyjne</div>
    <nav class="sb-nav" aria-label="Nawigacja główna">${NAV.map((g) => `<div class="sb-group"><h2>${g.group}</h2>${g.items.map((k) => `<button class="sb-i ${ui.view === k ? 'on' : ''}" data-act="nav" data-v="${k}" aria-current="${ui.view === k ? 'page' : 'false'}">${ico(VIEWS[k].icon)}<span>${VIEWS[k].label}</span>${navBadge(k)}</button>`).join('')}</div>`).join('')}</nav>
    <div class="sb-foot">
      <button class="sb-sync sync-${P.state}" data-act="share-open" title="${esc(sy[2])}">${ico(sy[0])}<span>${sy[1]}</span></button>
      <button class="sb-demo" data-act="sim-open" aria-label="Symulacja dni pracy">${ico('calendar')}<span><small>Dzień w panelu</small><b>${esc(fmtDow(todayStr()))} ${esc(fmtShort(todayStr()))}</b></span><i class="sb-go">${ico('arrow')}</i></button>
      <button class="sb-i" data-act="settings-open">${ico('sliders')}<span>Dane i ustawienia</span></button>
      <button class="sb-me" data-act="me-open" aria-label="Pracujesz jako ${esc(me.name)}. Zmień.">${avatar(me.id, 'sm')}<span><b>${esc(me.name)}</b><small>${me.id === 'boss' ? 'widok kierownika' : 'członek zespołu'}</small></span>${ico('chevd')}</button>
    </div>`;
  const TABS = ['overview', 'decisions', 'tasks', 'schedule'];
  const short = { overview: 'Przegląd', decisions: 'Decyzje', tasks: 'Zadania', schedule: 'Terminy' };
  $('#tabbar').innerHTML = TABS.map((k) => `<button class="tab ${ui.view === k ? 'on' : ''}" data-act="nav" data-v="${k}" aria-current="${ui.view === k ? 'page' : 'false'}"><span class="tab-ic">${ico(VIEWS[k].icon)}${navBadge(k)}</span><span>${short[k]}</span></button>`).join('')
    + `<button class="tab ${TABS.includes(ui.view) ? '' : 'on'}" data-act="nav-toggle" aria-label="Więcej widoków"><span class="tab-ic">${ico('menu')}</span><span>${TABS.includes(ui.view) ? 'Więcej' : esc(VIEWS[ui.view].label.split(' ')[0])}</span></button>`;
  $('#fab-root').innerHTML = `<button class="fab" data-act="new-task" aria-label="Zleć zadanie">${ico('plus')}</button>`;
  $('#pagehead').innerHTML = `
    <button class="icon-btn menu-btn" data-act="nav-toggle" aria-label="Menu">${ico('menu')}</button>
    <div class="ph-t"><h1>${esc(v.title)}</h1><p>${esc(v.sub())}</p></div>
    <span class="grow"></span>
    <button class="btn" data-act="meeting-new">${ico('calendar')}<span>Zaplanuj spotkanie</span></button>
    <button class="btn primary" data-act="new-task">${ico('plus')}<span>Zleć zadanie</span></button>`;
}

/* tożsamość i udostępnianie */
A['me-open'] = (el) => {
  if (pop.anchor === el) { closePop(); return; }
  openPop(el, () => `<div class="pop-t">Pracujesz jako</div><p class="hint">Komentarze i historia zmian będą podpisane tym imieniem. Decyzje zatwierdza „Szef”. Wybór zapisuje się tylko w tej przeglądarce.</p>${[BOSS, ...members()].map((m) => `<label class="chk row-pick"><input type="radio" name="me" data-chg="me-set" value="${m.id}" ${ui.me === m.id ? 'checked' : ''}>${avatar(m.id, 'sm')}<span><b>${esc(m.name)}</b><small>${esc(m.role || '')}</small></span></label>`).join('')}`, { w: 310 });
};
C['me-set'] = (el) => { ui.me = el.value; ui.meChosen = true; saveUi(); requestRender(); toast(`Pracujesz jako ${memberById(ui.me).name}`); };
A['share-open'] = (el) => {
  if (pop.anchor === el) { closePop(); return; }
  openPop(el, () => {
    const sy = SYNC[P.state] || SYNC.local;
    return `<div class="pop-t">Zapis i udostępnianie</div>
      <div class="share-state sync-${P.state}">${ico(sy[0])}<span><b>${sy[1]}</b><small>${esc(sy[2])}</small></span></div>
      <p class="hint">${P.mode === 'shared' ? 'Wszyscy użytkownicy z dostępem do panelu pracują na tych samych danych. Zmiany pojawiają się na żywo.' : 'Aby zespół pracował na tych samych danych, uruchom panel w trybie wspólnym (opublikowany w Claude) albo wymieniajcie się plikiem danych.'}</p>
      <div class="menu"><button data-act="copy-link">${ico('link')} Kopiuj link do panelu</button>
      <button data-act="export-data">${ico('download')} Eksportuj dane (JSON)</button>
      <label class="menu-file">${ico('upload')} Importuj dane (JSON)<input type="file" accept=".json,application/json" data-chg="import-file" hidden></label></div>`;
  }, { w: 340 });
};
A['copy-link'] = async () => { const ok = await copyText(location.href.split('#')[0] + '#' + viewHash()); toast(ok ? 'Skopiowano link' : 'Nie udało się skopiować linku'); closePop(); };
A['member-add-open'] = (el) => {
  if (pop.anchor === el) { closePop(); return; }
  openPop(el, () => `<div class="pop-t">Dodaj osobę do zespołu</div><label class="fld"><span>Imię i nazwisko</span><input id="nm-name" placeholder="np. Jan Kowalski" maxlength="60" data-enter="member-add" data-autofocus></label><label class="fld"><span>Zakres odpowiedzialności</span><input id="nm-role" placeholder="np. Testy i dokumentacja" maxlength="80" data-enter="member-add"></label><div class="pt">${btn('member-add', 'Dodaj', 'primary')}</div>`, { w: 300 });
};
function memberAdd() {
  const i = $('#nm-name'); const v = i ? i.value.trim() : ''; if (!v) { if (i) i.focus(); return; }
  const palette = ['#7c3aed', '#be185d', '#15803d', '#a16207', '#0369a1', '#b91c1c'];
  S.meta.members.list.push({ id: uid('m'), name: v, color: palette[members().length % palette.length], role: ($('#nm-role').value || '').trim() || 'Członek zespołu' });
  closePop(); commit(); toast(`Dodano osobę: ${v}`);
}
A['member-add'] = memberAdd; K['member-add'] = memberAdd;

/* ---------- start ---------- */
P.onStatus = () => { requestRender({ only: 'chrome' }); if (pop.el && pop.anchor && pop.anchor.dataset.act === 'share-open') refreshPop(); };
P.onError = (e) => {
  if (e.code === 'readonly') toast('Nie masz uprawnień do edycji. Poproś właściciela o rolę Współautora.', { ms: 6000 });
  else toast('Nie udało się zapisać zmian we wspólnej bazie. Sprawdź połączenie.', { ms: 6000 });
};
P.onRemote = () => {
  if (isTyping()) { setTimeout(P.onRemote, 1200); return; }
  requestRender();
};

async function connectShared() {
  const cl = window.claude;
  if (!cl || typeof cl.use !== 'function') return;
  let db = null, user = null, canWrite = null;
  try { user = await cl.use('user'); } catch (e) { /* */ }
  try { db = await cl.use('db'); } catch (e) { /* */ }
  if (!db) return;
  try { if (user) canWrite = await user.can('data.write'); } catch (e) { /* */ }
  const ok = await initShared(db, canWrite);
  if (ok) requestRender();
}

function boot() {
  loadLocal(); loadUi();
  if (!VIEWS[ui.view]) ui.view = 'overview';
  if (!memberById(ui.me)) ui.me = 'boss';
  applyHash();
  setHash(viewHash());
  doRender({ all: true });
  if (!ui.meChosen) { setTimeout(() => { if (!modal.render) toast(isNarrow() ? 'Pracujesz jako Szef. Imię zmienisz w menu „Więcej”.' : 'Pracujesz jako Szef. Zespół wybiera swoje imię w lewym dolnym rogu.', { action: 'Zmień', onAction: () => { const el = $('.sb-me'); if (el) el.click(); }, ms: 6000 }); ui.meChosen = true; saveUi(); }, 1400); }
  connectShared();
  window.addEventListener('beforeunload', () => flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
