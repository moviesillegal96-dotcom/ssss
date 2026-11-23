/* A1O — "Baru dihapus": anything deleted (to-dos, calendar entries, deadlines, list items, notes, pasted notes,
 * reminders and their lines, grades, money) goes here for 30 days. Right after deleting, the toast offers Urungkan;
 * later it can be brought back from Lainnya → Baru dihapus, or for to-dos from the bottom of the To-Do tab.
 * Money's own kinds are registered in money.js. Loaded after a1o.js. */
'use strict';
(() => {
  const K = TRASH_KINDS;
  const secName = (id) => (id && SECTIONS[id] ? titleCase(SECTIONS[id].section.title) : '');
  const putBack = (list, i, x) => (i == null ? list.push(x) : list.splice(Math.min(Math.max(0, i), list.length), 0, x));

  /* ---------- what each kind is and how it comes back ---------- */
  K.todo = { icon: '📝', name: 'To-do', restore: (t, i) => { if (!S.todos.some((x) => x.id === t.id)) putBack(S.todos, i, t); return true; } };
  K.deadline = { icon: '⏰', name: 'Deadline', restore: (n, i) => { if (!S.deadlines.some((x) => x.id === n.id)) putBack(S.deadlines, i, n); return true; } };
  K.task = { icon: '📅', name: 'Jadwal', restore: (d) => { if (!S.tasks.some((x) => x.id === d.t.id)) putBack(S.tasks, d.i, d.t); return true; } };
  K.item = {
    icon: '☑️', name: 'Isi list',
    restore: (d) => { const b = BLOCKS[d.b]; if (!b) return 'List-nya sudah nggak ada'; editList(b, (l) => putBack(l, d.i, d.it)); return true; },
  };
  K.note = { icon: '🗒️', name: 'Catatan', restore: (d) => { putBack(S.notes[d.sec] = S.notes[d.sec] || [], d.i, d.x); return true; } };
  K.pasted = { icon: '📋', name: 'Catatan tempel', restore: (d) => { if (!S.pasted.some((g) => g.id === d.g.id)) putBack(S.pasted, d.i, d.g); return true; } };
  K.grade = { icon: '🎓', name: 'Nilai', restore: (g, i) => { if (!S.grades.some((x) => x.id === g.id)) putBack(S.grades, i, g); return true; } };
  K.reminder = { icon: '🔔', name: 'Pengingat', restore: (d) => { if (!S.reminders.some((r) => r.id === d.r.id)) putBack(S.reminders, d.i, d.r); return true; } };
  K.remline = {
    icon: '🔔', name: 'Kalimat pengingat',
    restore: (d) => { const r = S.reminders.find((x) => x.id === d.rid); if (!r) return 'Pengingat ' + d.label + ' sudah dihapus — pulihkan pengingatnya dulu'; putBack(r.lines, d.i, d.x); return true; },
  };

  /* ---------- the delete buttons ---------- */
  ACT.todoDel = (el) => {
    const i = S.todos.findIndex((x) => x.id === el.dataset.id);
    if (i < 0) return;
    const [t] = S.todos.splice(i, 1);
    trashed('todo', t, t.x, 'To-do ' + (t.slot === 'pagi' ? 'pagi' : 'malam') + ' · ' + shortDate(parseYmd(t.date)), 'To-do dihapus', i);
  };
  dlRemove = function (list, msg) {
    if (!list.length) return;
    dlKeep();
    if (list.some((n) => n.id === UI.dl.editId)) dlReset();
    const pos = new Map(list.map((n) => [n, S.deadlines.indexOf(n)]));
    S.deadlines = S.deadlines.filter((n) => !list.includes(n));
    const es = list.map((n) => trashPut('deadline', n, n.text, 'Deadline' + (n.due ? ' · ' + shortDate(parseYmd(n.due)) : ''), pos.get(n)));
    save(); render();
    // Put back lowest position first, so each lands where it was.
    toast(msg, () => es.slice().sort((a, b) => a.pos - b.pos).forEach((e) => trashRestore(e.id)));
  };
  function delTask(id) {
    const i = S.tasks.findIndex((t) => t.id === id);
    if (i < 0) return closeSheet();
    const [t] = S.tasks.splice(i, 1);
    closeSheet();
    trashed('task', { t, i }, t.title, 'Jadwal · ' + repLabel(t), 'Jadwal dihapus');
  }
  ACT.taskDel = () => delTask(UI.draftId);
  ACT.schDel = () => delTask(UI.sch && UI.sch.editId);
  ACT.itemDel = (el) => {
    const b = BLOCKS[el.dataset.b], i = Number(el.dataset.i), it = listItems(b)[i];
    if (!it) return;
    editList(b, (l) => l.splice(i, 1));
    const home = BLOCK_HOME[b.id];
    trashed('item', { b: b.id, i, it }, it.x, titleCase(cleanTitle(home.title)) + ' · ' + titleCase(home.sheet.title), 'Dihapus dari list');
  };
  ACT.noteDel = (el) => {
    const sec = el.dataset.id, i = Number(el.dataset.i), list = S.notes[sec] || [];
    if (i >= list.length) return;
    const [x] = list.splice(i, 1);
    trashed('note', { sec, i, x }, x, 'Catatan tambahan · ' + secName(sec), 'Catatan dihapus');
  };
  ACT.pDel = (el) => {
    const i = S.pasted.findIndex((g) => g.id === el.dataset.id);
    if (i < 0) return;
    const [g] = S.pasted.splice(i, 1);
    trashed('pasted', { g, i }, g.title || g.items[0] || 'Catatan', 'Catatan · ' + secName(g.sec), 'Catatan dihapus');
  };
  ACT.gradeDel = (el) => {
    const i = S.grades.findIndex((x) => x.id === el.dataset.id);
    if (i < 0) return;
    const [g] = S.grades.splice(i, 1);
    trashed('grade', g, [g.subject, g.kind, g.score].filter((x) => x != null && x !== '').join(' · '), 'Nilai' + (g.date ? ' · ' + shortDate(parseYmd(g.date)) : ''), 'Nilai dihapus', i);
  };
  ACT.remDel = (el) => {
    const i = Number(el.dataset.r), r = S.reminders[i];
    if (!r) return;
    S.reminders.splice(i, 1);
    trashed('reminder', { r, i }, (r.icon || '🔔') + ' ' + r.label, 'Pengingat · ' + r.lines.length + ' kalimat', 'Pengingat ' + r.label + ' dihapus');
  };
  ACT.remLineDel = (el) => {
    const r = S.reminders[Number(el.dataset.r)], i = Number(el.dataset.i);
    if (!r || i >= r.lines.length) return;
    const [x] = r.lines.splice(i, 1);
    trashed('remline', { rid: r.id, label: r.label, i, x }, x, 'Pengingat ' + r.label, 'Kalimat dihapus');
  };

  /* ---------- the "Baru dihapus" screen ---------- */
  const dayLabel = (t) => { const d = new Date(t), ds = ymd(d); return ds === todayStr() ? 'Hari ini' : ds === ymd(addDays(new Date(), -1)) ? 'Kemarin' : shortDate(d); };
  const hm = (t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const daysLeft = (t) => Math.max(0, Math.ceil((t + TRASH_DAYS * 864e5 - Date.now()) / 864e5));
  function row(e) {
    const k = K[e.kind] || { icon: '🗑️', name: 'Lainnya' };
    return `<div class="binrow"><span class="ico">${k.icon}</span><div class="grow"><div class="bt">${rich(stripPhotos(e.label)) || '<i class="muted">(kosong)</i>'}</div>
      <small>${esc(k.name)}${e.where ? ' · ' + esc(e.where) : ''} · ${hm(e.at)} · ${daysLeft(e.at)} hari lagi</small></div>
      <button class="nb" data-act="binRestore" data-id="${esc(e.id)}">Pulihkan</button></div>`;
  }
  VIEWS.trash = () => {
    const all = S.trash || [], f = UI.binKind || 'all';
    const kinds = [...new Set(all.map((e) => e.kind))];
    const list = f === 'all' ? all : all.filter((e) => e.kind === f);
    let body = '', day = '';
    for (const e of list) {
      const d = dayLabel(e.at);
      if (d !== day) { body += (day ? '</div>' : '') + `<h2 class="sec">${esc(d)}</h2><div class="card">`; day = d; }
      body += row(e);
    }
    if (day) body += '</div>';
    return `<div class="bar"><button class="back" data-act="back" aria-label="Kembali">${ICON.back}</button><h1>🗑️ Baru dihapus</h1>${all.length ? '<button class="link" data-act="binEmpty">Kosongkan</button>' : ''}</div>
      ${kinds.length > 1 ? `<div class="chips bincats"><button class="chip${f === 'all' ? ' on' : ''}" data-act="binKind" data-k="all">Semua · ${all.length}</button>${kinds.map((k) => `<button class="chip${f === k ? ' on' : ''}" data-act="binKind" data-k="${esc(k)}">${(K[k] || {}).icon || '🗑️'} ${esc((K[k] || {}).name || k)} · ${all.filter((e) => e.kind === k).length}</button>`).join('')}</div>` : ''}
      ${body || '<div class="card empty">Nggak ada yang dihapus. Semua yang kamu hapus muncul di sini selama 30 hari.</div>'}
      ${all.length ? `<p class="muted small" style="margin:10px 4px 24px">Disimpan ${TRASH_DAYS} hari, lalu hilang sendiri. Backup (Lainnya → Simpan backup) ikut menyimpan isi Baru dihapus.</p>` : ''}`;
  };
  ACT.binOpen = () => go({ v: 'trash' });
  ACT.binKind = (el) => { UI.binKind = el.dataset.k; render(); };
  ACT.binRestore = (el) => {
    const e = (S.trash || []).find((x) => x.id === el.dataset.id);
    const r = trashRestore(el.dataset.id);
    if (r !== true) return toast(r);
    if (UI.binKind && !(S.trash || []).some((x) => x.kind === UI.binKind)) UI.binKind = 'all';
    save(); render();
    toast(((K[e.kind] || {}).name || 'Item') + ' dipulihkan');
  };
  ACT.binEmpty = () => openSheet(`<h2>Kosongkan Baru dihapus?</h2><p class="muted" style="margin-bottom:14px">${(S.trash || []).length} item dihapus permanen dan nggak bisa dipulihkan lagi.</p>
    <div class="btnrow"><button class="btn danger wide" data-act="binEmptyYes">Hapus permanen</button><button class="btn ghost wide" data-act="closeSheet">Batal</button></div>`);
  ACT.binEmptyYes = () => { S.trash = []; UI.binKind = 'all'; save({ sync: false }); closeSheet(); render(); toast('Baru dihapus dikosongkan'); };

  // Lainnya: a row at the top.
  const more = VIEWS.more;
  VIEWS.more = (v) => {
    const n = (S.trash || []).length;
    return more(v).replace('<div class="title"><h1>Lainnya</h1></div>', `<div class="title"><h1>Lainnya</h1></div>
      <div class="card"><button class="navrow" data-act="binOpen"><span class="ico">🗑️</span><span class="grow"><b>Baru dihapus</b><small>${n ? n + ' item · bisa dipulihkan selama ' + TRASH_DAYS + ' hari' : 'Kosong · yang kamu hapus disimpan di sini ' + TRASH_DAYS + ' hari'}</small></span>${n ? `<span class="count">${n}</span>` : ''}<span class="chev">›</span></button></div>`);
  };

  // To-Do tab: the deleted to-dos, and a way to everything else.
  trashCard = function () {
    const all = S.trash || [], todos = all.filter((e) => e.kind === 'todo');
    if (!all.length) return '';
    const open = !!UI.open.trash;
    return `<section class="card"><header><h3>🗑️ Baru dihapus</h3><span class="count">${todos.length}</span>${todos.length ? `<button class="link" data-act="toggleOpen" data-key="trash">${open ? 'Tutup' : 'Lihat'}</button>` : ''}</header>
      ${open ? todos.map(row).join('') : todos.length ? '' : '<p class="muted small">Nggak ada to-do yang dihapus.</p>'}
      ${all.length > todos.length ? `<button class="navrow" data-act="binOpen"><span class="grow"><small>Semua yang dihapus (${all.length}) — jadwal, catatan, list, uang…</small></span><span class="chev">›</span></button>` : ''}</section>`;
  };
})();
