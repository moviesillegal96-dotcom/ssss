#!/usr/bin/env bash
# Builds FocusBud.apk without Gradle, using the Android SDK build tools directly.
# Requires: JDK, android-sdk (aapt, zipalign, apksigner), android-sdk-platform-23, dalvik-exchange, python3-pillow.
set -euo pipefail
cd "$(dirname "$0")"

SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
BT=$(ls -d "$SDK"/build-tools/*/ | grep -v debian | sort -V | tail -1)
PLATFORM_JAR=$(ls "$SDK"/platforms/android-*/android.jar | sort -V | tail -1)
DX=$(command -v d8 || command -v dx || command -v dalvik-exchange)
OUT=build
KEYSTORE=${KEYSTORE:-focusbud.keystore}

rm -rf "$OUT" assets && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/res" assets
# The same pages the browser extension uses.
cp ../common.js ../style.css ../popup.html ../popup.js ../options.html ../options.js ../blocked.html ../blocked.js assets/
cp -r res/. "$OUT/res/"
python3 make_icons.py "$OUT/res"

"$BT/aapt" package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S "$OUT/res" -I "$PLATFORM_JAR"
javac -nowarn -Xlint:-options --release 8 -classpath "$PLATFORM_JAR" -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java')
"$DX" --dex --output="$OUT/classes.dex" "$OUT/classes"

"$BT/aapt" package -f -M AndroidManifest.xml -S "$OUT/res" -A assets -I "$PLATFORM_JAR" -0 arsc -F "$OUT/unsigned.apk"
(cd "$OUT" && "$BT/aapt" add unsigned.apk classes.dex >/dev/null)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias focusbud -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass focusbud -keypass focusbud -dname "CN=FocusBud" 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:focusbud --key-pass pass:focusbud --v4-signing-enabled false \
  --out ../FocusBud.apk "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose ../FocusBud.apk | head -4
echo "Built $(cd .. && pwd)/FocusBud.apk"
