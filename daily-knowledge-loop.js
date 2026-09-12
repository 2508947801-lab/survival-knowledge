(function () {
  'use strict';

  var STORAGE_KEY = 'lysie_daily_knowledge_loop_v1';
  var SCHEMA_VERSION = 1;
  var DAILY_LIMIT = 3;
  var form = document.getElementById('knowledgeLoopForm');
  if (!form || window.LysieDailyKnowledgeLoop) return;

  var fields = {
    focus: document.getElementById('loopFocus'),
    title: document.getElementById('loopTitle'),
    source: document.getElementById('loopSource'),
    summary: document.getElementById('loopSummary'),
    relation: document.getElementById('loopRelation'),
    action: document.getElementById('loopAction')
  };
  var feedback = document.getElementById('loopFeedback');
  var todayList = document.getElementById('todayLoopList');
  var reviewList = document.getElementById('reviewQueueList');
  var reviewNote = document.getElementById('dailyReviewNote');
  var submitButton = form.querySelector('button[type="submit"]');
  var knowledgeCapture = document.getElementById('knowledgeCapture');
  var radarCard = document.getElementById('radarCard');
  var radarSkipped = document.getElementById('radarSkipped');
  var radarCards = Array.isArray(window.LYSIE_RADAR_CARDS) ? window.LYSIE_RADAR_CARDS.filter(validRadarCard) : [];
  var radarIndex = radarCards.length ? dailyRadarIndex(radarCards.length) : 0;
  var state = loadState();

  function dateKey(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDays(key, amount) {
    var d = new Date(key + 'T12:00:00');
    d.setDate(d.getDate() + amount);
    return dateKey(d);
  }

  function clean(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function emptyState() {
    return { schemaVersion: SCHEMA_VERSION, entries: [], reviews: {}, updatedAt: '' };
  }

  function normalizeState(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return emptyState();
    if (!Array.isArray(candidate.entries)) candidate.entries = [];
    if (!candidate.reviews || typeof candidate.reviews !== 'object' || Array.isArray(candidate.reviews)) candidate.reviews = {};
    candidate.schemaVersion = SCHEMA_VERSION;
    candidate.entries = candidate.entries.filter(function (entry) {
      return entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.date === 'string';
    });
    return candidate;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : emptyState();
    } catch (error) {
      return emptyState();
    }
  }

  function saveState(message) {
    state.updatedAt = new Date().toISOString();
    var serialized = JSON.stringify(state);
    try {
      var saved = window.StorageGuard ? StorageGuard.safeSet(STORAGE_KEY, serialized) : (localStorage.setItem(STORAGE_KEY, serialized), true);
      if (!saved) throw new Error('本机存储空间不足');
      window.dispatchEvent(new CustomEvent('lysie:daily-knowledge-changed', { detail: { key: STORAGE_KEY } }));
      showFeedback(message || '已保存');
      return true;
    } catch (error) {
      state = loadState();
      showFeedback('保存失败：' + (error && error.message ? error.message : '请检查浏览器存储权限'), true);
      return false;
    }
  }

  function showFeedback(message, isError) {
    feedback.textContent = message || '';
    feedback.classList.toggle('is-error', Boolean(isError));
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return 'loop-' + window.crypto.randomUUID();
    return 'loop-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function validRadarCard(card) {
    return Boolean(card && typeof card === 'object' && /^2026-09-0[1-7]$/.test(String(card.id || '')) &&
      /^https:\/\//i.test(String(card.sourceUrl || '')) &&
      /^生存知识日报_\d{4}-\d{2}-\d{2}\.html$/.test(String(card.report || '')) &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(card.verifiedOn || '')));
  }

  function dailyRadarIndex(length) {
    if (!length) return 0;
    var numericDate = Number(dateKey().replace(/-/g, '')) || 0;
    return numericDate % length;
  }

  function currentRadarCard() {
    return radarCards.length ? radarCards[radarIndex % radarCards.length] : null;
  }

  function sevenDaysAgoKey() {
    return addDays(dateKey(), -6);
  }

  function radarStats() {
    var today = dateKey();
    var weekStart = sevenDaysAgoKey();
    var due = state.entries.filter(function (entry) {
      return entry && entry.status !== 'applied' && entry.status !== 'archived' &&
        String(entry.revisitOn || addDays(entry.date, 14)) <= today;
    }).length;
    var applied = state.entries.filter(function (entry) {
      if (!entry || entry.status !== 'applied') return false;
      var key = '';
      try { key = dateKey(new Date(entry.lastUsedAt || entry.practicedAt || entry.updatedAt)); } catch (error) { key = ''; }
      return key >= weekStart && key <= today;
    }).length;
    return { due: due, applied: applied };
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function renderRadar() {
    if (!radarCard) return;
    var card = currentRadarCard();
    var stats = radarStats();
    setText('radarProgress', stats.due ? stats.due + ' 条待复查 · 本周已用 ' + stats.applied + ' 条' : '本周已用 ' + stats.applied + ' 条 · 暂无到期复查');
    if (!card) {
      setText('radarTitle', '知识卡暂时无法读取');
      setText('radarFact', '已保存的个人知识闭环仍可正常使用。请稍后刷新页面。');
      setText('radarWhy', '当前仅缺少推荐内容，不影响本机数据。');
      setText('radarBoundary', '不会用预设主题或未核验内容填补空缺。');
      ['radarUse', 'radarNext'].forEach(function (id) { var button = document.getElementById(id); if (button) button.disabled = true; });
      return;
    }
    setText('radarFocus', clean(card.focus, 40));
    setText('radarReadTime', '约 ' + Math.max(3, Math.min(5, Number(card.readMinutes) || 4)) + ' 分钟');
    setText('radarTitle', clean(card.title, 100));
    setText('radarFact', clean(card.fact, 500));
    setText('radarWhy', '应用建议：' + clean(card.why, 500));
    setText('radarBoundary', clean(card.boundary, 500));
    setText('radarVerified', '核验于 ' + card.verifiedOn + ' · ' + clean(card.sourceLabel, 120));
    var source = document.getElementById('radarSource');
    var report = document.getElementById('radarReadReport');
    if (source) source.href = card.sourceUrl;
    if (report) report.href = card.report;
  }

  function beginWithRadarCard() {
    var card = currentRadarCard();
    if (!card || !knowledgeCapture) return;
    knowledgeCapture.open = true;
    if (!clean(fields.focus.value, 40)) {
      var optionExists = Array.prototype.some.call(fields.focus.options, function (option) { return option.value === card.focus; });
      if (optionExists) fields.focus.value = card.focus;
    }
    if (!clean(fields.title.value, 80)) fields.title.value = clean(card.title, 80);
    if (!clean(fields.source.value, 240)) fields.source.value = clean(card.sourceUrl, 240);
    updateStepState();
    showFeedback('已预填主题与来源；请用自己的话完成加工。尚未保存。');
    window.requestAnimationFrame(function () {
      knowledgeCapture.scrollIntoView({ behavior: 'smooth', block: 'start' });
      fields.summary.focus({ preventScroll: true });
    });
  }

  function todaysEntries() {
    var today = dateKey();
    return state.entries.filter(function (entry) { return entry.date === today && entry.status !== 'archived'; });
  }

  function setSource(container, source) {
    source = clean(source, 240);
    if (!source) return;
    var node;
    if (/^https?:\/\//i.test(source)) {
      node = element('a', 'entry-source', '查看来源 ↗');
      node.href = source;
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
    } else {
      node = element('span', 'entry-source', '来源：' + source);
    }
    container.appendChild(node);
  }

  function addEntryBlock(card, label, value) {
    var block = element('p', 'entry-block');
    var strong = element('strong', '', label + '：');
    block.appendChild(strong);
    block.appendChild(document.createTextNode(clean(value, 500)));
    card.appendChild(block);
  }

  function recordPractice(entry, textarea) {
    var result = clean(textarea.value, 360);
    if (!result) {
      textarea.focus();
      showFeedback('请先写一句真实结果，再记录实践。', true);
      return;
    }
    entry.status = 'applied';
    entry.result = result;
    entry.practicedAt = new Date().toISOString();
    entry.lastUsedAt = entry.practicedAt;
    entry.useCount = Math.max(1, Number(entry.useCount) || 0);
    if (saveState('闭环完成：这条知识已经进入实践。')) render();
  }

  function recordReuse(entry) {
    entry.lastUsedAt = new Date().toISOString();
    entry.useCount = (Number(entry.useCount) || 1) + 1;
    if (saveState('已记录再次调用。')) render();
  }

  function entryCard(entry, compact) {
    var card = element('article', 'loop-entry' + (entry.status === 'applied' ? ' is-applied' : ''));
    var top = element('div', 'entry-top');
    top.appendChild(element('span', 'entry-focus', clean(entry.focus, 40) || '未分类'));
    var statusText = entry.status === 'applied' ? '已实践 · ' + (Number(entry.useCount) || 1) + ' 次调用' : '最晚 ' + (entry.revisitOn || addDays(entry.date, 14));
    top.appendChild(element('span', 'entry-status', statusText));
    card.appendChild(top);
    card.appendChild(element('h4', '', clean(entry.title, 80)));
    if (!compact) {
      addEntryBlock(card, '我的话', entry.summary);
      addEntryBlock(card, '关联', entry.relation);
    }
    addEntryBlock(card, '5 分钟行动', entry.action);
    setSource(card, entry.source);

    if (entry.status === 'applied') {
      if (entry.result) card.appendChild(element('p', 'entry-result', '实践结果：' + clean(entry.result, 360)));
      var reuseRow = element('div', 'practice-row');
      reuseRow.appendChild(element('span', 'practice-meta', entry.lastUsedAt ? '最近调用：' + dateKey(new Date(entry.lastUsedAt)) : '已完成首次实践'));
      var reuse = element('button', 'reuse-action', '再次调用');
      reuse.type = 'button';
      reuse.addEventListener('click', function () { recordReuse(entry); });
      reuseRow.appendChild(reuse);
      card.appendChild(reuseRow);
    } else {
      var practice = element('div', 'practice-box');
      var label = element('label', '', '做完后，用一句话记录真实结果');
      var textarea = document.createElement('textarea');
      textarea.maxLength = 360;
      textarea.placeholder = '发生了什么？有效、无效，还是需要调整？';
      label.appendChild(textarea);
      practice.appendChild(label);
      var row = element('div', 'practice-row');
      row.appendChild(element('span', 'practice-meta', '不求漂亮，只记录事实'));
      var done = element('button', 'practice-action', '记录实践');
      done.type = 'button';
      done.addEventListener('click', function () { recordPractice(entry, textarea); });
      row.appendChild(done);
      practice.appendChild(row);
      card.appendChild(practice);
    }
    return card;
  }

  function renderToday() {
    var entries = todaysEntries().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    todayList.textContent = '';
    document.getElementById('todayLoopCount').textContent = entries.length + ' 条';
    document.getElementById('dailyLimitStatus').textContent = '今日 ' + entries.length + ' / ' + DAILY_LIMIT;
    submitButton.disabled = entries.length >= DAILY_LIMIT;
    if (!entries.length) {
      todayList.appendChild(element('p', 'loop-empty', '今天还没有收下知识。先选一条与你目标最相关、并愿意在 5 分钟内行动的信息。'));
    } else {
      entries.forEach(function (entry) { todayList.appendChild(entryCard(entry, false)); });
    }
  }

  function renderReviewQueue() {
    var today = dateKey();
    var pending = state.entries.filter(function (entry) {
      return entry.status !== 'applied' && entry.status !== 'archived' && entry.date !== today;
    }).sort(function (a, b) { return String(a.revisitOn || '').localeCompare(String(b.revisitOn || '')); });
    var overdue = pending.filter(function (entry) { return (entry.revisitOn || addDays(entry.date, 14)) <= today; });
    var visible = overdue.length ? overdue : pending.slice(0, 3);
    reviewList.textContent = '';
    document.getElementById('reviewQueueCount').textContent = overdue.length + ' 待复查';
    if (!visible.length) {
      reviewList.appendChild(element('p', 'loop-empty', '目前没有到期内容。新知识会在 14 天后提醒你：用过、调整，还是归档？'));
    } else {
      visible.forEach(function (entry) { reviewList.appendChild(entryCard(entry, true)); });
    }
  }

  function renderReview() {
    var today = dateKey();
    var saved = state.reviews[today];
    reviewNote.value = saved && saved.note ? saved.note : '';
    var now = new Date();
    var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var prompt = '有使用时再写，不必每天完成。';
    if (now.getDay() === 0) prompt = '今天顺手做周复盘：本周哪条知识被真正调用了？';
    if (now.getDate() >= lastDay - 2) prompt = '月底复盘：保留被调用的，归档不再服务当前目标的。';
    document.getElementById('reviewPrompt').textContent = prompt;
  }

  function updateStepState() {
    var inputReady = clean(fields.focus.value, 40) && clean(fields.title.value, 80);
    var processReady = clean(fields.summary.value, 260) && clean(fields.relation.value, 200);
    var outputReady = clean(fields.action.value, 180);
    document.querySelector('[data-loop-step="input"]').classList.toggle('is-ready', Boolean(inputReady));
    document.querySelector('[data-loop-step="process"]').classList.toggle('is-ready', Boolean(processReady));
    document.querySelector('[data-loop-step="output"]').classList.toggle('is-ready', Boolean(outputReady));
    document.querySelector('[data-loop-step="practice"]').classList.toggle('is-ready', todaysEntries().some(function (entry) { return entry.status === 'applied'; }));
  }

  function render() {
    renderRadar();
    renderToday();
    renderReviewQueue();
    renderReview();
    updateStepState();
  }

  function injectStandaloneParentBack() {
    if (window.top !== window || document.getElementById('yaraInjectedBack')) return;
    var decodedPath = '';
    try { decodedPath = decodeURIComponent(location.pathname); } catch (error) { decodedPath = location.pathname; }
    var shellHref = decodedPath.indexOf('/生存知识日报文件/') >= 0 ? '../管理系统.html' : '管理系统.html';
    var button = element('button', 'yara-module-back daily-standalone-back');
    button.id = 'yaraInjectedBack';
    button.type = 'button';
    button.setAttribute('data-standalone', 'true');
    button.setAttribute('aria-label', '返回成长与事业');
    button.innerHTML = '<span aria-hidden="true">←</span><span class="yara-back-label">成长与事业</span>';
    button.addEventListener('click', function () {
      window.location.href = shellHref + '?cluster=growth';
    });
    document.body.appendChild(button);
  }

  form.addEventListener('input', updateStepState);
  form.addEventListener('change', updateStepState);
  document.getElementById('radarUse').addEventListener('click', beginWithRadarCard);
  document.getElementById('radarNext').addEventListener('click', function () {
    if (!radarCards.length) return;
    radarIndex = (radarIndex + 1) % radarCards.length;
    renderRadar();
    radarCard.focus({ preventScroll: true });
  });
  document.getElementById('radarSkip').addEventListener('click', function () {
    radarCard.hidden = true;
    radarSkipped.hidden = false;
  });
  document.getElementById('radarResume').addEventListener('click', function () {
    radarSkipped.hidden = true;
    radarCard.hidden = false;
    document.getElementById('radarTitle').focus({ preventScroll: true });
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (todaysEntries().length >= DAILY_LIMIT) {
      showFeedback('今天已经收下 3 条。先实践，再继续输入。', true);
      return;
    }
    var entry = {
      id: uid(),
      date: dateKey(),
      focus: clean(fields.focus.value, 40),
      title: clean(fields.title.value, 80),
      source: clean(fields.source.value, 240),
      summary: clean(fields.summary.value, 260),
      relation: clean(fields.relation.value, 200),
      action: clean(fields.action.value, 180),
      status: 'captured',
      revisitOn: addDays(dateKey(), 14),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useCount: 0
    };
    if (!entry.focus || !entry.title || !entry.summary || !entry.relation || !entry.action) {
      showFeedback('请完成目标、复述、关联和 5 分钟行动。', true);
      var firstEmpty = [fields.focus, fields.title, fields.summary, fields.relation, fields.action].filter(function (node) { return !clean(node.value, 500); })[0];
      if (firstEmpty) firstEmpty.focus();
      return;
    }
    state.entries.push(entry);
    if (saveState('已存入今日闭环。下一步：完成 5 分钟行动并记录结果。')) {
      form.reset();
      render();
    }
  });

  document.getElementById('saveDailyReview').addEventListener('click', function () {
    var note = clean(reviewNote.value, 500);
    if (!note) {
      reviewNote.focus();
      showFeedback('先写一句今天的结果或调整。', true);
      return;
    }
    state.reviews[dateKey()] = { note: note, updatedAt: new Date().toISOString() };
    if (saveState('今日复盘已保存。')) renderReview();
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    render();
  });
  window.addEventListener('yara:data-imported', function () {
    state = loadState();
    render();
  });

  render();
  injectStandaloneParentBack();
  window.LysieDailyKnowledgeLoop = {
    key: STORAGE_KEY,
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    getRadarCard: function () { return currentRadarCard() ? JSON.parse(JSON.stringify(currentRadarCard())) : null; },
    render: render
  };
})();
