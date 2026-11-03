package com.minigame.app;

import android.webkit.ValueCallback;
import android.webkit.WebView;

/**
 * 页面里定义了 window.__appResume 就调用它（页面自己知道怎么恢复）；
 * 没有钩子的页面直接重载，回到干净状态。
 *
 * 注意：这里用原始类型 ValueCallback，故意不写泛型 —— 当前这套 build-tools 的 d8
 * 处理带泛型签名的类会崩（NullPointerException），raw 类型能过。
 */
public class ResumeCallback implements ValueCallback {

    private final WebView view;

    public ResumeCallback(WebView webView) {
        this.view = webView;
    }

    @Override
    public void onReceiveValue(Object value) {
        String text = value == null ? "" : String.valueOf(value);

        /* evaluateJavascript 返回 JSON：钩子跑过是 1，没跑过是 0 */
        if (text.indexOf('1') < 0) {
            if (view != null) {
                view.reload();
            }
        }
    }
}
