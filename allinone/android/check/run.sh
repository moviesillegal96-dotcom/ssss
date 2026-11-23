#!/usr/bin/env bash
# Runs the notification code (Notifier, ActionReceiver, AlarmReceiver) against a small stand-in Android.
# The stand-in in check/src/android records notifications and alarms instead of showing them, so the checks
# cover the app's own logic: what is shown when, what the buttons record, follow-ups, alarms. Needs a JDK and curl.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p lib
[ -f lib/json.jar ] || curl -fsSL -o lib/json.jar https://repo1.maven.org/maven2/org/json/json/20231013/json-20231013.jar
rm -rf out && mkdir out
javac -nowarn -cp lib/json.jar -d out $(find src -name '*.java') \
  ../src/com/allinone/app/Notifier.java ../src/com/allinone/app/ActionReceiver.java ../src/com/allinone/app/AlarmReceiver.java
java -cp out:lib/json.jar com.allinone.app.NotifierCheck
