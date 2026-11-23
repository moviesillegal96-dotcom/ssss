package com.allinone.app;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Runs the real Notifier / ActionReceiver / AlarmReceiver code against the stand-in Android in this folder. */
public class NotifierCheck {
    static int checks = 0;
    static final List<String> failures = new ArrayList<>();
    static String scenario = "";

    static void eq(String what, Object expected, Object actual) {
        checks++;
        if (expected == null ? actual != null : !expected.equals(actual)) failures.add(scenario + ": " + what + " — expected <" + expected + "> but was <" + actual + ">");
    }

    static void ok(String what, boolean cond) { eq(what, true, cond); }

    static JSONObject item(String k, String x) { return new JSONObject().put("k", k).put("x", x); }

    static JSONObject checklist(String id, long at, String title, JSONObject... items) {
        JSONArray a = new JSONArray();
        for (JSONObject it : items) a.put(it);
        return new JSONObject().put("id", id).put("at", at).put("ch", "tasks").put("title", title).put("items", a);
    }

    static String payload(JSONArray done, int snooze, boolean on, JSONObject... entries) {
        JSONArray q = new JSONArray();
        for (JSONObject e : entries) q.put(e);
        return new JSONObject().put("queue", q).put("done", done == null ? new JSONArray() : done).put("snooze", snooze).put("on", on).toString();
    }

    /** Presses a notification button the way Android does: its PendingIntent delivers the Intent to the receiver. */
    static void press(Context c, Notification n, int index) {
        Intent i = n.actions.get(index).intent.intent;
        eq("button goes to ActionReceiver", ActionReceiver.class, i.target);
        new ActionReceiver().onReceive(c, i);
    }

    static Notification shown(Context c, String id) { return c.nm.shown.get(id.hashCode()); }

    /** Moves every queued entry into the past, as if the time had come. */
    static void timePasses(Context c) {
        SharedPreferences p = c.getSharedPreferences("aio", 0);
        JSONArray q = new JSONArray(p.getString("queue", "[]"));
        for (int i = 0; i < q.length(); i++) q.getJSONObject(i).put("at", System.currentTimeMillis() - 10);
        p.edit().putString("queue", q.toString()).apply();
    }

    public static void main(String[] args) {
        long now = System.currentTimeMillis();

        scenario = "due entries are shown, the next alarm is set";
        {
            Context c = new Context();
            JSONObject reminder = new JSONObject().put("id", "r|pagi").put("at", now - 1000).put("ch", "reminders").put("title", "Pengingat pagi").put("body", "• Satu\n• Dua");
            Notifier.setQueue(c, payload(null, 30, true,
                    checklist("t|old", now - 4 * 3600_000L, "Kemarin", item("d|x", "Basi")), reminder,
                    checklist("t|pulsek", now - 500, "16:10 · To Do Pulsek", item("d|pk0", "Beres2"), item("d|pk1", "Mandi"), item("d|pk2", "Makan")),
                    checklist("t|malam", now + 3600_000, "20:00 · Jadwal harian", item("d|tt1", "Sikat gigi"))));
            eq("notifications shown (stale one dropped)", 2, c.nm.shown.size());
            Notification step = shown(c, "t|pulsek");
            eq("title", "16:10 · To Do Pulsek  (1/3)", step.title);
            eq("text", "Beres2", step.text);
            eq("expanded text names the next item", "Beres2\n\nBerikutnya: Mandi", step.big);
            eq("buttons", 3, step.actions.size());
            eq("button 1", "✓ Sudah", step.actions.get(0).title);
            eq("button 2", "✗ Belum", step.actions.get(1).title);
            eq("button 3", "Sudah semua", step.actions.get(2).title);
            ok("the three buttons are different PendingIntents", !step.actions.get(0).intent.identity().equals(step.actions.get(1).intent.identity()) && !step.actions.get(1).intent.identity().equals(step.actions.get(2).intent.identity()));
            ok("tapping the notification opens the app", step.contentIntent.activity && step.contentIntent.intent.target == MainActivity.class);
            Notification rem = shown(c, "r|pagi");
            eq("reminder title", "Pengingat pagi", rem.title);
            eq("reminder first line", "• Satu", rem.text);
            eq("reminder full text", "• Satu\n• Dua", rem.big);
            eq("reminder has no buttons", 0, rem.actions.size());
            eq("alarm time", now + 3600_000, c.am.at);
            eq("alarm kind", "exact", c.am.how);
            eq("alarm goes to AlarmReceiver", AlarmReceiver.class, c.am.op.intent.target);
        }

        scenario = "answering steps through the items";
        {
            Context c = new Context();
            Notifier.setQueue(c, payload(null, 30, true, checklist("t|pulsek", now - 500, "16:10 · To Do Pulsek", item("d|pk0", "Beres2"), item("d|pk1", "Mandi"), item("d|pk2", "Makan"))));
            int alertsBefore = c.nm.alerts;
            press(c, shown(c, "t|pulsek"), 0);
            eq("after Sudah: title", "16:10 · To Do Pulsek  (2/3)", shown(c, "t|pulsek").title);
            eq("after Sudah: text", "Mandi", shown(c, "t|pulsek").text);
            eq("moving to the next item does not ring again", alertsBefore, c.nm.alerts);
            press(c, shown(c, "t|pulsek"), 1);
            eq("after Belum: text", "Makan", shown(c, "t|pulsek").text);
            eq("last item has two buttons", 2, shown(c, "t|pulsek").actions.size());
            press(c, shown(c, "t|pulsek"), 0);
            eq("finished checklist is removed", null, shown(c, "t|pulsek"));
            eq("the page is told about each answer", 3, MainActivity.pushes);
            JSONObject r = new JSONObject(Notifier.takeResults(c));
            eq("pk0", 1, r.getInt("d|pk0")); eq("pk1", 2, r.getInt("d|pk1")); eq("pk2", 1, r.getInt("d|pk2"));
            eq("results are handed over once", "{}", Notifier.takeResults(c));
            long delay = c.am.at - System.currentTimeMillis();
            ok("follow-up alarm about 30 minutes later (was " + delay + " ms)", delay > 29 * 60_000 && delay <= 30 * 60_000);
            timePasses(c);
            new AlarmReceiver().onReceive(c, new Intent(Notifier.ACTION_ALARM));
            Notification again = shown(c, "t|pulsek#1");
            ok("follow-up shown", again != null);
            eq("follow-up title", "16:10 · To Do Pulsek · tadi belum", again.title);
            eq("follow-up text", "Mandi", again.text);
            press(c, again, 1);                                   // Belum again -> second follow-up
            timePasses(c);
            new AlarmReceiver().onReceive(c, new Intent(Notifier.ACTION_ALARM));
            Notification third = shown(c, "t|pulsek#1#2");
            ok("second follow-up shown", third != null);
            eq("second follow-up title is not doubled", "16:10 · To Do Pulsek · tadi belum", third == null ? null : third.title);
            press(c, third, 1);                                   // Belum a third time -> it stops asking
            eq("no third follow-up", 0L, c.am.at);
        }

        scenario = "Sudah semua";
        {
            Context c = new Context();
            Notifier.setQueue(c, payload(null, 30, true, checklist("t|a", now - 100, "Blok", item("k1", "A"), item("k2", "B"), item("k3", "C"))));
            press(c, shown(c, "t|a"), 1);
            press(c, shown(c, "t|a"), 2);
            eq("removed", null, shown(c, "t|a"));
            JSONObject r = new JSONObject(Notifier.takeResults(c));
            eq("k1", 2, r.getInt("k1")); eq("k2", 1, r.getInt("k2")); eq("k3", 1, r.getInt("k3"));
        }

        scenario = "items ticked in the app leave the notification";
        {
            Context c = new Context();
            Notifier.setQueue(c, payload(null, 30, true, checklist("t|b", now - 100, "Blok", item("k1", "A"), item("k2", "B"), item("k3", "C"))));
            int alerts = c.nm.alerts;
            Notifier.setQueue(c, payload(new JSONArray().put("k1"), 30, true));
            eq("moves on to B", "B", shown(c, "t|b").text);
            eq("recount", "Blok  (1/2)", shown(c, "t|b").title);
            eq("silently", alerts, c.nm.alerts);
            Notifier.setQueue(c, payload(new JSONArray().put("k1").put("k2").put("k3"), 30, true));
            eq("all done in the app: removed", null, shown(c, "t|b"));
            eq("nothing recorded", "{}", Notifier.takeResults(c));
        }

        scenario = "a dismissed checklist is forgotten";
        {
            Context c = new Context();
            Notifier.setQueue(c, payload(null, 30, true, checklist("t|c", now - 100, "Blok", item("k1", "A"), item("k2", "B"))));
            Notification n = shown(c, "t|c");
            ok("has a dismiss intent", n.deleteIntent != null);
            c.nm.cancel("t|c".hashCode());
            new ActionReceiver().onReceive(c, n.deleteIntent.intent);
            Notifier.setQueue(c, payload(new JSONArray().put("k1"), 30, true));
            eq("stays gone", null, shown(c, "t|c"));
            eq("nothing recorded", "{}", Notifier.takeResults(c));
            press(c, n, 0);                                        // a late press on a stale notification must not crash
            eq("late press records nothing", "{}", Notifier.takeResults(c));
        }

        scenario = "switched off";
        {
            Context c = new Context();
            Notifier.setQueue(c, payload(null, 30, false, checklist("t|d", now - 100, "Blok", item("k1", "A")), checklist("t|e", now + 60_000, "Nanti", item("k2", "B"))));
            eq("nothing shown", 0, c.nm.shown.size());
            eq("no alarm", 0L, c.am.at);
        }

        scenario = "snooze off";
        {
            Context c = new Context();
            Notifier.setQueue(c, payload(null, 0, true, checklist("t|f", now - 100, "Blok", item("k1", "A"))));
            eq("single item has no 'Sudah semua'", 2, shown(c, "t|f").actions.size());
            eq("single item has no counter", "Blok", shown(c, "t|f").title);
            press(c, shown(c, "t|f"), 1);
            eq("no follow-up alarm", 0L, c.am.at);
        }

        scenario = "answered items are skipped later";
        {
            Context c = new Context();
            Notifier.setQueue(c, payload(null, 30, true, checklist("q|pagi", now - 100, "To-do", item("todo|1", "PR"), item("todo|2", "Karton"))));
            press(c, shown(c, "q|pagi"), 0);
            Notifier.setQueue(c, payload(null, 30, true, checklist("q|malam", System.currentTimeMillis() - 50, "To-do malam", item("todo|1", "PR"), item("todo|2", "Karton"))));
            eq("only the open one", "Karton", shown(c, "q|malam").text);
            eq("no counter for one item", "To-do malam", shown(c, "q|malam").title);
        }

        scenario = "reboot";
        {
            Context c = new Context();
            Notifier.setQueue(c, payload(null, 30, true, checklist("t|g", now + 120_000, "Nanti", item("k1", "A"))));
            c.am.at = 0; c.am.op = null;                           // alarms do not survive a reboot
            new AlarmReceiver().onReceive(c, new Intent(Intent.ACTION_BOOT_COMPLETED));
            eq("alarm restored", now + 120_000, c.am.at);
        }

        scenario = "exact alarms not allowed";
        {
            Context c = new Context();
            c.am.exactAllowed = false;
            Notifier.setQueue(c, payload(null, 30, true, checklist("t|h", now + 120_000, "Nanti", item("k1", "A"))));
            eq("falls back to an inexact alarm", "inexact", c.am.how);
            eq("still scheduled", now + 120_000, c.am.at);
        }

        scenario = "old Android (7.0)";
        {
            android.os.Build.VERSION.SDK_INT = 24;
            Context c = new Context();
            c.nm.channels.add(null);                               // no channels before Android 8
            Notifier.setQueue(c, payload(null, 30, true, checklist("t|i", now - 100, "Blok", item("k1", "A"), item("k2", "B")), checklist("t|j", now + 60_000, "Nanti", item("k3", "C"))));
            ok("shown without a channel", shown(c, "t|i") != null);
            eq("alarm", "exact", c.am.how);
            press(c, shown(c, "t|i"), 2);
            eq("removed", null, shown(c, "t|i"));
            android.os.Build.VERSION.SDK_INT = 34;
        }

        scenario = "broken input";
        {
            Context c = new Context();
            Notifier.setQueue(c, "not json");
            Notifier.setQueue(c, "{}");
            Notifier.setQueue(c, payload(null, 30, true, new JSONObject().put("id", "x").put("at", now - 10)));     // no title, no items, no body
            new ActionReceiver().onReceive(c, new Intent("something.else"));
            Notifier.answer(c, 12345, "done");
            ok("survives", true);
        }

        scenario = "many entries";
        {
            Context c = new Context();
            JSONObject[] many = new JSONObject[400];
            for (int i = 0; i < many.length; i++) many[i] = checklist("t|" + i, now + (400 - i) * 60_000L, "Blok " + i, item("k" + i, "Item"));
            long t0 = System.nanoTime();
            Notifier.setQueue(c, payload(null, 30, true, many));
            long ms = (System.nanoTime() - t0) / 1_000_000;
            eq("alarm for the earliest entry, whatever the order", now + 60_000L, c.am.at);
            ok("400 entries handled quickly (" + ms + " ms)", ms < 2000);
        }

        System.out.println(checks + " checks, " + failures.size() + " failed");
        for (String f : failures) System.out.println("  FAIL " + f);
        System.exit(failures.isEmpty() ? 0 : 1);
    }
}
