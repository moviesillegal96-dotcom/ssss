package android.app;
public class AlarmManager {
    public static final int RTC_WAKEUP = 0;
    public boolean exactAllowed = true; public long at = 0; public PendingIntent op; public String how = "";
    public boolean canScheduleExactAlarms() { return exactAllowed; }
    public void cancel(PendingIntent pi) { if (op != null && op.identity().equals(pi.identity())) { op = null; at = 0; how = ""; } }
    private void put(String h, long t, PendingIntent pi) { how = h; at = t; op = pi; }
    public void setAndAllowWhileIdle(int type, long t, PendingIntent pi) { put("inexact", t, pi); }
    public void setExactAndAllowWhileIdle(int type, long t, PendingIntent pi) { if (!exactAllowed) throw new SecurityException("exact alarms not allowed"); put("exact", t, pi); }
    public void setExact(int type, long t, PendingIntent pi) { put("exact", t, pi); }
    public void set(int type, long t, PendingIntent pi) { put("inexact", t, pi); }
}
