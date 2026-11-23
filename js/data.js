'use strict';
/* Menedżerski Panel Zarządzania — dane demonstracyjne (fikcyjne).
   Scenariusz: agencja badawcza realizuje „Badanie logistyki w sieciach handlowych” dla 21 zleceń z listy klientów
   (plik Excel „zlecenia_badania_logistyka”: 22 wiersze, po oczyszczeniu 21 unikalnych sieci). Osoby i wyniki są zmyślone. */

const SEED_VERSION = 3;
const DEMO_START = '2026-11-16'; // poniedziałek rano: początek dnia demonstracyjnego

const LABEL_COLORS = {
  green: 'Zielony', lime: 'Limonkowy', yellow: 'Żółty', orange: 'Pomarańczowy', red: 'Czerwony',
  purple: 'Fioletowy', blue: 'Niebieski', teal: 'Morski', pink: 'Różowy', gray: 'Szary',
};

function makeSeed() {
  const D = { boards: {}, lists: {}, cards: {}, meetings: {}, risks: {}, meta: {} };
  const M = { kw: 'm_kw', tz: 'm_tz', ml: 'm_ml', ek: 'm_ek', nd: 'm_nd' };
  const ALL = Object.values(M);
  const at = (d, h = '10:00') => `2026-11-${d}T${h}:00`;

  D.meta.members = { list: [
    { id: M.kw, name: 'Karolina Wiśniewska', color: '#1e3a6d', role: 'Koordynacja projektu i harmonogram' },
    { id: M.tz, name: 'Tomasz Zieliński', color: '#c2410c', role: 'Wizyty terenowe i audytorzy' },
    { id: M.ml, name: 'Marek Lewandowski', color: '#0b7285', role: 'Dane, loggery i analizy' },
    { id: M.ek, name: 'Ewa Kamińska', color: '#7c3aed', role: 'Metodologia i ekspertyza logistyczna' },
    { id: M.nd, name: 'Natalia Dąbrowska', color: '#9a6700', role: 'Raporty i kontakt z klientami' },
  ] };

  D.boards.b1 = {
    id: 'b1', name: 'Badanie logistyki w sieciach handlowych', pos: 1,
    desc: 'Audyty logistyki dostaw w 21 sieciach handlowych: okna dostaw, rozładunek, czas od dostawy do półki, zaplecze i łańcuch chłodniczy.',
    labels: [
      { id: 'l_dys', color: 'orange', name: 'Dyskonty' },
      { id: 'l_sup', color: 'blue', name: 'Super- i hipermarkety' },
      { id: 'l_conv', color: 'green', name: 'Convenience i kawiarnie' },
      { id: 'l_drog', color: 'pink', name: 'Drogerie' },
      { id: 'l_zoo', color: 'teal', name: 'Zoologiczne i akwarystyka' },
      { id: 'l_fuel', color: 'red', name: 'Stacje paliw' },
      { id: 'l_elek', color: 'purple', name: 'Elektronika' },
      { id: 'l_met', color: 'lime', name: 'Metodologia' },
      { id: 'l_data', color: 'gray', name: 'Dane i narzędzia' },
      { id: 'l_klient', color: 'yellow', name: 'Klienci i formalności' },
    ],
  };

  /* statusy (kolumna „Status” w tabeli) i dwie listy informacyjne */
  const listBoard = {};
  const mkList = (id, title, pos, kind, tone) => { D.lists[id] = { id, boardId: 'b1', title, pos: pos * 1024, archived: false, kind, tone: tone || null }; listBoard[id] = 'b1'; };
  mkList('l_zal', 'Założenia projektu', 1, 'brief');
  mkList('l_todo', 'Do zrobienia', 2, 'status', 'todo');
  mkList('l_prog', 'W trakcie', 3, 'status', 'progress');
  mkList('l_done', 'Zrobione', 4, 'status', 'done');
  mkList('l_hold', 'Wstrzymane', 5, 'status', 'hold');
  mkList('l_cost', 'Kosztorys', 6, 'cost');
  const LIST_OF = { todo: 'l_todo', progress: 'l_prog', done: 'l_done', hold: 'l_hold' };

  const cnt = {};
  const card = (id, list, title, o = {}) => {
    D.cards[id] = {
      id, boardId: 'b1', listId: list, pos: (cnt[list] = (cnt[list] || 0) + 1024), title, desc: '', labels: [], members: [],
      due: null, done: D.lists[list].tone === 'done', checklists: [], attachments: [], comments: [], pinChecklist: false, archived: false,
      created: '2026-11-02T09:00:00', updated: '2026-11-13T15:00:00', ...o,
    };
    return D.cards[id];
  };
  const chk = (id, title, items) => ({ id, title, items: items.map(([text, done], i) => ({ id: id + '_' + i, text, done: !!done })) });
  const say = (id, by, text, ts) => ({ id, by, text, ts, kind: 'comment' });
  const ev = (id, by, text, ts) => ({ id, by, text, ts, kind: 'event' });

  /* ---------- założenia projektu (informacyjne) ---------- */
  card('c_cel', 'l_zal', 'Cel badania', {
    desc: 'Zbadać przebieg dostaw i zasilania półek w 21 sieciach handlowych z listy zleceń oraz wskazać wąskie gardła logistyczne w placówkach.\nWynik dla każdego klienta: raport z rekomendacjami operacyjnymi i prezentacja wyników.',
  });
  card('c_zesp', 'l_zal', 'Zespół projektu', {
    members: ALL,
    desc: '- Karolina Wiśniewska: koordynacja i harmonogram\n- Tomasz Zieliński: wizyty terenowe i audytorzy\n- Marek Lewandowski: dane, loggery i analizy\n- Ewa Kamińska: metodologia i ekspertyza logistyczna\n- Natalia Dąbrowska: raporty i kontakt z klientami',
  });
  card('c_zakres', 'l_zal', 'Zakres i metoda audytu', {
    desc: '- Okna dostaw i czas rozładunku\n- Czas od dostawy do wystawienia towaru na półce\n- Zaplecze magazynowe i organizacja pracy\n- Łańcuch chłodniczy (loggery temperatury) tam, gdzie dotyczy\n- Próba: 5 placówek na sieć, łącznie 105 wizyt',
  });
  card('c_zrodlo', 'l_zal', 'Źródło zleceń: lista klientów', {
    desc: 'Plik „zlecenia_badania_logistyka” zawierał 22 wiersze. Po oczyszczeniu (duplikat „Stokrotka”, niewidoczne spacje, np. w „Stacja Shell”) zostało 21 unikalnych zleceń.\nDo wyjaśnienia: wiersz „Stacja Paliw” nie wskazuje sieci, a „Auchan” i „Auchan Supermarket” to dwa formaty tej samej sieci.',
    attachments: [{ id: 'a1', name: 'zlecenia_badania_logistyka.xlsx', url: '' }],
  });

  /* ---------- etapy (kamienie milowe) ---------- */
  card('c_e1', 'l_todo', 'ETAP 1 — Brief i dobór próby: 21 sieci, 5 placówek na sieć', { done: true, stage: 1, labels: ['l_met'], due: '2026-11-06' });
  card('c_e2', 'l_todo', 'ETAP 2 — Zgody, protokół audytu i szkolenie audytorów', { done: true, stage: 2, labels: ['l_klient'], due: '2026-11-13' });
  card('c_e3', 'l_todo', 'ETAP 3 — Wizyty terenowe i pomiary (fala 1 i 2)', { stage: 3, labels: ['l_data'], due: '2026-12-11' });
  card('c_e4', 'l_todo', 'ETAP 4 — Analiza, raporty i prezentacje wyników', { stage: 4, labels: ['l_klient'], due: '2026-12-18' });

  /* ---------- zlecenia klientów (21) ---------- */
  const CITY = ['Warszawa', 'Kraków', 'Wrocław', 'Gdańsk', 'Poznań', 'Łódź', 'Katowice', 'Lublin', 'Szczecin', 'Bydgoszcz', 'Białystok', 'Rzeszów', 'Toruń', 'Olsztyn', 'Kielce', 'Opole'];
  const PREP = ['Brief z klientem', 'Podpisane NDA i zgoda na wizyty', 'Dobór 5 placówek do próby', 'Harmonogram wizyt i trasy'];
  const REP = ['Analiza danych z wizyt', 'Raport dla klienta', 'Prezentacja wyników'];
  const CL = [
    // [klucz, nazwa, segment, osoby, status, przygotowanie 0–4, wizyty 0–5, raport 0–3, termin raportu]
    ['zabka', 'Żabka', 'l_conv', ['tz', 'nd'], 'done', 4, 5, 3, '2026-11-06'],
    ['biedronka', 'Biedronka', 'l_dys', ['tz', 'kw'], 'done', 4, 5, 3, '2026-11-09'],
    ['netto', 'Netto', 'l_dys', ['tz', 'ml'], 'done', 4, 5, 3, '2026-11-11'],
    ['rossmann', 'Rossmann', 'l_drog', ['tz', 'nd'], 'done', 4, 5, 3, '2026-11-12'],
    ['socoffee', 'SO!COFFEE', 'l_conv', ['ek', 'nd'], 'done', 4, 5, 3, '2026-11-13'],
    ['dino', 'Dino', 'l_dys', ['tz', 'ml'], 'progress', 4, 4, 0, '2026-11-12'],
    ['stokrotka', 'Stokrotka', 'l_sup', ['tz', 'kw'], 'progress', 4, 4, 0, '2026-11-18'],
    ['hebe', 'Hebe', 'l_drog', ['tz', 'nd'], 'progress', 4, 2, 0, '2026-11-13'],
    ['costa', 'Costa Coffee', 'l_conv', ['ek', 'nd'], 'progress', 4, 5, 1, '2026-11-20'],
    ['carrefour', 'Carrefour', 'l_sup', ['tz', 'ek'], 'progress', 4, 1, 0, '2026-11-26'],
    ['maxizoo', 'Maxi Zoo', 'l_zoo', ['tz', 'ml'], 'progress', 4, 3, 0, '2026-11-20'],
    ['auchansm', 'Auchan Supermarket', 'l_sup', ['tz', 'kw'], 'progress', 3, 0, 0, '2026-11-27'],
    ['spolem', 'Społem', 'l_sup', ['kw', 'nd'], 'progress', 4, 2, 0, '2026-11-25'],
    ['auchan', 'Auchan', 'l_sup', ['tz', 'kw'], 'todo', 2, 0, 0, '2026-12-02'],
    ['kakadu', 'Kakadu Zoo', 'l_zoo', ['ek', 'tz'], 'todo', 1, 0, 0, '2026-12-04'],
    ['mediaexpert', 'Media Expert', 'l_elek', ['tz', 'nd'], 'todo', 0, 0, 0, '2026-12-07'],
    ['moya', 'Stacja Moya', 'l_fuel', ['tz', 'ml'], 'todo', 1, 0, 0, '2026-12-08'],
    ['aquael', 'Aquael', 'l_zoo', ['ek', 'nd'], 'todo', 2, 0, 0, '2026-12-09'],
    ['kaufland', 'Kaufland', 'l_sup', ['nd', 'kw'], 'hold', 2, 0, 0, '2026-12-01'],
    ['shell', 'Stacja Shell', 'l_fuel', ['tz', 'nd'], 'hold', 3, 0, 0, '2026-12-03'],
    ['stacja', 'Stacja Paliw', 'l_fuel', ['nd'], 'hold', 1, 0, 0, '2026-12-03'],
  ];
  CL.forEach(([key, name, seg, own, tone, prep, visits, rep, due], i) => {
    const cities = [0, 1, 2, 3, 4].map((k) => CITY[(i * 3 + k * 5) % CITY.length]);
    card('c_' + key, LIST_OF[tone], `${name} — audyt logistyki dostaw`, {
      labels: [seg], members: own.map((x) => M[x]), due,
      desc: 'Zlecenie z listy klientów. Zakres: okna dostaw, rozładunek, czas od dostawy do półki, zaplecze magazynowe i, jeśli dotyczy, łańcuch chłodniczy.\nKryterium ukończenia: 5 wizyt, komplet danych z loggerów i raport przekazany klientowi.',
      checklists: [
        chk(`k_${key}_p`, 'Przygotowanie', PREP.map((t, j) => [t, j < prep])),
        chk(`k_${key}_w`, 'Wizyty w placówkach', cities.map((c, j) => [`${c} — wizyta i pomiary`, j < visits])),
        chk(`k_${key}_r`, 'Raport', REP.map((t, j) => [t, j < rep])),
      ],
    });
  });

  /* komentarze, decyzje i szczegóły wybranych zleceń */
  const C = D.cards;
  C.c_dino.comments = [say('n1', M.tz, 'Została jedna placówka (Szczecin): zaplecze było zamknięte w sobotę. Dokończę we wtorek i od razu zamykam raport.', at('13', '16:40'))];
  C.c_hebe.comments = [
    say('n2', M.nd, 'Klient prosi o dodatkową placówkę w Gdańsku (zmiana zakresu).', at('12', '11:20')),
    ev('n3', M.kw, 'poproszono szefa o decyzję', at('12', '11:40')),
    ev('n4', 'boss', 'odrzucono decyzję: Poza zakresem umowy. Zaproponować klientowi osobne zlecenie.', at('13', '09:15')),
  ];
  C.c_hebe.decision = { status: 'rejected', question: 'Czy zatwierdzamy rozszerzenie próby Hebe o 3 placówki (ok. 5 400 zł)?', asked: at('12', '11:40'), by: M.kw, note: 'Poza zakresem umowy. Zaproponować klientowi osobne zlecenie.', at: at('13', '09:15'), resolvedBy: 'boss' };
  C.c_kaufland.comments = [say('n5', M.nd, 'Dział prawny klienta nie wydał jeszcze zgody na wizyty w placówkach. Ostatni kontakt: piątek.', at('13', '14:05'))];
  C.c_kaufland.decision = { status: 'pending', question: 'Zgoda działu prawnego klienta nadal nie wpłynęła. Czy zatwierdzasz przesunięcie wizyt do fali 2 (od 30.11) i prośbę do opiekuna klienta o przyspieszenie?', asked: at('13', '14:30'), by: M.nd, note: '' };
  C.c_stacja.comments = [say('n6', M.nd, 'W pliku zleceń wiersz „Stacja Paliw” nie wskazuje sieci. Bez tego nie wycenimy wizyt.', at('05', '10:10'))];
  C.c_stacja.decision = { status: 'pending', question: 'Zlecenie „Stacja Paliw” nie wskazuje sieci. Czy zatwierdzasz wystąpienie do klienta o doprecyzowanie przed wyceną wizyt?', asked: at('13', '14:35'), by: M.nd, note: '' };
  C.c_shell.comments = [say('n7', M.tz, 'Dostęp do zaplecza wymaga zgody zarządcy stacji. Czekam na odpowiedź.', at('12', '15:30'))];
  C.c_auchan.decision = { status: 'pending', question: 'Czy traktujemy „Auchan” i „Auchan Supermarket” jako jedno zlecenie z dwoma formatami (wspólna metodologia, jeden raport zbiorczy)?', asked: at('13', '12:10'), by: M.kw, note: '' };
  C.c_carrefour.comments = [say('n8', M.ek, 'Pierwsza wizyta wykonana. Okno dostaw rano jest krótsze, niż zakładał protokół.', at('11', '17:00'))];
  C.c_zabka.comments = [say('n9', M.nd, 'Raport przekazany. Klient potwierdził odbiór i ocenił współpracę na 5/5.', at('06', '15:20'))];
  C.c_biedronka.comments = [say('n10', M.kw, 'Prezentacja wyników odbyła się online. Klient prosi o zestawienie okien dostaw w formie arkusza.', at('09', '16:10'))];

  /* ---------- zadania projektowe ---------- */
  card('t_xls', 'l_done', 'Weryfikacja listy zleceń (Excel): duplikaty i nazwy', {
    labels: ['l_klient'], members: [M.nd], due: '2026-11-03', source: { meetingId: 'mt_1103', itemId: 'it_k1' },
    desc: 'Oczyszczenie listy zleceń przed wyceną: usunięcie duplikatów i niewidocznych spacji.',
    attachments: [{ id: 'a2', name: 'zlecenia_badania_logistyka.xlsx', url: '' }],
    checklists: [chk('k_xls', 'Kroki', [['Usunąć duplikat „Stokrotka”', 1], ['Usunąć niewidoczne spacje (np. „Stacja Shell”)', 1], ['Zestawić 21 unikalnych zleceń', 1]])],
    comments: [say('n11', M.nd, '22 wiersze → 21 unikalnych sieci. Do wyjaśnienia zostały „Stacja Paliw” i dwa formaty Auchan.', at('03', '13:00'))],
  });
  card('t_proto', 'l_done', 'Protokół audytu logistycznego (wersja 2)', {
    labels: ['l_met'], members: [M.ek], due: '2026-11-05', source: { meetingId: 'mt_1103', itemId: 'it_k2' },
    desc: 'Jednolity protokół dla wszystkich audytorów: okna dostaw, rozładunek, czas do półki, zaplecze, temperatury.',
    decision: { status: 'approved', question: 'Czy zatwierdzasz protokół audytu w wersji 2 do użycia w terenie?', asked: at('04', '09:30'), by: M.ek, note: 'Zatwierdzam. W wersji 3 dodać pole „czas od rozładunku do wystawienia na półkę”.', at: at('05', '08:40'), resolvedBy: 'boss' },
    comments: [ev('n12', M.ek, 'poproszono szefa o decyzję', at('04', '09:30')), ev('n13', 'boss', 'zatwierdzono decyzję: Zatwierdzam. W wersji 3 dodać pole „czas od rozładunku do wystawienia na półkę”.', at('05', '08:40'))],
  });
  card('t_szkol', 'l_done', 'Szkolenie audytorów terenowych (3 sesje)', {
    labels: ['l_met'], members: [M.tz, M.ek], due: '2026-11-09', source: { meetingId: 'mt_1103', itemId: 'it_k3' },
    checklists: [chk('k_szkol', 'Sesje', [['Sesja 1: protokół audytu', 1], ['Sesja 2: loggery i aplikacja terenowa', 1], ['Sesja 3: zasady w placówce i RODO', 1]])],
  });
  card('t_logger', 'l_prog', 'Kalibracja loggerów temperatury — partia 2 (12 szt.)', {
    labels: ['l_data'], members: [M.ml], due: '2026-11-18',
    checklists: [chk('k_logger', 'Kalibracja', [['Odbiór partii od dostawcy', 1], ['Test w komorze (0 °C i 8 °C)', 1], ['Parowanie z aplikacją', 1], ['Kalibracja referencyjna', 0], ['Wydanie audytorom', 0]])],
  });
  card('t_app', 'l_prog', 'Aplikacja terenowa: test i poprawki formularza', {
    labels: ['l_data'], members: [M.ml, M.tz], due: '2026-11-19', source: { meetingId: 'mt_1110', itemId: 'it_o1' },
    checklists: [chk('k_app', 'Poprawki', [['Pole „czas do półki”', 1], ['Praca bez zasięgu (zapis offline)', 1], ['Zdjęcia zaplecza z kompresją', 0], ['Eksport do arkusza', 0]])],
  });
  card('t_szablon', 'l_prog', 'Szablon raportu dla klienta (PL/EN)', {
    labels: ['l_klient'], members: [M.nd, M.ek], due: '2026-11-20',
    desc: 'Wspólny szablon raportu: streszczenie, wyniki, rekomendacje operacyjne, załączniki z danymi.',
    decision: { status: 'changes', question: 'Czy zatwierdzasz układ szablonu raportu?', asked: at('11', '13:20'), by: M.nd, note: 'Dodać stronę z rekomendacjami operacyjnymi i skrócić streszczenie do jednej strony.', at: at('12', '10:05'), resolvedBy: 'boss' },
    comments: [ev('n14', M.nd, 'poproszono szefa o decyzję', at('11', '13:20')), ev('n15', 'boss', 'zwrócono z uwagami decyzję: Dodać stronę z rekomendacjami operacyjnymi i skrócić streszczenie do jednej strony.', at('12', '10:05'))],
  });
  card('t_nda', 'l_prog', 'Umowy NDA: komplet podpisanych', {
    labels: ['l_klient'], members: [M.nd], due: '2026-11-18',
    checklists: [chk('k_nda', 'Partie umów', [['Partia 1 (6 sieci)', 1], ['Partia 2 (6 sieci)', 1], ['Partia 3 (5 sieci)', 1], ['Partia 4 (4 sieci, uwagi prawne)', 0]])],
  });
  card('t_plan2', 'l_todo', 'Plan wizyt — fala 2 (optymalizacja tras)', {
    labels: ['l_data'], members: [M.kw, M.ml], due: '2026-11-17',
    desc: 'Kryterium ukończenia: harmonogram 36 wizyt w 9 dniach roboczych z trasami i oknami dostaw.',
  });
  card('t_jakosc', 'l_todo', 'Kontrola jakości danych — partia 1', {
    labels: ['l_data', 'l_met'], members: [M.ml, M.ek], due: '2026-11-14',
    desc: 'Przegląd kompletności odczytów z loggerów i zgodności protokołów z wizyt fali 1.',
  });
  card('t_rekrut', 'l_todo', 'Rekrutacja 2 dodatkowych audytorów (Śląsk, Małopolska)', {
    labels: ['l_klient'], members: [M.tz, M.kw], due: '2026-11-27', source: { meetingId: 'mt_1113', itemId: 'it_p3' },
    desc: 'Obsada terenowa jest na granicy możliwości przy 105 wizytach w siedem tygodni.',
    decision: { status: 'pending', question: 'Czy zatwierdzasz rekrutację 2 dodatkowych audytorów (koszt ok. 18 000 zł do końca projektu)? Tomasz ma najwięcej otwartych zadań w zespole.', asked: at('13', '15:10'), by: M.tz, note: '' },
  });
  card('t_zarzad', 'l_todo', 'Prezentacja wyników dla kierownictwa', {
    labels: ['l_klient'], members: [M.kw], due: '2026-12-16',
    desc: 'Zbiorcze podsumowanie 21 zleceń: wnioski wspólne dla sieci, najczęstsze wąskie gardła, rekomendacje.',
  });
  D.cards.c_kaufland.source = { meetingId: 'mt_1113', itemId: 'it_p1' };
  D.cards.c_stacja.source = { meetingId: 'mt_1113', itemId: 'it_p2' };

  /* ---------- kosztorys ---------- */
  card('c_koszt', 'l_cost', 'Kosztorys projektu', {
    desc: 'Budżet: 148 000 zł. Honoraria audytorów, dojazdy i noclegi, loggery temperatury, narzędzia analityczne, szkolenia, ubezpieczenie OC i podwykonawcy.',
    attachments: [{ id: 'a3', name: 'Kosztorys projektu.xlsx', url: '' }],
  });

  /* ---------- spotkania ---------- */
  const mt = (id, title, date, start, end, room, topic, org, parts, status, agenda, notes, items) => { D.meetings[id] = { id, title, date, start, end, room, boardId: 'b1', topicLabels: topic, organizer: M[org], participants: parts.map((x) => M[x]), status, agenda, notes, items: items || [] }; };
  mt('mt_1103', 'Kick-off projektu', '2026-11-03', '10:00', '11:30', 'Sala A', ['l_klient', 'l_met'], 'kw', ['kw', 'tz', 'ml', 'ek', 'nd'], 'done',
    'Zakres 21 zleceń, podział ról, harmonogram, budżet.', 'Ustalono 5 placówek na sieć i dwie fale wizyt.',
    [{ id: 'it_k1', text: 'Oczyścić listę zleceń z Excela i ustalić liczbę unikalnych sieci', owner: M.nd, due: '2026-11-03', cardId: 't_xls' },
      { id: 'it_k2', text: 'Przygotować protokół audytu logistycznego (wersja 2)', owner: M.ek, due: '2026-11-05', cardId: 't_proto' },
      { id: 'it_k3', text: 'Zaplanować trzy sesje szkoleniowe dla audytorów', owner: M.tz, due: '2026-11-09', cardId: 't_szkol' }]);
  mt('mt_1110', 'Odprawa audytorów — fala 1', '2026-11-10', '09:00', '10:00', 'Online', ['l_data'], 'tz', ['tz', 'ml', 'ek'], 'done',
    'Trasy fali 1, test aplikacji terenowej, zasady pracy z loggerami.', '',
    [{ id: 'it_o1', text: 'Przetestować formularz w aplikacji na dwóch placówkach', owner: M.ml, due: '2026-11-12', cardId: 't_app' },
      { id: 'it_o2', text: 'Uzupełnić trasy o godziny okien dostaw', owner: M.tz, due: '2026-11-13', cardId: null }]);
  mt('mt_1113', 'Przegląd tygodniowy', '2026-11-13', '10:00', '11:00', 'Sala A', ['l_klient'], 'kw', ['kw', 'tz', 'ml', 'ek', 'nd'], 'done',
    'Stan zleceń, blokery, obsada, budżet.', 'Trzy zlecenia czekają na zgody lub doprecyzowanie.',
    [{ id: 'it_p1', text: 'Wystąpić do klienta o zgodę prawną na wizyty (Kaufland)', owner: M.nd, due: '2026-11-13', cardId: 'c_kaufland' },
      { id: 'it_p2', text: 'Zapytać klienta, której sieci dotyczy zlecenie „Stacja Paliw”', owner: M.nd, due: '2026-11-13', cardId: 'c_stacja' },
      { id: 'it_p3', text: 'Zaplanować rekrutację dodatkowych audytorów', owner: M.kw, due: '2026-11-16', cardId: 't_rekrut' },
      { id: 'it_p4', text: 'Przygotować prognozę kosztów fali 2', owner: M.kw, due: '2026-11-18', cardId: null }]);
  mt('mt_1116', 'Przegląd tygodniowy zespołu', '2026-11-16', '10:00', '11:00', 'Sala A', ['l_klient', 'l_data'], 'kw', ['kw', 'tz', 'ml', 'ek', 'nd'], 'planned',
    '1. Decyzje szefa (Kaufland, Stacja Paliw, Auchan)\n2. Zaległe raporty (Dino, Hebe)\n3. Obsada terenowa i budżet', '');
  mt('mt_1117', 'Call z klientem: zgody prawne (Kaufland)', '2026-11-17', '14:00', '14:45', 'Online', ['l_sup', 'l_klient'], 'nd', ['nd', 'kw', 'ek'], 'planned',
    'Zakres zgody, aneks do NDA, termin odpowiedzi działu prawnego.', '');
  mt('mt_1119', 'Odprawa audytorów — fala 2', '2026-11-19', '09:00', '10:00', 'Sala B', ['l_data', 'l_sup'], 'tz', ['tz', 'ek', 'ml'], 'planned',
    'Trasy fali 2, okna dostaw w okresie przedświątecznym, loggery.', '');
  mt('mt_1119b', 'Warsztat: aplikacja terenowa', '2026-11-19', '09:30', '10:30', 'Sala B', ['l_data'], 'ml', ['ml', 'tz'], 'planned',
    'Poprawki formularza i eksport danych (spotkanie nakłada się z odprawą audytorów).', '');
  mt('mt_1124', 'Przegląd jakości danych — partia 1', '2026-11-24', '11:00', '12:00', 'Online', ['l_data', 'l_met'], 'ml', ['ml', 'ek', 'kw'], 'planned',
    'Kompletność odczytów z loggerów, zgodność protokołów, plan powtórek.', '');
  mt('mt_1203', 'Przegląd śródokresowy z kierownictwem', '2026-12-03', '10:00', '11:30', 'Sala A', ['l_klient'], 'kw', ['kw', 'tz', 'ml', 'ek', 'nd'], 'planned',
    'Postęp, budżet, ryzyka, decyzje dotyczące fali 2.', '');
  mt('mt_1216', 'Prezentacja wyników dla klientów', '2026-12-16', '13:00', '15:00', 'Sala A', ['l_klient'], 'kw', ['kw', 'ek', 'nd'], 'planned',
    'Zbiorcze podsumowanie i rekomendacje dla sieci.', '');

  /* ---------- rejestr ryzyk (skala 1–5, wynik = P × W) ---------- */
  const risk = (n, title, p, w, signal, action, owners) => { D.risks['r' + n] = { id: 'r' + n, code: 'R' + n, title, p, w, signal, action, owners: owners.map((x) => M[x]), status: 'open' }; };
  risk(1, 'Brak zgody sieci na wizyty w placówkach', 4, 5, 'Zgoda działu prawnego klienta nie wpływa mimo przypomnień (obecnie: Kaufland).', 'Eskalacja do opiekuna klienta, aneks do NDA, przesunięcie wizyt do fali 2.', ['nd', 'kw']);
  risk(2, 'Szczyt sezonu (Black Friday, święta) utrudnia dostęp do zaplecza', 4, 4, 'Placówki odmawiają wizyt w godzinach dostaw lub skracają okna.', 'Wizyty poza godzinami szczytu, plan B z dodatkowymi terminami, wcześniejsze potwierdzenia.', ['tz']);
  risk(3, 'Niska jakość danych z loggerów temperatury', 3, 4, 'Luki w odczytach lub rozjazd kalibracji w partii pomiarów.', 'Kalibracja referencyjna, kontrola partii, powtórzenie pomiarów.', ['ml']);
  risk(4, 'Ujawnienie poufnych danych klientów', 2, 5, 'Zdjęcia zaplecza lub dokumenty dostaw poza bezpiecznym repozytorium.', 'Szyfrowane repozytorium, zasady zdjęć w placówce, szkolenie z RODO i NDA.', ['ml', 'ek']);
  risk(5, 'Zbyt mała obsada terenowa', 3, 4, 'Więcej niż 10 otwartych zadań na jednego audytora, opóźnienia raportów.', 'Rekrutacja dwóch audytorów, redystrybucja zleceń, podwykonawca.', ['tz', 'kw']);
  risk(6, 'Przekroczenie budżetu (dojazdy, paliwo, noclegi)', 3, 3, 'Tempo wydatków wyprzedza upływ czasu o więcej niż 10 punktów procentowych.', 'Optymalizacja tras, łączenie wizyt, cotygodniowy przegląd wydatków.', ['kw']);
  risk(7, 'Niespójna metodologia między audytorami', 3, 3, 'Różne interpretacje pól protokołu, rozbieżności w danych.', 'Wersja 3 protokołu, kalibracja audytorów, kontrola próbki.', ['ek']);
  risk(8, 'Zmiany zakresu zlecenia przez klienta', 2, 3, 'Prośby o dodatkowe placówki lub formaty raportu (np. Hebe, Kakadu Zoo).', 'Procedura zmian, wycena dodatków jako osobne zlecenia.', ['nd']);

  /* ---------- PESTEL ---------- */
  D.meta.pestel = { rows: [
    { id: 'p1', area: 'Polityczne', impact: 2, factor: 'Rosnące wymagania dotyczące przejrzystości łańcuchów dostaw sprawiają, że sieci handlowe chętniej zamawiają niezależne audyty.', conclusion: 'Pokazywać w raportach zgodność z oczekiwaniami regulatorów, ale nie opierać oferty na przepisach, które jeszcze się zmieniają.' },
    { id: 'p2', area: 'Ekonomiczne', impact: 3, factor: 'Koszty paliwa i transportu rosną, a sieci walczą o marże. Klienci oczekują krótkich, konkretnych rekomendacji z policzonym efektem.', conclusion: 'Łączyć wizyty w trasy, rozliczać koszty co tydzień i wyceniać zmiany zakresu jako osobne zlecenia.' },
    { id: 'p3', area: 'Społeczne', impact: 2, factor: 'Niedobór pracowników w magazynach i sklepach oraz rotacja załóg wpływają na rozładunek i wystawianie towaru.', conclusion: 'W protokole uwzględniać obsadę zmiany i stopień wdrożenia pracowników.' },
    { id: 'p4', area: 'Technologiczne', impact: 3, factor: 'Loggery temperatury, aplikacje terenowe i systemy magazynowe pozwalają mierzyć czas i warunki dostaw bez ręcznego opisu.', conclusion: 'Standaryzować dane (jeden format eksportu), kalibrować loggery i kontrolować kompletność odczytów.' },
    { id: 'p5', area: 'Środowiskowe', impact: 2, factor: 'Straty żywności i emisje transportu są coraz częściej mierzone w sieciach, zwłaszcza w łańcuchu chłodniczym.', conclusion: 'Dodać do raportów sekcję o stratach i skuteczności łańcucha chłodniczego tam, gdzie dotyczy.' },
    { id: 'p6', area: 'Prawne', impact: 3, factor: 'Wizyty w placówkach wymagają zgód i umów NDA. Zdjęcia i dane o dostawach muszą być chronione, a pracownicy nie mogą być identyfikowani (RODO).', conclusion: 'Podpisane NDA przed pierwszą wizytą, zasady zdjęć w placówce, szyfrowane repozytorium i ograniczony dostęp do surowych danych.' },
  ], priority: 'Najważniejsze są zgody i poufność. Bez podpisanych NDA i zgód nie ruszamy z wizytami, a dane z placówek trafiają wyłącznie do szyfrowanego repozytorium.' };

  /* ---------- SWOT ---------- */
  D.meta.swot = {
    s: ['Jednolity protokół audytu i szkolone zespoły terenowe.', 'Loggery temperatury dają twarde dane zamiast opisów.', 'Doświadczenie w pracy z wieloma formatami sklepów jednocześnie.', 'Jedno miejsce z zadaniami, terminami, decyzjami i ryzykami.'],
    w: ['Mała obsada terenowa wobec 105 wizyt.', 'Zależność od zgód i terminów po stronie klientów.', 'Dane z loggerów wymagają kosztownej kontroli jakości.', 'Raporty powstają ręcznie, na wspólnym szablonie.'],
    o: ['Dodatkowe audyty fali 2 i kontrakty cykliczne.', 'Raport zbiorczy dla kilku sieci jako nowy produkt.', 'Rekomendacje operacyjne mogą otworzyć zlecenia wdrożeniowe.', 'Polecenia między sieciami należącymi do tych samych grup.'],
    t: ['Szczyt sezonu i ograniczony dostęp do zaplecza.', 'Wyciek poufnych danych klienta lub zdjęć z placówek.', 'Rozrost zakresu bez wyceny (prośby o dodatkowe placówki).', 'Konkurencja z tańszymi audytami bez pomiarów.'],
    strategy: [
      { k: 'SO', txt: 'Wykorzystać dane z loggerów, aby wyróżnić raporty konkretnymi pomiarami i zaproponować kontrakty cykliczne.' },
      { k: 'WO', txt: 'Zrekrutować dwóch audytorów i łączyć trasy, aby zrealizować falę 2 bez utraty jakości.' },
      { k: 'ST', txt: 'Chronić dane (NDA, szyfrowanie) i wyceniać zmiany zakresu jako osobne zlecenia.' },
      { k: 'WT', txt: 'Planować wizyty poza godzinami szczytu i mieć zapasowe terminy na okres przedświąteczny.' },
    ],
  };

  /* ---------- karta wyników ---------- */
  D.meta.scorecard = { note: 'Część wskaźników liczy się automatycznie z zadań, spotkań i budżetu. Pozostałe wpisuje się ręcznie po każdym cyklu pomiaru.', rows: [
    { id: 'k1', persp: 'Finanse', goal: 'Utrzymać koszty w budżecie', name: 'Tempo wydatków wobec upływu czasu (wyprzedzenie)', unit: 'pp', target: 10, mode: 'atmost', auto: 'budget', current: null, source: 'Zestawienie wydatków · co tydzień', owner: 'Karolina' },
    { id: 'k2', persp: 'Klient', goal: 'Dostarczać raporty, które klienci cenią', name: 'Średnia ocena zadowolenia klientów (1–5)', unit: '/5', target: 4.5, mode: 'atleast', auto: null, current: 4.6, source: 'Ankieta po prezentacji wyników', owner: 'Natalia' },
    { id: 'k3', persp: 'Klient', goal: 'Dostarczać raporty, które klienci cenią', name: 'Raporty dostarczone w terminie', unit: '%', target: 95, mode: 'atleast', auto: null, current: 80, source: 'Rejestr raportów · co tydzień', owner: 'Natalia' },
    { id: 'k4', persp: 'Procesy', goal: 'Zrealizować badanie terenowe zgodnie z planem', name: 'Placówki zbadane (z 105 zaplanowanych)', unit: '', target: 105, mode: 'atleast', auto: 'visits', current: null, source: 'Listy wizyt w zadaniach · na bieżąco', owner: 'Tomasz' },
    { id: 'k5', persp: 'Procesy', goal: 'Zapewnić wiarygodny status i odpowiedzialność', name: 'Aktywne zadania z właścicielem, terminem i kryterium ukończenia', unit: '%', target: 100, mode: 'atleast', auto: 'quality', current: null, source: 'Zadania · co tydzień', owner: 'Karolina' },
    { id: 'k6', persp: 'Procesy', goal: 'Zapewnić wiarygodny status i odpowiedzialność', name: 'Ustalenia ze spotkań zamienione na zadania', unit: '%', target: 90, mode: 'atleast', auto: 'agreements', current: null, source: 'Spotkania i zadania · co tydzień', owner: 'Cały zespół' },
    { id: 'k7', persp: 'Jakość danych', goal: 'Mieć dane, którym można zaufać', name: 'Kompletność odczytów z loggerów', unit: '%', target: 98, mode: 'atleast', auto: null, current: 94, source: 'Kontrola jakości danych · każda partia', owner: 'Marek' },
    { id: 'k8', persp: 'Jakość danych', goal: 'Mieć dane, którym można zaufać', name: 'Niezgodności protokołu na 100 wizyt', unit: '', target: 3, mode: 'atmost', auto: null, current: 5, source: 'Kontrola próbki protokołów', owner: 'Ewa' },
  ] };

  /* ---------- plan działań ---------- */
  D.meta.plan = { note: 'Plan projektu 2 listopada – 18 grudnia 2026. Kroki wykonane odhaczamy, a kolejne można zamienić w zadania jednym kliknięciem.', rows: [
    { id: 'pl1', start: '2026-11-02', when: '2–6.11', due: '2026-11-06', action: 'Brief z klientami, oczyszczenie listy zleceń i dobór próby (21 sieci, 5 placówek).', owner: 'Karolina + Natalia', criterion: '21 unikalnych zleceń i lista 105 placówek zatwierdzona.', done: true },
    { id: 'pl2', start: '2026-11-09', when: '9–13.11', due: '2026-11-13', action: 'Zgody klientów, protokół audytu i szkolenie audytorów.', owner: 'Natalia + Ewa + Tomasz', criterion: 'Podpisane NDA, protokół v2 zatwierdzony, 3 sesje szkoleniowe.', done: true },
    { id: 'pl3', start: '2026-11-09', when: '9–27.11', due: '2026-11-27', action: 'Wizyty terenowe — fala 1 (dyskonty, convenience, drogerie, część supermarketów).', owner: 'Tomasz + audytorzy', criterion: '63 wizyty wykonane, komplet danych z loggerów.', done: false },
    { id: 'pl4', start: '2026-11-23', when: '23.11–11.12', due: '2026-12-11', action: 'Wizyty terenowe — fala 2 (hipermarkety, zoologiczne, stacje paliw, elektronika).', owner: 'Tomasz + dodatkowi audytorzy', criterion: '42 wizyty wykonane, powtórki pomiarów zakończone.', done: false },
    { id: 'pl5', start: '2026-11-24', when: '24.11–11.12', due: '2026-12-11', action: 'Kontrola jakości danych i analiza wyników.', owner: 'Marek + Ewa', criterion: 'Kompletność odczytów ≥ 98%, wyniki policzone dla 21 zleceń.', done: false },
    { id: 'pl6', start: '2026-12-07', when: '7–16.12', due: '2026-12-16', action: 'Raporty dla klientów (21) na wspólnym szablonie.', owner: 'Natalia + Ewa', criterion: 'Raporty przekazane w terminie, potwierdzony odbiór.', done: false },
    { id: 'pl7', start: '2026-12-14', when: '14–18.12', due: '2026-12-18', action: 'Prezentacje wyników, ankieta klientów i zamknięcie projektu.', owner: 'Karolina + Natalia', criterion: 'Średnia ocena ≥ 4,5, rozliczenie budżetu, lista wniosków.', done: false },
  ] };

  /* ---------- budżet ---------- */
  const ex = (id, date, name, amount) => ({ id, date, name, amount });
  D.meta.budget = { estimate: 148000, yearly: 9600, tolerance: 10, note: 'Budżet obejmuje honoraria audytorów, dojazdy i noclegi, loggery, narzędzia analityczne, szkolenia, ubezpieczenie i podwykonawców.', expenses: [
    ex('e1', '2026-11-03', 'Honoraria audytorów: fala 1 (zaliczka)', 24000),
    ex('e2', '2026-11-04', 'Loggery temperatury (24 szt.)', 9840),
    ex('e3', '2026-11-05', 'Licencja narzędzia do analiz (12 mies.)', 4200),
    ex('e4', '2026-11-06', 'Szkolenie audytorów (3 sesje)', 3600),
    ex('e5', '2026-11-09', 'Dojazdy i paliwo: tydzień 1', 5120),
    ex('e6', '2026-11-10', 'Noclegi: wizyty wyjazdowe', 3980),
    ex('e7', '2026-11-12', 'Podwykonawca: audytor zewnętrzny (Śląsk)', 12000),
    ex('e8', '2026-11-13', 'Dojazdy i paliwo: tydzień 2', 4860),
    ex('e9', '2026-11-13', 'Aplikacja terenowa: licencja i SMS', 1890),
    ex('e10', '2026-11-13', 'Ubezpieczenie OC audytorów', 2300),
  ] };

  /* ---------- raport statusowy ---------- */
  D.meta.status = {
    overall: 'risk',
    summary: 'Projekt jest zagrożony terminowo. Pięć raportów dostarczono, ale Dino i Hebe są po terminie, trzy zlecenia czekają na zgodę lub doprecyzowanie, a wydatki wyprzedzają harmonogram. Decyzje szefa odblokują Kaufland i Stację Paliw.',
    rows: [
      { id: 's1', area: 'Zgody klientów', state: 'risk', text: 'NDA podpisane dla 17 z 21 sieci. Kaufland czeka na zgodę działu prawnego, „Stacja Paliw” na doprecyzowanie zlecenia.', next: 'Eskalacja do opiekunów klientów i call 17.11. Decyzje szefa na przeglądzie 16.11.' },
      { id: 's2', area: 'Obsada terenowa', state: 'risk', text: 'Tomasz ma najwięcej otwartych zadań. Fala 2 obejmuje 42 wizyty w okresie przedświątecznym.', next: 'Decyzja o rekrutacji dwóch audytorów i plan wizyt fali 2.' },
      { id: 's3', area: 'Dane z loggerów', state: 'ok', text: 'Partia 2 loggerów w kalibracji. Kontrola jakości partii 1 jeszcze nie ruszyła.', next: 'Kontrola jakości danych i przegląd 24.11.' },
    ],
    decisions: ['Kaufland: przesunąć wizyty do fali 2 i poprosić opiekuna klienta o przyspieszenie zgody.', 'Stacja Paliw: wystąpić do klienta o doprecyzowanie przed wyceną.', 'Rekrutacja dwóch audytorów: akceptacja budżetu ok. 18 000 zł.'],
  };

  /* ---------- karta projektu ---------- */
  D.meta.project = {
    name: 'Menedżerski Panel Zarządzania',
    title: 'Badanie logistyki w sieciach handlowych',
    goal: 'Zbadać przebieg dostaw i zasilania półek w 21 sieciach handlowych z listy zleceń, wskazać wąskie gardła logistyczne i dostarczyć każdemu klientowi raport z rekomendacjami operacyjnymi.',
    start: '2026-11-02', end: '2026-12-18',
    facts: [
      { k: 'Plan', v: '2 listopada – 18 grudnia 2026' },
      { k: 'Zakres', v: '21 sieci handlowych, 5 placówek na sieć (105 wizyt)' },
      { k: 'Zespół', v: '5 osób' },
      { k: 'Źródło zleceń', v: 'plik „zlecenia_badania_logistyka” (22 wiersze, 21 unikalnych zleceń)' },
    ],
    scopeIn: ['Audyty logistyki dostaw w 21 sieciach', 'Pomiary temperatury w łańcuchu chłodniczym (loggery)', 'Raport z rekomendacjami dla każdego klienta', 'Prezentacja wyników i ankieta klienta', 'Zbiorcze podsumowanie dla kierownictwa'],
    scopeOut: ['Wdrożenie rekomendacji w sieciach', 'Audyty magazynów centralnych', 'Badania poza Polską', 'Dodatkowe placówki ponad próbę (wycena osobno)'],
  };
  D.meta.sim = { today: DEMO_START, step: 0, log: [] };
  D.meta.seeded = { v: SEED_VERSION };
  return D;
}
