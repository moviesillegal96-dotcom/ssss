package com.allinone.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Receives the "Sudah" / "Belum" / "Sudah semua" buttons of a checklist notification, and its dismissal. */
public class ActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Notifier.ACTION_ANSWER.equals(intent.getAction())) return;
        String what = intent.getStringExtra("what");
        if (what != null) Notifier.answer(context, intent.getIntExtra("nid", 0), what);
    }
}
