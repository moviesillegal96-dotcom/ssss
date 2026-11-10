package com.plannerapp.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.OutputStream;

/** Hosts planner.html (bundled in the APK) in a full-screen WebView. Works offline; data stays on the phone. */
public class MainActivity extends Activity {
    private static final int REQ_IMPORT = 1;
    private static final int REQ_EXPORT = 2;

    private WebView web;
    private ValueCallback<Uri[]> pendingFile;
    private String pendingBackup;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Follow the phone's light/dark setting; the page picks its colours from the same setting.
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        setTheme(night ? android.R.style.Theme_Material_NoActionBar : android.R.style.Theme_Material_Light_NoActionBar);
        super.onCreate(savedInstanceState);
        int bg = Color.parseColor(night ? "#191919" : "#ffffff");
        if (night || Build.VERSION.SDK_INT >= 23) {
            getWindow().setStatusBarColor(bg);
            if (!night) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        web = new WebView(this);
        web.setBackgroundColor(bg);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);   // localStorage: where the planner keeps its items
        web.getSettings().setTextZoom(100);
        web.setWebChromeClient(new WebChromeClient() {
            @Override   // "Import backup": the page's file input
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try {
                    startActivityForResult(pick, REQ_IMPORT);
                } catch (ActivityNotFoundException e) {
                    pendingFile = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
        if (savedInstanceState == null) web.loadUrl("file:///android_asset/index.html");
        else web.restoreState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    private class Bridge {
        /** "Export backup": asks where to save, then writes the JSON there. */
        @JavascriptInterface
        public void saveBackup(final String name, final String json) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pendingBackup = json;
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("application/json").putExtra(Intent.EXTRA_TITLE, name);
                    try {
                        startActivityForResult(save, REQ_EXPORT);
                    } catch (ActivityNotFoundException e) {
                        Toast.makeText(MainActivity.this, "No file manager found to save the backup", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (request == REQ_IMPORT && pendingFile != null) {
            pendingFile.onReceiveValue(uri == null ? null : new Uri[]{uri});
            pendingFile = null;
        } else if (request == REQ_EXPORT && uri != null && pendingBackup != null) {
            try {
                OutputStream out = getContentResolver().openOutputStream(uri);
                out.write(pendingBackup.getBytes("UTF-8"));
                out.close();
                Toast.makeText(this, "Backup saved", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Could not save the backup", Toast.LENGTH_LONG).show();
            }
            pendingBackup = null;
        }
    }
}
