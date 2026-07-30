(function () {
  'use strict';

  var body = document.body;
  var moduleType = body && body.dataset.yaraModule;
  if (!moduleType || body.dataset.yaraDeepReady === 'true') return;
  body.dataset.yaraDeepReady = 'true';

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function route(label, level, meta) {
    if (window.YaraBridge) window.YaraBridge.route(clean(label), level || 3, meta || {});
  }

  function routeStable(label, level, meta) {
    route(label, level, meta);
    setTimeout(function () { route(label, level, meta); }, 320);
  }

  function setHash(key, value) {
    if (!window.history || !history.replaceState) return;
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    params.set(key, String(value || ''));
    history.replaceState(null, '', location.pathname + location.search + '#' + params.toString());
  }

  function clearHash(key) {
    if (!window.history || !history.replaceState) return;
    var params = new URLSearchParams(location.hash.replace(/^#/, ''));
    params.delete(key);
    var hash = params.toString();
    history.replaceState(null, '', location.pathname + location.search + (hash ? '#' + hash : ''));
  }

  function returnToParent() {
    clearHash('detail');
    if (moduleType === 'career') {
      var careerTab = document.querySelector('.section-nav [data-nav].active');
      if (careerTab) {
        route(clean(careerTab.textContent), 3, { view: careerTab.dataset.nav });
        setHash('view', careerTab.dataset.nav);
        return;
      }
    }
    if (moduleType === 'academic') {
      var academicItem = document.querySelector('.nav-item.active');
      if (academicItem) {
        route(clean(academicItem.textContent), 3, {});
        return;
      }
    }
    if (moduleType.indexOf('schedule-') === 0) {
      var scheduleStep = document.querySelector('.yara-step.active');
      if (scheduleStep) {
        route(clean(scheduleStep.textContent), 3, { section: scheduleStep.dataset.target });
        return;
      }
    }
    route(document.title, 2, { detail: false });
  }

  function makeDrawer() {
    var backdrop = document.createElement('div');
    backdrop.className = 'yara-detail-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML =
      '<aside class="yara-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="yaraDetailTitle">' +
        '<header class="yara-detail-head"><div><div class="yara-detail-kicker">DETAIL / 04</div><h2 id="yaraDetailTitle">详情</h2></div>' +
        '<button class="yara-detail-close" type="button" aria-label="关闭详情">×</button></header>' +
        '<div class="yara-detail-grid"></div><p class="yara-detail-hint">该详情层只读取当前页面信息，不修改任何底层数据。</p>' +
      '</aside>';
    document.body.appendChild(backdrop);

    function close() {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
      returnToParent();
    }
    backdrop.querySelector('.yara-detail-close').addEventListener('click', close);
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) close();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && backdrop.classList.contains('open')) close();
    });
    return {
      open: function (title, fields) {
        backdrop.querySelector('#yaraDetailTitle').textContent = clean(title) || '详情';
        backdrop.querySelector('.yara-detail-grid').innerHTML = fields.map(function (field) {
          return '<section class="yara-detail-field"><span>' + escapeHtml(field.label) + '</span><p>' + escapeHtml(field.value || '—') + '</p></section>';
        }).join('');
        backdrop.classList.add('open');
        backdrop.setAttribute('aria-hidden', 'false');
        routeStable(clean(title) || '详情', 4, { detail: true });
        setHash('detail', clean(title) || '详情');
        setTimeout(function () { backdrop.querySelector('.yara-detail-close').focus(); }, 30);
      }
    };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  var drawer = makeDrawer();

  function tableDetails(row) {
    if (!row || row.classList.contains('chapter-row')) return;
    var table = row.closest('table');
    if (!table) return;
    var headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) {
      return clean(th.textContent) || '字段';
    });
    var cells = Array.prototype.map.call(row.children, function (cell, index) {
      return { label: headers[index] || ('字段 ' + (index + 1)), value: clean(cell.textContent) };
    }).filter(function (field) { return field.value; });
    if (!cells.length) return;
    var titleField = cells.find(function (field) { return /名称|课程|课节|岗位/.test(field.label); });
    drawer.open(titleField ? titleField.value : '记录详情', cells);
  }

  function enhanceTableRows(root) {
    (root || document).querySelectorAll('tbody tr:not(.chapter-row)').forEach(function (row) {
      if (row.dataset.yaraDetailBound === 'true') return;
      row.dataset.yaraDetailBound = 'true';
      row.classList.add('yara-detail-capable');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', '打开记录详情');
      row.addEventListener('click', function (event) {
        if (event.target.closest('input,button,a,label,select,textarea')) return;
        tableDetails(row);
      });
      row.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') tableDetails(row);
      });
    });
  }

  function enhanceCardDetails(root) {
    (root || document).querySelectorAll('.requirement-row,.gap-card,.phase-task,.story-card').forEach(function (card) {
      if (card.dataset.yaraDetailBound === 'true') return;
      card.dataset.yaraDetailBound = 'true';
      card.classList.add('yara-detail-capable');
      card.setAttribute('tabindex', '0');
      function open() {
        var heading = card.querySelector('h3,strong');
        drawer.open(heading ? heading.textContent : '能力详情', [
          { label: '完整信息', value: clean(card.innerText || card.textContent) }
        ]);
      }
      card.addEventListener('click', function (event) {
        if (!event.target.closest('button,a,input')) open();
      });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') open();
      });
    });
  }

  function enhanceAcademic() {
    var menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) menuToggle.setAttribute('aria-label', '打开教务导航');
    var originalSwitch = window.switchModule;
    if (typeof originalSwitch === 'function') {
      window.switchModule = function (id) {
        var result = originalSwitch.apply(this, arguments);
        setTimeout(function () {
          var active = document.querySelector('.nav-item.active');
          var label = active ? clean(active.textContent) : clean(document.getElementById('pageTitle').textContent);
          route(label, 3, { moduleId: id });
          setHash('module', id);
          enhanceTableRows(document.getElementById('content'));
        }, 0);
        return result;
      };
    }
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.setAttribute('role', 'button');
      item.setAttribute('aria-current', item.classList.contains('active') ? 'page' : 'false');
    });
  }

  function enhanceSchedule() {
    var originalTitle = body.querySelector(':scope > h1');
    var originalSubtitle = body.querySelector(':scope > h2');
    var firstModule = document.querySelector('.module');
    if (originalTitle && firstModule) {
      var hero = document.createElement('header');
      hero.className = 'yara-deep-hero';
      hero.innerHTML =
        '<div><div class="yara-deep-kicker">YARA ACADEMIC FLOW · 02 / 04</div><h1>' + escapeHtml(originalTitle.textContent) + '</h1>' +
        '<p>' + escapeHtml(originalSubtitle ? originalSubtitle.textContent : '统一排课与课节交付工作流') + '</p></div>' +
        '<div class="yara-deep-status"><div><strong>4</strong>阶段联动</div></div>';
      body.insertBefore(hero, firstModule);
    }

    var modules = Array.prototype.slice.call(document.querySelectorAll('.module[id]'));
    if (!modules.length) return;
    var rail = document.createElement('nav');
    rail.className = 'yara-step-rail';
    rail.setAttribute('aria-label', '课表工作流阶段');
    modules.forEach(function (section, index) {
      var labelNode = section.querySelector('.module-title');
      var badge = section.querySelector('.module-badge');
      var label = clean(labelNode ? labelNode.textContent : section.id);
      section.dataset.yaraStep = String(index);
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'yara-step' + (index === 0 ? ' active' : '');
      button.dataset.target = section.id;
      button.innerHTML = '<span class="yara-step-no">' + index + '</span><span class="yara-step-copy"><strong>' +
        escapeHtml(label.replace(/^模块[一二三四]：?/, '')) + '</strong><small>' +
        escapeHtml(badge ? badge.textContent : '可查看') + '</small></span>';
      button.addEventListener('click', function () {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        rail.querySelectorAll('.yara-step').forEach(function (item) { item.classList.toggle('active', item === button); });
        route(label, 3, { step: index, section: section.id });
        setHash('step', section.id);
      });
      rail.appendChild(button);
    });
    body.insertBefore(rail, modules[0]);

    function syncRail() {
      modules.forEach(function (section) {
        var button = rail.querySelector('[data-target="' + section.id + '"]');
        var badge = section.querySelector('.module-badge');
        if (!button) return;
        var isComplete = !!(badge && badge.classList.contains('confirmed'));
        if (button.classList.contains('complete') !== isComplete) {
          button.classList.toggle('complete', isComplete);
        }
        var small = button.querySelector('small');
        var badgeText = badge ? clean(badge.textContent) : '';
        if (small && badge && small.textContent !== badgeText) small.textContent = badgeText;
      });
    }
    syncRail();
    var railObserver = new MutationObserver(syncRail);
    modules.forEach(function (section) {
      railObserver.observe(section, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        characterData: true
      });
    });

    document.querySelectorAll('.filter-btn,.chapter-tab,.weekday-btn').forEach(function (tab) {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('tabindex', '0');
      tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
    });
    document.addEventListener('click', function (event) {
      var tab = event.target.closest('.filter-btn,.chapter-tab,.weekday-btn');
      if (!tab) return;
      setTimeout(function () {
        var group = tab.parentElement;
        group.querySelectorAll('[role="tab"]').forEach(function (item) {
          item.setAttribute('aria-selected', item.classList.contains('active') ? 'true' : 'false');
        });
        var level = tab.classList.contains('chapter-tab') ? 4 : 3;
        route(clean(tab.textContent), level, { control: tab.className });
      }, 0);
    });
  }

  function enhanceCareer() {
    syncCareerNav();
    document.addEventListener('click', function (event) {
      var nav = event.target.closest('[data-nav]');
      if (nav) {
        setTimeout(function () {
          syncCareerNav();
          clearHash('job');
          clearHash('detail');
          route(clean(nav.textContent), 3, { view: nav.dataset.nav });
          setHash('view', nav.dataset.nav);
        }, 0);
      }
      var job = event.target.closest('[data-open-job],[data-select-job],[data-job-id]');
      if (job) {
        setTimeout(function () {
          syncCareerNav();
          var jobId = job.dataset.openJob || job.dataset.selectJob || job.dataset.jobId || '';
          var hero = document.querySelector('#jobHero h2');
          setHash('view', 'jobs');
          setHash('job', jobId);
          routeStable(hero ? hero.textContent : '岗位详情', 4, { jobId: jobId });
        }, 0);
      }
      var action = event.target.closest('[data-action]');
      if (action && action.dataset.action === 'open-jd-modal') {
        setHash('detail', 'new-jd');
        routeStable('新增意向岗位', 4, { modal: 'jd' });
      }
      if (action && action.dataset.action === 'close-jd-modal') {
        setTimeout(returnToParent, 0);
      }
    });
    document.querySelectorAll('details').forEach(function (details) {
      details.addEventListener('toggle', function () {
        if (details.open) routeStable(clean(details.querySelector('summary').textContent), 4, { details: true });
      });
    });
    enhanceCardDetails(document);
  }

  function syncCareerNav() {
    document.querySelectorAll('.section-nav [data-nav]').forEach(function (tab) {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
    });
  }

  if (moduleType === 'academic') enhanceAcademic();
  if (moduleType.indexOf('schedule-') === 0) enhanceSchedule();
  if (moduleType === 'career') enhanceCareer();

  enhanceTableRows(document);
  var enhanceTimer = 0;
  new MutationObserver(function () {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(function () {
      enhanceTableRows(document);
      if (moduleType === 'career') {
        enhanceCardDetails(document);
        syncCareerNav();
      }
    }, 80);
  }).observe(document.body, { childList: true, subtree: true });
})();
