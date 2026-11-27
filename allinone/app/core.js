/* A1O — data model: state, dates, recurring tasks, to-dos and the notification queue.
 * No DOM code here; the screens live in ui.js. */
'use strict';

const DATA = window.AIO_DATA || { sheets: [], seeds: {} };
const BRIDGE = window.AndroidBridge && window.AndroidBridge.aioSchedule ? window.AndroidBridge : null;
const LS_KEY = 'aio.v1';
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const ISO_SHORT = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const GROUP_ORDER = ['Ultimate Goal', 'Target', 'Acara', 'Jadwal harian', 'To Do Pulsek', 'Belajar', 'Mingguan', 'Bulanan', 'Proyek', 'Sosial', 'For Fun'];
const HORIZON_DAYS = 30;
const LONG_BUZZ = ['AaAaAa', 'AaAaBB', 'AaBBAa', 'AaBBBB', 'BBAaAa', 'BBAaBB', 'BBBBAa'];   // 7 buzzes × 3 s ≈ 20 s     // how far ahead notifications are handed to Android

/* ---------- dates ---------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isoDow = (d) => ((d.getDay() + 6) % 7) + 1;                 // 1 = Monday … 7 = Sunday
const mondayOf = (d) => addDays(d, 1 - isoDow(d));
const todayStr = () => ymd(new Date());
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const atTime = (d, hm) => { const [h, m] = hm.split(':').map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime(); };
const longDate = (d) => DAY_NAMES[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
const shortDate = (d) => DAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);

/* ---------- workbook content lookup ---------- */
const BLOCKS = {};        // block id -> block
const BLOCK_HOME = {};    // block id -> { sheet, section, title }
for (const sheet of DATA.sheets) {
  for (const section of sheet.sections) {
    let heading = section.title;
    for (const b of section.blocks) {
      if (b.t === 'h') heading = b.x;
      if (b.id) { BLOCKS[b.id] = b; BLOCK_HOME[b.id] = { sheet, section, title: b.title || heading }; }
    }
  }
}
const cleanTitle = (s) => String(s || '').replace(/^[^\p{L}\p{N}"'(]+/u, '').trim();

/* ---------- state ---------- */
let S = null;

function defaultReminders() {
  const seeded = DATA.seeds.reminders;
  if (seeded && seeded.length) return JSON.parse(JSON.stringify(seeded)).map((r) => Object.assign({ on: true }, r));
  return [
    { id: 'pagi', label: 'Pagi', icon: '🌅', time: '05:30', timeWE: '08:00', on: true, lines: ['Pelan-pelan di jalan, nggak usah buru-buru.', 'Berdoa dulu sebelum berangkat.'] },
    { id: 'siang', label: 'Siang', icon: '☀️', time: '12:00', timeWE: '12:00', on: true, lines: ['Pikir dulu sebelum ngomong.'] },
    { id: 'sore', label: 'Sore', icon: '🌇', time: '16:00', timeWE: '16:00', on: true, lines: ['Mandi dulu, baru yang lain.'] },
  ];
}

function defaultState() {
  return {
    v: 1, nid: 1, seeded: false,
    tasks: [],        // recurring and one-off calendar items
    marks: {},        // 'YYYY-MM-DD' -> { taskId: 1 (sudah) | 2 (belum) }
    todos: [],        // quick to-dos for tonight / tomorrow
    lists: {},        // block id -> edited copy of a workbook list
    picks: {},        // week (Monday date) -> { block id: { index: 1 } } for the per-weekday study picks
    notes: {},        // section id -> notes the user added
    grades: [],       // { id, date, subject, kind, score, note }
    pins: [],         // section ids pinned to the top of Hari ini
    photos: {},       // photo id -> JPEG data URL (shown where a note says [[foto:id]])
    pasted: [],       // notes filed by "Tempel catatan": { id, sec: section id, title, items, at }
    deadlines: [],    // { id, text, due: 'YYYY-MM-DD' | null, fast, done, created, doneAt }
    money: null,      // the Uang tab: { cfg, months } (see money.js)
    reminders: defaultReminders(),
    settings: { name: DATA.owner || '', theme: 'auto', snooze: 30, todoTime: '19:00', notif: true, gradeTarget: 0, onboarded: false },
  };
}

function loadState() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { raw = null; }
  if (!(raw && raw.v === 1) && DATA.backup) raw = JSON.parse(JSON.stringify(DATA.backup));   // first start: the backup bundled with this build
  S = Object.assign(defaultState(), raw && raw.v === 1 ? raw : {});
  S.settings = Object.assign(defaultState().settings, S.settings || {});
  S.lock = S.lock || null;
  const keyed = () => seedTasks().filter((t) => t.id.startsWith('sd:'));
  if (!S.seeded) {
    S.tasks = seedTasks().concat(S.tasks.filter((t) => t.src === 'user')); S.seeded = true; S.seedSeen = keyed().map((t) => t.id);
    if (!raw && DATA.seeds.demo) applyDemo(DATA.seeds.demo);
  }
  else {
    // An update can bring new keyed seed tasks (a one-off event, say); add each once, even if it was deleted later.
    const seen = (S.seedSeen = S.seedSeen || []);
    for (const t of keyed()) if (!seen.includes(t.id)) { seen.push(t.id); if (!S.tasks.some((x) => x.id === t.id)) S.tasks.push(t); }
  }
  // To-dos added in an app update: each one goes in once, even on a phone that already has data.
  const seenTodo = (S.todoSeen = S.todoSeen || []);
  for (const t of DATA.addTodos || []) if (!seenTodo.includes(t.key)) { seenTodo.push(t.key); S.todos.push({ id: 'u' + (S.nid++), x: t.x, date: t.date, slot: t.slot || 'malam', done: 0 }); }
  // A to-do list shipped with an update replaces the to-dos once. Old ones that are not on it go to Baru dihapus.
  const L = DATA.todoList;
  if (L && L.key && !seenTodo.includes(L.key)) {
    seenTodo.push(L.key);
    const keep = new Set(L.todos.map((t) => t.date + '|' + t.slot + '|' + t.x));
    for (const t of S.todos) if (!keep.has(t.date + '|' + t.slot + '|' + t.x)) trashPut('todo', t, t.x, 'To-do');
    const done = new Set(S.todos.filter((t) => t.done).map((t) => t.date + '|' + t.slot + '|' + t.x));
    S.todos = L.todos.map((t) => ({ id: 'u' + (S.nid++), x: t.x, date: t.date, slot: t.slot, done: done.has(t.date + '|' + t.slot + '|' + t.x) ? 1 : 0 }));
  }
  pruneOld();
}

/** Sample entries for a demo build, with dates relative to the first start. */
function applyDemo(demo) {
  const now = new Date(), day = (k) => ymd(addDays(now, k || 0));
  const monthBack = (m) => new Date(now.getFullYear(), now.getMonth() - m, 1);
  for (const t of demo.todos || []) S.todos.push({ id: uid(), x: t.x, date: day(t.day), slot: t.day ? 'pagi' : 'malam', done: t.done ? 1 : 0 });
  for (const n of demo.deadlines || []) S.deadlines.push({ id: uid(), text: n.text, due: n.day == null ? null : day(n.day), fast: !!n.fast, done: false, created: Date.now(), doneAt: 0 });
  for (const g of demo.grades || []) S.grades.push({ id: uid(), subject: g.s, kind: g.k || 'Ulangan', score: g.v, date: day(g.day), note: '' });
  // Today's timetable up to now is ticked, so the day looks in progress.
  const hm = nowHM();
  for (const it of dayItems(now)) if (it.t.src === 'tt' && it.t.time && it.t.time < hm && !/^tidur/i.test(it.t.title)) (S.marks[day(0)] = S.marks[day(0)] || {})[it.t.id] = 1;
  const m = demo.money;
  if (m) {
    const from = ymd(monthBack(3)).slice(0, 7);
    const items = m.items.map((i) => Object.assign({ id: uid(), repeat: 'monthly', day: 0, date: '', target: 0, from }, i));
    const byName = (n) => items.find((i) => i.name === n);
    const months = {};
    for (const [back, d, name, a, note] of m.tx) {
      const first = monthBack(back), last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const date = ymd(new Date(first.getFullYear(), first.getMonth(), Math.min(d, last)));
      if (date > day(0)) continue;
      const it = byName(name), mk = date.slice(0, 7);
      const tx = { id: uid(), d: date, t: it.group === 'income' ? 'in' : 'out', a, item: it.id, name, g: it.group, note: note || '' };
      if (it.day && a >= it.amount) tx.occ = mk;
      (months[mk] = months[mk] || { tx: [] }).tx.push(tx);
    }
    const lists = (m.lists || []).map((l) => ({ id: uid(), list: l.list, title: l.title, amount: l.amount || 0, date: l.day == null ? '' : day(l.day), done: false }));
    S.money = { cfg: { v: 1, currency: 'Rp', opening: m.opening || 0, goals: { needs: 50, wants: 30, future: 20 }, items, lists }, months };
  }
}

let saveTimer = null, syncTimer = null;
function save(opts) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } }, 150);
  if (!opts || opts.sync !== false) { clearTimeout(syncTimer); syncTimer = setTimeout(syncNotifications, 900); }
}
function saveNow() { clearTimeout(saveTimer); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
const uid = () => 'u' + (S.nid++);

function pruneOld() {
  const cutoff = ymd(addDays(new Date(), -120));
  for (const ds of Object.keys(S.marks)) if (ds < cutoff) delete S.marks[ds];
  const weekCut = ymd(addDays(new Date(), -28));
  for (const wk of Object.keys(S.picks)) if (wk < weekCut) delete S.picks[wk];
  const todoCut = ymd(addDays(new Date(), -7));
  S.todos = S.todos.filter((t) => !(t.done && t.date < todoCut));
  const dlCut = Date.now() - 60 * 864e5;
  S.deadlines = (S.deadlines || []).filter((n) => !(n.done && n.doneAt && n.doneAt < dlCut));
  // "Baru dihapus" keeps things 30 days. Entries from 1.9.2 held only a to-do ({ at, t }).
  S.trash = (S.trash || []).map((x) => (x.kind ? x : { id: 'x' + x.at.toString(36) + x.t.id, at: x.at, kind: 'todo', label: x.t.x, where: 'To-do', data: x.t }))
    .filter((x) => x.at > Date.now() - TRASH_DAYS * 864e5);
}

/* ---------- Baru dihapus: everything deleted can come back for 30 days ---------- */
const TRASH_DAYS = 30;
const TRASH_KINDS = {};   // kind -> { icon, name, restore(data) -> true | why it cannot come back }; filled in by bin.js and money.js
function trashPut(kind, data, label, where, pos) {
  const e = { id: 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), kind,
    label: String(label == null ? '' : label).slice(0, 400), where: where || '', data: JSON.parse(JSON.stringify(data)) };
  if (pos != null) e.pos = pos;   // where it was in its list, so it comes back to the same spot
  S.trash = [e].concat(S.trash || []).slice(0, 500);
  return e;
}
function trashRestore(id) {
  const list = S.trash || [], k = list.findIndex((e) => e.id === id);
  if (k < 0) return 'Sudah nggak ada di Baru dihapus';
  const e = list[k], kind = TRASH_KINDS[e.kind];
  const r = kind ? kind.restore(e.data, e.pos) : 'Yang ini nggak bisa dipulihkan';
  if (r === true) list.splice(k, 1);
  return r;
}
/** Puts something in "Baru dihapus" (after it has been taken out) and offers Urungkan. */
function trashed(kind, data, label, where, msg, pos) {
  const e = trashPut(kind, data, label, where, pos);
  save(); render();
  toast(msg || 'Dihapus', () => { trashRestore(e.id); });
  return e;
}

/* ---------- seeding the calendar from the workbook ---------- */
function prettyTitle(s) {
  const star = /\*$/.test(s);
  s = s.replace(/\*$/, '').trim();
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) s = s.charAt(0) + s.slice(1).toLowerCase();
  return star ? s + ' — wajib fokus' : s;
}

function seedTasks() {
  if (DATA.backup) return JSON.parse(JSON.stringify(DATA.backup.tasks.filter((t) => t.src !== 'user')));
  const tasks = [];
  let ord = 0;
  const push = (t) => { t.ord = ord++; t.notify = t.notify !== false; tasks.push(t); };
  const seeds = DATA.seeds || {};

  // Hourly timetable: one task per line, merged over consecutive hours and over days that match.
  if (seeds.timetable) {
    const lines = new Map();
    for (let day = 1; day <= 7; day++) {
      for (const b of seeds.timetable[day] || []) {
        const parts = b.x.split('\n').map((x) => x.trim()).filter(Boolean);
        for (const line of parts) {
          if (!lines.has(line)) lines.set(line, { pos: parts.indexOf(line) });
          const hours = (lines.get(line)[day] = lines.get(line)[day] || []);
          for (let h = b.s; h < b.e; h++) hours.push(h);
        }
      }
    }
    let n = 0;
    for (const [line, perDay] of lines) {
      const runs = new Map();                       // 'start-end' -> [days]
      for (const day of Object.keys(perDay)) {
        if (day === 'pos') continue;
        const hs = perDay[day].sort((a, b) => a - b);
        let s = hs[0], prev = hs[0];
        const close = () => {
          if (/^tidur$/i.test(line) && s === 0) return;          // the tail of last night's sleep
          const key = s + '-' + (prev + 1);
          if (!runs.has(key)) runs.set(key, []);
          runs.get(key).push(Number(day));
        };
        for (let i = 1; i < hs.length; i++) { if (hs[i] !== prev + 1) { close(); s = hs[i]; } prev = hs[i]; }
        close();
      }
      for (const [key, days] of runs) {
        const [s, e] = key.split('-').map(Number);
        let time = pad(s) + ':00';
        const m = line.match(/jam (\d{1,2})[:.](\d{2})/i);      // "Berangkat jam 5:40" inside the 05.00 block
        if (m && Number(m[1]) === s) time = pad(Number(m[1])) + ':' + m[2];
        const longBlock = e - s > 1;
        push({
          id: 'tt' + (n++), src: 'tt', group: 'Jadwal harian', title: prettyTitle(line), time,
          end: longBlock && e < 24 ? pad(e) + ':00' : '', rep: { k: 'w', days },
          notify: !/^(sekolah|have fun)\b/i.test(line),
        });
        tasks[tasks.length - 1].ord = perDay.pos * 1000 + n;      // keep the order the lines have inside their hour
      }
    }
  }

  const pulsek = BLOCKS[seeds.pulsek];
  if (pulsek) {
    pulsek.items.forEach((it, i) => push({ id: 'pk' + i, src: 'pulsek', group: 'To Do Pulsek', title: it.x, time: '16:10', rep: { k: 'w', days: [1, 2, 3, 4, 5] } }));
  }

  for (const gid of seeds.grids || []) {
    const g = BLOCKS[gid];
    if (!g) continue;
    g.items.forEach((it, i) => {
      const base = { src: g.kind, ref: gid, title: it.x, cat: it.cat || '', freq: it.freq || '', fixed: it.fixed || '', dur: Number(it.dur) || 0 };
      if (g.kind === 'weekly') {
        const days = it.days || [];
        const weekend = days.length && days.every((d) => d >= 6);
        const named = it.x.match(/jam (\d{1,2})[:.](\d{2})/i);          // "Morning ride … jam 5:30"
        const time = named ? pad(Number(named[1])) + ':' + named[2] : weekend ? '13:00' : '19:30';
        push(Object.assign(base, { id: 'wk' + i, group: 'Mingguan', time: days.length ? time : '', rep: days.length ? { k: 'w', days } : { k: 'none' } }));
      } else if (g.kind === 'monthly') {
        push(Object.assign(base, { id: 'mo' + i, group: 'Bulanan', time: it.dom ? '19:30' : '', rep: it.dom ? { k: 'm', dom: it.dom } : { k: 'none' } }));
      } else {
        push(Object.assign(base, { id: (g.kind === 'fun' ? 'fn' : 'gx') + i, group: g.kind === 'fun' ? 'For Fun' : cleanTitle(BLOCK_HOME[gid].title), time: '', rep: { k: 'none' } }));
      }
    });
  }

  (seeds.tasks || []).forEach((t, i) => {
    const rep = Object.assign({}, t.rep || { k: 'none' });
    if (rep.k === 'nw' && !rep.anchor) rep.anchor = ymd(mondayOf(new Date()));
    push(Object.assign({}, t, { id: t.key ? 'sd:' + t.key : 'sd' + i, src: 'seed', rep, group: t.group || 'Acara', time: t.time || '' }));
  });
  return tasks;
}

/** Rebuilds everything that came from the workbook, keeping what the user added by hand. */
function reseedTasks() {
  S.tasks = seedTasks().concat(S.tasks.filter((t) => t.src === 'user'));
  save();
}

/* ---------- recurring tasks ---------- */
function occursOn(t, d) {
  const r = t.rep || { k: 'none' };
  if (r.from || r.until) { const ds = ymd(d); if ((r.from && ds < r.from) || (r.until && ds > r.until)) return false; }
  switch (r.k) {
    case 'd': return true;
    case 'w': return r.days.includes(isoDow(d));
    case 'nw': {
      if (!r.days.includes(isoDow(d))) return false;
      const weeks = Math.round((mondayOf(d) - mondayOf(parseYmd(r.anchor))) / (7 * 864e5));
      return weeks >= 0 && weeks % (r.n || 2) === 0;
    }
    case 'm': {
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(r.dom, last);
    }
    case 'once': return r.date === ymd(d);
    default: return false;
  }
}

function repLabel(t) {
  const r = t.rep || { k: 'none' };
  const days = (ds) => ds.length === 7 ? 'Tiap hari' : String(ds) === '1,2,3,4,5' ? 'Sen–Jum' : String(ds) === '6,7' ? 'Sab–Min' : ds.map((d) => ISO_SHORT[d]).join(', ');
  let s;
  switch (r.k) {
    case 'd': s = 'Tiap hari'; break;
    case 'w': s = days(r.days); break;
    case 'nw': s = 'Tiap ' + (r.n || 2) + ' minggu · ' + days(r.days); break;
    case 'm': s = 'Tiap tgl ' + r.dom; break;
    case 'once': s = shortDate(parseYmd(r.date)); break;
    default: s = 'Tanpa jadwal';
  }
  if (r.k !== 'once' && r.from && r.from > todayStr()) s += ' · mulai ' + shortDate(parseYmd(r.from));
  if (r.k !== 'once' && r.until) s += ' · s/d ' + shortDate(parseYmd(r.until));
  return s + (t.time ? ' · ' + t.time + (t.end ? '–' + t.end : '') : '');
}

const groupRank = (g) => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? GROUP_ORDER.length : i; };

/** Everything on a date: tasks that fall on it, plus unscheduled ones that were ticked that day. */
function dayItems(d) {
  const marks = S.marks[ymd(d)] || {};
  const out = [];
  for (const t of S.tasks) {
    const occ = occursOn(t, d);
    if (occ || marks[t.id]) out.push({ t, mark: marks[t.id] || 0, extra: !occ });
  }
  // Timed items first, then the day's untimed ones, then anything ticked on a day it was not planned for.
  const slot = (i) => (i.extra ? '99:99' : i.t.time || '99:98');
  out.sort((a, b) => slot(a).localeCompare(slot(b)) || groupRank(a.t.group) - groupRank(b.t.group) || (a.t.ord || 0) - (b.t.ord || 0));
  return out;
}

function setMark(ds, id, v) {
  const day = (S.marks[ds] = S.marks[ds] || {});
  if (!v || day[id] === v) delete day[id]; else day[id] = v;
  if (!Object.keys(day).length) delete S.marks[ds];
  save();
}

/** What the progress ring counts: real tasks only. Routine blocks (sleep, waking up, school, free time) are left out,
 *  and the whole after-school list counts as one task that is done when every item in it is ticked. */
const ROUTINE = /^(tidur|bangun|berangkat|sekolah|have fun|main sama kucing)\b/i;
function countable(items) {
  let total = 0, done = 0;
  const pulsek = items.filter((i) => i.t.src === 'pulsek' && !i.extra);
  for (const i of items) {
    if (i.t.src === 'pulsek' || i.t.notify === false || ROUTINE.test(i.t.title)) continue;
    total++; if (i.mark === 1) done++;
  }
  if (pulsek.length) { total++; if (pulsek.every((i) => i.mark === 1)) done++; }
  return { total, done };
}
function dayProgress(d) {
  const items = dayItems(d);
  const ds = ymd(d);
  const events = items.filter((i) => i.t.rep && i.t.rep.k === 'once').length + S.deadlines.filter((n) => !n.done && n.due === ds).length;
  const c = countable(items);
  return { total: c.total, done: c.done, events };
}

function monthCount(taskId, d) {
  const prefix = ymd(d).slice(0, 8);
  let n = 0;
  for (const ds of Object.keys(S.marks)) if (ds.startsWith(prefix) && S.marks[ds][taskId] === 1) n++;
  return n;
}

/* ---------- quick to-dos (tonight / tomorrow) ---------- */
function addTodo(text, when) {
  text = text.trim();
  if (!text) return;
  const date = when === 'besok' ? ymd(addDays(new Date(), 1)) : todayStr();
  S.todos.push({ id: uid(), x: text, date, slot: when === 'besok' ? 'pagi' : 'malam', done: 0 });
  save();
}
const todosOn = (ds) => S.todos.filter((t) => t.date === ds);
const todosOverdue = () => { const t = todayStr(); return S.todos.filter((x) => x.date < t && !x.done); };

/* ---------- lists that came from the workbook ---------- */
const listItems = (block) => S.lists[block.id] || block.items;
function editList(block, fn) {
  if (!S.lists[block.id]) S.lists[block.id] = JSON.parse(JSON.stringify(block.items));
  fn(S.lists[block.id]);
  save({ sync: false });
}
const weekKey = () => ymd(mondayOf(new Date()));
const picksFor = (block) => ((S.picks[weekKey()] || {})[block.id]) || {};
function togglePick(block, i) {
  const wk = (S.picks[weekKey()] = S.picks[weekKey()] || {});
  const p = (wk[block.id] = wk[block.id] || {});
  if (p[i]) delete p[i]; else p[i] = 1;
  save({ sync: false });
}

/* ---------- deadline notes ---------- */
const DL_LEVELS = [['overdue', 'Telat'], ['urgent', 'Mendesak'], ['soon', 'Segera'], ['later', 'Nanti'], ['none', 'Tanpa tanggal']];
const DL_LABEL = Object.fromEntries(DL_LEVELS);
const DL_RANK = Object.fromEntries(DL_LEVELS.map((l, i) => [l[0], i]));
const dlDays = (due, now) => (due ? Math.round((parseYmd(due) - startOfDay(now)) / 864e5) : null);
/** Overdue, then today / tomorrow, then within a week, then later. "Fast" lifts a note one level. */
function dlLevel(days, fast) {
  if (days === null) return fast ? 'soon' : 'none';
  if (days < 0) return 'overdue';
  if (days <= 1) return 'urgent';
  if (days <= 7) return fast ? 'urgent' : 'soon';
  return fast ? 'soon' : 'later';
}
function dlList(now) {
  now = now || new Date();
  return S.deadlines.map((n) => { const days = dlDays(n.due, now); return Object.assign({}, n, { days, level: dlLevel(days, n.fast) }); });
}
function dlCompare(a, b) {
  if (a.level !== b.level) return DL_RANK[a.level] - DL_RANK[b.level];
  const da = a.days === null ? Infinity : a.days, db = b.days === null ? Infinity : b.days;
  if (da !== db) return da - db;
  if (!!a.fast !== !!b.fast) return a.fast ? -1 : 1;
  return (a.created || 0) - (b.created || 0);
}
const dlOpen = (now) => dlList(now).filter((n) => !n.done).sort(dlCompare);
function dlCount(days) {
  if (days === null) return ['–', 'tanpa tgl'];
  if (days < 0) return [String(-days), 'hari telat'];
  if (days === 0) return ['0', 'hari ini'];
  return [String(days), 'hari lagi'];
}
function dlPhrase(days) {
  if (days === null) return 'tanpa tanggal';
  if (days < 0) return 'telat ' + -days + ' hari';
  if (days === 0) return 'hari ini';
  if (days === 1) return 'besok';
  return days + ' hari lagi';
}

/* ---------- notifications ---------- */
/** The reminder whose time came last before now (today's weekday or weekend time). */
function reminderFor(date) {
  const hm = pad(date.getHours()) + ':' + pad(date.getMinutes()), we = isoDow(date) >= 6;
  const on = S.reminders.filter((r) => r.lines.length);
  if (!on.length) return S.reminders[0];
  const at = (r) => (we && r.timeWE) || r.time || '00:00';
  const past = on.filter((r) => at(r) <= hm).sort((a, b) => at(b).localeCompare(at(a)));
  return past[0] || on.slice().sort((a, b) => at(b).localeCompare(at(a)))[0];
}

/** The list Android shows: reminders, and task groups whose items can be answered from the notification. */
function buildQueue() {
  const now = Date.now(), out = [];
  const today = startOfDay(new Date());
  const pagi = S.reminders.find((r) => r.id === 'pagi');
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = addDays(today, i), ds = ymd(d), weekend = isoDow(d) >= 6;
    const timeOf = (r) => (weekend && r.timeWE) || r.time;

    for (const r of S.reminders) {
      if (!r.on || !timeOf(r) || !r.lines.length) continue;
      const at = atTime(d, timeOf(r));
      const note = { id: 'r|' + ds + '|' + r.id, at, ch: 'reminders', title: (r.icon || '🔔') + ' Pengingat ' + r.label.toLowerCase(), body: r.lines.map((l) => '• ' + stripPhotos(l)).join('\n') };
      if (at > now) out.push(note);
      // "Getar ±20 detik": the same notification again every 3 s. The suffixes ("AaAaAa", "AaAaBB", …) all share one
      // Java hashCode, so Android replaces the one notification instead of stacking copies. Once the first one has
      // fired, opening the app re-syncs and drops the rest.
      if (S.settings.longBuzz !== false && at > now) {
        for (let k = 1; k < LONG_BUZZ.length; k++) out.push(Object.assign({}, note, { id: note.id + LONG_BUZZ[k], at: at + k * 3000 }));
        note.id += LONG_BUZZ[0];
      }
    }

    // Detail Belajar: that weekday's study list, at the Belajar reminder's time (16:15 by default).
    if (S.settings.studyNotif !== false) {
      const sb = Object.values(BLOCKS).find((b) => b.t === 'check' && b.day === isoDow(d));
      const br = S.reminders.find((r) => r.id === 'belajar');
      const at = atTime(d, (br && timeOf(br)) || '16:15');
      if (sb && at > now) {
        const names = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        const its = listItems(sb).map((x) => '• ' + stripPhotos(String(x.x).split('\n')[0]));
        if (its.length) out.push({ id: 'p|' + ds, at: at + 60000, ch: 'reminders', title: '📚 Belajar hari ini (' + names[isoDow(d) - 1] + ')', body: its.join('\n') });
      }
    }

    const groups = new Map();
    for (const it of dayItems(d)) {
      const t = it.t;
      // Untimed entries can still ask for a notification at a set hour (t.at); timed ones can come early (t.before minutes).
      const hm = t.time || t.at;
      if (it.extra || !hm || t.notify === false || it.mark === 1) continue;
      const before = t.time ? t.before || 0 : 0;
      const group = t.group || 'Jadwal', key = hm + '|' + group + (before ? '|' + before : '');
      if (!groups.has(key)) groups.set(key, { time: hm, before, group, items: [] });
      groups.get(key).items.push({ k: ds + '|' + t.id, x: t.title });
    }
    for (const [key, g] of groups) {
      const at = atTime(d, g.time) - g.before * 60000;
      const soon = !g.before ? '' : g.before >= 1440 ? ' (besok)' : g.before >= 60 ? ' (' + g.before / 60 + ' jam lagi)' : ' (' + g.before + ' menit lagi)';
      if (at > now) out.push({ id: 't|' + ds + '|' + key, at, ch: 'tasks', title: g.time + ' · ' + g.group + soon, items: g.items });
    }

    // Deadlines: the evening before, and every morning from the due date until they are done.
    const dls = S.deadlines.filter((n) => !n.done && n.due);
    const dueTomorrow = dls.filter((n) => n.due === ymd(addDays(d, 1)));
    const dueNow = dls.filter((n) => n.due <= ds).sort((a, b) => b.due.localeCompare(a.due));
    if (dueTomorrow.length) {
      const at = atTime(d, S.settings.todoTime || '19:00') + 120000;
      if (at > now) out.push({ id: 'd|' + ds + '|besok', at, ch: 'tasks', title: '⏰ Deadline besok', items: dueTomorrow.map((n) => ({ k: 'dl|' + n.id, x: n.text })) });
    }
    if (dueNow.length) {
      const at = atTime(d, pagi && timeOf(pagi) ? timeOf(pagi) : '06:00') + 120000;
      const label = (n) => (n.due === ds ? n.text : n.text + ' — telat ' + Math.round((d - parseYmd(n.due)) / 864e5) + ' hari');
      if (at > now) out.push({ id: 'd|' + ds + '|hari', at, ch: 'tasks', title: '⏰ Deadline hari ini', items: dueNow.map((n) => ({ k: 'dl|' + n.id, x: label(n) })) });
    }

    if (window.Money) Money.queue(d, ds, now, out);

    const open = todosOn(ds).filter((t) => !t.done);
    const morning = open.filter((t) => t.slot === 'pagi'), evening = open.filter((t) => t.slot !== 'pagi');
    const asItems = (list) => list.map((t) => ({ k: 'todo|' + t.id, x: stripPhotos(t.x) }));
    if (morning.length) {
      const at = atTime(d, pagi && timeOf(pagi) ? timeOf(pagi) : '06:00') + 60000;
      if (at > now) out.push({ id: 'q|' + ds + '|pagi', at, ch: 'tasks', title: '📝 To-do hari ini', items: asItems(morning) });
    }
    if (evening.length) {
      const at = atTime(d, S.settings.todoTime || '19:00');
      if (at > now) out.push({ id: 'q|' + ds + '|malam', at, ch: 'tasks', title: '🌙 To-do malam ini', items: asItems(evening) });
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

function doneKeys() {
  const keys = [];
  for (const ds of [todayStr(), ymd(addDays(new Date(), -1))]) {
    const m = S.marks[ds] || {};
    for (const id of Object.keys(m)) if (m[id] === 1) keys.push(ds + '|' + id);
  }
  for (const t of S.todos) if (t.done) keys.push('todo|' + t.id);
  for (const n of S.deadlines) if (n.done) keys.push('dl|' + n.id);
  if (window.Money) keys.push(...Money.doneKeys());
  return keys;
}

let extraQueue = [];      // one-shot entries (the "test notification" button)
function syncNotifications() {
  if (!BRIDGE) return;
  const queue = buildQueue().concat(extraQueue.filter((e) => e.at > Date.now())).sort((a, b) => a.at - b.at);
  try {
    BRIDGE.aioSchedule(JSON.stringify({ queue, done: doneKeys(), snooze: Number(S.settings.snooze) || 0, on: S.settings.notif !== false }));
  } catch (e) { /* bridge unavailable */ }
}

/** Answers given from notifications while the page was closed (or open): { key: 1 | 2 }. */
function takeNativeResults() {
  if (!BRIDGE) return false;
  let res = {};
  try { res = JSON.parse(BRIDGE.aioTakeResults() || '{}'); } catch (e) { res = {}; }
  const keys = Object.keys(res);
  for (const key of keys) {
    const v = res[key];
    if (key.startsWith('pay|') || key.startsWith('ml|')) {
      if (window.Money) Money.result(key, v);
    } else if (key.startsWith('dl|')) {
      const n = S.deadlines.find((x) => x.id === key.slice(3));
      if (n && v === 1) { n.done = true; n.doneAt = Date.now(); }
    } else if (key.startsWith('todo|')) {
      const t = S.todos.find((x) => x.id === key.slice(5));
      if (t && v === 1) { t.done = 1; t.doneAt = Date.now(); }
    } else {
      const cut = key.indexOf('|');
      const ds = key.slice(0, cut), id = key.slice(cut + 1);
      // "Belum" from a notification never undoes something already ticked in the app.
      const day = S.marks[ds] || {};
      if (S.tasks.some((t) => t.id === id) && !(v === 2 && day[id] === 1)) { (S.marks[ds] = day)[id] = v; }
    }
  }
  if (keys.length) save();
  return keys.length > 0;
}

function nativeStatus() {
  if (!BRIDGE) return null;
  try { return JSON.parse(BRIDGE.aioStatus()); } catch (e) { return null; }
}

/* ---------- backup ---------- */
function exportData() {
  return JSON.stringify({ app: 'all-in-one', name: 'A1O', exported: new Date().toISOString(), state: S });
}
function importData(text) {
  const o = JSON.parse(text);
  const st = o && (o.app === 'all-in-one' || o.app === 'a1o') ? o.state : null;
  if (!st || st.v !== 1 || !Array.isArray(st.tasks)) throw new Error('Bukan file backup A1O / All in One.');
  const lock = S.lock;
  S = Object.assign(defaultState(), st);
  if (!S.lock) S.lock = lock;          // restoring an old backup keeps the PIN set on this phone
  S.settings = Object.assign(defaultState().settings, st.settings || {});
  if (window.Money) Money.reset();
  saveNow();
  syncNotifications();
}
