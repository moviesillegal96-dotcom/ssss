package android.app;
import android.content.Context; import android.content.Intent;
public class PendingIntent {
    public static final int FLAG_UPDATE_CURRENT = 0x08000000, FLAG_IMMUTABLE = 0x04000000;
    public final Intent intent; public final int code; public final boolean activity;
    private PendingIntent(Intent i, int code, boolean activity) { intent = i; this.code = code; this.activity = activity; }
    public static PendingIntent getBroadcast(Context c, int code, Intent i, int flags) { if ((flags & FLAG_IMMUTABLE) == 0) throw new IllegalArgumentException("Android 12+ needs FLAG_IMMUTABLE"); return new PendingIntent(i, code, false); }
    public static PendingIntent getActivity(Context c, int code, Intent i, int flags) { if ((flags & FLAG_IMMUTABLE) == 0) throw new IllegalArgumentException("Android 12+ needs FLAG_IMMUTABLE"); return new PendingIntent(i, code, true); }
    /** Android treats two PendingIntents as the same one when target, action, data and request code match (extras are ignored). */
    public String identity() { return activity + "|" + code + "|" + intent.target + "|" + intent.action + "|" + intent.data; }
}
