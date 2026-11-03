/* ============================================================
   罗辑的续集弹窗（站点级，接在黑客弹窗后面）

   黑客弹窗关掉后 1 分钟，只要还在站内就弹这个：
   一屏收款码 + 「V我50」，两个选择：
     - 我拒绝  → 文案换成「好吧人类，我只能帮你到这了」，点空白关掉
     - 已付款  → 强制跳 B 站

   跨页计时：prank.js 关窗时在 sessionStorage 写了 mg.hack.closed，
   本脚本每次进页面按这个时间戳接着算，不会因为翻页而重新计时。

   调试：?roji=now 立刻弹（不看计时）；?roji=reset 清掉「已弹过」标记
   ============================================================ */
(function () {
  'use strict';

  var CLOSED_KEY = 'mg.hack.closed';   /* prank.js 关窗时写的时间戳 */
  var DONE_KEY = 'mg.roji.done';       /* 本会话已经弹过 */
  var WAIT = 60000;                    /* 黑客弹窗之后 1 分钟 */
  var JUMP_URL = 'https://www.bilibili.com/video/BV1GJ411x7h7/?spm_id_from=333.337.search-card.all.click&vd_source=803992010867757d64d19fe17dd301bd';

  var TITLE = '你好人类，我是罗辑的扮演者，你知不知道我不重要，但你需要知道的是我成功帮你击退了黑客，但是你的坐标已经暴露，现在三体舰队正在赶来的路上，V我50，我带你乘坐超光速飞船避难';
  var REFUSE = '好吧人类，我只能帮你到这了';

  /* 图片路径：按脚本自己的 src 反推站点根，根目录页和 g/ 下都能用 */
  var script = document.currentScript;
  var BASE = '';

  if (script && script.src) {
    BASE = script.src.replace(/js\/roji\.js.*$/, '');
  }

  var CSS = [
    '.rb{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;',
    '  padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom));background:rgba(6,7,10,.88);',
    '  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}',
    '.rb[hidden]{display:none;}',
    '.rb-box{width:100%;max-width:360px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);',
    '  overflow:auto;-webkit-overflow-scrolling:touch;background:#0f1115;border:1px solid rgba(255,255,255,.14);',
    '  border-radius:18px;padding:22px 18px 18px;color:#e6e8ee;box-shadow:0 30px 80px rgba(0,0,0,.62);',
    '  animation:rb-pop .22s cubic-bezier(.2,.9,.3,1.2);}',
    '.rb-title{margin:0 0 14px;font-size:13.5px;font-weight:600;line-height:1.85;color:#e9ebf0;text-align:left;}',
    '.rb-qrs{display:flex;align-items:flex-start;gap:10px;margin:0 0 14px;}',
    '.rb-qr{flex:1 1 0;min-width:0;padding:5px;background:#fff;border-radius:10px;}',
    '.rb-qr img{display:block;width:100%;height:210px;object-fit:contain;border-radius:6px;}',
    '.rb-actions{display:flex;gap:10px;}',
    '.rb-qrs[hidden],.rb-actions[hidden]{display:none;}',
    '.rb-btn{flex:1;height:46px;font-family:inherit;font-size:14px;font-weight:650;color:#e6e8ee;',
    '  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);border-radius:12px;',
    '  cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}',
    '.rb-btn.is-primary{color:#fff;background:#2563eb;border-color:transparent;}',
    '.rb-btn:active{opacity:.86;}',
    '@keyframes rb-pop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}'
  ].join('');

  var root = null;
  var box = null;
  var titleEl = null;
  var timers = [];

  function read(key) {
    try {
      return parseInt(window.sessionStorage.getItem(key), 10) || 0;
    } catch (err) {
      return 0;
    }
  }

  function write(key, v) {
    try {
      window.sessionStorage.setItem(key, String(v));
    } catch (err) {
      /* 存不进去就只在当前页管用 */
    }
  }

  function lockScroll(on) {
    if (!document.body) {
      return;
    }

    if (on) {
      if (!document.body.dataset.rbOverflow) {
        document.body.dataset.rbOverflow = document.body.style.overflow || ' ';
      }
      document.body.style.overflow = 'hidden';
    } else if (document.body.dataset.rbOverflow) {
      document.body.style.overflow = document.body.dataset.rbOverflow === ' '
        ? ''
        : document.body.dataset.rbOverflow;
      delete document.body.dataset.rbOverflow;
    }
  }

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.className = 'rb';
    root.innerHTML =
      '<div class="rb-box" role="dialog" aria-modal="true" aria-labelledby="rbTitle">' +
        '<p class="rb-title" id="rbTitle"></p>' +
        '<div class="rb-qrs">' +
          '<div class="rb-qr"><img src="' + BASE + 'assets/roji-qr-alipay.jpg" alt="支付宝收款码"></div>' +
          '<div class="rb-qr"><img src="' + BASE + 'assets/roji-qr-wechat.jpg" alt="微信收款码"></div>' +
        '</div>' +
        '<div class="rb-actions">' +
          '<button class="rb-btn" id="rbNo" type="button">我拒绝</button>' +
          '<button class="rb-btn is-primary" id="rbYes" type="button">已付款</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);

    box = root.querySelector('.rb-box');
    titleEl = root.querySelector('#rbTitle');
    titleEl.textContent = TITLE;

    root.querySelector('#rbNo').addEventListener('pointerdown', onRefuse);
    root.querySelector('#rbYes').addEventListener('pointerdown', onPay);

    /* 拒绝之后点空白关闭 */
    root.addEventListener('pointerdown', function (event) {
      if (event.target === root) {
        close();
      }
    });

    lockScroll(true);
  }

  function onRefuse(event) {
    event.preventDefault();

    if (!root || root.hidden) {
      return;
    }

    titleEl.textContent = REFUSE;

    var qrs = root.querySelector('.rb-qrs');
    var actions = root.querySelector('.rb-actions');

    if (qrs) {
      qrs.hidden = true;
    }

    if (actions) {
      actions.hidden = true;
    }
  }

  function onPay(event) {
    event.preventDefault();
    write(DONE_KEY, 1);
    window.location.href = JUMP_URL;
  }

  function close() {
    if (!root) {
      return;
    }

    root.hidden = true;
    lockScroll(false);
  }

  function show() {
    if (read(DONE_KEY) === 1) {
      return;
    }

    if (!root) {
      build();
    }

    root.hidden = false;
    write(DONE_KEY, 1);
    window.__rojiShown = true;   /* 给 js/manager.js 用：同一页别叠两个弹窗 */
  }

  var armed = false;

  function schedule() {
    if (armed || read(DONE_KEY) === 1) {
      return;
    }

    if (forceNow) {
      armed = true;
      show();
      return;
    }

    var t = read(CLOSED_KEY);

    if (!t) {
      return;
    }

    var left = WAIT - (Date.now() - t);

    armed = true;

    if (left <= 0) {
      show();
      return;
    }

    timers.push(window.setTimeout(show, left));
  }

  /* ---------- 调试参数 ---------- */

  var forceNow = false;

  try {
    var qs = String(window.location.search || '');

    if (/[?&]roji=reset/.test(qs)) {
      try { window.sessionStorage.removeItem(DONE_KEY); } catch (e1) {}
      try { window.sessionStorage.removeItem(CLOSED_KEY); } catch (e2) {}
    }

    forceNow = /[?&]roji=now/.test(qs);
  } catch (err6) {
    forceNow = false;
  }

  /* ---------- 起飞 ---------- */

  if (read(DONE_KEY) !== 1) {
    window.addEventListener('mg:hack-closed', schedule);
    schedule();
  }
})();
