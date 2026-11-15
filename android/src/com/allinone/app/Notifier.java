package com.allinone.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;

/**
 * Shows the planner's notifications and records the answers given from them.
 *
 * The page hands over a queue of entries ({id, at, title, body | items}). One alarm is set for the
 * earliest entry; when it fires, every entry that is due is shown and the alarm moves to the next one.
 * An entry with items is a checklist: the notification shows one item at a time with "Sudah" / "Belum"
 * buttons, so a whole block can be answered without opening the app. Answers are kept in "results"
 * until the page collects them.
 */
final class Notifier {
    static final String ACTION_ALARM = "com.allinone.app.ALARM";
    static final String ACTION_ANSWER = "com.allinone.app.ANSWER";
    private static final String PREFS = "aio";
    private static final String CH_TASKS = "tasks";
    private static final String CH_REMINDERS = "reminders";
    /** Entries that became due longer ago than this (phone was off) are dropped instead of shown late. */
    private static final long STALE_MS = 3 * 60 * 60 * 1000L;
    private static final int MAX_ACTIVE = 40;
    private static final int COLOR = 0xFF2F4FA3;

    private Notifier() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---------- queue ----------

    /** Replaces the queue with the one the page computed, keeping follow-ups that are still waiting. */
    static synchronized void setQueue(Context c, String json) {
        SharedPreferences p = prefs(c);
        try {
            JSONObject o = new JSONObject(json);
            JSONArray incoming = o.optJSONArray("queue");
            JSONArray doneKeys = o.optJSONArray("done");
            List<String> done = new ArrayList<>();
            if (doneKeys != null) for (int i = 0; i < doneKeys.length(); i++) done.add(doneKeys.optString(i));

            long now = System.currentTimeMillis();
            List<JSONObject> merged = new ArrayList<>();
            for (JSONObject e : readList(p, "queue")) {
                if (e.optInt("f") != 1 || e.optLong("at") <= now) continue;
                JSONArray left = new JSONArray();
                JSONArray items = e.optJSONArray("items");
                for (int i = 0; items != null && i < items.length(); i++) {
                    JSONObject it = items.optJSONObject(i);
                    if (it != null && !done.contains(it.optString("k"))) left.put(it);
                }
                if (left.length() > 0) {
                    e.put("items", left);
                    merged.add(e);
                }
            }
            for (int i = 0; incoming != null && i < incoming.length(); i++) {
                JSONObject e = incoming.optJSONObject(i);
                if (e != null) merged.add(e);
            }
            sort(merged);
            p.edit().putString("queue", new JSONArray(merged).toString())
                    .putInt("snooze", o.optInt("snooze", 30))
                    .putBoolean("on", o.optBoolean("on", true)).apply();
        } catch (JSONException e) {
            return;
        }
        fireDue(c);
    }

    /** Shows everything that is due and sets the alarm for the next entry. */
    static synchronized void fireDue(Context c) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis();
        boolean on = p.getBoolean("on", true);
        List<JSONObject> rest = new ArrayList<>();
        for (JSONObject e : readList(p, "queue")) {
            long at = e.optLong("at");
            if (at > now + 1000) {
                rest.add(e);
            } else if (on && now - at < STALE_MS) {
                show(c, p, e);
            }
        }
        p.edit().putString("queue", new JSONArray(rest).toString()).apply();
        schedule(c, rest.isEmpty() || !on ? 0 : rest.get(0).optLong("at"));
    }

    private static void schedule(Context c, long at) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_ALARM);
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | immutable());
        am.cancel(pi);
        if (at <= 0) return;
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException e) {
            am.set(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    // ---------- showing ----------

    private static void show(Context c, SharedPreferences p, JSONObject e) {
        ensureChannels(c);
        int nid = e.optString("id").hashCode();
        JSONArray items = e.optJSONArray("items");
        if (items == null || items.length() == 0) {
            String body = e.optString("body");
            Notification.Builder b = builder(c, CH_REMINDERS)
                    .setContentTitle(e.optString("title"))
                    .setContentText(firstLine(body))
                    .setStyle(new Notification.BigTextStyle().bigText(body))
                    .setContentIntent(openApp(c, nid))
                    .setAutoCancel(true);
            post(c, nid, b.build());
            return;
        }
        try {
            // Skip what was already answered "Sudah" from an earlier notification.
            JSONObject results = readObject(p, "results");
            JSONArray left = new JSONArray();
            for (int i = 0; i < items.length(); i++) {
                JSONObject it = items.optJSONObject(i);
                if (it != null && results.optInt(it.optString("k")) != 1) left.put(it);
            }
            if (left.length() == 0) return;
            JSONObject a = new JSONObject();
            a.put("id", e.optString("id"));
            a.put("title", e.optString("title"));
            a.put("items", left);
            a.put("pos", 0);
            a.put("round", e.optInt("round"));
            a.put("no", new JSONArray());
            a.put("ts", System.currentTimeMillis());
            JSONObject active = readObject(p, "active");
            active.put(String.valueOf(nid), a);
            prune(active);
            p.edit().putString("active", active.toString()).apply();
            post(c, nid, step(c, nid, a));
        } catch (JSONException ignored) {
        }
    }

    /** The notification for the current item of a checklist. */
    private static Notification step(Context c, int nid, JSONObject a) {
        JSONArray items = a.optJSONArray("items");
        int pos = a.optInt("pos"), n = items.length();
        String text = items.optJSONObject(pos).optString("x");
        String title = a.optString("title") + (n > 1 ? "  (" + (pos + 1) + "/" + n + ")" : "");
        StringBuilder big = new StringBuilder(text);
        if (pos + 1 < n) big.append("\n\nBerikutnya: ").append(items.optJSONObject(pos + 1).optString("x"));
        Notification.Builder b = builder(c, CH_TASKS)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(big.toString()))
                .setContentIntent(openApp(c, nid))
                .setOnlyAlertOnce(true)
                .setAutoCancel(false)
                .addAction(0, "✓ Sudah", answerIntent(c, nid, "done"))
                .addAction(0, "✗ Belum", answerIntent(c, nid, "no"));
        if (n - pos > 1) b.addAction(0, "Sudah semua", answerIntent(c, nid, "all"));
        return b.build();
    }

    /** Handles a button press on a checklist notification. */
    static synchronized void answer(Context c, int nid, String what) {
        SharedPreferences p = prefs(c);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        JSONObject active = readObject(p, "active");
        JSONObject a = active.optJSONObject(String.valueOf(nid));
        if (a == null) {
            if (nm != null) nm.cancel(nid);
            return;
        }
        try {
            JSONArray items = a.optJSONArray("items");
            JSONArray no = a.optJSONArray("no");
            JSONObject results = readObject(p, "results");
            int pos = a.optInt("pos"), n = items.length();
            if ("all".equals(what)) {
                for (; pos < n; pos++) results.put(items.optJSONObject(pos).optString("k"), 1);
            } else if (pos < n) {
                JSONObject it = items.optJSONObject(pos);
                boolean done = "done".equals(what);
                results.put(it.optString("k"), done ? 1 : 2);
                if (!done) no.put(it);
                pos++;
            }
            a.put("pos", pos);
            SharedPreferences.Editor ed = p.edit().putString("results", results.toString());
            if (pos < n) {
                active.put(String.valueOf(nid), a);
                ed.putString("active", active.toString()).apply();
                post(c, nid, step(c, nid, a));
            } else {
                active.remove(String.valueOf(nid));
                ed.putString("active", active.toString()).apply();
                if (nm != null) nm.cancel(nid);
                followUp(c, p, a, no);
            }
        } catch (JSONException ignored) {
        }
        MainActivity.resultsChanged();
    }

    /** Items answered "Belum" come back once more after the snooze time. */
    private static void followUp(Context c, SharedPreferences p, JSONObject a, JSONArray no) throws JSONException {
        int snooze = p.getInt("snooze", 30), round = a.optInt("round");
        if (no.length() == 0 || snooze <= 0 || round >= 2) return;
        JSONObject e = new JSONObject();
        e.put("id", a.optString("id") + "#" + (round + 1));
        e.put("at", System.currentTimeMillis() + snooze * 60000L);
        e.put("title", baseTitle(a.optString("title")) + " · tadi belum");
        e.put("items", no);
        e.put("round", round + 1);
        e.put("f", 1);
        List<JSONObject> q = readList(p, "queue");
        q.add(e);
        sort(q);
        p.edit().putString("queue", new JSONArray(q).toString()).apply();
        schedule(c, q.get(0).optLong("at"));
    }

    private static String baseTitle(String title) {
        int cut = title.indexOf(" · tadi belum");
        return cut < 0 ? title : title.substring(0, cut);
    }

    /** Answers collected since the page last asked; clears them. */
    static synchronized String takeResults(Context c) {
        SharedPreferences p = prefs(c);
        String s = p.getString("results", "{}");
        p.edit().putString("results", "{}").apply();
        return s;
    }

    static boolean notificationsEnabled(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm == null || Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled();
    }

    static boolean exactAlarms(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am != null && (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms());
    }

    // ---------- helpers ----------

    private static void post(Context c, int nid, Notification n) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.notify(nid, n);
        } catch (SecurityException ignored) {
            // notifications not allowed (yet)
        }
    }

    @SuppressWarnings("deprecation") // the pre-channel builder and priority are needed below Android 8
    private static Notification.Builder builder(Context c, String channel) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            b = new Notification.Builder(c, channel);
        } else {
            b = new Notification.Builder(c).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        return b.setSmallIcon(R.drawable.ic_stat).setColor(COLOR).setShowWhen(true)
                .setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PUBLIC);
    }

    private static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel tasks = new NotificationChannel(CH_TASKS, "Jadwal & to-do", NotificationManager.IMPORTANCE_HIGH);
        tasks.setDescription("Jadwal harian, checklist, dan to-do dengan tombol Sudah / Belum");
        NotificationChannel reminders = new NotificationChannel(CH_REMINDERS, "Pengingat pagi, siang, sore", NotificationManager.IMPORTANCE_HIGH);
        reminders.setDescription("Pesan pengingat harian");
        nm.createNotificationChannel(tasks);
        nm.createNotificationChannel(reminders);
    }

    private static PendingIntent openApp(Context c, int nid) {
        Intent i = new Intent(c, MainActivity.class).putExtra("open", "today")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 2, i, PendingIntent.FLAG_UPDATE_CURRENT | immutable());
    }

    private static PendingIntent answerIntent(Context c, int nid, String what) {
        // The data URI keeps the intents for different notifications and buttons apart.
        Intent i = new Intent(c, ActionReceiver.class).setAction(ACTION_ANSWER)
                .setData(Uri.parse("aio://answer/" + nid + "/" + what))
                .putExtra("nid", nid).putExtra("what", what);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | immutable());
    }

    private static int immutable() {
        return Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
    }

    private static String firstLine(String s) {
        int cut = s.indexOf('\n');
        return cut < 0 ? s : s.substring(0, cut);
    }

    private static void sort(List<JSONObject> list) {
        Collections.sort(list, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                return Long.compare(a.optLong("at"), b.optLong("at"));
            }
        });
    }

    /** Forgets the oldest checklists nobody answered, so the store stays small. */
    private static void prune(JSONObject active) {
        while (active.length() > MAX_ACTIVE) {
            String oldest = null;
            long ts = Long.MAX_VALUE;
            for (Iterator<String> it = active.keys(); it.hasNext(); ) {
                String k = it.next();
                JSONObject a = active.optJSONObject(k);
                long t = a == null ? 0 : a.optLong("ts");
                if (t < ts) {
                    ts = t;
                    oldest = k;
                }
            }
            if (oldest == null) return;
            active.remove(oldest);
        }
    }

    private static List<JSONObject> readList(SharedPreferences p, String key) {
        List<JSONObject> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(p.getString(key, "[]"));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.optJSONObject(i);
                if (o != null) out.add(o);
            }
        } catch (JSONException ignored) {
        }
        return out;
    }

    private static JSONObject readObject(SharedPreferences p, String key) {
        try {
            return new JSONObject(p.getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }
}
