'use strict';
/* Menedżerski Panel Zarządzania — ryzyka i macierz, PESTEL, SWOT, karta wyników, raport statusowy, plan działań, budżet */

const RISK_STATUS = { open: 'Otwarte', watch: 'Monitorowane', closed: 'Zamknięte' };
const STATE_LABEL = { ok: 'Na torze', risk: 'Zagrożony', late: 'Opóźniony' };
const STATE_ICON = { ok: 'check', risk: 'warn', late: 'x' };
const stateTag = (s) => `<span class="st st-${s}">${ico(STATE_ICON[s] || 'info')}${STATE_LABEL[s] || s}</span>`;

/* ---------- pomocnicze: pola edytowalne ---------- */
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }
const ta = (val, attrs, rows) => `<textarea class="cell" rows="${rows || Math.max(2, Math.ceil(String(val || '').length / 46))}" data-blur="an-text" ${attrs}>${esc(val || '')}</textarea>`;
const inpt = (val, attrs, type = 'text') => `<input class="cell" type="${type}" value="${esc(val ?? '')}" data-blur="an-text" data-enter="an-enter" ${attrs}>`;

function editTarget(el) {
  const t = el.dataset.t, rid = el.dataset.rid;
  if (t === 'risk') return S.risks[rid];
  const meta = { pestel: S.meta.pestel, kpi: S.meta.scorecard, plan: S.meta.plan, status: S.meta.status }[t];
  if (meta) return meta.rows.find((r) => r.id === rid);
  if (t === 'exp') return S.meta.budget.expenses.find((r) => r.id === rid);
  return null;
}
function writeField(el, value) {
  if (el.dataset.t === 'meta') { const cur = getPath(S.meta, el.dataset.k); if (cur !== value) { setPath(S.meta, el.dataset.k, value); return true; } return false; }
  const o = editTarget(el); if (!o) return false;
  const f = el.dataset.f; if (o[f] === value) return false;
  o[f] = value; return true;
}
const parseVal = (el, raw) => (el.dataset.num ? (raw === '' || raw == null ? null : Number(String(raw).replace(',', '.'))) : raw);
B['an-text'] = (el) => { if (writeField(el, parseVal(el, el.value))) commit({ only: 'none' }); };
K['an-enter'] = (el) => el.blur();
C['an-sel'] = (el) => { if (writeField(el, el.dataset.num ? Number(el.value) : el.value)) commit(); };
C['an-num'] = (el) => { if (writeField(el, parseVal(el, el.value))) commit(); };
C['an-chk'] = (el) => { if (writeField(el, el.checked)) commit(); };
const sel = (opts, cur, attrs) => `<select data-chg="an-sel" ${attrs}>${opts.map(([v, t]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
const scale = (n) => Array.from({ length: n }, (_, i) => [i + 1, i + 1]);

A['an-row-del'] = (el) => {
  const t = el.dataset.t, rid = el.dataset.rid;
  confirmPop(el, 'Usunąć ten wiersz?', 'Usuń', () => {
    if (t === 'risk') delete S.risks[rid];
    else if (t === 'exp') S.meta.budget.expenses = S.meta.budget.expenses.filter((r) => r.id !== rid);
    else { const m = { pestel: S.meta.pestel, kpi: S.meta.scorecard, plan: S.meta.plan, status: S.meta.status }[t]; m.rows = m.rows.filter((r) => r.id !== rid); }
    commit();
  });
};
A['an-list-del'] = (el) => { const arr = getPath(S.meta, el.dataset.k); arr.splice(Number(el.dataset.i), 1); commit(); };
A['an-list-add'] = (el) => {
  const inp = $(`#add-${el.dataset.k.replace(/\./g, '-')}`); const v = inp ? inp.value.trim() : '';
  if (!v) { if (inp) inp.focus(); return; }
  getPath(S.meta, el.dataset.k).push(v); ui.focus = inp.id; commit();
};
K['an-list-add'] = (el) => A['an-list-add']({ dataset: { k: el.dataset.k } });

/* ---------- widoki ---------- */
const sheet = (inner) => `<div class="sheet">${inner}</div>`;
const renderRisksView = () => sheet(anRisks());
const renderScorecardView = () => sheet(anScore());
const renderReportView = () => sheet(anStatus());
const renderPlanView = () => sheet(anPlan());
const renderBudgetView = () => sheet(anBudget());
function renderStrategyView() {
  const t = ui.strategyTab === 'swot' ? 'swot' : 'pestel';
  return sheet(`<div class="tabs" role="tablist">${[['pestel', 'PESTEL', 'layers'], ['swot', 'SWOT', 'target']].map(([k, n, ic]) => `<button role="tab" aria-selected="${k === t}" class="${k === t ? 'on' : ''}" data-act="strategy-tab" data-tab="${k}">${ico(ic)}<span>${n}</span></button>`).join('')}</div>${t === 'swot' ? anSwot() : anPestel()}`);
}
A['strategy-tab'] = (el) => { ui.strategyTab = el.dataset.tab; saveUi(); requestRender({ only: 'main' }); };

/* ---------- ryzyka ---------- */
const activeRisks = () => risksSorted().filter((r) => r.status !== 'closed');
function anRisks() {
  const rs = risksSorted();
  const rows = rs.map((r) => {
    const sc = riskScore(r); const lv = riskLevel(sc);
    return `<tr class="${r.status === 'closed' ? 'closed' : ''}">
      <td class="nw"><b>${r.code}</b></td>
      <td class="c-title">${ta(r.title, `data-t="risk" data-rid="${r.id}" data-f="title"`, 2)}</td>
      <td>${sel(scale(5), r.p, `data-t="risk" data-rid="${r.id}" data-f="p" data-num="1" aria-label="Prawdopodobieństwo"`)}</td>
      <td>${sel(scale(5), r.w, `data-t="risk" data-rid="${r.id}" data-f="w" data-num="1" aria-label="Wpływ"`)}</td>
      <td class="nw"><span class="rbadge rl-${lv}">${sc}</span> <small>${RISK_LABEL[lv]}</small></td>
      <td class="c-wide"><label class="mini">Sygnał</label>${ta(r.signal, `data-t="risk" data-rid="${r.id}" data-f="signal"`)}<label class="mini">Reakcja</label>${ta(r.action, `data-t="risk" data-rid="${r.id}" data-f="action"`)}</td>
      <td class="nw"><button class="owners" data-act="risk-owners" data-rid="${r.id}" aria-label="Właściciele ryzyka">${(r.owners || []).length ? avatarStack(r.owners, 'sm') : '<small class="muted">brak</small>'}</button></td>
      <td>${sel(Object.entries(RISK_STATUS), r.status, `data-t="risk" data-rid="${r.id}" data-f="status" aria-label="Status"`)}</td>
      <td><button class="icon-btn" data-act="an-row-del" data-t="risk" data-rid="${r.id}" aria-label="Usuń ryzyko">${ico('trash')}</button></td></tr>`;
  }).join('');
  const act = activeRisks();
  const mat = [5, 4, 3, 2, 1].map((p) => `<tr><th scope="row">${p}</th>${[1, 2, 3, 4, 5].map((w) => {
    const sc = p * w; const here = act.filter((r) => r.p === p && r.w === w);
    return `<td class="mx rl-${riskLevel(sc)}" title="P=${p}, W=${w}, ocena ${sc}${here.length ? ': ' + here.map((r) => r.title).join('; ') : ''}">${here.length ? `<b>${here.map((r) => r.code).join(', ')}</b>` : ''}<small>${sc}</small></td>`;
  }).join('')}</tr>`).join('');
  return `<div class="risk-top"><div class="matrix-box"><h3>Macierz prawdopodobieństwa i wpływu</h3><div class="mx-wrap"><div class="mx-y">Prawdopodobieństwo (P)</div><table class="mx-tbl"><tbody>${mat}<tr><th></th>${[1, 2, 3, 4, 5].map((w) => `<th scope="col">${w}</th>`).join('')}</tr></tbody></table></div><div class="mx-x">Wpływ (W)</div></div>
    <div class="risk-notes"><p class="lead">Skala prawdopodobieństwa (P) i wpływu (W) wynosi od 1 do 5. Ocena = P × W: <b>1–4 niski</b>, <b>5–9 umiarkowany</b>, <b>10–14 wysoki</b>, <b>15–25 krytyczny</b>. Zmiana P lub W przelicza ocenę i macierz od razu. Kody ryzyk pokazują ich położenie według bieżącej oceny.</p>
    <ul class="legend">${[['low', 'Niski 1–4'], ['mod', 'Umiarkowany 5–9'], ['high', 'Wysoki 10–14'], ['crit', 'Krytyczny 15–25']].map(([k, t]) => `<li><i class="rl-${k}"></i>${t}</li>`).join('')}</ul>
    <p class="hint">Oceny należy aktualizować po testach, zmianach zakresu i każdym incydencie. Rejestr przeglądamy cyklicznie.</p></div></div>
    <div class="tbl-wrap"><table class="tbl risk-tbl"><thead><tr><th>ID</th><th>Zdarzenie ryzyka</th><th title="Prawdopodobieństwo">P</th><th title="Wpływ">W</th><th>Ocena</th><th>Sygnał i reakcja</th><th>Właściciel</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row pt">${btn('risk-add', `${ico('plus')} Dodaj ryzyko`, 'sm primary')}</div>`;
}
A['risk-add'] = () => {
  const n = Object.keys(S.risks).length + 1; const id = uid('r');
  S.risks[id] = { id, code: 'R' + n, title: 'Nowe ryzyko', p: 3, w: 3, signal: '', action: '', owners: [ui.me], status: 'open' };
  commit();
};
A['risk-owners'] = (el) => {
  const rid = el.dataset.rid;
  if (pop.anchor === el) { closePop(); return; }
  openPop(el, () => {
    const r = S.risks[rid]; if (!r) return '';
    return `<div class="pop-t">Właściciele ryzyka ${r.code}</div>${members().map((m) => `<label class="chk row-pick"><input type="checkbox" data-chg="risk-owner" data-rid="${rid}" value="${m.id}" ${(r.owners || []).includes(m.id) ? 'checked' : ''}>${avatar(m.id, 'sm')}<span><b>${esc(m.name)}</b></span></label>`).join('')}`;
  }, { w: 280 });
};
C['risk-owner'] = (el) => { const r = S.risks[el.dataset.rid]; r.owners = r.owners || []; toggleIn(r.owners, el.value); commit(); refreshPop(); };

/* ---------- PESTEL ---------- */
function anPestel() {
  const p = S.meta.pestel;
  const rows = p.rows.map((r) => `<tr><td class="c-area">${inpt(r.area, `data-t="pestel" data-rid="${r.id}" data-f="area"`)}</td>
    <td>${ta(r.factor, `data-t="pestel" data-rid="${r.id}" data-f="factor"`)}</td><td>${ta(r.conclusion, `data-t="pestel" data-rid="${r.id}" data-f="conclusion"`)}</td>
    <td class="nw">${sel([[1, '1 · niski'], [2, '2 · średni'], [3, '3 · wysoki']], r.impact, `data-t="pestel" data-rid="${r.id}" data-f="impact" data-num="1" aria-label="Wpływ"`)}<div class="imp imp-${r.impact}" aria-hidden="true"><i></i><i></i><i></i></div></td>
    <td><button class="icon-btn" data-act="an-row-del" data-t="pestel" data-rid="${r.id}" aria-label="Usuń wiersz">${ico('trash')}</button></td></tr>`).join('');
  return `<p class="lead">Największą uwagę wymagają prywatność danych, zaufanie użytkowników i stabilność małego prototypu. Czynniki polityczne i środowiskowe mają mniejszy wpływ na samą demonstrację MVP.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Obszar</th><th>Czynnik dla projektu</th><th>Wniosek dla projektu</th><th>Wpływ</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row pt">${btn('pestel-add', `${ico('plus')} Dodaj czynnik`, 'sm')}</div>
    <div class="callout"><b>Priorytet.</b> ${ta(p.priority, 'data-t="meta" data-k="pestel.priority"', 3)}</div>`;
}
A['pestel-add'] = () => { S.meta.pestel.rows.push({ id: uid('p'), area: 'Nowy obszar', impact: 2, factor: '', conclusion: '' }); commit(); };

/* ---------- SWOT ---------- */
function swotBox(key, title, cls) {
  const items = S.meta.swot[key];
  return `<section class="swot-box ${cls}"><h3>${title}</h3><ul>${items.map((t, i) => `<li>${ta(t, `data-t="meta" data-k="swot.${key}.${i}"`, 2)}<button class="icon-btn sm" data-act="an-list-del" data-k="swot.${key}" data-i="${i}" aria-label="Usuń punkt">${ico('x')}</button></li>`).join('')}</ul>
    <div class="cl-add"><input id="add-swot-${key}" placeholder="Dodaj punkt…" data-enter="an-list-add" data-k="swot.${key}" maxlength="240" aria-label="Nowy punkt: ${title}">${btn('an-list-add', 'Dodaj', 'sm', `data-k="swot.${key}"`)}</div></section>`;
}
function anSwot() {
  const st = S.meta.swot.strategy.map((s, i) => `<tr><td class="nw"><b class="sk">${s.k}</b></td><td>${ta(s.txt, `data-t="meta" data-k="swot.strategy.${i}.txt"`, 2)}</td></tr>`).join('');
  return `<p class="lead">SWOT opisuje sytuację projektu, a nie potwierdzone wyniki wdrożenia. Punkty rozwijają wstępną analizę i wiążą ją z zakresem MVP.</p>
    <div class="swot">${swotBox('s', 'Mocne strony', 'sw-s')}${swotBox('w', 'Słabe strony', 'sw-w')}${swotBox('o', 'Szanse', 'sw-o')}${swotBox('t', 'Zagrożenia', 'sw-t')}</div>
    <h3 class="sub">Wnioski strategiczne</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kierunek</th><th>Działanie</th></tr></thead><tbody>${st}</tbody></table></div>`;
}

/* ---------- karta wyników ---------- */
function kpiEval(k) {
  const cur = k.auto ? autoKpi(k.auto) : k.current;
  if (cur === null || cur === undefined || Number.isNaN(cur)) return { cur: null, st: 'none' };
  const ok = k.mode === 'atmost' ? cur <= k.target : cur >= k.target;
  return { cur, st: ok ? 'ok' : 'off' };
}
function anScore() {
  const sc = S.meta.scorecard; let last = '';
  const rows = sc.rows.map((k) => {
    const e = kpiEval(k); const head = k.persp !== last; last = k.persp;
    const pct = e.cur === null ? 0 : k.mode === 'atmost' ? (k.target === 0 ? (e.cur === 0 ? 100 : 0) : clamp(100 - ((e.cur - k.target) / k.target) * 100, 0, 100)) : clamp((e.cur / (k.target || 1)) * 100, 0, 100);
    const tag = e.st === 'ok' ? `<span class="st st-ok">${ico('check')}Cel osiągnięty</span>` : e.st === 'off' ? `<span class="st st-risk">${ico('warn')}Poniżej celu</span>` : `<span class="st st-none">${ico('clock')}Brak pomiaru</span>`;
    return `${head ? `<tr class="persp"><th colspan="7">${k.persp}</th></tr>` : ''}<tr>
      <td>${ta(k.goal, `data-t="kpi" data-rid="${k.id}" data-f="goal"`, 2)}</td>
      <td>${ta(k.name, `data-t="kpi" data-rid="${k.id}" data-f="name"`, 2)}</td>
      <td class="nw"><span class="tgt">${k.mode === 'atmost' ? '≤' : '≥'} ${inpt(k.target, `data-t="kpi" data-rid="${k.id}" data-f="target" data-num="1" size="3" aria-label="Wartość docelowa"`, 'number')} <small>${esc(k.unit)}</small></span></td>
      <td class="nw">${k.auto ? `<b class="cur">${e.cur === null ? '—' : e.cur + ' ' + esc(k.unit)}</b> <small class="muted">auto</small>` : `<span class="tgt">${inpt(k.current, `data-t="kpi" data-rid="${k.id}" data-f="current" data-num="1" placeholder="—" aria-label="Wartość bieżąca"`, 'number')} <small>${esc(k.unit)}</small></span>`}${meter(Math.round(pct), e.st === 'ok' ? 'ok' : '')}</td>
      <td>${tag}</td>
      <td><small>${ta(k.source, `data-t="kpi" data-rid="${k.id}" data-f="source"`, 2)}</small></td>
      <td>${inpt(k.owner, `data-t="kpi" data-rid="${k.id}" data-f="owner"`)}</td></tr>`;
  }).join('');
  return `<p class="lead">${ta(sc.note, 'data-t="meta" data-k="scorecard.note"', 2)}</p>
    <div class="tbl-wrap"><table class="tbl kpi-tbl"><thead><tr><th>Cel</th><th>Wskaźnik</th><th>Cel (wartość)</th><th>Obecnie</th><th>Stan</th><th>Źródło i rytm</th><th>Właściciel</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Wskaźniki oznaczone „auto” liczą się na żywo z tablicy, spotkań i budżetu. Pozostałe wpisujemy ręcznie po testach.</p>`;
}

/* ---------- raport statusowy ---------- */
function statusByList() { return statusLists().map((l) => ({ l, n: cardsOf(l.id).filter((c) => !c.stage).length })); }
function reportText() {
  const st = S.meta.status; const s = taskStats(); const bud = budgetInfo();
  const lines = [`RAPORT STATUSOWY — ${PROJECT_NAME}`, `Stan na ${fmtLong(todayStr())}. Status ogólny: ${STATE_LABEL[st.overall]}.`, '', st.summary, ''];
  lines.push('ZADANIA');
  statusByList().forEach((x) => lines.push(`- ${x.l.title}: ${x.n}`));
  lines.push(`- Po terminie: ${s.overdue.length}; wstrzymane: ${s.by.hold.length}; checklisty: ${s.cd}/${s.ct}`, '');
  const pend = decisionsPending();
  lines.push(`DECYZJE SZEFA: oczekujące ${pend.length}${pend.length ? ' — ' + pend.map((c) => c.title).join('; ') : ''}`, '');
  lines.push('OBSZARY');
  st.rows.forEach((r) => lines.push(`- ${r.area} [${STATE_LABEL[r.state]}]: ${r.text} Następny krok: ${r.next}`));
  lines.push(`- Budżet: szacunek ${money(bud.estimate)}${bud.n ? `, wydatki ${money(bud.actual)}` : ', brak danych o wydatkach'}.`, '', 'DECYZJE NA NAJBLIŻSZY PRZEGLĄD');
  st.decisions.forEach((d) => lines.push(`- ${d}`));
  return lines.join('\n');
}
function anStatus() {
  const st = S.meta.status; const s = taskStats();
  const env = taskCards().find((c) => /środowisk|srodowisk/i.test(c.title) && cardProgress(c).total);
  const envP = env ? cardProgress(env) : null;
  const envOpen = env ? env.checklists.flatMap((cl) => cl.items.filter((i) => !i.done).map((i) => i.text)) : [];
  const docs = taskCards().filter((c) => (c.labels || []).some((l) => /dokument/i.test((labelOf(null, l) || {}).name || '')));
  const docsDone = docs.filter(isCardClosed).length;
  const auto = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Obszar</th><th>Zaobserwowany stan (z danych panelu)</th><th>Znaczenie i następny krok</th></tr></thead><tbody>
    <tr><td><b>Przepływ zadań</b></td><td>${statusByList().map((x) => `${esc(x.l.title)}: <b>${x.n}</b>`).join(' · ')}.<br>Po terminie: <b>${s.overdue.length}</b>, wstrzymane: <b>${s.by.hold.length}</b>.</td><td>${s.overdue.length ? 'Zaległe zadania wymagają decyzji właściciela i nowego terminu.' : 'Brak zadań po terminie. Utrzymać cotygodniowy przegląd.'}</td></tr>
    <tr><td><b>Środowisko</b></td><td>${envP ? `Checklista ${envP.done}/${envP.total}${envOpen.length ? `; nieukończone: ${esc(envOpen.join(', '))}` : ''}.` : 'Brak zadania z checklistą środowiska.'}</td><td>Domknąć pobranie i potwierdzić, że każdy członek potrafi uruchomić prototyp.</td></tr>
    <tr><td><b>Dokumentacja</b></td><td>Zadania z obszarem „Dokumentacja”: ${docsDone} z ${docs.length} zakończonych.</td><td>Uzgodnić właścicieli punktów checklisty i dodać końcowy plik do zadania dokumentacji.</td></tr>
    <tr><td><b>Decyzje szefa</b></td><td>Oczekujące prośby: <b>${decisionsPending().length}</b>.</td><td>${decisionsPending().length ? 'Zatwierdzenie odblokuje zadania zależne od decyzji.' : 'Brak oczekujących próśb.'}</td></tr></tbody></table></div>`;
  const rows = st.rows.map((r) => `<tr><td>${inpt(r.area, `data-t="status" data-rid="${r.id}" data-f="area"`)}</td><td>${sel(Object.entries(STATE_LABEL), r.state, `data-t="status" data-rid="${r.id}" data-f="state" aria-label="Stan"`)}</td><td>${ta(r.text, `data-t="status" data-rid="${r.id}" data-f="text"`)}</td><td>${ta(r.next, `data-t="status" data-rid="${r.id}" data-f="next"`)}</td><td><button class="icon-btn" data-act="an-row-del" data-t="status" data-rid="${r.id}" aria-label="Usuń wiersz">${ico('trash')}</button></td></tr>`).join('');
  return `<div class="status-head"><div><span class="muted">Stan na ${fmtLong(todayStr())}</span><div class="status-big">${stateTag(st.overall)}</div></div>
      <label class="fld inline"><span>Status ogólny</span>${sel(Object.entries(STATE_LABEL), st.overall, 'data-t="meta" data-k="status.overall" aria-label="Status ogólny"')}</label><span class="grow"></span>${btn('report-copy', `${ico('copy')} Kopiuj raport jako tekst`, 'sm')}</div>
    <label class="fld"><span>Podsumowanie (widoczne na stronie Przegląd)</span>${ta(st.summary, 'data-t="meta" data-k="status.summary"', 3)}</label>
    <h3 class="sub">Na podstawie danych panelu</h3>${auto}
    <h3 class="sub">Obszary ręczne</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Obszar</th><th>Stan</th><th>Opis</th><th>Następny krok</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row pt">${btn('status-add', `${ico('plus')} Dodaj obszar`, 'sm')}</div>
    <h3 class="sub">Decyzje na najbliższy przegląd</h3><ul class="dec">${st.decisions.map((d, i) => `<li>${ta(d, `data-t="meta" data-k="status.decisions.${i}"`, 2)}<button class="icon-btn sm" data-act="an-list-del" data-k="status.decisions" data-i="${i}" aria-label="Usuń decyzję">${ico('x')}</button></li>`).join('')}</ul>
    <div class="cl-add"><input id="add-status-decisions" placeholder="Dodaj decyzję…" data-enter="an-list-add" data-k="status.decisions" maxlength="300" aria-label="Nowa decyzja">${btn('an-list-add', 'Dodaj', 'sm', 'data-k="status.decisions"')}</div>`;
}
A['status-add'] = () => { S.meta.status.rows.push({ id: uid('s'), area: 'Nowy obszar', state: 'ok', text: '', next: '' }); commit(); };
A['report-copy'] = async () => { const ok = await copyText(reportText()); toast(ok ? 'Skopiowano raport do schowka' : 'Nie udało się skopiować raportu'); };

/* ---------- plan działań ---------- */
function anPlan() {
  const p = S.meta.plan; const today = todayStr();
  const done = p.rows.filter((r) => r.done).length;
  const rows = p.rows.map((r) => {
    const late = !r.done && r.due && r.due < today;
    return `<tr class="${r.done ? 'closed' : ''}"><td class="nw"><label class="chk"><input type="checkbox" data-chg="an-chk" data-t="plan" data-rid="${r.id}" data-f="done" ${r.done ? 'checked' : ''} aria-label="Wykonane"></label></td>
      <td class="nw c-dates">${inpt(r.when, `data-t="plan" data-rid="${r.id}" data-f="when" size="8" aria-label="Termin (opis)"`)}<div class="pdates"><div><label class="mini">Start</label><input class="cell" type="date" value="${r.start || ''}" data-chg="an-num" data-t="plan" data-rid="${r.id}" data-f="start" aria-label="Data rozpoczęcia"></div><div><label class="mini">Koniec</label><input class="cell" type="date" value="${r.due || ''}" data-chg="an-num" data-t="plan" data-rid="${r.id}" data-f="due" aria-label="Data zakończenia"></div></div>${late ? '<span class="tag tag-bad">po terminie</span>' : ''}</td>
      <td>${ta(r.action, `data-t="plan" data-rid="${r.id}" data-f="action"`)}</td><td>${inpt(r.owner, `data-t="plan" data-rid="${r.id}" data-f="owner"`)}</td><td>${ta(r.criterion, `data-t="plan" data-rid="${r.id}" data-f="criterion"`)}</td>
      <td class="nw">${btn('plan-card', 'Utwórz zadanie', 'sm', `data-rid="${r.id}" title="Utwórz zadanie z tego kroku"`)}<button class="icon-btn" data-act="an-row-del" data-t="plan" data-rid="${r.id}" aria-label="Usuń wiersz">${ico('trash')}</button></td></tr>`;
  }).join('');
  return `<p class="lead">${ta(p.note, 'data-t="meta" data-k="plan.note"', 2)}</p>
    <div class="plan-prog"><b>${done} z ${p.rows.length}</b> kroków wykonanych${meter(p.rows.length ? (done / p.rows.length) * 100 : 0, done === p.rows.length ? 'ok' : '')}</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Termin</th><th>Działanie</th><th>Proponowany właściciel</th><th>Kryterium zakończenia</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row pt">${btn('plan-add', `${ico('plus')} Dodaj krok`, 'sm')}</div>`;
}
A['plan-add'] = () => { S.meta.plan.rows.push({ id: uid('pl'), start: null, when: '', due: null, action: '', owner: '', criterion: '', done: false }); commit(); };
A['plan-card'] = (el) => {
  const r = S.meta.plan.rows.find((x) => x.id === el.dataset.rid); const list = defaultTargetList();
  if (!r || !list) { toast('Brak statusu „Do zrobienia”.'); return; }
  const c = addCard(list.id, r.action.slice(0, 120) || 'Krok planu', { due: r.due || null, desc: `Kryterium zakończenia: ${r.criterion || '—'}\nProponowany właściciel: ${r.owner || '—'}` });
  commit(); toast(`Dodano zadanie (${list.title})`, { action: 'Otwórz', onAction: () => openCard(c.id) });
};

/* ---------- budżet ---------- */
function anBudget() {
  const b = S.meta.budget; const bi = budgetInfo();
  const rows = (b.expenses || []).slice().sort((p, q) => (q.date || '').localeCompare(p.date || '')).map((e) => `<tr><td>${inpt(e.name, `data-t="exp" data-rid="${e.id}" data-f="name"`)}</td><td class="nw"><input class="cell" type="date" value="${e.date || ''}" data-chg="an-num" data-t="exp" data-rid="${e.id}" data-f="date" aria-label="Data"></td><td class="nw">${inpt(e.amount, `data-t="exp" data-rid="${e.id}" data-f="amount" data-num="1" aria-label="Kwota"`, 'number')} zł</td><td><button class="icon-btn" data-act="an-row-del" data-t="exp" data-rid="${e.id}" aria-label="Usuń wydatek">${ico('trash')}</button></td></tr>`).join('');
  return `<p class="lead">${ta(b.note, 'data-t="meta" data-k="budget.note"', 2)}</p>
    <div class="bud-grid">
      <label class="fld"><span>Budżet projektu (zł)</span>${inpt(b.estimate, 'data-t="meta" data-k="budget.estimate" data-num="1"', 'number')}</label>
      <label class="fld"><span>w tym licencje i narzędzia (zł)</span>${inpt(b.yearly, 'data-t="meta" data-k="budget.yearly" data-num="1"', 'number')}</label>
      <label class="fld"><span>Dopuszczalne wyprzedzenie wydatków względem czasu (pp)</span>${inpt(b.tolerance, 'data-t="meta" data-k="budget.tolerance" data-num="1"', 'number')}</label></div>
    <div class="bud-sum"><div><small>Budżet</small><b>${money(bi.estimate)}</b></div><div><small>Wydatki</small><b>${bi.n ? money(bi.actual) : '—'}</b></div><div><small>Pozostało</small><b>${bi.n ? money(bi.left) : '—'}</b></div><div><small>Wydatki vs czas</small><b class="${bi.n && bi.pace > bi.tolerance ? 'bad' : ''}">${bi.n ? bi.usedPct + '% / ' + bi.timePct + '%' : '—'}</b></div></div>
    <div class="meter-wrap"><div class="meter ${bi.pace > bi.tolerance ? 'bad' : ''}"><i style="width:${clamp(bi.usedPct, 0, 100)}%"></i></div><i class="meter-mark" style="left:${clamp(bi.timePct, 0, 100)}%" title="Upłynęło ${bi.timePct}% czasu projektu"></i></div>
    <p class="hint">${bi.n ? `Wydano ${bi.usedPct}% budżetu, a upłynęło ${bi.timePct}% czasu projektu (${bi.pace > 0 ? '+' : ''}${bi.pace} pp). Znacznik na pasku oznacza upływ czasu.` : 'Dodaj wydatki, aby zobaczyć tempo wydawania budżetu.'}</p>
    <h3 class="sub">Wydatki rzeczywiste</h3>
    ${rows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pozycja</th><th>Data</th><th>Kwota</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-note">Nie zapisano jeszcze żadnych wydatków.</div>'}
    <div class="exp-add"><input id="exp-name" placeholder="Nazwa wydatku (np. paliwo)…" maxlength="120" data-enter="exp-add" aria-label="Nazwa wydatku"><input id="exp-amt" type="number" min="0" step="0.01" placeholder="Kwota (zł)" data-enter="exp-add" aria-label="Kwota"><input id="exp-date" type="date" value="${todayStr()}" aria-label="Data">${btn('exp-add', 'Dodaj wydatek', 'primary')}</div>`;
}
function expAdd() {
  const name = ($('#exp-name').value || '').trim(); const amt = Number(String($('#exp-amt').value).replace(',', '.'));
  if (!name || !(amt >= 0) || $('#exp-amt').value === '') { (name ? $('#exp-amt') : $('#exp-name')).focus(); return; }
  S.meta.budget.expenses.push({ id: uid('e'), name, amount: amt, date: $('#exp-date').value || todayStr() }); commit();
}
A['exp-add'] = expAdd; K['exp-add'] = expAdd;
