package com.allinone.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Hosts the All-in-One page in a full-screen WebView.
 *
 * The page is served from https://appassets.androidplatform.net/ (intercepted, never fetched from
 * the network), which gives it a stable origin so its saved lists survive app updates.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int REQ_SAVE = 1;
    private static final int REQ_OPEN = 2;
    private static final int MAX_BACKUP_BYTES = 20 * 1024 * 1024;

    private WebView web;
    private String pendingBackup;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        web.setWebViewClient(new AssetClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
        web.loadUrl(START_URL);
    }

    /** Serves index.html from the APK's assets folder for the virtual https host. */
    private class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!HOST.equals(url.getHost())) return null;
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            String path = url.getPath();
            if (path == null || path.equals("/") || path.equals("/index.html")) {
                try {
                    return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, getAssets().open("index.html"));
                } catch (IOException ignored) {
                }
            }
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, null);
        }

        @SuppressWarnings("deprecation") // the WebResourceRequest overload needs API 24; this one works on all versions
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String link) {
            Uri url = Uri.parse(link);
            if (HOST.equals(url.getHost())) return false;
            // Saved links open in the browser or their own app, not inside this one.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }
    }

    /** Native features the page can call as window.AndroidBridge.* */
    private class Bridge {
        /** Asks where to save a backup file, then writes it there. */
        @JavascriptInterface
        public void saveFile(final String name, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pendingBackup = text;
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("application/json");
                    i.putExtra(Intent.EXTRA_TITLE, name);
                    try {
                        startActivityForResult(i, REQ_SAVE);
                    } catch (ActivityNotFoundException e) {
                        callJs("window.backupSaved(false)");
                    }
                }
            });
        }

        /** Lets the user pick a backup file and hands its text to the page. */
        @JavascriptInterface
        public void openFile() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    try {
                        startActivityForResult(i, REQ_OPEN);
                    } catch (ActivityNotFoundException ignored) {
                    }
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
        if (requestCode == REQ_SAVE) {
            String text = pendingBackup;
            pendingBackup = null;
            if (uri == null || text == null) return;
            boolean ok = false;
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out != null) {
                    out.write(text.getBytes("UTF-8"));
                    ok = true;
                }
            } catch (IOException | SecurityException ignored) {
            }
            callJs("window.backupSaved(" + ok + ")");
        } else if (requestCode == REQ_OPEN && uri != null) {
            String text = "";
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[16384];
                int n;
                while (in != null && (n = in.read(chunk)) > 0 && buf.size() < MAX_BACKUP_BYTES) buf.write(chunk, 0, n);
                text = buf.toString("UTF-8");
            } catch (IOException | SecurityException ignored) {
            }
            callJs("window.receiveBackup(" + JSONObject.quote(text) + ")");
        }
    }

    private void callJs(final String script) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                web.evaluateJavascript(script, null);
            }
        });
    }

    /** Back closes a dialog or goes up a level inside the page first; otherwise it leaves the app. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.handleBack && window.handleBack()) ? 'handled' : 'exit'",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (!"\"handled\"".equals(value)) finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
