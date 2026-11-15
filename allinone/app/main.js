/* All in One — start-up. Loaded last, after core.js, ui.js and money.js. */
'use strict';

loadState();
applyTheme();
takeNativeResults();
render();
syncNotifications();
let lastMinute = nowHM();
setInterval(() => { const m = nowHM(); if (m !== lastMinute) { lastMinute = m; if (!UI.stack.length && (UI.tab === 'today' || UI.tab === 'cal')) refresh(); } }, 20000);
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); });
if (!S.settings.onboarded) {
  openSheet(`<h2>Halo${S.settings.name ? ', ' + esc(S.settings.name) : ''} 👋</h2>
    <p style="margin-bottom:10px">Semua isi All-in-One sekarang ada di sini: jadwal harian, to-do malam ini & besok, checklist mingguan/bulanan, dan catatanmu.</p>
    <ul class="blist" style="margin-bottom:14px"><li>Kalender udah keisi otomatis dari jadwalmu, seminggu ke depan dan seterusnya.</li><li>Tiap jadwal muncul sebagai notifikasi — jawab <b>Sudah</b> atau <b>Belum</b> langsung dari notifnya.</li><li>Pengingat pagi, siang, sore bisa diubah di tab Lainnya.</li></ul>
    <div class="btnrow">${BRIDGE ? '<button class="btn wide" data-act="askNotif">Aktifkan notifikasi</button>' : ''}<button class="btn ghost wide" data-act="onboardDone">${BRIDGE ? 'Nanti aja' : 'Mulai'}</button></div>`);
  S.settings.onboarded = true; save({ sync: false });
}
