'use strict';
/* Menedżerski Panel Zarządzania — Harmonogram: kalendarz, spotkania, rezerwacja sal, rekomendacja uczestników, ustalenia → zadania */

const ROOMS = ['Sala A', 'Sala B', 'Online', 'Inne miejsce'];
const BOOKABLE = ['Sala A', 'Sala B'];
const plShow = { meet: true, cards: true };
const isNarrow = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
const plMode = () => (ui.plannerMode === 'month' && isNarrow() && !ui.plModeTouched ? 'agenda' : ui.plannerMode);

const monthKey = (s) => s.slice(0, 7);
function shiftMonth(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const start = new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7));
  const days = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(ymd(d)); }
  return days;
}
const overlaps = (a, b) => timeToMin(a.start) < timeToMin(b.end) && timeToMin(b.start) < timeToMin(a.end);

function meetingConflicts(m) {
  const res = { rooms: [], people: {} };
  for (const o of Object.values(S.meetings)) {
    if (o.id === m.id || o.date !== m.date || !overlaps(m, o)) continue;
    if (BOOKABLE.includes(m.room) && o.room === m.room) res.rooms.push(o);
    for (const p of m.participants || []) if ((o.participants || []).includes(p)) (res.people[p] = res.people[p] || []).push(o);
  }
  return res;
}

/* ---------- rekomendacja uczestników (reguły, każda z uzasadnieniem) ---------- */
const STOP = new Set(['spotkanie', 'spotkania', 'przeglad', 'zespolu', 'tygodniowy', 'zajecia', 'uzgodnienie', 'wspolny', 'dzien']);
function recommend(m) {
  const cards = m.boardId && S.boards[m.boardId] ? boardCards(m.boardId) : allActiveCards();
  const open = cards.filter((c) => !isCardClosed(c));
  const board = S.boards[m.boardId];
  const tokens = [...new Set(norm((m.title || '') + ' ' + (m.agenda || '')).split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !STOP.has(w)))];
  const stems = tokens.map((w) => w.slice(0, 5));
  const earlier = Object.values(S.meetings).filter((o) => o.id !== m.id && o.date <= m.date);
  const conf = meetingConflicts({ ...m, participants: members().map((x) => x.id) });
  const rows = members().map((mem) => {
    let score = 0; const reasons = [];
    const add = (t, w) => { score += w; reasons.push({ t, w }); };
    if (m.organizer === mem.id) add('Organizator spotkania', 5);
    const mine = open.filter((c) => (c.members || []).includes(mem.id));
    const topic = mine.filter((c) => (c.labels || []).some((l) => (m.topicLabels || []).includes(l)));
    if (topic.length) {
      const names = [...new Set(topic.flatMap((c) => (c.labels || []).filter((l) => (m.topicLabels || []).includes(l)).map((l) => (labelOf(board, l) || {}).name)))].filter(Boolean).join(', ');
      add(`odpowiada za ${topic.length} ${plural(topic.length, 'otwartą kartę', 'otwarte karty', 'otwartych kart')} z tematu (${names})`, Math.min(4, topic.length * 2));
    }
    const kw = mine.filter((c) => !topic.includes(c) && stems.some((s) => norm(c.title).includes(s)));
    if (kw.length) add(`karty pasują do tematu: „${kw[0].title}”${kw.length > 1 ? ` i ${kw.length - 1} ${plural(kw.length - 1, 'inna', 'inne', 'innych')}` : ''}`, Math.min(2, kw.length));
    const od = mine.filter((c) => dueState(c) === 'overdue');
    if (od.length) add(`${od.length} ${plural(od.length, 'karta po terminie', 'karty po terminie', 'kart po terminie')}`, 2);
    const bl = mine.filter((c) => isHoldList(S.lists[c.listId]) || /^bloker/i.test(c.title));
    if (bl.length) add(`zablokowane zadanie: „${bl[0].title}”`, 2);
    const ag = earlier.flatMap((o) => (o.items || []).filter((it) => it.owner === mem.id && (!it.cardId || (S.cards[it.cardId] && !isCardClosed(S.cards[it.cardId])))));
    if (ag.length) add(`${ag.length} ${plural(ag.length, 'otwarte ustalenie', 'otwarte ustalenia', 'otwartych ustaleń')} z poprzednich spotkań`, 2);
    const busy = (conf.people[mem.id] || []);
    if (busy.length) add(`ma inne spotkanie: „${busy[0].title}” (${busy[0].start}–${busy[0].end})`, -3);
    return { id: mem.id, score, reasons, busy: busy.length > 0, rec: score >= 2 && !busy.length };
  });
  return rows.sort((a, b) => b.score - a.score);
}

/* ---------- widok planisty ---------- */
function renderPlannerView() {
  if (!ui.calMonth) ui.calMonth = monthKey(todayStr());
  const ym = ui.calMonth; const [y, mo] = ym.split('-').map(Number);
  const head = `<div class="pl-head">
    <div class="pl-nav"><button class="icon-btn" data-act="cal-prev" aria-label="Poprzedni miesiąc">${ico('chevl')}</button><b class="pl-month">${MONTHS[mo - 1]} ${y}</b><button class="icon-btn" data-act="cal-next" aria-label="Następny miesiąc">${ico('chevr')}</button>${btn('cal-today', 'Dzisiaj', 'sm')}</div>
    <div class="seg" role="group" aria-label="Widok"><button class="${plMode() === 'month' ? 'on' : ''}" data-act="pl-mode" data-m="month" aria-pressed="${plMode() === 'month'}">Miesiąc</button><button class="${plMode() === 'agenda' ? 'on' : ''}" data-act="pl-mode" data-m="agenda" aria-pressed="${plMode() === 'agenda'}">Lista</button></div>
    <label class="chk sm"><input type="checkbox" data-chg="pl-show" data-k="meet" ${plShow.meet ? 'checked' : ''}><span>Spotkania</span></label>
    <label class="chk sm"><input type="checkbox" data-chg="pl-show" data-k="cards" ${plShow.cards ? 'checked' : ''}><span>Terminy kart</span></label>
    <span class="grow"></span>${btn('meeting-new', `${ico('plus')} Nowe spotkanie`, 'primary')}</div>`;
  const body = plMode() === 'agenda' ? plannerAgenda() : plannerMonth(ym);
  return `<div class="sheet">${head}<div class="pl-grid"><div class="pl-main">${body}</div><aside class="pl-side">${roomsPanel()}${upcomingPanel()}</aside></div></div>`;
}
function dayItems(day) {
  const items = [];
  if (plShow.meet) for (const m of meetingsSorted()) if (m.date === day) items.push({ k: 'm', t: m.start, m });
  if (plShow.cards) for (const c of allActiveCards()) if (c.due === day) items.push({ k: 'c', t: '99:99', c });
  return sortBy(items, (x) => x.t);
}
function itemChip(it) {
  if (it.k === 'm') return `<button class="ev ev-meet ${it.m.status === 'done' ? 'is-done' : ''}" data-act="open-meeting" data-id="${it.m.id}" title="${esc(it.m.title)} · ${it.m.start}–${it.m.end} · ${esc(it.m.room)}"><i>${it.m.start}</i> ${esc(it.m.title)}</button>`;
  const ds = dueState(it.c);
  return `<button class="ev ev-card due-${ds}" data-act="open-card" data-card="${it.c.id}" title="Termin karty: ${esc(it.c.title)}">${ico('clock')} ${esc(it.c.title)}</button>`;
}
function plannerMonth(ym) {
  const days = monthGrid(ym); const today = todayStr();
  const cells = days.map((d) => {
    const items = dayItems(d); const inMonth = monthKey(d) === ym; const dt = parseYmd(d);
    const shown = items.slice(0, 3);
    return `<div class="day ${inMonth ? '' : 'out'} ${d === today ? 'today' : ''} ${dowIdx(d) >= 5 ? 'wkd' : ''}" data-act="pl-day" data-date="${d}">
      <span class="dn">${dt.getDate() === 1 ? `${dt.getDate()} ${MON_SHORT[dt.getMonth()]}` : dt.getDate()}</span>
      <span class="dots" aria-hidden="true">${items.slice(0, 4).map((it) => (it.k === 'm' ? '<i class="dot-m"></i>' : `<i class="dot-c due-${dueState(it.c)}"></i>`)).join('')}</span>
      <div class="evs">${shown.map(itemChip).join('')}${items.length > 3 ? `<button class="more" data-act="pl-more" data-date="${d}">+${items.length - 3} więcej</button>` : ''}</div></div>`;
  }).join('');
  return `<div class="cal-scroll"><div class="cal"><div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div><div class="cal-days">${cells}</div></div></div>
    <ul class="legend cal-legend"><li><i class="lg-m"></i>spotkanie</li><li><i class="lg-c"></i>termin zadania</li><li><i class="lg-o"></i>po terminie</li></ul>`;
}
function plannerAgenda() {
  const from = ui.calMonth + '-01';
  const dates = [];
  const start = monthKey(todayStr()) === ui.calMonth ? todayStr() : from;
  for (let i = 0; i < 62; i++) { const d = addDays(start, i); if (dayItems(d).length) dates.push(d); }
  if (!dates.length) return '<div class="empty-note">Brak spotkań i terminów w tym okresie. Dodaj spotkanie przyciskiem „Nowe spotkanie”.</div>';
  return `<div class="agenda">${dates.map((d) => `<section><h3>${fmtDow(d)}, ${fmtLong(d)}${d === todayStr() ? ' <span class="tag tag-acc">dziś</span>' : ''}</h3>${dayItems(d).map((it) => it.k === 'm'
    ? `<button class="ag-row" data-act="open-meeting" data-id="${it.m.id}"><span class="ag-time">${it.m.start}–${it.m.end}</span><span class="ag-t"><b>${esc(it.m.title)}</b><small>${ico('pin')} ${esc(it.m.room)} · ${(it.m.participants || []).length} ${plural((it.m.participants || []).length, 'osoba', 'osoby', 'osób')}</small></span><span class="av-stack">${avatarStack(it.m.participants, 'sm')}</span></button>`
    : `<button class="ag-row" data-act="open-card" data-card="${it.c.id}"><span class="ag-time">termin</span><span class="ag-t"><b>${esc(it.c.title)}</b><small>${ico('board')} ${esc((S.lists[it.c.listId] || {}).title || '')}</small></span><span class="av-stack">${avatarStack(it.c.members, 'sm')}</span></button>`).join('')}</section>`).join('')}</div>`;
}
function roomsPanel() {
  const today = todayStr(); const now = new Date(); const nm = now.getHours() * 60 + now.getMinutes();
  const rows = BOOKABLE.map((r) => {
    const ms = meetingsSorted().filter((m) => m.date === today && m.room === r);
    const cur = ms.find((m) => timeToMin(m.start) <= nm && nm < timeToMin(m.end));
    const next = ms.find((m) => timeToMin(m.start) > nm);
    const st = cur ? `<span class="tag tag-bad">Zajęta do ${cur.end}</span>` : `<span class="tag tag-ok">Dostępna</span>`;
    return `<div class="room"><div class="room-h">${ico('door')}<b>${r}</b>${st}</div><small>${next ? `Następne: ${next.start} · ${esc(next.title)}` : ms.length ? 'Brak kolejnych rezerwacji dziś' : 'Brak rezerwacji na dziś'}</small></div>`;
  }).join('');
  return `<section class="side-card"><h3>Rezerwacja sal · dziś</h3>${rows}</section>`;
}
function upcomingPanel() {
  const today = todayStr();
  const up = meetingsSorted().filter((m) => m.date >= today && m.status !== 'done').slice(0, 5);
  return `<section class="side-card"><h3>Najbliższe spotkania</h3>${up.length ? up.map((m) => `<button class="up-row" data-act="open-meeting" data-id="${m.id}"><span class="up-d"><b>${parseYmd(m.date).getDate()}</b><small>${MON_SHORT[parseYmd(m.date).getMonth()]}</small></span><span class="ag-t"><b>${esc(m.title)}</b><small>${m.start}–${m.end} · ${esc(m.room)}</small></span></button>`).join('') : '<p class="muted">Brak zaplanowanych spotkań.</p>'}</section>`;
}

A['cal-prev'] = () => { ui.calMonth = shiftMonth(ui.calMonth, -1); requestRender({ only: 'main' }); };
A['cal-next'] = () => { ui.calMonth = shiftMonth(ui.calMonth, 1); requestRender({ only: 'main' }); };
A['cal-today'] = () => { ui.calMonth = monthKey(todayStr()); requestRender({ only: 'main' }); };
A['pl-mode'] = (el) => { ui.plannerMode = el.dataset.m; ui.plModeTouched = true; saveUi(); requestRender({ only: 'main' }); };
C['pl-show'] = (el) => { plShow[el.dataset.k] = el.checked; requestRender({ only: 'main' }); };
A['pl-day'] = (el, e) => { if (e.target.closest('.ev, .more')) return; if (isNarrow()) { A['pl-more'](el, e); return; } newMeeting(el.dataset.date); };
A['pl-more'] = (el, e) => {
  e.stopPropagation(); const d = el.dataset.date;
  openPop(el, () => `<div class="pop-t">${fmtDow(d)}, ${fmtLong(d)}</div><div class="day-pop">${dayItems(d).map(itemChip).join('')}</div><div class="pt">${btn('pl-new-day', 'Nowe spotkanie tego dnia', 'sm', `data-date="${d}"`)}</div>`, { w: 300 });
};
A['pl-new-day'] = (el) => { closePop(); newMeeting(el.dataset.date); };

/* ---------- spotkania: tworzenie i okno ---------- */
function newMeeting(date) {
  const id = uid('mt');
  S.meetings[id] = {
    id, title: 'Nowe spotkanie', date: date || todayStr(), start: '10:00', end: '11:00', room: 'Sala A', boardId: 'b1', topicLabels: [],
    organizer: members().some((x) => x.id === ui.me) ? ui.me : members()[0].id, participants: [members().some((x) => x.id === ui.me) ? ui.me : members()[0].id], status: 'planned', agenda: '', notes: '', items: [],
  };
  commit({ only: 'main' }); openMeeting(id, true);
}
A['meeting-new'] = () => newMeeting(ui.calMonth === monthKey(todayStr()) ? todayStr() : ui.calMonth + '-01');
function openMeeting(id, focusTitle) {
  if (!S.meetings[id]) return;
  closePop(); ui.meetingId = id; ui.cardId = null; if (focusTitle) ui.focus = 'mt-title';
  openModal(meetingModalHTML, 'modal-meeting');
  if (focusTitle) { const t = $('#mt-title'); if (t) t.select(); }
}
A['open-meeting'] = (el) => openMeeting(el.dataset.id);
const curMeeting = () => S.meetings[ui.meetingId];

function meetingModalHTML() {
  const m = curMeeting();
  if (!m) { setTimeout(closeModal, 0); return ''; }
  const b = mainBoard();
  const conf = meetingConflicts(m);
  const rec = recommend(m);
  const recIds = rec.filter((r) => r.rec).map((r) => r.id);
  const warns = [];
  if (conf.rooms.length) warns.push(`<div class="warn-box">${ico('warn')}<span><b>${esc(m.room)} jest zajęta</b> w tym czasie przez: ${conf.rooms.map((o) => `„${esc(o.title)}” (${o.start}–${o.end})`).join(', ')}.</span></div>`);
  if (timeToMin(m.end) <= timeToMin(m.start)) warns.push(`<div class="warn-box">${ico('warn')}<span>Godzina zakończenia musi być późniejsza niż rozpoczęcia.</span></div>`);
  const busyIn = Object.keys(conf.people);
  if (busyIn.length) warns.push(`<div class="warn-box">${ico('warn')}<span><b>Kolizja terminów:</b> ${busyIn.map((p) => `${esc(firstName(p))} ma też „${esc(conf.people[p][0].title)}”`).join('; ')}.</span></div>`);

  const partRows = rec.map((r) => {
    const mem = memberById(r.id); const sel = (m.participants || []).includes(r.id);
    return `<li class="pr ${sel ? 'sel' : ''}"><label class="pr-main"><input type="checkbox" data-chg="mt-part" value="${r.id}" ${sel ? 'checked' : ''} aria-label="${esc(mem.name)}">${avatar(r.id)}<span class="pr-n"><b>${esc(mem.name)}</b><small>${esc(mem.role || '')}</small></span></label>
      <div class="pr-why">${r.rec ? '<span class="tag tag-acc">Rekomendowany</span>' : ''}${r.reasons.length ? r.reasons.map((x) => `<span class="why ${x.w < 0 ? 'neg' : ''}" title="Waga reguły: ${x.w > 0 ? '+' : ''}${x.w}">${x.w > 0 ? '+' : ''}${x.w} · ${esc(x.t)}</span>`).join('') : '<span class="muted">brak powiązań z tematem</span>'}</div>
      <span class="pr-score" title="Suma wag reguł" aria-label="Wynik ${r.score}">${r.score}</span></li>`;
  }).join('');

  const items = (m.items || []).map((it) => {
    const card = it.cardId && S.cards[it.cardId];
    return `<li class="agr ${card ? 'has' : ''}">
      <input class="agr-t" value="${esc(it.text)}" data-blur="ag-text" data-enter="ag-text" data-id="${it.id}" aria-label="Treść ustalenia">
      <select data-chg="ag-owner" data-id="${it.id}" aria-label="Właściciel">${members().map((x) => `<option value="${x.id}" ${it.owner === x.id ? 'selected' : ''}>${esc(x.name.split(' ')[0])}</option>`).join('')}</select>
      <input type="date" value="${it.due || ''}" data-chg="ag-due" data-id="${it.id}" aria-label="Termin">
      ${card ? `<button class="btn sm ok" data-act="open-card" data-card="${card.id}" title="Otwórz zadanie">${ico('check')} Zadanie</button>` : `<button class="btn sm primary" data-act="ag-make" data-id="${it.id}">Utwórz zadanie</button>`}
      <button class="icon-btn sm" data-act="ag-del" data-id="${it.id}" aria-label="Usuń ustalenie">${ico('x')}</button></li>`;
  }).join('');
  const pending = (m.items || []).filter((it) => !it.cardId).length;

  return `<div class="modal-scroll">
    <header class="m-head">
      <div class="m-title-wrap"><span class="m-ico">${ico('calendar')}</span><textarea id="mt-title" class="m-title" rows="1" maxlength="200" data-blur="mt-title" data-enter="mt-title" aria-label="Tytuł spotkania">${esc(m.title)}</textarea></div>
      <button class="icon-btn" data-act="close-modal" aria-label="Zamknij">${ico('x')}</button>
      <p class="m-sub">${fmtDow(m.date)}, ${fmtLong(m.date)} · ${m.start}–${m.end} · ${esc(m.room)} ${m.status === 'done' ? '· <span class="tag tag-ok">odbyło się</span>' : ''}</p>
    </header>
    <div class="m-body">
      <div class="form-grid">
        <label class="fld"><span>Data</span><input type="date" value="${m.date}" data-chg="mt-f" data-f="date"></label>
        <label class="fld"><span>Początek</span><input type="time" value="${m.start}" data-chg="mt-f" data-f="start"></label>
        <label class="fld"><span>Koniec</span><input type="time" value="${m.end}" data-chg="mt-f" data-f="end"></label>
        <label class="fld"><span>Miejsce / sala</span><select data-chg="mt-f" data-f="room">${ROOMS.map((r) => `<option ${m.room === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label class="fld"><span>Organizator</span><select data-chg="mt-f" data-f="organizer">${members().map((x) => `<option value="${x.id}" ${m.organizer === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      </div>
      ${warns.join('')}
      ${b && (b.labels || []).length ? `<div class="fld"><span>Temat spotkania (obszary zadań używane przez rekomendację)</span><div class="row gap wrap">${b.labels.map((l) => `<label class="chk pill"><input type="checkbox" data-chg="mt-topic" value="${l.id}" ${(m.topicLabels || []).includes(l.id) ? 'checked' : ''}><span class="area lbl-${l.color} wide">${esc(l.name)}</span></label>`).join('')}</div></div>` : ''}
      <label class="fld"><span>Agenda</span><textarea rows="3" data-blur="mt-text" data-f="agenda" placeholder="Co omawiamy?">${esc(m.agenda || '')}</textarea></label>

      <section class="mt-sec"><div class="sec-h"><h3>${ico('user')}Uczestnicy <small>(${(m.participants || []).length} z ${members().length})</small></h3>
        <div class="row gap">${btn('mt-apply-rec', `${ico('zap')} Zastosuj rekomendację`, 'sm', recIds.length ? '' : 'disabled')}</div></div>
        <p class="hint">Rekomendacja jest pomocnicza i oparta na jawnych regułach: organizator, karty z tematu spotkania, karty po terminie, zadania zablokowane, otwarte ustalenia i kolizje terminów. <b>Skład zawsze zatwierdza organizator.</b></p>
        <ul class="parts">${partRows}</ul></section>

      <section class="mt-sec"><div class="sec-h"><h3>${ico('checksq')}Ustalenia ze spotkania</h3>${pending > 1 ? btn('ag-make-all', `Utwórz zadania (${pending})`, 'sm primary') : ''}</div>
        <p class="hint">Każde ustalenie ma właściciela i termin. Zamień je w zadanie — trafi do statusu „Do zrobienia”.</p>
        <ul class="agr-list">${items || '<li class="muted">Brak ustaleń. Dodaj pierwsze poniżej.</li>'}</ul>
        <div class="agr-add"><input id="ag-new-t" placeholder="Nowe ustalenie…" maxlength="200" data-enter="ag-add" aria-label="Treść nowego ustalenia">
          <select id="ag-new-o" aria-label="Właściciel">${members().map((x) => `<option value="${x.id}">${esc(x.name.split(' ')[0])}</option>`).join('')}</select>
          <input id="ag-new-d" type="date" value="${addDays(m.date, 2)}" aria-label="Termin">${btn('ag-add', 'Dodaj', 'sm')}</div></section>

      <label class="fld"><span>Notatki</span><textarea rows="3" data-blur="mt-text" data-f="notes" placeholder="Notatki ze spotkania…">${esc(m.notes || '')}</textarea></label>
      <footer class="m-foot">${m.status === 'done' ? btn('mt-status', 'Oznacz jako zaplanowane', 'sm') : btn('mt-status', `${ico('check')} Spotkanie się odbyło`, 'sm primary')}<span class="grow"></span>${btn('mt-del', `${ico('trash')} Usuń spotkanie`, 'sm danger')}</footer>
    </div></div>`;
}

function mtTitle(el) { const m = curMeeting(); if (!m) return; const v = el.value.replace(/\s+/g, ' ').trim(); if (v && v !== m.title) { m.title = v; commit({ only: 'main' }); } else el.value = m.title; }
B['mt-title'] = mtTitle; K['mt-title'] = (el) => { mtTitle(el); el.blur(); };
B['mt-text'] = (el) => { const m = curMeeting(); if (m && el.value !== (m[el.dataset.f] || '')) { m[el.dataset.f] = el.value; commit({ only: 'main' }); } };
C['mt-f'] = (el) => {
  const m = curMeeting(); const f = el.dataset.f; m[f] = el.value;
  if (f === 'organizer' && !(m.participants || []).includes(m.organizer)) m.participants.push(m.organizer);
  if (f === 'start' && timeToMin(m.end) <= timeToMin(m.start)) { const t = timeToMin(m.start) + 60; m.end = `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; }
  commit();
};
C['mt-topic'] = (el) => { const m = curMeeting(); m.topicLabels = m.topicLabels || []; toggleIn(m.topicLabels, el.value); commit(); };
C['mt-part'] = (el) => { const m = curMeeting(); m.participants = m.participants || []; toggleIn(m.participants, el.value); commit(); };
A['mt-apply-rec'] = () => {
  const m = curMeeting(); const ids = recommend(m).filter((r) => r.rec).map((r) => r.id);
  m.participants = [...new Set([m.organizer, ...ids])]; commit(); toast('Zastosowano rekomendację. Możesz ją ręcznie zmienić.');
};
A['mt-status'] = () => { const m = curMeeting(); m.status = m.status === 'done' ? 'planned' : 'done'; commit(); };
A['mt-del'] = (el) => {
  const m = curMeeting();
  confirmPop(el, `Usunąć spotkanie „${m.title}”? Utworzone z niego zadania pozostaną na tablicy.`, 'Usuń spotkanie', () => { delete S.meetings[m.id]; closeModal(); commit(); toast('Spotkanie usunięte'); });
};

/* ustalenia → zadania */
function agAdd() {
  const m = curMeeting(); const t = ($('#ag-new-t').value || '').trim();
  if (!t) { $('#ag-new-t').focus(); return; }
  m.items = m.items || [];
  m.items.push({ id: uid('it'), text: t, owner: $('#ag-new-o').value, due: $('#ag-new-d').value || null, cardId: null });
  ui.focus = 'ag-new-t'; commit();
}
A['ag-add'] = agAdd; K['ag-add'] = agAdd;
const findItem = (id) => (curMeeting().items || []).find((i) => i.id === id);
B['ag-text'] = (el) => { const it = findItem(el.dataset.id); if (it && el.value.trim() && el.value !== it.text) { it.text = el.value.trim(); commit({ only: 'main' }); } };
K['ag-text'] = (el) => { el.blur(); };
C['ag-owner'] = (el) => { const it = findItem(el.dataset.id); it.owner = el.value; const c = it.cardId && S.cards[it.cardId]; if (c) { c.members = [el.value]; } commit(); };
C['ag-due'] = (el) => { const it = findItem(el.dataset.id); it.due = el.value || null; const c = it.cardId && S.cards[it.cardId]; if (c) c.due = it.due; commit(); };
A['ag-del'] = (el) => { const m = curMeeting(); m.items = m.items.filter((i) => i.id !== el.dataset.id); commit(); };
function defaultTargetList() { return listByTone('todo') || statusLists()[0] || null; }
function makeTask(m, it) {
  const list = defaultTargetList(); if (!list) return null;
  const c = addCard(list.id, it.text, {
    members: it.owner ? [it.owner] : [], due: it.due || null, labels: [],
    desc: `Ustalenie ze spotkania „${m.title}” (${fmtLong(m.date)}).`, source: { meetingId: m.id, itemId: it.id },
  });
  it.cardId = c.id; it.convertedAt = nowIso();
  return { card: c, list };
}
A['ag-make'] = (el) => {
  const m = curMeeting(); const it = findItem(el.dataset.id); const r = makeTask(m, it);
  if (!r) { toast('Brak statusu „Do zrobienia”.'); return; }
  commit(); toast(`Utworzono zadanie (${r.list.title})`, { action: 'Otwórz', onAction: () => openCard(r.card.id) });
};
A['ag-make-all'] = () => {
  const m = curMeeting(); let n = 0;
  (m.items || []).filter((it) => !it.cardId).forEach((it) => { if (makeTask(m, it)) n++; });
  commit(); toast(n ? `Utworzono ${n} ${plural(n, 'zadanie', 'zadania', 'zadań')}` : 'Brak statusu „Do zrobienia”.');
};

