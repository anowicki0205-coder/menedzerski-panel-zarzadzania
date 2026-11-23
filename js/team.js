'use strict';
/* Menedżerski Panel Zarządzania — Zespół, Karta projektu */

function renderTeamView() {
  const st = taskStats(); const avg = sum(st.byMember, (x) => x.open) / Math.max(1, st.byMember.length);
  const maxOpen = Math.max(1, ...st.byMember.map((x) => x.open));
  const cards = st.byMember.map((x) => {
    const m = x.m; const mine = sortBy(st.open.filter((c) => (c.members || []).includes(m.id)), (c) => (c.due || '9999') + norm(c.title));
    const load = x.open > avg * 1.25 ? ['high', 'Wysokie obciążenie'] : x.open < avg * 0.75 ? ['low', 'Niskie obciążenie'] : ['mid', 'Typowe obciążenie'];
    const risksOwned = risksSorted().filter((r) => r.status !== 'closed' && (r.owners || []).includes(m.id));
    return `<section class="panel person">
      <header class="person-h">${avatar(m.id)}<div class="grow"><h3>${esc(m.name)}</h3><small class="muted">${esc(m.role || '')}</small></div><span class="load load-${load[0]}">${load[1]}</span></header>
      <div class="p-stats"><div><b>${x.open}</b><small>otwarte</small></div><div class="${x.overdue ? 'bad' : ''}"><b>${x.overdue}</b><small>po terminie</small></div><div><b>${x.done}</b><small>zakończone</small></div><div><b>${risksOwned.length}</b><small>${plural(risksOwned.length, 'ryzyko', 'ryzyka', 'ryzyk')}</small></div></div>
      ${meter((x.open / maxOpen) * 100, x.overdue ? 'bad' : '')}
      <ul class="p-tasks">${mine.slice(0, 6).map((c) => `<li><button data-act="open-card" data-card="${c.id}"><span class="t-text">${esc(c.title)}</span><span class="pt-r">${c.due ? `<span class="due due-${dueState(c)}">${ico('clock')}${fmtShort(c.due)}</span>` : ''}<span class="dot tone-${cardTone(c)}" title="${esc((S.lists[c.listId] || {}).title || '')}"></span></span></button></li>`).join('') || '<li class="muted">Brak otwartych zadań.</li>'}${mine.length > 6 ? `<li><button class="lnk" data-act="person-tasks" data-id="${m.id}">Pokaż wszystkie ${mine.length}</button></li>` : ''}</ul>
      <div class="row gap pt">${btn('new-task', `${ico('plus')} Zleć zadanie`, 'sm', `data-member="${m.id}"`)}${btn('person-tasks', 'Wszystkie zadania', 'sm', `data-id="${m.id}"`)}</div></section>`;
  }).join('');
  const orphans = st.open.filter((c) => !(c.members || []).length);
  return `<div class="page-grid"><div class="lead-row"><p class="lead">Obciążenie liczone jest z otwartych zadań. Kryterium wiarygodnego statusu wymaga, żeby każde aktywne zadanie miało właściciela.</p>${btn('member-add-open', `${ico('userplus')} Dodaj osobę`, 'sm')}</div>
    <div class="people">${cards}</div>
    ${orphans.length ? `<section class="panel"><h2 class="ph">${ico('warn')}Zadania bez właściciela <span class="count">${orphans.length}</span></h2><ul class="p-tasks wide">${orphans.map((c) => `<li><button data-act="open-card" data-card="${c.id}"><span class="t-text">${esc(c.title)}</span><span class="pt-r">${c.due ? `<span class="due due-${dueState(c)}">${ico('clock')}${fmtShort(c.due)}</span>` : ''}<span class="tag tag-warn">przypisz</span></span></button></li>`).join('')}</ul></section>` : ''}</div>`;
}
A['person-tasks'] = (el) => { Object.assign(ui.tf, { q: '', status: '', member: el.dataset.id, due: '', label: '' }); closePop(); setView('tasks'); };

function renderProjectView() {
  const pj = project(); const b = mainBoard();
  const brief = briefCards(); const costs = costCards();
  const lst = (arr) => `<ul class="ticks">${arr.map((t, i) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  return `<div class="page-grid cols-2">
    <section class="panel wide"><h2 class="ph">${esc(pj.title || pj.name || PROJECT_NAME)}</h2>
      <p class="proj-goal">${esc(pj.goal || '')}</p>
      <dl class="facts">${(pj.facts || []).map((f) => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join('')}<div><dt>Osoby</dt><dd>${members().map((m) => esc(m.name)).join(', ')}</dd></div></dl></section>
    <section class="panel"><h2 class="ph">${ico('check')}Zakres MVP</h2>${lst(pj.scopeIn || [])}</section>
    <section class="panel"><h2 class="ph">${ico('x')}Poza MVP</h2>${lst(pj.scopeOut || [])}</section>
    <section class="panel wide"><h2 class="ph">Założenia projektu</h2>
      <div class="brief">${brief.map((c) => `<button class="brief-c" data-act="open-card" data-card="${c.id}"><b>${esc(c.title)}</b>${c.desc ? `<div class="rich">${rich(c.desc)}</div>` : ''}${(c.attachments || []).length ? `<small class="muted">${ico('clip')} ${c.attachments.map((a) => esc(a.name)).join(', ')}</small>` : ''}</button>`).join('')}</div></section>
    ${costs.length ? `<section class="panel wide"><h2 class="ph">Dokumenty kosztorysu</h2><div class="brief">${costs.map((c) => `<button class="brief-c" data-act="open-card" data-card="${c.id}"><b>${esc(c.title)}</b>${c.desc ? `<div class="rich">${rich(c.desc)}</div>` : ''}${(c.attachments || []).length ? `<small class="muted">${ico('clip')} ${c.attachments.map((a) => esc(a.name)).join(', ')}</small>` : ''}</button>`).join('')}</div></section>` : ''}
  </div>`;
}
