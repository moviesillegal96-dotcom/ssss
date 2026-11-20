/* A1O — All in 1 as a short, easy-to-read list.
 *
 * Every section is shown as a stack of folded groups (one per heading). A folded group shows its name, how many
 * lines it holds and the first line, so the page stays short; tap to open it. Lines keep the workbook's own wording
 * and are cut to three lines until tapped. Ticks, notes and links work as in the full view, which stays one tap
 * away ("Lengkap"). Loaded after ui.js. */
'use strict';
(() => {
  const fullSection = VIEWS.section;
  const KEEP_OPEN = 3;          // groups with this many lines or fewer are shown open

  const line = (html, cls) => `<div class="cr${cls ? ' ' + cls : ''}"><span class="ct" data-act="clamp">${html}</span></div>`;
  const tickLine = (done, attrs, html) => `<div class="cr tk${done ? ' done' : ''}"><button class="ck" ${attrs} aria-label="Centang"></button><span class="ct" data-act="clamp">${html}</span></div>`;
  const plain = (html) => String(html).replace(/<br>|<\/(div|small|b)>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const fmtCell = (v) => rich(/^\d{5,}$/.test(v) ? Number(v).toLocaleString('id-ID') : v);

  /** One block of the workbook as lines. */
  function rows(b) {
    switch (b.t) {
      case 'p': return [line(rich(b.x), b.m ? 'm' : '')];
      case 'note': return [line(rich(b.x), b.k === 'quote' ? 'q' : 'w')];
      case 'ul': return listItems(b).map((it) => line(rich(it.x) + (it.u ? ` <a href="${esc(it.u)}" target="_blank" rel="noopener">↗</a>` : ''), it.sub ? 'sub' : ''));
      case 'check': {
        if (b.daily) return taskLines(S.tasks.filter((t) => t.src === 'pulsek'));
        const pick = b.day ? picksFor(b) : null, id = esc(b.id);
        return (b.title ? [`<div class="cr nb sh">${rich(b.title)}</div>`] : []).concat(listItems(b).map((it, i) => tickLine(pick ? !!pick[i] : !!it.d, `data-act="itemToggle" data-b="${id}" data-i="${i}"`,
          rich(it.x) + (it.n ? `<small class="cn">${rich(it.n)}</small>` : ''))));
      }
      case 'grid': return taskLines(S.tasks.filter((t) => t.ref === b.id));
      case 'grades': {
        const all = S.grades.map((g) => g.score);
        const avg = all.length ? Math.round((all.reduce((x, y) => x + y, 0) / all.length) * 10) / 10 : '–';
        return [line(`Rata-rata <b>${avg}</b> · ${all.length} nilai tersimpan · mapel: ${esc(b.subjects.join(', '))}`, 'm'),
          `<div class="cr nb"><button class="link" data-act="libFull">Isi nilai di tampilan lengkap ›</button></div>`];
      }
      case 'ledger': return [window.Money ? Money.summaryCard() : ''];
      case 'table': return b.days ? [dayTable(b)] : tableLines(b);
      default: return [];
    }
  }
  function taskLines(tasks) {
    const ds = todayStr(), marks = S.marks[ds] || {};
    return tasks.map((t) => {
      const meta = [repLabel(t), t.freq, t.fixed && /\(/.test(t.fixed) ? t.fixed : '', t.cat].filter((x) => x && x !== 'Tanpa jadwal').join(' · ');
      return tickLine(marks[t.id] === 1, `data-act="mark" data-ds="${ds}" data-id="${esc(t.id)}" data-v="1"`, rich(t.title) + (meta ? `<small class="cn">${esc(meta)}</small>` : ''));
    });
  }
  function tableLines(b) {
    const head = b.head || [], rs = b.rows.filter(Array.isArray);
    let cols = [];
    const width = Math.max(head.length, ...rs.map((r) => r.length), 0);
    for (let i = 0; i < width; i++) if (rs.some((r) => r[i])) cols.push(i);
    const numbering = cols.filter((i) => /^(no|#)$/i.test(head[i] || '') || rs.every((r) => !r[i] || /^\d{1,3}$/.test(r[i])));
    if (cols.length - numbering.length >= 1 && numbering.length) cols = cols.filter((i) => !numbering.includes(i));
    const headLine = cols.some((i) => head[i]) ? [`<div class="cr nb sh">${cols.map((i) => esc((head[i] || '').replace(/\n/g, ' '))).filter(Boolean).join(' · ')}</div>`] : [];
    return headLine.concat(rs.map((r) => {
      const filled = cols.filter((i) => r[i] && r[i] !== '-');
      if (!filled.length) return '';
      const [first, ...rest] = filled;
      const parts = rest.map((i) => (head[i] && rest.length > 1 ? `<span class="ch">${esc(head[i].replace(/\n/g, ' '))}:</span> ` : '') + fmtCell(r[i]));
      const sep = rest.length > 1 ? '<br>' : /^\s*[—–-]/.test(r[rest[0]] || '') ? ' ' : ' — ';
      return line(`<b>${fmtCell(r[first])}</b>${parts.length ? sep + parts.join(rest.length > 1 ? '<br>' : '') : ''}`);
    }).filter(Boolean));
  }

  /** The section cut into groups at its headings: { title, items: [{ i, html }] }. */
  function groups(section) {
    const out = [];
    let g = { title: '', items: [] };
    section.blocks.forEach((b, i) => {
      if (b.t === 'h') { if (g.items.length || g.title) out.push(g); g = { title: b.x.replace(/\s+/g, ' ').trim(), items: [] }; return; }
      for (const html of rows(b)) if (html) g.items.push({ i, html });
    });
    out.push(g);
    return out.filter((x) => x.items.length);
  }

  /** A folded group: name, line count and the first line; open, its lines (body). */
  const SHOW = 12;              // an open group shows this many lines until "Lihat semua"
  /** The lines of a group, cut after SHOW unless the user asked for all of them. */
  function capped(key, html, n) {
    if (n <= SHOW + 3 || UI.open['all|' + key]) return html.join('');
    return html.slice(0, SHOW).join('') + `<div class="cr nb"><button class="link" data-act="cgMore" data-key="${esc(key)}">Lihat semua (${n})</button></div>`;
  }
  function groupHtml(key, title, items, open, id, body) {
    const first = items[0] ? plain(items[0].html).replace(/\s+/g, ' ').trim() : '';
    return `<section class="cg${open ? ' open' : ''}"${id ? ` id="${id}"` : ''}>
      <button class="cgh" data-act="cgToggle" data-key="${esc(key)}"><span class="grow"><b>${esc(titleCase(title))}</b>${!open && first ? `<small>${esc(first.slice(0, 90))}</small>` : ''}</span><span class="count">${items.length}</span><span class="chev">›</span></button>
      ${open ? `<div class="cgb">${body}</div>` : ''}</section>`;
  }

  VIEWS.section = (v) => {
    if (S.settings.libFull) return fullSection(v).replace('<h1>', '<button class="link" data-act="libFull">Ringkas</button><h1>');
    const { section } = SECTIONS[v.id];
    const gs = groups(section);
    const focusGroup = typeof v.focus === 'number' ? gs.findIndex((g) => g.items.some((x) => x.i === v.focus)) : -1;
    const isOpen = (key, n, fallback) => (UI.open[key] !== undefined ? UI.open[key] : fallback || n <= KEEP_OPEN);
    let html = '';
    gs.forEach((g, gi) => {
      const key = 'cg|' + section.id + '|' + gi;
      // Lines before the first heading are the section's intro: shown as they are when short.
      if (!g.title && gi === 0 && g.items.length <= 4) { html += `<div class="cg open intro"><div class="cgb">${wrap(g.items)}</div></div>`; return; }
      const shown = gi === focusGroup || UI.open['all|' + key] ? g.items : g.items.length <= SHOW + 3 ? g.items : g.items.slice(0, SHOW);
      const more = shown.length < g.items.length ? `<div class="cr nb"><button class="link" data-act="cgMore" data-key="${esc(key)}">Lihat semua (${g.items.length})</button></div>` : '';
      html += groupHtml(key, g.title || 'Catatan', g.items, isOpen(key, g.items.length, gi === focusGroup || gs.length === 1), '', wrap(shown) + more);
    });
    // Notes filed by "Tempel catatan" / quick add, and the section's own extra notes.
    S.pasted.filter((p) => p.sec === section.id).forEach((p, pi) => {
      const key = 'cgp|' + p.id, items = p.items.map((x) => ({ html: line(rich(x)) }));
      const tools = `<div class="cr nb ctools"><button data-act="copyPasted" data-id="${p.id}">Salin</button><button data-act="pDel" data-id="${p.id}">Hapus</button></div>`;
      html += groupHtml(key, p.title || 'Catatan', items, isOpen(key, items.length, v.focus === 'pasted' && pi === 0), pi === 0 ? 'bpasted' : '', capped(key, items.map((x) => x.html), items.length) + tools);
    });
    const notes = S.notes[section.id] || [];
    const nkey = 'cgn|' + section.id;
    const noteItems = notes.map((n, i) => ({ html: `<div class="cr"><span class="ct" data-act="clamp">${rich(n)}</span><button class="x" data-act="noteDel" data-id="${esc(section.id)}" data-i="${i}" aria-label="Hapus">×</button></div>` }));
    const addForm = `<form class="add" data-form="note" data-id="${esc(section.id)}"><input name="x" placeholder="Tulis catatan baru…" autocomplete="off"><button aria-label="Tambah">＋</button></form>`;
    html += groupHtml(nkey, 'Catatan tambahan', noteItems, isOpen(nkey, noteItems.length, v.focus === 'notes' || !noteItems.length), 'bnotes', noteItems.map((x) => x.html).join('') + addForm);
    const anyClosed = /class="cg"/.test(html);
    return `<div class="bar"><button class="back" data-act="back" aria-label="Kembali">${ICON.back}</button><h1>${esc(titleCase(section.title))}</h1>
        <button class="link" data-act="copySection" data-id="${esc(section.id)}">Salin</button><button class="link" data-act="libFull">Lengkap</button></div>
      ${gs.length > 2 ? `<div class="cgall"><button class="link" data-act="cgAll" data-id="${esc(section.id)}" data-open="${anyClosed ? 1 : 0}">${anyClosed ? 'Buka semua' : 'Tutup semua'}</button></div>` : ''}
      <div class="lib">${html}</div>`;

    // Lines of one group, each block's lines inside an anchor so search results can scroll to them.
    function wrap(items) {
      let out = '', cur = null;
      for (const x of items) {
        if (x.i !== cur) { if (cur !== null) out += '</div>'; out += `<div id="b${x.i}">`; cur = x.i; }
        out += x.html;
      }
      return out + (cur !== null ? '</div>' : '');
    }
  };

  /** The category list: one row per sheet, with what is inside it. */
  libBody = function () {
    const q = UI.q.trim();
    if (q.length >= 2) return searchResults(q);
    if (!DATA.sheets.length) return '<div class="card empty">Belum ada isi.</div>';
    return `<div class="card">${DATA.sheets.map((s) => {
      const names = s.sections.map((sec) => titleCase(sec.title));
      return `<button class="navrow" data-act="openSheet" data-id="${esc(s.id)}"><span class="ico">${s.icon}</span><span class="grow"><b>${esc(titleCase(s.title))}</b><small>${esc(names.join(' · '))}</small></span><span class="chev">›</span></button>`;
    }).join('')}</div>`;
  };

  VIEWS.sheet = (v) => {
    const sheet = DATA.sheets.find((s) => s.id === v.id);
    return `<div class="bar"><button class="back" data-act="back" aria-label="Kembali">${ICON.back}</button><h1>${sheet.icon} ${esc(titleCase(sheet.title))}</h1></div>
      <div class="card">${sheet.sections.map((sec) => {
        const gs = groups(sec), n = gs.reduce((k, g) => k + g.items.length, 0) + S.pasted.filter((p) => p.sec === sec.id).reduce((k, p) => k + p.items.length, 0);
        const sub = gs.map((g) => titleCase(g.title)).filter(Boolean).slice(0, 4).join(' · ');
        return `<button class="navrow" data-act="openSection" data-id="${esc(sec.id)}"><span class="grow"><b>${esc(titleCase(sec.title))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="count">${n}</span><span class="chev">›</span></button>`;
      }).join('')}</div>`;
  };

  ACT.cgToggle = (el) => { const sec = el.closest('.cg'); UI.open[el.dataset.key] = !sec.classList.contains('open'); render(); };
  ACT.cgAll = (el) => {
    const open = el.dataset.open === '1', section = SECTIONS[el.dataset.id].section;
    groups(section).forEach((g, gi) => { UI.open['cg|' + section.id + '|' + gi] = open; });
    render();
  };
  ACT.clamp = (el) => el.classList.toggle('open');
  ACT.cgMore = (el) => { UI.open['all|' + el.dataset.key] = true; render(); };
  ACT.libFull = () => { S.settings.libFull = !S.settings.libFull; save({ sync: false }); render(); window.scrollTo(0, 0); };
})();
