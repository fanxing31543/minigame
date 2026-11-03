/* ============================================================
   index.html 人机验证逻辑
   ------------------------------------------------------------
   规则：
   - 「是」「不是」各点过一次才放行到 home.html
   - 两个按钮外观永远一致，不显示任何进度
   - 记录存本机 localStorage，1 天后自动失效
   - 隐藏重置入口：?k=<RESET_TOKEN> 清空记录（仅自己验收用）
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'gate_state_v1';
  var TTL = 24 * 60 * 60 * 1000;          /* 24 小时 */
  var HOME_PAGE = 'home.html';
  var TARGET_YES = 'https://ys.mihoyo.com/';        /* 原神官网 */
  var TARGET_NO = 'https://mc.kurogames.com/';      /* 鸣潮官网 */
  var COUNTDOWN_SECONDS = 3;
  var RESET_TOKEN = 'x7k2m9q4';            /* 重置口令 */

  /* ---------- 存取 ---------- */

  function readState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var state = JSON.parse(raw);
      if (!state || typeof state.ts !== 'number' || !state.ts) {
        return null;
      }
      if (Date.now() - state.ts >= TTL) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return state;
    } catch (err) {
      /* localStorage 被禁用或数据损坏：当作没有记录 */
      return null;
    }
  }

  function writeState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      /* 写不进去就退化成「每次都要重新验证」，不影响页面使用 */
      return false;
    }
  }

  function markDone(field) {
    var now = Date.now();
    var state = readState() || { yes: false, no: false, ts: now };
    state[field] = true;
    if (!state.ts) {
      state.ts = now;
    }
    writeState(state);
  }

  /* ---------- 隐藏重置入口 ---------- */

  function consumeResetRequest() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('k') !== RESET_TOKEN) {
        return;
      }
      window.localStorage.removeItem(STORAGE_KEY);
      /* 立刻把口令从地址栏抹掉：不留浏览历史，也不怕截图泄露 */
      window.history.replaceState(null, '', window.location.pathname);
      if (window.console && window.console.info) {
        window.console.info('[gate] 本机验证记录已清除');
      }
    } catch (err) {
      /* 存储不可用或参数解析失败：什么都不做，页面按正常流程走 */
    }
  }

  consumeResetRequest();

  /* ---------- 入口判断 ---------- */

  var current = readState();
  if (current && current.yes && current.no) {
    window.location.replace(HOME_PAGE);
    return;
  }

  /* ---------- DOM ---------- */

  var btnYes = document.getElementById('btn-yes');
  var btnNo = document.getElementById('btn-no');
  var overlay = document.getElementById('overlay');
  var countEl = document.getElementById('count');
  var barEl = document.getElementById('bar');

  function lockButtons() {
    btnYes.disabled = true;
    btnNo.disabled = true;
  }

  /* 从系统浏览器返回 App 时，壳会调用这个钩子（网页版不会调）。
     跳转被壳拦下来了，页面还停在「按钮已禁用 / 倒计时弹窗」的状态，这里恢复现场。 */
  var noTimer = 0;

  function onAppResume() {
    if (overlay) {
      overlay.hidden = true;
    }

    btnYes.disabled = false;
    btnNo.disabled = false;

    if (noTimer) {
      window.clearInterval(noTimer);
      noTimer = 0;
    }
  }

  window.__appResume = onAppResume;

  /* ---------- 「是」：直接去原神 ---------- */

  btnYes.addEventListener('click', function () {
    lockButtons();
    markDone('yes');
    window.location.replace(TARGET_YES);
  });

  /* ---------- 「不是」：先弹窗，再倒计时去鸣潮 ---------- */

  btnNo.addEventListener('click', function () {
    lockButtons();
    markDone('no');

    overlay.hidden = false;

    var left = COUNTDOWN_SECONDS;
    countEl.textContent = String(left);

    if (barEl) {
      barEl.style.transition = 'width ' + COUNTDOWN_SECONDS + 's linear';
      window.requestAnimationFrame(function () {
        barEl.style.width = '100%';
      });
    }

    var timer = window.setInterval(function () {
      left -= 1;
      if (left <= 0) {
        window.clearInterval(timer);
        noTimer = 0;
        window.location.replace(TARGET_NO);
        return;
      }
      countEl.textContent = String(left);
    }, 1000);

    noTimer = timer;
  });
})();
