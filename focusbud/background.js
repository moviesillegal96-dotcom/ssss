importScripts('common.js');

// Time tracking: whenever something changes (tab switch, navigation, window focus, alarm tick) the
// time since the last event is credited to the site that was in front, then the new front site is recorded.
const MAX_CREDIT_MS = 90 * 1000; // never credit more than this per event (laptop asleep, etc.)

let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn)); // events can fire in bursts; keep writes in order

async function frontDomain() {
  const idle = await chrome.idle.queryState(120);
  if (idle !== 'active') return null;
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win || !win.focused) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab || !tab.url || !tab.url.startsWith('http')) return null;
  const settings = await FB.getSettings();
  const site = FB.matchSite(new URL(tab.url).hostname, settings.sites);
  return site ? { domain: site.domain, tab } : null;
}

async function tick() {
  const now = Date.now();
  const last = await FB.get('last', { domain: null, at: now });
  const day = await FB.getDay();
  const settings = await FB.getSettings();

  if (last.domain) {
    const credit = Math.min(now - last.at, MAX_CREDIT_MS) / 1000;
    day.sites[last.domain] = (day.sites[last.domain] || 0) + credit;
    const site = settings.sites.find((s) => s.domain === last.domain);
    if ((site && day.sites[last.domain] > site.limit * 60) || FB.totalSeconds(day) > settings.totalLimit * 60) day.overLimit = true;
    await FB.set('day', day);
  }

  const front = await frontDomain();
  await FB.set('last', { domain: front ? front.domain : null, at: now });
  if (front) await enforce(front.tab, front.domain);
  updateBadge(day, settings);
}

async function enforce(tab, domain) {
  const reason = await FB.blockReason(domain);
  if (!reason) return;
  const url = chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(domain)}&reason=${reason}&url=${encodeURIComponent(tab.url)}`);
  chrome.tabs.update(tab.id, { url });
}

function updateBadge(day, settings) {
  const left = Math.max(0, Math.round(settings.totalLimit - FB.totalSeconds(day) / 60));
  chrome.action.setBadgeText({ text: String(left) });
  chrome.action.setBadgeBackgroundColor({ color: left > 10 ? '#4caf50' : left > 0 ? '#ff9800' : '#e53935' });
}

// Block on navigation too, in background tabs as well, so a blocked site can't even load.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!info.url || !info.url.startsWith('http')) return;
  serial(async () => {
    const settings = await FB.getSettings();
    const site = FB.matchSite(new URL(info.url).hostname, settings.sites);
    if (site) await enforce({ ...tab, url: info.url }, site.domain);
    await tick();
  });
});

chrome.tabs.onActivated.addListener(() => serial(tick));
chrome.windows.onFocusChanged.addListener(() => serial(tick));
chrome.idle.onStateChanged.addListener(() => serial(tick));
chrome.alarms.onAlarm.addListener(() => serial(tick));

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  chrome.alarms.create('tick', { periodInMinutes: 0.5 });
  if (reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(() => chrome.alarms.create('tick', { periodInMinutes: 0.5 }));

// Pages ask the worker to credit time before they read usage, so numbers are up to date.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg === 'tick') serial(tick).then(() => reply(true));
  return true;
});
