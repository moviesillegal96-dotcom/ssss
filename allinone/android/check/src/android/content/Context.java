package android.content;
import java.util.HashMap; import java.util.Map;
/** A stand-in Android: one in-memory app with preferences, a notification shade and an alarm clock. */
public class Context {
    public static final String ALARM_SERVICE = "alarm", NOTIFICATION_SERVICE = "notification";
    public static final int MODE_PRIVATE = 0;
    public final android.app.NotificationManager nm = new android.app.NotificationManager();
    public final android.app.AlarmManager am = new android.app.AlarmManager();
    private final Map<String, Map<String, Object>> prefs = new HashMap<>();
    public Context getApplicationContext() { return this; }
    public Object getSystemService(String name) { return ALARM_SERVICE.equals(name) ? am : NOTIFICATION_SERVICE.equals(name) ? nm : null; }
    public SharedPreferences getSharedPreferences(String name, int mode) {
        final Map<String, Object> m = prefs.computeIfAbsent(name, k -> new HashMap<>());
        return new SharedPreferences() {
            public String getString(String k, String d) { Object v = m.get(k); return v == null ? d : (String) v; }
            public int getInt(String k, int d) { Object v = m.get(k); return v == null ? d : (Integer) v; }
            public boolean getBoolean(String k, boolean d) { Object v = m.get(k); return v == null ? d : (Boolean) v; }
            public Editor edit() {
                final Map<String, Object> pending = new HashMap<>();
                return new Editor() {
                    public Editor putString(String k, String v) { pending.put(k, v); return this; }
                    public Editor putInt(String k, int v) { pending.put(k, v); return this; }
                    public Editor putBoolean(String k, boolean v) { pending.put(k, v); return this; }
                    public void apply() { m.putAll(pending); }
                };
            }
        };
    }
}
