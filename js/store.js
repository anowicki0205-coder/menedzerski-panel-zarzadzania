'use strict';
/* Menedżerski Panel Zarządzania — stan aplikacji i zapis (lokalny lub wspólny w bazie artefaktu) */

const COLS = ['boards', 'lists', 'cards', 'meetings', 'risks', 'meta'];
const emptyState = () => ({ boards: {}, lists: {}, cards: {}, meetings: {}, risks: {}, meta: {} });
let S = emptyState();

const LS_DATA = 'mpz:dane:v1';
const LS_UI = 'mpz:widok:v1';
const mem = {};
function lsGet(k) { try { const v = localStorage.getItem(k); return v === null ? (mem[k] ?? null) : v; } catch (e) { return mem[k] ?? null; } }
function lsSet(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) { /* tryb prywatny */ } }
function lsDel(k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) { /* */ } }

/* ---------- zapis ---------- */
const P = {
  mode: 'local',          // 'local' | 'shared'
  state: 'local',         // 'local' | 'connecting' | 'synced' | 'saving' | 'offline' | 'readonly' | 'error'
  db: null, saved: {}, timer: null, queue: Promise.resolve(), readOnly: false,
  onRemote: () => {}, onStatus: () => {}, onError: () => {},
};

function setPState(s) { if (P.state !== s) { P.state = s; P.onStatus(s); } }

function markSaved() {
  P.saved = {};
  for (const c of COLS) for (const id in S[c]) P.saved[c + '/' + id] = canon(S[c][id]);
}

function schedule() {
  clearTimeout(P.timer);
  P.timer = setTimeout(flush, 280);
}

function flush() {
  clearTimeout(P.timer);
  const ops = [];
  const seen = new Set();
  for (const c of COLS) {
    for (const id in S[c]) {
      const key = c + '/' + id;
      seen.add(key);
      const js = canon(S[c][id]);
      if (P.saved[key] !== js) ops.push({ t: 'set', c, id, key, js });
    }
  }
  for (const key in P.saved) if (!seen.has(key)) { const [c, id] = key.split('/'); ops.push({ t: 'del', c, id, key }); }
  if (!ops.length) return;

  if (P.mode === 'local') {
    lsSet(LS_DATA, JSON.stringify(S));
    for (const o of ops) { if (o.t === 'set') P.saved[o.key] = o.js; else delete P.saved[o.key]; }
    return;
  }
  /* wspólna baza: zapisuj tylko zmienione dokumenty, po jednym naraz */
  if (P.readOnly) { P.onError({ code: 'readonly' }); return; }
  for (const o of ops) { if (o.t === 'set') P.saved[o.key] = o.js; else delete P.saved[o.key]; }
  setPState('saving');
  P.queue = P.queue.then(async () => {
    for (const o of ops) {
      const ref = P.db.doc(o.c + '/' + o.id);
      if (o.t === 'set') await ref.set(JSON.parse(o.js)); else await ref.delete();
    }
    setPState('synced');
  }).catch((e) => {
    if (e && e.code === 'invalid_argument') { P.readOnly = true; setPState('readonly'); }
    else setPState('offline');
    P.onError(e || {});
    resync();
  });
}

/* ponowne wczytanie z bazy po błędzie zapisu */
async function resync() {
  if (!P.db) return;
  try {
    const remote = await readRemote();
    if (remote) { adoptRemote(remote); P.onRemote(); }
  } catch (e) { /* zostaje stan lokalny */ }
}

function withTimeout(p, ms) {
  return new Promise((res, rej) => { const t = setTimeout(() => rej({ code: 'timeout' }), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });
}

async function readRemote() {
  const snaps = await withTimeout(Promise.all(COLS.map((c) => P.db.collection(c).get())), 12000);
  const remote = emptyState();
  snaps.forEach((snap, i) => snap.docs.forEach((d) => { remote[COLS[i]][d.id] = JSON.parse(JSON.stringify(d.data())); }));
  return remote;
}

function adoptRemote(remote) {
  S = remote;
  markSaved();
}

function applySnapshot(col, snap) {
  let changed = false;
  for (const ch of snap.docChanges()) {
    const id = ch.doc.id, key = col + '/' + id;
    if (ch.type === 'removed') {
      if (S[col][id] !== undefined && canon(S[col][id]) === P.saved[key]) { delete S[col][id]; delete P.saved[key]; changed = true; }
      continue;
    }
    const data = JSON.parse(JSON.stringify(ch.doc.data()));
    const rjs = canon(data);
    if (P.saved[key] === rjs) continue;                       // echo własnego zapisu lub brak zmiany
    if (S[col][id] !== undefined && canon(S[col][id]) !== P.saved[key]) continue; // lokalna, niezapisana zmiana wygrywa
    S[col][id] = data; P.saved[key] = rjs; changed = true;
  }
  if (changed) P.onRemote();
}

async function initShared(db, canWrite) {
  P.db = db; P.mode = 'shared'; setPState('connecting');
  try {
    const remote = await readRemote();
    if (remote.meta.seeded && remote.meta.seeded.v === SEED_VERSION) {
      adoptRemote(remote);
    } else {
      /* pierwsze uruchomienie albo starsza wersja danych: wspólna baza dostaje aktualne dane demonstracyjne,
         a dokumenty starej wersji są usuwane */
      if (canWrite === false) { P.mode = 'local'; setPState('readonly'); return false; }
      adoptRemote(remote);
      S = makeSeed();
      flush();
    }
    COLS.forEach((c) => db.collection(c).onSnapshot((snap) => applySnapshot(c, snap), () => setPState('offline')));
    if (canWrite === false) { P.readOnly = true; setPState('readonly'); } else setPState('synced');
    return true;
  } catch (e) {
    P.mode = 'local'; P.db = null; setPState('offline');
    return false;
  }
}

function loadLocal() {
  let ok = false;
  try {
    const raw = lsGet(LS_DATA);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.boards && d.cards && d.lists && d.meta && d.meta.seeded && d.meta.seeded.v === SEED_VERSION) { S = Object.assign(emptyState(), d); ok = true; }
    }
  } catch (e) { /* uszkodzone dane — zaczynamy od nowa */ }
  if (!ok) S = makeSeed();
  markSaved();
  if (!ok) lsSet(LS_DATA, JSON.stringify(S));
}

function resetDemo() {
  S = makeSeed();
  flush();
}

/* ---------- zmiany stanu: wszystko przechodzi przez commit() ---------- */
function commit(opts) {
  schedule();
  if (typeof requestRender === 'function') requestRender(opts);
}

/* ---------- selektory ---------- */
const PROJECT_NAME = 'Menedżerski Panel Zarządzania';
const BOSS = { id: 'boss', name: 'Szef', color: '#c42b8a', role: 'Kierownictwo' };
const members = () => (S.meta.members && S.meta.members.list) || [];
const memberById = (id) => members().find((m) => m.id === id) || (id === 'boss' ? BOSS : null);
const project = () => S.meta.project || { name: PROJECT_NAME, scopeIn: [], scopeOut: [] };
const mainBoard = () => S.boards.b1 || Object.values(S.boards)[0] || null;
const statusLists = () => sortBy(Object.values(S.lists).filter((l) => l.kind === 'status' && !l.archived), (l) => l.pos);
const listByTone = (tone) => statusLists().find((l) => l.tone === tone) || null;
const cardsOf = (lid) => sortBy(Object.values(S.cards).filter((c) => c.listId === lid && !c.archived), (c) => c.pos);
const isTask = (c) => !c.archived && !c.stage && !!S.lists[c.listId] && S.lists[c.listId].kind === 'status' && !S.lists[c.listId].archived;
const taskCards = () => Object.values(S.cards).filter(isTask);
const stageCards = () => sortBy(Object.values(S.cards).filter((c) => !c.archived && c.stage), (c) => c.stage);
const briefCards = () => sortBy(Object.values(S.cards).filter((c) => !c.archived && S.lists[c.listId] && S.lists[c.listId].kind === 'brief'), (c) => c.pos);
const costCards = () => sortBy(Object.values(S.cards).filter((c) => !c.archived && S.lists[c.listId] && S.lists[c.listId].kind === 'cost'), (c) => c.pos);
const meetingsSorted = () => sortBy(Object.values(S.meetings), (m) => m.date + ' ' + m.start);
const risksSorted = () => sortBy(Object.values(S.risks), (r) => -(r.p * r.w) || r.code);
const labelOf = (board, id) => ((board || mainBoard() || {}).labels || []).find((l) => l.id === id);
const cardTone = (c) => (S.lists[c.listId] || {}).tone || null;
const isHoldList = (l) => !!l && l.tone === 'hold';
const isDoneList = (l) => !!l && l.tone === 'done';
const boardCards = () => taskCards();
const allActiveCards = () => taskCards();
const nextPos = (arr) => (arr.length ? arr[arr.length - 1].pos + 1024 : 1024);
const decisionsPending = () => sortBy(Object.values(S.cards).filter((c) => !c.archived && c.decision && c.decision.status === 'pending'), (c) => c.decision.asked || '');
const decisionsResolved = () => sortBy(Object.values(S.cards).filter((c) => !c.archived && c.decision && c.decision.status !== 'pending'), (c) => c.decision.at || '').reverse();

function cardProgress(c) {
  let t = 0, d = 0;
  for (const cl of c.checklists || []) for (const it of cl.items) { t++; if (it.done) d++; }
  return { total: t, done: d };
}
function dueState(c) {
  if (!c.due) return null;
  if (c.done) return 'done';
  const d = diffDays(c.due, todayStr());
  if (d < 0) return 'overdue';
  if (d <= 1) return 'soon';
  return 'ok';
}
function isCardClosed(c) {
  return !!c.done || isDoneList(S.lists[c.listId]);
}
function riskScore(r) { return r.p * r.w; }
function riskLevel(score) { return score >= 15 ? 'crit' : score >= 10 ? 'high' : score >= 5 ? 'mod' : 'low'; }
const RISK_LABEL = { crit: 'Krytyczny', high: 'Wysoki', mod: 'Umiarkowany', low: 'Niski' };

function logEvent(card, text, by = ui.me) {
  card.comments = card.comments || [];
  card.comments.push({ id: uid('ev'), by, text, ts: nowIso(), kind: 'event' });
  if (card.comments.length > 80) card.comments = card.comments.slice(-80);
}

/* operacje na kartach i listach */
function addCard(listId, title, extra = {}) {
  const list = S.lists[listId]; if (!list) return null;
  const id = uid('c');
  S.cards[id] = {
    id, boardId: list.boardId, listId, pos: nextPos(cardsOf(listId)), title: title.trim(), desc: '', labels: [], members: [],
    due: null, done: list.tone === 'done', checklists: [], attachments: [], comments: [], pinChecklist: false, archived: false,
    created: nowIso(), updated: nowIso(), ...extra,
  };
  logEvent(S.cards[id], `utworzono zadanie (status: ${list.title})`);
  return S.cards[id];
}
/* zmiana statusu zadania = przeniesienie na listę statusu */
function setStatus(card, listId, by = ui.me) {
  const list = S.lists[listId]; if (!list || card.listId === listId) return;
  const from = (S.lists[card.listId] || {}).title || '—';
  card.listId = listId; card.boardId = list.boardId; card.pos = nextPos(cardsOf(listId).filter((c) => c.id !== card.id));
  card.done = list.tone === 'done';
  card.updated = nowIso();
  logEvent(card, `zmieniono status: „${from}” → „${list.title}”`, by);
}
function deleteCard(id) { delete S.cards[id]; for (const m of Object.values(S.meetings)) for (const it of m.items || []) if (it.cardId === id) it.cardId = null; }
function exportJSON() { return JSON.stringify({ app: 'Menedżerski Panel Zarządzania', version: 1, exported: new Date().toISOString(), data: S }, null, 2); }
function importJSON(text) {
  const j = JSON.parse(text);
  const d = j && j.data ? j.data : j;
  if (!d || !d.boards || !d.lists || !d.cards) throw new Error('To nie jest plik z danymi Menedżerskiego Panelu Zarządzania.');
  S = Object.assign(emptyState(), d);
  if (!S.meta.seeded) S.meta.seeded = { v: 1 };
  flush();
}
