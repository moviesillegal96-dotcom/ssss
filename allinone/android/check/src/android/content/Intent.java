package android.content;
import java.util.HashMap; import java.util.Map;
public class Intent {
    public static final int FLAG_ACTIVITY_NEW_TASK = 0x10000000, FLAG_ACTIVITY_SINGLE_TOP = 0x20000000;
    public static final String ACTION_BOOT_COMPLETED = "android.intent.action.BOOT_COMPLETED";
    public Class<?> target; public String action; public android.net.Uri data; public final Map<String, Object> extras = new HashMap<>();
    public Intent(Context c, Class<?> cls) { target = cls; }
    public Intent(String action) { this.action = action; }
    public Intent setAction(String a) { action = a; return this; }
    public Intent setData(android.net.Uri u) { data = u; return this; }
    public Intent putExtra(String k, int v) { extras.put(k, v); return this; }
    public Intent putExtra(String k, String v) { extras.put(k, v); return this; }
    public Intent addFlags(int f) { return this; }
    public String getAction() { return action; }
    public String getStringExtra(String k) { return (String) extras.get(k); }
    public int getIntExtra(String k, int d) { Object v = extras.get(k); return v == null ? d : (Integer) v; }
}
