# All in One

One Android app (and web page) that holds two things:

- **All in One planner** – a personal daily system built from an "All-in-One" spreadsheet: today's timeline, a calendar that is
  filled in advance, to-dos for tonight and tomorrow, morning / midday / afternoon reminders, routine checklists, and every note
  from the workbook, organised and searchable.
- **Chess Helper** – the chess assistant described further down. It lives inside the same app (tab **Lainnya → Chess Helper**).

## The planner
**Hari ini** – greeting, progress ring, the reminder for this part of the day, *To-do malam ini* and *To-do besok*, and the day's
timeline. Each item can be marked **Sudah** (✓) or **Belum** (✕).

**Kalender** – 7-day strip or month view. Recurring items (daily timetable, after-school checklist, weekly and monthly chores)
come from the workbook, so every day is already planned. Add one-off events or new routines with **＋**; repeat options are once,
daily, weekly, every two weeks, monthly, or unscheduled.

**Notifications (Android app)** – each scheduled block appears at its time as a notification with **✓ Sudah / ✗ Belum /
Sudah semua** buttons. A block with several items steps through them one at a time, so the whole list can be answered from the
notification without opening the app; the answers show up in the lists afterwards. Items answered *Belum* come back once more
after a snooze (default 30 minutes). Morning, midday and afternoon reminders are plain notifications with editable texts and
separate times for weekdays and weekends. To-dos for tonight are announced in the evening, to-dos for tomorrow in the morning.

**To-Do** – tonight / tomorrow lists, anything left over from yesterday, and shortcuts to every checklist in the workbook.

**All in 1** – the workbook itself, one tile per sheet: checklists can be ticked, edited and extended; day-by-day tables show one
weekday at a time; grades are entered in the app and averaged per subject; an empty income / expense table becomes a money log
with account balances; every section takes extra notes; search covers it all.

**Lainnya** – Chess Helper, routine manager (change time, days or notifications per item or per group), notification and reminder
settings, theme, backup / restore.

Everything is stored on the device only. **Lainnya → Simpan backup** writes a file that can be restored after a reinstall.

### Building the planner from a workbook
The app is generic; its content comes from `app/data.js`, which is generated and **not committed** (it holds personal notes):

```bash
python3 tools/xlsx2data.py All-in-One.xlsx app/data.js --seed seed.json
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

# Chess Helper

A chess assistant for games you play on a real board: enter the moves, and it tells you the best move,
predicts your opponent, warns you about blunders and mates, and reviews the game afterwards.

## How to run
**Android app:** it is part of the All in One app (**Lainnya → Chess Helper**). [`ChessHelper.apk`](ChessHelper.apk) is the
earlier stand-alone build and still works on its own. Android will ask you to allow installing apps from your browser or file
manager; allow it once, then tap **Install**. The app works offline, keeps the screen on while the board is open, and remembers
your game if you close it.

**Any browser:** open `chess-helper.html`. Opened as a local file it uses the built-in engine; served over http(s)
next to the `stockfish/` folder it uses Stockfish too.

## Features
**Entering moves**
- Tap a piece, then its destination.
- **🎤 Voice:** say "knight f3", "e4", "bishop takes c6", "castle kingside", "e8 promote to queen".
- **Typed moves:** `e4`, `Nf3`, `O-O`, or plain words like `knight f3`.
- **📷 Camera move detection:** hold the phone above the board, line up the grid, tap *Set reference*. After each move the app
  compares every square and suggests the move it sees for you to accept. It works best top-down with even lighting;
  always check the suggestion.
- **Set up position** or paste a FEN to start from any position.

**Engine**
- **Stockfish 19** in the Android app (far stronger than any human player), with the built-in engine as a fallback.
- **Top 3 moves** with their lines and scores, plus the reply the engine expects (arrows on the board).
- **Opening book:** names the opening (111 lines: Sicilian, Ruy Lopez, Queen's Gambit, …) and shows the main book moves.
- **Endgame knowledge** in the built-in engine: unstoppable passed pawns (rule of the square), drawn material, mating a lone king.

**While you play**
- **Mate alerts** (sound + vibration): checkmate, forced mate for you ("Checkmate in 1! Play Rd8#"), your opponent threatening mate.
- **Blunder check:** "Opponent blundered! Punish it with Nxg5", or a warning when your move threw away the advantage.
- **Hint mode:** clues first ("Look for a fork"), then the piece to move, then the answer only if you ask.
- **🔊 Speak the best move** out loud (Android text-to-speech).
- **Chess clock** with presets (1, 3|2, 5, 5|3, 10, 10|5, 15|10, 30 min); switches when a move is entered.

**After the game**
- **Game review:** accuracy for each side, an evaluation graph, and every move marked Best / Excellent / Good /
  Inaccuracy / Mistake / Blunder / Book. Tap a move to see the position with the move played (blue) and the best move (green).
- **Saved games:** finished games are saved automatically. Share or copy them as **PGN** (opens in Lichess/Chess.com), or import a PGN.

**Look**
- 6 board themes, 3 piece sets (Classic, Staunty, Simple), dark mode, and a **Big board** mode.

## Notes
- Using an engine during rated or tournament games breaks FIDE and club rules. Use it for casual games, practice and analysis.
- The Android back button closes review, setup, camera and big-board mode before leaving the app.

## Credits and licenses
- Stockfish 19 (WebAssembly build by nmrugg/stockfish.js), GPLv3; see `stockfish/`.
- "Classic" pieces by Cburnett, CC BY-SA 3.0. "Staunty" pieces from Lichess, CC BY-NC-SA 4.0 (non-commercial).
  Both come via cm-chessboard.

## Rebuilding the APK
`android/build-apk.sh` builds `AllInOne.apk` (planner + chess helper) from `app/`, `chess-helper.html` and `stockfish/` using the
Android SDK build tools directly (no Gradle). On Ubuntu: `apt install android-sdk android-sdk-platform-23 dalvik-exchange python3-pil`.
The Java code is compiled against the Android 14 API; the script downloads that jar from Maven Central into `android/libs/` once.
The APK is not committed because it contains `app/data.js`.

The script creates a signing key (`android/allinone.keystore`, not committed) on first run. Keep that file and put it back
before the next build: an APK signed with a different key can't be installed over the old app without uninstalling it first,
and uninstalling removes the planner's data (restore it from a backup file).

The app serves its files from `https://appassets.androidplatform.net/`, which is intercepted and never touches the
network, so Web Workers, WebAssembly and the camera work inside the WebView.

How the notifications work: the page computes the next 30 days of notifications and hands them to `Notifier`, which keeps one
alarm set for the earliest entry, shows what is due, and stores the answers until the page collects them. Opening the app
refreshes the list, so it should be opened at least once a month.
