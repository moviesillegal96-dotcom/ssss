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
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Hosts the All in One planner (index.html) and the chess helper (chess-helper.html) in a full-screen WebView.
 *
 * The bundled assets are served from https://appassets.androidplatform.net/ (intercepted, never
 * fetched from the network) so the page runs in a secure context: Web Workers, WebAssembly
 * (Stockfish) and the camera all work there, unlike on file:// URLs.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int REQ_SPEECH = 2;
    private static final int REQ_CAMERA = 3;
    private static final int REQ_NOTIFICATIONS = 4;
    private static final int REQ_SAVE_FILE = 5;
    private static final int REQ_PICK_FILE = 6;

    /** The activity on screen, so answers given from a notification reach the page right away. */
    private static MainActivity current;

    private String pendingSave;
    private WebView web;
    private TextToSpeech tts;
    private boolean ttsReady;
    private PermissionRequest pendingPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = this;

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        web.setWebViewClient(new AssetClient());
        web.setWebChromeClient(new ChromeClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        setContentView(web);

        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS) {
                    tts.setLanguage(Locale.US);
                    ttsReady = true;
                }
            }
        });

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
        public void onPageFinished(WebView view, String url) {
            // Keep the screen awake only while the chess board is open at the table.
            if (url != null && url.contains("chess-helper")) {
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        }

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
                String encoding = mime.startsWith("text/") || mime.endsWith("javascript") ? "UTF-8" : null;
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
            // Open external links (licenses, credits) in the browser instead of inside the app.
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
        if (path.endsWith(".wasm")) return "application/wasm";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /** Grants the page camera access (for move detection) once the user allows it. */
    private class ChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    boolean wantsCamera = false;
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
                    }
                    if (!wantsCamera) {
                        request.deny();
                        return;
                    }
                    if (Build.VERSION.SDK_INT < 23
                            || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        pendingPermission = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                    }
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_NOTIFICATIONS) {
            Notifier.fireDue(this);
            callJs("window.onNotifPermission && window.onNotifPermission()");
            return;
        }
        if (requestCode != REQ_CAMERA || pendingPermission == null) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            pendingPermission.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            pendingPermission.deny();
        }
        pendingPermission = null;
    }

    /** Native features the page can call as window.AndroidBridge.* */
    private class Bridge {
        @JavascriptInterface
        public boolean canSpeak() {
            return ttsReady;
        }

        @JavascriptInterface
        public void speak(String text) {
            if (ttsReady) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "move");
        }

        @JavascriptInterface
        public void listen() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US");
                    i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
                    i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Say a move, e.g. \"knight f3\"");
                    try {
                        startActivityForResult(i, REQ_SPEECH);
                    } catch (ActivityNotFoundException e) {
                        callJs("window.onVoiceError && window.onVoiceError("
                                + JSONObject.quote("Speech recognition is not available on this phone.") + ")");
                    }
                }
            });
        }

        @JavascriptInterface
        public void share(final String text, final String subject) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_SUBJECT, subject);
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(send, "Share game"));
                }
            });
        }

        // ----- All in One planner -----

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
            } catch (org.json.JSONException e) {
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
                        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
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
            return;
        }
        if (requestCode == REQ_PICK_FILE) {
            if (uri != null) readFile(uri);
            return;
        }
        if (requestCode != REQ_SPEECH) return;
        ArrayList<String> results = data == null ? null
                : data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (resultCode == RESULT_OK && results != null) {
            callJs("window.onVoiceResult && window.onVoiceResult(" + new JSONArray(results).toString() + ")");
        } else {
            callJs("window.onVoiceError && window.onVoiceError(" + JSONObject.quote("Didn't catch that.") + ")");
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

    /** Back closes what is open inside the page first, then returns from the chess helper, then leaves the app. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? 'handled' : 'exit'",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if ("\"handled\"".equals(value)) return;
                        if (web.canGoBack()) web.goBack();
                        else finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (tts != null) tts.shutdown();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
