package com.minigame.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/**
 * WebView 的"信号处理"：本地请求从 APK 里读，外部链接丢给系统浏览器。
 * 单独一个类，不写匿名内部类（d8 对匿名类有兼容问题）。
 */
public class AppClient extends WebViewClient {

    public static final String HOST = "appassets.androidplatform.net";

    private final Context ctx;

    public AppClient(Context context) {
        this.ctx = context;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();

        if (uri == null || !HOST.equals(uri.getHost())) {
            return null;
        }

        String path = uri.getPath();

        if (path == null || !path.startsWith("/site/")) {
            return null;
        }

        String name = "site/" + path.substring("/site/".length());

        try {
            InputStream in = ctx.getAssets().open(name);
            return new WebResourceResponse(mimeOf(name), charsetOf(name), in);
        } catch (IOException e) {
            return null;
        }
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();

        if (uri == null) {
            return false;
        }

        if (HOST.equals(uri.getHost())) {
            return false;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        } catch (Exception ignored) {
            /* 没有能打开它的应用就算了 */
        }

        /* 记一笔：用户被送去浏览器了。等 Activity 重新 onResume 时再恢复现场，
           这样不管是验证门还是彩蛋跳转，回来都是立刻能点的状态。 */
        pending = true;

        return true;
    }

    /** 是否刚把用户送去过外部浏览器、还没做恢复 */
    public boolean pending;

    private static String mimeOf(String name) {
        String n = name.toLowerCase();

        if (n.endsWith(".html") || n.endsWith(".htm")) {
            return "text/html";
        }
        if (n.endsWith(".css")) {
            return "text/css";
        }
        if (n.endsWith(".js")) {
            return "application/javascript";
        }
        if (n.endsWith(".json")) {
            return "application/json";
        }
        if (n.endsWith(".png")) {
            return "image/png";
        }
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (n.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (n.endsWith(".ico")) {
            return "image/x-icon";
        }
        if (n.endsWith(".m4a") || n.endsWith(".mp4")) {
            return "audio/mp4";
        }
        if (n.endsWith(".txt")) {
            return "text/plain";
        }

        return "application/octet-stream";
    }

    private static String charsetOf(String name) {
        String mime = mimeOf(name);

        if (mime.startsWith("text/") || mime.equals("application/javascript") || mime.equals("application/json")) {
            return "utf-8";
        }

        return null;
    }
}
