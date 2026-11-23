'use strict';
/* Menedżerski Panel Zarządzania — Przegląd: stan projektu na jednym ekranie, wskaźniki liczone na żywo */

const hasCriterion = (c) => (c.checklists || []).some((cl) => cl.items.length) || /kryteri/i.test(c.desc || '');

function budgetInfo() {
  const b = S.meta.budget || { estimate: 0, expenses: [], tolerance: 10 };
  const actual = sum(b.expenses || [], (e) => Number(e.amount) || 0);
  const pj = project();
  const total = pj.start && pj.end ? Math.max(1, diffDays(pj.end, pj.start) + 1) : 0;
  const elapsed = total ? clamp(diffDays(todayStr(), pj.start) + 1, 0, total) : 0;
  const timePct = total ? Math.round((elapsed / total) * 100) : 0;
  const usedPct = b.estimate ? Math.round((actual / b.estimate) * 100) : 0;
  return { estimate: b.estimate || 0, actual, usedPct, timePct, pace: usedPct - timePct, tolerance: b.tolerance ?? 10, yearly: b.yearly || 0, left: (b.estimate || 0) - actual, n: (b.expenses || []).length };
}
function agreementsInfo() {
  let total = 0, conv = 0;
  for (const m of Object.values(S.meetings)) {
    if (!(m.status === 'done' || m.date <= todayStr())) continue;
    for (const it of m.items || []) { total++; if (it.cardId) conv++; }
  }
  return { total, conv, pct: total ? Math.round((conv / total) * 100) : null };
}
function qualityInfo() {
  const act = taskCards().filter((c) => !isCardClosed(c));
  const ok = act.filter((c) => (c.members || []).length && c.due && hasCriterion(c));
  return { total: act.length, ok: ok.length, pct: act.length ? Math.round((ok.length / act.length) * 100) : null };
}
function autoKpi(key) {
  if (key === 'budget') { const b = budgetInfo(); return b.n ? b.pace : null; }
  if (key === 'visits') { let n = 0; taskCards().forEach((c) => (c.checklists || []).forEach((cl) => { if (/wizyty/i.test(cl.title)) n += cl.items.filter((i) => i.done).length; })); return n; }
  if (key === 'quality') return qualityInfo().pct;
  if (key === 'agreements') return agreementsInfo().pct;
  return null;
}

function taskStats() {
  const tasks = taskCards();
  const by = { done: [], progress: [], todo: [], hold: [] };
  tasks.forEach((c) => { (by[isCardClosed(c) ? 'done' : (cardTone(c) || 'todo')] || by.todo).push(c); });
  const open = tasks.filter((c) => !isCardClosed(c));
  let ct = 0, cd = 0; tasks.forEach((c) => { const p = cardProgress(c); ct += p.total; cd += p.done; });
  const byMember = members().map((m) => {
    const mine = open.filter((c) => (c.members || []).includes(m.id));
    return { m, open: mine.length, overdue: mine.filter((c) => dueState(c) === 'overdue').length, done: tasks.filter((c) => isCardClosed(c) && (c.members || []).includes(m.id)).length };
  });
  return { tasks, by, open, overdue: open.filter((c) => dueState(c) === 'overdue'), ct, cd, byMember, upcoming: sortBy(open.filter((c) => c.due), (c) => c.due + norm(c.title)).slice(0, 6) };
}

const meter = (pct, cls = '') => `<div class="meter ${cls}" role="img" aria-label="${Math.round(pct)}%"><i style="width:${clamp(pct, 0, 100)}%"></i></div>`;
function hbars(rows, max) {
  return `<ul class="hbars">${rows.map((r) => `<li title="${esc(r.title || r.label)}: ${r.value}"><span class="hb-l">${r.left || esc(r.label)}</span><span class="hb-t"><i style="width:${max ? Math.max(r.value ? 3 : 0, (r.value / max) * 100) : 0}%"></i></span><span class="hb-v">${r.value}${r.extra || ''}</span></li>`).join('')}</ul>`;
}
function donut(pct, label, sub) {
  const r = 52, c = 2 * Math.PI * r; const d = (clamp(pct, 0, 100) / 100) * c;
  return `<div class="donut" role="img" aria-label="${label}: ${pct}%"><svg viewBox="0 0 128 128"><defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--g1)"/><stop offset="1" style="stop-color:var(--g2)"/></linearGradient></defs><circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--meter-bg)" stroke-width="12"/><circle cx="64" cy="64" r="${r}" fill="none" stroke="url(#dg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${d.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 64 64)"/></svg><div class="donut-c"><b>${pct}%</b><small>${sub}</small></div></div>`;
}

/* oś czasu planu 14–28.11 */
function timelineHTML() {
  const p = S.meta.plan; const pj = project();
  if (!p || !p.rows.length) return '<div class="empty-note">Brak kroków planu.</div>';
  const rows = p.rows.filter((r) => r.start && r.due);
  const min = pj.start && pj.start < rows.reduce((a, r) => (r.start < a ? r.start : a), '9999') ? pj.start : rows.reduce((a, r) => (r.start < a ? r.start : a), '9999');
  const max = pj.end && pj.end > rows.reduce((a, r) => (r.due > a ? r.due : a), '0000') ? pj.end : rows.reduce((a, r) => (r.due > a ? r.due : a), '0000');
  const n = diffDays(max, min) + 1; const today = todayStr();
  const days = Array.from({ length: n }, (_, i) => addDays(min, i));
  const pos = (d) => (diffDays(d, min) / n) * 100;
  const todayPos = today >= min && today <= max ? ((diffDays(today, min) + 0.5) / n) * 100 : null;
  const wide = n > 21;
  const head = days.map((d) => `<span class="tl-d ${dowIdx(d) >= 5 ? 'wkd' : ''} ${d === today ? 'today' : ''}">${!wide || dowIdx(d) === 0 || d === today ? `<b>${parseYmd(d).getDate()}</b><small>${wide ? MON_SHORT[parseYmd(d).getMonth()] : DOW[dowIdx(d)]}</small>` : ''}</span>`).join('');
  const body = rows.map((r) => {
    const late = !r.done && r.due < today; const act = !r.done && r.start <= today && today <= r.due;
    const st = r.done ? 'done' : late ? 'late' : act ? 'act' : 'next';
    const stTxt = { done: 'zakończony', late: 'po terminie', act: 'w toku', next: 'zaplanowany' }[st];
    return `<button class="tl-row" data-act="goto-view" data-v="plan" title="${esc(r.action)} · ${esc(r.owner)} · ${stTxt}">
      <span class="tl-l"><b>${esc(r.when)}</b><span>${esc(r.action)}</span></span>
      <span class="tl-track"><i class="tl-bar st-${st}" style="left:${pos(r.start)}%;width:${((diffDays(r.due, r.start) + 1) / n) * 100}%"><em>${esc(r.owner)}</em></i></span></button>`;
  }).join('');
  return `<div class="tl" style="--n:${n}"><div class="tl-head"><span class="tl-l"></span><span class="tl-days">${head}</span></div><div class="tl-body">${body}${todayPos !== null ? `<i class="tl-today" style="left:calc(var(--tl-label) + (100% - var(--tl-label)) * ${(todayPos / 100).toFixed(4)})" title="Dziś"></i>` : ''}</div></div>
    <ul class="tl-list">${rows.map((r) => { const late = !r.done && r.due < today; const act = !r.done && r.start <= today && today <= r.due; const st = r.done ? 'done' : late ? 'late' : act ? 'act' : 'next'; return `<li class="tl-i st-${st}"><button data-act="goto-view" data-v="plan"><span class="tl-dot"></span><span class="tl-t"><small>${esc(r.when)} · ${{ done: 'zakończony', late: 'po terminie', act: 'w toku', next: 'zaplanowany' }[st]}</small><b>${esc(r.action)}</b><em>${esc(r.owner)}</em></span></button></li>`; }).join('')}</ul>
    <ul class="legend inline"><li><i class="st-done"></i>zakończony</li><li><i class="st-act"></i>w toku</li><li><i class="st-late"></i>po terminie</li><li><i class="st-next"></i>zaplanowany</li></ul>`;
}

function stagesHTML() {
  const st = stageCards(); if (!st.length) return '';
  const firstOpen = st.findIndex((c) => !c.done);
  return `<ol class="stages">${st.map((c, i) => {
    const state = c.done ? 'done' : i === firstOpen ? 'act' : 'next';
    const txt = c.title.replace(/^ETAP\s*\d+\s*[—–-]\s*/i, '');
    return `<li class="stage st-${state}"><button data-act="open-card" data-card="${c.id}" title="${esc(c.title)}"><span class="stage-n">${c.done ? ico('check') : c.stage}</span><span class="stage-t"><small>Etap ${c.stage} · ${{ done: 'ukończony', act: 'w toku', next: 'planowany' }[state]}</small><b>${esc(txt)}</b></span></button></li>`;
  }).join('')}</ol>`;
}

function renderOverviewView() {
  const st = taskStats(); const total = st.tasks.length;
  const pct = total ? Math.round((st.by.done.length / total) * 100) : 0;
  const q = qualityInfo(); const ag = agreementsInfo(); const bud = budgetInfo();
  const pend = decisionsPending(); const att = attentionItems();
  const risks = risksSorted().filter((r) => r.status !== 'closed'); const lvl = { crit: 0, high: 0, mod: 0, low: 0 }; risks.forEach((r) => { lvl[riskLevel(riskScore(r))]++; });
  const meets = meetingsSorted().filter((m) => m.date >= todayStr() && m.status !== 'done').slice(0, 3);
  const pj = project(); const stt = S.meta.status || { overall: 'ok', summary: '' };
  const daysLeft = pj.end ? diffDays(pj.end, todayStr()) : null;
  const chk = st.ct ? Math.round((st.cd / st.ct) * 100) : 0;
  const maxMem = Math.max(1, ...st.byMember.map((x) => x.open));
  const segs = [['done', 'Zrobione', st.by.done.length], ['progress', 'W trakcie', st.by.progress.length], ['todo', 'Do zrobienia', st.by.todo.length], ['hold', 'Wstrzymane', st.by.hold.length]];
  const tiles = [
    ['Zadania zakończone', `${pct}%`, `${st.by.done.length} z ${total}`, '', 'tasks'],
    ['Po terminie', st.overdue.length, st.overdue.length ? 'wymaga reakcji' : 'brak zaległości', st.overdue.length ? 'bad' : 'ok', 'tasks'],
    ['Zablokowane', st.by.hold.length, st.by.hold.length ? 'blokery do rozwiązania' : 'bez blokad', st.by.hold.length ? 'warn' : 'ok', 'tasks'],
    ['Do decyzji', pend.length, pend.length ? 'czeka na Ciebie' : 'brak próśb', pend.length ? 'acc' : 'ok', 'decisions'],
    ['Ryzyka krytyczne', lvl.crit, `${risks.length} ${plural(risks.length, 'ryzyko', 'ryzyka', 'ryzyk')} w rejestrze`, lvl.crit ? 'warn' : 'ok', 'risks'],
    ['Budżet wykorzystany', bud.n ? `${bud.usedPct}%` : '—', bud.n ? `przy ${bud.timePct}% upływu czasu` : `szacunek ${money(bud.estimate)}`, bud.n && bud.pace > bud.tolerance ? 'bad' : '', 'budget'],
  ].map(([t, v, s, tone, go]) => `<button class="tile ${tone}" data-act="goto-view" data-v="${go}"><span class="tile-t">${t}</span><b class="tile-v">${v}</b><small>${tone === 'bad' ? ico('warn') : tone === 'warn' ? ico('info') : tone === 'ok' ? ico('check') : ''}${s}</small></button>`).join('');

  return `<div class="page-grid">
    <section class="hero">
      <div class="hero-main">
        <div class="hero-top">${stateTag(stt.overall)}<span class="muted">${pj.start ? `Stan projektu · plan ${fmtShort(pj.start)} – ${fmtShort(pj.end)} ${parseYmd(pj.end).getFullYear()}` : ''}${daysLeft !== null ? ` · ${daysLeft >= 0 ? `zostało ${daysLeft} ${plural(daysLeft, 'dzień', 'dni', 'dni')}` : 'po terminie planu'}` : ''}</span></div>
        <h2 class="hero-h">${esc(pj.title || 'Stan projektu')}</h2>
        <p class="hero-p">${esc(stt.summary || 'Dodaj podsumowanie w Raporcie statusowym.')}</p>
        <div class="row gap wrap pt">${btn('goto-view', 'Raport statusowy', 'sm', 'data-v="report"')}${btn('goto-view', 'Karta projektu', 'sm', 'data-v="project"')}</div>
      </div>
      ${donut(pct, 'Zadania zakończone', 'zadań zakończonych')}
    </section>
    ${stagesHTML() ? `<section class="panel"><h2 class="ph">Etapy projektu</h2>${stagesHTML()}</section>` : ''}
    <div class="tiles">${tiles}</div>
    <div class="cols-2">
      <section class="panel"><h2 class="ph">${ico('gavel')}Czeka na Twoją decyzję <span class="count">${pend.length}</span><button class="lnk right" data-act="goto-view" data-v="decisions">Wszystkie ${ico('arrow')}</button></h2>
        ${pend.length ? `<ul class="dec-list">${pend.slice(0, 2).map((c) => decisionItem(c, true)).join('')}</ul>` : '<div class="empty-note ok">Brak próśb o decyzję.</div>'}</section>
      <section class="panel"><h2 class="ph">${ico('bell')}Wymaga uwagi <span class="count">${att.length}</span><button class="lnk right" data-act="goto-view" data-v="decisions">Wszystkie ${ico('arrow')}</button></h2>
        ${att.length ? `<ul class="att-list2">${att.slice(0, 4).map(attentionRow).join('')}</ul>` : '<div class="empty-note ok">Brak sygnałów ostrzegawczych.</div>'}</section>
    </div>
    <section class="panel"><h2 class="ph">Harmonogram ${pj.start ? fmtShort(pj.start) + ' – ' + fmtShort(pj.end) : ''}<button class="lnk right" data-act="goto-view" data-v="plan">Plan działań ${ico('arrow')}</button></h2>${timelineHTML()}</section>
    <div class="cols-3">
      <section class="panel"><h2 class="ph">Zadania według statusu</h2>
        <div class="stack" role="img" aria-label="Zadania według statusu">${segs.filter((s) => s[2]).map(([t, n, c]) => `<i class="seg-${t}" style="flex:${c}" title="${n}: ${c}"></i>`).join('')}</div>
        <ul class="stack-leg">${segs.map(([t, n, c]) => `<li><i class="seg-${t}"></i><span>${n}</span><b>${c}</b><small>${total ? Math.round((c / total) * 100) : 0}%</small></li>`).join('')}</ul>
        <div class="kpi"><div class="kpi-h"><span>Punkty checklist</span><b>${chk}%</b></div>${meter(chk, chk === 100 ? 'ok' : '')}<small>${st.cd} z ${st.ct} punktów ukończonych</small></div></section>
      <section class="panel"><h2 class="ph">Obciążenie zespołu <small>otwarte zadania</small><button class="lnk right" data-act="goto-view" data-v="team">Zespół ${ico('arrow')}</button></h2>${hbars(st.byMember.map((x) => ({ left: `<span class="hb-who">${avatar(x.m.id, 'xs')}${esc(x.m.name.split(' ')[0])}</span>`, label: x.m.name, value: x.open, extra: x.overdue ? ` <span class="tag tag-bad" title="Po terminie">${ico('warn')} ${x.overdue}</span>` : '' })), maxMem)}</section>
      <section class="panel"><h2 class="ph">Najbliższe terminy</h2>${st.upcoming.length ? `<ul class="dl">${st.upcoming.map((c) => `<li><button class="dl-row" data-act="open-card" data-card="${c.id}"><span class="dl-d">${dueChip(c).replace(/<small.*$/, '')}</span><span class="dl-t">${esc(c.title)}</span><span class="av-stack">${avatarStack(c.members, 'xs')}</span></button></li>`).join('')}</ul>` : '<div class="empty-note">Brak otwartych zadań z terminem.</div>'}</section>
    </div>
    <div class="cols-3">
      <section class="panel"><h2 class="ph">Ryzyka <small>${risks.length}</small><button class="lnk right" data-act="goto-view" data-v="risks">Rejestr ${ico('arrow')}</button></h2>
        <div class="risk-dist">${[['crit', 'Krytyczne'], ['high', 'Wysokie'], ['mod', 'Umiarkowane'], ['low', 'Niskie']].map(([k, t]) => `<div class="rd rl-${k}"><b>${lvl[k]}</b><span>${t}</span></div>`).join('')}</div>
        <ul class="top-risks">${risks.slice(0, 3).map((r) => `<li><span class="rbadge rl-${riskLevel(riskScore(r))}">${riskScore(r)}</span><span><b>${r.code}</b> ${esc(r.title)}</span></li>`).join('')}</ul></section>
      <section class="panel"><h2 class="ph">Budżet<button class="lnk right" data-act="goto-view" data-v="budget">Szczegóły ${ico('arrow')}</button></h2>
        <div class="bud"><div><small>Budżet</small><b>${money(bud.estimate)}</b></div><div><small>Wydatki</small><b>${bud.n ? money(bud.actual) : '—'}</b></div><div><small>Pozostało</small><b>${bud.n ? money(bud.left) : '—'}</b></div></div>
        <div class="meter-wrap"><div class="meter ${bud.pace > bud.tolerance ? 'bad' : ''}" role="img" aria-label="Wykorzystano ${bud.usedPct}% budżetu"><i style="width:${clamp(bud.usedPct, 0, 100)}%"></i></div><i class="meter-mark" style="left:${clamp(bud.timePct, 0, 100)}%" title="Upłynęło ${bud.timePct}% czasu projektu"></i></div>
        <small class="muted">${bud.n ? `Wydano ${bud.usedPct}% budżetu przy ${bud.timePct}% upływu czasu (${bud.pace > 0 ? '+' : ''}${bud.pace} pp). Znacznik pokazuje upływ czasu.` : 'Brak zapisanych wydatków.'} W budżecie: licencje i narzędzia ${money(bud.yearly)}.</small></section>
      <section class="panel"><h2 class="ph">Najbliższe spotkania<button class="lnk right" data-act="goto-view" data-v="schedule">Harmonogram ${ico('arrow')}</button></h2>${meets.length ? meets.map((m) => `<button class="up-row" data-act="open-meeting" data-id="${m.id}"><span class="up-d"><b>${parseYmd(m.date).getDate()}</b><small>${MON_SHORT[parseYmd(m.date).getMonth()]}</small></span><span class="ag-t"><b>${esc(m.title)}</b><small>${m.start}–${m.end} · ${esc(m.room)}</small></span></button>`).join('') : '<p class="muted">Brak zaplanowanych spotkań.</p>'}
        <div class="kpi mt"><div class="kpi-h"><span>Ustalenia zamienione na zadania</span><b>${ag.pct === null ? '—' : ag.pct + '%'}</b></div>${meter(ag.pct || 0, ag.pct >= 90 ? 'ok' : '')}<small>Cel: min. 90% · ${ag.conv} z ${ag.total}</small></div></section>
    </div>
    <section class="panel"><h2 class="ph">Aktywność w projekcie</h2>${activityHTML(8)}</section>
  </div>`;
}
A['goto-view'] = (el) => setView(el.dataset.v);
