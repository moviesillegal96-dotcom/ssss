package android.app;
import java.util.ArrayList; import java.util.List;
public class Notification {
    public static final int PRIORITY_HIGH = 1, DEFAULT_ALL = -1, VISIBILITY_PUBLIC = 1; public static final String CATEGORY_REMINDER = "reminder";
    public String channel, title, text, big; public int smallIcon; public boolean onlyAlertOnce, autoCancel;
    public PendingIntent contentIntent, deleteIntent; public final List<Action> actions = new ArrayList<>();
    public static class Action { public final String title; public final PendingIntent intent; Action(String t, PendingIntent p) { title = t; intent = p; } }
    public static abstract class Style { }
    public static class BigTextStyle extends Style { String big; public BigTextStyle bigText(CharSequence c) { big = String.valueOf(c); return this; } }
    public static class Builder {
        private final Notification n = new Notification();
        public Builder(android.content.Context c, String channel) { n.channel = channel; }
        public Builder(android.content.Context c) { n.channel = null; }
        public Builder setContentTitle(CharSequence c) { n.title = String.valueOf(c); return this; }
        public Builder setContentText(CharSequence c) { n.text = String.valueOf(c); return this; }
        public Builder setStyle(Style s) { n.big = ((BigTextStyle) s).big; return this; }
        public Builder setContentIntent(PendingIntent p) { n.contentIntent = p; return this; }
        public Builder setDeleteIntent(PendingIntent p) { n.deleteIntent = p; return this; }
        public Builder setAutoCancel(boolean b) { n.autoCancel = b; return this; }
        public Builder setOnlyAlertOnce(boolean b) { n.onlyAlertOnce = b; return this; }
        public Builder addAction(int icon, CharSequence title, PendingIntent p) { if (n.actions.size() >= 3) throw new IllegalStateException("Android shows at most 3 buttons"); n.actions.add(new Action(String.valueOf(title), p)); return this; }
        public Builder setPriority(int p) { return this; } public Builder setDefaults(int d) { return this; }
        public Builder setSmallIcon(int i) { n.smallIcon = i; return this; } public Builder setColor(int c) { return this; }
        public Builder setShowWhen(boolean b) { return this; } public Builder setCategory(String s) { return this; } public Builder setVisibility(int v) { return this; }
        public Notification build() { return n; }
    }
}
