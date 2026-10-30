# FocusBud 🌱

FocusBud blocks social media once you've used up the daily screen time **you** set. The only thing enforcing it
is guilt. Your plant, Bud, starts each day healthy. It wilts and cries when you go over your limit, and it makes
you work hard to get past the block.

It comes in two versions that share the same screens:

- **Android app** ([`FocusBud.apk`](FocusBud.apk)): blocks the real Instagram, TikTok, YouTube, X, Facebook,
  Reddit, Snapchat and Threads apps, plus any other app you add.
- **Browser extension** (this folder) for Chrome, Edge and Brave: blocks the same sites on the web.

## Install

**Android**
1. Download [`FocusBud.apk`](FocusBud.apk) to your phone and open it. Allow installing apps from your browser or file
   manager when Android asks, then tap **Install**.
2. Open FocusBud and tap **Open Accessibility settings**. Find FocusBud and turn it on. FocusBud only uses this to
   see *which app* is open. It never reads what's on your screen.
3. If the switch is greyed out ("Restricted setting", Android 13+): open **App info** from FocusBud. Tap the ⋮ menu,
   choose **Allow restricted settings**, and go back to step 2.

**Browser extension**
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `focusbud` folder. The settings page opens by itself.

**Just looking (no install):** open `index.html` in any browser. It links to the dashboard, the settings and the
block screen. Nothing is really blocked in this mode.

## How it works
- **Your limits:** a daily total for all blocked apps/sites combined, plus a limit for each one. Only time spent with
  the app or tab in front of you counts.
- **The block screen:** when you hit a limit, Bud takes over the screen. You see how long you've scrolled, what you
  could have done with that time (pages read, km walked, homework problems…), and the goal you wrote in settings.
- **Guilt passes:** you *can* get through, but only by:
  1. answering three "are you sure?" questions,
  2. waiting out a countdown (15 s, then 15 s longer for every pass you've already used today),
  3. typing a confession like *"I am choosing Instagram over my goal to finish the school project, and I am letting
     Bud down."* Pasting it in doesn't work.

  Each pass unlocks the app for a few minutes and takes 20% off Bud's health.
- **Guilt level:** Gentle (a disappointed friend), Medium (a disappointed parent) or Savage (no mercy).
- **Focus sessions:** block everything on your list for 25, 50 or 90 minutes.
- **Streaks:** a day counts if you stay under every limit and use no guilt passes. Raising your own limits triggers
  a guilt trip too.
- **Private:** everything is stored on your device. No accounts, no servers.

## Files
| File | What it does |
| --- | --- |
| `common.js` | Shared logic: settings, daily usage, Bud's health and face, guilt messages |
| `popup.html/js` | Dashboard: Bud, today's screen time, focus sessions (the app's home screen) |
| `options.html/js` | Settings: limits, blocked sites/apps, goal, guilt level, 14-day history |
| `blocked.html/js` | The guilt-trip block screen and the guilt-pass steps |
| `background.js`, `manifest.json` | Extension only: counts time on each site and redirects when a limit is reached |
| `android/` | Android app: `GuardService` watches which app is open and counts time, `BlockActivity` shows the block screen, `Store` keeps the data |

## Building the APK
On Debian/Ubuntu:

```bash
sudo apt-get install android-sdk android-sdk-platform-23 dalvik-exchange python3-pil default-jdk
```

```bash
focusbud/android/build-apk.sh
```

The script copies the web pages into the app and writes `focusbud/FocusBud.apk`, signed with a local key it
creates the first time. Rebuilding on a different computer creates a different key, so uninstall the old app
before installing the new APK.
