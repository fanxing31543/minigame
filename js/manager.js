/* ============================================================
   管理者的收尾弹窗（站点级，接在「罗辑」后面）

   规则：罗辑弹窗已经出现过（mg.roji.done）之后，用户再刷新 / 重新进入
   任意页面，就弹这个「你好我是网站的管理者」；本会话只弹一次。
   同一页里 roji 正在弹的话不叠加。

   点击暗色空白处关闭；按钮是新窗口打开 B 站空间，不会把当前页面带走。

   调试：?mgr=now 立刻弹；?mgr=reset 清掉「已弹过」标记
   ============================================================ */
(function () {
  'use strict';

  var ROJI_KEY = 'mg.roji.done';
  var DONE_KEY = 'mg.manager.done';
  var JUMP_URL = 'https://space.bilibili.com/609166296?spm_id_from=333.788.0.0';

  var TEXT = '你好我是网站的管理者，我已经帮你解决了三体的智子卧底（不会有人真的被骗了吧），' +
             '本整活网站纯免费，由Deepsleep辅助制作，看到这了麻烦关注B站@奶猫的龙咪谢谢喵';

  var CSS = [
    '.mgr{position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;',
    '  padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom));background:rgba(6,7,10,.88);',
    '  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}',
    '.mgr[hidden]{display:none;}',
    '.mgr-box{position:relative;width:100%;max-width:352px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);',
    '  overflow:auto;-webkit-overflow-scrolling:touch;background:#0f1115;border:1px solid rgba(255,255,255,.14);',
    '  border-radius:18px;padding:22px 18px 18px;color:#e6e8ee;box-shadow:0 30px 80px rgba(0,0,0,.62);',
    '  animation:mgr-pop .22s cubic-bezier(.2,.9,.3,1.2);}',
    '.mgr-x{position:absolute;top:4px;right:4px;width:44px;height:44px;display:flex;align-items:center;',
    '  justify-content:center;padding:0;font-family:inherit;font-size:22px;line-height:1;color:#fff;background:none;',
    '  border:none;border-radius:12px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}',
    '.mgr-x:active{background:rgba(255,255,255,.08);}',
    '.mgr-text{margin:0 0 16px;padding-right:30px;font-size:13.5px;font-weight:600;line-height:1.85;color:#e9ebf0;text-align:left;}',
    '.mgr-link{display:flex;align-items:center;justify-content:center;height:46px;font-size:14px;font-weight:650;',
    '  color:#fff;text-decoration:none;background:#2563eb;border-radius:12px;touch-action:manipulation;',
    '  -webkit-tap-highlight-color:transparent;}',
    '.mgr-link:active{opacity:.86;}',
    '@keyframes mgr-pop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}'
  ].join('');

  var root = null;
  var shown = false;

  function read(key) {
    try {
      return window.sessionStorage.getItem(key) === '1';
    } catch (err) {
      return false;
    }
  }

  function write(key) {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch (err) {
      /* 存不进去就只在当前页管用 */
    }
  }

  function lockScroll(on) {
    if (!document.body) {
      return;
    }

    if (on) {
      if (!document.body.dataset.mgrOverflow) {
        document.body.dataset.mgrOverflow = document.body.style.overflow || ' ';
      }
      document.body.style.overflow = 'hidden';
    } else if (document.body.dataset.mgrOverflow) {
      document.body.style.overflow = document.body.dataset.mgrOverflow === ' '
        ? ''
        : document.body.dataset.mgrOverflow;
      delete document.body.dataset.mgrOverflow;
    }
  }

  function build() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.className = 'mgr';
    root.innerHTML =
      '<div class="mgr-box" role="dialog" aria-modal="true" aria-labelledby="mgrText">' +
        '<button class="mgr-x" id="mgrX" type="button" aria-label="关闭">&#215;</button>' +
        '<p class="mgr-text" id="mgrText"></p>' +
        '<a class="mgr-link" href="' + JUMP_URL + '" target="_blank" rel="noopener">' +
          '去 B 站关注 @奶猫的龙咪' +
        '</a>' +
      '</div>';

    document.body.appendChild(root);
    root.querySelector('#mgrText').textContent = TEXT;

    root.querySelector('#mgrX').addEventListener('pointerdown', function (event) {
      event.preventDefault();
      close();
    });

    lockScroll(true);
  }

  function close() {
    if (!root) {
      return;
    }

    root.hidden = true;
    lockScroll(false);
  }

  function show() {
    if (shown) {
      return;
    }

    shown = true;

    if (!root) {
      build();
    }

    root.hidden = false;
    write(DONE_KEY);
  }

  /* ---------- 调试参数 ---------- */

  var forceNow = false;

  try {
    var qs = String(window.location.search || '');

    if (/[?&]mgr=reset/.test(qs)) {
      try { window.sessionStorage.removeItem(DONE_KEY); } catch (e1) {}
    }

    forceNow = /[?&]mgr=now/.test(qs);
  } catch (err2) {
    forceNow = false;
  }

  /* ---------- 判定 ---------- */

  if (read(DONE_KEY) || window.__rojiShown) {
    return;
  }

  if (forceNow) {
    window.setTimeout(show, 300);
    return;
  }

  /* 还没走到「罗辑」那一步就不弹 */
  if (!read(ROJI_KEY)) {
    return;
  }

  window.setTimeout(show, 600);
})();
