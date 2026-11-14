package com.dompetplanner.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Hosts the planner page in a WebView.
 *
 * The bundled page and fonts are served from https://appassets.androidplatform.net/ (intercepted,
 * never fetched from the network), which gives the page a stable origin: its saved data lives in
 * that origin's localStorage inside the app's private storage.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    // View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR, added in API 26 (the build compiles against API 23).
    private static final int LIGHT_NAVIGATION_BAR = 0x10;

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        styleSystemBars();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        web.setBackgroundColor(getResources().getColor(R.color.page));
        web.setWebViewClient(new AssetClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
        web.loadUrl(START_URL);
    }

    /** Matches the status and navigation bars to the page background in light and dark mode. */
    private void styleSystemBars() {
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        int page = getResources().getColor(R.color.page);
        if (night) {
            getWindow().setStatusBarColor(page);
            getWindow().setNavigationBarColor(page);
            return;
        }
        // Light bars need dark icons, which older Android versions cannot draw; those keep the default dark bars.
        int flags = 0;
        if (Build.VERSION.SDK_INT >= 23) {
            getWindow().setStatusBarColor(page);
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        }
        if (Build.VERSION.SDK_INT >= 26) {
            getWindow().setNavigationBarColor(page);
            flags |= LIGHT_NAVIGATION_BAR;
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
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
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /** Native features the page can call as window.AndroidBridge.* */
    private class Bridge {
        /** Opens the Android share sheet, used to send a backup of the planner's data somewhere safe. */
        @JavascriptInterface
        public void share(final String text, final String subject) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_SUBJECT, subject);
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, "Save backup to"));
                }
            });
        }
    }

    /** Back closes an open dialog or returns to Home inside the page first; otherwise it leaves the app. */
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
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
