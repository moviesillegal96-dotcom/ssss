package com.allinone.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Wakes up for the next due notification, and after a reboot, an app update or a clock change. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Notifier.fireDue(context);
    }
}
