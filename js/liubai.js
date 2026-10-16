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

  /* ── 首屏文字明暗（按昼夜手动指定）────────────────────────────────────
     不再猜图。主题配置里 hero.tone_day / tone_night 各给一个值：
       light = 墨色字（浅色头图）    dark = 白色字（深色头图）
     这里只负责把它写到每个文字元素的 data-tone 上，CSS 照此上色。
     切换昼夜时重新应用一次。 */
  (function () {
    var hero = document.querySelector('.hero');
    if (!hero) return;

    var TARGETS = ['.hero-title', '.hero-tagline', '.hero-vertical'];
    var dayTone   = hero.getAttribute('data-tone-day')   || 'dark';
    var nightTone = hero.getAttribute('data-tone-night') || 'dark';

    function apply() {
      var part = document.documentElement.getAttribute('data-daypart') || 'day';
      var want = (part === 'night') ? nightTone : dayTone;
      if (want !== 'light' && want !== 'dark') want = 'dark';
      TARGETS.forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el && el.getAttribute('data-tone') !== want) el.setAttribute('data-tone', want);
      });
    }

    apply();
    /* 昼夜切换是改 <html data-daypart>，监听它 */
    try {
      new MutationObserver(apply).observe(document.documentElement,
        { attributes: true, attributeFilter: ['data-daypart'] });
    } catch (e) {
      setInterval(apply, 1500);          /* MutationObserver 不可用就轮询兜底 */
    }
    window.addEventListener('resize', apply, { passive: true });
  })();

  /* ── 卡片 3D 跟随倾斜 ─────────────────────────────────────────────────
     鼠标在卡片上移动时，卡片朝光标方向微微翻转（rotateX/rotateY 各 ±6°）。

     每次只写 --tilt-x / --tilt-y 两个变量，CSS 负责接进 transform：
       transform: perspective(1000px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y))
     本函数**不写 --glow-x / --glow-y** —— 那团跟光标的柔光本人不要。

     跟随用 0.18 的 lerp 缓动，不硬跟（硬跟会抖）。
     悬停抬起走的是 translate、缩放走 scale，与这里的 transform 互不干扰。

     尊重 prefers-reduced-motion；触屏跳过（没有 hover 概念）。 */
  (function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduce || !fine) return;

    var MAX = 6;      /* 最大倾角，度数 */
    document.querySelectorAll('.card').forEach(function (card) {
      var raf = 0, tx = 0, ty = 0, mx = 0, my = 0;

      function flush() {
        raf = 0;
        tx += (mx - tx) * 0.18;
        ty += (my - ty) * 0.18;
        card.style.setProperty('--tilt-x', (ty * MAX).toFixed(2) + 'deg');
        card.style.setProperty('--tilt-y', (-tx * MAX).toFixed(2) + 'deg');
        if (Math.abs(mx - tx) > 0.002 || Math.abs(my - ty) > 0.002) {
          raf = requestAnimationFrame(flush);
        }
      }

      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        mx = ((e.clientX - r.left) / r.width) * 2 - 1;    /* -1 ~ 1 */
        my = ((e.clientY - r.top) / r.height) * 2 - 1;
        if (!raf) raf = requestAnimationFrame(flush);
      }, { passive: true });

      card.addEventListener('mouseleave', function () {
        mx = my = 0;
        if (!raf) raf = requestAnimationFrame(flush);
      }, { passive: true });
    });
  })();

  /* ── 导航栏：下滚收起、上滚立刻回来 ───────────────────────────────────
     只在下滚**超过一屏**之后才收，避免顶部轻微抖动就闪烁。
     用 transform 位移，不动 height —— 不触发重排。 */
  (function () {
    var nav = document.getElementById('site-nav');
    if (!nav) return;
    var last = 0, ticking = false, HIDE_AFTER = 0;

    function update() {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var up = y < last;
      last = y;

      /* 顶部附近、或往上滚 → 展开 */
      if (y < 90 || up) {
        nav.classList.remove('nav-hidden');
      } else if (y > HIDE_AFTER) {
        nav.classList.add('nav-hidden');
      }
      /* 滚起来了才让进度条/背景生效 */
      nav.classList.toggle('nav-scrolled', y > 24);
    }

    addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ── 回到顶部：出现/消失都带弹簧 ────────────────────────────────────── */
  (function () {
    var btn = document.createElement('button');
    btn.className = 'to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', '回到顶部');
    btn.innerHTML = '<span aria-hidden="true">↑</span>';
    document.body.appendChild(btn);

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop;
      btn.classList.toggle('is-on', y > 600);
    }
    addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  })();

  /* ── 区块轻微视差 ─────────────────────────────────────────────────────
     只给「最近文章」那一段和页脚一点点反向位移，制造纵深。
     幅度很小（±14px），大了会晕、也会露白。 */
  (function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    var secs = document.querySelectorAll('.section');
    if (!secs.length) return;
    var ticking = false;

    function update() {
      ticking = false;
      var vh = innerHeight;
      secs.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;    /* 屏外不算，省 CPU */
        var p = (r.top + r.height / 2 - vh / 2) / vh;        /* -1 ~ 1 */
        var shift = Math.max(-14, Math.min(14, -p * 16));
        s.style.setProperty('--sec-shift', shift.toFixed(1) + 'px');
      });
    }
    addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    addEventListener('resize', update, { passive: true });
    update();
  })();

  /* ── 导航项磁吸 ───────────────────────────────────────────────────────
     鼠标在导航条上移动时，每个导航项朝光标方向轻微偏移（最多 3px）。
     写的是 --mag-x / --mag-y，CSS 那边用 translate 接 ——
     .nav-link-cn 的 transform 已被「悬停上浮」占用，碰不得。

     纯计算，不读布局（不调 getBoundingClientRect），所以不触发重排。 */
  (function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduce || !fine) return;
    var links = document.querySelectorAll('.nav-link');
    if (!links.length) return;
    var MAX = 3;

    links.forEach(function (a) {
      a.addEventListener('mousemove', function (e) {
        var r = a.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        dx = Math.max(-1, Math.min(1, dx));
        dy = Math.max(-1, Math.min(1, dy));
        a.style.setProperty('--mag-x', (dx * MAX).toFixed(2) + 'px');
        a.style.setProperty('--mag-y', (dy * MAX).toFixed(2) + 'px');
      }, { passive: true });
      a.addEventListener('mouseleave', function () {
        a.style.setProperty('--mag-x', '0px');
        a.style.setProperty('--mag-y', '0px');
      }, { passive: true });
    });
  })();

  /* ── 首屏文字跟随鼠标微视差 ───────────────────────────────────────────
     鼠标在首屏内移动时，文字层朝鼠标反方向偏移最多 5px。
     幅度很小是刻意的 —— 大了会晕，也会让文字和背景脱节。
     只在精确指针设备上跑；滚出首屏就归零。 */
  (function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduce || !fine) return;
    var hero = document.querySelector('.hero');
    var body = document.querySelector('.hero-body');
    if (!hero || !body) return;
    var MAX = 5, raf = 0, tx = 0, ty = 0, mx = 0, my = 0;

    function flush() {
      raf = 0;
      tx += (mx - tx) * 0.10;          /* 很慢的缓动，像有惯性 */
      ty += (my - ty) * 0.10;
      body.style.setProperty('--hero-mx', tx.toFixed(2) + 'px');
      body.style.setProperty('--hero-my', ty.toFixed(2) + 'px');
      if (Math.abs(mx - tx) > 0.02 || Math.abs(my - ty) > 0.02) {
        raf = requestAnimationFrame(flush);
      }
    }
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      mx = -((e.clientX - r.left) / r.width * 2 - 1) * MAX;
      my = -((e.clientY - r.top) / r.height * 2 - 1) * MAX;
      if (!raf) raf = requestAnimationFrame(flush);
    }, { passive: true });
    hero.addEventListener('mouseleave', function () {
      mx = my = 0;
      if (!raf) raf = requestAnimationFrame(flush);
    }, { passive: true });
  })();




  /* ── 页脚「本站已安全运行」────────────────────────────────────────────
     起点从元素的 data-since 读（EJS 从 _config.yml 注入），不写死在脚本里。
     沿用旧版起点：旧站的 NewDate("2021-2-8") 用 setUTCFullYear +
     setUTCHours(0,0,0,0)，所以是 2021-02-08T00:00:00Z。

     ★ 性能：标签页切到后台时把定时器停掉 —— 没人看的秒表不该占着 CPU。
       用 visibilitychange 控制，回来立即刷新一次再续上。 */
  (function () {
    var el = document.getElementById('site-uptime');
    if (!el) return;
    var host = el.closest('.footer-runtime');
    var t0 = Date.parse((host && host.getAttribute('data-since')) || el.getAttribute('datetime') || '');
    if (!t0 || isNaN(t0)) { el.textContent = '—'; return; }

    var timer = 0;

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function tick() {
      var diff = Date.now() - t0;
      if (diff < 0) diff = 0;
      var sec = Math.floor(diff / 1000);
      var d = Math.floor(sec / 86400);
      var h = Math.floor((sec % 86400) / 3600);
      var m = Math.floor((sec % 3600) / 60);
      var s = sec % 60;
      /* 用 <b> 包住分隔符，CSS 里把 b 染成朱砂 —— 全站唯一热色只点在这种地方 */
      el.innerHTML = d + '<b>天</b>' + pad(h) + '<b>:</b>' + pad(m) + '<b>:</b>' + pad(s);
    }

    function start() { if (!timer) { tick(); timer = setInterval(tick, 1000); } }
    function stop()  { if (timer) { clearInterval(timer); timer = 0; } }

    start();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
  })();

})();
