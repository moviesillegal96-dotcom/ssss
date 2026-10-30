let settings;
const $ = (id) => document.getElementById(id);

function cleanDomain(input) {
  let d = input.trim().toLowerCase();
  try {
    if (d.includes('/')) d = new URL(d.includes('://') ? d : 'https://' + d).hostname;
  } catch {}
  return d.replace(/^www\./, '');
}

function renderSites() {
  const box = $('sites');
  box.innerHTML = '';
  settings.sites.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'site-row';
    row.innerHTML = `<input disabled><input type="number" min="0"><button class="ghost">Remove</button>`;
    const [name, limit] = row.querySelectorAll('input');
    name.value = s.label || s.domain;
    limit.value = s.limit;
    limit.addEventListener('input', () => (s.limit = Math.max(0, Number(limit.value) || 0)));
    row.querySelector('button').addEventListener('click', () => {
      const ok = confirm(FB.fill(`Unblock ${s.label || s.domain}? {bud} will remember you did this.`, { bud: settings.budName }));
      if (!ok) return;
      settings.sites.splice(i, 1);
      renderSites();
    });
    box.append(row);
  });
}

async function load() {
  settings = await FB.getSettings();
  settings.sites = settings.sites.map((s) => ({ ...s }));
  for (const k of ['budName', 'goal', 'totalLimit', 'intensity', 'passMinutes']) $(k).value = settings[k];
  renderSites();

  const [day, stats] = await Promise.all([FB.getDay(), FB.getStats()]);
  $('bud').innerHTML = FB.budSVG(FB.budMood(FB.budHealth(day, settings)), 80);
  $('statsLine').textContent = `🔥 Streak ${stats.streak} days (best ${stats.bestStreak}). A day counts if you stay under every limit and use no guilt passes.`;
  const days = [...stats.history, { date: day.date, minutes: Math.round(FB.totalSeconds(day) / 60), limit: settings.totalLimit }];
  const max = Math.max(1, ...days.map((d) => Math.max(d.minutes, d.limit)));
  $('history').innerHTML = days
    .map((d) => `<div><i class="${d.minutes > d.limit ? 'over' : ''}" style="height:${(d.minutes / max) * 90}px" title="${d.minutes} min"></i>${d.date.slice(5)}</div>`)
    .join('');
}

// On Android the "add" row picks from installed apps instead of typing a domain.
function setupAppPicker() {
  const apps = JSON.parse(FB.android.listApps());
  const select = document.createElement('select');
  select.id = 'newApp';
  select.innerHTML = '<option value="">Choose an app…</option>';
  for (const a of apps) select.add(new Option(a.label, a.pkg));
  $('newDomain').replaceWith(select);
  $('sitesLabel').textContent = 'Blocked apps and their daily limits (minutes)';
  $('totalHint').textContent = 'All the apps below added together.';
}

$('add').addEventListener('click', () => {
  if (FB.android) {
    const select = $('newApp');
    if (!select.value) return alert('Pick an app first.');
    if (settings.sites.some((s) => s.domain === select.value)) return alert('That app is already on your list.');
    settings.sites.push({ domain: select.value, label: select.selectedOptions[0].text, limit: Math.max(0, Number($('newLimit').value) || 0) });
    select.value = '';
    return renderSites();
  }
  const domain = cleanDomain($('newDomain').value);
  if (!domain || !domain.includes('.')) return alert('Type a site like tiktok.com');
  if (settings.sites.some((s) => s.domain === domain)) return alert('That site is already on your list.');
  settings.sites.push({ domain, limit: Math.max(0, Number($('newLimit').value) || 0) });
  $('newDomain').value = '';
  renderSites();
});

$('save').addEventListener('click', async () => {
  const old = await FB.getSettings();
  const next = {
    ...settings,
    budName: $('budName').value.trim() || 'Bud',
    goal: $('goal').value.trim() || 'focus',
    totalLimit: Math.max(0, Number($('totalLimit').value) || 0),
    intensity: $('intensity').value,
    passMinutes: Math.min(30, Math.max(1, Number($('passMinutes').value) || 5)),
  };

  // Raising your own limits is the easiest way to cheat, so it gets its own guilt trip.
  const raised = next.totalLimit > old.totalLimit || next.sites.some((s) => {
    const before = old.sites.find((o) => o.domain === s.domain);
    return before && s.limit > before.limit;
  });
  if (raised) {
    const ok = confirm(FB.fill('You\'re giving yourself MORE screen time? You said you wanted to {goal}.\n\n{bud} is not angry. Just disappointed.\n\nRaise the limit anyway?', { bud: next.budName, goal: next.goal }));
    if (!ok) return;
  }

  await FB.set('settings', next);
  settings = next;
  $('saved').classList.add('show');
  setTimeout(() => $('saved').classList.remove('show'), 2000);
  load();
});

if (FB.android) setupAppPicker();
load();
