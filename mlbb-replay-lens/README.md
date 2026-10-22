# MLBB Replay Lens

A Mobile Legends: Bang Bang match analyzer. Screen-record a replay, mark the minimap, and it follows both teams
through the whole match: teamfights, ganks, jungle invasions, rotations, objective timings and deaths. Then it
picks out the patterns that repeat, within one match and across all the matches you save.

It is one HTML file with no dependencies. Open `index.html` in Chrome (phone or desktop). Everything runs on your
device and the video is never uploaded. It opens on a simulated demo match so you can see what it does first.

## Why a screen recording and not the replay file
Mobile Legends stores replays in its own encrypted, undocumented format, so no outside tool can read them directly.
The minimap in a recording shows the same information: where all ten heroes are, every second of the game.

## Using it
1. **Record:** play the replay in Mobile Legends (Profile → Battle History) and screen-record it in landscape. Keep the
   minimap uncovered. Note the replay speed (1× or 2×).
2. **Load** the video and drag a square over the minimap (top-left corner).
3. **Set the clock:** pause on a frame, type the in-game timer you see (e.g. `0:05`), press **Set**. Pick the replay speed.
   Use **From / To** to skip the draft and the victory screen.
4. **Check colors:** the detection preview circles every hero it finds. If it misses some, press *Tap a blue hero* /
   *Tap a red hero* and tap a hero ring on the video. *Fine-tune detection* has the thresholds.
5. **Analyze.** A 15-minute match at 1 sample per second takes one to three minutes on a phone.
6. **Save to library.** From the second saved match on, *Across your matches* compares games.

## What it recognizes
| Pattern | How |
|---|---|
| Hero positions | Team-colored ring markers found by hue on the minimap. Small dots (minions) are dropped by size, turrets and base icons because they never move. |
| Deaths | A dead hero vanishes from the minimap. A death only counts once that hero is seen respawning at the fountain, which rules out markers that just stacked up in a fight, and recalls. |
| Hidden heroes | Every living hero is somewhere on the map, so heroes missing from the count are put back into the biggest stacks. |
| Teamfights | 3+ heroes of each team converge on one spot. The result is the deaths on each side. |
| Ganks | A team arrives and outnumbers an enemy in a lane or jungle. Marked successful if the target dies. |
| Objectives | Group visits to the Lord and Turtle pits: contested or uncontested, and who was ahead. |
| Invasions | 2+ heroes in the enemy jungle. |
| Rotations | A group of 3+ moving from one zone to another. |
| Lane setup and jungle route | Who stood where from 0:45 to 2:30, and the early path of each jungler. |
| Formations | Each second, each team's five heroes are sorted into zones (lanes, own/enemy jungle, river, base, dead), then clustered with k-means. You get the recurring shapes, how often they happen, and which shape usually follows. |
| Turrets | Turret icons are the colored markers that never move. When one stops showing, the turret fell: who took it, and whether anyone defended. |
| Lord & Turtle threat | Every second, each team gets a score for each pit: heroes near it, heroes walking toward it, more heroes alive, enemies far away, a fight or pick just won, and whether the objective has spawned. A high score raises a warning, and the app reports how many real plays it warned about and how early. |
| Signs before objectives | For every Lord/Turtle play: how early the first hero showed up, how fast the team gathered, the alive count, what came right before (won fight, pick, turret), where the other team's group was, and timing against the spawn. The repeated signs become a "signs to watch for" list. |
| What they protect | Seconds spent guarding a turret under attack, their jungle with invaders in it, an objective area, the base, or a laner kept company (two heroes together in a lane early). |
| Playbook | What a team did in the 50 s after winning or losing a fight, a pick, an objective or a turret: go for Lord/Turtle, push a turret, gank, invade, group, reset or hold. The minimap replay shows what that predicts at any moment. |
| Macro score | Map play, 0–100: map control (share of the map closer to each team's heroes, by phase), won fights and picks turned into Lord/Turtle/turrets, objective and turret trades, enemy objectives left unanswered and how fast the team shows up, fights taken with fewer heroes alive, time spent dead. |
| Micro score | Execution, 0–100: fights won (including outplays with fewer heroes and throws with more), kills vs deaths, deaths caught alone, deaths deep in enemy territory, seconds between the first and third hero reaching a fight, gank kills and ganks that backfired, ganks survived, teammates coming to help. |
| Coaching | Tips for your team ("4 deaths with no teammate nearby, mostly bottom lane") and openings against the opponent ("Red arrives at fights one by one: start early"), each with clickable times. Across saved matches: macro/micro averages and the mistakes that repeat. |
| Habits | Favorite gank lane, repeated invasions, steady gank timing (e.g. "about every 3:10"), fights lost at the same place, grouping vs split-pushing late. |

## Limits
- Accuracy depends on the recording. Use 720p or higher, landscape, minimap visible all the time.
- Hero identities are not tracked. It works at team level: it knows "two Red heroes", not "Ling and Tigreal".
- Deaths still on a respawn timer when the recording ends are not counted. In big fights the death time can be a few
  seconds off.
- Spawn times are settings in step 2 (default: Turtle 2:00, Lord 8:00). Check them against the current patch.
- Macro and micro are measured from the minimap only. Last hits, skill accuracy, items and gold are not visible
  there, so micro here means positioning and fight execution, not mechanics.
- Predictions come from the patterns seen so far. One match gives a few examples each, so read them as tendencies.
  Saving several matches against the same opponents makes them more reliable.
- The map zones (lanes, river, jungles) are fixed proportions of the minimap square. If the Lord and Turtle pits are
  elsewhere in your recording, tap **Set Lord pit / Set Turtle pit** on the preview.
- If you record your own replay, your own hero may have a green ring. Set *Your own hero's green marker counts as* in
  *Fine-tune detection*.
