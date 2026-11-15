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

# The Java code uses notification channels and exact-alarm checks (API 26-34), which the Debian platform jar
# (API 23) does not have. Robolectric's android-all jar on Maven Central carries the full Android 14 API.
API_JAR=libs/android-all-14.jar
if [ ! -f "$API_JAR" ]; then
  mkdir -p libs
  curl -fsSL -o "$API_JAR" \
    https://repo1.maven.org/maven2/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar
fi

if [ ! -f ../app/data.js ]; then
  echo "note: app/data.js not found - building an empty planner. Create it with allinone/tools/xlsx2data.py." >&2
fi

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/res"
rm -rf assets && mkdir -p assets
cp ../app/index.html ../app/app.css ../app/core.js ../app/ui.js assets/
cp -r ../app/fonts assets/fonts
if [ -f ../app/data.js ]; then cp ../app/data.js assets/; else echo 'window.AIO_DATA = { sheets: [], seeds: {} };' > assets/data.js; fi
cp -r res/. "$OUT/res/"
python3 make_icons.py "$OUT/res"

"$BT/aapt" package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S "$OUT/res" -I "$PLATFORM_JAR"
javac -nowarn -Xlint:-options --release 8 -classpath "$API_JAR" -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java')
"$DX" --dex --output="$OUT/classes.dex" "$OUT/classes"

"$BT/aapt" package -f -M AndroidManifest.xml -S "$OUT/res" -A assets -I "$PLATFORM_JAR" \
  -0 arsc -0 woff2 -F "$OUT/unsigned.apk"
(cd "$OUT" && "$BT/aapt" add unsigned.apk classes.dex >/dev/null)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias allinone -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass allinone -keypass allinone -dname "CN=All in One" 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:allinone --key-pass pass:allinone --v4-signing-enabled false \
  --out ../AllInOne.apk "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose ../AllInOne.apk | head -4
echo "Built $(cd .. && pwd)/AllInOne.apk"
