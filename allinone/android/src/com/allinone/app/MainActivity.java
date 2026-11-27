package com.allinone.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Hosts the All in One planner (assets/index.html) in a full-screen WebView.
 *
 * The bundled assets are served from https://appassets.androidplatform.net/ (intercepted, never
 * fetched from the network), so the page has a normal https origin and its storage persists.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int REQ_NOTIFICATIONS = 4;
    private static final int REQ_SAVE_FILE = 5;
    private static final int REQ_PICK_FILE = 6;

    /** The activity on screen, so answers given from a notification reach the page right away. */
    private static MainActivity current;

    private String pendingSave;
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = this;

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        web.setWebViewClient(new AssetClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);

        web.loadUrl(START_URL);
        Notifier.fireDue(this);
    }

    /** A tap on a notification while the app is already running. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && intent.hasExtra("open")) {
            callJs("window.onNativeOpen && window.onNativeOpen(" + JSONObject.quote(intent.getStringExtra("open")) + ")");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        current = this;
        callJs("window.onNativeResults && window.onNativeResults()");
    }

    /** Called after a notification button was pressed. */
    static void resultsChanged() {
        MainActivity a = current;
        if (a != null) a.callJs("window.onNativeResults && window.onNativeResults()");
    }

    /** Serves files from the APK's assets folder for the virtual https host. */
    private class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!HOST.equals(url.getHost())) return null;
            String path = url.getPath();
            if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            try {
                InputStream in = getAssets().open(path.substring(1));
                String mime = mimeType(path);
                String encoding = mime.startsWith("text/") ? "UTF-8" : null;
                return new WebResourceResponse(mime, encoding, 200, "OK", headers, in);
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
            }
        }

        @SuppressWarnings("deprecation") // the WebResourceRequest overload needs API 24; this one works on all versions
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String link) {
            Uri url = Uri.parse(link);
            if (HOST.equals(url.getHost())) return false;
            // Links saved in the notes (TikTok, Instagram, ...) open in their own app or the browser.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQ_NOTIFICATIONS) return;
        Notifier.fireDue(this);
        callJs("window.onNotifPermission && window.onNotifPermission()");
    }

    /** Native features the page can call as window.AndroidBridge.* */
    private class Bridge {
        /** Hands over the notification queue: {queue: [...], done: [...], snooze, on}. */
        @JavascriptInterface
        public void aioSchedule(String json) {
            Notifier.setQueue(MainActivity.this, json);
        }

        /** Answers given from notifications since the last call, as {key: 1 | 2}. */
        @JavascriptInterface
        public String aioTakeResults() {
            return Notifier.takeResults(MainActivity.this);
        }

        @JavascriptInterface
        public String aioStatus() {
            try {
                return new JSONObject()
                        .put("sdk", Build.VERSION.SDK_INT)
                        .put("notif", Notifier.notificationsEnabled(MainActivity.this))
                        .put("exact", Notifier.exactAlarms(MainActivity.this)).toString();
            } catch (JSONException e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public void aioAskNotifications() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= 33
                            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        // Android stops showing its dialog after two refusals; from then on only Settings can allow it.
                        android.content.SharedPreferences sp = getSharedPreferences("aio-ui", MODE_PRIVATE);
                        if (sp.getBoolean("askedNotifications", false)
                                && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                            openAppSettings();
                        } else {
                            sp.edit().putBoolean("askedNotifications", true).apply();
                            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
                        }
                    } else if (!Notifier.notificationsEnabled(MainActivity.this)) {
                        openAppSettings();
                    }
                }
            });
        }

        @JavascriptInterface
        public void aioOpenSettings() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    openAppSettings();
                }
            });
        }

        /** Lets the user choose where to save a text file (the backup). */
        @JavascriptInterface
        public void aioSaveFile(final String name, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pendingSave = text;
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("application/json").putExtra(Intent.EXTRA_TITLE, name);
                    try {
                        startActivityForResult(i, REQ_SAVE_FILE);
                    } catch (ActivityNotFoundException e) {
                        pendingSave = null;
                        callJs("window.onFileSaved && window.onFileSaved(false)");
                    }
                }
            });
        }

        /** Lets the user choose a backup file; its text goes to window.onFilePicked. */
        @JavascriptInterface
        public void aioPickFile() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                    try {
                        startActivityForResult(i, REQ_PICK_FILE);
                    } catch (ActivityNotFoundException ignored) {
                    }
                }
            });
        }
    }

    private void openAppSettings() {
        Intent i;
        if (Build.VERSION.SDK_INT >= 26 && !Notifier.notificationsEnabled(this)) {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        } else {
            i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
        }
        try {
            startActivity(i);
        } catch (ActivityNotFoundException ignored) {
        }
    }

    private void saveFile(Uri uri) {
        boolean ok = false;
        try (OutputStream out = getContentResolver().openOutputStream(uri)) {
            if (out != null && pendingSave != null) {
                out.write(pendingSave.getBytes(StandardCharsets.UTF_8));
                ok = true;
            }
        } catch (IOException ignored) {
        }
        pendingSave = null;
        callJs("window.onFileSaved && window.onFileSaved(" + ok + ")");
    }

    private void readFile(Uri uri) {
        StringBuilder sb = new StringBuilder();
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return;
            BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            char[] buf = new char[8192];
            for (int n; (n = r.read(buf)) > 0 && sb.length() < 20000000; ) sb.append(buf, 0, n);
        } catch (IOException e) {
            return;
        }
        callJs("window.onFilePicked && window.onFilePicked(" + JSONObject.quote(sb.toString()) + ")");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
        if (requestCode == REQ_SAVE_FILE) {
            if (uri != null) saveFile(uri);
            else callJs("window.onFileSaved && window.onFileSaved(false)");
        } else if (requestCode == REQ_PICK_FILE && uri != null) {
            readFile(uri);
        }
    }

    private void callJs(final String script) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript(script, null);
            }
        });
    }

    /** Back closes what is open inside the page first; from the first screen it leaves the app. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? 'handled' : 'exit'",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"\"handled\"".equals(value)) finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (web != null) web.destroy();
        web = null;
        super.onDestroy();
    }
}
