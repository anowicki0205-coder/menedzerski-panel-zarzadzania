'use strict';
/* Menedżerski Panel Zarządzania — symulacja dni pracy (dane demonstracyjne) i aktywność w projekcie.
   Przycisk „Następny dzień roboczy” wykonuje scenariusz: zespół odhacza wizyty, zamyka raporty, zgłasza prośby o decyzję,
   rosną wydatki i ryzyka. Wszystko trafia do tych samych danych, które widać na każdym ekranie. */

const fmtDayLong = (s) => `${fmtDow(s)}, ${fmtLong(s)}`;

/* ---------- pomocnicze operacje scenariusza ---------- */
function simSay(id, by, text) { const c = S.cards[id]; if (!c) return false; c.comments.push({ id: uid('cm'), by, text, ts: nowIso(), kind: 'comment' }); c.updated = nowIso(); return true; }
function simTick(id, re, n) {
  const c = S.cards[id]; if (!c) return 0;
  const cl = (c.checklists || []).find((x) => re.test(x.title)); if (!cl) return 0;
  let k = 0; for (const it of cl.items) { if (k >= n) break; if (!it.done) { it.done = true; k++; } }
  if (k) c.updated = nowIso();
  return k;
}
function simMove(id, tone, by) {
  const c = S.cards[id]; const l = listByTone(tone); if (!c || !l || c.listId === l.id) return false;
  setStatus(c, l.id, by); return true;
}
function simExpense(name, amount) { S.meta.budget.expenses.push({ id: uid('e'), date: todayStr(), name, amount }); return true; }
function simAsk(id, by, question) {
  const c = S.cards[id]; if (!c || (c.decision && c.decision.status === 'pending')) return false;
  c.decision = { status: 'pending', question, asked: nowIso(), by, note: '' }; logEvent(c, 'poproszono szefa o decyzję', by); return true;
}
function simRisk(rid, p, w) { const r = S.risks[rid]; if (!r) return null; r.p = p; r.w = w; return `${r.code} ${riskLevelName(r)}`; }
const riskLevelName = (r) => `ocena ${riskScore(r)} (${RISK_LABEL[riskLevel(riskScore(r))].toLowerCase()})`;
function simKpi(id, v) { const r = (S.meta.scorecard.rows || []).find((x) => x.id === id); if (r) r.current = v; }
function simMeeting(mid, items) {
  const m = S.meetings[mid]; if (!m) return 0;
  m.status = 'done'; m.items = m.items || [];
  items.forEach((it) => m.items.push({ cardId: null, ...it })); return items.length;
}
const nm = (id) => (memberById(id) || {}).name || '';

/* ---------- scenariusz: kolejne dni robocze ---------- */
const SIM_SCRIPT = {
  '2026-11-17': [
    () => { if (!S.cards.c_dino) return null; simTick('c_dino', /wizyty/i, 1); simTick('c_dino', /raport/i, 3); simMove('c_dino', 'done', 'm_tz'); simSay('c_dino', 'm_tz', 'Ostatnia placówka (Szczecin) zbadana. Raport wysłany z 5-dniowym opóźnieniem.'); simKpi('k3', 67); return 'Dino: raport dostarczony z opóźnieniem. Terminowość raportów spadła do 67%.'; },
    () => simSay('c_kaufland', 'm_nd', 'Dział prawny klienta odpisał: potrzebny aneks do NDA, odpowiedź do 25.11.') && 'Kaufland: dział prawny wymaga aneksu do NDA (odpowiedź do 25.11).',
    () => simExpense('Dojazdy i paliwo: tydzień 3 (część 1)', 3280) && 'Wydatek: Dojazdy i paliwo, 3 280 zł.',
    () => simAsk('c_carrefour', 'm_tz', 'Klient zawęził godziny dostępu do zaplecza do 5:00–7:00. Czy zatwierdzasz audyty poranne z dopłatą za nadgodziny audytorów (ok. 1 800 zł)?') && 'Nowa prośba o decyzję: Carrefour, audyty poranne z dopłatą.',
    () => { const n = simMeeting('mt_1117', [{ id: 'it_c1', text: 'Przygotować aneks do NDA dla Kauflanda', owner: 'm_nd', due: '2026-11-20' }, { id: 'it_c2', text: 'Zaproponować klientowi wizyty w fali 2', owner: 'm_kw', due: '2026-11-23' }]); return n ? `Spotkanie „Call z klientem: zgody prawne (Kaufland)” odbyło się. Dodano ${n} ustalenia, które nie mają jeszcze zadań.` : null; },
  ],
  '2026-11-18': [
    () => { if (!S.cards.t_jakosc) return null; simMove('t_jakosc', 'progress', 'm_ml'); simSay('t_jakosc', 'm_ml', 'Luki w danych z trzech loggerów (ok. 6% odczytów). Zgłaszam do ponownej kalibracji.'); const r = simRisk('r3', 4, 4); simKpi('k7', 92); return `Kontrola jakości: luki w danych z 3 loggerów. Ryzyko ${r}.`; },
    () => { const a = simTick('c_stokrotka', /wizyty/i, 1); const b = simTick('c_stokrotka', /raport/i, 2); if (a || b) simSay('c_stokrotka', 'm_tz', 'Wizyty zakończone, analiza danych i raport w przygotowaniu.'); return a || b ? 'Stokrotka: wszystkie wizyty wykonane, raport w przygotowaniu.' : null; },
    () => { simTick('t_logger', /kalibr/i, 2); if (simMove('t_logger', 'done', 'm_ml')) { simSay('t_logger', 'm_ml', 'Partia 2 skalibrowana i przekazana audytorom.'); return 'Loggery: partia 2 skalibrowana i wydana audytorom.'; } return null; },
    () => { const k = simTick('c_maxizoo', /wizyty/i, 2); if (k) simSay('c_maxizoo', 'm_tz', 'Dwie kolejne placówki zbadane, komplet danych z loggerów.'); return k ? 'Maxi Zoo: wizyty zakończone (5 z 5).' : null; },
  ],
  '2026-11-19': [
    () => { const n = simMeeting('mt_1119', [{ id: 'it_f1', text: 'Rozdzielić trasy fali 2 między audytorów', owner: 'm_tz', due: '2026-11-20' }, { id: 'it_f2', text: 'Uzgodnić z placówkami okna wizyt w dniu Black Friday', owner: 'm_kw', due: '2026-11-24' }]); return n ? `Odprawa audytorów — fala 2 odbyła się. Dodano ${n} ustalenia.` : null; },
    () => { const k = simTick('c_mediaexpert', /przygot/i, 3); if (k) { simMove('c_mediaexpert', 'progress', 'm_nd'); simSay('c_mediaexpert', 'm_nd', 'Brief i NDA gotowe, dobieram placówki do próby.'); } return k ? 'Media Expert: zlecenie ruszyło (przygotowanie 3 z 4).' : null; },
    () => simExpense('Honoraria audytorów: fala 1 (rozliczenie)', 14500) && 'Wydatek: honoraria audytorów, 14 500 zł. Wydatki wyprzedzają harmonogram.',
    () => simSay('c_shell', 'm_tz', 'Zarządca stacji zgodził się na wizyty po godz. 20:00. Czekam na pisemne potwierdzenie.') && 'Stacja Shell: zarządca zgodził się na wizyty wieczorne.',
  ],
  '2026-11-20': [
    () => { const k = simTick('c_costa', /raport/i, 2); if (k) { simMove('c_costa', 'done', 'm_ek'); simSay('c_costa', 'm_ek', 'Raport przekazany. Klient potwierdził odbiór.'); simKpi('k2', 4.7); simKpi('k3', 71); } return k ? 'Costa Coffee: raport dostarczony w terminie. Ocena klientów wzrosła do 4,7.' : null; },
    () => { const k = simTick('c_maxizoo', /raport/i, 3); if (k) { simMove('c_maxizoo', 'done', 'm_ml'); simSay('c_maxizoo', 'm_ml', 'Raport przekazany klientowi.'); simKpi('k3', 75); } return k ? 'Maxi Zoo: raport dostarczony w terminie.' : null; },
    () => { const a = simTick('c_hebe', /wizyty/i, 3); const b = simTick('c_hebe', /raport/i, 1); if (a) simSay('c_hebe', 'm_tz', 'Wszystkie wizyty wykonane. Raport w przygotowaniu, nadal po terminie.'); return a ? 'Hebe: wizyty zakończone, raport nadal po terminie.' : null; },
    () => { const r = simRisk('r8', 3, 3); return r ? `Prośby klientów o zmiany zakresu: ryzyko ${r}.` : null; },
  ],
  '2026-11-23': [
    () => { const a = simTick('c_spolem', /wizyty/i, 3); return a ? 'Społem: wizyty zakończone (5 z 5).' : null; },
    () => { const k = simTick('c_stokrotka', /raport/i, 3); if (k) { simMove('c_stokrotka', 'done', 'm_kw'); simSay('c_stokrotka', 'm_kw', 'Raport dostarczony (z opóźnieniem względem planu).'); simKpi('k3', 78); } return k ? 'Stokrotka: raport dostarczony z opóźnieniem.' : null; },
    () => { simTick('c_auchansm', /przygot/i, 1); const k = simTick('c_auchansm', /wizyty/i, 2); return k ? 'Auchan Supermarket: wykonano 2 pierwsze wizyty.' : null; },
    () => { if (simMove('t_plan2', 'done', 'm_kw')) { simSay('t_plan2', 'm_kw', 'Plan fali 2 gotowy: 36 wizyt w 9 dniach roboczych.'); return 'Plan wizyt fali 2 zatwierdzony przez koordynatorkę.'; } return null; },
    () => simExpense('Dojazdy i paliwo: tydzień 4', 4940) && 'Wydatek: Dojazdy i paliwo, 4 940 zł.',
  ],
  '2026-11-24': [
    () => { const k = simTick('c_carrefour', /wizyty/i, 3); return k ? 'Carrefour: wykonano kolejne 3 wizyty (4 z 5).' : null; },
    () => simAsk('c_kakadu', 'm_ek', 'Kakadu Zoo prosi o raport również w wersji angielskiej. Czy zatwierdzasz tłumaczenie (ok. 2 400 zł)?') && 'Nowa prośba o decyzję: Kakadu Zoo, tłumaczenie raportu na EN.',
    () => { const r = simRisk('r2', 5, 4); return r ? `Black Friday za 3 dni: ryzyko ${r}.` : null; },
    () => { const n = simMeeting('mt_1124', [{ id: 'it_q1', text: 'Ponownie skalibrować 3 loggery i powtórzyć pomiary', owner: 'm_ml', due: '2026-11-26' }]); return n ? 'Przegląd jakości danych odbył się. Dodano ustalenie o powtórce pomiarów.' : null; },
  ],
};
const SIM_LAST = Object.keys(SIM_SCRIPT).sort().pop();

function simNextDay() {
  S.meta.sim = S.meta.sim || { today: todayStr(), step: 0, log: [] };
  const sim = S.meta.sim;
  let d = addDays(sim.today, 1); while (dowIdx(d) >= 5) d = addDays(d, 1);
  sim.today = d; sim.step = (sim.step || 0) + 1;
  const out = (SIM_SCRIPT[d] || []).map((f) => { try { return f(); } catch (e) { console.error(e); return null; } }).filter(Boolean);
  sim.log = (sim.log || []).concat(out.map((text) => ({ ts: nowIso(), date: d, text }))).slice(-80);
  commit();
  if (pop.el) refreshPop();
  toast(out.length ? `${fmtDayLong(d)}: ${out.length} ${plural(out.length, 'zdarzenie', 'zdarzenia', 'zdarzeń')}` : `${fmtDayLong(d)}: brak scenariuszowych zdarzeń. Dalej możesz zmieniać dane ręcznie.`, { ms: 4500 });
}

/* ---------- sterowanie w menu bocznym ---------- */
A['sim-open'] = (el) => {
  if (pop.anchor === el) { closePop(); return; }
  openPop(el, () => {
    const sim = S.meta.sim || { today: todayStr(), log: [] };
    const log = sortBy(sim.log || [], (x) => x.ts).reverse().slice(0, 12);
    const more = sim.today < SIM_LAST;
    return `<div class="pop-t">Symulacja dni pracy</div>
      <div class="sim-day">${ico('calendar')}<div><small>Dziś w panelu</small><b>${esc(fmtDayLong(sim.today))}</b></div></div>
      <p class="hint">Przesuń czas, aby zobaczyć, jak zmieniają się dane: zespół odhacza wizyty i zamyka raporty, pojawiają się prośby o decyzję, rosną wydatki i ryzyka. Wcześniej możesz sam zatwierdzić decyzje albo zmienić statusy.</p>
      <div class="row gap wrap">${btn('sim-next', `Następny dzień roboczy ${ico('arrow')}`, 'primary')}${btn('sim-reset', `${ico('reset')} Wróć do poniedziałku`, 'sm')}</div>
      ${!more ? '<p class="hint">Scenariusz ma zdarzenia do wtorku 24.11. Dalej możesz przesuwać czas i zmieniać dane ręcznie.</p>' : ''}
      ${log.length ? `<h4 class="sim-h">Dziennik zdarzeń</h4><ul class="sim-log">${log.map((x) => `<li><small>${fmtShort(x.date)}</small><span>${esc(x.text)}</span></li>`).join('')}</ul>` : ''}`;
  }, { w: 360 });
};
A['sim-next'] = () => simNextDay();
A['sim-reset'] = (el) => {
  confirmPop(el, P.mode === 'shared' ? 'Przywrócić dane demonstracyjne od poniedziałku 16.11? Zmiany WSZYSTKICH użytkowników zostaną zastąpione.' : 'Przywrócić dane demonstracyjne od poniedziałku 16.11? Twoje zmiany zostaną utracone.', 'Przywróć', () => {
    resetDemo(); closeModal(); commit(); toast('Przywrócono dane demonstracyjne z poniedziałku 16.11');
  });
};

/* ---------- aktywność w projekcie ---------- */
function recentActivity(n) {
  const items = [];
  for (const c of Object.values(S.cards)) {
    if (c.archived) continue;
    for (const x of c.comments || []) items.push({ ts: x.ts, by: x.by, cardId: c.id, title: c.title, text: x.text, kind: x.kind });
  }
  for (const l of (S.meta.sim && S.meta.sim.log) || []) items.push({ ts: l.ts, by: null, text: l.text, kind: 'sim' });
  return sortBy(items, (i) => i.ts).reverse().slice(0, n);
}
function activityHTML(n = 8) {
  const rows = recentActivity(n);
  if (!rows.length) return '<div class="empty-note">Brak aktywności.</div>';
  return `<ul class="feed">${rows.map((x) => `<li>${x.by ? avatar(x.by, 'sm') : `<span class="feed-ic">${ico('zap')}</span>`}<div class="feed-b">${x.kind === 'sim' ? `<span>${esc(x.text)}</span>` : `<span><b>${esc(firstName(x.by))}</b> ${x.kind === 'event' ? esc(x.text) : `skomentował(a): ${esc(x.text.length > 120 ? x.text.slice(0, 117) + '…' : x.text)}`}</span>${x.title ? `<button class="lnk" data-act="open-card" data-card="${x.cardId}">${esc(x.title)}</button>` : ''}`}<small>${relTime(x.ts)}</small></div></li>`).join('')}</ul>`;
}
