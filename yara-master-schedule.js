(function () {
  'use strict';

  if (window.YaraMasterSchedule) return;

  var KEY = 'yara_master_schedule_v1';
  var IMPORT_BACKUP_KEY = 'yara_master_schedule_import_backup_v1';
  var CLOUD_ROW = 'master-schedule-v1';
  var VERSION = 1;
  var undoStack = [];
  var listeners = [];
  var cloudTimer = 0;
  var cloudBusy = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function localDateKey() {
    var date = new Date();
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function computeStatus(time) {
    var value = clean(time);
    if (value === '赠课') return '赠课';
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return '未排';
    var day = value.slice(0, 10);
    if (day < localDateKey()) return '已完成';
    if (day === localDateKey()) return '今日待上';
    return '待上';
  }

  function stableId(project, period, lesson, index) {
    if (lesson && lesson.id) return clean(lesson.id);
    var token = clean(lesson && lesson.lessonId) ||
      clean(lesson && lesson.sequence) ||
      String(index + 1);
    return project + '::' + period + '::' + token;
  }

  function normalizeLesson(project, period, lesson, index) {
    var normalized = {
      id: stableId(project, period, lesson, index),
      sequence: Number(lesson && lesson.sequence) || index + 1,
      chapter: clean(lesson && lesson.chapter) || '未归类章节',
      lesson: clean(lesson && lesson.lesson) || '未命名课节',
      time: clean(lesson && lesson.time),
      lessonId: clean(lesson && lesson.lessonId),
      homeworkId: clean(lesson && lesson.homeworkId),
      videoId: clean(lesson && lesson.videoId),
      status: computeStatus(lesson && lesson.time),
      sourceSheet: clean(lesson && lesson.sourceSheet),
      sourceRow: Number(lesson && lesson.sourceRow) || 0
    };
    return normalized;
  }

  function normalizeCourseData(courseData) {
    var result = {};
    Object.keys(courseData || {}).forEach(function (project) {
      var periods = courseData[project] || {};
      result[project] = {};
      Object.keys(periods).forEach(function (period) {
        result[project][period] = (Array.isArray(periods[period]) ? periods[period] : [])
          .map(function (lesson, index) {
            return normalizeLesson(project, period, lesson, index);
          });
      });
    });
    return result;
  }

  function seedState() {
    var seed = window.YARA_MASTER_SCHEDULE_SEED || {};
    return {
      version: VERSION,
      revision: 1,
      updatedAt: seed.generatedAt || nowIso(),
      sourceRevision: seed.sourceRevision || 'legacy-course-data',
      source: clone(seed.source || { fileName: '系统内置课表' }),
      dirty: false,
      lastChange: {
        kind: 'seed',
        label: '从语言事业部总课表建立系统主课表',
        at: seed.generatedAt || nowIso()
      },
      courseData: normalizeCourseData(seed.courseData || {})
    };
  }

  function currentSeed() {
    return window.YARA_MASTER_SCHEDULE_SEED || {};
  }

  function isCustomLesson(lesson) {
    return !clean(lesson && lesson.sourceSheet);
  }

  function isYangSharedLesson(project, lesson) {
    return project === '杨家成3980' && /纠音|语聊|交流房/i.test(clean(lesson && lesson.lesson));
  }

  function upgradeToCurrentWorkbook(state) {
    var seed = currentSeed();
    if (!seed.sourceRevision || state.sourceRevision === seed.sourceRevision) {
      return { changed: false, state: state };
    }

    var seedData = normalizeCourseData(seed.courseData || {});
    if (!Object.keys(seedData).length) return { changed: false, state: state };

    var merged = clone(state.courseData || {});
    Object.keys(seedData).forEach(function (project) {
      if (!merged[project]) merged[project] = {};
      Object.keys(seedData[project] || {}).forEach(function (period) {
        var workbookRows = clone(seedData[project][period] || []);
        var existingRows = ((((state.courseData || {})[project] || {})[period]) || []);
        var existingById = new Map(existingRows.map(function (row) { return [row.id, row]; }));
        var sharedScheduleIsAuthoritative = Number(state.source && state.source.sharedScheduleAuthorityVersion) >= 1 &&
          Array.isArray(state.source && state.source.sharedSchedule);
        if (sharedScheduleIsAuthoritative) {
          workbookRows = workbookRows.map(function (row) {
            var existing = existingById.get(row.id);
            if (existing && isYangSharedLesson(project, row) && clean(existing.time)) {
              row.time = clean(existing.time);
              row.status = computeStatus(row.time);
            }
            return row;
          });
        }
        var workbookIds = new Set(workbookRows.map(function (row) { return row.id; }));
        var customRows = existingRows
          .filter(isCustomLesson)
          .filter(function (row) { return !workbookIds.has(row.id); });
        merged[project][period] = workbookRows.concat(customRows);
      });
    });

    try { localStorage.setItem(IMPORT_BACKUP_KEY, JSON.stringify(state)); } catch (error) {}
    var upgradedAt = nowIso();
    return {
      changed: true,
      state: {
        version: VERSION,
        revision: (Number(state.revision) || 0) + 1,
        updatedAt: upgradedAt,
        sourceRevision: seed.sourceRevision,
        source: clone(seed.source || state.source || {}),
        dirty: true,
        lastChange: {
          kind: 'workbook-import',
          label: '从语言事业部总课表更新全部关联班期',
          at: upgradedAt
        },
        courseData: normalizeCourseData(merged)
      }
    };
  }

  function validState(value) {
    return !!(value && value.version === VERSION && value.courseData &&
      typeof value.courseData === 'object');
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (validState(parsed)) {
          parsed.courseData = normalizeCourseData(parsed.courseData);
          var upgrade = upgradeToCurrentWorkbook(parsed);
          if (upgrade.changed) {
            write(upgrade.state, { silent: true });
            scheduleCloudPush(upgrade.state);
          }
          return upgrade.state;
        }
      }
    } catch (error) {}
    var seeded = seedState();
    write(seeded, { silent: true });
    return seeded;
  }

  function write(state, options) {
    var normalized = clone(state);
    normalized.version = VERSION;
    normalized.courseData = normalizeCourseData(normalized.courseData);
    try { localStorage.setItem(KEY, JSON.stringify(normalized)); } catch (error) {}
    if (!(options && options.silent)) notify(normalized);
    return normalized;
  }

  function notify(state) {
    var detail = clone(state);
    listeners.slice().forEach(function (listener) {
      try { listener(detail); } catch (error) {}
    });
    window.dispatchEvent(new CustomEvent('yara:master-schedule-changed', {
      detail: detail
    }));
  }

  function saveCourseData(courseData, meta) {
    var current = read();
    undoStack.push(clone(current));
    if (undoStack.length > 20) undoStack.shift();
    var next = {
      version: VERSION,
      revision: (Number(current.revision) || 0) + 1,
      updatedAt: nowIso(),
      sourceRevision: current.sourceRevision || '',
      source: clone((meta && meta.source) || current.source || {}),
      dirty: true,
      lastChange: {
        kind: clean(meta && meta.kind) || 'edit',
        label: clean(meta && meta.label) || '更新主课表',
        at: nowIso()
      },
      courseData: normalizeCourseData(courseData)
    };
    write(next);
    scheduleCloudPush(next);
    return clone(next);
  }

  function getCourseData(fallback) {
    var state = read();
    var data = state.courseData;
    if (!Object.keys(data || {}).length && fallback) {
      data = normalizeCourseData(fallback);
    }
    return clone(data || {});
  }

  function hydrateCourseData(target, fallback) {
    var source = getCourseData(fallback || target);
    Object.keys(target || {}).forEach(function (key) { delete target[key]; });
    Object.keys(source).forEach(function (key) { target[key] = source[key]; });
    return target;
  }

  function replacePeriod(project, period, lessons, meta) {
    var data = getCourseData();
    if (!data[project]) data[project] = {};
    data[project][period] = clone(lessons || []);
    return saveCourseData(data, Object.assign({
      kind: 'replace-period',
      label: project + ' · ' + period + ' 已由排课工具确认'
    }, meta || {}));
  }

  function updateLesson(project, period, lessonId, patch) {
    var data = getCourseData();
    var rows = data[project] && data[project][period];
    if (!rows) throw new Error('未找到对应期班');
    var index = rows.findIndex(function (row) { return row.id === lessonId; });
    if (index < 0) throw new Error('未找到对应课节');
    rows[index] = Object.assign({}, rows[index], patch || {});
    return saveCourseData(data, {
      kind: 'update-lesson',
      label: project + ' · ' + period + ' · ' + (rows[index].lesson || '课节')
    });
  }

  function updateLessonsBatch(changes, meta) {
    if (!Array.isArray(changes) || !changes.length) throw new Error('没有可写入的课节变更');
    var data = getCourseData();
    var seen = new Set();
    changes.forEach(function (change) {
      var project = clean(change && change.project);
      var period = clean(change && change.period);
      var lessonId = clean(change && change.id);
      var token = project + '::' + period + '::' + lessonId;
      if (!project || !period || !lessonId || seen.has(token)) {
        throw new Error('联动明细存在空值或重复课节');
      }
      seen.add(token);
      var rows = data[project] && data[project][period];
      if (!rows) throw new Error('未找到关联期班：' + project + ' · ' + period);
      var index = rows.findIndex(function (row) { return row.id === lessonId; });
      if (index < 0) throw new Error('未找到关联课节：' + token);
      rows[index] = Object.assign({}, rows[index], clone(change.patch || {}));
    });
    return saveCourseData(data, {
      kind: clean(meta && meta.kind) || 'batch-update-lessons',
      label: clean(meta && meta.label) || ('批量联动更新 ' + changes.length + ' 节课')
    });
  }

  function updateSharedScheduleSessions(updates, meta) {
    if (!Array.isArray(updates) || !updates.length) throw new Error('没有可写入的共同课场次');
    var current = read();
    var data = clone(current.courseData || {});
    var source = clone(current.source || {});
    if (!Array.isArray(source.sharedSchedule)) throw new Error('共同课权威日历尚未初始化');
    var lessonIndex = new Map();
    Object.keys((data && data['杨家成3980']) || {}).forEach(function (period) {
      (data['杨家成3980'][period] || []).forEach(function (row, index) {
        lessonIndex.set(row.id, { period: period, index: index, row: row });
      });
    });
    var seenSessions = new Set();
    var linkedCount = 0;
    updates.forEach(function (update) {
      var sessionId = clean(update && update.id);
      var date = clean(update && update.date);
      var time = clean(update && update.time);
      if (!sessionId || seenSessions.has(sessionId)) throw new Error('共同课场次 ID 为空或重复');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('共同课日期或时间格式不正确');
      seenSessions.add(sessionId);
      var session = source.sharedSchedule.find(function (item) { return clean(item.id) === sessionId; });
      if (!session) throw new Error('未找到共同课场次：' + sessionId);
      session.time = date + ' ' + time;
      (session.linkedLessonIds || []).forEach(function (lessonId) {
        var found = lessonIndex.get(clean(lessonId));
        if (!found || !isYangSharedLesson('杨家成3980', found.row)) return;
        data['杨家成3980'][found.period][found.index] = Object.assign({}, found.row, { time: date + ' ' + time });
        linkedCount += 1;
      });
    });
    var next = saveCourseData(data, {
      kind: clean(meta && meta.kind) || 'update-yang-shared-schedule',
      label: clean(meta && meta.label) || ('更新杨老师共同课 ' + updates.length + ' 场 · 联动 ' + linkedCount + ' 节课'),
      source: source
    });
    next.linkedLessonCount = linkedCount;
    return next;
  }

  function addLesson(project, period, lesson, afterId) {
    var data = getCourseData();
    if (!data[project]) data[project] = {};
    if (!data[project][period]) data[project][period] = [];
    var rows = data[project][period];
    var insertAt = afterId
      ? rows.findIndex(function (row) { return row.id === afterId; }) + 1
      : rows.length;
    if (insertAt < 0) insertAt = rows.length;
    var copy = Object.assign({}, lesson || {});
    copy.id = project + '::' + period + '::new-' + Date.now().toString(36);
    rows.splice(insertAt, 0, copy);
    return saveCourseData(data, {
      kind: 'add-lesson',
      label: project + ' · ' + period + ' 新增课节'
    });
  }

  function deleteLesson(project, period, lessonId) {
    var data = getCourseData();
    var rows = data[project] && data[project][period];
    if (!rows) return read();
    data[project][period] = rows.filter(function (row) { return row.id !== lessonId; });
    return saveCourseData(data, {
      kind: 'delete-lesson',
      label: project + ' · ' + period + ' 删除课节'
    });
  }

  function undo() {
    var previous = undoStack.pop();
    if (!previous) return null;
    previous.revision = (Number(read().revision) || 0) + 1;
    previous.updatedAt = nowIso();
    previous.dirty = true;
    previous.lastChange = {
      kind: 'undo',
      label: '撤销上一步主课表修改',
      at: previous.updatedAt
    };
    write(previous);
    scheduleCloudPush(previous);
    return clone(previous);
  }

  function restoreImportBackup() {
    try {
      var raw = localStorage.getItem(IMPORT_BACKUP_KEY);
      if (!raw) return null;
      var previous = JSON.parse(raw);
      if (!validState(previous)) return null;
      var restoredAt = nowIso();
      previous.revision = (Number(read().revision) || 0) + 1;
      previous.updatedAt = restoredAt;
      previous.sourceRevision = currentSeed().sourceRevision || previous.sourceRevision;
      previous.dirty = true;
      previous.lastChange = {
        kind: 'restore-workbook-import',
        label: '恢复课表更新前的本机快照',
        at: restoredAt
      };
      write(previous);
      scheduleCloudPush(previous);
      return clone(previous);
    } catch (error) {
      return null;
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function () {
      listeners = listeners.filter(function (item) { return item !== listener; });
    };
  }

  function cloudConfig() {
    return window.YaraRuntimeConfig
      ? window.YaraRuntimeConfig.supabase()
      : { url: '', anonKey: '', ready: false };
  }

  function cloudHeaders(extra) {
    var config = cloudConfig();
    return Object.assign({
      apikey: config.anonKey,
      Authorization: 'Bearer ' + config.anonKey,
      'Content-Type': 'application/json'
    }, extra || {});
  }

  function cloudSignal(status, message) {
    window.dispatchEvent(new CustomEvent('yara:master-schedule-cloud', {
      detail: { status: status, message: message || '' }
    }));
  }

  function pushCloud(state) {
    var config = cloudConfig();
    if (!config.ready || cloudBusy) return Promise.resolve(false);
    cloudBusy = true;
    cloudSignal('syncing', '正在同步主课表');
    return fetch(config.url + '/rest/v1/yara_todo', {
      method: 'POST',
      headers: cloudHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({
        id: CLOUD_ROW,
        data: state || read(),
        updated_at: (state && state.updatedAt) || nowIso()
      })
    }).then(function (response) {
      if (!response.ok) throw new Error('云端写入失败');
      cloudSignal('online', '主课表已同步');
      return true;
    }).catch(function () {
      cloudSignal('offline', '云同步暂不可用，本机数据已保存');
      return false;
    }).finally(function () {
      cloudBusy = false;
    });
  }

  function scheduleCloudPush(state) {
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () { pushCloud(state); }, 800);
  }

  function syncCloud() {
    var config = cloudConfig();
    if (!config.ready || cloudBusy) {
      cloudSignal('local', '本机模式');
      return Promise.resolve(read());
    }
    cloudBusy = true;
    cloudSignal('syncing', '正在核对云端主课表');
    return fetch(
      config.url + '/rest/v1/yara_todo?id=eq.' + encodeURIComponent(CLOUD_ROW) +
      '&select=data,updated_at',
      { headers: cloudHeaders() }
    ).then(function (response) {
      if (!response.ok) throw new Error('云端读取失败');
      return response.json();
    }).then(function (rows) {
      var local = read();
      if (!rows.length || !validState(rows[0].data)) {
        cloudBusy = false;
        return pushCloud(local).then(function () { return local; });
      }
      var remote = rows[0].data;
      var remoteTime = Date.parse(remote.updatedAt || rows[0].updated_at || 0) || 0;
      var localTime = Date.parse(local.updatedAt || 0) || 0;
      if (remoteTime > localTime) {
        write(remote);
        cloudSignal('online', '已采用云端最新主课表');
        return remote;
      }
      if (localTime > remoteTime) {
        cloudBusy = false;
        return pushCloud(local).then(function () { return local; });
      }
      cloudSignal('online', '主课表已是最新');
      return local;
    }).catch(function () {
      cloudSignal('offline', '云同步暂不可用，本机数据已保存');
      return read();
    }).finally(function () {
      cloudBusy = false;
    });
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== KEY || !event.newValue) return;
    try {
      var state = JSON.parse(event.newValue);
      if (validState(state)) notify(state);
    } catch (error) {}
  });

  window.addEventListener('yara:runtime-config-updated', function () {
    syncCloud();
  });

  window.YaraMasterSchedule = {
    key: KEY,
    importBackupKey: IMPORT_BACKUP_KEY,
    cloudRow: CLOUD_ROW,
    version: VERSION,
    read: function () { return clone(read()); },
    getCourseData: getCourseData,
    hydrateCourseData: hydrateCourseData,
    saveCourseData: saveCourseData,
    replacePeriod: replacePeriod,
    updateLesson: updateLesson,
    updateLessonsBatch: updateLessonsBatch,
    updateSharedScheduleSessions: updateSharedScheduleSessions,
    addLesson: addLesson,
    deleteLesson: deleteLesson,
    undo: undo,
    restoreImportBackup: restoreImportBackup,
    subscribe: subscribe,
    computeStatus: computeStatus,
    syncCloud: syncCloud,
    pushCloud: function () { return pushCloud(read()); }
  };

  read();
  setTimeout(syncCloud, 120);
})();
