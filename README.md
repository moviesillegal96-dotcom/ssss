# Chess Helper

A chess assistant for games you play on a real board: enter the moves, and it tells you the best move,
predicts your opponent, warns you about blunders and mates, and reviews the game afterwards.

## How to run
**Android app:** download [`ChessHelper.apk`](ChessHelper.apk) to your phone and open it. Android will ask you to allow
installing apps from your browser or file manager; allow it once, then tap **Install**. The app works offline,
keeps the screen on while it's open, and remembers your game if you close it.

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
`android/build-apk.sh` builds `ChessHelper.apk` from `chess-helper.html` and `stockfish/` using the Android SDK
build tools directly (no Gradle). On Ubuntu: `apt install android-sdk android-sdk-platform-23 dalvik-exchange python3-pil`.
The script creates a signing key (`android/chess-helper.keystore`, not committed) on first run. Keep that file:
an APK signed with a different key can't be installed over the old app without uninstalling it first.

The app serves its files from `https://appassets.androidplatform.net/`, which is intercepted and never touches the
network, so Web Workers, WebAssembly and the camera work inside the WebView.
