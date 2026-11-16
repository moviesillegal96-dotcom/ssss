/* All in One — data model: state, dates, recurring tasks, to-dos and the notification queue.
 * No DOM code here; the screens live in ui.js. */
'use strict';

const DATA = window.AIO_DATA || { sheets: [], seeds: {} };
const BRIDGE = window.AndroidBridge && window.AndroidBridge.aioSchedule ? window.AndroidBridge : null;
const LS_KEY = 'aio.v1';
const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const ISO_SHORT = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const GROUP_ORDER = ['Acara', 'Jadwal harian', 'To Do Pulsek', 'Mingguan', 'Bulanan', 'Sosial', 'For Fun'];
const HORIZON_DAYS = 30;     // how far ahead notifications are handed to Android

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
    deadlines: [],    // { id, text, due: 'YYYY-MM-DD' | null, fast, done, created, doneAt }
    money: null,      // the Uang tab: { cfg, months } (see money.js)
    reminders: defaultReminders(),
    settings: { name: DATA.owner || '', theme: 'auto', snooze: 30, todoTime: '19:00', notif: true, gradeTarget: 0, onboarded: false },
  };
}

function loadState() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { raw = null; }
  S = Object.assign(defaultState(), raw && raw.v === 1 ? raw : {});
  S.settings = Object.assign(defaultState().settings, S.settings || {});
  if (!S.seeded) { S.tasks = seedTasks().concat(S.tasks.filter((t) => t.src === 'user')); S.seeded = true; }
  pruneOld();
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
}

/* ---------- seeding the calendar from the workbook ---------- */
function prettyTitle(s) {
  const star = /\*$/.test(s);
  s = s.replace(/\*$/, '').trim();
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) s = s.charAt(0) + s.slice(1).toLowerCase();
  return star ? s + ' — wajib fokus' : s;
}

function seedTasks() {
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
      const base = { src: g.kind, ref: gid, title: it.x, cat: it.cat || '', freq: it.freq || '', dur: Number(it.dur) || 0 };
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
    push(Object.assign({}, t, { id: 'sd' + i, src: 'seed', rep, group: t.group || 'Acara', time: t.time || '' }));
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
  return s + (t.time ? ' · ' + t.time : '');
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

function dayProgress(d) {
  const items = dayItems(d);
  const ds = ymd(d);
  const events = items.filter((i) => i.t.rep && i.t.rep.k === 'once').length + S.deadlines.filter((n) => !n.done && n.due === ds).length;
  return { total: items.length, done: items.filter((i) => i.mark === 1).length, events };
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
function reminderFor(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  const id = h < 11 ? 'pagi' : h < 15 ? 'siang' : 'sore';
  return S.reminders.find((r) => r.id === id) || S.reminders[0];
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
      if (at > now) out.push({ id: 'r|' + ds + '|' + r.id, at, ch: 'reminders', title: (r.icon || '🔔') + ' Pengingat ' + r.label.toLowerCase(), body: r.lines.map((l) => '• ' + l).join('\n') });
    }

    const groups = new Map();
    for (const it of dayItems(d)) {
      const t = it.t;
      if (it.extra || !t.time || t.notify === false || it.mark === 1) continue;
      const group = t.group || 'Jadwal', key = t.time + '|' + group;
      if (!groups.has(key)) groups.set(key, { time: t.time, group, items: [] });
      groups.get(key).items.push({ k: ds + '|' + t.id, x: t.title });
    }
    for (const [key, g] of groups) {
      const at = atTime(d, g.time);
      if (at > now) out.push({ id: 't|' + ds + '|' + key, at, ch: 'tasks', title: g.time + ' · ' + g.group, items: g.items });
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
    const asItems = (list) => list.map((t) => ({ k: 'todo|' + t.id, x: t.x }));
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
  return JSON.stringify({ app: 'all-in-one', exported: new Date().toISOString(), state: S });
}
function importData(text) {
  const o = JSON.parse(text);
  const st = o && o.app === 'all-in-one' ? o.state : null;
  if (!st || st.v !== 1 || !Array.isArray(st.tasks)) throw new Error('Bukan file backup All in One.');
  S = Object.assign(defaultState(), st);
  S.settings = Object.assign(defaultState().settings, st.settings || {});
  if (window.Money) Money.reset();
  saveNow();
  syncNotifications();
}
