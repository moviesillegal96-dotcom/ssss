const params = new URLSearchParams(location.search);
const site = params.get('site') || 'instagram.com'; // opened without params = demo
const reason = params.get('reason') || 'site';
const back = params.get('url') || '';
const $ = (id) => document.getElementById(id);

let settings, day, vars, guiltTimer;

const TITLES = {
  site: "Time's up for {site}",
  total: "You've used all your screen time today",
  focus: "You're in a focus session",
};

const QUESTIONS = [
  { q: 'Be honest. Is this actually important, or are you just bored?', no: "I'm just bored. I'll go.", yes: "It's important (it isn't)" },
  { q: "{bud} is at {health}% health. Every pass you use takes 20% off. {bud} can't photosynthesize guilt.", no: "I won't do that to {bud}", yes: 'Hurt {bud} anyway' },
  { q: "Picture yourself tonight, still not done with \"{goal}\". Was this scroll worth it?", no: 'No. Back to work.', yes: 'Yes, I accept my fate' },
];

function show(stage) {
  for (const s of ['main', 'ask', 'wait', 'type', 'proud']) $('stage-' + s).classList.toggle('hidden', s !== stage);
}

function setBud(extraPasses = 0) {
  const health = FB.budHealth({ ...day, passes: day.passes + extraPasses }, settings);
  const mood = FB.budMood(health);
  $('bud').innerHTML = FB.budSVG(mood === 'happy' || mood === 'worried' ? 'sad' : mood, 170); // Bud never smiles on this screen
  return health;
}

function rotateGuilt() {
  const el = $('guilt');
  const next = () => {
    el.style.opacity = 0;
    setTimeout(() => {
      el.textContent = FB.guiltLine(settings.intensity, vars);
      el.style.opacity = 1;
    }, 400);
  };
  el.textContent = FB.guiltLine(settings.intensity, vars);
  clearInterval(guiltTimer);
  guiltTimer = setInterval(next, 6000);
}

async function leave() {
  clearInterval(guiltTimer);
  show('proud');
  $('proudBud').textContent = settings.budName;
  $('title').textContent = 'Good choice.';
  $('guilt').textContent = '';
  $('bud').innerHTML = FB.budSVG('happy', 170);
  if (FB.android) {
    setTimeout(() => FB.android.goHome(), 1500);
  } else if (FB.hasChrome) {
    const tab = await chrome.tabs.getCurrent();
    setTimeout(() => chrome.tabs.update(tab.id, { url: 'chrome://newtab/' }), 1800);
  }
}

function ask(i) {
  if (i >= QUESTIONS.length) return wait();
  show('ask');
  const health = setBud();
  const v = { ...vars, health };
  $('question').textContent = FB.fill(QUESTIONS[i].q, v);
  $('askNo').textContent = FB.fill(QUESTIONS[i].no, v);
  $('askYes').textContent = FB.fill(QUESTIONS[i].yes, v);
  $('askYes').onclick = () => ask(i + 1);
}

// The wait gets longer with every pass used today.
function wait() {
  show('wait');
  document.querySelector('#stage-wait p').textContent = FB.fill('Sit with that decision for a moment. Look at {bud}.', vars);
  setBud(1);
  let left = 15 + day.passes * 15;
  $('countdown').textContent = left;
  const t = setInterval(() => {
    left--;
    $('countdown').textContent = left;
    if (left <= 0) {
      clearInterval(t);
      type();
    }
  }, 1000);
  $('waitLeave').onclick = () => {
    clearInterval(t);
    leave();
  };
}

function type() {
  show('type');
  const phrase = FB.fill('I am choosing {site} over my goal to {goal}, and I am letting {bud} down.', vars);
  $('phrase').textContent = phrase;
  $('unlockSite').textContent = vars.site;
  $('unlockMin').textContent = settings.passMinutes;
  const input = $('typed');
  input.value = '';
  input.focus();
  const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  input.oninput = () => ($('confirm').disabled = norm(input.value) !== norm(phrase));
  input.onpaste = input.ondrop = (e) => {
    e.preventDefault();
    input.classList.remove('shake');
    void input.offsetWidth;
    input.classList.add('shake');
    input.placeholder = 'Nice try. Type it yourself.';
  };
  $('confirm').onclick = grant;
}

async function grant() {
  const snoozes = await FB.get('snoozes', {});
  snoozes[site] = Date.now() + settings.passMinutes * 60 * 1000;
  await FB.set('snoozes', snoozes);
  const fresh = await FB.getDay();
  fresh.passes++;
  await FB.set('day', fresh);
  const stats = await FB.getStats();
  stats.lifetimePasses++;
  await FB.set('stats', stats);

  if (FB.android) {
    FB.android.openApp(site);
  } else if (back && FB.hasChrome) {
    location.href = back;
  } else {
    // Demo mode: nowhere to go back to, so just show the damage.
    day = fresh;
    show('main');
    init();
    $('title').textContent = `Unlocked for ${settings.passMinutes} minutes. ${settings.budName} will remember this.`;
  }
}

async function init() {
  [settings, day] = await Promise.all([FB.getSettings(), FB.getDay()]);
  const siteSec = day.sites[site] || 0;
  const totalSec = FB.totalSeconds(day);
  const focusUntil = await FB.get('focusUntil', 0);
  vars = { site: FB.siteName(settings, site), bud: settings.budName, goal: settings.goal, minutes: Math.round(reason === 'site' ? siteSec / 60 : totalSec / 60) };

  const health = setBud();
  $('title').textContent = FB.fill(TITLES[reason] || TITLES.site, vars);
  if (reason === 'focus') {
    $('title').textContent += ` until ${new Date(focusUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  rotateGuilt();

  $('siteTime').textContent = FB.fmtMin(siteSec);
  $('siteLabel').textContent = `on ${vars.site} today`;
  $('totalTime').textContent = FB.fmtMin(totalSec);
  $('health').textContent = health + '%';
  $('budLabel').textContent = `${settings.budName}'s health`;
  $('goal').textContent = settings.goal;
  if (FB.android) $('startPass').textContent = 'No, I need to open this app anyway…';
  $('leave').textContent = FB.fill("You're right, {bud}. Take me away.", vars);

  const could = FB.couldHave(Math.round(totalSec / 60));
  $('could').classList.toggle('hidden', could.length === 0);
  $('couldList').innerHTML = '';
  for (const c of could) {
    const li = document.createElement('li');
    li.textContent = `${c.icon} ${c.n} ${c.label}`;
    $('couldList').append(li);
  }
}

$('leave').onclick = leave;
$('askNo').onclick = leave;
$('typeLeave').onclick = leave;
$('startPass').onclick = () => ask(0);
init();
