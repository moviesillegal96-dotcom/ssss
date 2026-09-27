# Chess Helper

A chess engine in one file (`chess-helper.html`) for analysing games you play on a real board.

## How to run
**Android app:** download [`ChessHelper.apk`](ChessHelper.apk) to your phone and open it. Android will ask you to allow
installing apps from your browser or file manager; allow it once, then tap **Install**. The app works offline,
keeps the screen on while it's open, and remembers your game if you close it.

**Any browser:** open `chess-helper.html` (desktop or phone). There is nothing to install and it works offline.

## How to use
1. Choose **I play: White / Black**.
2. Enter every move made on the real board, both yours and your opponent's: tap a piece, then tap the square it moves to.
3. With **Auto-analyze** on, the engine thinks after every move:
   - **On your turn:** it shows your best move (green arrow) and the reply it expects from your opponent (red dashed arrow).
   - **On your opponent's turn:** it shows their most dangerous move, so you can see threats coming.
4. The evaluation tells you who is ahead. "White mates in N" means the engine has found a forced mate.
5. Joining a game partway through? Use **Set up position** to place the pieces as they stand on the board, or paste a FEN.

Use **Think** to give the engine more time; longer searches find deeper tactics.

## Notes
- The engine uses alpha-beta search with iterative deepening, a transposition table, quiescence search,
  null-move pruning and late-move reductions. It usually searches 9–12 plies in 3 seconds.
- Using an engine during rated or tournament games is against FIDE and club rules.
  Use it for casual games, practice and post-game analysis.

## Rebuilding the APK
`android/build-apk.sh` builds `ChessHelper.apk` from `chess-helper.html` with the Android SDK build tools
(no Gradle needed). On Ubuntu: `apt install android-sdk android-sdk-platform-23 dalvik-exchange python3-pil`.
The script creates a signing key (`android/chess-helper.keystore`, not committed) on first run. Keep that file:
an APK signed with a different key can't be installed over the old app without uninstalling it first.
