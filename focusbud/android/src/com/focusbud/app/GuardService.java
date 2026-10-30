package com.focusbud.app;

import android.accessibilityservice.AccessibilityService;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;

import java.util.HashSet;
import java.util.Set;

/**
 * Watches which app is in front (it only listens for "window changed" events and never reads screen content),
 * counts the time spent in apps on the block list, and puts the guilt screen on top once a limit is used up.
 */
public class GuardService extends AccessibilityService {
    private static final long TICK_MS = 5000;
    private static final long MAX_CREDIT_MS = 30000; // never credit more than this per tick (phone asleep, etc.)

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Store store;
    private String frontPkg; // the app most recently brought to the front
    private String counting; // the blocked app whose time is being counted, or null
    private long lastAt;
    private boolean screenOn = true;
    private final Set<String> ignored = new HashSet<>();

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            tick();
            handler.postDelayed(this, TICK_MS);
        }
    };

    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            tick(); // credit time up to now first
            screenOn = !Intent.ACTION_SCREEN_OFF.equals(intent.getAction());
            tick();
        }
    };

    @Override
    protected void onServiceConnected() {
        store = new Store(this);
        lastAt = System.currentTimeMillis();
        // Windows that pop over an app without leaving it: the notification shade and keyboards.
        ignored.add("com.android.systemui");
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) {
            for (InputMethodInfo info : imm.getInputMethodList()) ignored.add(info.getPackageName());
        }
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_SCREEN_ON);
        registerReceiver(screenReceiver, filter);
        handler.post(ticker);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || event.getPackageName() == null) return;
        String pkg = event.getPackageName().toString();
        if (ignored.contains(pkg) || pkg.equals(frontPkg)) return;
        frontPkg = pkg;
        tick();
    }

    private void tick() {
        if (store == null) return;
        long now = System.currentTimeMillis();
        if (counting != null) store.credit(counting, Math.min(now - lastAt, MAX_CREDIT_MS) / 1000.0);
        lastAt = now;

        String pkg = screenOn ? frontPkg : null;
        counting = store.site(pkg) != null ? pkg : null;
        if (counting == null) return;
        String reason = store.blockReason(counting);
        if (reason != null) block(counting, reason);
    }

    private void block(String pkg, String reason) {
        counting = null;
        frontPkg = getPackageName();
        Intent i = new Intent(this, BlockActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("site", pkg)
                .putExtra("reason", reason);
        startActivity(i);
    }

    @Override
    public void onInterrupt() {
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(ticker);
        try {
            unregisterReceiver(screenReceiver);
        } catch (IllegalArgumentException ignored) {
        }
        super.onDestroy();
    }
}
