/* All in One — Uang: the Dompet Planner money planner, as a tab of the app.
 *
 * Budget lines sit in four groups (income, needs, wants, future). A line can have a due day; ticking it
 * logs the payment. From that the tab works out what is left to budget, what is left to spend, and one
 * safe-to-spend figure per day. Data keeps Dompet Planner's shape ({ cfg, months }) so its backups load. */
'use strict';
(() => {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mkOf = (s) => s.slice(0, 7);
  const dim = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const addMonth = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const dayDiff = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);
  const MON = MONTHS.map((m) => m.slice(0, 3));
  const monthLabel = (mk) => MONTHS[+mk.slice(5) - 1] + ' ' + mk.slice(0, 4);
  const dateLabel = (s) => shortDate(parseYmd(s));
  const sDate = (s) => +s.slice(8) + ' ' + MON[+s.slice(5, 7) - 1];

  const GROUPS = { income: { label: 'Pemasukan' }, needs: { label: 'Kebutuhan' }, wants: { label: 'Keinginan' }, future: { label: 'Masa depan' } };
  const SPEND = ['needs', 'wants', 'future'];
  const LISTS = {
    must: { label: 'Wajib', hint: 'Harus kejadian. Biayanya ditahan dari uang yang aman dipakai.', cat: 'needs' },
    buy: { label: 'Perlu dibeli', hint: 'Belanja yang lagi direncanain.', cat: 'wants' },
    quest: { label: 'Side quest', hint: 'Tambahan opsional kalau lagi ada sisa.', cat: 'wants' },
  };
  const NOTIFY = { on: true, time: '08:00', log: false, logTime: '20:00' };
  const VIEWS_M = [['home', 'Ringkasan'], ['calendar', 'Kalender'], ['budget', 'Budget'], ['lists', 'List'], ['log', 'Log']];
  const blankCfg = () => ({ v: 1, currency: 'Rp', opening: 0, goals: { needs: 50, wants: 30, future: 20 }, items: [], lists: [] });

  UI.m = { view: 'home', month: mkOf(todayStr()), selDay: null, filter: 'all', q: '', editId: null };
  let memo = null;

  /* ---------- state ---------- */
  /** First use: budget lines come from the workbook's budget and income tables, when it has them. */
  function seed() {
    const c = blankCfg(), seeds = DATA.seeds || {}, from = mkOf(todayStr());
    const line = (name, group, amount) => c.items.push({ id: uid(), name, group, amount, repeat: 'monthly', day: 0, date: '', target: 0, from });
    for (const s of seeds.income || []) if (s.amount) line(s.name, 'income', s.amount);
    for (const b of seeds.budget || []) {
      if (!b.limit) continue;
      line(b.name, /invest|tabung|darurat|saving|dana/i.test(b.name) ? 'future' : b.must ? 'needs' : 'wants', b.limit);
    }
    const months = {};
    const old = S.ledger;                         // entries from the earlier, simpler money tab
    if (old && Array.isArray(old.tx)) {
      c.opening = sum((old.accounts || []).map((a) => a.start || 0));
      for (const t of old.tx) {
        if (t.kind !== 'in' && t.kind !== 'out') continue;
        const g = t.kind === 'in' ? 'income' : 'needs', mk = mkOf(t.date);
        (months[mk] || (months[mk] = { tx: [] })).tx.push({ id: uid(), d: t.date, t: t.kind, a: t.amt, item: null, name: t.cat || 'Lainnya', g, note: t.x || '' });
      }
    }
    return { cfg: c, months };
  }
  function M() {
    if (!S.money || !S.money.cfg) { S.money = seed(); delete S.ledger; }
    const c = S.money.cfg, b = blankCfg();
    for (const k in b) if (c[k] === undefined) c[k] = b[k];
    c.goals = Object.assign({}, b.goals, c.goals);
    if (!S.money.months) S.money.months = {};
    return S.money;
  }
  const cfg = () => M().cfg;
  function commit() { memo = null; save(); render(); }

  /* ---------- money + model ---------- */
  const cur = () => cfg().currency || 'Rp';
  const fmt = (n) => (n < 0 ? '−' : '') + cur() + ' ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
  function fmtC(n) {
    const a = Math.abs(n);
    let s;
    if (a >= 1e6) s = (a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: a >= 1e7 ? 0 : 1 }) + 'jt';
    else if (a >= 1e3) s = (a / 1e3).toLocaleString('id-ID', { maximumFractionDigits: a >= 1e5 ? 0 : 1 }) + 'rb';
    else s = String(Math.round(a));
    return (n < 0 ? '−' : '') + s;
  }
  const parseAmt = (s) => Number(String(s || '').replace(/\D/g, '')) || 0;
  const amtStr = (n) => (n ? Math.round(n).toLocaleString('id-ID') : '');
  const item = (id) => cfg().items.find((i) => i.id === id);
  const itemsOf = (g) => cfg().items.filter((i) => i.group === g);
  const txIn = (mk) => (M().months[mk] && M().months[mk].tx) || [];
  function planned(it, mk) {
    if (it.repeat === 'once') return it.date && mkOf(it.date) === mk ? it.amount : 0;
    if (it.from && mk < it.from) return 0;
    if (it.repeat === 'yearly') return it.date && it.date.slice(5, 7) === mk.slice(5) ? it.amount : 0;
    return it.amount;
  }
  function dueDate(it, mk) {
    if (!planned(it, mk)) return null;
    if (it.repeat === 'once') return it.date;
    if (it.repeat === 'yearly') return mk + '-' + pad(Math.min(+it.date.slice(8), dim(mk)));
    return it.day ? mk + '-' + pad(Math.min(it.day, dim(mk))) : null;
  }
  function idx() {
    if (memo) return memo;
    const m = { paid: new Map(), act: new Map(), grp: new Map(), net: new Map(), all: new Map() };
    const add = (map, k, v) => map.set(k, (map.get(k) || 0) + v);
    const months = M().months;
    for (const mk in months) for (const t of months[mk].tx) {
      const known = t.item && item(t.item);
      if (known) { add(m.act, t.item + '|' + mk, t.a); add(m.all, t.item, t.a); if (t.occ) m.paid.set(t.item + '|' + t.occ, t); }
      else add(m.act, 'other:' + t.g + '|' + mk, t.a);
      add(m.grp, t.g + '|' + mk, t.a);
      add(m.net, mk, t.t === 'in' ? t.a : -t.a);
    }
    return (memo = m);
  }
  const act = (id, mk) => idx().act.get(id + '|' + mk) || 0;
  const paidTx = (id, mk) => idx().paid.get(id + '|' + mk);
  function stats(mk) {
    const ix = idx(), g = (k) => ix.grp.get(k + '|' + mk) || 0;
    let start = cfg().opening || 0;
    ix.net.forEach((v, k) => { if (k < mk) start += v; });
    const incP = sum(itemsOf('income').map((i) => planned(i, mk))), incA = g('income'), P = {}, A = {};
    SPEND.forEach((k) => { P[k] = sum(itemsOf(k).map((i) => planned(i, mk))); A[k] = g(k); });
    const budgeted = sum(SPEND.map((k) => P[k])), spent = sum(SPEND.map((k) => A[k]));
    return { start, incP, incA, P, A, budgeted, spent, totalBudget: start + incP, totalSpend: start + incA, leftBudget: start + incP - budgeted, leftSpend: start + incA - spent };
  }
  function dues(mk) {
    return cfg().items.map((it) => { const d = dueDate(it, mk); if (!d) return null; return { it, date: d, amount: planned(it, mk), paid: !!paidTx(it.id, mk) }; })
      .filter(Boolean).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  /** What today can cost: the balance, minus unpaid bills, savings still to set aside and must-do costs, per day left. */
  function safe() {
    const t = todayStr(), mk = mkOf(t), st = stats(mk);
    const bills = sum(dues(mk).filter((o) => (o.it.group === 'needs' || o.it.group === 'wants') && !o.paid).map((o) => o.amount));
    const saving = sum(itemsOf('future').map((i) => Math.max(0, planned(i, mk) - act(i.id, mk))));
    const must = sum(cfg().lists.filter((l) => l.list === 'must' && !l.done && l.amount && (!l.date || mkOf(l.date) <= mk)).map((l) => l.amount));
    const free = st.leftSpend - bills - saving - must, days = dim(mk) - (+t.slice(8)) + 1;
    return { bal: st.leftSpend, bills, save: saving, must, free, days, perDay: Math.max(0, Math.floor(free / days)) };
  }
  function flow(mk) {
    const n = dim(mk), t = todayStr(), cm = mkOf(t), st = stats(mk);
    const delta = Array(n + 2).fill(0), proj = Array(n + 2).fill(0);
    txIn(mk).forEach((x) => { delta[+x.d.slice(8)] += x.t === 'in' ? x.a : -x.a; });
    const last = mk < cm ? n : mk === cm ? +t.slice(8) : 0, from = mk < cm ? n + 1 : mk === cm ? last : 1;
    if (from <= n) dues(mk).forEach((o) => { if (o.paid) return; proj[Math.max(+o.date.slice(8), from)] += o.it.group === 'income' ? o.amount : -o.amount; });
    const a = [st.start], p = [st.start];
    for (let d = 1; d <= n; d++) { a[d] = a[d - 1] + delta[d]; p[d] = p[d - 1] + delta[d] + proj[d]; }
    return { n, a, p, last, from, start: st.start, end: p[n] };
  }
  function dueLabel(o, t) {
    if (o.paid) return `<span class="mpill done">${o.it.group === 'income' ? 'Diterima' : 'Lunas'}</span>`;
    const dd = dayDiff(o.date, t);
    if (dd < 0) return `<span class="mpill late">telat ${-dd} hari</span>`;
    if (dd === 0) return '<span class="mpill soon">Hari ini</span>';
    if (dd === 1) return '<span class="mpill soon">Besok</span>';
    if (dd <= 7) return `<span class="mpill soon">${dd} hari lagi</span>`;
    return '';
  }
  function addTx(t) { const mk = mkOf(t.d), ms = M().months; (ms[mk] || (ms[mk] = { tx: [] })).tx.push(t); memo = null; }
  function findTx(id) { const ms = M().months; for (const mk in ms) { const i = ms[mk].tx.findIndex((t) => t.id === id); if (i >= 0) return { mk, i, t: ms[mk].tx[i] }; } return null; }
  function delTx(id) { const f = findTx(id); if (!f) return; const ms = M().months; ms[f.mk].tx.splice(f.i, 1); if (!ms[f.mk].tx.length) delete ms[f.mk]; memo = null; }
  /** Logs a budget line as paid (or received) for a month. */
  function payItem(it, mk) {
    const t = todayStr(), inc = it.group === 'income';
    const x = { id: uid(), d: mk === mkOf(t) ? t : (dueDate(it, mk) || mk + '-01'), t: inc ? 'in' : 'out', a: planned(it, mk) || it.amount, item: it.id, name: it.name, g: it.group, note: '', occ: mk };
    addTx(x);
    return x;
  }

  /* ---------- pieces ---------- */
  const tick = (on, action, id, label, sq) => `<button class="ck${on ? ' on' : ''}${sq ? ' sq' : ''}" data-act="${action}" data-id="${id}" aria-pressed="${on}" aria-label="${esc(label)}"></button>`;
  const sw = (g) => `<i class="sw g-${g}"></i>`;
  const head = (title, sub, extra) => `<header><h3>${title}</h3>${extra || ''}</header>${sub ? `<p class="muted small" style="margin:-4px 0 8px">${sub}</p>` : ''}`;
  function txRow(x) {
    return `<div class="m-row"><span class="m-gap"></span><button class="m-main" data-act="m-edit-tx" data-id="${x.id}"><span class="m-name">${esc(x.name)}</span><span class="m-meta">${sw(x.g)}${GROUPS[x.g].label}${x.note ? ' · ' + esc(x.note) : ''}</span></button><span class="m-amt ${x.t === 'in' ? 'okc' : ''}">${x.t === 'in' ? '+' : '−'}${fmt(x.a)}</span></div>`;
  }
  const dueRow = (o, t) => `<div class="m-row">${tick(o.paid, 'm-tick', o.it.id, 'Tandai ' + o.it.name + (o.it.group === 'income' ? ' diterima' : ' lunas'))}
    <button class="m-main" data-act="m-edit-item" data-id="${o.it.id}"><span class="m-name">${esc(o.it.name)}</span><span class="m-meta">${sw(o.it.group)}${GROUPS[o.it.group].label} · ${sDate(o.date)} ${dueLabel(o, t)}</span></button>
    <span class="m-amt ${o.it.group === 'income' ? 'okc' : ''}">${o.it.group === 'income' ? '+' : ''}${fmt(o.amount)}</span></div>`;
  const listRow = (l, t, showList) => `<div class="m-row${l.done ? ' done' : ''}">${tick(l.done, 'm-tick-list', l.id, 'Tandai ' + l.title + ' selesai', true)}
    <button class="m-main" data-act="m-edit-list" data-id="${l.id}"><span class="m-name">${esc(l.title)}</span>${showList || l.date ? `<span class="m-meta">${showList ? LISTS[l.list].label + (l.date ? ' · ' : '') : ''}${l.date ? sDate(l.date) + ' ' + (l.done ? '' : dueLabel({ date: l.date, paid: false, it: { group: '' } }, t)) : ''}</span>` : ''}</button>
    <span class="m-amt">${l.amount ? fmt(l.amount) : ''}</span></div>`;

  /* ---------- views ---------- */
  function vHome() {
    const month = UI.m.month, st = stats(month), t = todayStr(), cm = mkOf(t), isCur = month === cm;
    let h = '';
    if (isCur) {
      const s = safe();
      h += `<section class="m-hero"><p class="eyebrow">Aman dipakai hari ini</p><p class="m-num">${fmt(s.perDay)}</p>
        <p class="m-sub">${s.free >= 0 ? `${fmt(s.free)} bebas untuk ${s.days} hari tersisa di ${MONTHS[+month.slice(5) - 1]}` : `Kurang ${fmt(-s.free)} dari yang masih harus ditutup bulan ini`}</p>
        <dl class="m-math"><div><dt>Saldo sekarang</dt><dd>${fmt(s.bal)}</dd></div><div><dt>Tagihan belum dibayar</dt><dd>${fmt(-s.bills)}</dd></div><div><dt>Biaya wajib</dt><dd>${fmt(-s.must)}</dd></div><div><dt>Tabungan disisihkan</dt><dd>${fmt(-s.save)}</dd></div></dl></section>`;
    } else {
      const past = month < cm;
      h += `<section class="m-hero"><p class="eyebrow">${past ? 'Ditutup dengan' : 'Rencananya berakhir dengan'}</p><p class="m-num">${fmt(past ? st.leftSpend : flow(month).end)}</p>
        <p class="m-sub">${past ? `Mulai ${monthLabel(month)} dengan ${fmt(st.start)}` : `Kalau pemasukan masuk dan tagihan bertanggal dibayar di ${monthLabel(month)}`}</p></section>`;
    }
    h += `<div class="m-pair">
      <section class="card m-sum">${head('Rencana')}<dl><div><dt>Total budget</dt><dd>${fmt(st.totalBudget)}</dd></div><div><dt>Sudah dibudgetkan</dt><dd>${fmt(st.budgeted)}</dd></div><div class="total"><dt>Sisa untuk dibudgetkan</dt><dd class="${st.leftBudget < 0 ? 'noc' : ''}">${fmt(st.leftBudget)}</dd></div></dl></section>
      <section class="card m-sum">${head('Nyata')}<dl><div><dt>Total bisa dipakai</dt><dd>${fmt(st.totalSpend)}</dd></div><div><dt>Sudah terpakai</dt><dd>${fmt(st.spent)}</dd></div><div class="total"><dt>Sisa bisa dipakai</dt><dd class="${st.leftSpend < 0 ? 'noc' : ''}">${fmt(st.leftSpend)}</dd></div></dl></section></div>`;

    // goal split
    const pct = (o, k) => { const tot = sum(SPEND.map((x) => o[x])); return tot ? (o[k] / tot) * 100 : null; };
    const G = cfg().goals, goalAmt = {}, pp = {}, ap = {};
    SPEND.forEach((k) => { goalAmt[k] = (st.totalBudget * G[k]) / 100; pp[k] = pct(st.P, k); ap[k] = pct(st.A, k); });
    const row = (label, vals, amts) => {
      const any = SPEND.some((k) => vals[k]);
      return `<span class="rl">${label}</span>${SPEND.map((k) => `<span class="v">${vals[k] == null ? '–' : Math.round(vals[k]) + '%'}<small>${fmtC(amts[k])}</small></span>`).join('')}
        <span class="m-stack${any ? '' : ' none'}">${any ? SPEND.map((k) => (vals[k] ? `<i class="g-${k}" style="width:${vals[k]}%"></i>` : '')).join('') : ''}</span>`;
    };
    h += `<section class="card">${head('Uangnya harusnya ke mana', 'Porsi tiap kelompok bulan ini')}
      <div class="m-split"><span></span>${SPEND.map((k) => `<span class="hd">${sw(k)}${GROUPS[k].label}</span>`).join('')}
      ${row('Target', G, goalAmt)}${row('Rencana', pp, st.P)}${row('Nyata', ap, st.A)}</div></section>`;

    // coming up
    const horizon = isCur ? ymd(addDays(new Date(), 14)) : month + '-31';
    const up = dues(month).filter((o) => !o.paid && o.date <= horizon).map((o) => ({ d: o.date, html: dueRow(o, t) }));
    cfg().lists.filter((l) => !l.done && l.date && l.date <= horizon && (isCur || mkOf(l.date) === month)).forEach((l) => up.push({ d: l.date, html: listRow(l, t, true) }));
    up.sort((a, b) => (a.d < b.d ? -1 : 1));
    h += `<section class="card">${head('Segera jatuh tempo', isCur ? 'Belum dibayar, dalam 14 hari' : 'Masih terbuka di ' + monthLabel(month))}
      ${up.length ? up.slice(0, 10).map((u) => u.html).join('') : '<p class="muted small">Nggak ada yang jatuh tempo. Kasih tanggal ke baris budget biar muncul di sini dan di kalender.</p>'}</section>`;

    h += `<section class="card">${head('Saldo sepanjang ' + MONTHS[+month.slice(5) - 1], 'Garis tegas = tercatat, putus-putus = perkiraan dari tagihan & pemasukan bertanggal')}<div class="m-chart" data-chart="flow"></div></section>`;

    const cats = [];
    SPEND.forEach((g) => { itemsOf(g).forEach((i) => { const a = act(i.id, month); if (a) cats.push({ n: i.name, g, a }); }); const o = act('other:' + g, month); if (o) cats.push({ n: GROUPS[g].label + ' lainnya', g, a: o }); });
    cats.sort((a, b) => b.a - a.a);
    const mx = cats.length ? cats[0].a : 1;
    const legend = `<div class="m-legend">${SPEND.map((k) => `<span>${sw(k)}${GROUPS[k].label}</span>`).join('')}</div>`;
    h += `<section class="card">${head('Uangnya ke mana')}${legend}
      ${cats.length ? `<div class="m-hbars">${cats.slice(0, 9).map((c) => `<span class="nm">${esc(c.n)}</span><span class="tr g-${c.g}"><i style="width:${Math.max(1, (c.a / mx) * 100)}%"></i></span><span class="vl">${fmtC(c.a)}</span>`).join('')}</div>` : `<p class="muted small">Belum ada pengeluaran tercatat di ${monthLabel(month)}.</p>`}</section>`;

    h += `<section class="card">${head('Enam bulan terakhir')}<div class="m-legend">${SPEND.map((k) => `<span>${sw(k)}${GROUPS[k].label}</span>`).join('')}<span><i class="ln"></i>Pemasukan</span></div><div class="m-chart" data-chart="trend"></div></section>`;
    return h;
  }

  function vCalendar() {
    const month = UI.m.month, [y, m] = month.split('-').map(Number), n = dim(month), off = (new Date(y, m - 1, 1).getDay() + 6) % 7, t = todayStr();
    if (!UI.m.selDay || mkOf(UI.m.selDay) !== month) UI.m.selDay = mkOf(t) === month ? t : month + '-01';
    const sel = UI.m.selDay, by = {};
    const get = (d) => by[d] || (by[d] = { inc: 0, out: 0, dues: [], todos: [], tx: [] });
    txIn(month).forEach((x) => { const o = get(x.d); o.tx.push(x); if (x.t === 'in') o.inc += x.a; else o.out += x.a; });
    dues(month).forEach((o) => get(o.date).dues.push(o));
    cfg().lists.forEach((l) => { if (l.date && mkOf(l.date) === month) get(l.date).todos.push(l); });
    let h = `<div class="m-cal">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<span class="dow">${ISO_SHORT[i]}</span>`).join('')}`;
    for (let i = 0; i < off; i++) h += '<span class="m-day blank"></span>';
    for (let d = 1; d <= n; d++) {
      const ds = month + '-' + pad(d), o = by[ds] || { inc: 0, out: 0, dues: [], todos: [] };
      const marks = o.dues.map((x) => `<i class="m-dot g-${x.it.group}${x.paid ? ' paid' : x.date < t ? ' late' : ''}"></i>`).join('') + o.todos.map((l) => `<i class="m-dot todo${l.done ? ' paid' : ''}"></i>`).join('');
      h += `<button class="m-day${ds === t ? ' today' : ''}${ds === sel ? ' sel' : ''}" data-act="m-day" data-d="${ds}"><span class="n">${d}</span>${o.inc ? `<span class="amt okc">+${fmtC(o.inc)}</span>` : ''}${o.out ? `<span class="amt noc">−${fmtC(o.out)}</span>` : ''}${marks ? `<span class="marks">${marks}</span>` : ''}</button>`;
    }
    h += `</div><div class="m-key"><span><i class="m-dot g-needs"></i>Jatuh tempo</span><span><i class="m-dot g-needs paid"></i>Lunas</span><span><i class="m-dot late"></i>Telat</span><span><i class="m-dot todo"></i>List</span></div>`;
    const o = by[sel] || { inc: 0, out: 0, dues: [], todos: [], tx: [] };
    const rows = o.dues.map((x) => dueRow(x, t)).concat(o.todos.map((l) => listRow(l, t, true)), o.tx.map(txRow));
    h += `<section class="card">${head(dateLabel(sel), o.inc || o.out ? `Masuk ${fmt(o.inc)} · Keluar ${fmt(o.out)}` : 'Nggak ada uang bergerak', `<button class="link" data-act="m-add-tx" data-date="${sel}">＋ Catat</button>`)}
      ${rows.length ? rows.join('') : '<p class="muted small">Kosong di hari ini.</p>'}</section>`;
    return h;
  }

  function vBudget() {
    const month = UI.m.month, st = stats(month), t = todayStr();
    let h = '';
    ['income'].concat(SPEND).forEach((g) => {
      const its = itemsOf(g).filter((i) => planned(i, month) || act(i.id, month)), inc = g === 'income';
      const P = inc ? st.incP : st.P[g], A = inc ? st.incA : st.A[g], other = act('other:' + g, month);
      h += `<section class="card">${head(sw(g) + GROUPS[g].label, '', `<button class="link" data-act="m-add-item" data-g="${g}">＋ Baris</button>`)}
        <p class="m-grp"><span>Rencana <b>${fmt(P)}</b></span><span>${inc ? 'Diterima' : 'Nyata'} <b>${fmt(A)}</b></span>${inc ? '' : `<span>Target ${cfg().goals[g]}% = <b>${fmt((st.totalBudget * cfg().goals[g]) / 100)}</b></span>`}</p>`;
      if (!its.length && !other) h += `<p class="muted small">${inc ? 'Tambah yang kamu harapkan masuk bulan ini.' : 'Belum ada baris. Tambah satu dengan jumlah dan, kalau ada, tanggal jatuh temponya.'}</p>`;
      its.forEach((i) => {
        const p = planned(i, month), a = act(i.id, month), d = dueDate(i, month), paid = !!paidTx(i.id, month), canTick = inc || !!d;
        const meta = [];
        if (d) meta.push((inc ? 'Diharapkan ' : 'Jatuh tempo ') + sDate(d) + ' ' + dueLabel({ it: i, date: d, paid }, t));
        else if (paid) meta.push(dueLabel({ it: i, date: t, paid: true }, t));
        else meta.push(inc ? 'Kapan aja' : 'Tanpa tanggal');
        if (i.repeat === 'once') meta.push('sekali');
        if (i.repeat === 'yearly') meta.push('tahunan');
        if (g === 'future' && i.target) meta.push(`terkumpul ${fmt(idx().all.get(i.id) || 0)} dari ${fmt(i.target)}`);
        const w = p ? Math.min(100, (a / p) * 100) : a ? 100 : 0;
        h += `<div class="m-row">${canTick ? tick(paid, 'm-tick', i.id, 'Tandai ' + i.name + (inc ? ' diterima' : ' lunas')) : '<span class="m-gap"></span>'}
          <button class="m-main" data-act="m-edit-item" data-id="${i.id}"><span class="m-name">${esc(i.name)}</span><span class="m-meta">${meta.join(' · ')}</span><span class="m-bar g-${g}${!inc && a > p ? ' over' : ''}"><i style="width:${w}%"></i></span></button>
          <span class="m-amt">${fmt(a)}<small>dari ${fmt(p)}</small></span>
          <button class="m-mini" data-act="m-add-tx" data-item="${i.id}" aria-label="Catat ${esc(i.name)}">＋</button></div>`;
      });
      if (other) h += `<div class="m-row"><span class="m-gap"></span><span class="m-main"><span class="m-name">${GROUPS[g].label} lainnya</span><span class="m-meta">Dicatat tanpa baris budget</span></span><span class="m-amt">${fmt(other)}</span></div>`;
      h += '</section>';
    });
    return h;
  }

  function vLists() {
    const st = stats(UI.m.month), t = todayStr();
    return Object.keys(LISTS).map((k) => {
      const L = LISTS[k], its = cfg().lists.filter((l) => l.list === k), open = its.filter((l) => !l.done), done = its.filter((l) => l.done), tot = sum(open.map((l) => l.amount || 0));
      open.sort((a, b) => ((a.date || '9') < (b.date || '9') ? -1 : 1));
      return `<section class="card">${head(L.label, '', `<button class="link" data-act="m-add-list" data-l="${k}">＋ Tambah</button>`)}
        <p class="m-grp"><span><b>${open.length}</b> terbuka</span>${tot ? `<span>Total <b>${fmt(tot)}</b></span>` : ''}${k === 'buy' && tot ? `<span>${tot <= st.leftSpend ? 'Masih muat di' : 'Lebih dari'} sisa bisa dipakai (${fmt(st.leftSpend)})</span>` : ''}</p>
        ${its.length ? open.concat(done).map((l) => listRow(l, t)).join('') : `<p class="muted small">${L.hint}</p>`}
        ${done.length ? `<button class="link" style="margin-top:8px" data-act="m-clear-done" data-l="${k}">Hapus ${done.length} yang selesai</button>` : ''}</section>`;
    }).join('');
  }

  function logRows() {
    const q = UI.m.q.trim().toLowerCase(), month = UI.m.month;
    const list = txIn(month).filter((x) => (UI.m.filter === 'all' || x.g === UI.m.filter) && (!q || (x.name + ' ' + (x.note || '')).toLowerCase().includes(q))).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
    if (!list.length) return `<p class="muted small" style="padding-top:10px">${txIn(month).length ? 'Nggak ada yang cocok.' : 'Belum ada transaksi di ' + monthLabel(month) + '. Pencet ＋ buat nyatat.'}</p>`;
    let h = '', last = '';
    list.forEach((x) => {
      if (x.d !== last) { const day = list.filter((yy) => yy.d === x.d), net = sum(day.map((yy) => (yy.t === 'in' ? yy.a : -yy.a))); h += `<p class="datehead" style="display:flex;justify-content:space-between"><span>${dateLabel(x.d)}</span><span>${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span></p>`; last = x.d; }
      h += txRow(x);
    });
    return h;
  }
  function vLog() {
    const st = stats(UI.m.month);
    return `<section class="card">${head('Transaksi', `Masuk ${fmt(st.incA)} · Keluar ${fmt(st.spent)}`)}
      <div class="search" style="margin-bottom:10px">${ICON.search}<input type="search" placeholder="Cari nama atau catatan" value="${esc(UI.m.q)}" data-input="m-search" autocomplete="off" style="background:var(--bg);box-shadow:none;border-color:var(--line)"></div>
      <div class="chips">${['all', 'income'].concat(SPEND).map((f) => `<button class="chip${UI.m.filter === f ? ' on' : ''}" data-act="m-filter" data-f="${f}">${f === 'all' ? 'Semua' : GROUPS[f].label}</button>`).join('')}</div>
      <div id="mLog">${logRows()}</div></section>`;
  }

  VIEWS.money = () => {
    M();
    memo = null;
    const v = UI.m.view;
    const body = ({ home: vHome, calendar: vCalendar, budget: vBudget, lists: vLists, log: vLog }[v] || vHome)();
    return `<div class="title"><h1>Uang</h1><button class="iconbtn" data-act="m-settings" aria-label="Pengaturan uang">${ICON.more}</button></div>
      <div class="calnav"><b>${monthLabel(UI.m.month)}</b><button class="iconbtn" data-act="m-month" data-d="-1" aria-label="Bulan sebelumnya">${ICON.back}</button><button class="link" data-act="m-month" data-d="0">Bulan ini</button><button class="iconbtn" data-act="m-month" data-d="1" aria-label="Bulan berikutnya" style="transform:scaleX(-1)">${ICON.back}</button></div>
      <div class="seg wide m-seg">${VIEWS_M.map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-act="m-nav" data-v="${k}">${l}</button>`).join('')}</div>
      ${body}
      <button class="fab" data-act="m-add-tx" aria-label="Catat transaksi">＋</button>`;
  };

  /* ---------- charts ---------- */
  function ticks(lo, hi, c) {
    c = c || 3;
    const raw = (hi - lo || 1) / c, p = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map((mm) => mm * p).find((s) => s >= raw), out = [];
    for (let v = Math.floor(lo / step) * step; v < hi + step * 0.999; v += step) out.push(v);
    return out;
  }
  function showTip(el, x, y, html) {
    let tip = $('.m-tip', el);
    if (!tip) { tip = document.createElement('div'); tip.className = 'm-tip'; el.appendChild(tip); }
    tip.hidden = false; tip.innerHTML = html;
    const w = tip.offsetWidth, W = el.clientWidth;
    tip.style.left = Math.max(0, Math.min(W - w, x - w / 2)) + 'px'; tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + 'px';
  }
  const hideTip = (el) => { const t = $('.m-tip', el); if (t) t.hidden = true; };
  function drawFlow(el) {
    const month = UI.m.month, f = flow(month), n = f.n, W = Math.max(260, el.clientWidth), H = 200, L = 44, R = 40, T = 14, B = 24;
    const vals = [0];
    for (let d = 1; d <= n; d++) { if (d <= f.last) vals.push(f.a[d]); if (d >= f.from) vals.push(f.p[d]); }
    const tk = ticks(Math.min.apply(null, vals), Math.max.apply(null, vals.concat(1))), lo = tk[0], hi = tk[tk.length - 1];
    const x = (d) => L + ((d - 1) / (n - 1)) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const val = (d) => (d <= f.last ? f.a[d] : f.p[d]);
    let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Saldo per hari ${monthLabel(month)}">`;
    tk.forEach((v) => { s += `<line class="${v === 0 ? 'base' : 'grid'}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmtC(v)}</text>`; });
    [1, 8, 15, 22, n].forEach((d) => { s += `<text x="${x(d)}" y="${H - 6}" text-anchor="middle">${d}</text>`; });
    if (f.last >= 1) { let p = ''; for (let d = 1; d <= f.last; d++) p += (d === 1 ? 'M' : 'L') + x(d).toFixed(1) + ' ' + y(f.a[d]).toFixed(1); s += `<path d="${p}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`; }
    if (f.from <= n && f.last < n) { let p = f.last >= 1 ? `M${x(f.last).toFixed(1)} ${y(f.a[f.last]).toFixed(1)}` : ''; for (let d = Math.max(1, f.last + 1); d <= n; d++) p += (p ? 'L' : 'M') + x(d).toFixed(1) + ' ' + y(f.p[d]).toFixed(1); s += `<path d="${p}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 5" stroke-linejoin="round"/>`; }
    if (f.last >= 1 && f.last <= n) s += `<circle cx="${x(f.last)}" cy="${y(f.a[f.last])}" r="5" fill="var(--brand)" stroke="var(--card)" stroke-width="2"/>`;
    s += `<text x="${x(n) + 6}" y="${y(val(n)) + 4}" style="fill:var(--ink);font-weight:700">${fmtC(val(n))}</text>`;
    s += `<line class="base xh" y1="${T}" y2="${H - B}" visibility="hidden"/><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg>`;
    el.innerHTML = s;
    const svg = $('svg', el), xh = $('.xh', el);
    const move = (e) => {
      const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W, d = Math.max(1, Math.min(n, Math.round(((px - L) / (W - L - R)) * (n - 1)) + 1));
      xh.setAttribute('x1', x(d)); xh.setAttribute('x2', x(d)); xh.setAttribute('visibility', 'visible');
      showTip(el, (x(d) / W) * r.width, y(val(d)), `<b>${sDate(month + '-' + pad(d))}</b> · ${d <= f.last ? 'Saldo' : 'Perkiraan'} ${fmt(val(d))}`);
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', () => { xh.setAttribute('visibility', 'hidden'); hideTip(el); });
  }
  function drawTrend(el) {
    const month = UI.m.month, ms = [];
    for (let i = 5; i >= 0; i--) ms.push(addMonth(month, -i));
    const data = ms.map((mk) => { const st = stats(mk); return { mk, inc: st.incA, A: st.A, spent: st.spent }; });
    if (!data.some((d) => d.inc || d.spent)) { el.innerHTML = '<p class="muted small">Catat beberapa transaksi, nanti ini keisi bulan demi bulan.</p>'; return; }
    const W = Math.max(260, el.clientWidth), H = 200, L = 44, R = 8, T = 12, B = 24;
    const tk = ticks(0, Math.max.apply(null, data.map((d) => Math.max(d.inc, d.spent)).concat(1))), hi = tk[tk.length - 1];
    const bw = (W - L - R) / 6, w = Math.min(40, bw * 0.5), y = (v) => T + (1 - v / hi) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Pengeluaran per kelompok dan pemasukan enam bulan terakhir">`;
    tk.forEach((v) => { s += `<line class="${v === 0 ? 'base' : 'grid'}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmtC(v)}</text>`; });
    data.forEach((d, i) => {
      const cx = L + bw * i + bw / 2, x0 = cx - w / 2;
      let base = 0;
      const segs = SPEND.filter((k) => d.A[k] > 0);
      segs.forEach((k, j) => {
        const y1 = y(base), y2 = y(base + d.A[k]); base += d.A[k];
        const top = j === segs.length - 1, hh = Math.max(1, y1 - y2 - (j ? 2 : 0)), r = top ? Math.min(4, hh) : 0;
        s += `<path d="M${x0} ${y2 + hh}V${y2 + r}Q${x0} ${y2} ${x0 + r} ${y2}H${x0 + w - r}Q${x0 + w} ${y2} ${x0 + w} ${y2 + r}V${y2 + hh}Z" fill="var(--${k})"/>`;
      });
      if (d.inc) s += `<line x1="${cx - w * 0.8}" x2="${cx + w * 0.8}" y1="${y(d.inc)}" y2="${y(d.inc)}" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>`;
      s += `<text x="${cx}" y="${H - 6}" text-anchor="middle"${d.mk === month ? ' style="fill:var(--ink);font-weight:700"' : ''}>${MON[+d.mk.slice(5) - 1]}</text>`;
      s += `<rect data-i="${i}" x="${L + bw * i}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"/>`;
    });
    el.innerHTML = s + '</svg>';
    const svg = $('svg', el);
    const move = (e) => {
      const i = e.target.dataset && e.target.dataset.i;
      if (i === undefined) { hideTip(el); return; }
      const d = data[i], r = svg.getBoundingClientRect();
      showTip(el, ((L + bw * i + bw / 2) / W) * r.width, y(Math.max(d.inc, d.spent)), `<b>${monthLabel(d.mk)}</b><br>Pemasukan ${fmt(d.inc)}<br>${SPEND.map((k) => GROUPS[k].label + ' ' + fmt(d.A[k])).join('<br>')}<br><b>Selisih ${fmt(d.inc - d.spent)}</b>`);
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', () => hideTip(el));
  }
  function drawCharts() { document.querySelectorAll('[data-chart]').forEach((el) => (el.dataset.chart === 'flow' ? drawFlow(el) : drawTrend(el))); }
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCharts, 150); });

  /* ---------- sheets ---------- */
  const amtField = (name, label, v, big) => `<div class="field"><label>${label}</label><input name="${name}" class="${big ? 'm-big' : ''}" inputmode="numeric" autocomplete="off" data-amt value="${amtStr(v)}" placeholder="0"></div>`;
  const foot = (del, label) => `<p class="noc small" id="mErr" hidden style="margin-bottom:8px"></p><div class="btnrow"><button class="btn wide">${label || 'Simpan'}</button>${del ? `<button type="button" class="btn danger wide" data-act="${del}">Hapus</button>` : ''}</div>`;
  const fail = (msg) => { const e = $('#mErr'); if (e) { e.textContent = msg; e.hidden = false; } };
  const armed = new WeakSet();
  function confirmTwice(btn) { if (armed.has(btn)) return true; armed.add(btn); btn.textContent = 'Pencet lagi buat yakin'; return false; }
  function catOptions(type, sel) {
    return (type === 'in' ? ['income'] : SPEND).map((g) => `<optgroup label="${GROUPS[g].label}">${itemsOf(g).map((i) => `<option value="${i.id}"${sel === i.id ? ' selected' : ''}>${esc(i.name)}</option>`).join('')}<option value="other:${g}"${sel === 'other:' + g ? ' selected' : ''}>${GROUPS[g].label} lainnya</option></optgroup>`).join('');
  }
  function openTx(pre) {
    pre = pre || {};
    const ex = pre.id ? (findTx(pre.id) || {}).t : null, t = todayStr(), month = UI.m.month;
    const v = ex ? { type: ex.t, a: ex.a, cat: ex.item && item(ex.item) ? ex.item : 'other:' + ex.g, d: ex.d, note: ex.note || '' }
      : { type: pre.type || 'out', a: pre.a || 0, cat: pre.cat || '', d: pre.d || (month === mkOf(t) ? t : month + '-01'), note: pre.note || '' };
    UI.m.editId = ex ? ex.id : null;
    openSheet(`<h2>${ex ? 'Ubah transaksi' : 'Catat transaksi'}</h2><form data-form="m-tx">
      <div class="segr"><label><input type="radio" name="type" value="out"${v.type === 'out' ? ' checked' : ''}>Uang keluar</label><label><input type="radio" name="type" value="in"${v.type === 'in' ? ' checked' : ''}>Uang masuk</label></div>
      ${amtField('amount', 'Jumlah (' + esc(cur()) + ')', v.a, true)}
      <div class="field"><label>Baris budget</label><select name="cat" id="mCat">${catOptions(v.type, v.cat)}</select></div>
      <div class="field"><div class="row"><div><label>Tanggal</label><input type="date" name="date" value="${v.d}"></div><div><label>Catatan</label><input name="note" value="${esc(v.note)}" maxlength="80" autocomplete="off"></div></div></div>
      ${foot(ex ? 'm-del-tx' : '')}</form>`);
  }
  FORMS['m-tx'] = (f) => {
    const a = parseAmt(f.elements.amount.value);
    if (!a) return fail('Isi jumlahnya, lebih dari nol.');
    const ex = UI.m.editId ? (findTx(UI.m.editId) || {}).t : null;
    const type = f.elements.type.value, cat = f.elements.cat.value || 'other:' + (type === 'in' ? 'income' : 'needs'), d = f.elements.date.value || todayStr();
    let itemId = null, g, name;
    if (cat.startsWith('other:')) { g = cat.slice(6); name = GROUPS[g].label + ' lainnya'; } else { const it = item(cat); itemId = it.id; g = it.group; name = it.name; }
    const tx = { id: ex ? ex.id : uid(), d, t: type, a, item: itemId, name, g, note: f.elements.note.value.trim() };
    const mk = mkOf(d);
    if (ex) delTx(ex.id);
    if (ex && ex.occ && ex.item === itemId) tx.occ = ex.occ;
    else if (itemId && !paidTx(itemId, mk) && (g === 'income' || dueDate(item(itemId), mk)) && a >= planned(item(itemId), mk)) tx.occ = mk;
    addTx(tx);
    closeSheet(); commit();
    if (type === 'out' && itemId) { const p = planned(item(itemId), mk), spent = act(itemId, mk); if (p && spent > p) toast(name + ' lewat budget ' + fmt(spent - p)); }
  };
  function openItem(pre) {
    const ex = pre.id ? item(pre.id) : null;
    const v = ex || { name: '', group: pre.g || 'needs', amount: 0, repeat: 'monthly', day: '', date: '', target: 0 };
    const sched = v.repeat === 'once' ? 'once' : v.repeat === 'yearly' ? 'yearly' : v.day ? 'day' : 'flex';
    UI.m.editId = ex ? ex.id : null;
    openSheet(`<h2>${ex ? 'Ubah baris budget' : 'Baris budget baru'}</h2><form data-form="m-item">
      <div class="field"><label>Nama</label><input name="name" value="${esc(v.name)}" maxlength="40" autocomplete="off"></div>
      <div class="field"><div class="row"><div><label>Kelompok</label><select name="group" id="mGroup">${Object.keys(GROUPS).map((g) => `<option value="${g}"${v.group === g ? ' selected' : ''}>${GROUPS[g].label}</option>`).join('')}</select></div>
      ${amtField('amount', 'Rencana (' + esc(cur()) + ')', v.amount)}</div></div>
      <div class="field"><label>Kapan</label><select name="sched" id="mSched">
        <option value="flex"${sched === 'flex' ? ' selected' : ''}>Tiap bulan, tanpa tanggal tetap</option><option value="day"${sched === 'day' ? ' selected' : ''}>Tiap bulan di tanggal tertentu</option>
        <option value="once"${sched === 'once' ? ' selected' : ''}>Sekali di satu tanggal</option><option value="yearly"${sched === 'yearly' ? ' selected' : ''}>Tiap tahun di satu tanggal</option></select></div>
      <div class="field" id="mFDay"><label>Tanggal tiap bulan (1–31)</label><input name="day" inputmode="numeric" value="${v.day || ''}" placeholder="15"></div>
      <div class="field" id="mFDate"><label>Tanggal</label><input type="date" name="idate" value="${v.date || ''}"></div>
      <div id="mFTarget">${amtField('target', 'Target tabungan, opsional (' + esc(cur()) + ')', v.target)}</div>
      ${foot(ex ? 'm-del-item' : '')}</form>`);
    syncItemForm();
  }
  function syncItemForm() {
    const s = $('#mSched'), g = $('#mGroup');
    if (!s) return;
    $('#mFDay').hidden = s.value !== 'day'; $('#mFDate').hidden = s.value !== 'once' && s.value !== 'yearly'; $('#mFTarget').hidden = g.value !== 'future';
  }
  FORMS['m-item'] = (f) => {
    const el = f.elements, name = el.name.value.trim(), amount = parseAmt(el.amount.value), s = el.sched.value, group = el.group.value;
    if (!name) return fail('Kasih nama barisnya.');
    if (!amount) return fail('Isi jumlah rencananya, lebih dari nol.');
    const ex = UI.m.editId ? item(UI.m.editId) : null;
    const it = ex || { id: uid(), from: UI.m.month };
    const next = { name, group, amount, repeat: s === 'once' ? 'once' : s === 'yearly' ? 'yearly' : 'monthly', day: 0, date: '', target: group === 'future' ? parseAmt(el.target.value) : 0 };
    if (s === 'day') { const d = parseAmt(el.day.value); if (d < 1 || d > 31) return fail('Tanggalnya antara 1 sampai 31.'); next.day = d; }
    if (s === 'once' || s === 'yearly') { if (!el.idate.value) return fail('Pilih tanggalnya.'); next.date = el.idate.value; }
    Object.assign(it, next);
    if (!ex) cfg().items.push(it);
    closeSheet(); commit();
  };
  function openList(pre) {
    const ex = pre.id ? cfg().lists.find((l) => l.id === pre.id) : null, v = ex || { title: '', list: pre.l || 'must', amount: 0, date: '' };
    UI.m.editId = ex ? ex.id : null;
    openSheet(`<h2>${ex ? 'Ubah item' : 'Item baru'}</h2><form data-form="m-list">
      <div class="field"><label>Apa</label><input name="title" value="${esc(v.title)}" maxlength="60" autocomplete="off"></div>
      <div class="field"><label>List</label><select name="list">${Object.keys(LISTS).map((k) => `<option value="${k}"${v.list === k ? ' selected' : ''}>${LISTS[k].label}</option>`).join('')}</select></div>
      <div class="field"><div class="row">${amtField('amount', 'Biaya, opsional', v.amount)}<div><label>Tanggal, opsional</label><input type="date" name="date" value="${v.date || ''}"></div></div></div>
      ${foot(ex ? 'm-del-list' : '')}</form>`);
  }
  FORMS['m-list'] = (f) => {
    const title = f.elements.title.value.trim();
    if (!title) return fail('Tulis itemnya apa.');
    const ex = UI.m.editId ? cfg().lists.find((l) => l.id === UI.m.editId) : null;
    const l = ex || { id: uid(), done: false };
    Object.assign(l, { title, list: f.elements.list.value, amount: parseAmt(f.elements.amount.value), date: f.elements.date.value || '' });
    if (!ex) cfg().lists.push(l);
    closeSheet(); commit();
  };
  function openSettings() {
    const c = cfg(), n = Object.assign({}, NOTIFY, c.notify || {});
    openSheet(`<h2>Pengaturan uang</h2><form data-form="m-settings">
      <div class="field"><div class="row"><div><label>Simbol mata uang</label><input name="currency" value="${esc(c.currency)}" maxlength="4"></div>${amtField('opening', 'Saldo awal', c.opening)}</div></div>
      <div class="field"><span class="lab">Target pembagian, persen (jumlahnya 100)</span><div class="row">${SPEND.map((k) => `<div><label>${GROUPS[k].label}</label><input name="g_${k}" inputmode="numeric" value="${c.goals[k]}"></div>`).join('')}</div></div>
      <div class="field"><span class="lab">Notifikasi</span>
        <label class="m-chk"><input type="checkbox" name="n_on"${n.on ? ' checked' : ''}>Tagihan, pemasukan, dan item list bertanggal</label>
        <label class="m-chk"><input type="checkbox" name="n_log"${n.log ? ' checked' : ''}>Pengingat malam buat nyatat pengeluaran</label>
        <div class="row" style="margin-top:8px"><div><label>Jatuh tempo jam</label><input type="time" name="n_time" value="${esc(n.time)}"></div><div><label>Pengingat malam jam</label><input type="time" name="n_logTime" value="${esc(n.logTime)}"></div></div></div>
      <p class="noc small" id="mErr" hidden style="margin-bottom:8px"></p><button class="btn wide">Simpan</button>
      <div class="field" style="margin-top:16px"><label>Pindahin data dari Dompet Planner</label><textarea name="backup" rows="3" placeholder="Di Dompet Planner: Settings → Copy my data. Tempel di sini, lalu pencet Pulihkan." spellcheck="false" style="font:12px/1.4 ui-monospace,monospace"></textarea></div>
      <div class="btnrow"><button type="button" class="btn ghost" data-act="m-import">Pulihkan dari teks</button><button type="button" class="btn danger" data-act="m-erase">Kosongkan data uang</button></div></form>`);
  }
  FORMS['m-settings'] = (f) => {
    const el = f.elements, g = {};
    SPEND.forEach((k) => { g[k] = parseAmt(el['g_' + k].value); });
    if (sum(SPEND.map((k) => g[k])) !== 100) return fail('Tiga targetnya berjumlah ' + sum(SPEND.map((k) => g[k])) + '. Bikin jadi 100.');
    const c = cfg();
    c.currency = el.currency.value.trim() || 'Rp'; c.opening = parseAmt(el.opening.value); c.goals = g;
    c.notify = { on: el.n_on.checked, time: el.n_time.value || '08:00', log: el.n_log.checked, logTime: el.n_logTime.value || '20:00' };
    closeSheet(); commit(); toast('Tersimpan');
  };

  /* ---------- actions ---------- */
  ACT['m-nav'] = (b) => { UI.m.view = b.dataset.v; render(); window.scrollTo(0, 0); };
  ACT['m-month'] = (b) => { const d = +b.dataset.d; UI.m.month = d ? addMonth(UI.m.month, d) : mkOf(todayStr()); UI.m.selDay = null; render(); };
  ACT['m-day'] = (b) => { UI.m.selDay = b.dataset.d; render(); };
  ACT['m-settings'] = () => openSettings();
  ACT['m-filter'] = (b) => { UI.m.filter = b.dataset.f; render(); };
  ACT['m-add-tx'] = (b) => {
    const id = b.dataset.item;
    if (id) { const it = item(id), left = planned(it, UI.m.month) - act(id, UI.m.month); openTx({ type: it.group === 'income' ? 'in' : 'out', cat: id, a: left > 0 ? left : 0 }); }
    else openTx({ d: b.dataset.date || (UI.m.view === 'calendar' && UI.m.selDay ? UI.m.selDay : undefined) });
  };
  ACT['m-edit-tx'] = (b) => openTx({ id: b.dataset.id });
  ACT['m-del-tx'] = (b) => { if (!confirmTwice(b)) return; delTx(UI.m.editId); closeSheet(); commit(); };
  ACT['m-add-item'] = (b) => openItem({ g: b.dataset.g });
  ACT['m-edit-item'] = (b) => openItem({ id: b.dataset.id });
  ACT['m-del-item'] = (b) => { if (!confirmTwice(b)) return; cfg().items = cfg().items.filter((i) => i.id !== UI.m.editId); closeSheet(); commit(); };
  ACT['m-tick'] = (b) => {
    const it = item(b.dataset.id), month = b.dataset.mk || UI.m.month, inc = it.group === 'income', ex = paidTx(it.id, month);
    if (ex) { delTx(ex.id); commit(); toast(it.name + ' dibatalkan'); return; }
    const x = payItem(it, month);
    commit(); toast(it.name + (inc ? ' diterima' : ' lunas') + ' · ' + fmt(x.a), () => delTx(x.id));
  };
  ACT['m-add-list'] = (b) => openList({ l: b.dataset.l });
  ACT['m-edit-list'] = (b) => openList({ id: b.dataset.id });
  ACT['m-del-list'] = (b) => { if (!confirmTwice(b)) return; cfg().lists = cfg().lists.filter((l) => l.id !== UI.m.editId); closeSheet(); commit(); };
  ACT['m-tick-list'] = (b) => {
    const l = cfg().lists.find((x) => x.id === b.dataset.id);
    l.done = !l.done; commit();
    if (l.done && l.amount) { UI.m.logOffer = l.id; toast('Selesai: ' + l.title, null, { label: 'Catat ' + fmt(l.amount), act: 'm-log-offer' }); }
  };
  ACT['m-clear-done'] = (b) => { cfg().lists = cfg().lists.filter((l) => !(l.list === b.dataset.l && l.done)); commit(); };
  ACT['m-import'] = () => {
    let d;
    try { d = JSON.parse($('#sheet textarea[name="backup"]').value); } catch (e) { return fail('Teks itu bukan backup. Tempel semuanya.'); }
    if (!d || !d.cfg || !Array.isArray(d.cfg.items)) return fail('Teks itu bukan backup Dompet Planner.');
    S.money = { cfg: d.cfg, months: d.months || {} };
    closeSheet(); commit(); toast('Data Dompet Planner dipulihkan');
  };
  ACT['m-erase'] = (b) => { if (!confirmTwice(b)) return; S.money = { cfg: blankCfg(), months: {} }; closeSheet(); commit(); };
  ACT['m-open'] = () => { UI.stack = []; UI.scroll = []; UI.tab = 'money'; UI.m.view = 'home'; UI.m.month = mkOf(todayStr()); render(); window.scrollTo(0, 0); };
  /** The extra button on the "done, log it?" toast. */
  ACT['m-log-offer'] = () => {
    const l = cfg().lists.find((x) => x.id === UI.m.logOffer);
    $('#toast').classList.remove('show');
    if (l) openTx({ type: 'out', a: l.amount, cat: 'other:' + LISTS[l.list].cat, note: l.title, d: todayStr() });
  };

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches && el.matches('[data-amt]')) { const n = parseAmt(el.value); el.value = n ? n.toLocaleString('id-ID') : ''; }
    if (el.dataset && el.dataset.input === 'm-search') { UI.m.q = el.value; $('#mLog').innerHTML = logRows(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.name === 'type' && el.closest('form[data-form="m-tx"]')) $('#mCat').innerHTML = catOptions(el.value, '');
    if (el.id === 'mSched' || el.id === 'mGroup') syncItemForm();
  });

  /* ---------- hooks for the rest of the app ---------- */
  window.Money = {
    afterRender() { if ($('[data-chart]')) drawCharts(); },
    /** One line on the Hari ini screen. */
    todayCard() {
      const c = cfg();
      if (!c.items.length && !Object.keys(M().months).length) return '';
      memo = null;
      const s = safe();
      return `<button class="card m-today" data-act="m-open"><span class="grow"><small>Aman dipakai hari ini</small><b>${fmt(s.perDay)}</b></span><span class="muted small">Saldo ${fmtC(s.bal)}</span><span class="chev">›</span></button>`;
    },
    /** Bills, income and dated list items on a calendar date. */
    dayCard(ds) {
      memo = null;
      const mk = mkOf(ds), t = todayStr();
      const rows = dues(mk).filter((o) => o.date === ds).map((o) => dueRow(o, t).replace('data-act="m-tick"', `data-act="m-tick" data-mk="${mk}"`))
        .concat(cfg().lists.filter((l) => l.date === ds).map((l) => listRow(l, t, true)));
      return rows.length ? `<section class="card"><header><h3>💸 Uang</h3><span class="count">${rows.length}</span></header>${rows.join('')}</section>` : '';
    },
    summaryCard() {
      memo = null;
      const s = safe();
      return `<div class="card"><div class="stat"><div><b>${fmtC(s.bal)}</b><small>Saldo sekarang</small></div><div><b>${fmtC(s.perDay)}</b><small>Aman dipakai / hari</small></div><div><b>${fmtC(s.bills)}</b><small>Tagihan belum dibayar</small></div></div>
        <button class="btn wide" data-act="m-open">Buka Uang — catat transaksi</button></div>`;
    },
    /** Notifications for one day: what is due (answerable with Sudah / Belum) and the evening nudge. */
    queue(d, ds, now, out) {
      if (!S.money || !S.money.cfg) return;
      memo = null;
      const c = S.money.cfg, n = Object.assign({}, NOTIFY, c.notify || {});
      if (n.on) {
        const items = [];
        for (const [off, label] of [[1, 'jatuh tempo besok'], [0, 'jatuh tempo hari ini'], [-1, 'telat 1 hari'], [-3, 'telat 3 hari']]) {
          const target = ymd(addDays(d, off)), mk = mkOf(target);
          for (const o of dues(mk)) {
            if (o.paid || o.date !== target) continue;
            const inc = o.it.group === 'income';
            if (inc && off !== 0) continue;
            items.push({ k: 'pay|' + o.it.id + '|' + mk, x: inc ? `${o.it.name} diharapkan masuk hari ini · ${fmt(o.amount)}` : `${o.it.name} ${label} · ${fmt(o.amount)}` });
          }
        }
        const tomorrow = ymd(addDays(d, 1));
        for (const l of c.lists) {
          if (l.done || (l.date !== ds && l.date !== tomorrow)) continue;
          items.push({ k: 'ml|' + l.id, x: `${LISTS[l.list].label} ${l.date === ds ? 'hari ini' : 'besok'}: ${l.title}${l.amount ? ' · ' + fmt(l.amount) : ''}` });
        }
        const at = atTime(d, n.time || '08:00');
        if (items.length && at > now) out.push({ id: 'm|' + ds, at, ch: 'tasks', title: '💸 Uang: jatuh tempo', items });
        if (d.getDate() === 1 && at > now && c.items.length) out.push({ id: 'mo|' + ds, at: at + 60000, ch: 'reminders', title: '💸 Budget ' + MONTHS[d.getMonth()] + ' dibuka', body: 'Cek apa aja yang jatuh tempo bulan ini dan berapa sisa yang belum dibudgetkan.' });
      }
      if (n.log) {
        const at = atTime(d, n.logTime || '20:00');
        if (at > now) out.push({ id: 'mlog|' + ds, at, ch: 'reminders', title: '📝 Catat pengeluaran hari ini', body: 'Semenit sekarang bikin angka aman-dipakai tetap bener.' });
      }
    },
    /** An answer given from a notification. */
    result(key, v) {
      if (!S.money || !S.money.cfg || v !== 1) return;
      memo = null;
      if (key.startsWith('pay|')) {
        const [, id, mk] = key.split('|'), it = item(id);
        if (it && !paidTx(id, mk)) payItem(it, mk);
      } else if (key.startsWith('ml|')) {
        const l = cfg().lists.find((x) => x.id === key.slice(3));
        if (l) l.done = true;
      }
    },
    doneKeys() {
      if (!S.money || !S.money.cfg) return [];
      const keys = [], ix = idx();
      ix.paid.forEach((t, k) => keys.push('pay|' + k));
      cfg().lists.forEach((l) => { if (l.done) keys.push('ml|' + l.id); });
      return keys;
    },
  };
})();
