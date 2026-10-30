package com.focusbud.app;

import android.os.Bundle;

/** The app's home screen: Bud, today's screen time, focus sessions and settings. */
public class MainActivity extends WebActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupWebView();
        web.loadUrl(BASE + "popup.html");
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
