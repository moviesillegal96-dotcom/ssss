/* A1O — Uang: a money manager laid out like a classic "Money Manager" app.
 *
 * Accounts hold wallets. Every record is income, an expense or a transfer between two wallets of the same account.
 * Screens: Transaction, Calendar, Statistic and Wallet (wallets, budgets, goals, debts, recurring), plus pages for
 * adding / editing a record, picking a category or wallet, a calculator, search, managing things and settings.
 * Data lives in S.mm. The older planner data in S.money is left untouched (its budget lines seed the budgets). */
'use strict';
(() => {
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const EVERY = { none: 'None', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const g = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const dayDiff = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);
  const mdy = (ds) => { const d = parseYmd(ds); return MON3[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  const md = (d) => MON3[d.getMonth()] + ' ' + d.getDate();
  function addMonths(ds, n, day) {
    const [y, m, dd] = ds.split('-').map(Number);
    const first = new Date(y, m - 1 + n, 1), last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return ymd(new Date(first.getFullYear(), first.getMonth(), Math.min(day || dd, last)));
  }

  /* ---------- icons ---------- */
  const I = {
    back: g('<path d="M20 12H5M11 5l-7 7 7 7"/>'),
    search: g('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>'),
    cal31: g('<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17M8 2.5v4M16 2.5v4"/><text x="12" y="18.2" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none">31</text>'),
    home: g('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>'),
    bars: g('<path d="M5 20V11M10 20V5M15 20v-7M20 20V8M3 20.5h18"/>'),
    gear: g('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    down: g('<path d="m7 10 5 5 5-5"/>'),
    left: g('<path d="m15 5-7 7 7 7"/>'),
    right: g('<path d="m9 5 7 7-7 7"/>'),
    caret: '<i class="mm-caret"></i>',
    eye: g('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: g('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.1 6.1C3.6 7.8 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.9-2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    plus: g('<path d="M12 5v14M5 12h14"/>'),
    loop: g('<path d="M17 2.5 20.5 6 17 9.5"/><path d="M4 11.5V10a4 4 0 0 1 4-4h12.5M7 21.5 3.5 18 7 14.5"/><path d="M20 12.5V14a4 4 0 0 1-4 4H3.5"/>'),
    img: g('<rect x="3" y="4" width="15" height="14" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 16 4.5-4.5 4 4 2.5-2.5 4 4M19 15v6M16 18h6"/>'),
    calc: g('<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>'),
    info: g('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>'),
    trash: g('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
    edit: g('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
    minus: g('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'),
    check: g('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    help: g('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'),
    navTx: g('<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    navCal: g('<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/>'),
    navStat: g('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6M12 12H3.5"/>'),
    navWal: g('<rect x="3" y="5.5" width="18" height="14" rx="2.5"/><path d="M16 10.5h5v5h-5a2.5 2.5 0 0 1 0-5z"/>'),
    p1: '<span class="mm-pi">1</span>', p7: '<span class="mm-pi">7</span>', p31: '<span class="mm-pi">31</span>', p90: '<span class="mm-pi">90</span>', p12: '<span class="mm-pi">12</span>', pAll: '<span class="mm-pi">∞</span>',
  };
  /* Category and wallet glyphs (white line art inside a coloured circle or tile). */
  const G = {
    bill: '<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21z"/><path d="M9.5 8h5M9.5 12h5"/>',
    shirt: '<path d="M8.5 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4.5-3c-.6 1.6-2 2.5-3.5 2.5S9.1 5.6 8.5 4z"/>',
    cap: '<path d="m2 9.5 10-5 10 5-10 5z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5M22 9.5v5"/>',
    ticket: '<path d="M3.5 7h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4z"/><path d="M14 7.5v2M14 11v2M14 14.5v2"/>',
    dumbbell: '<path d="M6.5 7.5v9M3.5 10v4M17.5 7.5v9M20.5 10v4M6.5 12h11"/>',
    fork: '<path d="M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M17 21V3c-2.2 1-3.5 4-3.5 8H17"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11M12 9c-1-3-5-4.5-5-1.5S10.5 9 12 9zm0 0c1-3 5-4.5 5-1.5S13.5 9 12 9z"/>',
    health: '<rect x="3.5" y="6.5" width="17" height="13" rx="2"/><path d="M9 6.5v-2h6v2M12 10v6M9 13h6"/>',
    sofa: '<path d="M5.5 10.5V8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2.5"/><path d="M3 12.5a2 2 0 0 1 4 0V14h10v-1.5a2 2 0 0 1 4 0V18H3zM5.5 18v2M18.5 18v2"/>',
    paw: '<circle cx="8" cy="7.5" r="1.7"/><circle cx="16" cy="7.5" r="1.7"/><circle cx="4.8" cy="12" r="1.5"/><circle cx="19.2" cy="12" r="1.5"/><path d="M12 11.5c-3 0-5 3.2-5 5.3 0 1.4 1.3 2.2 2.5 2.2s1.6-.6 2.5-.6 1.3.6 2.5.6 2.5-.8 2.5-2.2c0-2.1-2-5.3-5-5.3z"/>',
    cart: '<path d="M3 4h2.2l2.4 11h10l2-8H6.3"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    car: '<path d="M4 16.5v-4.5l2-5h12l2 5v4.5zM4 16.5V19h3v-2.5M17 16.5V19h3v-2.5M4 12h16"/><circle cx="7.5" cy="14.3" r=".7"/><circle cx="16.5" cy="14.3" r=".7"/>',
    plane: '<path d="M21 3.5 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 4.5-4.5"/>',
    grid: '<circle cx="8" cy="8" r="2.8"/><circle cx="16" cy="8" r="2.8"/><circle cx="8" cy="16" r="2.8"/><circle cx="16" cy="16" r="2.8"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M15.5 14.5h2.5"/>',
    medal: '<circle cx="12" cy="9.5" r="5.5"/><path d="m9 14.5-2 6.5 5-2 5 2-2-6.5M12 7v5"/>',
    bonus: '<path d="M9 3.5h6l-1.5 3h-3z"/><path d="M10.5 6.5C6 8.5 5 12.5 5 15.5a4.5 4.5 0 0 0 4.5 4.5h5a4.5 4.5 0 0 0 4.5-4.5c0-3-1-7-5.5-9"/><path d="M12 10.5v6.5M14 11.8c-.4-.6-1.1-.9-2-.9-1.1 0-2 .6-2 1.5 0 2 4 1 4 3 0 .9-.9 1.5-2 1.5-.9 0-1.6-.3-2-.9"/>',
    trend: '<path d="m4 17.5 6-6 3 3 7-7"/><path d="M15 7.5h5v5"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5v11M14.6 9.3c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2 0 2.7 5.2 1.4 5.2 4.1 0 1.2-1.1 2-2.6 2-1.1 0-2.1-.5-2.6-1.4"/>',
    ball: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v5.3M12 15.2v5.3"/>',
    salary: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9v6M17.5 9v6"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
    cash: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M12 8v8M14.3 9.8c-.4-.7-1.2-1.1-2.3-1.1-1.3 0-2.3.7-2.3 1.7 0 2.4 4.6 1.2 4.6 3.6 0 1-.9 1.7-2.3 1.7-1 0-1.9-.4-2.3-1.1"/>',
    chart: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m7 15 3.5-3.5 2.5 2.5 4-5"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 13.5c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01M7 6.5 9 8M17 6.5 15 8"/>',
    piggy: '<path d="M4.5 11.5A6.5 5.5 0 0 1 16 8h3v3.2l1.5 1V15H18l-2 3h-2v-2h-4v2H8l-1.2-3C5.5 14.5 4.5 13.2 4.5 11.5z"/><path d="M14.5 11h.01M9 6.5c0-1.5 1.5-2.5 3-2"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
    house: '<path d="M4 11 12 4l8 7v9h-5.5v-6h-5v6H4z"/>',
    game: '<rect x="2.5" y="7.5" width="19" height="10" rx="4.5"/><path d="M7.5 10.5v4M5.5 12.5h4M15.5 11.5h.01M17.5 13.5h.01"/>',
    book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h13v15h-13a2 2 0 0 0-2 2zM4.5 20.5v-15M8 7.5h8"/>',
    fuel: '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3.5 21h13M7.5 7.5h5"/><path d="M15 10h2a1 1 0 0 1 1 1v5.5a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.8 12.5a9.4 9.4 0 0 1 12.4 0M9.2 16a4.6 4.6 0 0 1 5.6 0"/><circle cx="12" cy="19.2" r=".9"/>',
    mosque: '<path d="M6 21v-7a6 6 0 0 1 12 0v7zM12 3v2.5M3.5 21V12M20.5 21V12M3 21h18M10 21v-3a2 2 0 0 1 4 0v3"/>',
    transfer: '<path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5"/>',
  };
  const C = (id, name, color, icon) => ({ id, name, color, icon });
  const BASE = {
    out: [C('bills', 'Bills', '#2196f3', 'bill'), C('clothing', 'Clothing', '#29a9ef', 'shirt'), C('education', 'Education', '#1ea69a', 'cap'),
      C('entertainment', 'Entertainment', '#1fbcb0', 'ticket'), C('fitness', 'Fitness', '#7cb342', 'dumbbell'), C('food', 'Food', '#f6b800', 'fork'),
      C('gifts', 'Gifts', '#f7a21b', 'gift'), C('health', 'Health', '#ef4a4a', 'health'), C('furniture', 'Furniture', '#e33e6c', 'sofa'),
      C('pet', 'Pet', '#9a3fb8', 'paw'), C('shopping', 'Shopping', '#a14fc2', 'cart'), C('transportation', 'Transportation', '#e8337f', 'car'),
      C('travel', 'Travel', '#3b82f6', 'plane'), C('others', 'Others', '#8155f5', 'grid')],
    in: [C('allowance', 'Allowance', '#35a4f4', 'wallet'), C('award', 'Award', '#0f8f7e', 'medal'), C('bonus', 'Bonus', '#17b7a6', 'bonus'),
      C('dividend', 'Dividend', '#f6b400', 'trend'), C('investment', 'Investment', '#f7a400', 'coin'), C('lottery', 'Lottery', '#ef5350', 'ball'),
      C('salary', 'Salary', '#c2185b', 'salary'), C('tips', 'Tips', '#8e3fc0', 'bulb'), C('others', 'Others', '#8155f5', 'grid')],
  };
  const TRANSFER = { name: 'Transfer', color: '#5f6670', icon: 'transfer' };
  const COLORS = ['#1a9bf0', '#e02424', '#16a34a', '#f59e0b', '#8b5cf6', '#e8337f', '#14b8a6', '#7d8590', '#4a4d52', '#f97316'];
  const WICONS = ['cash', 'wallet', 'piggy', 'salary', 'chart', 'smile', 'fuel', 'heart', 'star', 'house', 'phone', 'game', 'book', 'mosque', 'wifi', 'gift', 'fork', 'car'];
  const DONUT = ['#1de9b6', '#ef5350', '#fbc02d', '#5c7cfa', '#a06cf8'];

  /* ---------- state ---------- */
  const blank = () => ({ v: 2, acc: '', accounts: [], wallets: [], tx: [], budgets: [], goals: [], debts: [], recs: [], cats: { in: [], out: [], hide: [] },
    opt: { theme: 'dark', hide: false, week: 0, cur: 'Rp', remind: false, remindAt: '20:00' } });
  function guessCat(name) {
    const n = String(name || '').toLowerCase();
    const rules = [[/bensin|pertalite|parkir|ojek|grab|gojek|motor|tol\b/, 'transportation'], [/kuota|pulsa|listrik|wifi|tagihan|netflix|spotify|langganan|bayar/, 'bills'],
      [/kucing|pet\b|hewan/, 'pet'], [/jajan|makan|minum|kopi|snack|bakso|geprek/, 'food'], [/sedekah|infaq|zakat|kado|hadiah/, 'gifts'], [/gym|creatine|vitamin|fitness/, 'fitness'],
      [/sekolah|buku|les|kursus|print/, 'education'], [/baju|celana|sepatu/, 'clothing'], [/obat|dokter|sakit|facial/, 'health'], [/nonton|game|film|anime/, 'entertainment'],
      [/shopee|tokped|belanja/, 'shopping'], [/umroh|travel|tiket/, 'travel']];
    for (const [re, id] of rules) if (re.test(n)) return 'out:' + id;
    return 'out:others';
  }
  /** First start: the accounts, wallets and records in DATA.mm (the data file; for A1O, the ones from the Money Manager
   * app in the screen recording), or one "Money" wallet; plus the old planner's budget lines. */
  function seed() {
    const m = blank(), src = DATA.mm || { accounts: [{ name: 'Main', wallets: [{ name: 'Money', color: '#1a9bf0', icon: 'cash', start: 0 }] }] };
    for (const sa of src.accounts) {
      const a = { id: uid(), name: sa.name };
      m.accounts.push(a);
      const ids = {};
      for (const sw of sa.wallets || []) { const w = { id: uid(), acc: a.id, name: sw.name, color: sw.color || '#1a9bf0', icon: sw.icon || 'cash', start: sw.start || 0, excl: !!sw.excl }; m.wallets.push(w); ids[sw.name] = w.id; }
      for (const t of sa.tx || []) m.tx.push({ id: uid(), acc: a.id, type: t.type, a: t.a, cat: t.cat, w: ids[t.w] || Object.values(ids)[0], d: t.d, tm: t.tm || '12:00', desc: t.desc || '', memo: t.memo || '' });
    }
    m.acc = m.accounts[0].id;
    const a1 = m.accounts[0], main = m.wallets.find((w) => w.acc === a1.id && !w.excl) || m.wallets[0];
    const old = S.money;
    if (old && old.cfg) for (const it of old.cfg.items || []) if (it.group !== 'income' && it.amount) m.budgets.push({ id: uid(), acc: a1.id, name: it.name, amount: it.amount, cat: guessCat(it.name) });
    if (old && old.months) for (const mk in old.months) for (const t of old.months[mk].tx || []) {
      if (t.t !== 'in' && t.t !== 'out') continue;
      m.tx.push({ id: uid(), acc: a1.id, type: t.t, a: t.a, cat: t.t === 'in' ? 'in:others' : guessCat(t.name + ' ' + (t.note || '')), w: main.id, d: t.d, tm: '12:00', desc: t.name || '', memo: t.note || '' });
    }
    return m;
  }
  function M() {
    if (!S.mm || S.mm.v !== 2) { S.mm = seed(); save({ sync: false }); }
    const m = S.mm, b = blank();
    for (const k in b) if (m[k] === undefined) m[k] = b[k];
    m.opt = Object.assign(b.opt, m.opt);
    m.cats = Object.assign(b.cats, m.cats);
    if (!m.accounts.length) m.accounts.push({ id: uid(), name: 'Main' });
    if (!m.accounts.some((a) => a.id === m.acc)) m.acc = m.accounts[0].id;
    return m;
  }
  const acc = () => M().accounts.find((a) => a.id === M().acc);
  const wallets = (a) => M().wallets.filter((w) => w.acc === (a || M().acc));
  const wal = (id) => M().wallets.find((w) => w.id === id);
  const accTx = (a) => M().tx.filter((x) => x.acc === (a || M().acc));
  const byTime = (p, q) => (p.d === q.d ? ((q.tm || '') > (p.tm || '') ? 1 : (q.tm || '') < (p.tm || '') ? -1 : 0) : q.d > p.d ? 1 : -1);
  function walBal(w, until) {
    let b = w.start || 0;
    for (const x of M().tx) {
      if (until && x.d >= until) continue;
      if (x.type === 'in') { if (x.w === w.id) b += x.a; }
      else if (x.type === 'out') { if (x.w === w.id) b -= x.a; }
      else { if (x.w === w.id) b -= x.a + (x.fee || 0); if (x.to === w.id) b += x.a; }
    }
    return b;
  }
  const accBal = (a, until) => sum(wallets(a).filter((w) => !w.excl).map((w) => walBal(w, until)));
  function totals(list) {
    let inc = 0, exp = 0;
    for (const x of list) { if (x.type === 'in') inc += x.a; else if (x.type === 'out') exp += x.a; else if (x.fee) exp += x.fee; }
    return { inc, exp, net: inc - exp };
  }
  function catList(type) {
    const c = M().cats, base = BASE[type].filter((k) => !c.hide.includes(type + ':' + k.id));
    const others = base.filter((k) => k.id === 'others'), rest = base.filter((k) => k.id !== 'others');
    return rest.concat(c[type] || [], others).map((k) => Object.assign({ key: type + ':' + k.id }, k));
  }
  function catOf(key) {
    const [type, id] = String(key || 'out:others').split(':');
    const list = BASE[type] || BASE.out;
    return list.find((k) => k.id === id) || ((M().cats[type] || []).find((k) => k.id === id)) || BASE.out[BASE.out.length - 1];
  }

  /* ---------- recurring ---------- */
  const step = (ds, every, day) => (every === 'daily' ? ymd(addDays(parseYmd(ds), 1)) : every === 'weekly' ? ymd(addDays(parseYmd(ds), 7))
    : every === 'yearly' ? addMonths(ds, 12, day) : addMonths(ds, 1, day));
  function runRecs() {
    const m = M(), t = todayStr();
    let n = 0;
    for (const r of m.recs) {
      let guard = 0;
      while (r.next && r.next <= t && (!r.end || r.next <= r.end) && guard++ < 400) {
        m.tx.push(Object.assign({}, r.tpl, { id: uid(), d: r.next, rec: r.id }));
        r.next = step(r.next, r.every, r.day); n++;
      }
    }
    if (n) save();
  }

  /* ---------- formatting ---------- */
  const hidden = () => M().opt.hide;
  const num = (n) => Math.round(Math.abs(n)).toLocaleString('en-US');
  const money = (n) => (hidden() ? '••••••' : (n < 0 ? '-' : '') + M().opt.cur + ' ' + num(n));
  const parseNum = (s) => Number(String(s || '').replace(/[^\d]/g, '')) || 0;

  /* ---------- view state ---------- */
  UI.mm = { tab: 'tx', period: 'monthly', anchor: todayStr(), from: '', to: '', calMonth: todayStr().slice(0, 7), stack: [], q: '', calc: null, _next: null };
  // The draft being edited belongs to the page that opened it, so a page opened on top (a calculator, a new wallet)
  // can have its own and the one below is still there when it closes. Setting UI.mm.draft hands it to the next page pushed.
  Object.defineProperty(UI.mm, 'draft', {
    get() { for (let i = this.stack.length - 1; i >= 0; i--) if (this.stack[i].draft) return this.stack[i].draft; return null; },
    set(v) { this._next = v; },
  });
  const page = () => UI.mm.stack[UI.mm.stack.length - 1];
  function push(p) { if (UI.mm._next) { p.draft = UI.mm._next; UI.mm._next = null; } UI.mm.stack.push(p); render(); window.scrollTo(0, 0); }
  function pop() { UI.mm.stack.pop(); render(); window.scrollTo(0, 0); }
  function commit() { save(); render(); }

  function range() {
    const P = UI.mm.period, a = parseYmd(UI.mm.anchor), y = a.getFullYear(), mo = a.getMonth();
    switch (P) {
      case 'daily': return { from: UI.mm.anchor, to: UI.mm.anchor, label: mdy(UI.mm.anchor) };
      case 'weekly': { const s = addDays(a, -((a.getDay() - M().opt.week + 7) % 7)), e = addDays(s, 6); return { from: ymd(s), to: ymd(e), label: md(s) + ' - ' + md(e) + ', ' + e.getFullYear() }; }
      case 'quarterly': { const q = Math.floor(mo / 3); return { from: ymd(new Date(y, q * 3, 1)), to: ymd(new Date(y, q * 3 + 3, 0)), label: MON3[q * 3] + ' - ' + MON3[q * 3 + 2] + ' ' + y }; }
      case 'yearly': return { from: y + '-01-01', to: y + '-12-31', label: String(y) };
      case 'all': return { from: '', to: '', label: 'All' };
      case 'custom': { const f = UI.mm.from || UI.mm.anchor, t = UI.mm.to || UI.mm.anchor; return { from: f, to: t, label: md(parseYmd(f)) + ' - ' + mdy(t) }; }
      default: return { from: ymd(new Date(y, mo, 1)), to: ymd(new Date(y, mo + 1, 0)), label: MON3[mo] + ' ' + y };
    }
  }
  const inRange = (list, r) => list.filter((x) => (!r.from || x.d >= r.from) && (!r.to || x.d <= r.to));
  function shift(dir) {
    const P = UI.mm.period, a = parseYmd(UI.mm.anchor);
    if (P === 'daily') UI.mm.anchor = ymd(addDays(a, dir));
    else if (P === 'weekly') UI.mm.anchor = ymd(addDays(a, 7 * dir));
    else if (P === 'monthly') UI.mm.anchor = addMonths(UI.mm.anchor, dir);
    else if (P === 'quarterly') UI.mm.anchor = addMonths(UI.mm.anchor, 3 * dir);
    else if (P === 'yearly') UI.mm.anchor = addMonths(UI.mm.anchor, 12 * dir);
    else if (P === 'custom') { const r = range(), n = dayDiff(r.to, r.from) + 1; UI.mm.from = ymd(addDays(parseYmd(r.from), n * dir)); UI.mm.to = ymd(addDays(parseYmd(r.to), n * dir)); }
  }

  /* ---------- pieces ---------- */
  const ico = (c, cls) => `<span class="mm-ci${cls ? ' ' + cls : ''}" style="background:${c.color}">${g(G[c.icon] || G.grid)}</span>`;
  const wIco = (w) => `<span class="mm-wt" style="background:${w.color}">${g(G[w.icon] || G.cash)}</span>`;
  const radio = (on) => `<i class="mm-radio${on ? ' on' : ''}">${on ? I.check : ''}</i>`;
  const bar = (title, right, backAct) => `<div class="mm-bar"><button class="mm-ib" data-act="${backAct || 'mm-back'}" aria-label="Back">${I.back}</button><h1>${title}</h1>${right || ''}</div>`;
  function top(kind) {
    const a = acc();
    const exit = `<button class="mm-ib" data-act="mm-exit" aria-label="Kembali ke A1O" title="Kembali ke A1O">${I.home}</button>`;
    const btn = (act, icon, label) => `<button class="mm-ib" data-act="${act}" aria-label="${label}">${icon}</button>`;
    const right = { tx: [exit, btn('mm-search', I.search, 'Search'), btn('mm-period', I.cal31, 'Period')],
      cal: [exit, btn('mm-search', I.search, 'Search')],
      stat: [exit, btn('mm-trend', I.bars, 'Trend'), btn('mm-period', I.cal31, 'Period')],
      wal: [exit, btn('mm-settings', I.gear, 'Settings')] }[kind];
    const left = kind === 'wal'
      ? `<button class="mm-acc big" data-act="mm-accounts"><b>${esc(a.name)}</b>${I.down}</button>`
      : `<button class="mm-acc" data-act="mm-accounts"><small>${esc(a.name)}</small><b>${money(accBal())}${I.down}</b></button>`;
    return `<div class="mm-top">${left}<span class="grow"></span>${right.join('')}</div>`;
  }
  const pnav = (label, act) => `<div class="mm-pnav"><button class="mm-ib" data-act="${act || 'mm-shift'}" data-d="-1" aria-label="Previous">${I.left}</button><button class="mm-plab" data-act="${act ? 'mm-calToday' : 'mm-period'}">${label}</button><button class="mm-ib" data-act="${act || 'mm-shift'}" data-d="1" aria-label="Next">${I.right}</button></div>`;
  const nav = () => `<nav class="mm-nav">${[['tx', 'Transaction', I.navTx], ['cal', 'Calendar', I.navCal], null, ['stat', 'Statistic', I.navStat], ['wal', 'Wallet', I.navWal]].map((n) => (n
    ? `<button class="${UI.mm.tab === n[0] ? 'on' : ''}" data-act="mm-tab" data-t="${n[0]}">${n[2]}<span>${n[1]}</span></button>`
    : '<button class="mm-plus" data-act="mm-add" aria-label="Add record"><i>' + I.plus + '</i></button>')).join('')}</nav>`;
  const empty = (big) => `<div class="mm-empty${big ? ' big' : ''}"><div class="mm-doc"><i></i><i></i><i></i><i></i></div><b>No Record</b><small>Tap the + button to add your first record.</small></div>`;
  function overview(t, extra) {
    return `<section class="mm-card"><h3>Overview <button class="mm-i" data-act="mm-ovinfo" aria-label="About">${I.info}</button></h3>
      <div class="mm-kv"><span>Income</span><b class="inc">${money(t.inc)}</b></div>
      <div class="mm-kv"><span>Expense</span><b class="exp">${money(-t.exp)}</b></div>
      <div class="mm-kv"><span>Total</span><b>${money(t.net)}</b></div>${extra || ''}</section>`;
  }
  function txRow(x) {
    const c = x.type === 'tr' ? TRANSFER : catOf(x.cat), w = wal(x.w), to = x.type === 'tr' ? wal(x.to) : null;
    const sub = x.type === 'tr' ? (w ? w.name : '?') + ' → ' + (to ? to.name : '?') : w ? w.name : '';
    const title = x.desc || (x.type === 'tr' ? 'Transfer' : c.name);
    const amt = x.type === 'in' ? `<b class="inc">${money(x.a)}</b>` : x.type === 'out' ? `<b class="exp">${money(-x.a)}</b>` : `<b>${money(x.a)}</b>`;
    return `<button class="mm-row" data-act="mm-edit" data-id="${x.id}">${ico(c)}<span class="grow"><b>${esc(title)}</b><small>${esc(sub)}${x.rec ? ' · ↻' : ''}${x.memo ? ' · ' + esc(x.memo.slice(0, 40)) : ''}</small></span><span class="r">${amt}<small>${esc(x.tm || '')}</small></span></button>`;
  }
  function dayGroups(list) {
    const by = new Map();
    for (const x of list.slice().sort(byTime)) { if (!by.has(x.d)) by.set(x.d, []); by.get(x.d).push(x); }
    return [...by].map(([d, xs]) => {
      const dt = parseYmd(d);
      return `<section class="mm-card mm-dgrp"><div class="mm-dh"><b>${dt.getDate()}</b><span class="mm-dw"><small>${DAYS[dt.getDay()]}</small><small>${MON3[dt.getMonth()]} ${dt.getFullYear()}</small></span><span class="grow"></span><span class="mm-dn">${money(totals(xs).net)}</span></div>${xs.map(txRow).join('')}</section>`;
    }).join('');
  }
  const amtBtn = (k, v, ph) => `<button type="button" class="mm-f mm-sel" data-act="mm-calc" data-k="${k}"><span${v ? '' : ' class="ph"'}>${v ? money(v) : ph || money(0)}</span>${I.caret}</button>`;
  const field = (label, html) => `<div class="mm-fl"><label>${label}</label>${html}</div>`;
  const sw = (on, act, extra) => `<button type="button" class="mm-sw${on ? ' on' : ''}" data-act="${act}"${extra || ''}></button>`;

  /* ---------- tabs ---------- */
  function vTx() {
    const r = range(), list = inRange(accTx(), r);
    return top('tx') + pnav(r.label) + `<div class="mm-body">${list.length ? overview(totals(list)) + dayGroups(list) : empty(true)}</div>`;
  }
  function vCal() {
    const mk = UI.mm.calMonth, [y, mo] = mk.split('-').map(Number), first = new Date(y, mo - 1, 1), wk = M().opt.week;
    const all = accTx(), month = all.filter((x) => x.d.slice(0, 7) === mk), t = totals(month), today = todayStr();
    const per = new Map();
    for (const x of all) { const k = per.get(x.d) || []; k.push(x); per.set(x.d, k); }
    const start = addDays(first, -((first.getDay() - wk + 7) % 7));
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i), ds = ymd(d), out = d.getMonth() !== first.getMonth();
      if (i >= 35 && out) break;
      const xs = per.get(ds) || [], tt = totals(xs), lab = d.getDate() === 1 ? (d.getMonth() + 1) + '/1' : d.getDate();
      cells += `<button class="mm-cc${out ? ' out' : ''}${ds === today ? ' today' : ''}${d.getDay() === 0 ? ' sun' : ''}" data-act="mm-cday" data-d="${ds}"><i>${lab}</i>${xs.length && !hidden()
        ? `${tt.inc ? `<em class="inc">${num(tt.inc)}</em>` : ''}${tt.exp ? `<em class="exp">- ${num(tt.exp)}</em>` : ''}<em>${tt.net < 0 ? '-' : ''}${num(tt.net)}</em>` : ''}</button>`;
    }
    const dows = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + wk) % 7).map((i) => `<span class="${i === 0 ? 'sun' : ''}">${DAY3[i]}</span>`).join('');
    return top('cal') + pnav(MON3[mo - 1] + ' ' + y, 'mm-calShift') + `<div class="mm-csum"><div><small>Income</small><b class="inc">${money(t.inc)}</b></div><div><small>Expense</small><b class="exp">${money(-t.exp)}</b></div><div><small>Total</small><b>${money(t.net)}</b></div></div>
      <div class="mm-cal"><div class="mm-dows">${dows}</div><div class="mm-cgrid">${cells}</div></div>`;
  }
  function structure(list, type, title) {
    const by = new Map();
    for (const x of list) if (x.type === type) by.set(x.cat, (by.get(x.cat) || 0) + x.a);
    const rows = [...by].sort((p, q) => q[1] - p[1]), total = sum(rows.map((r) => r[1]));
    const parts = (rows.length > 5 ? rows.slice(0, 4) : rows).map(([k, v]) => ({ name: catOf(k).name, v }));
    if (rows.length > 5) parts.push({ name: 'Others', v: sum(rows.slice(4).map((r) => r[1])) });
    const R = 40, Cc = 2 * Math.PI * R;
    let off = 0;
    const segs = total ? parts.map((p, i) => { const len = (p.v / total) * Cc, s = `<circle r="${R}" cx="60" cy="60" stroke="${DONUT[i]}" stroke-dasharray="${len.toFixed(2)} ${(Cc - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return s; }).join('') : '';
    const legend = [0, 1, 2, 3, 4].map((i) => { const p = parts[i]; return `<div class="mm-lg"><i style="background:${DONUT[i]}"></i><span class="grow">${p ? esc(p.name) : '–'}</span><span>(${p && total ? ((p.v / total) * 100).toFixed(1) : '0.0'}%)</span></div>`; }).join('');
    return `<section class="mm-card"><h3>${title}</h3><div class="mm-struct"><div class="mm-donut"><svg viewBox="0 0 120 120"><circle r="${R}" cx="60" cy="60" class="trk"/>${segs}</svg><div class="mm-dc"><small>${type === 'out' ? 'Expense' : 'Income'}</small><b>${money(total)}</b></div></div><div class="mm-legend">${legend}</div></div>
      <button class="mm-more" data-act="mm-cats" data-t="${type}">Show more${I.right}</button></section>`;
  }
  function vStat() {
    const r = range(), list = inRange(accTx(), r), t = totals(list);
    const until = r.to ? ymd(addDays(parseYmd(r.to), 1)) : null;
    return top('stat') + pnav(r.label) + `<div class="mm-body">
      <section class="mm-card"><h3>Balance</h3><div class="mm-two"><div><small>Opening balance</small><b>${money(r.from ? accBal(null, r.from) : sum(wallets().filter((w) => !w.excl).map((w) => w.start || 0)))}</b></div><div><small>Ending balance</small><b>${money(accBal(null, until))}</b></div></div></section>
      ${overview(t, `<button class="mm-more" data-act="mm-cats" data-t="out">Show more${I.right}</button>`)}
      ${structure(list, 'out', 'Expense Structure')}
      ${structure(list, 'in', 'Income Structure')}</div>`;
  }
  function budgetSpent(b) {
    const mk = todayStr().slice(0, 7);
    return sum(accTx(b.acc).filter((x) => x.type === 'out' && x.d.slice(0, 7) === mk && (!b.cat || b.cat === 'all' || x.cat === b.cat)).map((x) => x.a));
  }
  const prog = (v, max, over) => `<span class="mm-prog${over ? ' over' : ''}"><i style="width:${max ? Math.min(100, (v / max) * 100).toFixed(1) : 0}%"></i></span>`;
  const bRow = (b) => { const s = budgetSpent(b), c = b.cat && b.cat !== 'all' ? catOf(b.cat) : TRANSFER; return `<button class="mm-li" data-act="mm-open-b" data-id="${b.id}">${b.cat && b.cat !== 'all' ? ico(c) : ico({ color: '#5f6670', icon: 'grid' })}<span class="grow"><b>${esc(b.name)}</b>${prog(s, b.amount, s > b.amount)}<small>${money(s)} of ${money(b.amount)} · ${s > b.amount ? 'Over ' + money(s - b.amount) : 'Left ' + money(b.amount - s)}</small></span></button>`; };
  const gRow = (o) => `<button class="mm-li" data-act="mm-open-g" data-id="${o.id}">${ico({ color: o.color || '#16a34a', icon: 'star' })}<span class="grow"><b>${esc(o.name)}</b>${prog(o.saved || 0, o.target)}<small>${money(o.saved || 0)} of ${money(o.target)}${o.due ? ' · by ' + mdy(o.due) : ''}</small></span></button>`;
  const dRow = (o) => { const left = Math.max(0, o.amount - (o.paid || 0)); return `<button class="mm-li" data-act="mm-open-d" data-id="${o.id}">${ico({ color: o.kind === 'lend' ? '#16a34a' : '#e02424', icon: 'transfer' })}<span class="grow"><b>${esc(o.person || 'Debt')}</b>${prog(o.paid || 0, o.amount)}<small>${o.kind === 'lend' ? 'Owes me' : 'I owe'} · ${left ? 'Left ' + money(left) : 'Settled'}${o.due ? ' · due ' + mdy(o.due) : ''}</small></span></button>`; };
  const rRow = (r) => { const c = r.tpl.type === 'tr' ? TRANSFER : catOf(r.tpl.cat); return `<button class="mm-li" data-act="mm-open-r" data-id="${r.id}">${ico(c)}<span class="grow"><b>${esc(r.tpl.desc || c.name)}</b><small>${EVERY[r.every]} · next ${r.end && r.next > r.end ? 'ended' : mdy(r.next)}</small></span><b class="${r.tpl.type === 'in' ? 'inc' : r.tpl.type === 'out' ? 'exp' : ''}">${money(r.tpl.type === 'out' ? -r.tpl.a : r.tpl.a)}</b></button>`; };
  const addBtn = (label, act) => `<div class="mm-addwrap"><button class="mm-addbtn" data-act="${act}">${I.plus}${label}</button></div>`;
  function vWal() {
    const m = M(), ws = wallets(), a = m.acc;
    const cards = ws.map((w) => `<button class="mm-wc" style="--wc:${w.color}" data-act="mm-wallet" data-id="${w.id}">${w.excl ? `<i class="mm-ex">${I.minus}</i>` : ''}<span class="mm-wi">${g(G[w.icon] || G.cash)}</span><small>${esc(w.name)}</small><b>${money(walBal(w))}</b></button>`).join('');
    const sec = (title, manage, items, add) => `<section class="mm-card mm-ws"><div class="mm-wsh"><b>${title}</b><button class="mm-link" data-act="mm-manage" data-k="${manage}">${manage === 'w' ? 'Manage(' + ws.length + ')' : 'Manage'}</button></div>${items}${add}</section>`;
    const list = (arr, fn) => arr.filter((o) => o.acc === a).map(fn).join('');
    const bs = m.budgets.filter((o) => o.acc === a), gs = m.goals.filter((o) => o.acc === a), ds = m.debts.filter((o) => o.acc === a), rs = m.recs.filter((o) => o.acc === a);
    const sf = window.Planner ? Planner.safe() : null;
    return top('wal') + `<div class="mm-bal"><small>Account balance</small><div><b>${money(accBal())}</b><button class="mm-eye" data-act="mm-hide" aria-label="Hide amounts">${hidden() ? I.eyeOff : I.eye}</button></div></div>
      <section class="mm-card mm-plancard"><button class="mm-li" data-act="mm-planner">${ico({ color: '#16a34a', icon: 'piggy' })}<span class="grow"><b>Planner</b><small>${sf ? 'Aman dipakai hari ini ' + money(sf.perDay) + ' · ' + (sf.bills ? 'tagihan ' + money(sf.bills) : 'tagihan lunas') : 'Budget Kebutuhan / Keinginan / Masa depan, jatuh tempo, list belanja'}</small></span>${I.right}</button></section>
      ${sec('WALLET', 'w', `<div class="mm-wgrid">${cards}<button class="mm-wc add" data-act="mm-new-w" aria-label="Add wallet">${I.plus}</button></div>`, '')}
      ${sec('BUDGET', 'b', list(bs, bRow), addBtn('Add Budget', 'mm-new-b'))}
      ${sec('GOAL', 'g', list(gs, gRow), addBtn('Add Goal', 'mm-new-g'))}
      ${sec('DEBT', 'd', list(ds, dRow), addBtn('Add Debt', 'mm-new-d'))}
      ${sec('RECURRING', 'r', list(rs, rRow), addBtn('Add Recurring', 'mm-new-r'))}`;
  }

  /* ---------- pages ---------- */
  const TITLE = { in: 'Income', out: 'Expense', tr: 'Transfer' };
  function pForm() {
    const D = UI.mm.draft, w = wal(D.w), to = wal(D.to), c = D.cat ? catOf(D.cat) : null;
    const wBtn = (k, x, ph) => `<button type="button" class="mm-f mm-sel" data-act="mm-wsel" data-k="${k}"><span${x ? '' : ' class="ph"'}>${x ? esc(x.name) + ' • ' + money(walBal(x)) : ph}</span>${I.caret}</button>`;
    const photos = (D.photos || []).map((p, i) => `<button type="button" class="mm-ph" data-act="mm-unphoto" data-i="${i}"><img src="${S.photos && S.photos[p] ? S.photos[p] : ''}" alt=""></button>`).join('');
    const right = (D.id ? `<button class="mm-ib" data-act="mm-del" aria-label="Delete">${I.trash}</button>` : '') + '<button class="mm-save" data-act="mm-save">SAVE</button>';
    const recur = D.type === 'tr' ? '' : `<button type="button" class="mm-recur${D.every !== 'none' ? ' on' : ''}" data-act="mm-recur">${I.loop}<small>${D.every !== 'none' ? EVERY[D.every] : 'Recurring'}</small></button>`;
    return bar(TITLE[D.type], right) + `<div class="mm-types">${['in', 'out', 'tr'].map((t) => `<button class="${D.type === t ? 'on t-' + t : ''}" data-act="mm-type" data-t="${t}">${TITLE[t]}</button>`).join('')}</div>
      <div class="mm-form">
        ${field('Date', `<div class="mm-f mm-dt"><input type="date" data-mm="d" value="${D.d}" required><input type="time" data-mm="tm" value="${D.tm}">${recur}</div>`)}
        ${field('Amount', amtBtn('a', D.a))}
        ${field('Description', `<input class="mm-f" data-mm="desc" placeholder="Short description" value="${esc(D.desc)}" maxlength="120">`)}
        ${D.type === 'tr' ? field('From wallet', wBtn('w', w, 'Select wallet')) + field('To wallet', wBtn('to', to, 'Select wallet'))
          + `<div class="mm-fl mm-fee"><div class="grow"><label>Fee</label><span>${D.feeOn ? `<button type="button" class="mm-link" data-act="mm-calc" data-k="fee">${money(D.fee || 0)}</button>` : money(0)}</span></div>${sw(D.feeOn, 'mm-fee')}</div>`
          : field('Category', `<button type="button" class="mm-f mm-sel" data-act="mm-csel">${c ? `<span class="mm-cs">${ico(c, 'sm')}${esc(c.name)}</span>` : '<span class="ph">Select Category</span>'}${I.caret}</button>`) + field('Wallet', wBtn('w', w, 'Select wallet'))}
        <div class="mm-gap"></div>
        ${field('Memo', `<div class="mm-f mm-memo"><textarea data-mm="memo" rows="1" placeholder="Add a note..." data-mmpaste="1">${esc(D.memo)}</textarea><button type="button" class="mm-ib" data-act="mm-photo" aria-label="Add photo">${I.img}</button></div>${photos ? `<div class="mm-phs">${photos}</div>` : ''}`)}
      </div>
      <button class="mm-fab" data-act="mm-calc" data-k="a" aria-label="Calculator">${I.calc}</button>`;
  }
  function pCat() {
    const D = UI.mm.draft, t = UI.mm.catTab || (D.type === 'in' ? 'in' : 'out'), q = (UI.mm.catQ || '').toLowerCase();
    const list = catList(t).filter((c) => !q || c.name.toLowerCase().includes(q));
    return bar('Select Category', `<button class="mm-ib" data-act="mm-catsearch" aria-label="Search">${I.search}</button><button class="mm-ib" data-act="mm-catman" aria-label="Categories">${I.gear}</button>`)
      + `<div class="mm-tabs2"><button class="${t === 'in' ? 'on' : ''}" data-act="mm-cattab" data-t="in">INCOME</button><button class="${t === 'out' ? 'on' : ''}" data-act="mm-cattab" data-t="out">EXPENSE</button></div>`
      + (UI.mm.catQ != null ? `<div class="mm-sbox"><input class="mm-f" data-mmq="cat" placeholder="Search category" value="${esc(UI.mm.catQ)}"></div>` : '')
      + `<div class="mm-list">${list.map((c) => `<button class="mm-pick" data-act="mm-pickcat" data-k="${c.key}">${ico(c)}<span class="grow">${esc(c.name)}</span>${radio(D.cat === c.key)}</button>`).join('') || '<p class="mm-none">No category</p>'}</div>`;
  }
  function pWsel() {
    const D = UI.mm.draft, k = UI.mm.wk, cur = D[k], ws = wallets().filter((w) => !(k === 'to' && w.id === D.w) && !(k === 'w' && D.type === 'tr' && w.id === D.to));
    const rows = (list) => list.map((w) => `<button class="mm-pick" data-act="mm-pickw" data-id="${w.id}">${wIco(w)}<span class="grow">${esc(w.name)}<small>${money(walBal(w))}</small></span>${radio(cur === w.id)}</button>`).join('');
    const inc = ws.filter((w) => !w.excl), exc = ws.filter((w) => w.excl);
    return bar('Select wallet', `<button class="mm-ib" data-act="mm-manage" data-k="w" aria-label="Manage wallets">${I.gear}</button>`)
      + `<div class="mm-list">${inc.length ? '<p class="mm-sub">Included in total</p>' + rows(inc) : ''}${exc.length ? '<p class="mm-sub">Excluded from total</p>' + rows(exc) : ''}${ws.length ? '' : '<p class="mm-none">No wallet yet</p>'}
      <button class="mm-pick" data-act="mm-new-w">${ico({ color: '#3a3b3f', icon: 'grid' })}<span class="grow">Add wallet</span></button></div>`;
  }
  function calcEval(s) {
    const toks = String(s).match(/\d+(?:\.\d+)?|[-+*/]/g) || [], vals = [], ops = [], pr = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const ap = () => { const b = vals.pop(), a = vals.pop(), o = ops.pop(); vals.push(o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : b ? a / b : 0); };
    let wantNum = true;
    for (const t of toks) {
      if (/\d/.test(t)) { vals.push(parseFloat(t)); wantNum = false; continue; }
      if (wantNum) continue;
      while (ops.length && pr[ops[ops.length - 1]] >= pr[t]) ap();
      ops.push(t); wantNum = true;
    }
    if (wantNum && ops.length) ops.pop();
    while (ops.length && vals.length > 1) ap();
    return vals.length ? vals[0] : 0;
  }
  const showExpr = (e) => e.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\d+(?:\.\d*)?/g, (n) => { const [i, f] = n.split('.'); return Number(i).toLocaleString('en-US') + (f != null ? '.' + f : ''); });
  function pCalc() {
    const e = UI.mm.calc.expr, v = calcEval(e);
    const K = [['C', 'clr'], ['÷', '/'], ['×', '*'], ['⌫', 'bs'], ['7'], ['8'], ['9'], ['−', '-'], ['4'], ['5'], ['6'], ['+', '+'], ['1'], ['2'], ['3'], ['=', 'eq'], ['.'], ['0'], ['000'], ['OK', 'ok']];
    return bar('Enter Amount') + `<div class="mm-calc"><div class="mm-cd"><small>${showExpr(e) || '&nbsp;'}</small><b>${money(Math.max(0, v))}</b></div>
      <div class="mm-keys">${K.map(([l, k]) => `<button class="${/^[\d.]+$/.test(l) ? '' : 'op'}${k === 'ok' ? ' ok' : ''}${k === 'clr' ? ' clr' : ''}" data-act="mm-key" data-k="${esc(k || l)}">${l}</button>`).join('')}</div></div>`;
  }
  function searchBody() {
    const q = UI.mm.q.trim().toLowerCase();
    const list = q ? accTx().filter((x) => [x.desc, x.memo, x.type === 'tr' ? 'transfer' : catOf(x.cat).name, String(x.a), (wal(x.w) || {}).name].some((s) => String(s || '').toLowerCase().includes(q))) : [];
    return q ? (list.length ? dayGroups(list) : '<p class="mm-none">Nothing found</p>') : '<p class="mm-none">Search by description, memo, category, wallet or amount</p>';
  }
  const pSearch = () => `<div class="mm-bar"><button class="mm-ib" data-act="mm-back" aria-label="Back">${I.back}</button><input class="mm-qin" data-mmq="tx" placeholder="Search records" value="${esc(UI.mm.q)}"></div><div class="mm-body" id="mmRes">${searchBody()}</div>`;
  function pCats() {
    const p = page(), t = p.t, r = range(), list = inRange(accTx(), r).filter((x) => x.type === t);
    const by = new Map();
    for (const x of list) by.set(x.cat, (by.get(x.cat) || 0) + x.a);
    const total = sum([...by.values()]), rows = [...by].sort((a, b) => b[1] - a[1]);
    return bar(t === 'out' ? 'Expense Structure' : 'Income Structure') + `<div class="mm-tabs2"><button class="${t === 'in' ? 'on' : ''}" data-act="mm-catsT" data-t="in">INCOME</button><button class="${t === 'out' ? 'on' : ''}" data-act="mm-catsT" data-t="out">EXPENSE</button></div>` + pnav(r.label)
      + `<div class="mm-body"><section class="mm-card"><div class="mm-kv"><span>Total</span><b class="${t === 'in' ? 'inc' : 'exp'}">${money(t === 'out' ? -total : total)}</b></div></section>
      <section class="mm-card">${rows.map(([k, v]) => { const c = catOf(k); return `<button class="mm-li" data-act="mm-catx" data-k="${k}">${ico(c)}<span class="grow"><b>${esc(c.name)} <small class="mm-pct">${((v / total) * 100).toFixed(1)}%</small></b>${prog(v, rows[0][1])}</span><b>${money(v)}</b></button>`; }).join('') || empty()}</section></div>`;
  }
  function pCatx() {
    const p = page(), r = range(), c = catOf(p.k), list = inRange(accTx(), r).filter((x) => x.cat === p.k && x.type !== 'tr');
    return bar(esc(c.name)) + pnav(r.label) + `<div class="mm-body">${list.length ? dayGroups(list) : empty()}</div>`;
  }
  function pTrend() {
    const mk0 = UI.mm.anchor.slice(0, 7), months = [5, 4, 3, 2, 1, 0].map((k) => addMonths(mk0 + '-01', -k).slice(0, 7)), all = accTx();
    const data = months.map((mk) => ({ mk, t: totals(all.filter((x) => x.d.slice(0, 7) === mk)) }));
    const max = Math.max(1, ...data.map((d) => Math.max(d.t.inc, d.t.exp)));
    return bar('Trend') + `<div class="mm-body"><section class="mm-card"><h3>Last 6 months</h3><div class="mm-trend">${data.map((d) => `<div class="col"><div class="bars"><i class="inc" style="height:${(d.t.inc / max) * 100}%"></i><i class="exp" style="height:${(d.t.exp / max) * 100}%"></i></div><small>${MON3[+d.mk.slice(5) - 1]}</small></div>`).join('')}</div>
      <div class="mm-key"><span><i class="inc"></i>Income</span><span><i class="exp"></i>Expense</span></div></section>
      <section class="mm-card">${data.slice().reverse().map((d) => `<div class="mm-kv"><span>${MON3[+d.mk.slice(5) - 1]} ${d.mk.slice(0, 4)}</span><b class="${d.t.net < 0 ? 'exp' : 'inc'}">${money(d.t.net)}</b></div>`).join('')}</section></div>`;
  }
  function pWallet() {
    const w = wal(page().id);
    if (!w) return bar('Wallet') + empty();
    const list = M().tx.filter((x) => x.w === w.id || x.to === w.id);
    return bar(esc(w.name), `<button class="mm-ib" data-act="mm-edit-w" data-id="${w.id}" aria-label="Edit">${I.edit}</button>`)
      + `<div class="mm-bal"><small>${w.excl ? 'Excluded from total' : 'Wallet balance'}</small><div><b>${money(walBal(w))}</b></div></div><div class="mm-body">${list.length ? dayGroups(list) : empty()}</div>`;
  }
  const colorPick = (cur) => `<div class="mm-colors">${COLORS.map((c) => `<button type="button" class="${c === cur ? 'on' : ''}" style="background:${c}" data-act="mm-dset" data-k="color" data-v="${c}" aria-label="Color"></button>`).join('')}</div>`;
  const iconPick = (cur, color, list) => `<div class="mm-icons">${(list || WICONS).map((i) => `<button type="button" class="${i === cur ? 'on' : ''}" data-act="mm-dset" data-k="icon" data-v="${i}" style="--c:${color}">${g(G[i])}</button>`).join('')}</div>`;
  const delBtn = (act) => `<button class="mm-danger" data-act="${act}">${I.trash}Delete</button>`;
  function pWedit() {
    const D = UI.mm.draft;
    return bar(D.id ? 'Edit wallet' : 'Add wallet', '<button class="mm-save" data-act="mm-save-w">SAVE</button>') + `<div class="mm-form">
      <div class="mm-wprev" style="--wc:${D.color}"><span class="mm-wi">${g(G[D.icon] || G.cash)}</span><small>${esc(D.name || 'Wallet')}</small><b>${money(D.start || 0)}</b></div>
      ${field('Name', `<input class="mm-f" data-mm="name" value="${esc(D.name)}" placeholder="e.g. Cash, BCA, Jajan" maxlength="40">`)}
      ${field(D.id ? 'Initial balance' : 'Balance', amtBtn('start', D.start))}
      ${field('Color', colorPick(D.color))}${field('Icon', iconPick(D.icon, D.color))}
      <div class="mm-fl mm-fee"><div class="grow"><label>Included in total</label><span>${D.excl ? 'Not counted in the account balance' : 'Counted in the account balance'}</span></div>${sw(!D.excl, 'mm-dflip', ' data-k="excl"')}</div>
      ${D.id ? delBtn('mm-del-w') : ''}</div>`;
  }
  function pBedit() {
    const D = UI.mm.draft, c = D.cat && D.cat !== 'all' ? catOf(D.cat) : null;
    return bar(D.id ? 'Edit budget' : 'Add Budget', '<button class="mm-save" data-act="mm-save-b">SAVE</button>') + `<div class="mm-form">
      ${field('Name', `<input class="mm-f" data-mm="name" value="${esc(D.name)}" placeholder="e.g. Jajan, Bensin" maxlength="40">`)}
      ${field('Monthly limit', amtBtn('amount', D.amount))}
      ${field('Category', `<button type="button" class="mm-f mm-sel" data-act="mm-bcat">${c ? `<span class="mm-cs">${ico(c, 'sm')}${esc(c.name)}</span>` : '<span>All expenses</span>'}${I.caret}</button>`)}
      ${D.id ? `<p class="mm-note">Spent this month: ${money(budgetSpent(D))}</p>` + delBtn('mm-del-b') : ''}</div>`;
  }
  function pGedit() {
    const D = UI.mm.draft;
    return bar(D.id ? 'Edit goal' : 'Add Goal', '<button class="mm-save" data-act="mm-save-g">SAVE</button>') + `<div class="mm-form">
      ${field('Name', `<input class="mm-f" data-mm="name" value="${esc(D.name)}" placeholder="e.g. HP X300 Pro, Umroh" maxlength="60">`)}
      ${field('Target amount', amtBtn('target', D.target))}
      ${field('Saved so far', amtBtn('saved', D.saved))}
      ${field('Target date (optional)', `<input class="mm-f" type="date" data-mm="due" value="${esc(D.due || '')}">`)}
      ${field('Color', colorPick(D.color))}
      ${D.target ? `<p class="mm-note">${prog(D.saved || 0, D.target)}${Math.round(((D.saved || 0) / D.target) * 100)}% · ${money(Math.max(0, D.target - (D.saved || 0)))} to go</p>` : ''}
      ${D.id ? delBtn('mm-del-g') : ''}</div>`;
  }
  function pDedit() {
    const D = UI.mm.draft;
    return bar(D.id ? 'Edit debt' : 'Add Debt', '<button class="mm-save" data-act="mm-save-d">SAVE</button>') + `<div class="mm-types">${[['borrow', 'I owe'], ['lend', 'Owes me']].map(([k, l]) => `<button class="${D.kind === k ? 'on t-' + (k === 'lend' ? 'in' : 'out') : ''}" data-act="mm-dset" data-k="kind" data-v="${k}">${l}</button>`).join('')}</div><div class="mm-form">
      ${field('Person', `<input class="mm-f" data-mm="person" value="${esc(D.person)}" placeholder="Name" maxlength="40">`)}
      ${field('Amount', amtBtn('amount', D.amount))}
      ${field('Paid back', amtBtn('paid', D.paid))}
      ${field('Due date (optional)', `<input class="mm-f" type="date" data-mm="due" value="${esc(D.due || '')}">`)}
      ${field('Note', `<input class="mm-f" data-mm="note" value="${esc(D.note || '')}" placeholder="Add a note..." maxlength="120">`)}
      ${D.id ? delBtn('mm-del-d') : ''}</div>`;
  }
  function pRedit() {
    const D = UI.mm.draft, c = D.tpl.type === 'tr' ? TRANSFER : catOf(D.tpl.cat), w = wal(D.tpl.w);
    return bar('Recurring', '<button class="mm-save" data-act="mm-save-r">SAVE</button>') + `<div class="mm-form">
      <section class="mm-card"><div class="mm-row static">${ico(c)}<span class="grow"><b>${esc(D.tpl.desc || c.name)}</b><small>${esc(TITLE[D.tpl.type])} · ${esc(w ? w.name : '')}</small></span><span class="r"><b class="${D.tpl.type === 'in' ? 'inc' : 'exp'}">${money(D.tpl.type === 'out' ? -D.tpl.a : D.tpl.a)}</b></span></div></section>
      ${field('Amount', amtBtn('a', D.tpl.a))}
      ${field('Repeat', `<div class="mm-chips">${['daily', 'weekly', 'monthly', 'yearly'].map((k) => `<button type="button" class="${D.every === k ? 'on' : ''}" data-act="mm-dset" data-k="every" data-v="${k}">${EVERY[k]}</button>`).join('')}</div>`)}
      ${field('Next', `<input class="mm-f" type="date" data-mm="next" value="${esc(D.next)}">`)}
      ${field('End date (optional)', `<input class="mm-f" type="date" data-mm="end" value="${esc(D.end || '')}">`)}
      <p class="mm-note">A record is added by itself on each date. Past records stay when you stop it.</p>
      ${delBtn('mm-del-r')}</div>`;
  }
  function pManage() {
    const k = page().k, m = M(), a = m.acc;
    const conf = { w: ['Wallets', 'mm-new-w', 'Add wallet'], b: ['Budgets', 'mm-new-b', 'Add Budget'], g: ['Goals', 'mm-new-g', 'Add Goal'], d: ['Debts', 'mm-new-d', 'Add Debt'], r: ['Recurring', 'mm-new-r', 'Add Recurring'] }[k];
    let rows = '';
    if (k === 'w') rows = wallets().map((w) => `<button class="mm-li" data-act="mm-edit-w" data-id="${w.id}">${wIco(w)}<span class="grow"><b>${esc(w.name)}</b><small>${w.excl ? 'Excluded from total' : 'Included in total'}</small></span><b>${money(walBal(w))}</b></button>`).join('');
    if (k === 'b') rows = m.budgets.filter((o) => o.acc === a).map(bRow).join('');
    if (k === 'g') rows = m.goals.filter((o) => o.acc === a).map(gRow).join('');
    if (k === 'd') rows = m.debts.filter((o) => o.acc === a).map(dRow).join('');
    if (k === 'r') rows = m.recs.filter((o) => o.acc === a).map(rRow).join('');
    return bar(conf[0]) + `<div class="mm-body"><section class="mm-card">${rows || '<p class="mm-none">Nothing here yet</p>'}</section>${addBtn(conf[2], conf[1])}</div>`;
  }
  function pAccNew() {
    const D = UI.mm.draft;
    if (D.step === 2) return bar('', '', 'mm-back') + `<div class="mm-hello"><h2>First wallet</h2><p>Where is this money kept?</p>
      <input class="mm-f" data-mm="wname" value="${esc(D.wname)}" placeholder="Wallet name">${amtBtn('start', D.start, 'Starting balance')}
      <button class="mm-next" data-act="mm-acc-done">DONE</button></div>`;
    return bar('', '', 'mm-back') + `<div class="mm-hello"><h2>Add Account</h2><p>Choose a name for your account.</p>
      <input class="mm-f" data-mm="name" value="${esc(D.name)}" placeholder="Name" maxlength="40" autofocus>
      <button class="mm-next${D.name && D.name.trim() ? '' : ' dim'}" data-act="mm-acc-next">NEXT</button></div>`;
  }
  function pSettings() {
    const o = M().opt;
    const row = (title, sub, ctrl) => `<div class="mm-srow"><span class="grow"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${ctrl}</div>`;
    const seg = (k, list) => `<div class="mm-chips">${list.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? 'on' : ''}" data-act="mm-opt" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
    return bar('Settings') + `<div class="mm-body"><section class="mm-card">
      ${row('Look', 'Dark like the Money Manager app, or follow A1O', seg('theme', [['dark', 'Dark'], ['app', 'Follow A1O']]))}
      ${row('First day of week', '', seg('week', [[0, 'Sunday'], [1, 'Monday']]))}
      ${row('Currency symbol', '', `<input class="mm-f mm-short" data-mmopt="cur" value="${esc(o.cur)}" maxlength="4">`)}
      ${row('Hide amounts', 'Show •••••• instead of numbers', sw(o.hide, 'mm-hide'))}
      ${row('Daily reminder', 'A notification to record today\'s spending', sw(o.remind, 'mm-optflip', ' data-k="remind"'))}
      ${o.remind ? row('Reminder time', '', `<input type="time" class="mm-f mm-short" data-mmopt="remindAt" value="${esc(o.remindAt)}">`) : ''}
      </section><section class="mm-card">
      <button class="mm-li" data-act="mm-catman">${ico({ color: '#8155f5', icon: 'grid' })}<span class="grow"><b>Categories</b><small>Add your own, hide the ones you never use</small></span>${I.right}</button>
      <button class="mm-li" data-act="mm-accman">${ico({ color: '#1a9bf0', icon: 'wallet' })}<span class="grow"><b>Accounts</b><small>${M().accounts.length} account(s) · rename or delete</small></span>${I.right}</button>
      <button class="mm-li" data-act="mm-manage" data-k="w">${ico({ color: '#16a34a', icon: 'cash' })}<span class="grow"><b>Wallets</b><small>${wallets().length} in ${esc(acc().name)}</small></span>${I.right}</button>
      </section><section class="mm-card"><button class="mm-li" data-act="mm-erase">${ico({ color: '#e02424', icon: 'grid' })}<span class="grow"><b>Erase all money data</b><small>Goes to Baru dihapus for 30 days</small></span></button></section></div>`;
  }
  function pCatman() {
    const t = UI.mm.cmTab || 'out', c = M().cats, D = UI.mm.cmNew;
    const rows = BASE[t].map((k) => { const key = t + ':' + k.id, on = !c.hide.includes(key); return `<div class="mm-pick">${ico(k)}<span class="grow">${esc(k.name)}</span>${k.id === 'others' ? '' : sw(on, 'mm-cathide', ` data-k="${key}"`)}</div>`; }).join('')
      + (c[t] || []).map((k) => `<div class="mm-pick">${ico(k)}<span class="grow">${esc(k.name)}<small>Your category</small></span><button class="mm-ib" data-act="mm-catdel" data-k="${t + ':' + k.id}" aria-label="Delete">${I.trash}</button></div>`).join('');
    const form = D ? `<section class="mm-card mm-form"><h3>New ${t === 'in' ? 'income' : 'expense'} category</h3>${field('Name', `<input class="mm-f" data-mmcm="name" value="${esc(D.name)}" maxlength="30" placeholder="e.g. Sedekah">`)}${field('Color', `<div class="mm-colors">${COLORS.map((x) => `<button type="button" class="${x === D.color ? 'on' : ''}" style="background:${x}" data-act="mm-cmset" data-k="color" data-v="${x}"></button>`).join('')}</div>`)}${field('Icon', `<div class="mm-icons">${Object.keys(G).filter((i) => i !== 'transfer').map((i) => `<button type="button" class="${i === D.icon ? 'on' : ''}" data-act="mm-cmset" data-k="icon" data-v="${i}" style="--c:${D.color}">${g(G[i])}</button>`).join('')}</div>`)}<button class="mm-next" data-act="mm-catadd">ADD</button></section>` : addBtn('New category', 'mm-catnew');
    return bar('Categories') + `<div class="mm-tabs2"><button class="${t === 'in' ? 'on' : ''}" data-act="mm-cmtab" data-t="in">INCOME</button><button class="${t === 'out' ? 'on' : ''}" data-act="mm-cmtab" data-t="out">EXPENSE</button></div><div class="mm-body">${form}<section class="mm-card mm-list">${rows}</section></div>`;
  }
  function pAccman() {
    const m = M();
    return bar('Accounts') + `<div class="mm-body"><section class="mm-card">${m.accounts.map((a) => `<div class="mm-pick"><input class="mm-f" data-mmacc="${a.id}" value="${esc(a.name)}" maxlength="40"><span class="mm-amt">${money(accBal(a.id))}</span>${m.accounts.length > 1 ? `<button class="mm-ib" data-act="mm-accdel" data-id="${a.id}" aria-label="Delete">${I.trash}</button>` : ''}</div>`).join('')}</section>${addBtn('Add Account', 'mm-accnew')}</div>`;
  }
  function pPlanner() {
    return bar('Planner', `<button class="mm-ib" data-act="m-settings" aria-label="Pengaturan planner">${I.gear}</button>`) + `<div class="mm-plan">${window.Planner ? Planner.view() : ''}</div>`;
  }
  const PAGES = { planner: pPlanner, form: pForm, cat: pCat, wsel: pWsel, calc: pCalc, search: pSearch, cats: pCats, catx: pCatx, trend: pTrend, wallet: pWallet, wedit: pWedit, bedit: pBedit, gedit: pGedit, dedit: pDedit, redit: pRedit, manage: pManage, accnew: pAccNew, settings: pSettings, catman: pCatman, accman: pAccman };

  VIEWS.money = () => {
    runRecs();
    const p = page();
    if (p) return `<div class="mm mm-page">${PAGES[p.p]()}</div>`;
    const body = { tx: vTx, cal: vCal, stat: vStat, wal: vWal }[UI.mm.tab]();
    return `<div class="mm">${body}${nav()}</div>`;
  };

  /* ---------- sheets ---------- */
  function mSheet(html) { openSheet(html); $('#sheet').classList.add('mmsheet'); }
  const PERIODS = [['daily', 'Daily', I.p1], ['weekly', 'Weekly', I.p7], ['monthly', 'Monthly', I.p31], ['quarterly', 'Quarterly', I.p90], ['yearly', 'Yearly', I.p12], ['all', 'All', I.pAll], ['custom', 'Custom', g('<path d="M4 20h4L19 9l-4-4L4 16z"/>')]];
  ACT['mm-period'] = () => mSheet(`<div class="mm-sh">${PERIODS.map(([k, l, ic]) => `<button class="mm-pick" data-act="mm-setp" data-p="${k}"><span class="mm-pico">${ic}</span><span class="grow">${l}</span>${radio(UI.mm.period === k)}</button>`).join('')}</div>`);
  ACT['mm-setp'] = (b) => {
    const p = b.dataset.p;
    if (p === 'custom') {
      const r = range(), f = UI.mm.from || r.from || todayStr(), t = UI.mm.to || r.to || todayStr();
      return mSheet(`<div class="mm-sh"><h2>Custom</h2>${field('From', `<input class="mm-f" type="date" id="mmFrom" value="${f}">`)}${field('To', `<input class="mm-f" type="date" id="mmTo" value="${t}">`)}<button class="mm-next" data-act="mm-custom">APPLY</button></div>`);
    }
    UI.mm.period = p; closeSheet(); render();
  };
  ACT['mm-custom'] = () => {
    let f = $('#mmFrom').value, t = $('#mmTo').value;
    if (!f || !t) return toast('Pick both dates');
    if (f > t) [f, t] = [t, f];
    UI.mm.period = 'custom'; UI.mm.from = f; UI.mm.to = t; closeSheet(); render();
  };
  ACT['mm-accounts'] = () => {
    const m = M();
    mSheet(`<div class="mm-sh"><h2 class="c">Select account</h2>${m.accounts.map((a) => `<button class="mm-pick" data-act="mm-setacc" data-id="${a.id}"><span class="grow"><b>${esc(a.name)}</b><small>${money(accBal(a.id))}</small></span>${radio(a.id === m.acc)}</button>`).join('')}
      <button class="mm-pick" data-act="mm-accnew"><span class="mm-pico">${I.plus}</span><span class="grow"><b>Add Account</b></span></button></div>`);
  };
  ACT['mm-setacc'] = (b) => { M().acc = b.dataset.id; closeSheet(); commit(); };
  ACT['mm-accnew'] = () => { closeSheet(); UI.mm.draft = { name: '', step: 1, wname: 'Kas', start: 0 }; push({ p: 'accnew' }); };
  ACT['mm-acc-next'] = () => { const D = UI.mm.draft; if (!D.name.trim()) return toast('Type a name first'); D.step = 2; render(); };
  ACT['mm-acc-done'] = () => {
    const D = UI.mm.draft, m = M(), a = { id: uid(), name: D.name.trim() };
    m.accounts.push(a);
    m.wallets.push({ id: uid(), acc: a.id, name: (D.wname || 'Kas').trim() || 'Kas', color: '#1a9bf0', icon: 'cash', start: D.start || 0, excl: false });
    m.acc = a.id; UI.mm.stack = []; UI.mm.tab = 'tx'; commit(); toast('Account added');
  };
  function dayPanel(ds) {
    const xs = accTx().filter((x) => x.d === ds).sort(byTime), d = parseYmd(ds);
    mSheet(`<div class="mm-sh mm-dayp"><div class="mm-dph"><b>${DAY3[d.getDay()]}, ${mdy(ds)}</b><span>${money(totals(xs).net)}</span></div>
      <div class="mm-dpl">${xs.length ? xs.map(txRow).join('') : '<p class="mm-none">No transaction yet</p>'}</div>
      <div class="mm-dpf"><button class="mm-ib" data-act="mm-cday" data-d="${ymd(addDays(d, -1))}" aria-label="Previous day">${I.left}</button><button class="mm-addday" data-act="mm-add" data-d="${ds}">Add</button><button class="mm-ib" data-act="mm-cday" data-d="${ymd(addDays(d, 1))}" aria-label="Next day">${I.right}</button></div></div>`);
  }
  ACT['mm-cday'] = (b) => dayPanel(b.dataset.d);
  ACT['mm-recur'] = () => {
    const D = UI.mm.draft;
    mSheet(`<div class="mm-sh"><h2>Recurring</h2>${Object.keys(EVERY).map((k) => `<button class="mm-pick" data-act="mm-setrec" data-v="${k}"><span class="mm-pico">${I.loop}</span><span class="grow">${EVERY[k]}</span>${radio(D.every === k)}</button>`).join('')}
      ${D.every !== 'none' ? field('End date (optional)', `<input class="mm-f" type="date" data-mm="end" value="${esc(D.end || '')}">`) : ''}<p class="mm-note">The record is added again by itself on each date.</p></div>`);
  };
  ACT['mm-setrec'] = (b) => { UI.mm.draft.every = b.dataset.v; closeSheet(); render(); };
  ACT['mm-ovinfo'] = () => mSheet(`<div class="mm-sh"><h2>Overview</h2><p class="mm-note">Income and expense of <b>${esc(acc().name)}</b> in the period shown (${esc(range().label)}). Transfers between wallets are not income or expense; their fees count as expense. The balance at the top only counts wallets that are included in total.</p></div>`);

  /* ---------- navigation ---------- */
  ACT['mm-tab'] = (b) => { UI.mm.tab = b.dataset.t; render(); window.scrollTo(0, 0); };
  ACT['mm-back'] = () => pop();
  ACT['mm-exit'] = () => { UI.mm.stack = []; UI.tab = 'today'; render(); window.scrollTo(0, 0); };
  ACT['mm-shift'] = (b) => { shift(+b.dataset.d); render(); };
  ACT['mm-calShift'] = (b) => { UI.mm.calMonth = addMonths(UI.mm.calMonth + '-01', +b.dataset.d).slice(0, 7); render(); };
  ACT['mm-calToday'] = () => { UI.mm.calMonth = todayStr().slice(0, 7); render(); };
  ACT['mm-search'] = () => { UI.mm.q = ''; push({ p: 'search' }); const i = $('.mm-qin'); if (i) i.focus(); };
  ACT['mm-noop'] = () => {};
  ACT['mm-trend'] = () => push({ p: 'trend' });
  ACT['mm-settings'] = () => push({ p: 'settings' });
  ACT['mm-cats'] = (b) => push({ p: 'cats', t: b.dataset.t });
  ACT['mm-catsT'] = (b) => { page().t = b.dataset.t; render(); };
  ACT['mm-catx'] = (b) => push({ p: 'catx', k: b.dataset.k });
  ACT['mm-wallet'] = (b) => push({ p: 'wallet', id: b.dataset.id });
  ACT['mm-manage'] = (b) => push({ p: 'manage', k: b.dataset.k });
  ACT['mm-hide'] = () => { M().opt.hide = !M().opt.hide; commit(); };
  ACT['mm-catman'] = () => { UI.mm.cmNew = null; push({ p: 'catman' }); };
  ACT['mm-accman'] = () => push({ p: 'accman' });
  ACT['mm-planner'] = () => { if (window.Planner) Planner.reset(); push({ p: 'planner' }); };

  /* ---------- add / edit a record ---------- */
  function startDraft(pre) {
    const ws = wallets(), main = ws.find((w) => !w.excl) || ws[0];
    UI.mm.draft = Object.assign({ type: 'out', a: 0, cat: '', w: main ? main.id : '', to: '', fee: 0, feeOn: false, d: todayStr(), tm: nowHM(), desc: '', memo: '', photos: [], every: 'none', end: '' }, pre || {});
    UI.mm.catTab = null; UI.mm.catQ = null;
  }
  ACT['mm-add'] = (b) => {
    if (!wallets().length) { toast('Add a wallet first'); return ACT['mm-new-w'](); }
    closeSheet();
    startDraft(b && b.dataset.d ? { d: b.dataset.d } : null);
    push({ p: 'form' });
  };
  ACT['mm-edit'] = (b) => {
    const x = M().tx.find((t) => t.id === b.dataset.id);
    if (!x) return;
    closeSheet();
    const r = x.rec && M().recs.find((q) => q.id === x.rec);
    startDraft(Object.assign({}, x, { feeOn: !!x.fee, photos: (x.photos || []).slice(), every: r ? r.every : 'none', end: r ? r.end || '' : '', memo: x.memo || '', desc: x.desc || '', to: x.to || '' }));
    push({ p: 'form' });
  };
  ACT['mm-type'] = (b) => {
    const D = UI.mm.draft, t = b.dataset.t;
    if (D.type === t) return;
    if (t !== 'tr' && D.cat && !D.cat.startsWith(t + ':')) D.cat = '';
    if (t === 'tr') D.every = 'none';
    D.type = t; render();
  };
  ACT['mm-csel'] = () => { UI.mm.catTab = UI.mm.draft.type === 'in' ? 'in' : 'out'; UI.mm.catQ = null; push({ p: 'cat' }); };
  ACT['mm-cattab'] = (b) => { UI.mm.catTab = b.dataset.t; render(); };
  ACT['mm-catsearch'] = () => { UI.mm.catQ = UI.mm.catQ == null ? '' : null; render(); const i = $('[data-mmq="cat"]'); if (i) i.focus(); };
  ACT['mm-pickcat'] = (b) => {
    const D = UI.mm.draft, k = b.dataset.k;
    D.cat = k; D.type = k.split(':')[0]; pop();
  };
  ACT['mm-wsel'] = (b) => { UI.mm.wk = b.dataset.k; push({ p: 'wsel' }); };
  ACT['mm-pickw'] = (b) => { UI.mm.draft[UI.mm.wk] = b.dataset.id; pop(); };
  ACT['mm-fee'] = () => { const D = UI.mm.draft; D.feeOn = !D.feeOn; if (!D.feeOn) D.fee = 0; render(); };
  ACT['mm-calc'] = (b) => {
    const k = b.dataset.k, D = UI.mm.draft, v = k === 'a' && D.tpl ? D.tpl.a : D[k];
    UI.mm.calc = { k, expr: v ? String(v) : '' };
    push({ p: 'calc' });
  };
  ACT['mm-key'] = (b) => {
    const c = UI.mm.calc, k = b.dataset.k;
    if (k === 'clr') c.expr = '';
    else if (k === 'bs') c.expr = c.expr.slice(0, -1);
    else if (k === 'eq') c.expr = String(Math.max(0, Math.round(calcEval(c.expr) * 100) / 100));
    else if (k === 'ok') {
      const v = Math.max(0, Math.round(calcEval(c.expr))), D = UI.mm.draft;
      if (c.k === 'a' && D.tpl) D.tpl.a = v; else D[c.k] = v;
      return pop();
    } else if (/^[-+*/]$/.test(k)) { if (!c.expr) return; c.expr = /[-+*/]$/.test(c.expr) ? c.expr.slice(0, -1) + k : c.expr + k; }
    else if (k === '.') { const last = c.expr.split(/[-+*/]/).pop(); if (!last.includes('.')) c.expr += last ? '.' : '0.'; }
    else if (c.expr.length < 40) c.expr += k;
    const box = $('.mm-cd');
    if (box) box.innerHTML = `<small>${showExpr(c.expr) || '&nbsp;'}</small><b>${money(Math.max(0, calcEval(c.expr)))}</b>`;
  };
  ACT['mm-photo'] = () => {
    const D = UI.mm.draft;
    if ((D.photos || []).length >= 3) return toast('Up to 3 photos');
    if (navigator.clipboard && navigator.clipboard.read) {
      navigator.clipboard.read().then(async (items) => {
        for (const it of items) { const t = it.types.find((x) => x.startsWith('image/')); if (t) return addPhoto(await it.getType(t)); }
        toast('Copy a photo first, then tap this again (or paste it in Memo)');
      }).catch(() => toast('Copy a photo, then paste it in the Memo field'));
    } else toast('Copy a photo, then paste it in the Memo field');
  };
  const shrink = (blob) => new Promise((ok, bad) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = bad; im.src = u; });
  function addPhoto(blob) {
    shrink(blob).then((d) => { const id = 'p' + Date.now().toString(36); (S.photos = S.photos || {})[id] = d; UI.mm.draft.photos.push(id); render(); toast('Photo added'); }).catch(() => toast('Could not read the photo'));
  }
  document.addEventListener('paste', (e) => {
    if (!e.target.dataset || !e.target.dataset.mmpaste || !UI.mm.draft) return;
    const f = [...((e.clipboardData && e.clipboardData.items) || [])].find((i) => i.type && i.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault();
    if ((UI.mm.draft.photos || []).length >= 3) return toast('Up to 3 photos');
    addPhoto(f.getAsFile());
  });
  ACT['mm-unphoto'] = (b) => { UI.mm.draft.photos.splice(+b.dataset.i, 1); render(); };
  ACT['mm-save'] = () => {
    const D = UI.mm.draft, m = M();
    if (!D.a) return toast('Enter the amount');
    if (!D.d) return toast('Pick a date');
    if (D.type === 'tr') { if (!D.w || !D.to) return toast('Pick both wallets'); if (D.w === D.to) return toast('Pick two different wallets'); }
    else { if (!D.cat) return toast('Select a category'); if (!D.w) return toast('Select a wallet'); }
    const x = { id: D.id || uid(), acc: m.acc, type: D.type, a: D.a, w: D.w, d: D.d, tm: D.tm || '00:00', desc: D.desc.trim(), memo: D.memo.trim() };
    if (D.type === 'tr') { x.to = D.to; if (D.feeOn && D.fee) x.fee = D.fee; } else x.cat = D.cat;
    if (D.photos && D.photos.length) x.photos = D.photos.slice();
    const old = D.id && m.tx.find((t) => t.id === D.id);
    if (old) x.acc = old.acc;
    if (old && old.g && (old.cat !== x.cat || old.type !== x.type)) x.g = undefined;
    let rec = old && old.rec ? m.recs.find((r) => r.id === old.rec) : null;
    if (D.every !== 'none' && D.type !== 'tr') {
      const tpl = Object.assign({}, x); delete tpl.id; delete tpl.d; delete tpl.photos;
      if (!rec) { rec = { id: uid(), acc: x.acc, every: D.every, day: +D.d.slice(8), next: step(D.d, D.every, +D.d.slice(8)), end: D.end || '', tpl }; m.recs.push(rec); }
      else Object.assign(rec, { every: D.every, end: D.end || '', tpl });
      x.rec = rec.id;
    } else if (rec) { m.recs = m.recs.filter((r) => r !== rec); }
    const future = D.every !== 'none' && !old && D.d > todayStr();
    if (future) rec.next = D.d;                       // a recurring record that starts later is only scheduled
    else if (old) Object.assign(old, x, x.type === 'tr' ? { cat: undefined } : { to: undefined, fee: undefined }, x.photos ? {} : { photos: undefined }, x.rec ? {} : { rec: undefined });
    else m.tx.push(x);
    UI.mm.stack = UI.mm.stack.filter((p) => p.p !== 'form' && p.p !== 'calc' && p.p !== 'cat' && p.p !== 'wsel');
    UI.mm.draft = null;
    commit(); window.scrollTo(0, 0);
    toast(future ? 'Scheduled from ' + mdy(D.d) : old ? 'Saved' : 'Record added');
  };
  const txLabel = (t) => (t.desc || (t.type === 'tr' ? 'Transfer' : catOf(t.cat).name)) + ' · ' + (t.type === 'out' ? '-' : '') + M().opt.cur + ' ' + num(t.a);
  ACT['mm-del'] = () => {
    const D = UI.mm.draft, m = M(), i = m.tx.findIndex((t) => t.id === D.id);
    if (i < 0) return;
    const [x] = m.tx.splice(i, 1);
    UI.mm.stack = UI.mm.stack.filter((p) => p.p !== 'form' && p.p !== 'calc' && p.p !== 'cat' && p.p !== 'wsel'); UI.mm.draft = null;
    trashed('mmtx', x, txLabel(x), 'Uang · ' + mdy(x.d), 'Record deleted', i);
  };

  /* ---------- wallets, budgets, goals, debts, recurring ---------- */
  ACT['mm-dset'] = (b) => { const D = UI.mm.draft; D[b.dataset.k] = b.dataset.v; render(); };
  ACT['mm-dflip'] = (b) => { const D = UI.mm.draft; D[b.dataset.k] = !D[b.dataset.k]; render(); };
  ACT['mm-new-w'] = () => { UI.mm.draft = { name: '', start: 0, color: COLORS[wallets().length % COLORS.length], icon: 'cash', excl: false }; push({ p: 'wedit' }); };
  ACT['mm-edit-w'] = (b) => { const w = wal(b.dataset.id); if (!w) return; UI.mm.draft = Object.assign({}, w); push({ p: 'wedit' }); };
  ACT['mm-save-w'] = () => {
    const D = UI.mm.draft, m = M();
    if (!D.name || !D.name.trim()) return toast('Type a name');
    const w = D.id && wal(D.id), v = { name: D.name.trim(), start: D.start || 0, color: D.color, icon: D.icon, excl: !!D.excl };
    if (w) Object.assign(w, v); else m.wallets.push(Object.assign({ id: uid(), acc: m.acc }, v));
    UI.mm.draft = null; pop(); save(); toast(w ? 'Saved' : 'Wallet added');
  };
  ACT['mm-del-w'] = (b) => {
    const D = UI.mm.draft, m = M(), w = wal(D.id);
    if (!w) return;
    const tx = m.tx.filter((x) => x.w === w.id || x.to === w.id);
    if (tx.length && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.innerHTML = I.trash + `Delete with its ${tx.length} record(s)? Tap again`; return; }
    m.wallets = m.wallets.filter((x) => x !== w); m.tx = m.tx.filter((x) => !tx.includes(x));
    UI.mm.stack = UI.mm.stack.filter((p) => !(p.p === 'wedit' || (p.p === 'wallet' && p.id === w.id))); UI.mm.draft = null;
    trashed('mmw', { w, tx }, 'Wallet ' + w.name + (tx.length ? ' · ' + tx.length + ' record(s)' : ''), 'Uang', 'Wallet deleted');
  };
  const simple = (key, list, title, mk, check) => {
    ACT['mm-new-' + key] = () => { UI.mm.draft = mk(); push({ p: key + 'edit' }); };
    ACT['mm-open-' + key] = (b) => { const o = M()[list].find((x) => x.id === b.dataset.id); if (!o) return; UI.mm.draft = JSON.parse(JSON.stringify(o)); push({ p: key + 'edit' }); };
    ACT['mm-save-' + key] = () => {
      const D = UI.mm.draft, m = M(), why = check(D);
      if (why) return toast(why);
      const o = D.id && m[list].find((x) => x.id === D.id);
      if (o) Object.assign(o, D); else m[list].push(Object.assign({}, D, { id: uid(), acc: m.acc }));
      UI.mm.draft = null; pop(); save(); toast(o ? 'Saved' : title + ' added');
    };
    ACT['mm-del-' + key] = () => {
      const D = UI.mm.draft, m = M(), i = m[list].findIndex((x) => x.id === D.id);
      if (i < 0) return;
      const [o] = m[list].splice(i, 1);
      UI.mm.draft = null; UI.mm.stack.pop();
      trashed('mm' + key, o, title + ' ' + (o.name || o.person || (o.tpl && o.tpl.desc) || ''), 'Uang', title + ' deleted', i);
    };
    TRASH_KINDS['mm' + key] = { icon: '💰', name: title, restore: (o, i) => { const l = M()[list]; if (!l.some((x) => x.id === o.id)) (i == null ? l.push(o) : l.splice(Math.min(i, l.length), 0, o)); return true; } };
  };
  simple('b', 'budgets', 'Budget', () => ({ name: '', amount: 0, cat: 'all' }), (D) => (!D.name.trim() ? 'Type a name' : !D.amount ? 'Enter the limit' : ''));
  simple('g', 'goals', 'Goal', () => ({ name: '', target: 0, saved: 0, due: '', color: '#16a34a' }), (D) => (!D.name.trim() ? 'Type a name' : !D.target ? 'Enter the target' : ''));
  simple('d', 'debts', 'Debt', () => ({ kind: 'borrow', person: '', amount: 0, paid: 0, due: '', note: '' }), (D) => (!D.person.trim() ? 'Type a name' : !D.amount ? 'Enter the amount' : ''));
  simple('r', 'recs', 'Recurring', () => null, (D) => { if (D.next) D.day = +D.next.slice(8); return !D.tpl.a ? 'Enter the amount' : !D.next ? 'Pick the next date' : ''; });
  ACT['mm-new-r'] = () => {
    if (!wallets().length) { toast('Add a wallet first'); return ACT['mm-new-w'](); }
    startDraft({ every: 'monthly' }); push({ p: 'form' });
  };
  ACT['mm-bcat'] = () => {
    const D = UI.mm.draft;
    mSheet(`<div class="mm-sh"><h2>Category</h2><button class="mm-pick" data-act="mm-bpick" data-k="all">${ico({ color: '#5f6670', icon: 'grid' })}<span class="grow">All expenses</span>${radio(!D.cat || D.cat === 'all')}</button>${catList('out').map((c) => `<button class="mm-pick" data-act="mm-bpick" data-k="${c.key}">${ico(c)}<span class="grow">${esc(c.name)}</span>${radio(D.cat === c.key)}</button>`).join('')}</div>`);
  };
  ACT['mm-bpick'] = (b) => { UI.mm.draft.cat = b.dataset.k; const D = UI.mm.draft; if (!D.name) D.name = b.dataset.k === 'all' ? 'All expenses' : catOf(b.dataset.k).name; closeSheet(); render(); };

  /* ---------- settings ---------- */
  ACT['mm-opt'] = (b) => { const o = M().opt, k = b.dataset.k; o[k] = k === 'week' ? +b.dataset.v : b.dataset.v; commit(); };
  ACT['mm-optflip'] = (b) => { const o = M().opt; o[b.dataset.k] = !o[b.dataset.k]; commit(); };
  ACT['mm-cmtab'] = (b) => { UI.mm.cmTab = b.dataset.t; UI.mm.cmNew = null; render(); };
  ACT['mm-cathide'] = (b) => { const h = M().cats.hide, k = b.dataset.k, i = h.indexOf(k); if (i < 0) h.push(k); else h.splice(i, 1); commit(); };
  ACT['mm-catnew'] = () => { UI.mm.cmNew = { name: '', color: COLORS[4], icon: 'star' }; render(); const i = $('[data-mmcm="name"]'); if (i) i.focus(); };
  ACT['mm-cmset'] = (b) => { UI.mm.cmNew[b.dataset.k] = b.dataset.v; render(); };
  ACT['mm-catadd'] = () => {
    const D = UI.mm.cmNew, t = UI.mm.cmTab || 'out';
    if (!D.name.trim()) return toast('Type a name');
    M().cats[t].push({ id: 'c' + uid(), name: D.name.trim(), color: D.color, icon: D.icon });
    UI.mm.cmNew = null; commit(); toast('Category added');
  };
  ACT['mm-catdel'] = (b) => {
    const [t, id] = b.dataset.k.split(':'), l = M().cats[t], i = l.findIndex((c) => c.id === id);
    if (i < 0) return;
    const used = M().tx.some((x) => x.cat === b.dataset.k);
    if (used && b.dataset.sure !== '1') { b.dataset.sure = '1'; toast('Records use this category; they will show as Others. Tap the bin again to delete'); return; }
    l.splice(i, 1); commit();
  };
  ACT['mm-accdel'] = (b) => {
    const m = M(), a = m.accounts.find((x) => x.id === b.dataset.id);
    if (!a || m.accounts.length < 2) return;
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; toast('Tap the bin again to delete ' + a.name + ' with everything in it'); return; }
    const pick = (k) => { const keep = [], out = []; for (const o of m[k]) (o.acc === a.id ? out : keep).push(o); m[k] = keep; return out; };
    const data = { a, wallets: pick('wallets'), tx: pick('tx'), budgets: pick('budgets'), goals: pick('goals'), debts: pick('debts'), recs: pick('recs') };
    m.accounts = m.accounts.filter((x) => x !== a);
    if (m.acc === a.id) m.acc = m.accounts[0].id;
    trashed('mma', data, 'Account ' + a.name + ' · ' + data.tx.length + ' record(s)', 'Uang', 'Account deleted');
  };
  ACT['mm-erase'] = (b) => {
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.querySelector('b').textContent = 'Tap again to erase everything in Uang'; return; }
    const old = S.mm, n = (old.tx || []).length;
    S.mm = Object.assign(blank(), { opt: old.opt });
    S.mm.accounts.push({ id: uid(), name: 'Main' });
    S.mm.wallets.push({ id: uid(), acc: S.mm.accounts[0].id, name: 'Money', color: '#1a9bf0', icon: 'cash', start: 0, excl: false });
    UI.mm.stack = []; UI.mm.tab = 'tx';
    trashed('mmall', old, 'Semua data uang · ' + n + ' record(s)', 'Uang (memulihkan = mengganti data uang yang sekarang)', 'Money data erased');
  };

  /* ---------- typing ---------- */
  document.addEventListener('input', (e) => {
    const el = e.target, ds = el.dataset || {};
    if (ds.mm && UI.mm.draft) {
      const D = UI.mm.draft;
      if (D.tpl && ds.mm === 'a') D.tpl.a = parseNum(el.value); else D[ds.mm] = el.value;
      if (ds.mm === 'name' && page() && page().p === 'accnew') { const n = $('.mm-next'); if (n) n.classList.toggle('dim', !el.value.trim()); }
      if (ds.mm === 'name' && page() && page().p === 'wedit') { const s = $('.mm-wprev small'); if (s) s.textContent = el.value || 'Wallet'; }
      if (el.tagName === 'TEXTAREA') { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
    }
    if (ds.mmq === 'tx') { UI.mm.q = el.value; const r = $('#mmRes'); if (r) r.innerHTML = searchBody(); }
    if (ds.mmq === 'cat') { UI.mm.catQ = el.value; const l = $('.mm-list'); if (l) { const tmp = document.createElement('div'); tmp.innerHTML = pCat(); const nl = tmp.querySelector('.mm-list'); if (nl) l.innerHTML = nl.innerHTML; } }
    if (ds.mmcm && UI.mm.cmNew) UI.mm.cmNew[ds.mmcm] = el.value;
    if (ds.mmopt) { M().opt[ds.mmopt] = ds.mmopt === 'cur' ? el.value.trim() || 'Rp' : el.value; save(); }
    if (ds.mmacc) { const a = M().accounts.find((x) => x.id === ds.mmacc); if (a) { a.name = el.value.trim() || a.name; save(); } }
  });
  document.addEventListener('change', (e) => {
    const ds = e.target.dataset || {};
    if (ds.mm === 'end' && UI.mm.draft && !UI.mm.draft.tpl) { UI.mm.draft.end = e.target.value; }
  });

  /* ---------- Baru dihapus ---------- */
  const putAt = (list, i, x) => (i == null ? list.push(x) : list.splice(Math.min(i, list.length), 0, x));
  TRASH_KINDS.mmtx = { icon: '💸', name: 'Record', restore: (x, i) => { const m = M(); if (!m.tx.some((t) => t.id === x.id)) putAt(m.tx, i, x); return true; } };
  TRASH_KINDS.mmw = { icon: '👛', name: 'Wallet', restore: (o) => { const m = M(); if (!m.accounts.some((a) => a.id === o.w.acc)) return 'Its account is gone'; if (!m.wallets.some((w) => w.id === o.w.id)) m.wallets.push(o.w); for (const x of o.tx) if (!m.tx.some((t) => t.id === x.id)) m.tx.push(x); return true; } };
  TRASH_KINDS.mma = { icon: '🏦', name: 'Account', restore: (o) => { const m = M(); if (!m.accounts.some((a) => a.id === o.a.id)) m.accounts.push(o.a); for (const k of ['wallets', 'tx', 'budgets', 'goals', 'debts', 'recs']) for (const x of o[k]) if (!m[k].some((y) => y.id === x.id)) m[k].push(x); return true; } };
  TRASH_KINDS.mmall = { icon: '💰', name: 'Semua data uang', restore: (o) => { S.mm = o; return true; } };
  /* ---------- the planner's view of the records (planner.js) ---------- */
  const GROUP_OF = { bills: 'needs', health: 'needs', education: 'needs', transportation: 'needs', food: 'needs', pet: 'needs', others: 'needs',
    clothing: 'wants', entertainment: 'wants', gifts: 'wants', shopping: 'wants', travel: 'wants', furniture: 'wants', fitness: 'wants' };
  window.MM = {
    cur: () => M().opt.cur,
    /** What the wallets in the total started with. */
    opening: () => sum(wallets().filter((w) => !w.excl).map((w) => w.start || 0)),
    /** Records of the open account as the planner's { 'YYYY-MM': { tx: [...] } }: money in and out of the wallets in the
     * total. Moving money to a wallet outside the total counts as set aside (Masa depan); back from one, as income. */
    planTx() {
      const months = {}, put = (t) => { const mk = t.d.slice(0, 7); (months[mk] || (months[mk] = { tx: [] })).tx.push(t); };
      const base = (x) => ({ id: x.id, mm: x.id, d: x.d, item: x.item || null, note: x.memo || '', occ: x.occ });
      for (const x of accTx()) {
        const w = wal(x.w), inc = !!(w && !w.excl);
        if (x.type === 'tr') {
          const to = wal(x.to), toInc = !!(to && !to.excl);
          if (inc && !toInc) put(Object.assign(base(x), { t: 'out', a: x.a + (x.fee || 0), name: x.desc || 'Ke ' + (to ? to.name : 'dompet lain'), g: x.g || 'future' }));
          else if (!inc && toInc) put(Object.assign(base(x), { t: 'in', a: x.a, name: x.desc || 'Dari ' + (w ? w.name : 'dompet lain'), g: 'income' }));
          else if (inc && x.fee) put(Object.assign(base(x), { t: 'out', a: x.fee, name: 'Biaya transfer', g: 'needs' }));
          continue;
        }
        if (!inc) continue;
        const id = String(x.cat || '').split(':')[1];
        put(Object.assign(base(x), { t: x.type, a: x.a, name: x.desc || catOf(x.cat).name, g: x.g || (x.type === 'in' ? 'income' : GROUP_OF[id] || 'needs') }));
      }
      return months;
    },
    /** A record logged from the planner (a bill ticked as paid, a list item bought): goes on the account's main wallet. */
    add(t) {
      const m = M(), ws = wallets(), main = ws.find((w) => !w.excl) || ws[0];
      if (!main) return;
      const cat = t.t === 'in' ? 'in:' + (/jajan|saku/i.test(t.name || '') ? 'allowance' : /gaji|salary/i.test(t.name || '') ? 'salary' : 'others') : guessCat((t.name || '') + ' ' + (t.note || ''));
      const x = { id: t.id || uid(), acc: m.acc, type: t.t === 'in' ? 'in' : 'out', a: t.a, cat, w: main.id, d: t.d, tm: t.d === todayStr() ? nowHM() : '12:00', desc: t.name || '', memo: t.note || '' };
      if (t.item) x.item = t.item;
      if (t.occ) x.occ = t.occ;
      if (t.g) x.g = t.g;
      m.tx.push(x);
    },
    del(id) { const m = M(), i = m.tx.findIndex((x) => x.id === id); if (i >= 0) m.tx.splice(i, 1); },
  };

  /* ---------- hooks for the rest of the app ---------- */
  const _close = closeSheet;
  // eslint-disable-next-line no-global-assign
  closeSheet = function () { _close(); $('#sheet').classList.remove('mmsheet'); };
  function applyLook() {
    const on = UI.tab === 'money' && !UI.stack.length;
    const dark = on && (M().opt.theme === 'dark' || document.documentElement.dataset.theme === 'dark');
    document.body.classList.toggle('mm-on', on);
    document.body.classList.toggle('mm-dark', dark);
    document.body.classList.toggle('mm-light', on && !dark);
    const meta = $('meta[name="theme-color"]');
    if (meta && on) meta.content = dark ? '#1f2023' : '#ffffff';
    else if (meta) meta.content = document.documentElement.dataset.theme === 'dark' ? '#191919' : '#ffffff';
  }
  ACT['m-open'] = () => { UI.stack = []; UI.scroll = []; UI.tab = 'money'; UI.mm.stack = []; UI.mm.tab = 'tx'; render(); window.scrollTo(0, 0); };
  window.Money = {
    reset() { UI.mm.stack = []; UI.mm.tab = 'tx'; UI.mm.draft = null; UI.mm.anchor = todayStr(); UI.mm.calMonth = todayStr().slice(0, 7); if (window.Planner) Planner.reset(); },
    afterRender() { applyLook(); const t = $('.mm textarea'); if (t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; } if (window.Planner) Planner.afterRender(); },
    /** Android back inside Uang: close a page, then go back to the Transaction tab. */
    back() {
      if (page() && page().p === 'planner' && UI.m.view !== 'home') { UI.m.view = 'home'; render(); window.scrollTo(0, 0); return true; }
      if (UI.mm.stack.length) { pop(); return true; }
      if (UI.mm.tab !== 'tx') { UI.mm.tab = 'tx'; render(); window.scrollTo(0, 0); return true; }
      return false;
    },
    todayCard() {
      runRecs();
      const t = todayStr(), today = totals(accTx().filter((x) => x.d === t)), sf = window.Planner ? Planner.safe() : null;
      return `<button class="card m-today" data-act="m-open"><span class="grow"><small>${esc(acc().name)}</small><b>${money(accBal())}</b></span><span class="muted small">${sf ? 'Aman dipakai hari ini<br><b class="m-safe">' + money(sf.perDay) + '</b>' : 'Hari ini ' + (today.exp ? '−' + num(today.exp) : '0')}</span><span class="chev">›</span></button>`;
    },
    dayCard(ds) {
      const xs = M().tx.filter((x) => x.d === ds).sort(byTime), plan = window.Planner ? Planner.dayCard(ds) : '';
      if (!xs.length) return plan;
      return `<section class="card mmday"><header><h3>💸 Uang</h3><span class="count">${xs.length}</span></header>${xs.map((x) => {
        const c = x.type === 'tr' ? TRANSFER : catOf(x.cat);
        return `<div class="m-row" data-act="m-open"><span class="m-main"><span class="m-name">${esc(x.desc || c.name)}</span><span class="m-meta">${esc(c.name)} · ${esc(x.tm || '')}</span></span><span class="m-amt ${x.type === 'in' ? 'okc' : ''}">${x.type === 'out' ? '−' : x.type === 'in' ? '+' : ''}${num(x.a)}</span></div>`;
      }).join('')}</section>${plan}`;
    },
    summaryCard() {
      const mk = todayStr().slice(0, 7), t = totals(accTx().filter((x) => x.d.slice(0, 7) === mk));
      return `<div class="card"><div class="stat"><div><b>${money(accBal())}</b><small>Saldo</small></div><div><b>${num(t.inc)}</b><small>Masuk bulan ini</small></div><div><b>${num(t.exp)}</b><small>Keluar bulan ini</small></div></div>
        <button class="btn wide" data-act="m-open">Buka Uang — catat transaksi</button></div>`;
    },
    queue(d, ds, now, out) {
      if (window.Planner) Planner.queue(d, ds, now, out);
      if (!S.mm) return;
      const m = M(), o = m.opt;
      if (o.remind) { const at = atTime(d, o.remindAt || '20:00'); if (at > now) out.push({ id: 'mmr|' + ds, at, ch: 'reminders', title: '📝 Catat pengeluaran hari ini', body: 'Buka Uang dan catat yang keluar & masuk hari ini.' }); }
      const tomorrow = ymd(addDays(d, 1)), items = [];
      for (const x of m.debts) {
        if (!x.due || (x.paid || 0) >= x.amount) continue;
        if (x.due === ds || x.due === tomorrow) items.push({ k: 'mmd|' + x.id, x: `${x.kind === 'lend' ? x.person + ' bayar utang' : 'Bayar utang ke ' + x.person} ${x.due === ds ? 'hari ini' : 'besok'} · ${o.cur} ${num(x.amount - (x.paid || 0))}` });
      }
      const at = atTime(d, '08:00');
      if (items.length && at > now) out.push({ id: 'mmd|' + ds, at, ch: 'tasks', title: '💸 Utang jatuh tempo', items });
    },
    result(key, v) {
      if (window.Planner) Planner.result(key, v);
      if (!S.mm || v !== 1 || !key.startsWith('mmd|')) return;
      const x = S.mm.debts.find((o) => o.id === key.slice(4));
      if (x) x.paid = x.amount;
    },
    doneKeys() { return (window.Planner ? Planner.doneKeys() : []).concat(S.mm ? S.mm.debts.filter((x) => x.due && (x.paid || 0) >= x.amount).map((x) => 'mmd|' + x.id) : []); },
  };
})();
