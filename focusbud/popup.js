const MOOD_TITLE = { happy: '{bud} is thriving 🌱', worried: '{bud} is getting nervous', sad: '{bud} is sad', wilting: '{bud} is wilting…' };
const MOOD_LINE = {
  happy: 'Keep it up. Every minute off your feed is sunlight for {bud}.',
  worried: "You're using up your screen time. {bud} is starting to sweat.",
  sad: '{bud} wanted to grow today. You chose scrolling instead.',
  wilting: "You blew past your limit. {bud} doesn't have long left today.",
};

async function render() {
  if (FB.hasChrome) await chrome.runtime.sendMessage('tick').catch(() => {});
  const [settings, day, stats, focusUntil] = await Promise.all([FB.getSettings(), FB.getDay(), FB.getStats(), FB.get('focusUntil', 0)]);
  const vars = { bud: settings.budName };
  const health = FB.budHealth(day, settings);
  const mood = FB.budMood(health);

  if (FB.android) {
    document.body.classList.add('app');
    document.getElementById('setup').classList.toggle('hidden', FB.android.isGuardOn());
    document.getElementById('perLabel').textContent = 'Per app';
    document.getElementById('settingsLink').removeAttribute('target');
  }

  document.getElementById('bud').innerHTML = FB.budSVG(mood, 110);
  document.getElementById('mood').textContent = FB.fill(MOOD_TITLE[mood], vars);
  document.getElementById('line').textContent = FB.fill(MOOD_LINE[mood], vars);
  document.getElementById('health').textContent = `Health ${health}% · ${day.passes} guilt pass${day.passes === 1 ? '' : 'es'} used today`;

  const used = FB.totalSeconds(day);
  const pct = Math.min(100, (used / (settings.totalLimit * 60)) * 100);
  document.getElementById('total').textContent = `${FB.fmtMin(used)} / ${settings.totalLimit}m`;
  setBar(document.getElementById('totalBar'), pct);

  const sites = document.getElementById('sites');
  sites.innerHTML = '';
  const listed = settings.sites
    .map((s) => ({ ...s, sec: day.sites[s.domain] || 0 }))
    .sort((a, b) => b.sec - a.sec);
  for (const s of listed) {
    const el = document.createElement('div');
    el.className = 'site';
    el.innerHTML = `<div class="row"><span class="grow"></span><span class="muted"></span></div><div class="bar"><i></i></div>`;
    el.querySelector('.grow').textContent = s.label || s.domain;
    el.querySelector('.muted').textContent = `${FB.fmtMin(s.sec)} / ${s.limit}m`;
    setBar(el.querySelector('i'), Math.min(100, (s.sec / (s.limit * 60)) * 100));
    sites.append(el);
  }

  const focusing = focusUntil > Date.now();
  document.getElementById('focusText').textContent = focusing
    ? `Focusing until ${new Date(focusUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. No sneaking out.`
    : `Block every ${FB.android ? 'app' : 'site'} on your list for a while.`;
  document.querySelectorAll('#focusBtns button').forEach((b) => (b.disabled = focusing));

  document.getElementById('streak').textContent = `🔥 ${stats.streak}-day streak (best ${stats.bestStreak})`;
}

function setBar(el, pct) {
  el.style.width = pct + '%';
  el.className = pct >= 100 ? 'over' : pct >= 75 ? 'warn' : '';
}

document.querySelectorAll('#focusBtns button').forEach((b) =>
  b.addEventListener('click', async () => {
    await FB.set('focusUntil', Date.now() + Number(b.dataset.min) * 60 * 1000);
    await FB.set('snoozes', {}); // a focus session cancels any guilt passes still running
    if (FB.hasChrome) chrome.runtime.sendMessage('tick').catch(() => {});
    render();
  })
);

if (FB.android) {
  document.getElementById('openGuard').onclick = () => FB.android.openGuardSettings();
  document.getElementById('openInfo').onclick = () => FB.android.openAppInfo();
  window.onAndroidResume = render; // coming back from Settings or a blocked app
}

render();
