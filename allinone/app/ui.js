/* All in One — screens. Renders HTML strings into #view and handles clicks by data-act. */
'use strict';

const $ = (sel, el) => (el || document).querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shortUrl = (u) => { const s = u.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, ''); return s.length > 38 ? s.slice(0, 37) + '…' : s; };
const rich = (text) => esc(text)
  .replace(/https?:\/\/[^\s<]+/g, (u) => { const tail = (u.match(/[).,;]+$/) || [''])[0]; const url = tail ? u.slice(0, -tail.length) : u; return `<a href="${url}" target="_blank" rel="noopener">${shortUrl(url.replace(/&amp;/g, '&'))}</a>${tail}`; })
  .replace(/\n/g, '<br>');
const mostlyCaps = (s) => { const l = s.match(/\p{L}/gu) || []; return l.length > 2 && l.filter((c) => c === c.toUpperCase()).length / l.length >= 0.7; };
const titleCase = (s) => (mostlyCaps(s) ? s.toLowerCase().replace(/(^|[\s(/&-])([a-zà-ÿ])/g, (m, a, c) => a + c.toUpperCase()) : s);
const isArabic = (s) => (s.match(/[؀-ۿ]/g) || []).length > s.length * 0.4;
const dayIdx = (h) => { const i = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'].indexOf(String(h).trim().toLowerCase()); return i < 0 ? null : i + 1; };
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  today: svg('<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5.5"/>'),
  cal: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  todo: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2.2M3.5 12l1 1 2-2.2M3.5 18l1 1 2-2.2"/>'),
  lib: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
  more: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  money: svg('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10.5h18M16 15h2"/>'),
  back: svg('<path d="m14.5 5-7 7 7 7"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
};
const TABS = [['today', 'Hari ini', ICON.today], ['cal', 'Kalender', ICON.cal], ['todo', 'To-Do', ICON.todo], ['money', 'Uang', ICON.money], ['lib', 'All in 1', ICON.lib], ['more', 'Lainnya', ICON.more]];

const SECTIONS = {};
for (const sheet of DATA.sheets) for (const section of sheet.sections) SECTIONS[section.id] = { sheet, section };

const UI = {
  tab: 'today', stack: [], scroll: [],
  cal: { sel: todayStr(), start: todayStr(), mode: 'week', month: todayStr().slice(0, 7) },
  rem: null, open: {}, edit: {}, q: '', dayTab: 0, draft: null, draftId: null,
  todoSeg: 'todo', undo: null,
  dl: { text: '', due: '', fast: false, editId: null, filter: 'all', doneOpen: false },
};
const VIEWS = {}, ACT = {}, FORMS = {}, CHANGE = {};

/* ---------- shell ---------- */
function applyTheme() {
  const t = S.settings.theme;
  const dark = t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0d111c' : '#f3f5fa';
}

function render() {
  const top = UI.stack[UI.stack.length - 1];
  const view = top || { v: UI.tab };
  $('#view').innerHTML = VIEWS[view.v](view);
  $('#tabs').innerHTML = `<div class="in">${TABS.map(([id, label, icon]) => `<button class="${!top && UI.tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}"><span class="pill">${icon}</span>${label}</button>`).join('')}</div>`;
  if (window.Money) Money.afterRender();
  if (view.focus != null) {
    const el = document.getElementById('b' + view.focus);
    delete view.focus;
    if (el) { el.scrollIntoView({ block: 'center' }); const card = el.firstElementChild || el; card.classList.add('flash'); }
  }
}
function go(view) { UI.scroll.push(window.scrollY); UI.stack.push(view); render(); if (view.focus == null) window.scrollTo(0, 0); }
function back() {
  if (!$('#sheet').hidden) { closeSheet(); return true; }
  if (!UI.stack.length && UI.tab === 'todo' && UI.dl.editId) { dlReset(); render(); return true; }
  if (!UI.stack.length && UI.tab === 'money' && UI.m.view !== 'home') { UI.m.view = 'home'; render(); window.scrollTo(0, 0); return true; }
  if (UI.stack.length) { UI.stack.pop(); render(); window.scrollTo(0, UI.scroll.pop() || 0); return true; }
  if (UI.tab !== 'today') { UI.tab = 'today'; render(); window.scrollTo(0, 0); return true; }
  return false;
}
function openSheet(html) { const el = $('#sheet'); el.innerHTML = `<div class="panel"><div class="grab"></div>${html}</div>`; el.hidden = false; }
function closeSheet() { const el = $('#sheet'); el.hidden = true; el.innerHTML = ''; UI.draft = null; }
let toastTimer = null;
function toast(msg, undo, action) {
  const el = $('#toast');
  UI.undo = undo || null;
  el.innerHTML = esc(msg) + (undo ? '<button data-act="undo">Urungkan</button>' : action ? `<button data-act="${action.act}">${esc(action.label)}</button>` : '');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); UI.undo = null; }, undo || action ? 6500 : 2400);
}

/* ---------- shared pieces ---------- */
function itemRow(ds, it, opts) {
  opts = opts || {};
  const t = it.t, cls = it.mark === 1 ? ' done' : it.mark === 2 ? ' no' : '';
  const meta = [];
  if (opts.rep) meta.push(repLabel(t)); else if (t.end) meta.push('sampai ' + t.end);
  if (t.dur) meta.push(t.dur + ' mnt');
  if (t.cat) meta.push(t.cat);
  if (opts.count) { const n = monthCount(t.id, new Date()); if (n) meta.push(n + '× bulan ini'); }
  if (t.note) meta.push(t.note);
  const tag = t.rep && t.rep.k === 'once' ? '<span class="tag ev">Acara</span>' : it.extra ? '<span class="tag">bonus</span>' : '';
  const a = `data-ds="${ds}" data-id="${esc(t.id)}"`;
  return `<div class="it${cls}">
    <button class="ck" data-act="mark" ${a} data-v="1" aria-label="Sudah"></button>
    <div class="tx" data-act="mark" ${a} data-v="1"><span class="t">${rich(t.title)}</span>${tag}${meta.length ? `<span class="meta">${esc(meta.join(' · '))}</span>` : ''}</div>
    <button class="nb ic" data-act="mark" ${a} data-v="2" aria-label="Belum" title="Belum">✕</button>
    <button class="dots" data-act="editTask" data-id="${esc(t.id)}" aria-label="Ubah">⋯</button>
  </div>`;
}

function timeline(ds, items, live) {
  if (!items.length) return '<div class="card empty">Belum ada jadwal di hari ini.<br>Pencet ＋ buat nambah.</div>';
  const blocks = [];
  for (const it of items) {
    const time = it.extra ? '' : it.t.time || '';
    const key = time + '|' + (it.t.group || '');
    let b = blocks[blocks.length - 1];
    if (!b || b.key !== key) blocks.push(b = { key, time, group: it.t.group || 'Jadwal', items: [] });
    b.items.push(it);
  }
  const hm = nowHM();
  let nowTime = null;
  if (live) for (const b of blocks) if (b.time && b.time <= hm) nowTime = b.time;
  return '<div class="tl">' + blocks.map((b) => {
    const n = b.items.length, done = b.items.filter((x) => x.mark === 1).length;
    const isNow = live && b.time && b.time === nowTime;
    const past = live && b.time && !isNow && b.time < hm;
    const okey = ds + '|' + b.key;
    const open = n === 1 || (UI.open[okey] !== undefined ? UI.open[okey] : n <= 4 || (isNow && done < n));
    const end = n === 1 && b.items[0].t.end ? b.items[0].t.end : '';
    const head = n > 1 ? `<button class="gh" data-act="toggleOpen" data-key="${esc(okey)}"><b>${esc(b.group)}</b><span class="count${done === n ? ' full' : ''}">${done}/${n}</span><span class="chev">▶</span></button>` : '';
    return `<div class="blk${isNow ? ' now' : ''}${past ? ' past' : ''}${open ? ' open' : ''}">
      <div class="when">${b.time || 'Bebas'}${end ? `<small>${end}</small>` : ''}</div>
      <div class="body">${head}${open ? `<div class="its">${b.items.map((it) => itemRow(ds, it)).join('')}</div>` : ''}</div>
    </div>`;
  }).join('') + '</div>';
}

function ring(done, total) {
  const c = 2 * Math.PI * 30, frac = total ? done / total : 0;
  return `<div class="ring"><svg viewBox="0 0 76 76"><circle class="bg" cx="38" cy="38" r="30"/><circle class="fg" cx="38" cy="38" r="30" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - frac)).toFixed(1)}"/></svg><div class="num">${done}/${total}<small>selesai</small></div></div>`;
}

function reminderCard() {
  if (!S.reminders.length) return '';
  const r = (UI.rem && S.reminders.find((x) => x.id === UI.rem)) || reminderFor(new Date());
  return `<section class="card remind"><header><h3>${r.icon || '🔔'} Pengingat ${esc(r.label.toLowerCase())}</h3>
    <div class="seg">${S.reminders.map((x) => `<button class="${x.id === r.id ? 'on' : ''}" data-act="rem" data-id="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div></header>
    <ul>${r.lines.map((l) => `<li>${rich(l)}</li>`).join('')}</ul></section>`;
}

function todoRow(t, when) {
  const moves = when === 'besok' ? [['malam', '← Malam ini']] : when === 'malam' ? [['besok', 'Besok →']] : [['malam', 'Malam ini'], ['besok', 'Besok']];
  return `<div class="it${t.done ? ' done' : ''}"><button class="ck" data-act="todoToggle" data-id="${t.id}" aria-label="Selesai"></button>
    <div class="tx" data-act="todoToggle" data-id="${t.id}"><span class="t">${rich(t.x)}</span>${when === 'lewat' ? `<span class="meta">dari ${shortDate(parseYmd(t.date))}</span>` : ''}</div>
    ${t.done ? '' : moves.map(([to, label]) => `<button class="nb" data-act="todoMove" data-id="${t.id}" data-to="${to}">${label}</button>`).join('')}
    <button class="x" data-act="todoDel" data-id="${t.id}" aria-label="Hapus">×</button></div>`;
}
function todoCard(when) {
  const ds = when === 'besok' ? ymd(addDays(new Date(), 1)) : todayStr();
  const list = todosOn(ds), done = list.filter((t) => t.done).length;
  const besok = when === 'besok';
  return `<section class="card"><header><h3>${besok ? '🌤️ To-do besok' : '🌙 To-do malam ini'}</h3>${list.length ? `<span class="count${done === list.length ? ' full' : ''}">${done}/${list.length}</span>` : ''}</header>
    ${list.length ? list.map((t) => todoRow(t, when)).join('') : `<p class="muted small">${besok ? 'Belum ada. Catat sekarang biar besok nggak lupa.' : 'Belum ada. Apa yang harus beres malam ini?'}</p>`}
    <form class="add" data-form="todo" data-when="${when}"><input name="x" placeholder="${besok ? 'Tambah buat besok…' : 'Tambah buat malam ini…'}" autocomplete="off" enterkeyhint="done"><button aria-label="Tambah">＋</button></form></section>`;
}
function overdueCard() {
  const list = todosOverdue();
  if (!list.length) return '';
  return `<section class="card"><header><h3>⏳ Belum selesai kemarin</h3><span class="count">${list.length}</span></header>${list.map((t) => todoRow(t, 'lewat')).join('')}</section>`;
}

function picksCard() {
  const dow = isoDow(new Date());
  return Object.values(BLOCKS).filter((b) => b.t === 'check' && b.day === dow).map((b) => {
    const home = BLOCK_HOME[b.id];
    return `<h2 class="sec"><span class="grow">Pilihan hari ini</span><button class="link" data-act="openSection" data-id="${esc(home.section.id)}" data-b="${esc(b.id)}">Buka</button></h2>${checkBlock(b, titleCase(cleanTitle(home.title)))}`;
  }).join('');
}

/* ---------- Deadline notes ---------- */
function dlRow(n, opts) {
  opts = opts || {};
  const [num, cap] = dlCount(n.days);
  const date = n.due ? shortDate(parseYmd(n.due)) : '';
  return `<div class="dl lv-${n.level}${n.id === UI.dl.editId ? ' editing' : ''}">
    <button class="ck" data-act="dlDone" data-id="${n.id}" aria-label="Selesai"></button>
    <div class="cnt"><b class="${num.length > 3 ? 'long' : ''}">${num}</b><small>${cap}</small></div>
    <div class="tx"><span class="t">${rich(n.text)}</span>
      <span class="meta">${opts.compact ? '' : `<span class="lvpill">${DL_LABEL[n.level]}</span> `}${esc(date)}${n.fast ? ' <span class="tag fast">Cepat</span>' : ''}</span>
      ${opts.compact ? '' : `<span class="acts"><button data-act="dlEdit" data-id="${n.id}">Ubah</button><button data-act="dlDel" data-id="${n.id}">Hapus</button></span>`}</div>
  </div>`;
}
/** The most pressing open notes, for the Hari ini screen. */
function deadlineCard() {
  const open = dlOpen();
  const hot = open.filter((n) => n.level === 'overdue' || n.level === 'urgent' || n.level === 'soon').slice(0, 4);
  if (!hot.length) return '';
  return `<section class="card"><header><h3>⏰ Deadline</h3><span class="count">${open.length}</span><button class="link" data-act="openDeadlines">Semua</button></header>${hot.map((n) => dlRow(n, { compact: true })).join('')}</section>`;
}
function deadlineView() {
  const now = new Date(), D = UI.dl;
  const all = dlList(now);
  const open = all.filter((n) => !n.done).sort(dlCompare), done = all.filter((n) => n.done).sort((a, b) => b.doneAt - a.doneAt);
  const days = dlDays(D.due || null, now), level = dlLevel(days, D.fast);
  const quick = [['0', 'Hari ini'], ['1', 'Besok'], ['7', 'Seminggu lagi'], ['none', 'Tanpa tanggal']];
  const isOn = (q) => (q === 'none' ? !D.due : D.due === ymd(addDays(now, Number(q))));
  const composer = `<form class="card composer" data-form="dl">
      <textarea name="x" rows="2" placeholder="Tulis catatan atau tugas…" data-input="dlText" maxlength="4000" enterkeyhint="done">${esc(D.text)}</textarea>
      <div class="chips">${quick.map(([q, label]) => `<button type="button" class="chip${isOn(q) ? ' on' : ''}" data-act="dlQuick" data-q="${q}">${label}</button>`).join('')}<input type="date" class="dateinp" value="${esc(D.due)}" data-change="dlDate" aria-label="Tanggal deadline"></div>
      <div class="rowline"><div class="grow"><b>Harus cepat</b><small>Naik satu tingkat lebih mendesak</small></div><button type="button" class="switch${D.fast ? ' on' : ''}" data-act="dlFast" aria-label="Harus cepat"></button></div>
      <div class="foot"><span class="muted small lv-${level}">Masuk ke <span class="lvpill">${DL_LABEL[level]}</span> · ${dlPhrase(days)}</span>
        <span class="btnrow">${D.editId ? '<button type="button" class="btn ghost" data-act="dlCancel">Batal</button>' : ''}<button class="btn">${D.editId ? 'Simpan' : 'Tambah'}</button></span></div>
    </form>`;
  const counts = {};
  open.forEach((n) => { counts[n.level] = (counts[n.level] || 0) + 1; });
  const filters = open.length ? `<div class="scroll">${[['all', 'Semua', open.length]].concat(DL_LEVELS.map(([k, l]) => [k, l, counts[k] || 0])).map(([k, l, n]) => `<button class="chip lv-${k}${D.filter === k ? ' on' : ''}${n ? '' : ' zero'}" data-act="dlFilter" data-k="${k}">${k === 'all' ? '' : '<i class="dot"></i>'}${l} <b>${n}</b></button>`).join('')}</div>` : '';
  let list = '';
  if (!all.length) list = '<div class="card empty"><b>Belum ada catatan</b><br>Tulis di atas dan pilih tanggalnya. Makin dekat tanggalnya, makin atas posisinya.</div>';
  else if (!open.length) list = '<div class="card empty"><b>Semua beres</b><br>Nggak ada yang tersisa.</div>';
  else {
    for (const [k, label] of DL_LEVELS) {
      if (D.filter !== 'all' && D.filter !== k) continue;
      const items = open.filter((n) => n.level === k);
      if (items.length) list += `<section class="dlgroup lv-${k}"><h3>${label}<small>${items.length} catatan</small></h3><div class="card">${items.map((n) => dlRow(n)).join('')}</div></section>`;
    }
    if (!list) list = `<div class="card empty">Nggak ada di ${DL_LABEL[D.filter]}. Pilih Semua buat lihat semuanya.</div>`;
  }
  const doneCard = done.length ? `<section class="card"><header><h3>Selesai</h3><span class="count">${done.length}</span><button class="link" data-act="dlDoneOpen">${D.doneOpen ? 'Tutup' : 'Lihat'}</button></header>
      ${D.doneOpen ? done.map((n) => `<div class="it done"><button class="ck" data-act="dlUndone" data-id="${n.id}" aria-label="Balikin ke daftar"></button><div class="tx"><span class="t">${rich(n.text)}</span><span class="meta">Selesai ${n.doneAt ? shortDate(new Date(n.doneAt)) : ''}</span></div><button class="x" data-act="dlDel" data-id="${n.id}" aria-label="Hapus">×</button></div>`).join('') + '<button class="btn ghost wide" style="margin-top:10px" data-act="dlClearDone">Hapus semua yang selesai</button>' : ''}</section>` : '';
  const rules = `<h2 class="sec">Cara ngurutin</h2><div class="card rules">
      <div class="lv-overdue"><span class="lvpill">Telat</span><span>Tanggalnya udah lewat.</span></div>
      <div class="lv-urgent"><span class="lvpill">Mendesak</span><span>Hari ini atau besok. Juga yang ditandai cepat dan jatuh tempo dalam 7 hari.</span></div>
      <div class="lv-soon"><span class="lvpill">Segera</span><span>2 sampai 7 hari lagi. Juga yang ditandai cepat tapi masih lama atau tanpa tanggal.</span></div>
      <div class="lv-later"><span class="lvpill">Nanti</span><span>Lebih dari 7 hari lagi.</span></div>
      <div class="lv-none"><span class="lvpill">Tanpa tanggal</span><span>Belum dikasih tanggal.</span></div></div>`;
  return composer + filters + list + doneCard + rules;
}

/* ---------- Hari ini ---------- */
VIEWS.today = () => {
  const now = new Date(), ds = todayStr(), items = dayItems(now);
  const h = now.getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
  const mottos = (DATA.seeds.home || []).filter((l) => !/all-in-one|dalam satu file/i.test(l));
  const motto = mottos.length ? mottos[Math.floor(now.getTime() / 864e5) % mottos.length].replace(/\n/g, ' · ') : '';
  const todos = todosOn(ds);
  const done = items.filter((i) => i.mark === 1).length + todos.filter((t) => t.done).length;
  return `<header class="hero"><div class="grow"><p class="eyebrow">${longDate(now)}</p><h1>${greet}${S.settings.name ? ', ' + esc(S.settings.name) : ''}</h1>${motto ? `<p class="motto">${esc(motto)}</p>` : ''}</div>${ring(done, items.length + todos.length)}</header>
    ${reminderCard()}
    ${Money.todayCard()}
    ${overdueCard()}
    ${deadlineCard()}
    <div class="duo">${todoCard('malam')}${todoCard('besok')}</div>
    ${picksCard()}
    <h2 class="sec"><span class="grow">Jadwal hari ini</span><button class="link" data-act="addTask" data-date="${ds}">＋ Tambah</button></h2>
    ${timeline(ds, items, true)}`;
};

/* ---------- Kalender ---------- */
function dayCell(d, opts) {
  opts = opts || {};
  const ds = ymd(d), p = dayProgress(d);
  return `<button class="day${ds === todayStr() ? ' today' : ''}${ds === UI.cal.sel ? ' sel' : ''}${opts.out ? ' out' : ''}" data-act="calSel" data-ds="${ds}">${opts.month ? '' : `<small>${DAY_SHORT[d.getDay()]}</small>`}<b>${d.getDate()}</b><i>${p.events ? '<span class="ev"></span>' : ''}${p.total ? p.done + '/' + p.total : ''}</i></button>`;
}
VIEWS.cal = () => {
  const c = UI.cal, sel = parseYmd(c.sel);
  let grid, label;
  if (c.mode === 'week') {
    const start = parseYmd(c.start), end = addDays(start, 6);
    label = start.getMonth() === end.getMonth() ? `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}` : `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
    grid = `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map((i) => dayCell(addDays(start, i))).join('')}</div>`;
  } else {
    const first = parseYmd(c.month + '-01'), from = mondayOf(first);
    label = MONTHS[first.getMonth()] + ' ' + first.getFullYear();
    let cells = '';
    for (let i = 0; i < 42; i++) { const d = addDays(from, i); if (i >= 35 && d.getMonth() !== first.getMonth()) break; cells += dayCell(d, { month: true, out: d.getMonth() !== first.getMonth() }); }
    grid = `<div class="month">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<div class="dow">${ISO_SHORT[i]}</div>`).join('')}${cells}</div>`;
  }
  const items = dayItems(sel), todos = todosOn(c.sel);
  const done = items.filter((i) => i.mark === 1).length;
  return `<div class="title"><h1>Kalender</h1><div class="seg"><button class="${c.mode === 'week' ? 'on' : ''}" data-act="calMode" data-m="week">7 hari</button><button class="${c.mode === 'month' ? 'on' : ''}" data-act="calMode" data-m="month">Bulan</button></div></div>
    <div class="calnav"><b>${label}</b><button class="iconbtn" data-act="calNav" data-d="-1" aria-label="Sebelumnya">${ICON.back}</button><button class="link" data-act="calToday">Hari ini</button><button class="iconbtn" data-act="calNav" data-d="1" aria-label="Berikutnya" style="transform:scaleX(-1)">${ICON.back}</button></div>
    ${grid}
    <h2 class="sec"><span class="grow">${longDate(sel)}</span><span class="count${items.length && done === items.length ? ' full' : ''}">${done}/${items.length}</span></h2>
    ${(() => { const due = dlOpen().filter((n) => n.due === c.sel); return due.length ? `<section class="card"><header><h3>⏰ Deadline</h3><span class="count">${due.length}</span></header>${due.map((n) => dlRow(n, { compact: true })).join('')}</section>` : ''; })()}
    ${Money.dayCard(c.sel)}
    ${todos.length ? `<section class="card"><header><h3>📝 To-do</h3></header>${todos.map((t) => todoRow(t, c.sel === todayStr() ? 'malam' : 'besok')).join('')}</section>` : ''}
    ${timeline(c.sel, items, c.sel === todayStr())}
    <button class="fab" data-act="addTask" data-date="${c.sel}" aria-label="Tambah jadwal">＋</button>`;
};

/* ---------- To-Do ---------- */
const checkLists = () => Object.values(BLOCKS).filter((b) => b.t === 'check' && !b.daily && !b.day);
VIEWS.todo = () => {
  const lists = checkLists(), seg = UI.todoSeg, nOpen = S.deadlines.filter((n) => !n.done).length;
  const segs = [['todo', 'To-do'], ['deadline', 'Deadline' + (nOpen ? ' · ' + nOpen : '')], ['list', 'List']];
  let body;
  if (seg === 'deadline') body = deadlineView();
  else if (seg === 'list') {
    body = lists.length ? `<div class="card">${lists.map((b) => {
      const home = BLOCK_HOME[b.id], items = listItems(b), done = items.filter((i) => i.d).length;
      return `<button class="navrow" data-act="openSection" data-id="${esc(home.section.id)}" data-b="${esc(b.id)}"><span class="ico">${home.sheet.icon}</span><span class="grow"><b>${esc(titleCase(cleanTitle(home.title)))}</b><small>${esc(titleCase(home.sheet.title))}</small></span><span class="count${items.length && done === items.length ? ' full' : ''}">${done}/${items.length}</span></button>`;
    }).join('')}</div>` : '<div class="card empty">Belum ada list.</div>';
  } else body = overdueCard() + todoCard('malam') + todoCard('besok');
  return `<div class="title"><h1>To-Do</h1></div>
    <div class="seg wide">${segs.map(([k, l]) => `<button class="${seg === k ? 'on' : ''}" data-act="todoSeg" data-k="${k}">${l}</button>`).join('')}</div>
    ${body}`;
};

/* ---------- All in 1 (the workbook) ---------- */
function blockLines(b) {
  switch (b.t) {
    case 'h': case 'p': case 'note': return [b.x];
    case 'ul': case 'check': return listItems(b).map((i) => i.x + (i.n ? ' — ' + i.n : ''));
    case 'grid': return b.items.map((i) => i.x);
    case 'grades': return b.subjects;
    case 'ledger': return ['Saldo & transaksi (tab Uang)'];
    case 'table': return b.rows.map((r) => (Array.isArray(r) ? r.filter(Boolean).join(' · ') : r.g));
    default: return [];
  }
}
/** Escapes text and marks every occurrence of the (lower-case) needle. */
function highlight(text, needle) {
  const low = text.toLowerCase();
  let out = '', i = 0;
  for (let at = low.indexOf(needle); at >= 0; at = low.indexOf(needle, i)) {
    out += esc(text.slice(i, at)) + '<mark>' + esc(text.slice(at, at + needle.length)) + '</mark>';
    i = at + needle.length;
  }
  return out + esc(text.slice(i));
}
function searchResults(q) {
  const needle = q.toLowerCase(), out = [];
  for (const sheet of DATA.sheets) for (const section of sheet.sections) {
    section.blocks.forEach((b, i) => {
      for (const line of blockLines(b)) {
        const at = line.toLowerCase().indexOf(needle);
        if (at < 0 || out.length >= 80) continue;
        const from = Math.max(0, at - 30), snippet = (from ? '…' : '') + line.slice(from, at + needle.length + 70).replace(/\n/g, ' ');
        const hit = highlight(snippet, needle);
        out.push(`<button class="navrow" data-act="openSection" data-id="${esc(section.id)}" data-i="${i}"><span class="ico">${sheet.icon}</span><span class="grow"><b>${esc(titleCase(section.title))}</b><small>${hit}</small></span></button>`);
      }
    });
  }
  return out.length ? `<div class="card">${out.join('')}</div>` : '<div class="card empty">Nggak ketemu.</div>';
}
function libBody() {
  const q = UI.q.trim();
  if (q.length >= 2) return searchResults(q);
  if (!DATA.sheets.length) return '<div class="card empty">Belum ada isi. Buat <b>data.js</b> dari spreadsheet dengan <code>tools/xlsx2data.py</code>.</div>';
  return `<div class="tiles">${DATA.sheets.map((s) => `<button class="tile" data-act="openSheet" data-id="${esc(s.id)}"><span class="ico">${s.icon}</span><b>${esc(titleCase(s.title))}</b><small>${s.sections.length > 1 ? s.sections.length + ' bagian' : 'Buka'}</small></button>`).join('')}</div>`;
}
VIEWS.lib = () => `<div class="title"><h1>All in 1</h1></div>
  <div class="search">${ICON.search}<input type="search" placeholder="Cari di semua catatan…" value="${esc(UI.q)}" data-input="search" autocomplete="off"></div>
  <div id="libbody">${libBody()}</div>`;

VIEWS.sheet = (v) => {
  const sheet = DATA.sheets.find((s) => s.id === v.id);
  return `<div class="bar"><button class="back" data-act="back" aria-label="Kembali">${ICON.back}</button><h1>${sheet.icon} ${esc(titleCase(sheet.title))}</h1></div>
    <div class="card">${sheet.sections.map((sec) => {
      const heads = sec.blocks.filter((b) => b.t === 'h').map((b) => titleCase(cleanTitle(b.x)));
      const first = sec.blocks.find((b) => b.t === 'p' || b.t === 'note');
      const sub = heads.length ? heads.slice(0, 4).join(' · ') : first ? first.x : '';
      return `<button class="navrow" data-act="openSection" data-id="${esc(sec.id)}"><span class="grow"><b>${esc(titleCase(sec.title))}</b><small>${esc(sub)}</small></span><span class="chev">›</span></button>`;
    }).join('')}</div>`;
};

VIEWS.section = (v) => {
  const { section } = SECTIONS[v.id];
  const heads = section.blocks.map((b, i) => (b.t === 'h' ? { i, x: titleCase(cleanTitle(b.x)) } : null)).filter(Boolean);
  const notes = S.notes[section.id] || [];
  return `<div class="bar"><button class="back" data-act="back" aria-label="Kembali">${ICON.back}</button><h1>${esc(titleCase(section.title))}</h1></div>
    ${heads.length > 2 ? `<div class="scroll">${heads.map((h) => `<button class="chip" data-act="jump" data-i="${h.i}">${esc(h.x.length > 34 ? h.x.slice(0, 33) + '…' : h.x)}</button>`).join('')}</div>` : ''}
    <div class="doc">${section.blocks.map((b, i) => `<div id="b${i}">${renderBlock(b)}</div>`).join('')}
      <h3>Catatan tambahan</h3>
      <div class="card">${notes.length ? `<ul class="blist">${notes.map((n, i) => `<li>${rich(n)} <button class="x" data-act="noteDel" data-id="${esc(section.id)}" data-i="${i}" aria-label="Hapus" style="float:right">×</button></li>`).join('')}</ul>` : ''}
        <form class="add" data-form="note" data-id="${esc(section.id)}"><input name="x" placeholder="Tulis catatan baru di sini…" autocomplete="off"><button aria-label="Tambah">＋</button></form></div>
    </div>`;
};

function renderBlock(b) {
  switch (b.t) {
    case 'h': return `<h${b.l}>${rich(b.x)}</h${b.l}>`;
    case 'p': return `<p class="${b.m ? 'm' : ''}${isArabic(b.x) ? ' ar' : ''}">${rich(b.x)}</p>`;
    case 'note': return `<div class="note ${b.k || ''}">${rich(b.x)}</div>`;
    case 'ul': return listBlock(b);
    case 'check': return b.daily ? taskBlock(b) : checkBlock(b);
    case 'grid': return taskBlock(b);
    case 'grades': return gradesBlock(b);
    case 'ledger': return Money.summaryCard();
    case 'table': return b.days ? dayTable(b) : tableBlock(b);
    default: return '';
  }
}

function editBlock(b, items) {
  const id = esc(b.id);
  return `<div class="card"><div class="tools"><button data-act="editList" data-b="${id}">Selesai</button></div>
    ${items.map((it, i) => `<div class="ed"><textarea rows="${Math.min(6, Math.ceil((it.x.length + 1) / 38))}" data-change="itemText" data-b="${id}" data-i="${i}">${esc(it.x)}</textarea><button class="x" data-act="itemDel" data-b="${id}" data-i="${i}" aria-label="Hapus">×</button></div>`).join('')}
    <form class="add" data-form="itemAdd" data-b="${id}"><input name="x" placeholder="Tambah baris…" autocomplete="off"><button aria-label="Tambah">＋</button></form></div>`;
}
function listBlock(b) {
  const items = listItems(b);
  if (UI.edit[b.id]) return editBlock(b, items);
  return `<div class="card"><div class="tools"><button data-act="editList" data-b="${esc(b.id)}">Ubah</button></div><ul class="blist">${items.map((it) => {
    const url = /^https?:\/\/\S+$/.test(it.x);
    return `<li class="${it.sub ? 'sub' : ''}${url ? ' url' : ''}">${rich(it.x)}${it.u ? ` <a href="${esc(it.u)}" target="_blank" rel="noopener">↗</a>` : ''}</li>`;
  }).join('')}</ul></div>`;
}
function checkBlock(b, title) {
  const items = listItems(b), id = esc(b.id);
  if (UI.edit[b.id]) return editBlock(b, items);
  const pick = b.day ? picksFor(b) : null;
  const isDone = (it, i) => (pick ? !!pick[i] : !!it.d);
  const done = items.filter(isDone).length;
  const label = pick ? `Dipilih ${done} · min 2` : `${done}/${items.length}`;
  return `<div class="card"><header><h3>${esc(title || b.title || '')}</h3><span class="count${(pick ? done >= 2 : items.length && done === items.length) ? ' full' : ''}">${label}</span>
      ${done && !pick ? `<button class="link" data-act="resetList" data-b="${id}">Reset</button>` : ''}<button class="link" data-act="editList" data-b="${id}">Ubah</button></header>
    ${items.map((it, i) => `<div class="it${isDone(it, i) ? ' done' : ''}"><button class="ck" data-act="itemToggle" data-b="${id}" data-i="${i}" aria-label="Centang"></button>
      <div class="tx" data-act="itemToggle" data-b="${id}" data-i="${i}"><span class="t">${rich(it.x)}</span>${it.n ? `<span class="n">${rich(it.n)}</span>` : ''}</div>
      ${it.n && it.n.length > 80 ? '<button class="dots" data-act="expand" aria-label="Lihat semua">⋯</button>' : ''}</div>`).join('')}
    <form class="add" data-form="itemAdd" data-b="${id}"><input name="x" placeholder="Tambah…" autocomplete="off"><button aria-label="Tambah">＋</button></form></div>`;
}

/** The routine lists (after-school, weekly, monthly, for fun) are calendar tasks; here they are ticked for today. */
function taskBlock(b) {
  const tasks = b.daily ? S.tasks.filter((t) => t.src === 'pulsek') : S.tasks.filter((t) => t.ref === b.id);
  const now = new Date(), ds = todayStr(), marks = S.marks[ds] || {};
  const row = (t) => itemRow(ds, { t, mark: marks[t.id] || 0 }, { rep: true, count: true });
  const due = tasks.filter((t) => occursOn(t, now)), other = tasks.filter((t) => !occursOn(t, now));
  const doneOf = (list) => list.filter((t) => marks[t.id] === 1).length;
  const manage = '<button class="link" data-act="go" data-v="manage">Atur</button>';
  if (!due.length && other.every((t) => !t.rep || t.rep.k === 'none')) {
    return `<div class="card"><header><h3>Centang yang dilakuin hari ini</h3><span class="count">${doneOf(other)}/${other.length}</span>${manage}</header>${other.map(row).join('')}</div>`;
  }
  const key = 'tb|' + b.id, open = !!UI.open[key];
  return `<div class="card"><header><h3>Hari ini</h3><span class="count${due.length && doneOf(due) === due.length ? ' full' : ''}">${doneOf(due)}/${due.length}</span>${manage}</header>
      ${due.length ? due.map(row).join('') : '<p class="muted small">Nggak ada yang dijadwalin hari ini.</p>'}</div>
    ${other.length ? `<div class="card"><header><h3>Hari lain</h3><span class="count">${other.length}</span><button class="link" data-act="toggleOpen" data-key="${esc(key)}">${open ? 'Tutup' : 'Lihat'}</button></header>${open ? other.map(row).join('') : ''}</div>` : ''}`;
}

function gradesBlock(b) {
  const target = Number(S.settings.gradeTarget) || b.target || 85;
  const by = {};
  for (const g of S.grades) (by[g.subject] = by[g.subject] || []).push(g.score);
  const subjects = b.subjects.concat(Object.keys(by).filter((s) => !b.subjects.includes(s)));
  const avg = (a) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
  const all = S.grades.map((g) => g.score);
  const below = subjects.filter((s) => by[s] && avg(by[s]) < target).length;
  const opt = (list, sel) => list.map((x) => `<option${x === sel ? ' selected' : ''}>${esc(x)}</option>`).join('');
  return `<div class="card"><div class="stat"><div><b>${all.length ? avg(all) : '–'}</b><small>Rata-rata</small></div><div><b>${below}</b><small>Di bawah target</small></div><div><b>${target}</b><small>Target</small></div></div>
      <form data-form="grade">
        <div class="field"><div class="row"><div><label>Mapel</label><select name="subject">${opt(subjects)}</select></div><div><label>Jenis</label><select name="kind">${opt(['Ulangan', 'Tugas', 'Ujian', 'Kuis'])}</select></div></div></div>
        <div class="field"><div class="row"><div><label>Nilai</label><input name="score" type="number" min="0" max="100" step="0.5" inputmode="decimal" required></div><div><label>Tanggal</label><input name="date" type="date" value="${todayStr()}"></div></div></div>
        <div class="field"><label>Catatan</label><input name="note" autocomplete="off"></div>
        <button class="btn wide">Simpan nilai</button>
      </form>
      <div class="rowline" style="margin-top:10px"><div class="grow"><b>Target per mapel</b></div><input type="number" min="0" max="100" value="${target}" data-change="gradeTarget" style="width:76px;border:1.5px solid var(--line);background:var(--bg);border-radius:10px;padding:6px 8px"></div></div>
    <div class="card"><header><h3>Rata-rata per mapel</h3></header><table class="tbl">${subjects.map((s) => {
      const a = by[s] ? avg(by[s]) : null;
      return `<tr><td>${esc(s)}</td><td><b>${a == null ? '–' : a}</b></td><td>${a == null ? '<span class="muted">Belum ada data</span>' : a >= target ? '<span class="okc">✓ Aman</span>' : '<span class="noc">Perlu perhatian</span>'}</td></tr>`;
    }).join('')}</table></div>
    ${S.grades.length ? `<div class="card"><header><h3>Riwayat nilai</h3><span class="count">${S.grades.length}</span></header>${S.grades.slice().reverse().map((g) => `<div class="rowline"><div class="grow"><b>${esc(g.subject)} · ${g.score}</b><small>${esc([g.kind, shortDate(parseYmd(g.date)), g.note].filter(Boolean).join(' · '))}</small></div><button class="x" data-act="gradeDel" data-id="${g.id}" aria-label="Hapus">×</button></div>`).join('')}</div>` : ''}`;
}

const cellText = (v) => (/^\d{5,}$/.test(v) ? Number(v).toLocaleString('id-ID') : v);
function tableBlock(b) {
  const head = b.head || [], rows = b.rows.filter(Array.isArray);
  const width = Math.max(head.length, ...rows.map((r) => r.length));
  let cols = [];
  for (let i = 0; i < width; i++) if (rows.some((r) => r[i])) cols.push(i);
  const numbering = cols.filter((i) => /^(no|#)$/i.test(head[i] || '') || rows.every((r) => !r[i] || /^\d{1,3}$/.test(r[i])));
  if (cols.length - numbering.length >= 2) cols = cols.filter((i) => !numbering.includes(i));
  if (!cols.length) return '';
  const hasHead = cols.some((i) => head[i]);
  const cell = (r, i) => rich(cellText(r[i] || ''));
  if (cols.length === 1) return `<div class="card"><ul class="blist">${rows.filter((r) => r[cols[0]]).map((r) => `<li>${cell(r, cols[0])}</li>`).join('')}</ul></div>`;
  if (cols.length === 2) {
    return `<div class="card"><div class="kv">${hasHead ? `<div class="muted small">${esc(head[cols[0]] || '')}</div><div class="muted small">${esc(head[cols[1]] || '')}</div>` : ''}${rows.map((r) => `<div>${cell(r, cols[0])}</div><div>${cell(r, cols[1])}</div>`).join('')}</div></div>`;
  }
  if (cols.length === 3 && rows.every((r) => cols.every((i) => (r[i] || '').length < 60))) {
    return `<div class="card"><table class="tbl">${hasHead ? `<tr>${cols.map((i) => `<th>${esc(head[i] || '')}</th>`).join('')}</tr>` : ''}${rows.map((r) => `<tr>${cols.map((i) => `<td>${cell(r, i)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  }
  return `<div class="card">${rows.map((r) => {
    const filled = cols.filter((i) => r[i] && r[i] !== '-');
    if (!filled.length) return '';
    return `<div class="rec"><b>${cell(r, filled[0])}</b>${filled.slice(1).map((i) => `<div class="f">${head[i] ? `<span>${esc(head[i].replace(/\n/g, ' '))}</span>` : ''}${cell(r, i)}</div>`).join('')}</div>`;
  }).join('')}</div>`;
}

/** Tables with one column per weekday are shown one day at a time. */
function dayTable(b) {
  const dayCols = b.head.map((h, i) => ({ i, d: dayIdx(h) })).filter((c) => c.d != null);
  const want = UI.dayTab || isoDow(new Date());
  const sel = dayCols.find((c) => c.d === want) || dayCols[0];
  const chips = `<div class="chips" style="margin-bottom:10px">${dayCols.map((c) => `<button class="chip${c === sel ? ' on' : ''}" data-act="dayTab" data-d="${c.d}">${titleCase(b.head[c.i])}</button>`).join('')}</div>`;
  const timed = b.head.some((h) => /^jam$/i.test(String(h).trim())) && DATA.seeds.timetable;
  let body = '';
  if (timed) {
    const merged = [];
    for (const s of DATA.seeds.timetable[sel.d] || []) {
      const last = merged[merged.length - 1];
      if (last && last.x === s.x && last.e === s.s) last.e = s.e; else merged.push({ s: s.s, e: s.e, x: s.x });
    }
    body = merged.map((s) => `<div class="slot"><span>${pad(s.s)}.00–${pad(s.e % 24)}.00</span><div>${rich(s.x)}</div></div>`).join('');
  } else {
    let list = [];
    const flush = () => { if (list.length) body += `<ul class="blist">${list.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>`; list = []; };
    for (const r of b.rows) {
      if (!Array.isArray(r)) { flush(); body += `<b class="g">${esc(r.g)}</b>`; continue; }
      const v = (r[sel.i] || '').replace(/^\s*[•◦]\s*/, '');
      if (v) list.push(v);
    }
    flush();
  }
  return `<div class="card daysec">${chips}${body || '<p class="muted small">Kosong.</p>'}</div>`;
}

/* ---------- Atur jadwal rutin ---------- */
VIEWS.manage = () => {
  const groups = new Map();
  for (const t of S.tasks.slice().sort((a, b) => groupRank(a.group) - groupRank(b.group) || (a.time || '99').localeCompare(b.time || '99') || (a.ord || 0) - (b.ord || 0))) {
    const g = t.group || 'Lainnya';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  return `<div class="bar"><button class="back" data-act="back" aria-label="Kembali">${ICON.back}</button><h1>Atur jadwal rutin</h1><button class="link" data-act="addTask">＋ Baru</button></div>
    <p class="muted small" style="margin:0 4px 12px">Semua yang muncul di kalender. Pencet satu buat ganti jam, hari, atau notifikasinya.</p>
    ${[...groups].map(([g, list]) => {
      const key = 'mg|' + g, open = UI.open[key] !== undefined ? UI.open[key] : list.length <= 8;
      return `<div class="card"><header><h3>${esc(g)}</h3><span class="count">${list.length}</span><button class="link" data-act="groupSheet" data-g="${esc(g)}">Jam grup</button><button class="link" data-act="toggleOpen" data-key="${esc(key)}">${open ? 'Tutup' : 'Lihat'}</button></header>
        ${open ? list.map((t) => `<button class="navrow" data-act="editTask" data-id="${esc(t.id)}"><span class="grow"><b>${esc(t.title)}</b><small>${esc(repLabel(t))}${t.notify === false ? ' · notif mati' : ''}</small></span><span class="chev">›</span></button>`).join('') : ''}</div>`;
    }).join('')}`;
};

const REP_KINDS = [['once', 'Sekali'], ['d', 'Tiap hari'], ['w', 'Mingguan'], ['nw', 'Tiap 2 minggu'], ['m', 'Bulanan'], ['none', 'Tanpa jadwal']];
function taskSheetHtml() {
  const d = UI.draft, k = d.rep.k;
  const groups = [...new Set(GROUP_ORDER.concat(S.tasks.map((t) => t.group).filter(Boolean)))];
  return `<h2>${UI.draftId ? 'Ubah jadwal' : 'Jadwal baru'}</h2>
    <form data-form="task">
      <div class="field"><label>Judul</label><input name="title" value="${esc(d.title)}" placeholder="Contoh: Ulangan Matematika" autocomplete="off" required></div>
      <div class="field"><span class="lab">Ulangi</span><div class="chips">${REP_KINDS.map(([id, label]) => `<button type="button" class="chip${k === id ? ' on' : ''}" data-act="draftRep" data-k="${id}">${label}</button>`).join('')}</div></div>
      ${k === 'once' ? `<div class="field"><label>Tanggal</label><input type="date" name="date" value="${esc(d.rep.date || todayStr())}" required></div>` : ''}
      ${k === 'w' || k === 'nw' ? `<div class="field"><span class="lab">Hari</span><div class="chips">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<button type="button" class="chip${(d.rep.days || []).includes(i) ? ' on' : ''}" data-act="draftDay" data-d="${i}">${ISO_SHORT[i]}</button>`).join('')}</div></div>` : ''}
      ${k === 'm' ? `<div class="field"><label>Tanggal tiap bulan</label><input type="number" name="dom" min="1" max="31" value="${d.rep.dom || 1}" required></div>` : ''}
      ${k === 'none' ? '<p class="muted small" style="margin:-4px 2px 12px">Nggak muncul di kalender, tapi bisa dicentang dari list-nya kapan aja.</p>' : `<div class="field"><div class="row"><div><label>Jam</label><input type="time" name="time" value="${esc(d.time || '')}"></div><div><label>Sampai (opsional)</label><input type="time" name="end" value="${esc(d.end || '')}"></div></div></div>`}
      <div class="field"><label>Grup</label><input name="group" list="grouplist" value="${esc(d.group || '')}" autocomplete="off"><datalist id="grouplist">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></div>
      <div class="field"><label>Catatan (opsional)</label><input name="note" value="${esc(d.note || '')}" autocomplete="off"></div>
      ${k === 'none' ? '' : `<div class="rowline"><div class="grow"><b>Notifikasi</b><small>Muncul di jamnya, bisa langsung dijawab Sudah / Belum</small></div><button type="button" class="switch${d.notify !== false ? ' on' : ''}" data-act="draftNotify" aria-label="Notifikasi"></button></div>`}
      <div class="btnrow" style="margin-top:14px"><button class="btn wide">Simpan</button>${UI.draftId ? '<button type="button" class="btn danger wide" data-act="taskDel">Hapus</button>' : ''}</div>
    </form>`;
}
function readDraft() {
  const f = $('#sheet form'), d = UI.draft;
  if (!f || !d) return;
  const val = (n) => (f.elements[n] ? f.elements[n].value : undefined);
  d.title = val('title').trim();
  if (val('time') !== undefined) { d.time = val('time'); d.end = val('end'); }
  d.group = (val('group') || '').trim();
  d.note = (val('note') || '').trim();
  if (val('date') !== undefined) d.rep.date = val('date');
  if (val('dom') !== undefined) d.rep.dom = Math.max(1, Math.min(31, Number(val('dom')) || 1));
}

/* ---------- Lainnya (settings) ---------- */
VIEWS.more = () => {
  const st = nativeStatus();
  const s = S.settings;
  const opts = (list, sel) => list.map(([v, label]) => `<option value="${v}"${String(v) === String(sel) ? ' selected' : ''}>${label}</option>`).join('');
  const queue = BRIDGE && s.notif !== false ? buildQueue() : [];
  const next = queue[0] ? (() => { const d = new Date(queue[0].at); return `Berikutnya: <b>${ymd(d) === todayStr() ? 'hari ini' : shortDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}</b> — ${esc(queue[0].title)} · ${queue.length} terjadwal untuk 30 hari ke depan`; })() : '';
  const status = !BRIDGE ? '<p class="note">Notifikasi dengan tombol Sudah / Belum cuma jalan di aplikasi Android (AllInOne.apk). Di browser, semua list & kalender tetap bisa dipakai.</p>'
    : !st || st.notif ? '' : '<p class="note">Notifikasi belum diizinkan. Pencet <b>Izinkan notifikasi</b> di bawah.</p>';
  return `<div class="title"><h1>Lainnya</h1></div>
    <div class="card">
      <button class="navrow" data-act="go" data-v="manage"><span class="ico">🗓️</span><span class="grow"><b>Atur jadwal rutin</b><small>${S.tasks.length} kegiatan · jam, hari, notifikasi</small></span><span class="chev">›</span></button>
    </div>

    <h2 class="sec">Notifikasi</h2>
    ${status}
    <div class="card">
      <div class="rowline"><div class="grow"><b>Notifikasi jadwal & to-do</b><small>Tiap jadwal muncul di jamnya dengan tombol Sudah / Belum</small></div><button class="switch${s.notif !== false ? ' on' : ''}" data-act="setFlag" data-k="notif" aria-label="Notifikasi"></button></div>
      <div class="rowline"><div class="grow"><b>Kalau dijawab “Belum”</b><small>Ingatkan lagi setelah</small></div><select data-change="setting" data-k="snooze">${opts([[0, 'Jangan'], [10, '10 menit'], [15, '15 menit'], [30, '30 menit'], [60, '1 jam']], s.snooze)}</select></div>
      <div class="rowline"><div class="grow"><b>To-do malam ini</b><small>Jam notifikasinya</small></div><input type="time" value="${esc(s.todoTime)}" data-change="setting" data-k="todoTime"></div>
      ${next ? `<p class="small muted" style="margin-top:8px">${next}</p>` : ''}
      ${BRIDGE && st && st.exact === false ? '<p class="small noc" style="margin-top:8px">HP ini belum mengizinkan alarm tepat waktu, jadi notifikasi bisa telat beberapa menit. Izinkan “Alarm & pengingat” di pengaturan aplikasi.</p>' : ''}
      ${BRIDGE ? `<div class="btnrow" style="margin-top:10px">${st && !st.notif ? '<button class="btn" data-act="askNotif">Izinkan notifikasi</button>' : ''}<button class="btn ghost" data-act="testNotif">Tes notifikasi</button><button class="btn ghost" data-act="appSettings">Pengaturan aplikasi</button></div>
      <p class="muted small" style="margin-top:10px">Kalau notif suka telat / nggak muncul: di pengaturan aplikasi, izinkan autostart dan matikan penghemat baterai untuk All in One.</p>` : ''}
    </div>

    <h2 class="sec">Pengingat pagi · siang · sore</h2>
    ${S.reminders.map((r, ri) => `<div class="card"><header><h3>${r.icon || '🔔'} ${esc(r.label)}</h3><button class="switch${r.on ? ' on' : ''}" data-act="remToggle" data-r="${ri}" aria-label="Aktif"></button></header>
      <div class="rowline"><div class="grow"><b>Senin – Jumat</b></div><input type="time" value="${esc(r.time || '')}" data-change="remTime" data-r="${ri}" data-k="time"></div>
      <div class="rowline"><div class="grow"><b>Sabtu – Minggu</b></div><input type="time" value="${esc(r.timeWE || '')}" data-change="remTime" data-r="${ri}" data-k="timeWE"></div>
      <div style="margin-top:8px">${r.lines.map((l, li) => `<div class="ed"><textarea rows="${Math.min(4, Math.ceil((l.length + 1) / 38))}" data-change="remLine" data-r="${ri}" data-i="${li}">${esc(l)}</textarea><button class="x" data-act="remLineDel" data-r="${ri}" data-i="${li}" aria-label="Hapus">×</button></div>`).join('')}</div>
      <form class="add" data-form="remLine" data-r="${ri}"><input name="x" placeholder="Tambah pengingat ${esc(r.label.toLowerCase())}…" autocomplete="off"><button aria-label="Tambah">＋</button></form></div>`).join('')}

    <h2 class="sec">Tampilan</h2>
    <div class="card">
      <div class="rowline"><div class="grow"><b>Tema</b></div><div class="seg">${[['auto', 'Auto'], ['light', 'Terang'], ['dark', 'Gelap']].map(([v, l]) => `<button class="${s.theme === v ? 'on' : ''}" data-act="theme" data-t="${v}">${l}</button>`).join('')}</div></div>
      <div class="rowline"><div class="grow"><b>Nama panggilan</b></div><input value="${esc(s.name)}" data-change="setting" data-k="name" style="width:140px;border:1.5px solid var(--line);background:var(--bg);border-radius:10px;padding:6px 10px" autocomplete="off"></div>
    </div>

    <h2 class="sec">Data</h2>
    <div class="card">
      <p class="small muted" style="margin-bottom:10px">Semua centang, to-do, dan catatan disimpan di HP ini aja. Simpan backup sebelum uninstall atau ganti HP.</p>
      <div class="btnrow"><button class="btn" data-act="exportData">Simpan backup</button><button class="btn ghost" data-act="importData">Pulihkan backup</button></div>
      <div class="btnrow" style="margin-top:8px"><button class="btn ghost" data-act="reseed">Reset jadwal dari spreadsheet</button><button class="btn danger" data-act="wipe">Hapus semua data</button></div>
      ${DATA.source ? `<p class="small muted" style="margin-top:10px">Isi dari ${esc(DATA.source)} · dibuat ${esc(DATA.generated || '')}</p>` : ''}
    </div>`;
};

/* ---------- actions ---------- */
ACT.tab = (el) => { UI.stack = []; UI.scroll = []; UI.tab = el.dataset.tab; render(); window.scrollTo(0, 0); };
ACT.back = () => back();
ACT.go = (el) => go({ v: el.dataset.v });
ACT.mark = (el) => { setMark(el.dataset.ds, el.dataset.id, Number(el.dataset.v)); render(); };
ACT.toggleOpen = (el) => {
  const k = el.dataset.key, blk = el.closest('.blk');
  const cur = blk ? blk.classList.contains('open') : /Tutup/.test(el.textContent);
  UI.open[k] = !cur; render();
};
ACT.rem = (el) => { UI.rem = el.dataset.id; render(); };
ACT.expand = (el) => el.parentElement.querySelector('.tx').classList.toggle('open');

ACT.todoToggle = (el) => { const t = S.todos.find((x) => x.id === el.dataset.id); if (t) { t.done = t.done ? 0 : 1; t.doneAt = Date.now(); save(); render(); } };
ACT.todoDel = (el) => { S.todos = S.todos.filter((x) => x.id !== el.dataset.id); save(); render(); };
ACT.todoMove = (el) => {
  const t = S.todos.find((x) => x.id === el.dataset.id);
  if (!t) return;
  const besok = el.dataset.to === 'besok';
  t.date = besok ? ymd(addDays(new Date(), 1)) : todayStr(); t.slot = besok ? 'pagi' : 'malam';
  save(); render();
};
FORMS.todo = (f) => { addTodo(f.elements.x.value, f.dataset.when); render(); const again = $(`form[data-form="todo"][data-when="${f.dataset.when}"] input`); if (again) again.focus(); };

ACT.todoSeg = (el) => { UI.todoSeg = el.dataset.k; render(); window.scrollTo(0, 0); };
ACT.openDeadlines = () => { UI.stack = []; UI.scroll = []; UI.tab = 'todo'; UI.todoSeg = 'deadline'; render(); window.scrollTo(0, 0); };
ACT.undo = () => { const fn = UI.undo; UI.undo = null; $('#toast').classList.remove('show'); if (fn) { fn(); save(); render(); } };
const dlKeep = () => { const t = $('textarea[data-input="dlText"]'); if (t) UI.dl.text = t.value; };
const dlReset = () => { Object.assign(UI.dl, { text: '', due: '', fast: false, editId: null }); };
ACT.dlQuick = (el) => { dlKeep(); const q = el.dataset.q; UI.dl.due = q === 'none' ? '' : ymd(addDays(new Date(), Number(q))); render(); };
CHANGE.dlDate = (el) => { dlKeep(); UI.dl.due = el.value; render(); };
ACT.dlFast = () => { dlKeep(); UI.dl.fast = !UI.dl.fast; render(); };
ACT.dlCancel = () => { dlReset(); render(); };
ACT.dlFilter = (el) => { dlKeep(); UI.dl.filter = el.dataset.k; render(); };
ACT.dlDoneOpen = () => { dlKeep(); UI.dl.doneOpen = !UI.dl.doneOpen; render(); };
FORMS.dl = (f) => {
  const text = f.elements.x.value.trim(), D = UI.dl;
  if (!text) { toast('Tulis catatannya dulu'); f.elements.x.focus(); return; }
  const old = D.editId ? S.deadlines.find((n) => n.id === D.editId) : null;
  if (old) Object.assign(old, { text, due: D.due || null, fast: D.fast });
  else S.deadlines.push({ id: uid(), text, due: D.due || null, fast: D.fast, done: false, created: Date.now(), doneAt: 0 });
  dlReset(); save(); render();
  const again = $('textarea[data-input="dlText"]'); if (again) again.focus();
};
ACT.dlEdit = (el) => {
  const n = S.deadlines.find((x) => x.id === el.dataset.id);
  if (!n) return;
  Object.assign(UI.dl, { text: n.text, due: n.due || '', fast: !!n.fast, editId: n.id });
  UI.stack = []; UI.tab = 'todo'; UI.todoSeg = 'deadline'; render(); window.scrollTo(0, 0);
  const t = $('textarea[data-input="dlText"]'); if (t) t.focus();
};
ACT.dlDone = (el) => {
  const n = S.deadlines.find((x) => x.id === el.dataset.id);
  if (!n) return;
  dlKeep(); n.done = true; n.doneAt = Date.now(); save(); render();
  toast('Ditandai selesai', () => { n.done = false; n.doneAt = 0; });
};
ACT.dlUndone = (el) => { const n = S.deadlines.find((x) => x.id === el.dataset.id); if (n) { dlKeep(); n.done = false; n.doneAt = 0; save(); render(); } };
function dlRemove(list, msg) {
  if (!list.length) return;
  dlKeep();
  const before = S.deadlines.slice();
  if (list.some((n) => n.id === UI.dl.editId)) dlReset();
  S.deadlines = S.deadlines.filter((n) => !list.includes(n));
  save(); render();
  toast(msg, () => { S.deadlines = before; });
}
ACT.dlDel = (el) => dlRemove(S.deadlines.filter((n) => n.id === el.dataset.id), 'Catatan dihapus');
ACT.dlClearDone = () => { const done = S.deadlines.filter((n) => n.done); dlRemove(done, done.length + ' catatan selesai dihapus'); };

ACT.calSel = (el) => { UI.cal.sel = el.dataset.ds; render(); };
ACT.calMode = (el) => { const c = UI.cal; c.mode = el.dataset.m; c.month = c.sel.slice(0, 7); if (c.mode === 'week' && (c.sel < c.start || c.sel > ymd(addDays(parseYmd(c.start), 6)))) c.start = c.sel; render(); };
ACT.calToday = () => { const t = todayStr(); UI.cal.sel = t; UI.cal.start = t; UI.cal.month = t.slice(0, 7); render(); };
ACT.calNav = (el) => {
  const c = UI.cal, dir = Number(el.dataset.d);
  if (c.mode === 'week') { c.start = ymd(addDays(parseYmd(c.start), 7 * dir)); c.sel = ymd(addDays(parseYmd(c.sel), 7 * dir)); }
  else { const m = parseYmd(c.month + '-01'); c.month = ymd(new Date(m.getFullYear(), m.getMonth() + dir, 1)).slice(0, 7); }
  render();
};

ACT.addTask = (el) => { UI.draftId = null; UI.draft = { title: '', time: '', end: '', group: 'Acara', notify: true, note: '', rep: { k: 'once', date: el.dataset.date || todayStr() } }; openSheet(taskSheetHtml()); };
ACT.editTask = (el) => { const t = S.tasks.find((x) => x.id === el.dataset.id); if (!t) return; UI.draftId = t.id; UI.draft = JSON.parse(JSON.stringify(t)); UI.draft.rep = UI.draft.rep || { k: 'none' }; openSheet(taskSheetHtml()); };
const redrawTaskSheet = () => { $('#sheet .panel').innerHTML = '<div class="grab"></div>' + taskSheetHtml(); };
ACT.draftRep = (el) => {
  readDraft();
  const d = UI.draft, k = el.dataset.k, old = d.rep;
  d.rep = { k };
  if (k === 'once') d.rep.date = old.date || UI.cal.sel || todayStr();
  if (k === 'w' || k === 'nw') d.rep.days = old.days && old.days.length ? old.days : [isoDow(parseYmd(old.date || todayStr()))];
  if (k === 'nw') { d.rep.n = 2; d.rep.anchor = ymd(mondayOf(new Date())); }
  if (k === 'm') d.rep.dom = old.dom || parseYmd(old.date || todayStr()).getDate();
  redrawTaskSheet();
};
ACT.draftDay = (el) => { readDraft(); const days = UI.draft.rep.days || (UI.draft.rep.days = []); const i = Number(el.dataset.d); const at = days.indexOf(i); if (at >= 0) days.splice(at, 1); else days.push(i); days.sort(); redrawTaskSheet(); };
ACT.draftNotify = () => { readDraft(); UI.draft.notify = UI.draft.notify === false; redrawTaskSheet(); };
ACT.taskDel = () => { S.tasks = S.tasks.filter((t) => t.id !== UI.draftId); save(); closeSheet(); render(); toast('Dihapus'); };
FORMS.task = () => {
  readDraft();
  const d = UI.draft;
  if (!d.title) return toast('Judulnya diisi dulu');
  if ((d.rep.k === 'w' || d.rep.k === 'nw') && !(d.rep.days || []).length) return toast('Pilih harinya dulu');
  if (d.rep.k === 'none') { d.time = ''; d.end = ''; }
  if (UI.draftId) { const i = S.tasks.findIndex((t) => t.id === UI.draftId); if (i >= 0) S.tasks[i] = d; }
  else { d.id = uid(); d.src = 'user'; d.ord = 9000 + S.nid; S.tasks.push(d); if (d.rep.k === 'once') { UI.cal.sel = d.rep.date; } }
  save(); closeSheet(); render(); toast('Tersimpan');
};
ACT.groupSheet = (el) => {
  const g = el.dataset.g, list = S.tasks.filter((t) => (t.group || 'Lainnya') === g);
  const timed = list.find((t) => t.time);
  openSheet(`<h2>${esc(g)}</h2><form data-form="group" data-g="${esc(g)}">
    <div class="field"><label>Jam untuk semua di grup ini</label><input type="time" name="time" value="${timed ? timed.time : ''}"><p class="muted small" style="margin-top:6px">Kosongin kalau nggak mau ganti jam. Yang tanpa jadwal nggak ikut berubah.</p></div>
    <div class="field"><label>Notifikasi</label><select name="notify"><option value="">Biarkan apa adanya</option><option value="1">Nyalakan semua</option><option value="0">Matikan semua</option></select></div>
    <button class="btn wide">Terapkan ke ${list.length} kegiatan</button></form>`);
};
FORMS.group = (f) => {
  const time = f.elements.time.value, notify = f.elements.notify.value;
  for (const t of S.tasks) {
    if ((t.group || 'Lainnya') !== f.dataset.g) continue;
    if (time && t.rep && t.rep.k !== 'none') t.time = time;
    if (notify !== '') t.notify = notify === '1';
  }
  save(); closeSheet(); render(); toast('Grup diperbarui');
};

ACT.openSheet = (el) => { const sheet = DATA.sheets.find((s) => s.id === el.dataset.id); if (sheet.sections.length === 1) go({ v: 'section', id: sheet.sections[0].id }); else go({ v: 'sheet', id: sheet.id }); };
ACT.openSection = (el) => {
  const view = { v: 'section', id: el.dataset.id };
  if (el.dataset.i != null) view.focus = Number(el.dataset.i);
  else if (el.dataset.b) view.focus = SECTIONS[el.dataset.id].section.blocks.findIndex((b) => b.id === el.dataset.b);
  go(view);
};
ACT.jump = (el) => { const t = document.getElementById('b' + el.dataset.i); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
ACT.dayTab = (el) => { UI.dayTab = Number(el.dataset.d); render(); };
ACT.editList = (el) => { UI.edit[el.dataset.b] = !UI.edit[el.dataset.b]; render(); };
ACT.resetList = (el) => { editList(BLOCKS[el.dataset.b], (list) => list.forEach((it) => { delete it.d; })); render(); };
ACT.itemToggle = (el) => { const b = BLOCKS[el.dataset.b], i = Number(el.dataset.i); if (b.day) togglePick(b, i); else editList(b, (list) => { if (list[i].d) delete list[i].d; else list[i].d = 1; }); render(); };
ACT.itemDel = (el) => { editList(BLOCKS[el.dataset.b], (list) => list.splice(Number(el.dataset.i), 1)); render(); };
FORMS.itemAdd = (f) => { const x = f.elements.x.value.trim(); if (!x) return; editList(BLOCKS[f.dataset.b], (list) => list.push({ x })); render(); const again = $(`form[data-form="itemAdd"][data-b="${CSS.escape(f.dataset.b)}"] input`); if (again) again.focus(); };
CHANGE.itemText = (el) => { const x = el.value.trim(); editList(BLOCKS[el.dataset.b], (list) => { if (x) list[Number(el.dataset.i)].x = x; }); };
FORMS.note = (f) => { const x = f.elements.x.value.trim(); if (!x) return; (S.notes[f.dataset.id] = S.notes[f.dataset.id] || []).push(x); save({ sync: false }); render(); };
ACT.noteDel = (el) => { S.notes[el.dataset.id].splice(Number(el.dataset.i), 1); save({ sync: false }); render(); };

FORMS.grade = (f) => {
  const score = Number(f.elements.score.value);
  if (!f.elements.score.value || isNaN(score)) return toast('Nilainya diisi dulu');
  S.grades.push({ id: uid(), subject: f.elements.subject.value, kind: f.elements.kind.value, score, date: f.elements.date.value || todayStr(), note: f.elements.note.value.trim() });
  save({ sync: false }); render(); toast('Nilai tersimpan');
};
ACT.gradeDel = (el) => { S.grades = S.grades.filter((g) => g.id !== el.dataset.id); save({ sync: false }); render(); };
CHANGE.gradeTarget = (el) => { S.settings.gradeTarget = Math.max(0, Math.min(100, Number(el.value) || 0)); save({ sync: false }); render(); };

ACT.setFlag = (el) => { S.settings[el.dataset.k] = S.settings[el.dataset.k] === false; save(); render(); };
CHANGE.setting = (el) => { S.settings[el.dataset.k] = el.dataset.k === 'snooze' ? Number(el.value) : el.value; save(); };
ACT.theme = (el) => { S.settings.theme = el.dataset.t; save({ sync: false }); applyTheme(); render(); };
ACT.remToggle = (el) => { const r = S.reminders[Number(el.dataset.r)]; r.on = !r.on; save(); render(); };
CHANGE.remTime = (el) => { S.reminders[Number(el.dataset.r)][el.dataset.k] = el.value; save(); };
CHANGE.remLine = (el) => { const x = el.value.trim(); if (x) { S.reminders[Number(el.dataset.r)].lines[Number(el.dataset.i)] = x; save(); } };
ACT.remLineDel = (el) => { S.reminders[Number(el.dataset.r)].lines.splice(Number(el.dataset.i), 1); save(); render(); };
FORMS.remLine = (f) => { const x = f.elements.x.value.trim(); if (!x) return; S.reminders[Number(f.dataset.r)].lines.push(x); save(); render(); };

ACT.askNotif = () => { if (BRIDGE) BRIDGE.aioAskNotifications(); closeSheet(); };
ACT.appSettings = () => { if (BRIDGE) BRIDGE.aioOpenSettings(); };
ACT.testNotif = () => {
  const at = Date.now() + 5000;
  extraQueue = [{ id: 'test|' + at, at, ch: 'tasks', title: 'Tes notifikasi', items: [{ k: 'test|1', x: 'Pencet Sudah atau Belum' }, { k: 'test|2', x: 'Yang kedua — coba “Sudah semua”' }] }];
  syncNotifications(); toast('Notifikasi muncul 5 detik lagi');
};
ACT.closeSheet = () => closeSheet();
ACT.onboardDone = () => { S.settings.onboarded = true; save({ sync: false }); closeSheet(); };

ACT.exportData = () => {
  const text = exportData(), name = 'all-in-one-backup-' + todayStr() + '.json';
  if (BRIDGE && BRIDGE.aioSaveFile) return BRIDGE.aioSaveFile(name, text);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click();
};
function doImport(text) {
  try { importData(text); applyTheme(); closeSheet(); render(); toast('Backup dipulihkan'); } catch (e) { toast(e.message || 'File backup tidak valid'); }
}
ACT.importData = () => {
  if (BRIDGE && BRIDGE.aioPickFile) return BRIDGE.aioPickFile();
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = () => { const file = input.files[0]; if (file) file.text().then(doImport); };
  input.click();
};
ACT.reseed = () => openSheet(`<h2>Reset jadwal dari spreadsheet?</h2><p class="muted" style="margin-bottom:14px">Jadwal rutin dikembalikan seperti di spreadsheet. Jadwal yang kamu tambah sendiri dan semua centang tetap ada.</p><div class="btnrow"><button class="btn wide" data-act="reseedYes">Ya, reset</button><button class="btn ghost wide" data-act="closeSheet">Batal</button></div>`);
ACT.reseedYes = () => { reseedTasks(); closeSheet(); render(); toast('Jadwal direset'); };
ACT.wipe = () => openSheet(`<h2>Hapus semua data?</h2><p class="muted" style="margin-bottom:14px">Semua centang, to-do, nilai, catatan tambahan, dan pengaturan di HP ini dihapus. Nggak bisa dibatalin — simpan backup dulu kalau ragu.</p><div class="btnrow"><button class="btn danger wide" data-act="wipeYes">Hapus semuanya</button><button class="btn ghost wide" data-act="closeSheet">Batal</button></div>`);
ACT.wipeYes = () => { localStorage.removeItem(LS_KEY); loadState(); Money.reset(); saveNow(); syncNotifications(); applyTheme(); closeSheet(); UI.stack = []; UI.tab = 'today'; render(); toast('Data dihapus'); };

/* ---------- events ---------- */
document.addEventListener('click', (ev) => {
  if (ev.target.closest('a')) return;
  if (ev.target.id === 'sheet') return closeSheet();
  const el = ev.target.closest('[data-act]');
  if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el, ev);
});
document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  if (FORMS[f.dataset.form]) FORMS[f.dataset.form](f);
});
document.addEventListener('change', (ev) => { const el = ev.target; if (el.dataset && el.dataset.change && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el); });
document.addEventListener('keydown', (ev) => {
  if (ev.target.dataset && ev.target.dataset.input === 'dlText' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); ev.target.form.requestSubmit(); }
});
document.addEventListener('input', (ev) => {
  if (ev.target.dataset && ev.target.dataset.input === 'dlText') { UI.dl.text = ev.target.value; return; }
  if (ev.target.dataset && ev.target.dataset.input === 'search') { UI.q = ev.target.value; $('#libbody').innerHTML = libBody(); }
});

const typing = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
function refresh() { if (!typing() && $('#sheet').hidden) render(); }
window.onAndroidBack = back;
window.onNativeResults = () => { if (takeNativeResults()) refresh(); };
window.onNativeOpen = () => { closeSheet(); UI.stack = []; UI.scroll = []; UI.tab = 'today'; takeNativeResults(); render(); window.scrollTo(0, 0); };
window.onNotifPermission = () => { syncNotifications(); refresh(); };
window.onFilePicked = (text) => doImport(text);
window.onFileSaved = (ok) => toast(ok ? 'Backup tersimpan' : 'Backup batal disimpan');
document.addEventListener('visibilitychange', () => { if (!document.hidden) { takeNativeResults(); refresh(); syncNotifications(); } });
