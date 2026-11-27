/* A1O — schedule things from All in 1, the Google Calendar way.
 *
 * In a category, "Pilih" turns the lines into tap-to-select rows; highlighting words with a long press works too.
 * "Jadwalkan" opens a sheet like Google Calendar's new-event screen: title, all-day, date, start/end time, repeat
 * (none, daily, weekly on that day, weekdays, every 2 weeks, monthly, custom days, with an optional end date),
 * notification (at the start or some minutes before) and group. Each chosen line becomes its own calendar entry, so it
 * shows up in Hari ini and Kalender and its notification can be answered Sudah / Belum. It can go to the to-do list
 * for tonight or tomorrow instead. Scheduled lines get a small 📅 badge; tapping it opens the entry again.
 * Loaded after library.js. */
'use strict';
(() => {
  const P = { sec: null, sel: [] };                 // "Pilih" mode: the section and the selected lines' text
  let hiText = '', hiTimer = null;                   // text highlighted with a long press

  /* ---------- the lines on screen ---------- */
  const SKIP = '.cx, .sh, .ctools';
  function lineText(cr) {
    const ct = cr.querySelector('.ct');
    if (!ct) return '';
    const k = ct.cloneNode(true);
    k.querySelectorAll('small.cn').forEach((n) => n.remove());
    k.querySelectorAll('a').forEach((a) => { if (a.textContent.trim() === '↗') a.remove(); });
    return k.textContent.replace(/\s+/g, ' ').replace(/^[-•*·]\s+/, '').trim();
  }
  const libLines = () => [...document.querySelectorAll('.lib .cr')].filter((cr) => !cr.matches(SKIP) && cr.querySelector('.ct'));
  const topView = () => UI.stack[UI.stack.length - 1];
  const inShortSection = () => { const v = topView(); return v && v.v === 'section' && !S.settings.libFull; };

  /* ---------- the category page: "Pilih" button, selection and badges ---------- */
  const section = VIEWS.section;
  VIEWS.section = (v) => {
    const html = section(v);
    if (S.settings.libFull) return html;
    return html.replace('<button class="link" data-act="libFull">Lengkap</button>',
      `<button class="link${P.sec === v.id ? ' on' : ''}" data-act="schPick" data-id="${esc(v.id)}">📅 Pilih</button><button class="link" data-act="libFull">Lengkap</button>`);
  };

  const baseRender = render;
  render = function () { baseRender(); decorate(); };

  function decorate() {
    const v = topView();
    if (P.sec && !(inShortSection() && v.id === P.sec)) { P.sec = null; P.sel = []; }
    document.documentElement.classList.toggle('picking', !!P.sec);
    bar();
    if (!inShortSection()) return;
    const mine = new Map();
    for (const t of S.tasks) if (t.lib === v.id && t.libText) mine.set(t.libText, t);
    for (const cr of libLines()) {
      const x = lineText(cr);
      cr.dataset.sx = x;
      cr.classList.toggle('sel', !!P.sec && P.sel.includes(x));
      const t = mine.get(x);
      if (t) {
        cr.classList.add('has-sch');
        cr.insertAdjacentHTML('beforeend', `<button class="sch" data-act="schEdit" data-id="${esc(t.id)}">📅 ${esc(whenLabel(t))}</button>`);
      }
    }
  }

  const whenLabel = (t) => repLabel(t) + (t.time ? '' : ' · sepanjang hari');

  function bar() {
    let el = document.getElementById('schbar');
    if (!P.sec) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'schbar'; document.body.appendChild(el); }
    const n = P.sel.length;
    el.innerHTML = `<span class="grow">${n ? `<b>${n}</b> dipilih` : 'Buka grupnya, lalu ketuk baris yang mau dijadwalkan'}</span>
      <button class="btn ghost" data-act="schCancel">Batal</button><button class="btn" data-act="schOpen"${n ? '' : ' disabled'}>Jadwalkan</button>`;
  }

  // While picking, a tap anywhere on a line selects it (instead of ticking it, opening a link or unfolding it).
  document.addEventListener('click', (ev) => {
    if (!P.sec) return;
    const cr = ev.target.closest('.lib .cr');
    if (!cr || cr.matches(SKIP) || !cr.dataset.sx || ev.target.closest('.sch, .x, form')) return;
    ev.preventDefault(); ev.stopPropagation();
    const x = cr.dataset.sx, i = P.sel.indexOf(x);
    if (i >= 0) P.sel.splice(i, 1); else P.sel.push(x);
    cr.classList.toggle('sel', i < 0);
    bar();
  }, true);

  ACT.schPick = (el) => {
    if (P.sec) { P.sec = null; P.sel = []; } else { P.sec = el.dataset.id; P.sel = []; }
    render();
  };
  ACT.schCancel = () => { P.sec = null; P.sel = []; render(); };
  ACT.schOpen = () => {
    if (!P.sel.length) return;
    openSch(P.sel.slice(), P.sec);
  };

  /* ---------- highlighted words ---------- */
  function hiFab() {
    let el = document.getElementById('schfab');
    if (!hiText) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('button'); el.id = 'schfab'; el.dataset.act = 'schHi';
      // Keep the highlight while the button is pressed.
      el.addEventListener('pointerdown', (e) => e.preventDefault());
      el.addEventListener('mousedown', (e) => e.preventDefault());
      document.body.appendChild(el);
    }
    el.textContent = '📅 Jadwalkan “' + (hiText.length > 28 ? hiText.slice(0, 27) + '…' : hiText) + '”';
  }
  document.addEventListener('selectionchange', () => {
    const s = document.getSelection();
    const text = s && !s.isCollapsed ? s.toString().replace(/\s+/g, ' ').trim() : '';
    const node = s && s.anchorNode ? (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) : null;
    clearTimeout(hiTimer);
    if (text.length >= 2 && node && node.closest('.lib') && inShortSection() && !P.sec) { hiText = text.slice(0, 300); hiFab(); return; }
    // Wait a little before hiding, so a tap on the button still lands.
    hiTimer = setTimeout(() => { hiText = ''; hiFab(); }, 450);
  });
  ACT.schHi = () => {
    if (!hiText) return;
    const text = hiText, v = topView();
    hiText = ''; hiFab();
    const s = document.getSelection(); if (s) s.removeAllRanges();
    openSch([text], v && v.v === 'section' ? v.id : null);
  };

  /* ---------- the sheet ---------- */
  const NOTIF_TIMED = [['none', 'Tanpa notifikasi'], ['0', 'Saat dimulai'], ['5', '5 menit sebelumnya'], ['10', '10 menit sebelumnya'], ['15', '15 menit sebelumnya'], ['30', '30 menit sebelumnya'], ['60', '1 jam sebelumnya'], ['1440', '1 hari sebelumnya']];
  const NOTIF_ALLDAY = [['none', 'Tanpa notifikasi'], ['06:00', 'Di harinya, jam 06.00'], ['07:00', 'Di harinya, jam 07.00'], ['09:00', 'Di harinya, jam 09.00'], ['12:00', 'Di harinya, jam 12.00'], ['19:00', 'Di harinya, jam 19.00']];
  const DAY_LONG = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  function repOptions(date) {
    const d = parseYmd(date), day = DAY_LONG[isoDow(d)];
    return [['once', 'Tidak berulang'], ['d', 'Setiap hari'], ['w', 'Setiap minggu pada hari ' + day], ['wd', 'Setiap hari kerja (Senin–Jumat)'],
      ['nw', 'Setiap 2 minggu pada hari ' + day], ['m', 'Setiap bulan pada tanggal ' + d.getDate()], ['custom', 'Khusus: pilih harinya…']];
  }
  const shortTitle = (x) => (x.length > 90 ? x.slice(0, 88).replace(/\s+\S*$/, '') + '…' : x);
  function nextHour() { const d = new Date(); return pad(Math.min(d.getHours() + 1, 23)) + ':00'; }
  function plusHour(hm) { const [h, m] = hm.split(':').map(Number); return h >= 23 ? '' : pad(h + 1) + ':' + pad(m); }
  const secTitle = (id) => (id && SECTIONS[id] ? titleCase(SECTIONS[id].section.title) : '');

  function openSch(items, sec) {
    const time = nextHour();
    UI.sch = {
      items, sec, mode: 'event', editId: null, allDay: false, date: new Date().getHours() >= 21 ? ymd(addDays(new Date(), 1)) : todayStr(),
      time, end: plusHour(time), rep: 'once', days: [], until: '', notif: '0', at: '07:00', group: guessGroup(sec),
      note: sec ? 'Dari All in 1 › ' + secTitle(sec) : '', when: 'malam',
    };
    UI.sch.days = [isoDow(parseYmd(UI.sch.date))];
    openSheet(sheetHtml());
    $('#sheet').classList.add('tall');
  }

  /** The group a section's entries go into: the group the section's own routines use, or "Acara". */
  function guessGroup(sec) {
    const t = S.tasks.find((x) => x.lib === sec && x.group);
    return t ? t.group : 'Acara';
  }

  function sheetHtml() {
    const d = UI.sch, ev = d.mode === 'event';
    const groups = [...new Set(GROUP_ORDER.concat(S.tasks.map((t) => t.group).filter(Boolean)))];
    if (d.group && !groups.includes(d.group)) groups.push(d.group);
    const items = d.items.length === 1
      ? `<div class="field"><textarea name="title" rows="2" class="schtitle" placeholder="Tambahkan judul">${esc(d.items[0])}</textarea></div>`
      : `<div class="schitems">${d.items.map((x, i) => `<div class="schitem"><span class="grow">${esc(shortTitle(x))}</span><button type="button" class="x" data-act="schDrop" data-i="${i}" aria-label="Buang">×</button></div>`).join('')}
         <p class="muted small">${d.items.length} kegiatan · masing-masing jadi jadwal sendiri dengan waktu yang sama</p></div>`;
    const dayChips = (act, on) => [1, 2, 3, 4, 5, 6, 7].map((i) => `<button type="button" class="chip${on.includes(i) ? ' on' : ''}" data-act="${act}" data-d="${i}">${ISO_SHORT[i]}</button>`).join('');
    const dateChips = [[0, 'Hari ini'], [1, 'Besok'], [2, 'Lusa']].map(([n, l]) => { const ds = ymd(addDays(new Date(), n)); return `<button type="button" class="chip${d.date === ds ? ' on' : ''}" data-act="schDate" data-ds="${ds}">${l}</button>`; }).join('');
    const notifs = d.allDay ? NOTIF_ALLDAY : NOTIF_TIMED, nval = d.allDay ? d.at : d.notif;
    return `<div class="schhead"><h2>${d.editId ? 'Ubah jadwal' : '📅 Jadwalkan'}</h2>
        ${d.editId ? '' : `<div class="seg"><button type="button" class="${ev ? 'on' : ''}" data-act="schMode" data-m="event">Jadwal</button><button type="button" class="${ev ? '' : 'on'}" data-act="schMode" data-m="todo">To-do</button></div>`}</div>
      <form data-form="sch" class="sch-form">
        ${items}
        ${ev ? `
        <div class="rowline"><div class="grow"><b>Sepanjang hari</b></div><button type="button" class="switch${d.allDay ? ' on' : ''}" data-act="schAllDay" aria-label="Sepanjang hari"></button></div>
        <div class="field"><label>Tanggal</label><input type="date" name="date" value="${esc(d.date)}" data-change="schRedraw" required><div class="chips" style="margin-top:8px">${dateChips}</div></div>
        ${d.allDay ? '' : `<div class="field"><div class="row"><div><label>Mulai</label><input type="time" name="time" value="${esc(d.time)}" required></div><div><label>Selesai (opsional)</label><input type="time" name="end" value="${esc(d.end)}"></div></div></div>`}
        <div class="field"><label>Ulangi</label><select name="rep" data-change="schRedraw">${repOptions(d.date).map(([k, l]) => `<option value="${k}"${d.rep === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
          ${d.rep === 'custom' ? `<div class="chips" style="margin-top:8px">${dayChips('schDay', d.days)}</div>` : ''}</div>
        ${d.rep === 'once' ? '' : `<div class="field"><label>Berakhir (opsional)</label><input type="date" name="until" value="${esc(d.until)}" min="${esc(d.date)}"><p class="muted small" style="margin-top:4px">Kosongin kalau nggak ada akhirnya.</p></div>`}
        <div class="field"><label>Notifikasi</label><select name="notif">${notifs.map(([k, l]) => `<option value="${k}"${nval === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <p class="muted small" style="margin-top:4px">Bisa langsung dijawab Sudah / Belum dari notifikasinya.</p></div>
        <div class="field"><label>Grup</label><select name="group">${groups.map((g) => `<option${g === d.group ? ' selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
        <div class="field"><label>Deskripsi (opsional)</label><input name="note" value="${esc(d.note)}" autocomplete="off"></div>
        <div class="btnrow" style="margin-top:14px"><button class="btn wide">Simpan</button>${d.editId ? '<button type="button" class="btn danger wide" data-act="schDel">Hapus</button>' : ''}</div>`
        : `
        <div class="field"><span class="lab">Masukin ke to-do</span><div class="chips">${[['malam', 'Malam ini'], ['besok', 'Besok']].map(([k, l]) => `<button type="button" class="chip${d.when === k ? ' on' : ''}" data-act="schWhen" data-k="${k}">${l}</button>`).join('')}</div></div>
        <div class="btnrow" style="margin-top:14px"><button class="btn wide">Tambah ke to-do</button></div>`}
      </form>`;
  }

  function readSch() {
    const f = $('#sheet form[data-form="sch"]'), d = UI.sch;
    if (!f || !d) return;
    const val = (n) => (f.elements[n] ? f.elements[n].value : undefined);
    if (val('title') !== undefined) d.items = [val('title').replace(/\s+/g, ' ').trim()];
    if (val('date')) d.date = val('date');
    if (val('time') !== undefined) { d.time = val('time'); d.end = val('end'); }
    if (val('rep') !== undefined) d.rep = val('rep');
    if (val('until') !== undefined) d.until = val('until');
    if (val('notif') !== undefined) d[d.allDay ? 'at' : 'notif'] = val('notif');
    if (val('group') !== undefined) d.group = val('group');
    if (val('note') !== undefined) d.note = val('note').trim();
  }
  const redraw = () => { const p = $('#sheet .panel'); if (p) p.innerHTML = '<div class="grab"></div>' + sheetHtml(); };
  const change = (fn) => () => { readSch(); fn(UI.sch); redraw(); };

  CHANGE.schRedraw = change((d) => { if (d.rep === 'custom' && !d.days.length) d.days = [isoDow(parseYmd(d.date))]; });
  ACT.schMode = (el) => change((d) => { d.mode = el.dataset.m; })();
  ACT.schAllDay = change((d) => { d.allDay = !d.allDay; });
  ACT.schDate = (el) => change((d) => { d.date = el.dataset.ds; })();
  ACT.schDay = (el) => change((d) => { const i = Number(el.dataset.d), at = d.days.indexOf(i); if (at >= 0) d.days.splice(at, 1); else d.days.push(i); d.days.sort(); })();
  ACT.schWhen = (el) => change((d) => { d.when = el.dataset.k; })();
  ACT.schDrop = (el) => change((d) => { d.items.splice(Number(el.dataset.i), 1); if (!d.items.length) closeSheet(); })();

  function repOf(d) {
    const date = parseYmd(d.date), dow = isoDow(date), from = d.date;
    let r;
    switch (d.rep) {
      case 'd': r = { k: 'd', from }; break;
      case 'w': r = { k: 'w', days: [dow], from }; break;
      case 'wd': r = { k: 'w', days: [1, 2, 3, 4, 5], from }; break;
      case 'nw': r = { k: 'nw', n: 2, days: [dow], anchor: ymd(mondayOf(date)), from }; break;
      case 'm': r = { k: 'm', dom: date.getDate(), from }; break;
      case 'custom': r = { k: 'w', days: d.days.slice().sort(), from }; break;
      default: return { k: 'once', date: d.date };
    }
    if (d.until && d.until >= from) r.until = d.until;
    return r;
  }

  FORMS.sch = () => {
    readSch();
    const d = UI.sch;
    d.items = d.items.map((x) => x.trim()).filter(Boolean);
    if (!d.items.length) return toast('Judulnya diisi dulu');
    if (d.mode === 'todo') {
      d.items.forEach((x) => addTodo(x, d.when));
      closeSheet(); P.sec = null; P.sel = [];
      render();
      return toast(d.items.length + ' masuk to-do ' + (d.when === 'besok' ? 'besok' : 'malam ini'), null, { act: 'schSeeTodo', label: 'Lihat' });
    }
    if (!d.date) return toast('Tanggalnya diisi dulu');
    if (!d.allDay && !d.time) return toast('Jam mulainya diisi dulu');
    if (d.rep === 'custom' && !d.days.length) return toast('Pilih harinya dulu');
    const base = {
      time: d.allDay ? '' : d.time, end: d.allDay ? '' : (d.end && d.end > d.time ? d.end : ''),
      group: d.group || 'Acara', notify: (d.allDay ? d.at : d.notif) !== 'none', note: d.note, rep: repOf(d), lib: d.sec || undefined,
    };
    if (d.allDay) { if (d.at !== 'none') base.at = d.at; } else if (d.notif !== 'none' && d.notif !== '0') base.before = Number(d.notif);
    if (d.editId) {
      const i = S.tasks.findIndex((t) => t.id === d.editId);
      if (i >= 0) {
        const old = S.tasks[i], title = d.items[0];
        const t = Object.assign({ id: old.id, src: old.src, ord: old.ord, libText: old.libText }, base, { title });
        if (!t.lib) delete t.lib;
        S.tasks[i] = t;
      }
    } else {
      for (const x of d.items) {
        const t = Object.assign({ id: uid(), src: 'user', title: shortTitle(x), ord: 9000 + S.nid }, base);
        if (t.lib) t.libText = x; else delete t.lib;
        if (x !== t.title) t.note = x + (t.note ? '\n' + t.note : '');
        S.tasks.push(t);
      }
    }
    UI.schGo = d.date;
    const n = d.items.length, edit = !!d.editId;
    save(); closeSheet(); P.sec = null; P.sel = [];
    render();
    toast(edit ? 'Jadwal diperbarui' : n + ' jadwal tersimpan', null, { act: 'schSee', label: 'Lihat' });
  };

  ACT.schSee = () => {
    const ds = UI.schGo || todayStr();
    $('#toast').classList.remove('show');
    UI.stack = []; UI.scroll = []; UI.tab = 'cal';
    Object.assign(UI.cal, { sel: ds, start: ds, month: ds.slice(0, 7) });
    render(); window.scrollTo(0, 0);
  };
  ACT.schSeeTodo = () => { $('#toast').classList.remove('show'); UI.stack = []; UI.scroll = []; UI.tab = 'todo'; UI.todoSeg = 'todo'; render(); window.scrollTo(0, 0); };

  /* ---------- editing an entry made here ---------- */
  function draftOf(t) {
    const r = t.rep || { k: 'once', date: todayStr() };
    const date = r.date || r.from || todayStr(), dow = isoDow(parseYmd(date));
    let rep = 'once', days = [dow];
    if (r.k === 'd') rep = 'd';
    else if (r.k === 'nw') rep = 'nw';
    else if (r.k === 'm') rep = 'm';
    else if (r.k === 'w') {
      days = r.days.slice();
      rep = String(r.days) === '1,2,3,4,5' ? 'wd' : r.days.length === 1 && r.days[0] === dow ? 'w' : 'custom';
    }
    const allDay = !t.time;
    return {
      items: [t.title], sec: t.lib || null, mode: 'event', editId: t.id, allDay, date, time: t.time || nextHour(), end: t.end || '',
      rep, days, until: r.until || '', notif: t.notify === false ? 'none' : String(t.before || 0),
      at: t.notify === false || !t.at ? (allDay ? 'none' : '07:00') : t.at, group: t.group || 'Acara', note: t.note || '', when: 'malam',
    };
  }
  ACT.schEdit = (el) => {
    const t = S.tasks.find((x) => x.id === el.dataset.id);
    if (!t) return;
    UI.sch = draftOf(t);
    openSheet(sheetHtml());
    $('#sheet').classList.add('tall');
  };
  ACT.schDel = () => {
    const id = UI.sch && UI.sch.editId, t = S.tasks.find((x) => x.id === id);
    if (!t) return closeSheet();
    const at = S.tasks.indexOf(t);
    S.tasks.splice(at, 1);
    save(); closeSheet(); render();
    toast('Jadwal dihapus', () => { S.tasks.splice(Math.min(at, S.tasks.length), 0, t); });
  };
  // Entries made here open in this sheet from Hari ini / Kalender too.
  const editTask = ACT.editTask;
  ACT.editTask = (el) => { const t = S.tasks.find((x) => x.id === el.dataset.id); if (t && t.src === 'user' && (t.lib || t.before || t.at || (t.rep && (t.rep.from || t.rep.until)))) ACT.schEdit(el); else editTask(el); };

  // closeSheet() also drops the draft; the tall style is only for this sheet.
  const close = closeSheet;
  closeSheet = function () { close(); $('#sheet').classList.remove('tall'); UI.sch = null; };

  // Android back: leave "Pilih" mode first.
  const androidBack = window.onAndroidBack;
  window.onAndroidBack = () => {
    if (P.sec && $('#sheet').hidden) { ACT.schCancel(); return true; }
    return androidBack();
  };
})();
