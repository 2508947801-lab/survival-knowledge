(function () {
  'use strict';

  var store = window.YaraMasterSchedule;
  if (!store) return;

  var view = {
    project: '',
    period: '',
    search: '',
    status: '',
    selectedId: ''
  };
  var state = store.read();
  var toastTimer = 0;

  var projectSelect = document.getElementById('projectSelect');
  var periodSelect = document.getElementById('periodSelect');
  var searchInput = document.getElementById('searchInput');
  var statusSelect = document.getElementById('statusSelect');
  var scheduleBody = document.getElementById('scheduleBody');
  var periodTabs = document.getElementById('periodTabs');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function toast(message) {
    var element = document.getElementById('masterToast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { element.classList.remove('show'); }, 2200);
  }

  function projects() {
    return Object.keys(state.courseData || {});
  }

  function periods() {
    return Object.keys((state.courseData && state.courseData[view.project]) || {});
  }

  function currentRows() {
    return ((state.courseData && state.courseData[view.project] &&
      state.courseData[view.project][view.period]) || []);
  }

  function filteredRows() {
    var query = view.search.toLowerCase();
    return currentRows().filter(function (row) {
      var status = store.computeStatus(row.time);
      if (view.status && status !== view.status) return false;
      if (!query) return true;
      return [
        row.sequence, row.chapter, row.lesson, row.time, row.lessonId,
        row.homeworkId, row.videoId, status
      ].join(' ').toLowerCase().indexOf(query) >= 0;
    });
  }

  function ensureSelection() {
    var allProjects = projects();
    if (!allProjects.includes(view.project)) view.project = allProjects[0] || '';
    var allPeriods = periods();
    if (!allPeriods.includes(view.period)) view.period = allPeriods[0] || '';
    if (!currentRows().some(function (row) { return row.id === view.selectedId; })) {
      view.selectedId = '';
    }
  }

  function renderFilters() {
    ensureSelection();
    projectSelect.innerHTML = projects().map(function (project) {
      return '<option value="' + escapeHtml(project) + '">' + escapeHtml(project) + '</option>';
    }).join('');
    projectSelect.value = view.project;
    periodSelect.innerHTML = periods().map(function (period) {
      return '<option value="' + escapeHtml(period) + '">' + escapeHtml(period) + '</option>';
    }).join('');
    periodSelect.value = view.period;
    searchInput.value = view.search;
    statusSelect.value = view.status;

    periodTabs.innerHTML = periods().map(function (period) {
      var active = period === view.period ? ' active' : '';
      var count = state.courseData[view.project][period].length;
      return '<button class="master-sheet-tab' + active + '" type="button" role="tab" ' +
        'aria-selected="' + (period === view.period ? 'true' : 'false') + '" data-period="' +
        escapeHtml(period) + '">' + escapeHtml(period) + ' · ' + count + '</button>';
    }).join('');
  }

  function inputCell(row, field, className) {
    var value = field === 'sequence' ? row.sequence : (row[field] || '');
    var inputType = field === 'sequence' ? 'number' : 'text';
    return '<input class="master-cell ' + (className || '') + '" type="' + inputType +
      '" value="' + escapeHtml(value) + '" data-id="' + escapeHtml(row.id) +
      '" data-field="' + escapeHtml(field) + '" aria-label="' +
      escapeHtml(field + '：' + (row.lesson || '课节')) + '">';
  }

  function renderTable() {
    var rows = filteredRows();
    scheduleBody.innerHTML = rows.map(function (row, index) {
      var selected = row.id === view.selectedId ? ' selected' : '';
      var status = store.computeStatus(row.time);
      return '<tr class="' + selected + '" data-row-id="' + escapeHtml(row.id) + '">' +
        '<td><button class="master-btn" type="button" data-select-row="' +
          escapeHtml(row.id) + '" aria-label="选择 ' + escapeHtml(row.lesson) + '">' + (index + 1) + '</button></td>' +
        '<td>' + inputCell(row, 'sequence', 'sequence') + '</td>' +
        '<td>' + inputCell(row, 'chapter') + '</td>' +
        '<td>' + inputCell(row, 'lesson') + '</td>' +
        '<td>' + inputCell(row, 'time') + '</td>' +
        '<td>' + inputCell(row, 'lessonId') + '</td>' +
        '<td>' + inputCell(row, 'homeworkId') + '</td>' +
        '<td>' + inputCell(row, 'videoId') + '</td>' +
        '<td><span class="master-status" data-status="' + escapeHtml(status) + '">' +
          escapeHtml(status) + '</span></td>' +
        '<td><span class="master-row-source">' +
          escapeHtml(row.sourceSheet ? row.sourceSheet + (row.sourceRow ? ' · ' + row.sourceRow : '') : '系统新增') +
          '</span></td>' +
      '</tr>';
    }).join('');
    document.getElementById('emptyState').hidden = rows.length > 0;
    document.getElementById('statVisible').textContent = rows.length;
    document.getElementById('duplicateButton').disabled = !view.selectedId;
    document.getElementById('deleteButton').disabled = !view.selectedId;
  }

  function renderStats() {
    var projectCount = 0;
    var periodCount = 0;
    var lessonCount = 0;
    Object.keys(state.courseData || {}).forEach(function (project) {
      projectCount += 1;
      Object.keys(state.courseData[project] || {}).forEach(function (period) {
        periodCount += 1;
        lessonCount += state.courseData[project][period].length;
      });
    });
    document.getElementById('statProjects').textContent = projectCount;
    document.getElementById('statPeriods').textContent = periodCount;
    document.getElementById('statLessons').textContent = lessonCount.toLocaleString('zh-CN');
    document.getElementById('revisionChip').textContent = '修订 ' + (state.revision || 1);
    var source = state.source || {};
    document.getElementById('sourceNote').textContent =
      '数据源：' + (source.fileName || '系统主课表') +
      (source.modifiedAt ? ' · 源文件 ' + source.modifiedAt.slice(0, 10) : '');
  }

  function render() {
    renderFilters();
    renderStats();
    renderTable();
  }

  function selectRow(id) {
    view.selectedId = id;
    renderTable();
  }

  function updateCell(input) {
    var field = input.dataset.field;
    var value = input.value;
    if (field === 'sequence') value = Number(value) || 0;
    state = store.updateLesson(view.project, view.period, input.dataset.id, (function () {
      var patch = {};
      patch[field] = value;
      return patch;
    })());
    toast('已保存：' + field);
    render();
  }

  function selectedRow() {
    return currentRows().find(function (row) { return row.id === view.selectedId; });
  }

  function addRow(copyFrom) {
    var rows = currentRows();
    var previous = selectedRow() || rows[rows.length - 1] || {};
    var maxSequence = rows.reduce(function (max, row) {
      return Math.max(max, Number(row.sequence) || 0);
    }, 0);
    var lesson = copyFrom ? Object.assign({}, copyFrom) : {
      sequence: maxSequence + 1,
      chapter: previous.chapter || '未归类章节',
      lesson: '新课节',
      time: '',
      lessonId: '',
      homeworkId: '',
      videoId: '',
      status: '未排'
    };
    if (copyFrom) {
      lesson.sequence = maxSequence + 1;
      lesson.lesson = copyFrom.lesson + '（副本）';
      lesson.lessonId = '';
      lesson.id = '';
    }
    state = store.addLesson(view.project, view.period, lesson, view.selectedId);
    var latest = state.courseData[view.project][view.period];
    view.selectedId = latest.find(function (row) {
      return row.lesson === lesson.lesson && row.sequence === lesson.sequence;
    })?.id || '';
    toast(copyFrom ? '已复制课节' : '已新增课节');
    render();
  }

  function confirmDelete() {
    var row = selectedRow();
    if (!row) return;
    var confirmPromise = window.YaraModuleUI
      ? window.YaraModuleUI.confirm({
          title: '删除这节课？',
          message: row.lesson + ' 将从主课表及所有关联视图中移除，可立即撤销。',
          confirmText: '确认删除'
        })
      : Promise.resolve(window.confirm('确认删除“' + row.lesson + '”？'));
    confirmPromise.then(function (confirmed) {
      if (!confirmed) return;
      state = store.deleteLesson(view.project, view.period, row.id);
      view.selectedId = '';
      toast('课节已删除，可点击撤销');
      render();
    });
  }

  function csvCell(value) {
    var text = String(value == null ? '' : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportCsv() {
    var rows = [['项目','期班','序号','章节','课节名称','行课时间','课节ID','作业ID','视频ID','状态']];
    Object.keys(state.courseData || {}).forEach(function (project) {
      Object.keys(state.courseData[project] || {}).forEach(function (period) {
        state.courseData[project][period].forEach(function (row) {
          rows.push([
            project, period, row.sequence, row.chapter, row.lesson, row.time,
            row.lessonId, row.homeworkId, row.videoId, store.computeStatus(row.time)
          ]);
        });
      });
    });
    var csv = '\ufeff' + rows.map(function (row) { return row.map(csvCell).join(','); }).join('\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Yara语言事业部主课表_' + new Date().toISOString().slice(0, 10) + '.csv';
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    toast('主课表 CSV 已导出');
  }

  projectSelect.addEventListener('change', function () {
    view.project = projectSelect.value;
    view.period = '';
    view.selectedId = '';
    render();
  });
  periodSelect.addEventListener('change', function () {
    view.period = periodSelect.value;
    view.selectedId = '';
    render();
  });
  searchInput.addEventListener('input', function () {
    view.search = searchInput.value;
    renderTable();
  });
  statusSelect.addEventListener('change', function () {
    view.status = statusSelect.value;
    renderTable();
  });
  periodTabs.addEventListener('click', function (event) {
    var button = event.target.closest('[data-period]');
    if (!button) return;
    view.period = button.dataset.period;
    view.selectedId = '';
    render();
    if (window.YaraBridge) window.YaraBridge.route(view.period, 3, {
      project: view.project,
      period: view.period
    });
  });
  scheduleBody.addEventListener('click', function (event) {
    var selectButton = event.target.closest('[data-select-row]');
    if (selectButton) selectRow(selectButton.dataset.selectRow);
  });
  scheduleBody.addEventListener('change', function (event) {
    if (event.target.matches('[data-field]')) updateCell(event.target);
  });
  scheduleBody.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && event.target.matches('[data-field]')) {
      event.preventDefault();
      event.target.blur();
    }
  });

  document.getElementById('addButton').addEventListener('click', function () { addRow(null); });
  document.getElementById('duplicateButton').addEventListener('click', function () {
    var row = selectedRow();
    if (row) addRow(row);
  });
  document.getElementById('deleteButton').addEventListener('click', confirmDelete);
  document.getElementById('undoButton').addEventListener('click', function () {
    var restored = store.undo();
    if (!restored) {
      toast('当前没有可撤销的修改');
      return;
    }
    state = restored;
    view.selectedId = '';
    toast('已撤销上一步修改');
    render();
  });
  document.getElementById('syncButton').addEventListener('click', function () {
    store.syncCloud().then(function (latest) {
      state = latest;
      render();
    });
  });
  document.getElementById('exportButton').addEventListener('click', exportCsv);

  store.subscribe(function (next) {
    state = next;
    render();
  });
  window.addEventListener('yara:master-schedule-cloud', function (event) {
    var detail = event.detail || {};
    var chip = document.getElementById('cloudChip');
    chip.dataset.status = detail.status || 'local';
    chip.textContent = detail.message || '本机数据已保存';
  });

  render();
})();
