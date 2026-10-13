/* ==========================================================================
   留白 liubai — 交互脚本（无依赖，原生 JS）
   ========================================================================== */
(function () {
  'use strict';

  var body = document.body;
  var mqMobile = window.matchMedia('(max-width: 720px)');

  /* ── 0. 入场层：点击后才进入主页 ─────────────────────────────────────── */
  var intro = document.getElementById('intro');
  if (intro) {
    if (document.documentElement.classList.contains('intro-skip')) {
      // 本会话已经看过，直接移除（放在 <head> 的内联脚本已经决定跳过）
      if (intro.parentNode) intro.parentNode.removeChild(intro);
      document.documentElement.classList.remove('intro-active');
    } else {
      body.classList.add('intro-lock');

      var enterBtn = document.getElementById('intro-enter');
      var leaving = false;

      var finish = function () {
        intro.classList.add('is-gone');
        if (intro.parentNode) intro.parentNode.removeChild(intro);
        // 解除挂起，首屏底图与文字这时才开始入场
        document.documentElement.classList.remove('intro-active');
      };

      var leave = function () {
        if (leaving) return;
        leaving = true;
        document.removeEventListener('keydown', onKey, true);
        intro.classList.add('is-leaving');
        body.classList.remove('intro-lock');
        try { sessionStorage.setItem('liubai-intro-seen', '1'); } catch (e) {}
        window.setTimeout(finish, 1850);
      };

      var onKey = function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
          e.preventDefault();
          leave();
        }
      };

      // 整个遮罩任意处点击也能进入
      intro.addEventListener('click', leave);
      document.addEventListener('keydown', onKey, true);

      if (enterBtn) {
        enterBtn.focus({ preventScroll: true });
      }

      // 兜底：万一用户什么都不点，8 秒后不自动进入（保留），
      // 但要保证滚动锁不会真的把页面卡死 —— 解锁逻辑只在 leave() 里
    }
  }

  // 兜底：intro-active 会让首屏文字保持隐藏。
  // 如果入场层因为任何原因已经不在了，却还挂着 intro-active，必须清掉，
  // 否则标题会永久看不见。
  if (document.documentElement.classList.contains('intro-active') && !document.getElementById('intro')) {
    document.documentElement.classList.remove('intro-active');
  }

  /* ── 0b. 入场层的时段问候与实时时钟 ──────────────────────────────────── */
  var greetEl = document.getElementById('intro-greet');
  var clockEl = document.getElementById('intro-clock');
  if (greetEl || clockEl) {
    var part = document.documentElement.getAttribute('data-daypart') || 'day';
    var GREET = {
      dawn:  'GOOD MORNING · 晨',
      day:   'GOOD DAY · 昼',
      dusk:  'GOOD EVENING · 暮',
      night: 'GOOD NIGHT · 夜'
    };
    if (greetEl) greetEl.textContent = GREET[part] || GREET.day;

    if (clockEl) {
      var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
      var tickClock = function () {
        var t = new Date();
        clockEl.textContent = pad2(t.getHours()) + ':' + pad2(t.getMinutes());
      };
      tickClock();
      window.setInterval(tickClock, 15000);
    }

    /* 页面一直开着时也要能跨时段：每分钟比对一次，
       变了就先扫一层天光再切配色（只在没被 force_daypart 固定时才做） */
    var hourToPart = function (h) {
      if (h >= 5 && h < 8) return 'dawn';
      if (h >= 8 && h < 17) return 'day';
      if (h >= 17 && h < 20) return 'dusk';
      return 'night';
    };
    window.setInterval(function () {
      var d = document.documentElement;
      if (d.getAttribute('data-forced') === '1') return;
      var want = hourToPart(new Date().getHours());
      if (want === d.getAttribute('data-daypart')) return;
      d.classList.add('is-shifting');
      d.setAttribute('data-daypart', want);
      if (greetEl) greetEl.textContent = GREET[want] || GREET.day;
      var hud = document.getElementById('hero-daypart');
      if (hud) {
        var N = { dawn: 'DAWN 05-08', day: 'DAY 08-17', dusk: 'DUSK 17-20', night: 'NIGHT 20-05' };
        hud.textContent = N[want] || N.day;
      }
      window.setTimeout(function () { d.classList.remove('is-shifting'); }, 1600);
    }, 60000);
  }

  /* ── 1. 顶部导航：默认收起，鼠标靠近屏幕顶部才滑出 ───────────────────── */
  var nav = document.getElementById('site-nav');
  if (nav) {
    var zoneEl = document.querySelector('.nav-zone');
    var zoneH = zoneEl ? (zoneEl.offsetHeight || 90) : 90;
    var pinAt = parseInt(nav.getAttribute('data-pin-after') || '260', 10);
    // 迟滞区间：往下移出后要超过这个位置才收起，避免贴着边缘抖动
    var hideAt = zoneH + 76;

    var onMove = function (e) {
      if (mqMobile.matches) return;
      var y = e.clientY;
      if (y <= zoneH) {
        body.classList.add('nav-show');
      } else if (y > hideAt) {
        body.classList.remove('nav-show');
      }
    };
    document.addEventListener('mousemove', onMove, { passive: true });

    // 键盘用户 Tab 进导航时同样要可见
    nav.addEventListener('focusin', function () { body.classList.add('nav-show'); });

    // 点击导航里的链接后收起
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && mqMobile.matches) body.classList.remove('nav-open');
    });

    var onScroll = function () {
      if (pinAt > 0 && window.scrollY > pinAt) body.classList.add('nav-pinned');
      else body.classList.remove('nav-pinned');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 2. 移动端菜单开关 ─────────────────────────────────────────────────── */
  var toggle = document.getElementById('nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ── 3. 滚动渐显 ───────────────────────────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reveals.length) {
    /* 无元素 */
  } else if (reduceMotion || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }

  // 兜底：无论观察器是否正常，3 秒后一律显示，避免内容被永久隐藏
  if (reveals.length) {
    window.setTimeout(function () {
      Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
    }, 3000);
  }

  /* ── 4. 从正文标题生成目录 ─────────────────────────────────────────────── */
  var toc = document.getElementById('toc');
  var prose = document.getElementById('prose');
  if (toc && prose) {
    var heads = prose.querySelectorAll('h2, h3');
    if (!heads.length) {
      var block = toc.closest('.aside-block');
      if (block) block.style.display = 'none';
    } else {
      var ol = document.createElement('ol');
      Array.prototype.forEach.call(heads, function (h, i) {
        if (!h.id) h.id = 'h-' + (i + 1);
        var li = document.createElement('li');
        li.className = h.tagName === 'H3' ? 'toc-h3' : 'toc-h2';
        var a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent.replace(/^#\s*/, '').trim();
        li.appendChild(a);
        ol.appendChild(li);
      });
      toc.appendChild(ol);

      // 目录跟随滚动高亮
      var links = toc.querySelectorAll('a');
      if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            Array.prototype.forEach.call(links, function (l) {
              l.classList.toggle('is-current', l.getAttribute('href') === '#' + entry.target.id);
            });
          });
        }, { rootMargin: '-84px 0px -70% 0px' });
        Array.prototype.forEach.call(heads, function (h) { spy.observe(h); });
      }
    }
  }

  /* ── 5. 首屏 HUD 上显示当前时段 ──────────────────────────────────────────
     视差交给 CSS 的 kenburns（常驻缓慢推近），比滚动驱动更顺，也不需要
     每帧写 style 造成抖动。 */
  var hudPart = document.getElementById('hero-daypart');
  if (hudPart) {
    var NAMES = { dawn: 'DAWN 05-08', day: 'DAY 08-17', dusk: 'DUSK 17-20', night: 'NIGHT 20-05' };
    var p = document.documentElement.getAttribute('data-daypart') || 'day';
    hudPart.textContent = NAMES[p] || NAMES.day;
  }

  /* ── 6. 顶部阅读进度线 ─────────────────────────────────────────────────── */
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var onProgress = function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)).toFixed(4) + ')';
  };
  window.addEventListener('scroll', onProgress, { passive: true });
  window.addEventListener('resize', onProgress);
  onProgress();

  /* ── 7. 侧栏统计数字滚动 ───────────────────────────────────────────────── */
  var statNums = document.querySelectorAll('.aside-stats dd');
  if (statNums.length) {
    Array.prototype.forEach.call(statNums, function (el) {
      var target = parseInt(el.textContent, 10);
      if (isNaN(target) || target <= 0 || reduceMotion) return;
      var startTs = null;
      el.textContent = '0';
      var stepNum = function (ts) {
        if (startTs === null) startTs = ts;
        var k = Math.min(1, (ts - startTs) / 900);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) window.requestAnimationFrame(stepNum);
      };
      window.requestAnimationFrame(stepNum);
      /* 兜底：rAF 万一没跑起来（后台标签页、无头渲染等），也要把真实值写回去，
         否则统计数字会永远停在 0 */
      window.setTimeout(function () { el.textContent = target; }, 1400);
    });
  }

  /* ── 8. 昼夜模式切换：自动 → 日间 → 夜间 → 自动 ───────────────────────── */
  var modeBtn = document.getElementById('mode-toggle');
  var modeLabel = document.getElementById('mode-label');
  if (modeBtn) {
    var MODES = ['auto', 'day', 'night'];
    var LABELS = { auto: '自动', day: '日间', night: '夜间' };
    var NAMES = { dawn: 'DAWN 05-08', day: 'DAY 08-17', dusk: 'DUSK 17-20', night: 'NIGHT 20-05' };
    var partFromHour = function (h) {
      if (h >= 5 && h < 8) return 'dawn';
      if (h >= 8 && h < 17) return 'day';
      if (h >= 17 && h < 20) return 'dusk';
      return 'night';
    };

    var stored = 'auto';
    try {
      var sv = localStorage.getItem('liubai-mode');
      if (sv === 'day' || sv === 'night') stored = sv;
    } catch (e) {}

    var applyMode = function (mode, animate) {
      var d = document.documentElement;
      var next = mode === 'auto' ? partFromHour(new Date().getHours()) : mode;

      // 用之前那套「天光扫过」做过渡
      if (animate && d.getAttribute('data-daypart') !== next && !reduceMotion) {
        d.classList.add('is-shifting');
        window.setTimeout(function () { d.classList.remove('is-shifting'); }, 1600);
      }
      d.setAttribute('data-daypart', next);
      if (mode === 'auto') d.removeAttribute('data-forced');
      else d.setAttribute('data-forced', '1');

      modeBtn.setAttribute('data-mode', mode);
      if (modeLabel) modeLabel.textContent = LABELS[mode];

      var hud = document.getElementById('hero-daypart');
      if (hud) hud.textContent = NAMES[next] || NAMES.day;
    };

    /* 只有「用户明确选过」或「没有任何强制来源」时才由 JS 决定时段，
       否则会把 URL 的 ?daypart= 或主题配置的 force_daypart 覆盖掉 */
    var hasUserMode = (stored === 'day' || stored === 'night');
    var forcedByPage = document.documentElement.hasAttribute('data-forced');
    if (hasUserMode) {
      applyMode(stored, false);
    } else if (!forcedByPage) {
      applyMode('auto', false);
    } else {
      modeBtn.setAttribute('data-mode', 'auto');
      if (modeLabel) modeLabel.textContent = LABELS.auto;
    }

    modeBtn.addEventListener('click', function () {
      var cur = modeBtn.getAttribute('data-mode') || 'auto';
      var nextMode = MODES[(MODES.indexOf(cur) + 1) % MODES.length];
      try {
        if (nextMode === 'auto') localStorage.removeItem('liubai-mode');
        else localStorage.setItem('liubai-mode', nextMode);
      } catch (e) {}
      applyMode(nextMode, true);
    });
  }

  /* ── 头图明暗自适应（逐元素）────────────────────────────────────────────
     白天不压暗之后，白字在亮图上会糊。这里不是整页一个判断，而是**每个文字
     各自采样自己正后方的画面**：

       1. 把头图按 background-size:cover 的规则映射回原图像素坐标
          （要求出 scale、offsetX、offsetY，否则位置全错）
       2. 对每个元素，取它的 bounding rect 映射到原图上的那块
       3. 算那块的平均感知亮度，写在该元素自己的 data-tone 上

     亮度用感知公式 0.2126R + 0.7152G + 0.0722B —— 同样数值的蓝和绿，
     人眼觉得绿亮得多，直接平均 RGB 会判错。 */
  (function () {
    var hero = document.querySelector('.hero');
    var media = document.querySelector('.hero-media');
    if (!hero || !media) return;

    var TARGETS = ['.hero-title', '.hero-tagline', '.hero-vertical'];
    var THRESHOLD = 150;

    /* 主题配置里 hero.tone 设成 light / dark 就强制，设 auto 才走识别 */
    var forced = hero.getAttribute('data-tone-force');
    if (forced === 'light' || forced === 'dark') {
      TARGETS.forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) el.setAttribute('data-tone', forced);
      });
      return;
    }

    function currentImg() {
      var l = media.querySelector('.hero-img-day') || media.querySelector('.hero-img');
      if (!l) return null;
      var cs = getComputedStyle(l);
      var m = (cs.backgroundImage || '').match(/url\(["']?(.*?)["']?\)/);
      if (!m) return null;
      var pos = (cs.backgroundPosition || '50% 50%').split(/\s+/);
      var px = parseFloat(pos[0]) / 100; if (isNaN(px)) px = .5;
      var py = parseFloat(pos[1]) / 100; if (isNaN(py)) py = .5;
      return { url: m[1], px: px, py: py };
    }

    function paint(img, meta) {
      var hw = hero.clientWidth, hh = hero.clientHeight;
      var iw = img.naturalWidth, ih = img.naturalHeight;
      if (!hw || !hh || !iw || !ih) return;

      /* cover 映射：等比放大到铺满，再按 background-position 偏移 */
      var scale = Math.max(hw / iw, hh / ih);
      var dw = iw * scale, dh = ih * scale;
      var offX = (hw - dw) * meta.px;
      var offY = (hh - dh) * meta.py;

      /* 原图缩到最长边 160 画进 canvas，够算平均又不慢 */
      var k = 160 / Math.max(iw, ih);
      var cw = Math.max(1, Math.round(iw * k)), ch = Math.max(1, Math.round(ih * k));
      var cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      var cx = cv.getContext('2d', { willReadFrequently: true });
      if (!cx) return;
      cx.drawImage(img, 0, 0, cw, ch);

      var hb = hero.getBoundingClientRect();

      TARGETS.forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;

        /* 元素相对 hero 的位置 → 原图像素 → canvas 像素 */
        var x0 = r.left - hb.left, y0 = r.top - hb.top;
        var ix0 = (x0 - offX) / scale, iy0 = (y0 - offY) / scale;
        var ix1 = (x0 + r.width - offX) / scale, iy1 = (y0 + r.height - offY) / scale;

        var sx = Math.max(0, Math.floor(ix0 * k));
        var sy = Math.max(0, Math.floor(iy0 * k));
        var ex = Math.min(cw, Math.ceil(ix1 * k));
        var ey = Math.min(ch, Math.ceil(iy1 * k));
        if (ex <= sx || ey <= sy) return;

        var d;
        try { d = cx.getImageData(sx, sy, ex - sx, ey - sy).data; }
        catch (e) { return; }

        var sum = 0, n = 0;
        for (var i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 24) continue;
          sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          n++;
        }
        if (!n) return;
        el.setAttribute('data-tone', (sum / n) >= THRESHOLD ? 'light' : 'dark');
      });
    }

    var meta = currentImg();
    if (meta) {
      var probe = new Image();
      probe.decoding = 'async';
      probe.onload = function () { paint(probe, meta); };
      probe.src = meta.url;
    }

    /* 换图（切昼夜）或改窗口大小都要重算 —— 尺寸一变，映射就全变了 */
    var lastUrl = meta && meta.url;
    var t = null;
    function recheck() {
      var m = currentImg();
      if (!m) return;
      if (m.url !== lastUrl) {
        lastUrl = m.url;
        var p2 = new Image();
        p2.decoding = 'async';
        p2.onload = function () { paint(p2, m); };
        p2.src = m.url;
      } else if (window.__liubaiLastW !== hero.clientWidth) {
        window.__liubaiLastW = hero.clientWidth;
        var p3 = new Image();
        p3.onload = function () { paint(p3, m); };
        p3.src = m.url;
      }
    }
    setInterval(recheck, 1000);
    window.addEventListener('resize', function () {
      clearTimeout(t); t = setTimeout(recheck, 250);
    }, { passive: true });
  })();
})();
