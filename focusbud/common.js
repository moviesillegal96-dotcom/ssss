// Shared by the background worker and every FocusBud page.
// Storage: the native store in the Android app, chrome.storage in the extension,
// localStorage when opened as a plain web page (demo mode).

const FB = (() => {
  const android = typeof AndroidBridge !== 'undefined' ? AndroidBridge : null;
  const hasChrome = !android && typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;

  const DEFAULT_SETTINGS = {
    budName: 'Bud',
    goal: 'finish the school project',
    totalLimit: 60, // minutes per day across all blocked sites
    intensity: 'medium', // gentle | medium | savage
    passMinutes: 5, // how long "continue anyway" unlocks a site
    sites: [
      { domain: 'instagram.com', limit: 20 },
      { domain: 'tiktok.com', limit: 20 },
      { domain: 'youtube.com', limit: 30 },
      { domain: 'x.com', limit: 15 },
      { domain: 'twitter.com', limit: 15 },
      { domain: 'facebook.com', limit: 15 },
      { domain: 'reddit.com', limit: 20 },
      { domain: 'snapchat.com', limit: 10 },
    ],
  };

  // On Android "sites" are apps: domain holds the package name and label the app's name.
  async function get(key, fallback) {
    if (android) {
      const raw = android.get(key);
      return raw == null ? fallback : JSON.parse(raw);
    }
    if (hasChrome) {
      const res = await chrome.storage.local.get(key);
      return res[key] === undefined ? fallback : res[key];
    }
    try {
      const raw = localStorage.getItem('focusbud:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  async function set(key, value) {
    if (android) return android.set(key, JSON.stringify(value));
    if (hasChrome) return chrome.storage.local.set({ [key]: value });
    try {
      localStorage.setItem('focusbud:' + key, JSON.stringify(value));
    } catch {}
  }

  const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  async function getSettings() {
    return { ...DEFAULT_SETTINGS, ...(await get('settings', {})) };
  }

  // One record per day: { date, sites: {domain: seconds}, passes, streakCounted }
  async function getDay() {
    const day = await get('day', null);
    if (day && day.date === today()) return day;
    // New day: decide whether yesterday kept the streak alive, then start fresh.
    if (day) {
      const settings = await getSettings();
      const stats = await getStats();
      const kept = !day.overLimit && day.passes === 0;
      stats.streak = kept ? stats.streak + 1 : 0;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      stats.history = [...stats.history, { date: day.date, minutes: Math.round(totalSeconds(day) / 60), passes: day.passes, limit: settings.totalLimit }].slice(-14);
      await set('stats', stats);
    }
    const fresh = { date: today(), sites: {}, passes: 0, overLimit: false };
    await set('day', fresh);
    return fresh;
  }

  async function getStats() {
    return { streak: 0, bestStreak: 0, lifetimePasses: 0, history: [], ...(await get('stats', {})) };
  }

  const totalSeconds = (day) => Object.values(day.sites).reduce((a, b) => a + b, 0);

  function matchSite(hostname, sites) {
    hostname = (hostname || '').replace(/^www\./, '').toLowerCase();
    return sites.find((s) => hostname === s.domain || hostname.endsWith('.' + s.domain)) || null;
  }

  // Why (if at all) a site should be blocked right now.
  async function blockReason(domain) {
    const [settings, day, focusUntil, snoozes] = await Promise.all([getSettings(), getDay(), get('focusUntil', 0), get('snoozes', {})]);
    const site = settings.sites.find((s) => s.domain === domain);
    if (!site) return null;
    if ((snoozes[domain] || 0) > Date.now()) return null;
    if (focusUntil > Date.now()) return 'focus';
    if ((day.sites[domain] || 0) >= site.limit * 60) return 'site';
    if (totalSeconds(day) >= settings.totalLimit * 60) return 'total';
    return null;
  }

  // 0-100. Every guilt pass and every minute over a limit (the daily total or a single site's) hurts the bud.
  function budHealth(day, settings) {
    const siteOver = settings.sites.reduce((sum, s) => sum + Math.max(0, (day.sites[s.domain] || 0) / 60 - s.limit), 0);
    const overMin = Math.max(siteOver, totalSeconds(day) / 60 - settings.totalLimit);
    return Math.max(0, Math.round(100 - day.passes * 20 - overMin * 2));
  }

  function budMood(health) {
    if (health >= 80) return 'happy';
    if (health >= 50) return 'worried';
    if (health >= 20) return 'sad';
    return 'wilting';
  }

  // A little potted plant whose face and leaves follow its mood.
  function budSVG(mood, size = 160) {
    const leaf = { happy: '#4caf50', worried: '#8bc34a', sad: '#a8b545', wilting: '#a1887f' }[mood];
    const droop = { happy: 0, worried: 10, sad: 25, wilting: 45 }[mood];
    const mouth = {
      happy: 'M70 112 Q80 122 90 112',
      worried: 'M70 116 L90 116',
      sad: 'M70 118 Q80 109 90 118',
      wilting: 'M68 120 Q80 106 92 120',
    }[mood];
    const tears = mood === 'sad' || mood === 'wilting'
      ? '<path class="tear" d="M66 104 q-3 7 0 9 q3 -2 0 -9z" fill="#64b5f6"/><path class="tear t2" d="M94 104 q-3 7 0 9 q3 -2 0 -9z" fill="#64b5f6"/>'
      : '';
    const brows = mood === 'happy' ? '' : '<path d="M62 92 L72 96 M98 92 L88 96" stroke="#3e2723" stroke-width="2.5" stroke-linecap="round"/>';
    return `<svg viewBox="0 0 160 170" width="${size}" height="${size * 1.06}" role="img" aria-label="${mood} plant">
      <g transform="rotate(${droop / 3} 80 70)">
        <path d="M80 70 Q60 ${30 + droop} 30 ${40 + droop * 1.4} Q55 ${60 + droop / 2} 80 70z" fill="${leaf}"/>
        <path d="M80 70 Q100 ${30 + droop} 130 ${40 + droop * 1.4} Q105 ${60 + droop / 2} 80 70z" fill="${leaf}"/>
        <path d="M80 80 L80 ${40 + droop}" stroke="${leaf}" stroke-width="5" stroke-linecap="round"/>
      </g>
      <path d="M38 78 H122 L112 160 H48z" fill="#d7845b"/>
      <rect x="32" y="72" width="96" height="16" rx="4" fill="#c26d45"/>
      <circle cx="67" cy="100" r="4" fill="#3e2723"/><circle cx="93" cy="100" r="4" fill="#3e2723"/>
      ${brows}
      <path d="${mouth}" stroke="#3e2723" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${tears}
    </svg>`;
  }

  const GUILT = {
    gentle: [
      "Hey, {bud} misses you. Weren't we going to {goal}?",
      "You've already spent {minutes} minutes on {site} today. Maybe that's enough?",
      "{bud} believes in you. Just close the tab.",
      "Future you will be really glad you stopped here.",
    ],
    medium: [
      "{minutes} minutes on {site} today. {bud} is watching you, quietly disappointed.",
      "You told {bud} you wanted to {goal}. {bud} remembers. Do you?",
      "Every scroll waters {site}'s profits, not {bud}.",
      "Your feed will be exactly as pointless in an hour. Your goal won't wait.",
      "{bud} skipped sunlight today so you could focus. You're welcome.",
    ],
    savage: [
      "{minutes} minutes. On {site}. {bud} is writing this down for your future therapist.",
      "Remember when you said you'd {goal}? {bud} does. {bud} always does.",
      "Wow. Again? {bud} is literally wilting and you're watching strangers eat cereal.",
      "Nobody on {site} will remember your name. {goal} might.",
      "{bud} gave up photosynthesis for this?",
      "Your future self just sighed so hard it reached the past.",
    ],
  };

  function fill(text, vars) {
    return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  function guiltLine(intensity, vars, seed = Math.random()) {
    const list = GUILT[intensity] || GUILT.medium;
    return fill(list[Math.floor(seed * list.length) % list.length], vars);
  }

  // Turn wasted minutes into things that would have been nicer to do.
  function couldHave(minutes) {
    const items = [
      ['📖', 'pages of a book read', 2],
      ['🚶', 'km walked', 12],
      ['📝', 'homework problems solved', 4],
      ['🦉', 'language lessons done', 5],
      ['💪', 'push-ups (sets of 10)', 1.5],
      ['🎸', 'songs practiced', 4],
    ];
    return items
      .map(([icon, label, per]) => ({ icon, label, n: Math.floor(minutes / per) }))
      .filter((x) => x.n > 0)
      .slice(0, 4);
  }

  const siteName = (settings, domain) => (settings.sites.find((s) => s.domain === domain) || {}).label || domain;

  const fmtMin = (sec) => {
    const m = Math.floor(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };

  return { android, hasChrome, siteName, DEFAULT_SETTINGS, get, set, today, getSettings, getDay, getStats, totalSeconds, matchSite, blockReason, budHealth, budMood, budSVG, guiltLine, fill, couldHave, fmtMin };
})();

if (typeof self !== 'undefined') self.FB = FB;
