/* ============================================================
   MINIGAME · 键盘彩蛋「X X XXX」
   ------------------------------------------------------------
   按节奏敲 5 拍：
        X ─700─ X ─700─ X ─200─ X ─200─ X
   间隔容差 ±35%。每一拍可以是：
     · 26 个字母任意一个（大小写都算）
     · 0~9 任意一个数字
     · 空格
   五拍可以混着来。命中后全屏亮出 "X X XXX"，2 秒后跳转。
   可反复触发。光标在输入框里敲不算，按住不放也不算。
   手机端：用同样的节奏点 5 下屏幕（轻点，划动和长按不算）。
   注：空格在这几个页面上不再滚动页面；页面禁用了双击缩放。
   挂载：页面 </body> 前加一行
           <script src="js/egg.js"></script>      （g/ 目录下写 ../js/egg.js）
   下线：删掉那一行。
   调试：window.EGG_CONFIG = { target: '#egg', hold: 200 }
   ============================================================ */

(function () {
  'use strict';

  if (window.__MG_EGG__) {
    return;
  }
  window.__MG_EGG__ = true;

  var TARGET = 'https://www.bilibili.com/video/BV1fEy8BoEbj/?spm_id_from=333.337.search-card.all.click';
  var GAPS = [700, 700, 200, 200];   /* 四段间隔（毫秒） */
  var TOL = 0.35;                    /* 容差 ±35% */
  var HOLD = 2000;                   /* 亮出文案后多久跳 */
  var MAX_GAP = 2200;                /* 间隔超过这个数就重新开始记 */

  var times = [];
  var fired = false;

  function cfg(key, def) {
    var c = window.EGG_CONFIG || {};
    return c[key] === undefined ? def : c[key];
  }

  /* 在输入框里打字不算 */
  function isTyping(el) {
    if (!el) {
      return false;
    }
    var tag = (el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
  }

  /* 26 个字母、10 个数字、空格都算一拍 */
  function isBeatKey(key) {
    if (typeof key !== 'string') {
      return false;
    }
    return /^[a-z0-9]$/i.test(key) || key === ' ' || key === 'Spacebar';
  }

  function matchRhythm(list) {
    for (var i = 0; i < GAPS.length; i++) {
      var gap = list[i + 1] - list[i];
      var lo = GAPS[i] * (1 - TOL);
      var hi = GAPS[i] * (1 + TOL);

      if (gap < lo || gap > hi) {
        return false;
      }
    }
    return true;
  }

  function fire() {
    fired = true;
    times = [];

    var box = document.createElement('div');
    box.className = 'egg-key';
    box.innerHTML = '<span>X X XXX</span>';
    (document.body || document.documentElement).appendChild(box);

    window.setTimeout(function () {
      window.location.href = cfg('target', TARGET);
    }, cfg('hold', HOLD));
  }

  /* 记一拍；键盘和鼠标都走这里 */
  function beat() {
    if (fired) {
      return;
    }

    var now = Date.now();

    if (times.length && now - times[times.length - 1] > MAX_GAP) {
      times = [];
    }

    times.push(now);

    if (times.length > GAPS.length + 1) {
      times.shift();
    }

    if (times.length === GAPS.length + 1 && matchRhythm(times)) {
      fire();
    }
  }

  document.addEventListener('keydown', function (event) {
    if (event.repeat) {           /* 按住不放不算连击 */
      return;
    }
    if (!isBeatKey(event.key)) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (isTyping(event.target)) {
      return;
    }

    /* 空格默认会滚页面 / 触发按钮，这里吃掉 */
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
    }

    beat();
  }, true);

  /* ---------- 手机：手指点 5 下 ---------- */

  var tap = null;   /* 当前这一下触碰 */

  document.addEventListener('pointerdown', function (event) {
    if (fired || event.pointerType !== 'touch') {
      return;
    }
    if (tap || isTyping(event.target)) {
      return;
    }
    tap = { x: event.clientX, y: event.clientY, at: Date.now(), moved: false };
  }, true);

  document.addEventListener('pointermove', function (event) {
    if (!tap || event.pointerType !== 'touch') {
      return;
    }
    if (Math.abs(event.clientX - tap.x) > 12 || Math.abs(event.clientY - tap.y) > 12) {
      tap.moved = true;
    }
  }, true);

  document.addEventListener('pointerup', function (event) {
    if (!tap || event.pointerType !== 'touch') {
      return;
    }

    var current = tap;
    tap = null;

    /* 划动、长按都不算，只认轻点 */
    if (current.moved || Date.now() - current.at > 800) {
      return;
    }

    beat();
  }, true);

  document.addEventListener('pointercancel', function (event) {
    if (event.pointerType === 'touch') {
      tap = null;
    }
  }, true);

  function injectCss() {
    var css = [
      'html{touch-action:manipulation;}',
      '.egg-key{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;',
      '  background:#0b0c0f;color:#fff;animation:egg-fade .18s ease-out;}',
      '.egg-key span{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:40px;font-weight:700;',
      '  letter-spacing:.22em;animation:egg-pop .34s cubic-bezier(.2,.9,.3,1.2);}',
      '@keyframes egg-fade{from{opacity:0}to{opacity:1}}',
      '@keyframes egg-pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.egg-key,.egg-key span{animation:none}}'
    ].join('\n');

    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCss);
  } else {
    injectCss();
  }
})();
