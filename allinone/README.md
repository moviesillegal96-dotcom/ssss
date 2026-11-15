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

**Lainnya** – routine manager (change time, days or notifications per item or per group), notification and reminder settings,
theme, backup / restore.

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
  "tasks": [{"title": "…", "time": "15:00", "group": "Sosial", "rep": {"k": "nw", "n": 2, "days": [6]}}]
}
```

Reminder ids `pagi`, `siang`, `sore` are the three daily reminders. Task repeats: `{"k":"d"}` daily, `{"k":"w","days":[1-7]}`
weekly (1 = Monday), `{"k":"nw","n":2,"days":[…]}` every n weeks, `{"k":"m","dom":15}` monthly, `{"k":"once","date":"YYYY-MM-DD"}`.

Without `app/data.js` the app still runs, with an empty library and default reminders. Open `app/index.html` in a browser to use
it there; notifications with buttons need the Android app.

## Building the APK
`android/build-apk.sh` builds `allinone/AllInOne.apk` from `app/` using the Android SDK build tools directly (no Gradle).
On Ubuntu: `apt install android-sdk android-sdk-platform-23 dalvik-exchange python3-pil`. The Java code is compiled against the
Android 14 API; the script downloads that jar from Maven Central into `android/libs/` once. The APK is not committed because it
contains `app/data.js`.

The script creates a signing key (`android/allinone.keystore`, not committed) on first run. Keep that file and put it back
before the next build: an APK signed with a different key can't be installed over the old app without uninstalling it first,
and uninstalling removes the app's data (restore it from a backup file).

## Fonts
Bricolage Grotesque and Figtree, bundled in `app/fonts/` so the app needs no network. Both are under the SIL Open Font License 1.1.
