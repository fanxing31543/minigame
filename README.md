# MINIGAME

一个纯静态的整活小游戏站：人机验证门 → 游戏目录 → 三个小游戏，外加一堆站点级彩蛋。

- 纯前端，无后端、无数据库、不收集任何数据
- 手机优先，`pointerdown` 交互，无 hover 依赖
- 安卓端可以打包成离线 APK（见 `android/`）

## 目录

```
index.html        人机验证门
home.html         游戏目录
404.html          自定义 404
css/style.css     全站样式
js/               gate / prank / roji / manager / egg / starfield
g/speed.html      游戏 1 手速测试
g/time.html       游戏 2 时间感知
g/aim.html        游戏 3 精准点击
assets/           图片、音频
android/          WebView 壳 APK 工程
```

## 本地跑

```
python -m http.server 8000 --directory .
```

打开 <http://127.0.0.1:8000/>。

## 部署

站点是纯静态的，`C:\websites` 整个目录直接丢给 Cloudflare Pages / 任意静态托管即可。
注意：压缩打包时 zip 内路径必须是正斜杠，否则 aapt2 之外的一些环境会丢子目录。

## 安卓 APK

前置：JDK 17+、Android SDK（`platforms;android-34` + `build-tools;34.0.0`），
环境变量 `ANDROID_SDK_ROOT` 指向 SDK 根目录。

```
cd android
powershell -File build-apk.ps1
```

脚本会先把仓库根的站点文件同步进 `app/src/main/assets/site/`，再走
aapt2 → javac → d8 → zipalign → apksigner，产物是 `android/MINIGAME.apk`。

### 实现要点

- 站点整包塞进 APK，用 `shouldInterceptRequest` 把
  `https://appassets.androidplatform.net/site/...` 映射到 assets——
  得到的是正常的 https 源，`localStorage`、`fetch`、音频解码全部可用，且完全不联网
- 页面里的外链（B 站等）由壳拦下交给系统浏览器
- 从浏览器返回时，壳会调用页面的 `window.__appResume()` 恢复现场
  （验证门重新启用按钮、游戏页关掉跳转弹窗）；没有钩子的页面直接重载
- 签名密钥 `android/minigame.keystore` **不入库**，务必自己留好，丢了就无法覆盖升级

## 已知取舍

- 站点托管在境外，国内访问延迟 200~1700ms；APK 是完全离线的，无此问题
- 华为「纯净模式」会拦截未备案的侧载 APK，需要在设置里退出纯净模式才能安装
