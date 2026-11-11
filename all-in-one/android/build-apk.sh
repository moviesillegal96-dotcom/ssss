#!/usr/bin/env bash
# Builds the All-in-One APK without Gradle, using the Android SDK build tools directly.
#   ./build-apk.sh [page.html] [out.apk]
# With no arguments it packages ../all-in-one.html (the empty app) as ../AllInOne.apk.
# Requires: JDK, android-sdk (aapt, zipalign, apksigner), android-sdk-platform-23, dalvik-exchange, python3-pil.
set -euo pipefail
PAGE=$(realpath "${1:-$(dirname "$0")/../all-in-one.html}")
APK=$(realpath -m "${2:-$(dirname "$0")/../AllInOne.apk}")
cd "$(dirname "$0")"

SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
BT=$(ls -d "$SDK"/build-tools/*/ | grep -v debian | sort -V | tail -1)
PLATFORM_JAR=$(ls "$SDK"/platforms/android-*/android.jar | sort -V | tail -1)
DX=$(command -v d8 || command -v dx || command -v dalvik-exchange)
OUT=build
KEYSTORE=${KEYSTORE:-all-in-one.keystore}

mkdir -p "$OUT" assets
find "$OUT" assets -mindepth 1 -delete
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/res"
cp "$PAGE" assets/index.html
cp -r res/. "$OUT/res/"
python3 make_icons.py "$OUT/res"

"$BT/aapt" package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S "$OUT/res" -I "$PLATFORM_JAR"
javac -nowarn -Xlint:-options --release 8 -classpath "$PLATFORM_JAR" -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java')
"$DX" --dex --output="$OUT/classes.dex" "$OUT/classes"

"$BT/aapt" package -f -M AndroidManifest.xml -S "$OUT/res" -A assets -I "$PLATFORM_JAR" -0 arsc -F "$OUT/unsigned.apk"
(cd "$OUT" && "$BT/aapt" add unsigned.apk classes.dex >/dev/null)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# Keep the keystore: an update signed with a different key can't be installed over the old app.
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias allinone -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass allinone -keypass allinone -dname "CN=All-in-One" 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:allinone --key-pass pass:allinone --v4-signing-enabled false \
  --out "$APK" "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose "$APK" | head -4
echo "Built $APK"
