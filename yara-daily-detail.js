(function () {
  'use strict';
  if (window.YaraDailyDetail) return;

  var body = document.body;
  var modules = Array.prototype.slice.call(document.querySelectorAll('[id^="module-"]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('a[href^="#module-"]'));
  var titleMatch = document.title.match(/\d{4}-\d{2}-\d{2}/);
  var dateLabel = titleMatch ? titleMatch[0] : '当期日报';
  var currentId = '';
  var routeTimer = 0;

  body.classList.add('yara-daily-enhanced');

  var progress = document.createElement('div');
  progress.className = 'daily-reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span></span>';
  body.appendChild(progress);

  var readerTools = document.createElement('div');
  readerTools.className = 'daily-reader-tools';
  readerTools.innerHTML =
    '<a class="daily-reader-back" href="index.html" aria-label="返回日报首页">← 日报首页</a>' +
    '<button class="daily-reader-top" type="button" aria-label="回到文章顶部">↑</button>';
  body.appendChild(readerTools);

  // 返回入口去重策略（2026-09-01 调整后）：
  // - shell 内：外壳向 iframe 注入 #yaraInjectedBack（带 data-shell="true"），CSS 强制 display:none，
  //   顶部 #routeBackBtn 是唯一返回入口；注入按钮虽不可见但元素存在，页内返回入口仍会被去重隐藏。
  // - 独立打开：yara-module-ui.js 注入 #yaraInjectedBack（带 data-standalone="true"），CSS 显示，
  //   页内返回入口被去重隐藏，用户看到右下角悬浮按钮。
  // - file:// 直开无外壳也无 yara-module-ui.js：5 秒轮询未发现注入胶囊 → 保留页内返回入口作兜底。
  // 失败不清空页内返回，确保用户始终有返回入口。
  (function dedupBackControls() {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (document.getElementById('yaraInjectedBack')) {
        clearInterval(timer);
        var inlineBack = document.querySelector('.back-link');
        if (inlineBack) inlineBack.style.display = 'none';
        var readerBack = readerTools.querySelector('.daily-reader-back');
        if (readerBack) readerBack.parentNode.removeChild(readerBack);
      } else if (tries >= 20) {
        clearInterval(timer);
        // file:// 直开或无 yara-module-ui.js：注入胶囊不存在，保留页内返回入口作为兜底，避免用户无路可退。
      }
    }, 250);
  })();

  function moduleTitle(section) {
    if (!section) return '';
    var node = section.querySelector('.module-title,h2,h3');
    return String(node ? node.textContent : section.id).replace(/\s+/g, ' ').trim().slice(0, 36);
  }

  function emitRoute(level, section) {
    clearTimeout(routeTimer);
    routeTimer = setTimeout(function () {
      if (!window.YaraBridge) return;
      var label = level >= 4 && section ? dateLabel + ' · ' + moduleTitle(section) : dateLabel;
      window.YaraBridge.route(label, level, {
        articleDate: dateLabel,
        section: section ? section.id : '',
        path: location.pathname,
        hash: section ? '#' + section.id : ''
      });
    }, 80);
  }

  function waitForBridge() {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (window.YaraBridge) {
        clearInterval(timer);
        var initial = location.hash ? document.querySelector(location.hash) : null;
        emitRoute(initial ? 4 : 3, initial);
      } else if (tries > 30) {
        clearInterval(timer);
      }
    }, 100);
  }

  function activate(id, updateHash) {
    if (!id) return;
    if (id === currentId) {
      var currentSection = document.getElementById(id);
      emitRoute(4, currentSection);
      setTimeout(function () { emitRoute(4, currentSection); }, 220);
      return;
    }
    currentId = id;
    navLinks.forEach(function (link) {
      var active = link.getAttribute('href') === '#' + id;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    var section = document.getElementById(id);
    if (updateHash && history.replaceState) {
      history.replaceState(history.state, '', location.pathname + location.search + '#' + id);
    }
    emitRoute(4, section);
    setTimeout(function () { emitRoute(4, section); }, 220);
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      var id = link.getAttribute('href').slice(1);
      activate(id, false);
    });
  });

  if ('IntersectionObserver' in window && modules.length) {
    var observer = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) { return Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top); });
      if (visible[0]) activate(visible[0].target.id, true);
    }, { rootMargin: '-18% 0px -66% 0px', threshold: [0, .08, .25] });
    modules.forEach(function (section) { observer.observe(section); });
  }

  function updateProgress() {
    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - window.innerHeight);
    var ratio = Math.max(0, Math.min(1, window.scrollY / max));
    progress.firstElementChild.style.transform = 'scaleX(' + ratio + ')';
    readerTools.classList.toggle('show-top', window.scrollY > 520);
    if (window.scrollY < 120 && currentId) {
      currentId = '';
      navLinks.forEach(function (link) {
        link.classList.remove('is-current');
        link.removeAttribute('aria-current');
      });
      emitRoute(3, null);
    }
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  readerTools.querySelector('.daily-reader-top').addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.addEventListener('yara:navigate-back', function (event) {
    var level = Number(event.detail && event.detail.targetLevel) || 2;
    if (level <= 2) {
      event.preventDefault();
      location.href = 'index.html';
      return;
    }
    if (level === 3 && (currentId || location.hash)) {
      event.preventDefault();
      currentId = '';
      if (history.replaceState) history.replaceState(history.state, '', location.pathname + location.search);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      emitRoute(3, null);
    }
  });

  updateProgress();
  waitForBridge();

  window.YaraDailyDetail = { activate: activate, date: dateLabel };
})();
