# Menedżerski Panel Zarządzania

**Podgląd online:** https://anowicki0205-coder.github.io/menedzerski-panel-zarzadzania/

Klikalny panel zarządzania projektem dla kierownika (HTML, CSS, JavaScript, bez zależności i bez serwera). Motyw różowo-fioletowy (jasny i ciemny). Na telefonie panel ma dolną nawigację, przycisk „+” do zlecania zadań, okna w formie arkuszy od dołu, a tabele zamieniają się w karty, więc nie trzeba przewijać ekranu w bok.

## Dane demonstracyjne

Wszystkie dane są **wymyślone**: pięć fikcyjnych osób, fikcyjne wyniki i zdarzenia. Scenariusz: agencja badawcza realizuje „Badanie logistyki w sieciach handlowych” dla 21 zleceń z listy klientów (plik Excel „zlecenia_badania_logistyka”: 22 wiersze, po oczyszczeniu 21 unikalnych sieci). Nazwy sieci pochodzą z tego pliku i służą wyłącznie jako przykład; opisane wyniki i problemy nie dotyczą rzeczywistych firm.

Dzień demonstracyjny to **poniedziałek 16 listopada 2026**. Przycisk „Dzień w panelu” w menu bocznym przesuwa czas o kolejny dzień roboczy i uruchamia scenariusz: zespół odhacza wizyty i zamyka raporty, pojawiają się nowe prośby o decyzję, rosną wydatki i ryzyka, wskaźniki i alerty przeliczają się na wszystkich ekranach.

Panel nie jest tablicą Kanban. Statusy zadań (Do zrobienia, W trakcie, Zrobione, Wstrzymane) są kolumną w tabeli, a ekran startowy odpowiada na pytania kierownika: czy projekt jest na torze, co czeka na moją decyzję, co jest zablokowane, kto jest przeciążony, ile wydaliśmy.

## Uruchomienie

Strona (GitHub Pages) serwuje `index.html` razem z katalogami `css/` i `js/`, bez budowania. Lokalnie otwórz `dist/panel.html` w przeglądarce (dwuklik) albo `index.html` przez dowolny serwer statyczny. Dane zapisują się w przeglądarce (localStorage), więc każdy odwiedzający pracuje na własnej kopii danych przykładowych.

## Widoki

| Widok | Co robi |
|---|---|
| **Przegląd** | Status projektu (na torze, zagrożony, opóźniony), etapy, wskaźniki, decyzje do podjęcia, sygnały ostrzegawcze, oś czasu planu 14–28.11, zadania wg statusu, obciążenie zespołu, terminy, ryzyka, budżet, spotkania |
| **Do decyzji** | Prośby zespołu o zatwierdzenie (zatwierdzam, wróć z uwagami, odrzucam) z historią oraz sygnały liczone automatycznie: zadania po terminie i wstrzymane, zagrożone terminy, brak właściciela lub terminu, ryzyka krytyczne, wskaźniki poniżej celu, ustalenia bez zadania |
| **Zadania** | Tabela z wyszukiwaniem i filtrami, grupowaniem (status, osoba, termin), zmianą statusu w wierszu, panelem szczegółów (opis, checklisty, komentarze, historia) i przyciskiem „Zleć zadanie” |
| **Zespół** | Obciążenie każdej osoby, zadania po terminie, powiązane ryzyka, zlecanie zadań |
| **Harmonogram** | Kalendarz i agenda, spotkania z salą, kolizje sal i osób, rekomendacja uczestników z uzasadnieniem, ustalenia zamieniane w zadania |
| **Ryzyka, Budżet, Karta wyników, Raport statusowy, PESTEL i SWOT, Plan działań, Karta projektu** | Moduły z dokumentu zespołu; wskaźniki, ocena ryzyka i macierz 5×5 przeliczają się na żywo |

## Rekomendacja uczestników spotkania

Organizator (+5), zadania z obszarów wybranych jako temat (+2 za zadanie, maks. +4), zadania pasujące do słów z tytułu i agendy (maks. +2), zadania po terminie (+2), zadanie wstrzymane (+2), otwarte ustalenia z wcześniejszych spotkań (+2), kolizja z innym spotkaniem (−3). Rekomendowani: wynik ≥ 2 i brak kolizji. Skład zawsze zatwierdza organizator.

## Zapis danych

- **Lokalnie**: localStorage przeglądarki (tryb domyślny, klucze `mpz:*`).
- **Import z Excela**: Zadania → „Importuj z Excela” czyści nazwy z pliku (spacje, duplikaty), wykrywa zlecenia już obecne w panelu i tworzy zadania z checklistami.
- **Wspólnie**: po opublikowaniu jako artefakt Claude z włączoną bazą dane trafiają do wspólnej bazy, a zmiany widać na żywo u wszystkich osób z uprawnieniem edycji. Każda encja to osobny dokument, więc równoległe edycje różnych zadań nie nadpisują się.
- Eksport i import: „Dane i ustawienia” w lewym dolnym rogu.

## Role

Brak logowania. W lewym dolnym rogu wybierasz, kim jesteś: „Szef” lub członek zespołu. Decyzje zatwierdza „Szef”; zespół zgłasza prośby z poziomu zadania.

## Struktura

```
index.html        szkielet i kolejność skryptów
css/app.css       style (jasny i ciemny motyw)
js/util.js        narzędzia, daty, ikony
js/data.js        dane startowe z dokumentu i tablicy
js/store.js       stan, zapis lokalny i wspólny, selektory
js/ui.js          dymki, okna, powiadomienia, zdarzenia
js/tasks.js       tabela zadań, filtry, zlecanie zadania
js/settings.js    obszary (etykiety), archiwum, eksport, import
js/card.js        panel szczegółów zadania, decyzje szefa
js/planner.js     harmonogram, spotkania, rekomendacje
js/sim.js         symulacja dni pracy i aktywność
js/import.js      import zleceń z Excela / CSV
js/overview.js    ekran Przegląd
js/decisions.js   Do decyzji i sygnały ostrzegawcze
js/team.js        Zespół i Karta projektu
js/analysis.js    ryzyka, PESTEL, SWOT, karta wyników, raport, plan, budżet
js/app.js         start, menu boczne, nawigacja
tools/build.py    buduje dist/panel.html i dist/artifact.html
```

Po zmianach w `css/` lub `js/` uruchom `python3 tools/build.py`.

## Ograniczenia prototypu

Brak logowania i uprawnień na poziomie danych, załączniki są linkami, brak integracji z kalendarzami i powiadomień. Dane są fikcyjne i służą pokazaniu możliwości systemu.
