package com.minigame.app;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * MINIGAME 的壳：一台只播本地录像带的电视。
 *
 * 站点放在 assets/site/ 下，通过 https://appassets.androidplatform.net/site/...
 * 这个"盒子内置的假电视台"喂给 WebView，页面拿到的就是正常的 https 源，
 * localStorage、fetch、音频解码全都和真网站一致，而且完全不联网。
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://" + AppClient.HOST + "/site/index.html";

    private WebView web;
    private AppClient client;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);

        client = new AppClient(this);
        web.setWebViewClient(client);
        setContentView(web);
        web.loadUrl(START_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();

        /* 刚从系统浏览器回来：页面可能停在「按钮已禁用」或「跳转弹窗」的状态。
           页面有 __appResume 钩子就让页面自己恢复，没有就整页重载。 */
        if (client != null && client.pending) {
            client.pending = false;

            if (web != null) {
                web.evaluateJavascript(
                    "window.__appResume ? (window.__appResume(), 1) : 0",
                    new ResumeCallback(web));
            }
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }

        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }

        super.onDestroy();
    }
}
