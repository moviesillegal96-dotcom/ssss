#!/usr/bin/env bash
# Builds Planner.apk from planner.html without Gradle, using the Android SDK build tools directly.
# Requires: JDK, android-sdk (aapt, zipalign, apksigner), android-sdk-platform-23, dalvik-exchange, python3-pillow.
set -euo pipefail
cd "$(dirname "$0")"

SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
BT=$(ls -d "$SDK"/build-tools/*/ | grep -v debian | sort -V | tail -1)
PLATFORM_JAR=$(ls "$SDK"/platforms/android-*/android.jar | sort -V | tail -1)
DX=$(command -v d8 || command -v dx || command -v dalvik-exchange)
OUT=build
KEYSTORE=${KEYSTORE:-planner.keystore}

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/res"
rm -rf assets && mkdir -p assets
cp ../planner.html assets/index.html
cp -r res/. "$OUT/res/"
python3 make_icons.py "$OUT/res" ..

"$BT/aapt" package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S "$OUT/res" -I "$PLATFORM_JAR"
javac -nowarn -Xlint:-options --release 8 -classpath "$PLATFORM_JAR" -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java')
"$DX" --dex --output="$OUT/classes.dex" "$OUT/classes"

"$BT/aapt" package -f -M AndroidManifest.xml -S "$OUT/res" -A assets -I "$PLATFORM_JAR" -0 arsc -F "$OUT/unsigned.apk"
(cd "$OUT" && "$BT/aapt" add unsigned.apk classes.dex >/dev/null)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias planner -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass plannerapp -keypass plannerapp -dname "CN=Planner" 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:plannerapp --key-pass pass:plannerapp --v4-signing-enabled false \
  --out ../Planner.apk "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose ../Planner.apk | head -4
echo "Built $(cd .. && pwd)/Planner.apk"
