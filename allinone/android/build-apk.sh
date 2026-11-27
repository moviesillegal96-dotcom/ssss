#!/usr/bin/env bash
# Builds AllInOne.apk (the All in One planner) without Gradle, using the Android SDK build tools directly.
# Requires: JDK, android-sdk (aapt, zipalign, apksigner), android-sdk-platform-23, dalvik-exchange, python3-pillow, curl.
set -euo pipefail
cd "$(dirname "$0")"

SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
BT=$(ls -d "$SDK"/build-tools/*/ | grep -v debian | sort -V | tail -1)
PLATFORM_JAR=$(ls "$SDK"/platforms/android-*/android.jar | sort -V | tail -1)
DX=$(command -v d8 || command -v dx || command -v dalvik-exchange)
OUT=build
KEYSTORE=${KEYSTORE:-allinone.keystore}
# A second app can be built from the same code, e.g. the demo with made-up data:
#   DATA_JS=../app/data-demo.js APP_ID=com.allinone.demo APP_LABEL="All in One Demo" OUT_APK=../AllInOne-Demo.apk ./build-apk.sh
DATA_JS=${DATA_JS:-../app/data.js}
APP_ID=${APP_ID:-com.allinone.app}
APP_LABEL=${APP_LABEL:-All in One}
OUT_APK=${OUT_APK:-../AllInOne.apk}

# The Java code uses notification channels and exact-alarm checks (API 26-34), which the Debian platform jar
# (API 23) does not have. Robolectric's android-all jar on Maven Central carries the full Android 14 API.
API_JAR=libs/android-all-14.jar
if [ ! -f "$API_JAR" ]; then
  mkdir -p libs
  curl -fsSL -o "$API_JAR" \
    https://repo1.maven.org/maven2/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar
fi

if [ ! -f "$DATA_JS" ]; then
  echo "note: app/data.js not found - building an empty planner. Create it with allinone/tools/xlsx2data.py." >&2
fi

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/res"
rm -rf assets && mkdir -p assets
cp ../app/index.html ../app/app.css ../app/core.js ../app/ui.js ../app/library.js ../app/schedule.js ../app/money.js ../app/paste.js ../app/main.js ../app/a1o.js ../app/bin.js ../app/a1o.css ../app/notion.css ../app/money.css assets/
# The lock-screen picture is someone's artwork: kept out of the repository, bundled when it is there.
if [ -f ../app/lock-bg.jpg ]; then cp ../app/lock-bg.jpg assets/; fi
cp -r ../app/fonts assets/fonts
if [ -f "$DATA_JS" ]; then cp "$DATA_JS" assets/data.js; else echo 'window.AIO_DATA = { sheets: [], seeds: {} };' > assets/data.js; fi
cp -r res/. "$OUT/res/"
python3 make_icons.py "$OUT/res"
# The original A1O icon is someone's artwork too: kept out of the repository, used instead of the drawn one when it is there.
if [ -d icons ]; then cp -r icons/. "$OUT/res/"; fi
printf '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">%s</string>\n</resources>\n' "$APP_LABEL" > "$OUT/res/values/strings.xml"

"$BT/aapt" package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S "$OUT/res" -I "$PLATFORM_JAR"
javac -nowarn -Xlint:-options --release 8 -classpath "$API_JAR" -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java')
"$DX" --dex --output="$OUT/classes.dex" "$OUT/classes"

"$BT/aapt" package -f -M AndroidManifest.xml --rename-manifest-package "$APP_ID" -S "$OUT/res" -A assets -I "$PLATFORM_JAR" \
  -0 arsc -0 woff2 -F "$OUT/unsigned.apk"
(cd "$OUT" && "$BT/aapt" add unsigned.apk classes.dex >/dev/null)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# KEYSTORE can also be a .p12 file (e.g. the A1O signing key); its password goes in KS_PASS.
KS_PASS=${KS_PASS:-allinone}
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias allinone -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=All in One" 2>/dev/null
fi
KS_TYPE=()
case "$KEYSTORE" in *.p12|*.pfx) KS_TYPE=(--ks-type PKCS12) ;; esac
"$BT/apksigner" sign --ks "$KEYSTORE" "${KS_TYPE[@]}" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --v4-signing-enabled false \
  --out "$OUT_APK" "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT_APK" | head -4
echo "Built $(cd "$(dirname "$OUT_APK")" && pwd)/$(basename "$OUT_APK")"
