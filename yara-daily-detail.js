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

  // 外壳内由左上角全局返回胶囊负责逐级返回，页内两个返回入口去重隐藏；
  // 独立打开（无外壳、无胶囊）时保留，不影响裸页浏览。
  // 用短轮询代替一次性检查：胶囊由外壳在 frame load 时注入，与本页 load 时序不保证。
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
