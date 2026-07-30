(function () {
  'use strict';

  var store = window.YaraMasterSchedule;
  if (!store || typeof state === 'undefined') return;

  var moduleName = document.body.getAttribute('data-yara-module') || '';
  var projectMap = {
    'schedule-batch': '杨家成3980',
    'schedule-gaogao': '高高2980',
    'schedule-zhihao': '之昊3980'
  };
  var project = projectMap[moduleName];
  if (!project) return;

  var loadedPeriod = '';
  var loadedRevision = store.read().revision || 0;
  var dirtyNotice = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function splitIds(value) {
    return String(value || '').split(/[,，、\s]+/).map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }

  function parseMasterDate(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function getClock(value, fallback) {
    var match = String(value || '').match(/\b(\d{2}:\d{2})\b/);
    return match ? match[1] : fallback;
  }

  function defaultTimes(course) {
    if (project === '之昊3980' && typeof getTimeSlot === 'function' && course.date) {
      var slot = getTimeSlot(course.date.getDay(), course.type);
      if (slot && slot.start) return { start: slot.start, end: slot.end || '' };
    }
    if (project === '高高2980' && typeof getTimeSlot === 'function') {
      var ggSlot = getTimeSlot();
      if (ggSlot && ggSlot.start) return { start: ggSlot.start, end: ggSlot.end || '' };
    }
    return { start: '19:55', end: '21:30' };
  }

  function toToolCourse(row, index) {
    var date = parseMasterDate(row.time);
    var type = typeof classifyCourse === 'function' ? classifyCourse(row.lesson) : 'zhengke';
    var course = {
      idx: index + 1,
      name: row.lesson || '',
      type: type,
      chapter: row.chapter || '',
      liveId: row.lessonId || '',
      date: date,
      isZengke: type === 'kaixue' || String(row.time || '').indexOf('赠课') >= 0,
      isCancelled: false,
      dateChanged: false,
      isNew: false,
      _masterId: row.id || '',
      _masterTime: row.time || '',
      _masterSequence: row.sequence || index + 1
    };
    if (project === '杨家成3980') {
      course.hwId = row.homeworkId || '';
      course.videoIds = splitIds(row.videoId);
    } else {
      course.homeworkId = row.homeworkId || '';
      var defaultSlot = defaultTimes(course);
      course.timeStart = getClock(row.time, defaultSlot.start);
      course.timeEnd = defaultSlot.end;
    }
    return course;
  }

  function toMasterLesson(course, index, oldRows) {
    var old = oldRows.find(function (row) {
      return (course._masterId && row.id === course._masterId) ||
        (course.liveId && row.lessonId === course.liveId) ||
        row.lesson === course.name;
    }) || {};
    var fallback = defaultTimes(course);
    var clock = course.timeStart || getClock(old.time, fallback.start);
    var time = course.isZengke
      ? '赠课'
      : (course.date ? formatDate(course.date) + ' ' + clock : '');
    return {
      id: old.id || course._masterId || '',
      chapter: course.chapter || old.chapter || '',
      lesson: course.name || '',
      time: time,
      lessonId: course.liveId || state.lessonIds[course.idx] || '',
      homeworkId: project === '杨家成3980'
        ? (course.hwId || '')
        : (course.homeworkId || ''),
      videoId: project === '杨家成3980'
        ? (course.videoIds || []).join('、')
        : (old.videoId || ''),
      sequence: Number(old.sequence || course._masterSequence || index + 1)
    };
  }

  function periods() {
    var data = store.getCourseData();
    return Object.keys((data && data[project]) || {});
  }

  function refreshPeriodOptions(preferred) {
    var select = document.getElementById('yaraMasterPeriod');
    if (!select) return;
    var names = periods();
    var selected = preferred || loadedPeriod || names[names.length - 1] || '';
    select.innerHTML = names.map(function (name) {
      return '<option value="' + escapeHtml(name) + '"' + (name === selected ? ' selected' : '') + '>' +
        escapeHtml(name) + '</option>';
    }).join('');
  }

  function setStatus(text, tone) {
    var el = document.getElementById('yaraMasterStatus');
    if (!el) return;
    el.textContent = text;
    el.setAttribute('data-tone', tone || 'quiet');
  }

  function loadFromMaster() {
    var select = document.getElementById('yaraMasterPeriod');
    var period = select ? select.value : '';
    var data = store.getCourseData();
    var rows = data[project] && data[project][period];
    if (!rows || !rows.length) {
      setStatus('该期暂时没有课节', 'warning');
      return;
    }
    state.courses = rows.map(toToolCourse);
    state._hasDates = state.courses.some(function (course) { return !!course.date; });
    state.module1Confirmed = false;
    state.module2Confirmed = false;
    state.lessonIds = {};
    state.selectedRows = new Set();
    loadedPeriod = period;
    loadedRevision = store.read().revision || 0;
    dirtyNotice = false;
    showImportResult();
    if (typeof setMode === 'function' && state._hasDates && state.mode !== 'modify') setMode('modify');
    setStatus('已载入 ' + rows.length + ' 节 · 修改后可保存回主课表', 'success');
  }

  function saveToMaster(options) {
    options = options || {};
    if (!loadedPeriod) {
      if (!options.silent) setStatus('请先从主课表载入一个期班', 'warning');
      return false;
    }
    var data = store.getCourseData();
    var oldRows = (data[project] && data[project][loadedPeriod]) || [];
    var rows = state.courses.map(function (course, index) {
      return toMasterLesson(course, index, oldRows);
    });
    store.replacePeriod(project, loadedPeriod, rows);
    loadedRevision = store.read().revision || loadedRevision;
    dirtyNotice = false;
    setStatus('已保存并联动首页、教务和其他页面', 'success');
    return true;
  }

  function buildPanel() {
    var anchor = document.querySelector('.yara-step-rail') || document.querySelector('.container') || document.body;
    var panel = document.createElement('section');
    panel.className = 'yara-master-link';
    panel.innerHTML =
      '<div class="yara-master-link-copy">' +
        '<span class="yara-master-kicker">MASTER SCHEDULE</span>' +
        '<strong>主课表联动 · ' + escapeHtml(project) + '</strong>' +
        '<p>这里载入的期班与系统主课表共用同一份数据。</p>' +
      '</div>' +
      '<div class="yara-master-actions">' +
        '<label><span>期班</span><select id="yaraMasterPeriod"></select></label>' +
        '<button type="button" id="yaraMasterLoad">从主课表载入</button>' +
        '<button type="button" id="yaraMasterSave" class="is-primary">保存回主课表</button>' +
      '</div>' +
      '<div class="yara-master-status" id="yaraMasterStatus" data-tone="quiet">请选择期班并载入</div>';
    if (anchor.classList.contains('yara-step-rail')) {
      anchor.insertAdjacentElement('afterend', panel);
    } else {
      anchor.insertBefore(panel, anchor.firstChild);
    }
    refreshPeriodOptions();
    document.getElementById('yaraMasterLoad').addEventListener('click', loadFromMaster);
    document.getElementById('yaraMasterSave').addEventListener('click', function () {
      saveToMaster();
    });
    document.getElementById('yaraMasterPeriod').addEventListener('change', function () {
      setStatus('已切换期班，点击“从主课表载入”', 'quiet');
    });
  }

  var originalConfirm = typeof confirmModule1 === 'function' ? confirmModule1 : null;
  if (originalConfirm) {
    window.confirmModule1 = function () {
      originalConfirm.apply(this, arguments);
      if (state.module1Confirmed && loadedPeriod) saveToMaster({ silent: true });
    };
  }

  store.subscribe(function (next) {
    refreshPeriodOptions();
    if (!loadedPeriod) return;
    if ((next.revision || 0) !== loadedRevision) {
      dirtyNotice = true;
      setStatus('主课表有新修改，请重新载入后再继续', 'warning');
    }
  });

  buildPanel();
  window.YaraScheduleToolSync = {
    project: project,
    load: loadFromMaster,
    save: saveToMaster,
    hasExternalChange: function () { return dirtyNotice; }
  };
})();
