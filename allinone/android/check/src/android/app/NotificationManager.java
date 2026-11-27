package android.app;
import java.util.LinkedHashMap; import java.util.Map; import java.util.HashSet; import java.util.Set;
public class NotificationManager {
    public static final int IMPORTANCE_HIGH = 4;
    public final Map<Integer, Notification> shown = new LinkedHashMap<>(); public final Set<String> channels = new HashSet<>();
    public boolean enabled = true; public int posts = 0, alerts = 0;
    public void notify(int id, Notification n) {
        if (!channels.contains(n.channel)) throw new IllegalStateException("channel " + n.channel + " was not created");
        if (n.smallIcon == 0) throw new IllegalArgumentException("a notification needs a small icon");
        posts++; if (!(n.onlyAlertOnce && shown.containsKey(id))) alerts++;
        shown.put(id, n);
    }
    public void cancel(int id) { shown.remove(id); }
    public boolean areNotificationsEnabled() { return enabled; }
    public void createNotificationChannel(NotificationChannel c) { channels.add(c.id); }
    public android.service.notification.StatusBarNotification[] getActiveNotifications() {
        android.service.notification.StatusBarNotification[] a = new android.service.notification.StatusBarNotification[shown.size()]; int i = 0;
        for (int id : shown.keySet()) a[i++] = new android.service.notification.StatusBarNotification(id); return a;
    }
}
