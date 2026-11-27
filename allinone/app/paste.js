/* A1O — "Tempel catatan": paste a pile of notes, get them split into groups and filed under sections.
 *
 * Works offline with plain rules. A line like *Judul* (or "Judul:") starts a group; bullets and plain lines
 * become its items; chat prefixes such as "[16/11, 01:11] Nama:" are dropped. Each group is matched to the
 * section whose own words it shares most, and the preview lets the user change that before anything is saved. */
'use strict';
(() => {
  UI.p = { text: '', groups: null };
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  // Everyday words that point at a kind of section; matched against section and sheet titles.
  const HINTS = [
    [/belajar|materi|ppt|soal|rumus|hafal|ujian|ulangan|tanya claude/i, 'study belajar'],
    [/sekolah|mapel|pelajaran|guru|kelas|seragam|informasi|anak-anak|osis|jam pelajaran|kartu pelajar/i, 'school sekolah jadwal kegiatan'],
    [/prinsip|hidup|mindset|pikiran|sabar|ikhlas/i, 'prinsip hidup'],
    [/reward|reminder|inget|ingat|jangan lupa|males/i, 'catatan reminder'],
    [/doa|sholat|quran|ibadah/i, 'doa ibadah'],
    [/daily|harian|tiap hari|rutin/i, 'jadwal harian'],
    [/kucing|cat\b/i, 'kucing'],
    [/mandi|skincare|sunscreen|facial/i, 'mandi routine'],
    [/beli|belanja|shopee|tokopedia/i, 'buy belanja'],
    [/uang|duit|rp\b|invest|saham|crypto|trading|gaji|bisnis|affiliate/i, 'keuangan uang earn'],
    [/gym|workout|protein|creatine|lifting/i, 'gym'],
    [/nonton|anime|film|series|game|wishlist|buku|book/i, 'hiburan wishlist'],
    [/umroh|paspor|mekah/i, 'umroh'],
    [/tiktok|instagram|facebook|https?:\/\//i, 'link sosmed'],
  ];
  const words = (s) => (String(s).toLowerCase().match(/[a-zà-ÿ0-9]{3,}/g) || []);

  /** Every section with the words that describe it. */
  const places = () => DATA.sheets.flatMap((sheet) => sheet.sections.map((section) => ({
    id: section.id, label: titleCase(sheet.title) + ' › ' + titleCase(section.title),
    bag: new Set(words(sheet.title + ' ' + section.title + ' ' + section.blocks.filter((b) => b.t === 'h').map((b) => b.x).join(' '))),
  })));

  function bestPlace(group, all) {
    if (!all.length) return '';
    const text = group.title + ' ' + group.items.join(' ');
    const hinted = HINTS.filter(([re]) => re.test(text)).flatMap(([, w]) => w.split(' '));
    const hintedTitle = HINTS.filter(([re]) => re.test(group.title)).flatMap(([, w]) => w.split(' '));
    let best = null, top = 0;
    for (const p of all) {
      let score = 0;
      for (const w of words(group.title)) if (p.bag.has(w)) score += 4;
      for (const w of hintedTitle) if (p.bag.has(w)) score += 3;
      for (const w of hinted) if (p.bag.has(w)) score += 1;
      if (score > top) { top = score; best = p; }
    }
    return (best || all.find((p) => /catatan/.test(p.id)) || all[0]).id;
  }

  /** A date written in a heading, like "Kamis, 19 Nov 26" or "19/11/2026". */
  function findDate(s) {
    const year = (y) => (y ? (y.length <= 2 ? 2000 + Number(y) : Number(y)) : new Date().getFullYear());
    let m = s.match(/(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s*(\d{2,4})?/i);
    if (m && MON[m[2].toLowerCase()]) return year(m[3]) + '-' + pad(MON[m[2].toLowerCase()]) + '-' + pad(Number(m[1]));
    m = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (m && Number(m[2]) <= 12 && Number(m[1]) <= 31) return year(m[3]) + '-' + pad(Number(m[2])) + '-' + pad(Number(m[1]));
    return '';
  }

  function parse(text) {
    const groups = [];
    let cur = null, blank = false;
    const start = (title) => { cur = { title, items: [] }; groups.push(cur); };
    for (let raw of text.replace(/\r/g, '').split('\n')) {
      let line = raw.trim();
      if (!line) { blank = true; if (cur && !cur.title && cur.items.length) cur = null; continue; }
      const gap = blank; blank = false;
      line = line.replace(/^\[\d{1,2}\/\d{1,2}(\/\d{2,4})?,? ?\d{1,2}[.:]\d{2}\] ?[^:]{1,40}: ?/, '');      // WhatsApp "[16/11, 01:11] Nama: "
      const head = line.match(/^\*([^*]+)\*:?$/) || line.match(/^#+\s*(.+)$/) || line.match(/^_([^_]+)_$/);
      if (head) { start(head[1].trim()); continue; }
      const item = line.replace(/^([•◦▪●\-–]|\*(?!\S.*\*))\s*/, '').trim();
      if (!item) continue;
      // A short line ending in ":" that is followed by bullets ("Bawa:") reads as a label; keep it with what follows.
      const isLabel = /^[^•]{1,24}:$/.test(item), bulleted = item !== line;
      // A loose line after an empty line is a new thought, not part of the titled group above it.
      if (!cur || (gap && cur.title && !bulleted && !isLabel)) start('');
      if (isLabel) { cur.label = item; continue; }
      if (cur.label) { const last = cur.items[cur.items.length - 1]; if (cur.labelAt === cur.items.length - 1 && last) cur.items[cur.items.length - 1] = last + ' • ' + item; else { cur.items.push(cur.label + ' ' + item); cur.labelAt = cur.items.length - 1; } continue; }
      cur.items.push(item);
    }
    const all = places();
    return groups.filter((g) => g.items.length).map((g) => {
      const date = findDate(g.title), sec = bestPlace(g, all);
      return { title: g.title, items: g.items, sec, dest: 'paste:' + sec, date, cal: !!date };
    });
  }

  /* ---------- screens ---------- */
  VIEWS.paste = () => {
    const P = UI.p, bar = `<div class="bar"><button class="back" data-act="back" aria-label="Kembali">${ICON.back}</button><h1>Tempel catatan</h1></div>`;
    if (!P.groups) {
      return `${bar}<p class="muted small" style="margin:0 4px 10px">Tempel semua catatanmu sekaligus. Baris seperti <b>*Judul*</b> jadi kelompok, sisanya jadi isinya. Nanti kamu lihat dulu hasilnya sebelum disimpan.</p>
        <form class="card composer" data-form="pParse"><textarea name="x" rows="12" placeholder="*Belajar*&#10;• Materi asas download ppt&#10;&#10;*Prinsip*&#10;• Hidup itu simple…" data-input="pText" style="min-height:240px;font-size:15px">${esc(P.text)}</textarea>
          <div class="foot"><button type="button" class="btn ghost" data-act="pClip">📋 Tempel dari clipboard</button><span class="btnrow"><button class="btn">Rapihin</button></span></div></form>`;
    }
    const all = places();
    const total = P.groups.reduce((n, g) => n + g.items.length, 0);
    return `${bar}<p class="muted small" style="margin:0 4px 10px">${P.groups.length} kelompok, ${total} catatan. Cek tujuannya, ganti kalau salah, lalu simpan.</p>
      ${P.groups.map((g, i) => `<section class="card">
        <div class="field"><label>Judul</label><input value="${esc(g.title)}" placeholder="Tanpa judul" data-change="pTitle" data-i="${i}" autocomplete="off"></div>
        <div class="field"><label>Simpan ke</label><button type="button" class="destbtn" data-act="ppOpen" data-i="${i}"><span class="grow">${esc(destLabel(g.dest, all))}</span><span class="chev">Ganti ›</span></button></div>
        <ul class="blist">${g.items.map((x, j) => `<li>${rich(x)} <button class="x" data-act="pDrop" data-i="${i}" data-j="${j}" aria-label="Buang" style="float:right">×</button></li>`).join('')}</ul>
        ${g.date ? `<div class="rowline" style="margin-top:8px"><div class="grow"><b>Masukin ke Kalender</b><small>${longDate(parseYmd(g.date))}</small></div><button class="switch${g.cal ? ' on' : ''}" data-act="pCal" data-i="${i}" aria-label="Kalender"></button></div>` : ''}
        <div class="tools" style="margin-top:6px"><button data-act="pGroupDel" data-i="${i}">Buang kelompok ini</button></div></section>`).join('')}
      <div class="btnrow" style="margin:6px 0 20px"><button class="btn wide" data-act="pSave">Simpan semua</button><button class="btn ghost wide" data-act="pEdit">Ubah teks</button></div>`;
  };

  function destLabel(k, all) {
    if (k.startsWith('paste:')) { const p = (all || places()).find((x) => x.id === k.slice(6)); return '📝 ' + (p ? p.label : 'Catatan'); }
    const d = A1O.destByKey(k); return d ? d.icon + ' ' + d.label : k;
  }
  ACT.openPaste = () => go({ v: 'paste' });
  ACT.pClip = () => {
    const put = (t) => { if (!t) return toast('Clipboard kosong — tekan lama di kotak, lalu Tempel'); UI.p.text = (UI.p.text ? UI.p.text + '\n' : '') + t; render(); };
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(put, () => { const ta = $('textarea[data-input="pText"]'); if (ta) ta.focus(); toast('Tekan lama di kotak, lalu pilih Tempel'); });
    else { const ta = $('textarea[data-input="pText"]'); if (ta) ta.focus(); toast('Tekan lama di kotak, lalu pilih Tempel'); }
  };
  FORMS.pParse = (f) => {
    UI.p.text = f.elements.x.value;
    const groups = parse(UI.p.text);
    if (!groups.length) return toast('Tempel catatannya dulu');
    UI.p.groups = groups; render(); window.scrollTo(0, 0);
  };
  ACT.pEdit = () => { UI.p.groups = null; render(); };
  CHANGE.pTitle = (el) => { UI.p.groups[Number(el.dataset.i)].title = el.value.trim(); };
  CHANGE.pSec = (el) => { UI.p.groups[Number(el.dataset.i)].sec = el.value; };
  ACT.pCal = (el) => { const g = UI.p.groups[Number(el.dataset.i)]; g.cal = !g.cal; render(); };
  ACT.pDrop = (el) => { const g = UI.p.groups[Number(el.dataset.i)]; g.items.splice(Number(el.dataset.j), 1); if (!g.items.length) UI.p.groups.splice(Number(el.dataset.i), 1); if (!UI.p.groups.length) UI.p.groups = null; render(); };
  ACT.pGroupDel = (el) => { UI.p.groups.splice(Number(el.dataset.i), 1); if (!UI.p.groups.length) UI.p.groups = null; render(); };
  ACT.pSave = () => {
    const groups = UI.p.groups || [];
    let events = 0;
    for (const g of groups) {
      if (g.dest && !g.dest.startsWith('paste:')) { const d = A1O.destByKey(g.dest); if (d) { d.add(g.items.slice()); continue; } }
      if (g.dest) g.sec = g.dest.slice(6);
      S.pasted.push({ id: uid(), sec: g.sec, title: g.title, items: g.items.slice(), at: Date.now() });
      if (g.cal && g.date) {
        S.tasks.push({ id: uid(), src: 'user', ord: 9000 + S.nid, title: g.title ? g.title + ' — ' + g.items[0] : g.items[0], time: '', end: '', group: 'Acara', notify: true, note: g.items.slice(1, 4).join(' · '), rep: { k: 'once', date: g.date } });
        events++;
      }
    }
    save();
    const first = groups.find((g) => !g.dest || g.dest.startsWith('paste:'));
    UI.p = { text: '', groups: null };
    UI.stack.pop(); UI.scroll.pop();
    toast(groups.length + ' kelompok disimpan' + (events ? ', ' + events + ' masuk Kalender' : ''));
    if (first && SECTIONS[first.sec]) go({ v: 'section', id: first.sec, focus: 'pasted' }); else render();
  };
  ACT.pDel = (el) => {
    const before = S.pasted.slice();
    S.pasted = S.pasted.filter((g) => g.id !== el.dataset.id);
    save({ sync: false }); render();
    toast('Catatan dihapus', () => { S.pasted = before; });
  };
  document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.input === 'pText') UI.p.text = e.target.value; });

  /* ---------- hooks ---------- */
  window.Paste = {
    parse,
    /** Pasted groups filed under a section, shown below the workbook's own content. */
    sectionHtml(id) {
      return S.pasted.filter((g) => g.sec === id).map((g, i) => `<div${i === 0 ? ' id="bpasted"' : ''}><h3>${esc(g.title || 'Catatan')}</h3><div class="card"><div class="tools"><button data-act="copyPasted" data-id="${g.id}">Salin</button><button data-act="pDel" data-id="${g.id}">Hapus</button></div><ul class="blist">${g.items.map((x) => `<li>${rich(x)}</li>`).join('')}</ul></div></div>`).join('');
    },
    /** Lines for the search, with the section they live in. */
    lines() { return S.pasted.flatMap((g) => [g.title].concat(g.items).filter(Boolean).map((x) => ({ sec: g.sec, x: stripPhotos(x) }))); },
  };
})();
