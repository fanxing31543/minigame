package com.minigame.app;

import android.webkit.WebView;

/**
 * 延迟重载页面。单独一个类，不用匿名内部类（d8 对匿名类有兼容问题）。
 */
public class ReloadTask implements Runnable {

    private final WebView view;

    public ReloadTask(WebView webView) {
        this.view = webView;
    }

    @Override
    public void run() {
        if (view != null) {
            view.reload();
        }
    }
}
