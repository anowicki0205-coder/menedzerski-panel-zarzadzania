'use strict';
/* Menedżerski Panel Zarządzania — Do decyzji: prośby o decyzję szefa oraz sygnały wymagające uwagi (liczone automatycznie) */

const SEV_NAME = { high: 'Pilne', med: 'Do sprawdzenia', low: 'Porządki' };

/* sygnały ostrzegawcze: reguły jawne i sprawdzalne */
function attentionItems() {
  const items = []; const today = todayStr();
  const tasks = taskCards(); const open = tasks.filter((c) => !isCardClosed(c));
  open.filter((c) => dueState(c) === 'overdue').forEach((c) => {
    const d = -diffDays(c.due, today);
    items.push({ sev: 'high', ico: 'clock', title: c.title, detail: `Po terminie o ${d} ${plural(d, 'dzień', 'dni', 'dni')} (${fmtShort(c.due)}) · ${(c.members || []).length ? ownerNames(c) : 'bez właściciela'}`, kind: 'Zadanie po terminie', btn: ['Otwórz', 'open-card', `data-card="${c.id}"`] });
  });
  tasks.filter((c) => cardTone(c) === 'hold').forEach((c) => {
    const pend = c.decision && c.decision.status === 'pending';
    items.push({ sev: 'high', ico: 'warn', title: c.title, detail: pend ? 'Zablokowane i czeka na Twoją decyzję' : 'Zadanie wstrzymane. Ustal, co je blokuje.', kind: 'Zadanie wstrzymane', btn: ['Otwórz', 'open-card', `data-card="${c.id}"`] });
  });
  open.filter((c) => cardTone(c) === 'todo' && c.due && diffDays(c.due, today) >= 0 && diffDays(c.due, today) <= 2).forEach((c) => {
    const d = diffDays(c.due, today);
    items.push({ sev: 'med', ico: 'clock', title: c.title, detail: `Termin ${d === 0 ? 'dziś' : d === 1 ? 'jutro' : 'za 2 dni'}, a zadanie jest wciąż w statusie „${(S.lists[c.listId] || {}).title}” · ${(c.members || []).length ? ownerNames(c) : 'bez właściciela'}`, kind: 'Zagrożony termin', btn: ['Otwórz', 'open-card', `data-card="${c.id}"`] });
  });
  const noOwner = open.filter((c) => !(c.members || []).length);
  if (noOwner.length) items.push({ sev: 'med', ico: 'user', title: `${noOwner.length} ${plural(noOwner.length, 'aktywne zadanie nie ma', 'aktywne zadania nie mają', 'aktywnych zadań nie ma')} właściciela`, detail: 'Kryterium wiarygodnego statusu wymaga właściciela, terminu i kryterium ukończenia.', kind: 'Higiena zadań', btn: ['Pokaż', 'show-tasks', 'data-f="owner"'] });
  const noDue = open.filter((c) => !c.due);
  if (noDue.length) items.push({ sev: 'low', ico: 'calendar', title: `${noDue.length} ${plural(noDue.length, 'aktywne zadanie nie ma', 'aktywne zadania nie mają', 'aktywnych zadań nie ma')} terminu`, detail: 'Bez terminu nie da się ocenić, czy harmonogram jest zagrożony.', kind: 'Higiena zadań', btn: ['Pokaż', 'show-tasks', 'data-f="due"'] });
  risksSorted().filter((r) => r.status !== 'closed' && riskScore(r) >= 15).forEach((r) => {
    items.push({ sev: 'med', ico: 'shield', title: `${r.code} ${r.title}`, detail: `Ocena ${riskScore(r)} (P ${r.p} × W ${r.w}) · ${r.action}`, kind: 'Ryzyko krytyczne', btn: ['Rejestr ryzyk', 'goto-view', 'data-v="risks"'] });
  });
  (S.meta.scorecard ? S.meta.scorecard.rows : []).filter((k) => k.auto).forEach((k) => {
    const e = kpiEval(k);
    if (e.st === 'off') items.push({ sev: 'med', ico: 'target', title: k.name, detail: `Obecnie ${e.cur}${k.unit ? ' ' + k.unit : ''}, cel ${k.mode === 'atmost' ? '≤' : '≥'} ${k.target}${k.unit ? ' ' + k.unit : ''}`, kind: 'Wskaźnik poniżej celu', btn: ['Karta wyników', 'goto-view', 'data-v="scorecard"'] });
  });
  meetingsSorted().filter((m) => m.date <= today).forEach((m) => (m.items || []).filter((it) => !it.cardId).forEach((it) => {
    items.push({ sev: 'med', ico: 'calendar', title: it.text, detail: `Ustalenie ze spotkania „${m.title}” (${fmtShort(m.date)}) nie ma zadania · ${firstName(it.owner)}${it.due ? ', termin ' + fmtShort(it.due) : ''}`, kind: 'Ustalenie bez zadania', btn: ['Utwórz zadanie', 'ag-make-card', `data-m="${m.id}" data-id="${it.id}"`] });
  }));
  (S.meta.plan ? S.meta.plan.rows : []).filter((r) => !r.done && r.due && r.due < today).forEach((r) => {
    items.push({ sev: 'high', ico: 'flag', title: r.action, detail: `Krok planu po terminie (${r.when}) · ${r.owner}`, kind: 'Plan działań', btn: ['Plan działań', 'goto-view', 'data-v="plan"'] });
  });
  const order = { high: 0, med: 1, low: 2 };
  return items.sort((a, b) => order[a.sev] - order[b.sev]);
}

A['show-tasks'] = (el) => {
  Object.assign(ui.tf, { q: '', status: '', member: el.dataset.f === 'owner' ? '_none' : '', due: el.dataset.f === 'due' ? 'none' : '', label: '' });
  setView('tasks');
};
A['ag-make-card'] = (el) => {
  const m = S.meetings[el.dataset.m]; const it = m && (m.items || []).find((x) => x.id === el.dataset.id); if (!it) return;
  const r = makeTask(m, it);
  if (!r) { toast('Brak statusu „Do zrobienia”.'); return; }
  commit(); toast(`Utworzono zadanie (${r.list.title})`, { action: 'Otwórz', onAction: () => openCard(r.card.id) });
};

const attentionRow = (a) => `<li class="att-row sev-${a.sev}"><span class="att-ic">${ico(a.ico)}</span><div class="att-b"><small class="att-k">${a.kind}</small><b>${esc(a.title)}</b><span class="att-d">${esc(a.detail)}</span></div>${btn(a.btn[1], a.btn[0], 'sm', a.btn[2])}</li>`;

function decisionItem(c, compact) {
  const d = c.decision; const isBoss = ui.me === 'boss'; const who = memberById(d.by);
  const hold = cardTone(c) === 'hold';
  return `<li class="dec-item ${compact ? 'compact' : ''}">
    <div class="dec-h"><button class="lnk strong" data-act="open-card" data-card="${c.id}">${esc(c.title)}</button>
      <span class="tags">${hold ? `<span class="tag tag-warn">${ico('warn')} wstrzymane</span>` : ''}${c.due ? `<span class="due due-${dueState(c)}">${ico('clock')}${fmtShort(c.due)}</span>` : ''}</span></div>
    <p class="dec-q">${esc(d.question)}</p>
    <small class="muted">Prosi: ${who ? esc(who.name) : '—'} · ${relTime(d.asked)}</small>
    ${compact
    ? `<div class="row gap pt">${isBoss ? btn('dc-resolve', `${ico('check')} Zatwierdzam`, 'primary sm', `data-id="${c.id}" data-r="approved"`) : ''}${btn('open-card', 'Szczegóły i inne opcje', 'sm', `data-card="${c.id}"`)}</div>`
    : (isBoss ? `<label class="fld pt"><span>Uwagi do decyzji ${'(wymagane przy odrzuceniu i zwrocie)'}</span><textarea id="dc-note-${c.id}" rows="2" placeholder="Warunki, zmiany do wprowadzenia, uzasadnienie…"></textarea></label>
      <div class="row gap wrap">${btn('dc-resolve', `${ico('check')} Zatwierdzam`, 'primary', `data-id="${c.id}" data-r="approved"`)}${btn('dc-resolve', 'Wróć z uwagami', '', `data-id="${c.id}" data-r="changes"`)}${btn('dc-resolve', 'Odrzucam', 'danger', `data-id="${c.id}" data-r="rejected"`)}</div>`
      : '<p class="hint">Decyzję podejmuje szef. Wybierz „Szef” w lewym dolnym rogu, aby zatwierdzać.</p>')}
  </li>`;
}

function renderDecisionsView() {
  const pend = decisionsPending(); const done = decisionsResolved(); const att = attentionItems();
  const groups = ['high', 'med', 'low'].map((s) => ({ s, rows: att.filter((a) => a.sev === s) })).filter((g) => g.rows.length);
  return `<div class="page-grid cols-2">
    <section class="panel"><h2 class="ph">${ico('gavel')}Czeka na decyzję szefa <span class="count">${pend.length}</span></h2>
      ${pend.length ? `<ul class="dec-list">${pend.map((c) => decisionItem(c, false)).join('')}</ul>` : '<div class="empty-note ok">Brak próśb o decyzję. Zespół może pracować bez blokad.</div>'}
      <p class="hint">Zespół zgłasza prośbę z poziomu zadania (przycisk „Poproś szefa o decyzję”). Zatwierdzenie zadania wstrzymanego pozwala od razu je odblokować.</p></section>
    <section class="panel"><h2 class="ph">${ico('bell')}Wymaga uwagi <span class="count">${att.length}</span></h2>
      ${groups.length ? groups.map((g) => `<h3 class="sev-h sev-${g.s}">${SEV_NAME[g.s]} <small>${g.rows.length}</small></h3><ul class="att-list2">${g.rows.map(attentionRow).join('')}</ul>`).join('') : '<div class="empty-note ok">Brak sygnałów ostrzegawczych.</div>'}
      <p class="hint">Sygnały są liczone na bieżąco z zadań, ryzyk, spotkań, planu i karty wyników. Znikają, gdy problem zostanie rozwiązany.</p></section>
    <section class="panel wide"><h2 class="ph">Historia decyzji <span class="count">${done.length}</span></h2>
      ${done.length ? `<ul class="hist">${done.map((c) => { const d = c.decision; const lbl = { approved: 'Zatwierdzone', rejected: 'Odrzucone', changes: 'Zwrócone z uwagami' }[d.status]; const tone = { approved: 'ok', rejected: 'bad', changes: 'warn' }[d.status]; return `<li><span class="tag tag-${tone}">${lbl}</span><button class="lnk" data-act="open-card" data-card="${c.id}">${esc(c.title)}</button><span class="muted">${relTime(d.at)}${d.note ? ' · ' + esc(d.note) : ''}</span></li>`; }).join('')}</ul>` : '<p class="muted">Jeszcze nie podjęto żadnej decyzji.</p>'}</section>
  </div>`;
}
