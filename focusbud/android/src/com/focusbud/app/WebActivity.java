package com.focusbud.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Shows one of FocusBud's pages in a full-screen WebView. The pages are the same ones the browser extension uses;
 * they're served from the APK's assets on https://appassets.androidplatform.net/ and talk to the app through
 * window.AndroidBridge.
 */
public abstract class WebActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String BASE = "https://" + HOST + "/";

    protected WebView web;
    protected Store store;

    protected void setupWebView() {
        store = new Store(this);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        web.setWebViewClient(new AssetClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript("window.onAndroidResume && window.onAndroidResume()", null);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Serves files from the APK's assets folder for the virtual https host. */
    private class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!HOST.equals(url.getHost())) return null;
            String path = url.getPath();
            if (path == null || path.equals("/") || path.isEmpty()) path = "/popup.html";
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
            return !HOST.equals(Uri.parse(link).getHost());
        }
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    boolean guardOn() {
        String enabled = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        String me = new ComponentName(this, GuardService.class).flattenToString();
        if (enabled == null) return false;
        for (String s : enabled.split(":")) {
            if (s.equalsIgnoreCase(me)) return true;
        }
        return false;
    }

    void goHome() {
        startActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }

    private void open(Intent i) {
        try {
            startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    /** Native features the pages call as window.AndroidBridge.* */
    private class Bridge {
        @JavascriptInterface
        public String get(String key) {
            return store.get(key);
        }

        @JavascriptInterface
        public void set(String key, String json) {
            store.set(key, json);
        }

        @JavascriptInterface
        public boolean isGuardOn() {
            return guardOn();
        }

        @JavascriptInterface
        public void openGuardSettings() {
            open(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
        }

        @JavascriptInterface
        public void openAppInfo() {
            open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
        }

        /** Launchable apps as [{pkg, label}], for adding apps to the block list. */
        @JavascriptInterface
        public String listApps() {
            PackageManager pm = getPackageManager();
            List<ResolveInfo> found = pm.queryIntentActivities(
                    new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0);
            final Map<String, String> apps = new HashMap<>();
            for (ResolveInfo r : found) {
                String pkg = r.activityInfo.packageName;
                if (!pkg.equals(getPackageName())) apps.put(pkg, r.loadLabel(pm).toString());
            }
            List<String> pkgs = new java.util.ArrayList<>(apps.keySet());
            Collections.sort(pkgs, new Comparator<String>() {
                @Override
                public int compare(String a, String b) {
                    return apps.get(a).compareToIgnoreCase(apps.get(b));
                }
            });
            JSONArray out = new JSONArray();
            try {
                for (String pkg : pkgs) out.put(new JSONObject().put("pkg", pkg).put("label", apps.get(pkg)));
            } catch (JSONException ignored) {
            }
            return out.toString();
        }

        @JavascriptInterface
        public void goHome() {
            WebActivity.this.goHome();
            if (WebActivity.this instanceof BlockActivity) finish();
        }

        /** Opens an app after a guilt pass was paid for. */
        @JavascriptInterface
        public void openApp(String pkg) {
            Intent launch = getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch != null) open(launch);
            if (WebActivity.this instanceof BlockActivity) finish();
        }
    }
}
