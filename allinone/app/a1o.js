/* A1O — tambah cepat (pilih kategori sambil lihat isinya), salin ke WhatsApp, dan kunci PIN / password.
 * Loaded after paste.js and before main.js. */
'use strict';
(() => {
  /* ======================= copy (WhatsApp format) ======================= */
  const waText = (title, items) => (title ? '*' + title + '*\n' : '') + items.filter(Boolean).map((x) => '• ' + stripPhotos(x)).join('\n');
  function copyText(text, what) {
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      ok = document.execCommand('copy'); ta.remove();
    } catch (e) { ok = false; }
    if (!ok && navigator.clipboard) { navigator.clipboard.writeText(text).then(() => toast((what || 'Teks') + ' disalin'), () => toast('Gagal menyalin')); return; }
    toast(ok ? (what || 'Teks') + ' disalin — tinggal tempel di WA' : 'Gagal menyalin');
  }
  function sectionText(id) {
    const home = SECTIONS[id];
    if (!home) return '';
    const parts = [];
    let head = titleCase(home.section.title), buf = [];
    const flush = () => { if (buf.length) parts.push(waText(head, buf)); buf = []; };
    for (const b of home.section.blocks) {
      if (b.t === 'h') { flush(); head = titleCase(cleanTitle(b.x)); continue; }
      if (b.t === 'grid' || (b.t === 'check' && b.daily)) {
        const tasks = b.daily ? S.tasks.filter((t) => t.src === 'pulsek') : S.tasks.filter((t) => t.ref === b.id);
        buf.push(...tasks.map((t) => t.title));
      } else buf.push(...blockLines(b));
    }
    flush();
    for (const g of S.pasted.filter((p) => p.sec === id)) parts.push(waText(g.title || 'Catatan', g.items));
    if ((S.notes[id] || []).length) parts.push(waText('Catatan tambahan', S.notes[id]));
    return parts.join('\n\n');
  }
  ACT.copySection = (el) => copyText(sectionText(el.dataset.id), 'Isi bagian ini');
  ACT.copyTodos = (el) => {
    const besok = el.dataset.when === 'besok', ds = besok ? ymd(addDays(new Date(), 1)) : todayStr();
    copyText(waText(besok ? 'To-do besok' : 'To-do malam ini', todosOn(ds).filter((t) => !t.done).map((t) => t.x)), 'To-do');
  };
  /* "Belum selesai kemarin": bold ALL-CAPS short lines (e.g. *BELAJAR*) become WA section headers, everything else a • item */
  const isHead = (x) => { const v = String(x).trim(); return /^\*[^*]+\*$/.test(v) && v.length <= 32 && !/[a-z.?!,]/.test(v); };
  ACT.copyOverdue = () => {
    const out = ['*Belum selesai kemarin*'];
    for (const t of todosOverdue()) {
      const v = stripPhotos(String(t.x)).trim();
      if (!v) continue;
      if (isHead(v)) out.push('', v); else out.push('• ' + v.replace(/^•\s*/, ''));
    }
    copyText(out.join('\n'), 'To-do terlewat');
  };
  ACT.copyReminder = (el) => { const r = S.reminders.find((x) => x.id === el.dataset.id); if (r) copyText(waText('Pengingat ' + r.label.toLowerCase(), r.lines), 'Pengingat'); };
  ACT.copyPasted = (el) => { const g = S.pasted.find((x) => x.id === el.dataset.id); if (g) copyText(waText(g.title || 'Catatan', g.items), 'Catatan'); };
  ACT.copyDest = (el) => { const d = destByKey(el.dataset.k); if (d) copyText(waText(d.label, d.items()), d.label); };
  ACT.copyGroup = (el) => copyText(waText(el.dataset.g, S.tasks.filter((t) => (t.group || 'Lainnya') === el.dataset.g).map((t) => t.title)), el.dataset.g);

  /* ======================= destinations ======================= */
  const GROUP_ICON = { 'Ultimate Goal': '🏆', Target: '🎯', Acara: '📅', 'Jadwal harian': '🕒', 'To Do Pulsek': '🎒', Belajar: '📚', Mingguan: '🗓️', Bulanan: '📆', Proyek: '🛠️', Sosial: '🤝', 'For Fun': '🎮' };
  function dests() {
    const out = [], today = todayStr(), tomorrow = ymd(addDays(new Date(), 1));
    const todoAdd = (when) => (lines) => lines.forEach((x) => addTodo(x, when));
    out.push({ key: 'todo:malam', cat: 'Cepat', icon: '🌙', label: 'To-do malam ini', items: () => todosOn(today).filter((t) => !t.done).map((t) => t.x), add: todoAdd('malam'), open: () => openTab('todo') });
    out.push({ key: 'todo:besok', cat: 'Cepat', icon: '🌤️', label: 'To-do besok', items: () => todosOn(tomorrow).filter((t) => !t.done).map((t) => t.x), add: todoAdd('besok'), open: () => openTab('todo') });
    out.push({ key: 'deadline', cat: 'Cepat', icon: '⏰', label: 'Deadline (tanpa tanggal)', items: () => dlOpen().map((n) => n.text), add: (lines) => lines.forEach((x) => S.deadlines.push({ id: uid(), text: x, due: null, fast: false, done: false, created: Date.now(), doneAt: 0 })), open: () => ACT.openDeadlines() });
    for (const r of S.reminders) {
      out.push({ key: 'rem:' + r.id, cat: 'Pengingat harian', icon: r.icon || '🔔', label: 'Pengingat ' + r.label.toLowerCase(), sub: (r.time || '') + (r.timeWE && r.timeWE !== r.time ? ' · libur ' + r.timeWE : ''), items: () => r.lines, add: (lines) => r.lines.push(...lines), open: () => openTab('more') });
    }
    const groups = [...new Set(GROUP_ORDER.concat(S.tasks.map((t) => t.group).filter(Boolean)))];
    for (const g of groups) {
      const list = () => S.tasks.filter((t) => t.group === g);
      if (!list().length && !['Ultimate Goal', 'Target', 'Belajar', 'Proyek'].includes(g)) continue;
      out.push({
        key: 'grp:' + g, cat: 'Kegiatan & tujuan', icon: GROUP_ICON[g] || '📌', label: g, sub: 'tanpa jam — atur jadwalnya nanti kalau perlu', items: () => list().map((t) => t.title),
        add: (lines) => {
          const ref = (list().find((t) => t.ref) || {}).ref;
          for (const x of lines) S.tasks.push(Object.assign({ id: uid(), src: 'user', group: g, title: x, cat: '', time: '', end: '', rep: { k: 'none' }, ord: 9000 + S.nid, notify: true }, ref ? { ref } : {}));
        },
        open: () => go({ v: 'manage' }),
      });
    }
    for (const sheet of DATA.sheets) for (const section of sheet.sections) {
      // One entry per heading: lists without their own title take the nearest heading above them,
      // and lists that end up with the same name in the same section are merged into ONE entry
      // (shows all their items; new items go to the last of them). Fixes the "clone" rows in the + menu.
      const secName = titleCase(cleanTitle(section.title) || section.title);
      const byLabel = new Map();
      let head = '';
      for (const b of section.blocks) {
        if (b.t === 'h') { head = cleanTitle(b.x); continue; }
        if (!((b.t === 'check' && !b.daily && !b.day) || b.t === 'ul')) continue;
        const label = titleCase(cleanTitle(b.title) || head || secName);
        if (!byLabel.has(label)) byLabel.set(label, []);
        byLabel.get(label).push(b);
      }
      for (const [label, blocks] of byLabel) {
        const last = blocks[blocks.length - 1];
        out.push({ key: 'list:' + blocks[0].id, alias: blocks.slice(1).map((b) => 'list:' + b.id), cat: 'List', icon: sheet.icon, label, sub: label === secName ? titleCase(sheet.title) : secName + ' · ' + titleCase(sheet.title), items: () => blocks.flatMap((b) => listItems(b).map((i) => i.x)), add: (lines) => editList(last, (l) => lines.forEach((x) => l.push({ x }))), open: () => go({ v: 'section', id: section.id }) });
      }
      out.push({
        key: 'sec:' + section.id, cat: 'Catatan', icon: sheet.icon, label: titleCase(section.title), sub: 'Catatan bebas · ' + titleCase(sheet.title),
        items: () => S.pasted.filter((p) => p.sec === section.id).flatMap((p) => p.items).concat(S.notes[section.id] || []),
        add: (lines) => { (S.notes[section.id] = S.notes[section.id] || []).push(...lines); },
        open: () => go({ v: 'section', id: section.id, focus: 'notes' }),
      });
    }
    return out;
  }
  function destByKey(k) { return dests().find((d) => d.key === k || (d.alias && d.alias.includes(k))); }
  function openTab(tab) { UI.stack = []; UI.scroll = []; UI.tab = tab; render(); window.scrollTo(0, 0); }
  const recent = () => [...new Set((S.settings.qaRecent || []).map((k) => { const d = destByKey(k); return d && d.key; }).filter(Boolean))];
  function remember(k) { S.settings.qaRecent = [k].concat(recent().filter((x) => x !== k)).slice(0, 4); }

  /** The category list. Tapping one selects it and shows what is already inside. */
  function pickerHtml(sel, q, act) {
    const all = dests(), needle = (q || '').toLowerCase().trim();
    const match = (d) => !needle || (d.label + ' ' + (d.sub || '') + ' ' + d.cat).toLowerCase().includes(needle);
    const row = (d) => {
      const on = d.key === sel, items = d.items();
      return `<div class="pk${on ? ' on' : ''}"><button type="button" class="pkrow" data-act="${act}" data-k="${esc(d.key)}"><span class="ico">${d.icon}</span><span class="grow"><b>${esc(d.label)}</b>${d.sub ? `<small>${esc(d.sub)}</small>` : ''}</span><span class="count">${items.length}</span></button>
        ${on ? `<div class="pkprev">${items.length ? `<ul>${items.slice(0, 8).map((x) => `<li>${rich(x)}</li>`).join('')}</ul>${items.length > 8 ? `<p class="muted small">+ ${items.length - 8} lagi</p>` : ''}` : '<p class="muted small">Masih kosong.</p>'}
          <div class="pktools"><button type="button" class="link" data-act="copyDest" data-k="${esc(d.key)}">Salin isinya</button></div></div>` : ''}</div>`;
    };
    const recKeys = needle ? [] : recent(), rec = recKeys.map((k) => all.find((d) => d.key === k)).filter(Boolean);
    let html = rec.length ? `<p class="pkcat">Terakhir dipakai</p>${rec.map(row).join('')}` : '';
    const cats = [...new Set(all.map((d) => d.cat))];
    for (const c of cats) {
      const list = all.filter((d) => d.cat === c && match(d) && !recKeys.includes(d.key));
      if (list.length) html += `<p class="pkcat">${esc(c)}</p>${list.map(row).join('')}`;
    }
    return html || '<p class="muted small" style="padding:10px 4px">Nggak ada kategori yang cocok.</p>';
  }

  /* ======================= tambah cepat ======================= */
  UI.qa = { text: '', split: null, sel: null, q: '' };
  const qaLines = () => {
    const raw = UI.qa.text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
    const split = UI.qa.split == null ? raw.length > 1 : UI.qa.split;
    if (!split) return raw.length ? [UI.qa.text.trim()] : [];
    return raw.map((l) => l.replace(/^([•◦▪●\-–]|\d{1,2}[.)])\s+/, '').trim()).filter(Boolean);
  };
  function qaHtml() {
    const Q = UI.qa, lines = qaLines(), d = Q.sel ? destByKey(Q.sel) : null;
    const multi = UI.qa.text.split('\n').filter((l) => l.trim()).length > 1;
    const split = Q.split == null ? multi : Q.split;
    return `<h2>Tambah cepat</h2>
      <div class="card composer qa"><textarea rows="3" placeholder="Tulis apa aja… (bisa banyak baris)" data-input="qaText">${esc(Q.text)}</textarea>
        ${Q.photo ? `<div class="qaphoto"><img src="${Q.photo}"><button type="button" class="link" data-act="qaPhotoDel">Hapus foto</button></div>` : `<div class="qapaste" contenteditable="true" data-paste="photo">📷 Tempel foto di sini (tahan → Tempel / Paste)</div>`}
        ${multi ? `<div class="chips"><button type="button" class="chip${split ? ' on' : ''}" data-act="qaSplit" data-v="1">Tiap baris = 1 item (${lines.length && split ? lines.length : UI.qa.text.split('\n').filter((l) => l.trim()).length})</button><button type="button" class="chip${!split ? ' on' : ''}" data-act="qaSplit" data-v="0">Jadi 1 item</button></div>` : ''}</div>
      <div class="field" style="margin:4px 0 6px"><span class="lab">Simpan ke mana?</span></div>
      <div class="search small">${ICON.search}<input type="search" placeholder="Cari kategori…" value="${esc(Q.q)}" data-input="qaQ" autocomplete="off"></div>
      <div id="qapick">${pickerHtml(Q.sel, Q.q, 'qaPick')}</div>
      <div class="qafoot"><button class="btn wide" data-act="qaSave"${d ? '' : ' disabled'}>${d ? 'Simpan ke ' + esc(d.label) : 'Pilih kategori dulu'}</button></div>`;
  }
  const redrawQa = () => { const p = $('#sheet .panel'); if (!p) return; const y = p.scrollTop; p.innerHTML = '<div class="grab"></div>' + qaHtml(); p.scrollTop = y; };
  ACT.quickAdd = () => { UI.qa = { text: '', split: null, sel: recent()[0] || null, q: '' }; openSheet(qaHtml()); $('#sheet').classList.add('tall'); const t = $('textarea[data-input="qaText"]'); if (t) t.focus(); };
  ACT.qaPick = (el) => { UI.qa.sel = UI.qa.sel === el.dataset.k ? null : el.dataset.k; redrawQa(); };
  ACT.qaPhotoDel = () => { UI.qa.photo = null; redrawQa(); };
  const shrinkPhoto = (blob) => new Promise((ok, bad) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = bad; im.src = u; });
  document.addEventListener('paste', (e) => {
    if (!UI.qa || !$('#sheet .qa')) return;
    const f = [...((e.clipboardData && e.clipboardData.items) || [])].find((i) => i.type && i.type.startsWith('image/'));
    if (!f) { if (e.target.dataset && e.target.dataset.paste) { e.preventDefault(); toast('Yang ditempel bukan foto'); } return; }
    e.preventDefault();
    shrinkPhoto(f.getAsFile()).then((d) => { UI.qa.photo = d; redrawQa(); toast('Foto ditempel'); }).catch(() => toast('Foto gagal dibaca'));
  });
  ACT.qaSplit = (el) => { UI.qa.split = el.dataset.v === '1'; redrawQa(); };
  ACT.qaSave = () => {
    const lines = qaLines(), d = UI.qa.sel && destByKey(UI.qa.sel);
    if (UI.qa.photo) { const pid = 'p' + Date.now().toString(36); (S.photos = S.photos || {})[pid] = UI.qa.photo; if (lines.length) lines[0] = '[[foto:' + pid + ']] ' + lines[0]; else lines.push('[[foto:' + pid + ']]'); }
    if (!lines.length) { toast('Tulis dulu yang mau ditambah'); const t = $('textarea[data-input="qaText"]'); if (t) t.focus(); return; }
    if (!d) return toast('Pilih kategorinya dulu');
    d.add(lines); remember(d.key); save(); closeSheet(); render();
    UI.qaOpen = d.key;
    toast(lines.length + ' item masuk ke ' + d.label, null, { act: 'qaOpenDest', label: 'Lihat' });
  };
  ACT.qaOpenDest = () => { const d = destByKey(UI.qaOpen); $('#toast').classList.remove('show'); if (d && d.open) d.open(); };
  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.input;
    if (k === 'qaText') {
      const before = UI.qa.text.split('\n').filter((l) => l.trim()).length > 1;
      UI.qa.text = e.target.value;
      const after = UI.qa.text.split('\n').filter((l) => l.trim()).length > 1;
      if (before !== after) { const pos = e.target.selectionStart; redrawQa(); const t = $('textarea[data-input="qaText"]'); if (t) { t.focus(); t.setSelectionRange(pos, pos); } }
    }
    if (k === 'qaQ') { UI.qa.q = e.target.value; $('#qapick').innerHTML = pickerHtml(UI.qa.sel, UI.qa.q, 'qaPick'); }
    if (k === 'ppQ') { UI.pp.q = e.target.value; $('#pppick').innerHTML = pickerHtml(UI.pp.sel, UI.pp.q, 'ppPick'); }
  });

  /* ---- picker for "Tempel catatan" groups ---- */
  UI.pp = { i: 0, sel: null, q: '' };
  const ppHtml = () => `<h2>Simpan kelompok ini ke…</h2>
    <div class="search small">${ICON.search}<input type="search" placeholder="Cari kategori…" value="${esc(UI.pp.q)}" data-input="ppQ" autocomplete="off"></div>
    <div id="pppick">${pickerHtml(UI.pp.sel, UI.pp.q, 'ppPick')}</div>
    <div class="qafoot"><button class="btn wide" data-act="ppDone">Pakai kategori ini</button></div>`;
  ACT.ppOpen = (el) => { const g = UI.p.groups[Number(el.dataset.i)]; UI.pp = { i: Number(el.dataset.i), sel: g.dest.startsWith('paste:') ? 'sec:' + g.dest.slice(6) : g.dest, q: '' }; openSheet(ppHtml()); $('#sheet').classList.add('tall'); };
  ACT.ppPick = (el) => { UI.pp.sel = el.dataset.k; const p = $('#sheet .panel'), y = p.scrollTop; p.innerHTML = '<div class="grab"></div>' + ppHtml(); p.scrollTop = y; };
  ACT.ppDone = () => { const g = UI.p.groups[UI.pp.i]; if (g && UI.pp.sel) g.dest = UI.pp.sel.startsWith('sec:') ? 'paste:' + UI.pp.sel.slice(4) : UI.pp.sel; closeSheet(); render(); };

  /* ======================= lock (PIN / password) ======================= */
  // Small SHA-256 so the PIN is never stored as plain text (works without crypto.subtle).
  function sha256(str) {
    const K = [], H = [];
    let n = 2, c = 0;
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    while (c < 64) { let p = true; for (let i = 2; i * i <= n; i++) if (n % i === 0) { p = false; break; } if (p) { if (c < 8) H[c] = frac(Math.pow(n, 1 / 2)); K[c++] = frac(Math.pow(n, 1 / 3)); } n++; }
    const bytes = unescape(encodeURIComponent(str)).split('').map((ch) => ch.charCodeAt(0));
    const l = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
    const rr = (x, y) => (x >>> y) | (x << (32 - y));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = [];
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) { const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, b, cc, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, cc, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
    }
    return H.map((v) => ('00000000' + (v >>> 0).toString(16)).slice(-8)).join('');
  }
  const L = { open: false, entry: '', tries: 0, waitUntil: 0, hiddenAt: 0, setup: null };
  const lockOn = () => !!(S.lock && S.lock.hash);
  const check = (v) => sha256(S.lock.salt + '|' + v) === S.lock.hash;

  function lockHtml() {
    const pin = S.lock.type === 'pin', wait = L.waitUntil > Date.now() ? Math.ceil((L.waitUntil - Date.now()) / 1000) : 0;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    return `<div class="lk-shade"></div><div class="lk-in">
      <div class="lk-top"><div class="lk-logo">A1O</div><p class="lk-msg">${wait ? 'Coba lagi dalam ' + wait + ' detik' : pin ? 'Masukkan PIN' : 'Masukkan password'}</p>
        ${pin ? `<div class="lk-dots">${Array.from({ length: S.lock.len || 4 }, (_, i) => `<i class="${i < L.entry.length ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>
      ${pin ? `<div class="lk-pad">${keys.map((k) => (k ? `<button data-lk="${k}"${wait ? ' disabled' : ''}>${k}</button>` : '<span></span>')).join('')}</div>`
        : `<form class="lk-pass" data-form="lkPass"><input type="password" name="p" placeholder="Password" autocomplete="current-password"${wait ? ' disabled' : ''}><button class="btn wide"${wait ? ' disabled' : ''}>Buka</button></form>`}
      <button class="lk-forgot" data-act="lkForgot">Lupa ${pin ? 'PIN' : 'password'}?</button></div>`;
  }
  function showLock() {
    if (!lockOn()) return;
    const el = $('#lock');
    L.open = true; L.entry = '';
    closeSheet();
    el.innerHTML = lockHtml(); el.hidden = false;
    document.documentElement.classList.add('locked');
    if (S.lock.type !== 'pin') setTimeout(() => { const i = el.querySelector('input'); if (i) i.focus(); }, 60);
  }
  function unlock() {
    L.open = false; L.tries = 0; L.entry = '';
    const el = $('#lock'); el.hidden = true; el.innerHTML = '';
    document.documentElement.classList.remove('locked');
  }
  function wrong() {
    L.tries++; L.entry = '';
    if (L.tries >= 5) { L.waitUntil = Date.now() + 30000; L.tries = 0; const tick = setInterval(() => { if (!L.open) return clearInterval(tick); $('#lock').innerHTML = lockHtml(); if (Date.now() > L.waitUntil) clearInterval(tick); }, 1000); }
    const el = $('#lock'); el.innerHTML = lockHtml();
    const box = el.querySelector('.lk-dots, .lk-pass'); if (box) { box.classList.add('shake'); }
    if (navigator.vibrate) navigator.vibrate(120);
  }
  function pinKey(k) {
    if (L.waitUntil > Date.now()) return;
    if (k === '⌫') L.entry = L.entry.slice(0, -1);
    else if (L.entry.length < (S.lock.len || 4)) L.entry += k;
    if (L.entry.length === (S.lock.len || 4)) {
      if (check(L.entry)) { $('#lock').innerHTML = lockHtml(); return setTimeout(unlock, 90); }
      return setTimeout(wrong, 120);
    }
    $('#lock').innerHTML = lockHtml();
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-lk]'); if (b && L.open) pinKey(b.dataset.lk); });
  FORMS.lkPass = (f) => { if (L.waitUntil > Date.now()) return; if (check(f.elements.p.value)) unlock(); else wrong(); };
  ACT.lkForgot = () => {
    openSheet(`<h2>Lupa ${S.lock.type === 'pin' ? 'PIN' : 'password'}?</h2><p class="muted" style="margin-bottom:14px">${S.lock.type === 'pin' ? 'PIN' : 'Password'} nggak bisa dilihat atau direset — itu yang bikin datamu aman. Satu-satunya cara: hapus semua data di HP ini, terus pulihin dari file backup.</p>
      <div class="btnrow"><button class="btn danger wide" data-act="lkWipe">Hapus data & buka</button><button class="btn ghost wide" data-act="closeSheet">Batal</button></div>`);
    $('#sheet').classList.add('over');
  };
  ACT.lkWipe = () => { localStorage.removeItem(LS_KEY); loadState(); S.lock = null; if (window.Money) Money.reset(); saveNow(); unlock(); closeSheet(); UI.stack = []; UI.tab = 'today'; render(); toast('Data dihapus. Pulihkan backup di Lainnya.'); };
  // Lock again when the app comes back after being in the background.
  document.addEventListener('visibilitychange', () => {
    if (!lockOn()) return;
    if (document.hidden) { L.hiddenAt = Date.now(); if (!S.lock.after) showLock(); }
    else if (!L.open && L.hiddenAt && Date.now() - L.hiddenAt >= (S.lock.after || 0) * 1000) showLock();
  });
  // Coming back to the app re-syncs, which also stops the remaining "getar ±20 detik" repeats.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNotifications(); });
  const nativeOpen = window.onNativeOpen;
  window.onNativeOpen = () => { nativeOpen(); if (lockOn() && !L.open && L.hiddenAt && Date.now() - L.hiddenAt >= (S.lock.after || 0) * 1000) showLock(); };
  const androidBack = window.onAndroidBack;
  window.onAndroidBack = () => (L.open ? $('#sheet').hidden ? false : (closeSheet(), true) : androidBack());

  /* ---- settings: set / change / remove ---- */
  function setupHtml() {
    const s = L.setup, pin = s.type === 'pin';
    const msg = s.step === 'old' ? 'Masukkan ' + (S.lock.type === 'pin' ? 'PIN' : 'password') + ' sekarang' : s.step === 'confirm' ? 'Ulangi sekali lagi' : pin ? 'Bikin PIN 4–6 angka' : 'Bikin password (min. 4 karakter)';
    return `<h2>${s.mode === 'off' ? 'Matikan kunci' : 'Kunci aplikasi'}</h2>
      ${s.step === 'new' ? `<div class="seg wide"><button type="button" class="${pin ? 'on' : ''}" data-act="lkType" data-t="pin">PIN</button><button type="button" class="${!pin ? 'on' : ''}" data-act="lkType" data-t="pass">Password</button></div>` : ''}
      <form data-form="lkSetup"><div class="field"><label>${msg}</label>
        <input name="v" type="password" ${(s.step === 'old' ? S.lock.type === 'pin' : pin) ? 'inputmode="numeric" pattern="[0-9]*" maxlength="6"' : ''} autocomplete="off" required style="width:100%;font-size:22px;letter-spacing:.3em;padding:10px 12px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg)"></div>
        <button class="btn wide">${s.step === 'confirm' ? 'Simpan' : 'Lanjut'}</button></form>`;
  }
  const redrawSetup = () => { const p = $('#sheet .panel'); p.innerHTML = '<div class="grab"></div>' + setupHtml(); const i = p.querySelector('input'); if (i) i.focus(); };
  ACT.lkSet = () => { L.setup = { mode: 'set', type: (S.lock && S.lock.type) || 'pin', step: lockOn() ? 'old' : 'new' }; openSheet(setupHtml()); setTimeout(() => { const i = $('#sheet input'); if (i) i.focus(); }, 60); };
  ACT.lkOff = () => { L.setup = { mode: 'off', type: S.lock.type, step: 'old' }; openSheet(setupHtml()); setTimeout(() => { const i = $('#sheet input'); if (i) i.focus(); }, 60); };
  ACT.lkType = (el) => { L.setup.type = el.dataset.t; redrawSetup(); };
  FORMS.lkSetup = (f) => {
    const s = L.setup, v = f.elements.v.value;
    if (s.step === 'old') {
      if (!check(v)) { toast('Salah'); f.elements.v.value = ''; return; }
      if (s.mode === 'off') { S.lock = null; save({ sync: false }); closeSheet(); render(); return toast('Kunci dimatikan'); }
      s.step = 'new'; return redrawSetup();
    }
    if (s.step === 'new') {
      if (s.type === 'pin' && !/^\d{4,6}$/.test(v)) { toast('PIN harus 4–6 angka'); return; }
      if (s.type === 'pass' && v.length < 4) { toast('Password minimal 4 karakter'); return; }
      s.first = v; s.step = 'confirm'; return redrawSetup();
    }
    if (v !== s.first) { toast('Nggak sama, ulangi dari awal'); s.step = 'new'; s.first = ''; return redrawSetup(); }
    const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
    S.lock = { type: s.type, len: s.type === 'pin' ? v.length : 0, salt, hash: sha256(salt + '|' + v), after: S.lock ? S.lock.after || 0 : 0 };
    save({ sync: false }); closeSheet(); render(); toast(s.type === 'pin' ? 'PIN disimpan' : 'Password disimpan');
  };
  CHANGE.lkAfter = (el) => { if (S.lock) { S.lock.after = Number(el.value); save({ sync: false }); } };
  ACT.lkNow = () => showLock();
  function settingsHtml() {
    const on = lockOn();
    return `<h2 class="sec">Keamanan</h2><div class="card">
      <div class="rowline"><div class="grow"><b>Kunci aplikasi</b><small>${on ? (S.lock.type === 'pin' ? 'PIN ' + (S.lock.len || 4) + ' angka' : 'Password') + ' aktif' : 'Isi aplikasi ketutup sampai PIN / password dimasukin'}</small></div><button class="switch${on ? ' on' : ''}" data-act="${on ? 'lkOff' : 'lkSet'}" aria-label="Kunci aplikasi"></button></div>
      ${on ? `<div class="rowline"><div class="grow"><b>Kunci lagi setelah</b><small>Aplikasi ditinggal ke layar lain</small></div><select data-change="lkAfter">${[[0, 'Langsung'], [60, '1 menit'], [300, '5 menit'], [900, '15 menit']].map(([v, l]) => `<option value="${v}"${(S.lock.after || 0) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="btnrow" style="margin-top:10px"><button class="btn ghost" data-act="lkSet">Ganti ${S.lock.type === 'pin' ? 'PIN' : 'password'}</button><button class="btn ghost" data-act="lkNow">Kunci sekarang</button></div>` : ''}
    </div>`;
  }

  /* ---- reminders: add a new daily reminder slot ---- */
  ACT.remNew = () => openSheet(`<h2>Pengingat baru</h2><form data-form="remNew">
      <div class="field"><label>Nama</label><input name="label" placeholder="Contoh: Malam" required autocomplete="off"></div>
      <div class="field"><div class="row"><div><label>Senin – Jumat</label><input type="time" name="time" value="19:00" required></div><div><label>Sabtu – Minggu</label><input type="time" name="timeWE" value="19:00"></div></div></div>
      <div class="field"><label>Ikon</label><div class="chips">${['🔔', '🌙', '📚', '💪', '🕌', '💰', '❤️', '⭐'].map((i, n) => `<label class="chip${n ? '' : ' on'}"><input type="radio" name="icon" value="${i}"${n ? '' : ' checked'} style="display:none">${i}</label>`).join('')}</div></div>
      <button class="btn wide">Tambah</button></form>`);
  FORMS.remNew = (f) => {
    const label = f.elements.label.value.trim();
    if (!label) return;
    const icon = (f.querySelector('input[name="icon"]:checked') || {}).value || '🔔';
    S.reminders.push({ on: true, id: 'r' + Date.now().toString(36), label, icon, time: f.elements.time.value, timeWE: f.elements.timeWE.value || f.elements.time.value, lines: [] });
    save(); closeSheet(); render(); toast('Pengingat ' + label + ' ditambah — isi kalimatnya di bawah');
  };
  ACT.remDel = (el) => {
    const r = S.reminders[Number(el.dataset.r)], before = S.reminders.slice();
    S.reminders.splice(Number(el.dataset.r), 1); save(); render();
    toast('Pengingat ' + r.label + ' dihapus', () => { S.reminders = before; });
  };
  document.addEventListener('change', (e) => { if (e.target.name === 'icon') e.target.closest('.chips').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.contains(e.target))); });

  /* ======================= pinned (📌) sections on the Hari ini screen ======================= */
  const pins = () => (S.pins = (S.pins || []).filter((id) => SECTIONS[id]));
  ACT.pinToggle = (el, ev) => {
    if (ev) ev.stopPropagation();
    const id = el.dataset.id, list = pins(), i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.unshift(id);
    save({ sync: false }); render();
    toast(i >= 0 ? 'Dilepas dari Hari ini' : 'Disematkan di atas Hari ini');
  };
  ACT.pinMore = (el) => { UI.pinOpen = UI.pinOpen || {}; UI.pinOpen[el.dataset.id] = !UI.pinOpen[el.dataset.id]; render(); };
  ACT.pinUp = (el) => { const list = pins(), i = list.indexOf(el.dataset.id); if (i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); save({ sync: false }); render(); } };
  function pinCard(id) {
    const home = SECTIONS[id], open = UI.pinOpen && UI.pinOpen[id];
    const lines = sectionText(id).split('\n').filter((l) => l.trim());
    const shown = open ? lines : lines.slice(0, 8);
    const body = shown.map((l) => (/^\*.+\*$/.test(l) ? `<div class="pinh">${esc(l.slice(1, -1))}</div>` : `<div class="pinl">${rich(l.replace(/^• /, ''))}</div>`)).join('');
    const first = pins()[0] === id;
    return `<div class="card pincard"><header><h3>📌 ${esc(titleCase(home.section.title))}</h3>
      ${first ? '' : `<button class="link" data-act="pinUp" data-id="${esc(id)}" aria-label="Naikkan">↑</button>`}
      <button class="link" data-act="openSection" data-id="${esc(id)}">Buka</button><button class="link" data-act="pinToggle" data-id="${esc(id)}">Lepas</button></header>
      ${body || '<p class="muted small">Masih kosong.</p>'}
      ${lines.length > 8 ? `<button class="link" data-act="pinMore" data-id="${esc(id)}">${open ? 'Tutup' : 'Lihat semua (' + lines.length + ')'}</button>` : ''}</div>`;
  }
  const baseToday = VIEWS.today;
  VIEWS.today = (...a) => {
    const html = baseToday(...a), list = pins();
    if (!list.length) return html;
    const block = `<h2 class="sec"><span class="grow">📌 Disematkan</span></h2>` + list.map(pinCard).join('');
    const k = html.indexOf('</header>');
    return k < 0 ? block + html : html.slice(0, k + 9) + block + html.slice(k + 9);
  };
  const baseSection = VIEWS.section;
  VIEWS.section = (v) => {
    const html = baseSection(v), on = pins().includes(v.id);
    return html.replace('</h1>', `</h1><button class="link pinbtn${on ? ' on' : ''}" data-act="pinToggle" data-id="${esc(v.id)}" aria-label="${on ? 'Lepas sematan' : 'Sematkan'}">${on ? '📌 Lepas' : '📌 Sematkan'}</button>`);
  };

  /* ======================= Salin on every card ======================= */
  const ROWS = '.it, .dl, .m-row, li, tr, .rowline, dl > div, .m-grp';
  function toWA(node) {
    if (!node) return '';
    const c = node.cloneNode(true);
    c.querySelectorAll('button, .meta, .tag, svg, input, select, textarea, .acts, .lvpill').forEach((e) => e.remove());
    c.querySelectorAll('img').forEach((e) => e.replaceWith('📷 '));
    c.querySelectorAll('br').forEach((e) => e.replaceWith('\n'));
    c.querySelectorAll('a').forEach((e) => { const h = e.getAttribute('href') || ''; if (/^https?:/.test(h) && e.textContent.trim() !== h) e.replaceWith(/^https?:/.test(e.textContent.trim()) ? h : (e.textContent.trim() === '↗' ? h : e.textContent + ' ' + h)); });
    c.querySelectorAll('b, strong').forEach((e) => e.replaceWith('*' + e.textContent + '*'));
    return c.textContent.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }
  function rowText(r) {
    if (r.querySelector('input, select, textarea, .switch')) return '';
    const t = r.querySelector('.t');
    if (t) { const n = r.querySelector('.n'); return toWA(t) + (n ? ' — ' + toWA(n) : ''); }
    const nm = r.querySelector('.m-name');
    if (nm) { const a = r.querySelector('.m-amt'); return toWA(nm) + (a && a.textContent.trim() ? ' — ' + a.textContent.trim() : ''); }
    if (r.matches('dl > div')) { const dt = r.querySelector('dt'), dd = r.querySelector('dd'); return [dt && dt.textContent.trim(), dd && dd.textContent.trim()].filter(Boolean).join(': '); }
    if (r.classList.contains('m-grp')) return [...r.children].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ');
    if (r.tagName === 'TR') return [...r.children].map((td) => toWA(td)).filter(Boolean).join(' | ');
    if (r.classList.contains('rowline')) { const b = r.querySelector('b'), sm = r.querySelector('small'); return [b && b.textContent.trim(), sm && sm.textContent.trim()].filter(Boolean).join(' — '); }
    return toWA(r);
  }
  function cardLines(card) {
    const rows = [...card.querySelectorAll(ROWS)].filter((r) => !r.closest('form') && !(r.parentElement && r.parentElement.closest(ROWS) && r.parentElement.closest('.card') === card && r.parentElement.closest(ROWS) !== r));
    return rows.map(rowText).filter(Boolean);
  }
  function cardTitle(card) {
    const h = card.querySelector(':scope > header h3');
    if (h) return h.textContent.trim();
    for (let el = card; el && el.id !== 'view'; el = el.parentElement) {
      for (let p = el.previousElementSibling; p; p = p.previousElementSibling) {
        if (/^H[123]$/.test(p.tagName)) return p.textContent.trim();
        if (p.classList.contains('card')) break;
      }
    }
    return '';
  }
  ACT.copyCard = (el) => {
    const card = el.closest('.card'), lines = card ? cardLines(card) : [];
    if (!lines.length) { toast('Nggak ada isi buat disalin'); return; }
    const title = cardTitle(card);
    copyText((title ? '*' + title.replace(/^[^\p{L}\p{N}*]+/u, '').trim() + '*\n' : '') + lines.map((x) => '• ' + x.replace(/^•\s*/, '')).join('\n'), title || 'Isi');
  };
  ACT.copyTrash = () => copyText(waText('To-do yang dihapus', (S.trash || []).filter((e) => e.kind === 'todo').map((e) => e.label)), 'To-do yang dihapus');
  ACT.copySheet = (el) => {
    const sheet = DATA.sheets.find((s) => s.id === el.dataset.id);
    if (sheet) copyText(sheet.sections.map((sec) => sectionText(sec.id)).filter(Boolean).join('\n\n'), sheet.title);
  };
  ACT.copyPage = () => {
    const parts = [...document.querySelectorAll('#view .card')].map((c) => { const l = cardLines(c); if (!l.length) return ''; const t = cardTitle(c); return (t ? '*' + t + '*\n' : '') + l.map((x) => '• ' + x).join('\n'); }).filter(Boolean);
    if (parts.length) copyText(parts.join('\n\n'), 'Isi halaman'); else toast('Nggak ada isi buat disalin');
  };
  const hasCopy = (el) => el && el.querySelector('[data-act^="copy"]');
  function addSalin() {
    const view = document.getElementById('view');
    if (!view) return;
    const top = UI.stack[UI.stack.length - 1];
    const bar = view.querySelector(':scope > .bar');
    if (bar && !hasCopy(bar) && top) {
      const b = document.createElement('button'); b.className = 'link'; b.textContent = 'Salin';
      if (top.v === 'sheet') { b.dataset.act = 'copySheet'; b.dataset.id = top.id; bar.appendChild(b); }
      else if (view.querySelector('.card')) { b.dataset.act = 'copyPage'; bar.appendChild(b); }
    }
    for (const card of view.querySelectorAll('.card')) {
      if (hasCopy(card.querySelector(':scope > header')) || hasCopy(card.querySelector(':scope > .tools'))) continue;
      if (card.querySelector(':scope > .tools [data-act^="copy"]') || card.querySelector('textarea[data-change="itemText"]')) continue;
      const rem = card.querySelector('textarea[data-change="remLine"]');
      const isTrash = /Baru dihapus/.test((card.querySelector(':scope > header h3') || {}).textContent || '') && (S.trash || []).some((e) => e.kind === 'todo');
      if (!rem && !isTrash && !cardLines(card).length) continue;
      const b = document.createElement('button'); b.dataset.act = 'copyCard'; b.textContent = 'Salin';
      if (rem) { const r = S.reminders[+rem.dataset.r]; if (!r) continue; b.dataset.act = 'copyReminder'; b.dataset.id = r.id; }
      if (isTrash) b.dataset.act = 'copyTrash';
      const head = card.querySelector(':scope > header'), tools = card.querySelector(':scope > .tools');
      if (head) { b.className = 'link'; head.appendChild(b); }
      else if (tools) tools.insertBefore(b, tools.firstChild);
      else { const t = document.createElement('div'); t.className = 'tools'; t.appendChild(b); card.insertBefore(t, card.firstChild); }
    }
  }
  const baseRender = render;
  render = function () { baseRender.apply(this, arguments); try { addSalin(); } catch (e) { /* never break the screen for a copy button */ } };
  window.A1O = { copyText, waText, sectionText, dests, destByKey, settingsHtml, showLock, lockOn, sha256 };
})();
