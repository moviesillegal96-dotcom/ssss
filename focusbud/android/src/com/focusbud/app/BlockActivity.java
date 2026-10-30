package com.focusbud.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** The guilt screen GuardService shows on top of a blocked app. Back goes to the home screen, never to the app. */
public class BlockActivity extends WebActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWebView();
        load(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        load(intent);
    }

    private void load(Intent intent) {
        String site = intent.getStringExtra("site");
        String reason = intent.getStringExtra("reason");
        web.loadUrl(BASE + "blocked.html?site=" + Uri.encode(site == null ? "" : site)
                + "&reason=" + Uri.encode(reason == null ? "site" : reason));
    }

    @Override
    public void onBackPressed() {
        goHome();
        finish();
    }
}
