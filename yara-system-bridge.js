(function () {
  'use strict';
  if (window.top === window || window.YaraBridge) return;

  var moduleType = document.body.dataset.yaraModule || 'generic';
  var parentOrigin = location.origin === 'null' ? '*' : location.origin;
  var lastRoute = '';
  var routeTimer;
  var snapshotTimer;
  var requestCounter = 0;
  var pendingRequests = {};

  function post(type, payload) {
    window.parent.postMessage({
      source: 'yara-module',
      version: 1,
      type: type,
      module: moduleType,
      payload: payload || {}
    }, parentOrigin);
  }

  function visible(element) {
    if (!element) return false;
    var style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
  }

  function cleanLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  }

  function activeLabel() {
    var selectors = [
      '[aria-current="page"]',
      '[role="tab"][aria-selected="true"]',
      '.nav-item.active',
      '.sidebar-item.active',
      '.tab.active',
      '.menu-item.active',
      '.period-tab.active',
      '.active[data-period]',
      '.active[data-tab]'
    ];
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        if (visible(nodes[j])) {
          var label = cleanLabel(nodes[j].getAttribute('aria-label') || nodes[j].textContent);
          if (label) return label;
        }
      }
    }
    var headings = document.querySelectorAll('main h1, main h2, .main h1, .main h2, h1, h2');
    var documentTitle = cleanLabel(document.title);
    for (var k = 0; k < headings.length; k += 1) {
      if (visible(headings[k])) {
        var heading = cleanLabel(headings[k].textContent);
        if (heading && documentTitle.indexOf(heading) !== 0) return heading;
      }
    }
    return '';
  }

  function reportRoute(preferredLabel) {
    clearTimeout(routeTimer);
    routeTimer = setTimeout(function () {
      var label = cleanLabel(preferredLabel) || activeLabel();
      var routeKey = location.pathname + location.hash + '|' + label;
      if (routeKey === lastRoute) return;
      lastRoute = routeKey;
      post('route', {
        label: label,
        level: label ? 3 : 2,
        path: location.pathname,
        hash: location.hash
      });
    }, 90);
  }

  function safeJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function reconcileSnapshot() {
    if (moduleType !== 'reconcile') return null;
    var source;
    try {
      if (typeof DATA !== 'undefined') source = DATA;
    } catch (error) {}
    if (!source || typeof source !== 'object') return null;
    var rows = [];
    Object.keys(source).forEach(function (period) {
      var runs = Array.isArray(source[period]) ? source[period] : [];
      if (!runs.length) return;
      var latest = runs.slice().sort(function (a, b) {
        return String(b.run_date || b.date || '').localeCompare(String(a.run_date || a.date || ''));
      })[0];
      (latest.rows || latest.data || []).forEach(function (row) {
        rows.push(row);
      });
    });
    var ownerMap = {};
    var unbound = 0;
    var conflicts = 0;
    var shadows = 0;
    var abnormal = 0;
    rows.forEach(function (row) {
      var isUnbound = String(row['绑定手机号'] || '').toUpperCase() === 'N';
      var isConflict = String(row['是否冲突账号'] || '').toUpperCase() === 'Y';
      if (isUnbound) unbound += 1;
      if (isConflict) conflicts += 1;
      if (isUnbound || isConflict) abnormal += 1;
      if (String(row['是否api影子'] || '').toUpperCase() === 'Y') shadows += 1;
      if (isUnbound || isConflict) {
        var owner = cleanLabel(row['归属人'] || '待分配');
        ownerMap[owner] = (ownerMap[owner] || 0) + 1;
      }
    });
    return {
      total: rows.length,
      abnormal: abnormal,
      unbound: unbound,
      conflicts: conflicts,
      shadows: shadows,
      owners: Object.keys(ownerMap).map(function (name) {
        return { name: name, count: ownerMap[name] };
      }).sort(function (a, b) { return b.count - a.count; }).slice(0, 5)
    };
  }

  function buildSnapshot() {
    var snapshot = { module: moduleType, updatedAt: new Date().toISOString() };
    if (moduleType === 'todo-work') snapshot.work = safeJson('yara_daily_todo_v1', { tasks: {} });
    if (moduleType === 'todo-life') snapshot.life = safeJson('yara_life_todo_v1', { tasks: [] });
    if (moduleType === 'finance') snapshot.finance = safeJson('yara_ledger_v1', { transactions: [], budgets: {} });
    if (moduleType === 'opsos') snapshot.capability = safeJson('yara_ops_os_v1', { scores: {} });
    if (moduleType === 'reconcile') snapshot.reconcile = reconcileSnapshot();
    return snapshot;
  }

  function reportSnapshot(delay) {
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(function () {
      post('snapshot', buildSnapshot());
    }, delay == null ? 180 : delay);
  }

  function classifyOperation(element) {
    if (!element) return null;
    var text = cleanLabel(
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.textContent ||
      element.value
    );
    if (!text) return null;
    if (/删除|清空|重置/.test(text)) return { kind: 'delete', text: text, destructive: true };
    if (/导入|上传/.test(text)) return { kind: 'import', text: text };
    if (/导出|下载/.test(text)) return { kind: 'export', text: text };
    if (/保存|提交|确认修改|更新/.test(text)) return { kind: 'save', text: text };
    return null;
  }

  function requestConfirm(operation) {
    requestCounter += 1;
    var requestId = 'confirm-' + Date.now() + '-' + requestCounter;
    return new Promise(function (resolve) {
      pendingRequests[requestId] = resolve;
      post('confirm-request', {
        requestId: requestId,
        title: operation.text.indexOf('重置') >= 0 ? '确认重置数据？' : '确认删除？',
        message: '该操作会影响当前模块的数据，请确认后继续。',
        confirmText: operation.text.indexOf('重置') >= 0 ? '确认重置' : '确认删除',
        danger: true
      });
      setTimeout(function () {
        if (pendingRequests[requestId]) {
          delete pendingRequests[requestId];
          resolve(window.confirm('该操作会影响当前模块的数据，是否继续？'));
        }
      }, 15000);
    });
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var message = event.data || {};
    if (message.source !== 'yara-shell') return;
    if (message.type === 'confirm-response' && pendingRequests[message.requestId]) {
      var resolve = pendingRequests[message.requestId];
      delete pendingRequests[message.requestId];
      resolve(!!message.confirmed);
    }
    if (message.type === 'theme') {
      document.documentElement.dataset.yaraTheme = message.theme || 'twilight';
    }
    if (message.type === 'refresh-snapshot') reportSnapshot(0);
    if (message.type === 'navigate-back') history.back();
  });

  document.addEventListener('click', function (event) {
    var control = event.target.closest('button, a, [role="button"], [role="tab"], .nav-item, .menu-item, .card');
    if (!control) return;
    var operation = classifyOperation(control);
    if (operation && operation.destructive && control.dataset.yaraConfirmed !== 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
      var undoKey = moduleType === 'opsos' && operation.text.indexOf('重置') >= 0 ? 'yara_ops_os_v1' : '';
      var undoValue = undoKey ? localStorage.getItem(undoKey) : null;
      requestConfirm(operation).then(function (confirmed) {
        if (!confirmed) {
          post('operation', { kind: 'delete', status: 'cancelled', message: '已取消操作' });
          return;
        }
        control.dataset.yaraConfirmed = 'true';
        var nativeConfirm = window.confirm;
        window.confirm = function () { return true; };
        control.click();
        window.confirm = nativeConfirm;
        control.removeAttribute('data-yara-confirmed');
        setTimeout(function () {
          var payload = { kind: 'delete', status: 'success', message: '操作已确认并执行' };
          if (undoKey && undoValue !== null && localStorage.getItem(undoKey) !== undoValue) {
            payload.undo = { key: undoKey, value: undoValue };
          }
          post('operation', payload);
          reportSnapshot(0);
        }, 180);
      });
      return;
    }
    if (operation) {
      var messages = {
        save: '已提交保存',
        import: '已接收导入操作，正在处理',
        export: '已发起导出'
      };
      setTimeout(function () {
        post('operation', {
          kind: operation.kind,
          status: 'started',
          message: messages[operation.kind] || '操作已执行'
        });
        reportSnapshot(60);
      }, 60);
    }
    var isNavigation = control.matches('[role="tab"], .nav-item, .sidebar-item, .menu-item, .tab, [data-tab], [data-period]') ||
      !!control.closest('nav, aside');
    var label = isNavigation ? cleanLabel(control.getAttribute('aria-label') || control.textContent) : '';
    reportRoute(label);
  }, true);

  document.addEventListener('change', function (event) {
    if (event.target && event.target.matches('input[type="file"]')) {
      post('operation', { kind: 'import', status: 'started', message: '已接收文件，正在校验并导入' });
      reportSnapshot(300);
    }
  }, true);

  window.addEventListener('hashchange', function () { reportRoute(); });
  window.addEventListener('storage', function () { reportSnapshot(80); });

  var observer = new MutationObserver(function (mutations) {
    var routeChanged = mutations.some(function (mutation) {
      return mutation.type === 'attributes' &&
        (mutation.attributeName === 'class' || mutation.attributeName === 'aria-selected');
    });
    if (routeChanged) reportRoute();
  });
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-selected', 'aria-current']
  });

  window.YaraBridge = {
    emit: post,
    route: function (label, level, meta) {
      post('route', Object.assign({ label: cleanLabel(label), level: level || 3 }, meta || {}));
    },
    operation: function (kind, status, message, meta) {
      post('operation', Object.assign({ kind: kind, status: status, message: message }, meta || {}));
    },
    snapshot: function () { post('snapshot', buildSnapshot()); },
    confirm: requestConfirm
  };

  post('ready', { title: document.title, module: moduleType });
  reportRoute();
  reportSnapshot(0);
})();
