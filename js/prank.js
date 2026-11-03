/* ============================================================
   MINIGAME · 恶作剧弹窗「我，黑客，打钱」
   ------------------------------------------------------------
   行为：站内累计停留满 2 分钟，弹出一次三级文案的假勒索窗。
   挂载：每个页面 </body> 前加一行
           <script src="js/prank.js"></script>   （g/ 目录下写 ../js/prank.js）
   下线：删掉那一行即可，本文件留着也不会有任何影响。
   调参：window.PRANK_CONFIG = { delayMs: 120000, dwellMs: 3000 }
   调试：?prank=now       立刻弹
         ?prank=5000      阈值改成 5 秒
         ?prank=reset     清零计时与「已弹过」标记
         ?prank=now&stage=2  直接看第三级
   约定：不修改页面原有结构，只在 <body> 末尾追加一个节点。
   ============================================================ */

(function () {
  'use strict';

  if (window.__MG_PRANK__) {
    return;
  }
  window.__MG_PRANK__ = true;

  var doc = document;

  /* ---------- 配置 ---------- */

  var CFG = window.PRANK_CONFIG || {};

  function num(v, def) {
    return typeof v === 'number' && isFinite(v) ? v : def;
  }

  var DELAY_MS = num(CFG.delayMs, 2 * 60 * 1000);   /* 累计停留到多久弹 */
  var DWELL_MS = num(CFG.dwellMs, 3000);            /* 每级强制停留多久才能关 */

  var DWELL_KEY = 'mg.dwell.ms';                    /* 累计停留（毫秒） */
  var DONE_KEY = 'mg.prank.done';                   /* 本次会话已弹过 */

  var LAST_NOTE = '你不会发现我的坐标是乱填的，我可是黑客';

  /* ---------- 资源路径 ---------- */

  var BASE = '';

  try {
    var self = doc.currentScript && doc.currentScript.src;
    if (self) {
      BASE = self.replace(/js\/prank\.js(\?.*)?$/i, '');
    }
  } catch (err) {
    BASE = '';
  }

  if (!BASE) {
    /* 兜底：拿不到脚本地址时按目录猜 */
    BASE = window.location.pathname.indexOf('/g/') >= 0 ? '../' : '';
  }

  var MASK_SRC = BASE + 'assets/hack-mask.png';
  var QR_A = BASE + 'assets/qr-alipay.png';
  var QR_B = BASE + 'assets/qr-wechat.png';

  /* ---------- 调试参数 ---------- */

  var forceNow = false;
  var startStage = 0;
  var DEBUG = false;
  var audioState = '未播放';

  try {
    var qs = String(window.location.search || '');
    DEBUG = qs.indexOf('debug') >= 0;
    var hit = /[?&]prank=([a-z0-9]+)/i.exec(qs);
    if (hit) {
      var val = hit[1].toLowerCase();
      if (val === 'reset') {
        try { window.localStorage.removeItem(DWELL_KEY); } catch (e1) {}
        try { window.sessionStorage.removeItem(DONE_KEY); } catch (e2) {}
        try { window.sessionStorage.removeItem('mg.hack.closed'); } catch (e3) {}
      } else if (val === 'now') {
        forceNow = true;
      } else if (/^\d+$/.test(val)) {
        DELAY_MS = parseInt(val, 10);
      }
    }
    var sh = /[?&]stage=([0-2])/.exec(qs);
    if (sh) {
      startStage = parseInt(sh[1], 10);
    }
  } catch (err2) {
    /* 参数解析失败就按默认走 */
  }

  /* ---------- 存取 ---------- */

  function readNum(key) {
    try {
      var v = parseInt(window.localStorage.getItem(key), 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (err) {
      return 0;
    }
  }

  function writeNum(key, v) {
    try {
      window.localStorage.setItem(key, String(Math.round(v)));
    } catch (err) {
      /* 存储不可用时退化成「只在当前页计时」 */
    }
  }

  function isDone() {
    try {
      return window.sessionStorage.getItem(DONE_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function markDone() {
    try {
      window.sessionStorage.setItem(DONE_KEY, '1');
    } catch (err) {
      /* 忽略 */
    }
  }

  /* ---------- 样式 ---------- */

  var CSS = [
    '.mg-prank{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;',
    '  padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom));background:rgba(6,7,10,.87);',
    '  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:mg-prank-fade .18s ease-out;}',
    '.mg-prank[hidden]{display:none;}',
    '.mg-prank-box{position:relative;width:100%;max-width:352px;max-height:calc(100vh - 32px);',
    '  max-height:calc(100dvh - 32px);overflow:auto;',
    '  -webkit-overflow-scrolling:touch;background:#0f1115;border:1px solid rgba(255,255,255,.14);border-radius:18px;',
    '  padding:26px 18px 18px;color:#e6e8ee;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.62);',
    '  animation:mg-prank-pop .22s cubic-bezier(.2,.9,.3,1.2);}',
    '.mg-prank-x{position:absolute;top:4px;right:4px;width:44px;height:44px;display:flex;align-items:center;',
    '  justify-content:center;padding:0;font-family:inherit;font-size:21px;line-height:1;color:#fff;background:none;',
    '  border:none;border-radius:12px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}',
    '.mg-prank-x:active{background:rgba(255,255,255,.08);}',
    '.mg-prank-x:disabled{color:#7a828f;font-size:14px;font-weight:700;cursor:default;font-variant-numeric:tabular-nums;',
    '  background:none;}',
    '.mg-prank-mask{display:block;width:98px;height:152px;margin:0 auto 14px;object-fit:cover;object-position:50% 42%;',
    '  border-radius:10px;background:#000;box-shadow:0 0 0 1px rgba(255,255,255,.10),0 14px 34px rgba(0,0,0,.6);',
    '  -webkit-user-drag:none;user-select:none;}',
    '.mg-prank-title{margin:0 0 10px;font-size:20px;font-weight:750;line-height:1.5;color:#fff;letter-spacing:.01em;}',
    '.mg-prank-title.is-long{font-size:13.5px;font-weight:600;line-height:1.85;color:#e9ebf0;text-align:left;}',
    '.mg-prank-sub{margin:0 0 14px;font-size:12.5px;line-height:1.75;color:#98a1b0;}',
    '.mg-prank-note{margin:0 0 14px;font-size:10px;line-height:1.6;color:#666e7c;}',
    '.mg-prank-qrs{display:flex;gap:10px;margin:0 0 10px;}',
    '.mg-prank-qr{flex:1 1 0;min-width:0;margin:0;padding:5px;background:#fff;border-radius:10px;cursor:zoom-in;',
    '  touch-action:manipulation;}',
    '.mg-prank-qr img{display:block;width:100%;height:auto;border-radius:6px;}',
    '.mg-prank-tip{margin:0;font-size:11px;line-height:1.6;color:#7c848f;white-space:pre-line;}',
    '.mg-prank-zoom{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;',
    '  padding:10px;background:rgba(0,0,0,.95);cursor:zoom-out;}',
    '.mg-prank-zoom[hidden]{display:none;}',
    '.mg-prank-zoom img{max-width:100%;max-height:100%;display:block;border-radius:12px;}',
    '@keyframes mg-prank-fade{from{opacity:0}to{opacity:1}}',
    '@keyframes mg-prank-pop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){.mg-prank,.mg-prank-box{animation:none}}'
  ].join('\n');

  function injectCss() {
    var style = doc.createElement('style');
    style.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(style);
  }

  /* ---------- 结构 ---------- */

  var root = null;
  var boxEl = null;
  var xBtn = null;
  var titleEl = null;
  var subEl = null;
  var noteEl = null;
  var tipEl = null;
  var zoomEl = null;

  function buildDom() {
    root = doc.createElement('div');
    root.className = 'mg-prank';
    root.hidden = true;
    root.innerHTML =
      '<div class="mg-prank-box" role="alertdialog" aria-modal="true" aria-labelledby="mg-prank-title">' +
        '<button type="button" class="mg-prank-x" aria-label="关闭" disabled></button>' +
        '<img class="mg-prank-mask" alt="">' +
        '<h2 class="mg-prank-title" id="mg-prank-title"></h2>' +
        '<p class="mg-prank-sub"></p>' +
        '<p class="mg-prank-note" hidden></p>' +
        '<div class="mg-prank-qrs">' +
          '<figure class="mg-prank-qr"><img alt="支付宝收款码"></figure>' +
          '<figure class="mg-prank-qr"><img alt="微信收款码"></figure>' +
        '</div>' +
        '<p class="mg-prank-tip"></p>' +
      '</div>';

    doc.body.appendChild(root);

    boxEl = root.querySelector('.mg-prank-box');
    xBtn = root.querySelector('.mg-prank-x');
    titleEl = root.querySelector('.mg-prank-title');
    subEl = root.querySelector('.mg-prank-sub');
    noteEl = root.querySelector('.mg-prank-note');
    tipEl = root.querySelector('.mg-prank-tip');

    var maskEl = root.querySelector('.mg-prank-mask');
    maskEl.src = MASK_SRC;

    var qrs = root.querySelectorAll('.mg-prank-qr img');
    qrs[0].src = QR_A;
    qrs[1].src = QR_B;

    /* 点二维码放大，方便对方手机扫 */
    for (var i = 0; i < qrs.length; i++) {
      (function (img) {
        img.parentNode.addEventListener('pointerdown', function (event) {
          event.preventDefault();
          event.stopPropagation();
          showZoom(img.src, img.alt);
        });
      })(qrs[i]);
    }

    zoomEl = doc.createElement('div');
    zoomEl.className = 'mg-prank-zoom';
    zoomEl.hidden = true;
    zoomEl.innerHTML = '<img alt="">';
    doc.body.appendChild(zoomEl);

    zoomEl.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      zoomEl.hidden = true;
    });

    xBtn.addEventListener('pointerdown', onClosePress);
  }

  /* ---------- 二维码放大 ---------- */

  function showZoom(src, alt) {
    var img = zoomEl.querySelector('img');
    img.src = src;
    img.alt = alt || '';
    zoomEl.hidden = false;
  }

  /* ---------- 文案 ---------- */

  var CITIES = [
    [116.4, 39.9], [121.5, 31.2], [113.3, 23.1], [104.1, 30.7],
    [108.9, 34.3], [126.6, 45.8], [87.6, 43.8], [102.7, 25.0],
    [120.2, 30.3], [114.3, 30.6], [117.2, 39.1], [91.1, 29.7]
  ];

  /* 国内随机经纬度，保留一位小数 */
  function randomCoord() {
    var p = CITIES[Math.floor(Math.random() * CITIES.length)];
    var lng = p[0] + (Math.random() - 0.5) * 1.2;
    var lat = p[1] + (Math.random() - 0.5) * 1.2;
    return { lng: lng.toFixed(1), lat: lat.toFixed(1) };
  }

  function buildStages() {
    var c = randomCoord();

    return [
      {
        title: '我，黑客，打钱',
        sub: '你的浏览记录我已经打包了，想继续用就打点钱'
      },
      {
        title: '你确定？我可是黑客',
        sub: '再点一次，价格翻倍。你自己选的。'
      },
      {
        title: '我已锁定你家的位置：银河系-猎户臂星璇-太阳系-地球-经度' +
               c.lng + ',纬度' + c.lat + '，我以将你的坐标广播到宇宙！',
        sub: ''
      }
    ];
  }

  var stages = buildStages();
  var stageIdx = 0;

  /* ---------- 强制停留 ---------- */

  var closeUntil = 0;
  var closeTimer = 0;

  function armClose() {
    closeUntil = Date.now() + DWELL_MS;
    xBtn.disabled = true;
    xBtn.setAttribute('aria-disabled', 'true');
    window.clearInterval(closeTimer);
    tickClose();
    closeTimer = window.setInterval(tickClose, 100);
  }

  function tickClose() {
    var left = closeUntil - Date.now();

    if (left > 0) {
      xBtn.textContent = String(Math.ceil(left / 1000));
      return;
    }

    window.clearInterval(closeTimer);
    xBtn.textContent = '×';
    xBtn.disabled = false;
    xBtn.removeAttribute('aria-disabled');
  }

  /* ---------- 渲染 ---------- */

  function render() {
    var stage = stages[stageIdx];
    var isLast = stageIdx === stages.length - 1;

    titleEl.textContent = stage.title;
    titleEl.className = 'mg-prank-title' + (isLast ? ' is-long' : '');

    subEl.textContent = stage.sub;
    subEl.hidden = !stage.sub;

    noteEl.hidden = !isLast;
    if (isLast) {
      noteEl.textContent = LAST_NOTE;
    }

    tipEl.textContent = isLast ? '坐标已经发出去了，打钱也来不及了' : '扫码转账，金额随意';

    boxEl.scrollTop = 0;
    armClose();
    paintTip();
  }

  /* 底部小字（debug 模式下附带音频状态，方便排查） */
  function paintTip() {
    var base = stageIdx === stages.length - 1 ? '坐标已经发出去了，打钱也来不及了' : '扫码转账，金额随意';
    tipEl.textContent = DEBUG ? base + '\n[debug] 音频: ' + audioState : base;
  }

  function setAudioState(state) {
    audioState = state;
    if (window.console && window.console.info) {
      window.console.info('[prank] 音频: ' + state);
    }
    if (tipEl) {
      paintTip();
    }
  }

  /* ---------- 开关 ---------- */

  var opened = false;
  var savedOverflow = '';

  function lockScroll(on) {
    if (on) {
      savedOverflow = doc.body.style.overflow;
      doc.body.style.overflow = 'hidden';
    } else {
      doc.body.style.overflow = savedOverflow;
    }
  }

  function open() {
    if (opened) {
      return;
    }

    opened = true;
    markDone();

    /* 弹完清零，下一个会话重新攒，避免新开标签页立刻又弹 */
    acc = 0;
    writeNum(DWELL_KEY, 0);

    stages = buildStages();
    stageIdx = startStage;
    root.hidden = false;
    lockScroll(true);
    render();
    startAudio();

    if (window.console && window.console.info) {
      window.console.info('[prank] 弹窗已打开');
    }
  }

  function close() {
    root.hidden = true;
    zoomEl.hidden = true;
    lockScroll(false);
    window.clearInterval(closeTimer);
    stopAudio();
    opened = false;

    /* 记下关窗时间，给「罗辑」续集弹窗（js/roji.js）算 2 分钟 */
    try {
      window.sessionStorage.setItem('mg.hack.closed', String(Date.now()));
    } catch (err4) {
      /* 存不进去就只有同一页能接上 */
    }

    try {
      window.dispatchEvent(new CustomEvent('mg:hack-closed'));
    } catch (err5) {
      /* 老浏览器没有 CustomEvent 就算了，翻页时会按时间戳补上 */
    }
  }

  function onClosePress(event) {
    event.preventDefault();

    if (xBtn.disabled) {
      return;
    }

    if (stageIdx < stages.length - 1) {
      stageIdx += 1;
      render();
      return;
    }

    close();
  }

  /* ---------- 音效：15 秒「黑客」提示音 ---------- */

  var actx = null;
  var master = null;

  /* 主音源：用户提供的那段配乐，已裁成前 15 秒 */
  var BG_SRC = BASE + 'assets/hack-bgm.m4a';
  var CLIP_MS = 15000;
  var bgm = null;
  var bgmBroken = false;
  var bgmTimer = 0;

  /* 更稳的一条路：提前把音频解码成 AudioBuffer，
     弹窗直接用 Web Audio 播，不受「定时器里不能自动播放」的限制 */
  var buffer = null;
  var bufferTried = false;
  var bufferPromise = null;
  var bufferSrc = null;

  function prepareBuffer() {
    var c = audioCtx();
    if (!c || bufferTried || !window.fetch) {
      return bufferPromise;
    }
    bufferTried = true;

    try {
      bufferPromise = window.fetch(BG_SRC)
        .then(function (res) { return res.arrayBuffer(); })
        .then(function (ab) {
          return new Promise(function (resolve) {
            try {
              c.decodeAudioData(ab, function (b) { resolve(b); }, function () { resolve(null); });
            } catch (err) {
              resolve(null);
            }
          });
        })
        .then(function (b) {
          if (b) {
            buffer = b;
            if (window.console && window.console.info) {
              window.console.info('[prank] 配乐已解码 ' + b.duration.toFixed(2) + ' 秒');
            }
          }
          return b;
        })
        .catch(function () { return null; });
    } catch (err) {
      /* 没有 fetch 的旧浏览器就算了，走 <audio> 或合成音 */
      bufferPromise = null;
    }

    return bufferPromise;
  }

  function audioEl() {
    if (bgm) {
      return bgm;
    }
    if (bgmBroken || !window.Audio) {
      return null;
    }

    try {
      bgm = new window.Audio();
      bgm.preload = 'auto';
      bgm.volume = 0.85;
      bgm.src = BG_SRC;
      bgm.addEventListener('error', function () {
        bgmBroken = true;
        setAudioState('文件加载失败（' + BG_SRC.split('/').pop() + '）');
      });
      bgm.addEventListener('playing', function () {
        setAudioState('文件播放中 · ' + BG_SRC.split('/').pop());
      });
    } catch (err) {
      bgmBroken = true;
      bgm = null;
    }

    return bgm;
  }

  function audioCtx() {
    if (actx) {
      return actx;
    }

    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      return null;
    }

    try {
      actx = new AC();
    } catch (err) {
      return null;
    }

    return actx;
  }

  /* 浏览器要求先有用户手势才能出声，这里提前把上下文点亮 */
  function unlockAudio() {
    audioEl();      /* 顺手把配乐下下来，等真要播时就不用现抓 */
    var c = audioCtx();
    if (c && c.state === 'suspended') {
      try { c.resume(); } catch (err) {}
    }
    prepareBuffer();  /* 顺手解码，弹窗时直接出声 */
  }

  doc.addEventListener('pointerdown', unlockAudio, true);
  doc.addEventListener('touchstart', unlockAudio, true);
  doc.addEventListener('keydown', unlockAudio, true);

  function noiseBuffer(c, seconds) {
    var len = Math.floor(c.sampleRate * seconds);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);

    for (var i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buf;
  }

  function playSting(c) {
    var t = c.currentTime + 0.06;
    var out = c.createGain();

    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.30, t + 0.5);
    out.gain.setValueAtTime(0.30, t + 12.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 15.0);
    out.connect(c.destination);
    master = out;

    var noise = noiseBuffer(c, 2);
    var i;

    /* 1. 低频脉冲：8 下，每 0.75 秒一次 */
    for (i = 0; i < 8; i++) {
      var at = t + i * 0.75;
      var o = c.createOscillator();
      var lp = c.createBiquadFilter();
      var g = c.createGain();

      o.type = 'sawtooth';
      o.frequency.setValueAtTime(120, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.28);

      lp.type = 'lowpass';
      lp.frequency.value = 320;

      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.55, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);

      o.connect(lp);
      lp.connect(g);
      g.connect(out);
      o.start(at);
      o.stop(at + 0.45);
    }

    /* 2. 噪声扫频：2 秒到 10.8 秒 */
    var src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    var bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(180, t + 0.2);
    bp.frequency.exponentialRampToValueAtTime(3800, t + 5.5);
    bp.frequency.exponentialRampToValueAtTime(260, t + 10.5);

    var ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t + 0.2);
    ng.gain.exponentialRampToValueAtTime(0.22, t + 2.4);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 10.8);

    src.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    src.start(t + 0.2);
    src.stop(t + 11);

    /* 3. 打字机滴答 */
    for (i = 0; i < 46; i++) {
      var at2 = t + 2.2 + i * 0.105 + Math.random() * 0.03;
      var s2 = c.createBufferSource();
      var hp = c.createBiquadFilter();
      var g2 = c.createGain();

      s2.buffer = noise;
      s2.playbackRate.value = 2.4;

      hp.type = 'highpass';
      hp.frequency.value = 2600;

      g2.gain.setValueAtTime(0.0001, at2);
      g2.gain.exponentialRampToValueAtTime(0.10, at2 + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, at2 + 0.05);

      s2.connect(hp);
      hp.connect(g2);
      g2.connect(out);
      s2.start(at2);
      s2.stop(at2 + 0.06);
    }

    /* 4. 上升音 */
    var riser = c.createOscillator();
    var rg = c.createGain();

    riser.type = 'triangle';
    riser.frequency.setValueAtTime(180, t + 6.0);
    riser.frequency.exponentialRampToValueAtTime(660, t + 12.4);

    rg.gain.setValueAtTime(0.0001, t + 6.0);
    rg.gain.exponentialRampToValueAtTime(0.12, t + 10.0);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 12.6);

    riser.connect(rg);
    rg.connect(out);
    riser.start(t + 6.0);
    riser.stop(t + 12.8);

    /* 5. 结尾两声「叮」 */
    for (i = 0; i < 2; i++) {
      var at3 = t + 13.0 + i * 0.22;
      var o3 = c.createOscillator();
      var g3 = c.createGain();

      o3.type = 'sine';
      o3.frequency.value = i ? 1320 : 990;

      g3.gain.setValueAtTime(0.0001, at3);
      g3.gain.exponentialRampToValueAtTime(0.16, at3 + 0.01);
      g3.gain.exponentialRampToValueAtTime(0.0001, at3 + 0.5);

      o3.connect(g3);
      g3.connect(out);
      o3.start(at3);
      o3.stop(at3 + 0.55);
    }
  }

  /* 优先放真人配乐，文件缺失或被拦时退回合成音 */
  function startAudio() {
    if (buffer) {
      playBuffer();
      return;
    }

    /* 解码还没完成（比如刚点开就触发），给 2.5 秒等它 */
    var waiting = prepareBuffer() || bufferPromise;

    if (!waiting) {
      fallbackMedia();
      return;
    }

    var done = false;
    var timer = window.setTimeout(function () {
      if (done) {
        return;
      }
      done = true;
      fallbackMedia();
    }, 2500);

    waiting.then(function (b) {
      if (done) {
        return;
      }
      done = true;
      window.clearTimeout(timer);
      if (b && buffer) {
        playBuffer();
      } else {
        fallbackMedia();
      }
    });
  }

  /* 退路一：<audio> 元素；退路二：合成音 */
  function fallbackMedia() {
    var el = audioEl();

    if (!el) {
      setAudioState('合成音（没有 Audio 对象）');
      playSynth();
      return;
    }

    try {
      el.currentTime = 0;
    } catch (err) {
      /* 忽略 */
    }

    var p;

    setAudioState('请求文件…');

    try {
      p = el.play();
    } catch (err) {
      setAudioState('合成音（play 抛错 ' + (err && err.name) + '）');
      playSynth();
      return;
    }

    if (p && typeof p.then === 'function') {
      p.then(function () {
        setAudioState('文件 15 秒 · ' + BG_SRC.split('/').pop());
        window.clearTimeout(bgmTimer);
        /* 文件已经切到 15 秒，这里再兜一道，防止以后换了文件超长 */
        bgmTimer = window.setTimeout(function () {
          try { el.pause(); } catch (err) {}
        }, CLIP_MS);
      }, function (err) {
        setAudioState('合成音（play 被拒 ' + (err && err.name) + '）');
        playSynth();
      });
    } else {
      setAudioState('文件（无 Promise）');
    }
  }

  function playBuffer() {
    var c = audioCtx();

    if (!c || !buffer) {
      playSynth();
      return;
    }

    var start = function () {
      try {
        var src = c.createBufferSource();
        var g = c.createGain();

        src.buffer = buffer;
        g.gain.value = 0.85;
        src.connect(g);
        g.connect(c.destination);
        src.start(0);
        bufferSrc = src;
        setAudioState('配乐（Web Audio，15 秒）');
      } catch (err) {
        playSynth();
      }
    };

    if (c.state === 'running') {
      start();
      return;
    }

    try {
      c.resume().then(start, function () { playSynth(); });
    } catch (err) {
      playSynth();
    }
  }

  function playSynth() {
    var c = audioCtx();
    if (!c) {
      return;
    }

    var play = function () {
      try {
        playSting(c);
      } catch (err) {
        /* 出声失败不影响弹窗 */
      }
    };

    if (c.state === 'running') {
      play();
      return;
    }

    try {
      c.resume().then(play, function () {});
    } catch (err) {
      /* 旧浏览器没有 Promise 版 resume，忽略 */
    }
  }

  function stopAudio() {
    window.clearTimeout(bgmTimer);

    if (bufferSrc) {
      try { bufferSrc.stop(); } catch (err) {}
      bufferSrc = null;
    }

    if (bgm) {
      try { bgm.pause(); } catch (err) {}
      try { bgm.currentTime = 0; } catch (err) {}
    }

    if (!actx || !master) {
      return;
    }

    var m = master;
    master = null;

    try {
      var t = actx.currentTime;
      m.gain.cancelScheduledValues(t);
      m.gain.setValueAtTime(Math.max(0.0001, m.gain.value), t);
      m.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    } catch (err) {
      /* 忽略 */
    }
  }

  /* 切到后台先掐掉声音，回来接着放 */
  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'hidden') {
      if (bgm) {
        try { bgm.pause(); } catch (err) {}
      }
      if (actx) {
        try { actx.suspend(); } catch (err) {}
      }
      return;
    }

    if (!opened) {
      return;
    }

    if (bgm && !bgmBroken) {
      try { bgm.play(); } catch (err) {}
    }
    if (actx) {
      try { actx.resume(); } catch (err) {}
    }
  });

  /* ---------- 计时 ---------- */

  var acc = readNum(DWELL_KEY);
  var lastTick = Date.now();

  /* 页面正在玩或已有弹窗时先不打扰，下一轮再看 */
  function pageBusy() {
    if (doc.querySelector('[data-mode="play"]')) {
      return true;
    }
    if (doc.querySelector('.overlay:not([hidden])')) {
      return true;
    }
    return false;
  }

  function check() {
    if (opened || isDone()) {
      return;
    }
    if (acc < DELAY_MS) {
      return;
    }
    if (pageBusy()) {
      return;
    }
    open();
  }

  function loop() {
    var now = Date.now();

    if (!opened && !isDone() && doc.visibilityState === 'visible') {
      acc += now - lastTick;
      writeNum(DWELL_KEY, acc);
    }

    lastTick = now;
    check();
  }

  /* ---------- 启动 ---------- */

  function boot() {
    injectCss();
    buildDom();

    if (forceNow) {
      acc = DELAY_MS;
      window.setTimeout(function () {
        if (!opened) {
          open();
        }
      }, 400);
    } else if (acc >= DELAY_MS) {
      /* 上一个页面已经攒够时间，进来就补弹 */
      window.setTimeout(function () {
        if (!opened && !isDone() && !pageBusy()) {
          open();
        }
      }, 900);
    }

    window.setInterval(loop, 1000);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* 供调试：控制台里 MG_PRANK.open() */
  window.MG_PRANK = {
    open: open,
    close: close,
    audio: function () {
      var s = actx ? actx.state : 'no-ctx';
      s += bgm ? (' bgm(paused=' + bgm.paused + ',rs=' + bgm.readyState + ')') : ' bgm(none)';
      return s;
    },
    reset: function () {
      try { window.localStorage.removeItem(DWELL_KEY); } catch (e1) {}
      try { window.sessionStorage.removeItem(DONE_KEY); } catch (e2) {}
      acc = 0;
    }
  };
})();
