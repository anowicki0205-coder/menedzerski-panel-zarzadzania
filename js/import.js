'use strict';
/* Menedżerski Panel Zarządzania — import zleceń z pliku Excel (xlsx) lub CSV: czyszczenie nazw, wykrywanie duplikatów, tworzenie zadań */

let imp = null;
const cleanName = (v) => String(v == null ? '' : v).replace(/[ ​  ]/g, ' ').replace(/\s+/g, ' ').trim();
const taskBaseName = (c) => norm(cleanName(c.title.split(' — ')[0]));

function loadXlsxLib() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => (window.XLSX ? res(window.XLSX) : rej(new Error('lib')));
    s.onerror = () => rej(new Error('lib'));
    document.head.appendChild(s);
  });
}


/* Czytnik pierwszej kolumny pliku .xlsx bez bibliotek: xlsx to archiwum ZIP z plikami XML */
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
async function readZipEntries(buf, want) {
  const dv = new DataView(buf); const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('zip');
  const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const td = new TextDecoder(); const out = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
    if (want(name)) {
      const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true);
      const data = u8.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + csize);
      const raw = method === 0 ? data : await inflateRaw(data);
      out[name] = td.decode(raw);
    }
    p += 46 + nl + el + cl;
  }
  return out;
}
async function readXlsxFirstColumn(buf) {
  const files = await readZipEntries(buf, (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const sheetName = Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
  if (!sheetName) throw new Error('sheet');
  const dp = new DOMParser();
  const shared = files['xl/sharedStrings.xml']
    ? Array.from(dp.parseFromString(files['xl/sharedStrings.xml'], 'application/xml').getElementsByTagName('si')).map((si) => Array.from(si.getElementsByTagName('t')).map((t) => t.textContent).join(''))
    : [];
  const doc = dp.parseFromString(files[sheetName], 'application/xml');
  const rows = [];
  Array.from(doc.getElementsByTagName('row')).forEach((row) => {
    const cells = Array.from(row.getElementsByTagName('c')).map((c) => {
      const ref = c.getAttribute('r') || ''; const col = ref.replace(/\d+/g, '');
      let v = '';
      if (c.getAttribute('t') === 's') { const vn = c.getElementsByTagName('v')[0]; v = vn ? shared[Number(vn.textContent)] || '' : ''; }
      else if (c.getAttribute('t') === 'inlineStr') v = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent).join('');
      else { const vn = c.getElementsByTagName('v')[0]; v = vn ? vn.textContent : ''; }
      return { col: col.length * 100 + col.charCodeAt(0), v };
    }).filter((c) => cleanName(c.v)).sort((a, b) => a.col - b.col);
    if (cells.length) rows.push(cells[0].v);
  });
  return rows;
}

function classify(rawNames) {
  const existing = new Set(taskCards().map(taskBaseName));
  const seen = new Set();
  const rows = [];
  rawNames.forEach((raw) => {
    const name = cleanName(raw); if (!name) return;
    const key = norm(name);
    let status = 'new';
    if (seen.has(key)) status = 'dup';
    else if (existing.has(key)) status = 'exists';
    seen.add(key);
    rows.push({ raw: String(raw), name, status, sel: status === 'new', trimmed: String(raw) !== name });
  });
  return rows;
}

function parseCsv(text) {
  return text.split(/\r?\n/).map((l) => l.split(/[;\t,]/)[0]).filter((x) => cleanName(x));
}

A['import-open'] = () => {
  const todo = listByTone('todo');
  imp = { file: '', rows: [], seg: '', members: [], due: '', status: todo ? todo.id : '', error: '', total: 0 };
  openModal(importHTML, 'modal-form modal-import');
};

function importHTML() {
  const f = imp; const board = mainBoard() || { labels: [] };
  const nNew = f.rows.filter((r) => r.sel).length;
  const stat = { new: ['Nowe', 'tag-ok'], dup: ['Duplikat w pliku', 'tag-warn'], exists: ['Już w panelu', ''] };
  return `<div class="modal-scroll"><header class="m-head"><h2 class="m-h2">Importuj zlecenia z Excela</h2><button class="icon-btn" data-act="close-modal" aria-label="Zamknij">${ico('x')}</button></header>
    <div class="m-body">
      <p class="hint">Wskaż plik .xlsx lub .csv. Panel weźmie pierwszą kolumnę, oczyści nazwy (spacje, znaki niewidoczne), wykryje duplikaty i zleceń, które już są w panelu, a potem utworzy zadania z gotowymi checklistami (przygotowanie, 5 wizyt, raport).</p>
      <label class="fld"><span>Plik z listą zleceń</span><input type="file" accept=".xlsx,.xls,.csv,.txt" data-chg="imp-file"></label>
      ${f.error ? `<div class="warn-box">${ico('warn')}<span>${esc(f.error)}</span></div>` : ''}
      ${f.rows.length ? `<p><b>${esc(f.file)}</b>: wczytano ${f.total} ${plural(f.total, 'wiersz', 'wiersze', 'wierszy')}, ${f.rows.filter((r) => r.status !== 'dup').length} unikalnych. Do utworzenia: <b>${nNew}</b>.</p>
      <div class="tbl-wrap imp-tbl"><table class="tbl"><thead><tr><th></th><th>Nazwa po oczyszczeniu</th><th>Wiersz w pliku</th><th>Wynik</th></tr></thead><tbody>${f.rows.map((r, i) => `<tr class="${r.status !== 'new' ? 'closed' : ''}"><td><input type="checkbox" data-chg="imp-sel" data-i="${i}" ${r.sel ? 'checked' : ''} ${r.status !== 'new' ? 'disabled' : ''} aria-label="${esc(r.name)}"></td><td><b>${esc(r.name)}</b></td><td class="muted">${r.trimmed ? `„${esc(r.raw.replace(/[ ]/g, '␣'))}” (oczyszczono spacje)` : '—'}</td><td><span class="tag ${stat[r.status][1]}">${stat[r.status][0]}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="form-grid two pt">
        <label class="fld"><span>Obszar (segment)</span><select data-chg="imp-seg"><option value="">— bez obszaru —</option>${board.labels.map((l) => `<option value="${l.id}" ${f.seg === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label class="fld"><span>Termin raportu</span><input type="date" value="${f.due}" data-chg="imp-due"></label>
        <label class="fld"><span>Status</span><select data-chg="imp-status">${statusLists().map((l) => `<option value="${l.id}" ${l.id === f.status ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select></label>
      </div>
      <div class="fld"><span>Odpowiedzialni</span><div class="row gap wrap">${members().map((m) => `<label class="chk pill-pick ${f.members.includes(m.id) ? 'sel' : ''}"><input type="checkbox" data-chg="imp-member" value="${m.id}" ${f.members.includes(m.id) ? 'checked' : ''}>${avatar(m.id, 'xs')}<span>${esc(m.name)}</span></label>`).join('')}</div></div>` : ''}
      <div class="m-foot">${btn('close-modal', 'Anuluj')}<span class="grow"></span>${btn('imp-go', `${ico('check')} Utwórz ${nNew} ${plural(nNew, 'zadanie', 'zadania', 'zadań')}`, 'primary', nNew ? '' : 'disabled')}</div>
    </div></div>`;
}

C['imp-file'] = async (el) => {
  const file = el.files && el.files[0]; if (!file) return;
  imp.file = file.name; imp.error = ''; imp.rows = []; imp.total = 0;
  try {
    let names = [];
    if (/\.(csv|txt)$/i.test(file.name)) names = parseCsv(await file.text());
    else if (/\.xlsx$/i.test(file.name)) names = await readXlsxFirstColumn(await file.arrayBuffer());
    else {
      const X = await loadXlsxLib();
      const wb = X.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      names = X.utils.sheet_to_json(ws, { header: 1, defval: '' }).map((r) => (Array.isArray(r) ? r.find((v) => cleanName(v)) : r)).filter((v) => cleanName(v));
    }
    if (names.length && /^(nazwa|klient|sie[cć]|zlecenie|lp)\b/i.test(cleanName(names[0]))) names.shift();
    imp.total = names.length; imp.rows = classify(names);
    if (!imp.rows.length) imp.error = 'W pliku nie znaleziono żadnych nazw w pierwszej kolumnie.';
  } catch (e) {
    imp.error = /lib/.test(e.message) ? 'Nie udało się wczytać biblioteki do odczytu Excela (potrzebne połączenie z internetem). Zapisz plik jako CSV i spróbuj ponownie.' : 'Nie udało się odczytać pliku. Sprawdź, czy to poprawny plik .xlsx lub .csv (starszy format .xls wymaga połączenia z internetem).';
  }
  renderModal();
};
C['imp-sel'] = (el) => { imp.rows[Number(el.dataset.i)].sel = el.checked; renderModal(); };
C['imp-seg'] = (el) => { imp.seg = el.value; };
C['imp-due'] = (el) => { imp.due = el.value; };
C['imp-status'] = (el) => { imp.status = el.value; };
C['imp-member'] = (el) => { toggleIn(imp.members, el.value); renderModal(); };
A['imp-go'] = () => {
  const CITY = ['Warszawa', 'Kraków', 'Wrocław', 'Gdańsk', 'Poznań', 'Łódź', 'Katowice', 'Lublin'];
  let n = 0;
  imp.rows.filter((r) => r.sel).forEach((r, i) => {
    const key = uid('imp');
    const c = addCard(imp.status, `${r.name} — audyt logistyki dostaw`, {
      labels: imp.seg ? [imp.seg] : [], members: imp.members.slice(), due: imp.due || null,
      desc: 'Zlecenie zaimportowane z listy klientów. Kryterium ukończenia: 5 wizyt, komplet danych z loggerów i raport przekazany klientowi.',
      checklists: [
        { id: `k_${key}_p`, title: 'Przygotowanie', items: ['Brief z klientem', 'Podpisane NDA i zgoda na wizyty', 'Dobór 5 placówek do próby', 'Harmonogram wizyt i trasy'].map((t, j) => ({ id: `${key}_p${j}`, text: t, done: false })) },
        { id: `k_${key}_w`, title: 'Wizyty w placówkach', items: [0, 1, 2, 3, 4].map((j) => ({ id: `${key}_w${j}`, text: `${CITY[(i + j * 2) % CITY.length]} — wizyta i pomiary`, done: false })) },
        { id: `k_${key}_r`, title: 'Raport', items: ['Analiza danych z wizyt', 'Raport dla klienta', 'Prezentacja wyników'].map((t, j) => ({ id: `${key}_r${j}`, text: t, done: false })) },
      ],
    });
    logEvent(c, 'zaimportowano z pliku ' + imp.file);
    n++;
  });
  closeModal(); commit();
  toast(`Zaimportowano ${n} ${plural(n, 'zlecenie', 'zlecenia', 'zleceń')} z pliku`);
};
