/* ============================================================
   星空皮肤 · 可交互（站点级）

   在 body 里塞一层 canvas 铺在内容后面，星星会呼吸、缓慢漂移，
   跟着鼠标 / 手指：
     - 指针附近的星星会被点亮，并和指针连成星线
     - 指针附近会被轻轻推开一点
     - 点一下 / 点一下屏幕冒一个扩散的光圈

   适配：prefers-reduced-motion 时只画一帧不动；页面切后台停掉动画；
   DPR 上限 2；触屏没有 hover，所以 pointerdown 也会点亮并冒光圈。

   调参：window.STAR_CONFIG = { density: 12000, link: 160, push: 110 }
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.STAR_CONFIG || {};
  var DENSITY = typeof CFG.density === 'number' ? CFG.density : 18000;
  var LINK = typeof CFG.link === 'number' ? CFG.link : 160;
  var PUSH = typeof CFG.push === 'number' ? CFG.push : 110;

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var canvas = document.createElement('canvas');
  canvas.className = 'starfield';
  canvas.setAttribute('aria-hidden', 'true');

  var ctx = canvas.getContext('2d');
  var w = 0;
  var h = 0;
  var stars = [];
  var pointer = { x: -999, y: -999, on: false };
  var ripples = [];
  var raf = 0;
  var last = 0;
  var lastDraw = 0;
  var glow = null;

  /* 大星星的光晕预渲染成一张小图，避免每帧 createRadialGradient */
  function makeGlow() {
    var c = document.createElement('canvas');
    var g;
    var grad;

    c.width = 64;
    c.height = 64;
    g = c.getContext('2d');
    grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(220, 235, 255, 0.9)');
    grad.addColorStop(1, 'rgba(150, 190, 255, 0)');

    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);

    return c;
  }

  function seed() {
    var n = Math.min(110, Math.max(36, Math.round(w * h / DENSITY)));
    stars = [];

    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.82 ? 0.6 + Math.random() * 0.8 : 1.4 + Math.random() * 1.2,
        a: 0.35 + Math.random() * 0.5,
        sp: 0.6 + Math.random() * 1.8,
        ph: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
        big: Math.random() < 0.09
      });
    }
  }

  function resize() {
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);

    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    seed();

    if (reduce) {
      draw(0);
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    var i;
    var s;
    var dx;
    var dy;
    var d;
    var f;
    var alpha;

    /* 连星：只连指针附近这一小圈 */
    if (pointer.on) {
      ctx.lineWidth = 1;
      for (i = 0; i < stars.length; i++) {
        s = stars[i];
        dx = s.x - pointer.x;
        dy = s.y - pointer.y;
        d = Math.sqrt(dx * dx + dy * dy);

        if (d > LINK) {
          continue;
        }

        f = 1 - d / LINK;
        ctx.strokeStyle = 'rgba(170, 200, 255, ' + (f * 0.26).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
    }

    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      var ox = 0;
      var oy = 0;

      if (pointer.on) {
        dx = s.x - pointer.x;
        dy = s.y - pointer.y;
        d = Math.sqrt(dx * dx + dy * dy) || 1;

        if (d < PUSH) {
          f = (1 - d / PUSH) * 12;
          ox = (dx / d) * f;
          oy = (dy / d) * f;
        }
      }

      alpha = s.a * (0.65 + 0.35 * Math.sin(t * 0.0012 * s.sp + s.ph));

      if (pointer.on) {
        dx = s.x - pointer.x;
        dy = s.y - pointer.y;
        d = Math.sqrt(dx * dx + dy * dy);

        if (d < LINK) {
          alpha = Math.min(1, alpha + (1 - d / LINK) * 0.55);
        }
      }

      var px = s.x + ox;
      var py = s.y + oy;

      if (s.big) {
        if (!glow) {
          glow = makeGlow();
        }

        var gs = s.r * 12;

        ctx.globalAlpha = Math.min(1, alpha * 0.85);
        ctx.drawImage(glow, px - gs / 2, py - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = 'rgba(235, 242, 255, ' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 点击 / 触摸的光圈 */
    for (i = ripples.length - 1; i >= 0; i--) {
      var rp = ripples[i];
      var age = t - rp.t0;

      if (age > 1000) {
        ripples.splice(i, 1);
        continue;
      }

      var k = age / 1000;
      ctx.strokeStyle = 'rgba(190, 215, 255, ' + ((1 - k) * 0.55).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 8 + k * 150, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function step(t) {
    raf = window.requestAnimationFrame(step);

    if (!last) {
      last = t;
    }

    var dt = Math.min(64, t - last);
    last = t;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];

      s.x += s.vx * dt * 0.06;
      s.y += s.vy * dt * 0.06;

      if (s.x < -10) { s.x = w + 10; }
      if (s.x > w + 10) { s.x = -10; }
      if (s.y < -10) { s.y = h + 10; }
      if (s.y > h + 10) { s.y = -10; }
    }

    draw(t);
  }

  function start() {
    if (raf || reduce) {
      return;
    }

    last = 0;
    raf = window.requestAnimationFrame(step);
  }

  function stop() {
    if (!raf) {
      return;
    }

    window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function onMove(e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.on = true;
  }

  function onLeave() {
    pointer.on = false;
    pointer.x = -999;
    pointer.y = -999;
  }

  function onTap(e) {
    if (ripples.length > 5) {
      ripples.shift();
    }

    ripples.push({ x: e.clientX, y: e.clientY, t0: performance.now() });

    /* 触屏没有 hover，点一下也把附近点亮 */
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.on = true;
  }

  function init() {
    document.body.appendChild(canvas);
    resize();

    window.addEventListener('resize', resize);

    /* 调试：?star=debug 把内部状态挂到 window 上，方便验交互 */
    if (/[?&]star=debug/.test(String(window.location.search || ''))) {
      window.__star = { pointer: pointer, ripples: ripples, stars: stars, canvas: canvas };
    }

    if (reduce) {
      return;
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onTap, { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    start();
  }

  if (document.body) {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();
