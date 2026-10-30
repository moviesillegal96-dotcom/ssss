package com.focusbud.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;

/**
 * FocusBud's data, shared by the pages (through the JS bridge) and GuardService.
 *
 * Each key holds the same JSON the browser extension keeps in chrome.storage ("settings", "day", "stats",
 * "snoozes", "focusUntil"), so common.js works unchanged. On Android a site entry's "domain" is an app's
 * package name and "label" is the app's name.
 */
public class Store {
    private static final Object LOCK = new Object();

    // Must stay in step with DEFAULT_SETTINGS in common.js, apart from the apps.
    private static final String DEFAULT_SETTINGS = "{\"budName\":\"Bud\",\"goal\":\"finish the school project\","
            + "\"totalLimit\":60,\"intensity\":\"medium\",\"passMinutes\":5,\"sites\":["
            + app("com.instagram.android", "Instagram", 20) + ","
            + app("com.zhiliaoapp.musically", "TikTok", 20) + ","
            + app("com.google.android.youtube", "YouTube", 30) + ","
            + app("com.twitter.android", "X (Twitter)", 15) + ","
            + app("com.facebook.katana", "Facebook", 15) + ","
            + app("com.reddit.frontpage", "Reddit", 20) + ","
            + app("com.snapchat.android", "Snapchat", 10) + ","
            + app("com.instagram.barcelona", "Threads", 15) + "]}";

    private static String app(String pkg, String label, int limit) {
        return "{\"domain\":\"" + pkg + "\",\"label\":\"" + label + "\",\"limit\":" + limit + "}";
    }

    private final SharedPreferences prefs;

    public Store(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences("focusbud", Context.MODE_PRIVATE);
    }

    /** Raw JSON for a key, or null. Settings fall back to the Android defaults. */
    public String get(String key) {
        synchronized (LOCK) {
            String v = prefs.getString(key, null);
            if (v == null && "settings".equals(key)) return DEFAULT_SETTINGS;
            return v;
        }
    }

    public void set(String key, String json) {
        synchronized (LOCK) {
            prefs.edit().putString(key, json).apply();
        }
    }

    private JSONObject obj(String key) {
        try {
            String v = get(key);
            return v == null ? new JSONObject() : new JSONObject(v);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** The site entry for a package, or null if it isn't on the block list. */
    JSONObject site(String pkg) {
        if (pkg == null) return null;
        JSONArray sites = obj("settings").optJSONArray("sites");
        if (sites == null) return null;
        for (int i = 0; i < sites.length(); i++) {
            JSONObject s = sites.optJSONObject(i);
            if (s != null && pkg.equals(s.optString("domain"))) return s;
        }
        return null;
    }

    /** Today's usage record, rolling over to a new day the same way getDay() in common.js does. */
    JSONObject day() throws JSONException {
        synchronized (LOCK) {
            JSONObject day = obj("day");
            String today = today();
            if (today.equals(day.optString("date"))) return day;
            if (day.has("date")) {
                JSONObject settings = obj("settings");
                JSONObject stats = obj("stats");
                boolean kept = !day.optBoolean("overLimit") && day.optInt("passes") == 0;
                int streak = kept ? stats.optInt("streak") + 1 : 0;
                stats.put("streak", streak);
                stats.put("bestStreak", Math.max(stats.optInt("bestStreak"), streak));
                stats.put("lifetimePasses", stats.optInt("lifetimePasses"));
                JSONArray history = stats.optJSONArray("history");
                if (history == null) history = new JSONArray();
                history.put(new JSONObject()
                        .put("date", day.optString("date"))
                        .put("minutes", Math.round(totalSeconds(day) / 60))
                        .put("passes", day.optInt("passes"))
                        .put("limit", settings.optInt("totalLimit", 60)));
                JSONArray last14 = new JSONArray();
                for (int i = Math.max(0, history.length() - 14); i < history.length(); i++) last14.put(history.get(i));
                stats.put("history", last14);
                set("stats", stats.toString());
            }
            JSONObject fresh = new JSONObject()
                    .put("date", today).put("sites", new JSONObject()).put("passes", 0).put("overLimit", false);
            set("day", fresh.toString());
            return fresh;
        }
    }

    static double totalSeconds(JSONObject day) {
        JSONObject sites = day.optJSONObject("sites");
        double total = 0;
        if (sites == null) return 0;
        for (Iterator<String> it = sites.keys(); it.hasNext(); ) total += sites.optDouble(it.next(), 0);
        return total;
    }

    /** Adds time spent in a blocked app to today's total. */
    void credit(String pkg, double seconds) {
        synchronized (LOCK) {
            try {
                JSONObject day = day();
                JSONObject sites = day.getJSONObject("sites");
                double used = sites.optDouble(pkg, 0) + seconds;
                sites.put(pkg, used);
                JSONObject site = site(pkg);
                int totalLimit = obj("settings").optInt("totalLimit", 60);
                if ((site != null && used > site.optInt("limit") * 60) || totalSeconds(day) > totalLimit * 60) {
                    day.put("overLimit", true);
                }
                set("day", day.toString());
            } catch (JSONException ignored) {
            }
        }
    }

    /** Why a package should be blocked right now ("focus", "site", "total"), or null. Mirrors blockReason() in common.js. */
    String blockReason(String pkg) {
        JSONObject site = site(pkg);
        if (site == null) return null;
        long now = System.currentTimeMillis();
        if (obj("snoozes").optLong(pkg, 0) > now) return null;
        String focus = get("focusUntil");
        if (focus != null && Double.parseDouble(focus) > now) return "focus";
        try {
            JSONObject day = day();
            if (day.getJSONObject("sites").optDouble(pkg, 0) >= site.optInt("limit") * 60) return "site";
            if (totalSeconds(day) >= obj("settings").optInt("totalLimit", 60) * 60) return "total";
        } catch (JSONException ignored) {
        }
        return null;
    }
}
