# All in One

A personal daily system as one Android app (and web page). It brings together:

- a **planner** built from an "All-in-One" spreadsheet: today's timeline, a calendar that is filled in advance, to-dos for
  tonight and tomorrow, morning / midday / afternoon reminders, routine checklists, and every note from the workbook,
  organised and searchable;
- **Deadline Notes**: notes with a due date, sorted by how urgent they are;
- **Uang**: the Dompet Planner money planner — a monthly budget in Needs / Wants / Future groups, due dates, one
  safe-to-spend figure per day, shopping and must-do lists, a transaction log and charts.

## Screens
**Hari ini** – greeting, progress ring, the reminder for this part of the day, the most pressing deadlines, *To-do malam ini*
and *To-do besok*, and the day's timeline. Each item can be marked **Sudah** (✓) or **Belum** (✕).

**Kalender** – 7-day strip or month view. Recurring items (daily timetable, after-school checklist, weekly and monthly chores)
come from the workbook, so every day is already planned. Add one-off events or new routines with **＋**; repeat options are once,
daily, weekly, every two weeks, monthly, or unscheduled. Deadlines show on their due date.

**To-Do** – three parts:
- *To-do*: tonight / tomorrow lists and anything left over from yesterday.
- *Deadline*: write a note, pick a date (today, tomorrow, in a week, any date, or none) and optionally mark it "harus cepat".
  Notes are grouped as Telat, Mendesak, Segera, Nanti and Tanpa tanggal, each led by its days-left figure. Done and deleted
  notes can be undone.
- *List*: shortcuts to every checklist in the workbook.

**Uang** – the Dompet Planner money planner, with five pages and a month switcher:
- *Ringkasan*: safe to spend today (balance minus unpaid bills, savings still to set aside and must-do costs, per day left),
  plan vs actual, the goal split (50 / 30 / 20 by default), what is due in the next 14 days, the month's balance chart,
  where the money went, and the last six months.
- *Kalender*: money in and out per day, with marks for what is due, paid or late.
- *Budget*: lines per group (Pemasukan, Kebutuhan, Keinginan, Masa depan) with a planned amount and, optionally, a due day,
  a one-time date, a yearly date or a savings target. Ticking a line logs it as paid or received.
- *List*: Wajib, Perlu dibeli and Side quest, with optional cost and date.
- *Log*: every transaction, searchable and filterable by group.

Budget lines are seeded from the workbook's budget and income tables when it has them. The data keeps Dompet Planner's
shape, so a backup copied from that app (Settings → Copy my data) can be pasted in under the gear button.

**All in 1** – the workbook itself, one tile per sheet: checklists can be ticked, edited and extended; day-by-day tables show one
weekday at a time; grades are entered in the app and averaged per subject; every section takes extra notes; search covers it all.

**Tempel catatan** (from All in 1 or Lainnya) – paste a pile of notes at once. Lines like `*Judul*` start a group, bullets and
plain lines become its items, chat prefixes are dropped. Each group is matched to a section by the words it shares with it;
a preview lets you change the destination, drop items, and send a dated group to the calendar before saving. Works offline.

**Lainnya** – routine manager (change time, days or notifications per item or per group), notification and reminder settings,
theme, backup / restore.

## A1O
A1O is this app with a PIN / password lock, a quick-add button that lets you pick the destination while seeing what is
already there, "Salin" buttons that copy a list in WhatsApp format, extra daily reminders and a longer vibration option
(`app/a1o.js`, `app/a1o.css`). Its data is built by `tools/a1o_data.py` from the workbook (the All in 1 library), the data
file of the previous A1O build (its own Tujuan and Catatan sections) and a backup exported from the app (the starting
to-dos, routines, deadlines, money, reminders and notes). The lock-screen picture (`app/lock-bg.jpg`) is not committed.

```bash
python3 allinone/tools/a1o_data.py All-in-One.xlsx a1o-data.js a1o-backup.json allinone/app/data.js
cd allinone/android && APP_ID=com.allinone.demo APP_LABEL=A1O OUT_APK=../A1O.apk ./build-apk.sh
```

**All in 1** shows each section as a short list (`app/library.js`): one folded group per heading with its line count and
first line, lines cut to three until tapped, large groups cut after 12 lines until "Lihat semua". The wording is the
workbook's own. "Lengkap" switches to the full view.

## Notifications (Android app)
Each scheduled block appears at its time as a notification with **✓ Sudah / ✗ Belum / Sudah semua** buttons. A block with
several items steps through them one at a time, so the whole list can be answered from the notification without opening the app;
the answers show up in the lists afterwards. Items answered *Belum* come back once more after a snooze (default 30 minutes).

- Morning, midday and afternoon reminders are plain notifications with editable texts and separate weekday / weekend times.
- To-dos for tonight are announced in the evening, to-dos for tomorrow in the morning.
- A deadline is announced the evening before, and every morning from its due date until it is ticked off.
- A bill is announced the day before, on its due day, and one and three days late; answering *Sudah* logs the payment.
  Expected income and dated list items are announced on their day. An optional evening nudge asks to log the day's spending.

The page computes the next 30 days of notifications and hands them to `Notifier`, which keeps one alarm set for the earliest
entry, shows what is due, and stores the answers until the page collects them. Opening the app refreshes the list, so it should
be opened at least once a month.

Everything is stored on the device only. **Lainnya → Simpan backup** writes a file that can be restored after a reinstall.

## Building the planner from a workbook
The app is generic; its content comes from `app/data.js`, which is generated and **not committed** (it holds personal notes):

```bash
python3 allinone/tools/xlsx2data.py All-in-One.xlsx allinone/app/data.js --seed seed.json
```

The converter reads the workbook as a document: `═══ NAME ═══` rows start a section, styled rows become headings, bullet rows
become lists, tables with a status column become checklists, grids with day columns 1–31 become routine tasks, and a
`JAM | SENIN … MINGGU` table becomes the daily timetable. The optional seed file adds what the workbook does not contain:

```json
{
  "reminders": [{"id": "pagi", "label": "Pagi", "icon": "🌅", "time": "05:30", "timeWE": "08:00", "lines": ["…"]}],
  "tasks": [{"title": "…", "time": "15:00", "group": "Sosial", "rep": {"k": "nw", "n": 2, "days": [6]}}],
  "additions": [{"section": "study/study", "title": "…", "items": ["…"]}]
}
```

Reminder ids `pagi`, `siang`, `sore` are the three daily reminders. A task with a `"key"` is also added to an app that is
already installed when it is updated. `additions` append a heading and a list of notes to a section (by section id). Task repeats: `{"k":"d"}` daily, `{"k":"w","days":[1-7]}`
weekly (1 = Monday), `{"k":"nw","n":2,"days":[…]}` every n weeks, `{"k":"m","dom":15}` monthly, `{"k":"once","date":"YYYY-MM-DD"}`.

Without `app/data.js` the app still runs, with an empty library and default reminders. Open `app/index.html` in a browser to use
it there; notifications with buttons need the Android app.

## Demo build
`tools/demo_data.py` writes `app/data-demo.js`, a library of made-up content (a fictional student, school, notes, links to
public sites) plus sample to-dos, deadlines, grades and money that are added on first start with dates relative to that day.
It holds no personal data and is committed. Build it as a separate app that installs next to the real one:

```bash
cd allinone/android
DATA_JS=../app/data-demo.js APP_ID=com.allinone.demo APP_LABEL="All in One Demo" OUT_APK=../AllInOne-Demo.apk ./build-apk.sh
```

## Building the APK
`android/build-apk.sh` builds `allinone/AllInOne.apk` from `app/` using the Android SDK build tools directly (no Gradle).
On Ubuntu: `apt install android-sdk android-sdk-platform-23 dalvik-exchange python3-pil`. The Java code is compiled against the
Android 14 API; the script downloads that jar from Maven Central into `android/libs/` once. The APK is not committed because it
contains `app/data.js`.

The script creates a signing key (`android/allinone.keystore`, not committed) on first run. Keep that file and put it back
before the next build: an APK signed with a different key can't be installed over the old app without uninstalling it first,
and uninstalling removes the app's data (restore it from a backup file).

## Checking the notification code
`android/check/run.sh` compiles `Notifier`, `ActionReceiver` and `AlarmReceiver` against a small stand-in Android
(`android/check/src/android`) that records notifications and alarms instead of showing them, and runs through the cases:
what is shown when, what each button records, follow-ups after *Belum*, items ticked in the app meanwhile, dismissal,
reboot, and phones that do not allow exact alarms. It checks the app's own logic, not Android itself.

## Fonts
Bricolage Grotesque and Figtree, bundled in `app/fonts/` so the app needs no network. Both are under the SIL Open Font License 1.1.
