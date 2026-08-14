(function () {
  'use strict';

  var PROJECT = '杨家成3980';
  var store = window.YaraMasterSchedule;
  if (!store) return;
  var state = store.read();
  var groups = [];
  var registry = new Map();
  var toastTimer = 0;
  var view = { search:'', type:'', range:'future' };

  function clean(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) { return clean(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function isShared(row) { return /纠音|语聊|交流房/i.test(clean(row && row.lesson)); }
  function typeOf(name) { return /语聊|交流房/i.test(clean(name)) ? '语聊' : '纠音'; }
  function parseTime(value) {
    var match = clean(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
    return match ? { date:match[1], time:match[2] + ':' + match[3] } : null;
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function statusOf(date) { return date < todayKey() ? '已完成' : (date === todayKey() ? '今日待上' : '待上'); }
  function toast(message) {
    var node = document.getElementById('sharedToast');
    node.textContent = message; node.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 2400);
  }
  function confirmAction(options) {
    if (window.YaraModuleUI) return window.YaraModuleUI.confirm(options);
    return Promise.resolve(window.confirm(options.message || options.title || '确认操作？'));
  }
  function rowsById() {
    var map = new Map();
    var periods = (state.courseData && state.courseData[PROJECT]) || {};
    Object.keys(periods).forEach(function (period) {
      (periods[period] || []).forEach(function (row) { map.set(row.id, { period:period, row:row }); });
    });
    return map;
  }
  function buildGroups() {
    var byId = rowsById();
    var authoritative = Array.isArray(state.source && state.source.sharedSchedule)
      ? state.source.sharedSchedule : [];
    if (authoritative.length) {
      groups = authoritative.map(function (session) {
        var stamp = parseTime(session.time);
        if (!stamp) return null;
        var refs = (session.linkedLessonIds || []).map(function (id) {
          var found = byId.get(id);
          return found ? { project:PROJECT, period:found.period, id:id, row:found.row, time:stamp.time } : null;
        }).filter(Boolean);
        var periodList = Array.from(new Set(refs.map(function (item) { return item.period; }))).sort(function (a,b) { return a.localeCompare(b,'zh-CN'); });
        return {
          id:clean(session.id), date:stamp.date, time:stamp.time, type:typeOf(session.lesson),
          name:clean(session.lesson), names:[clean(session.lesson)], periods:periodList,
          refs:refs, stableIds:refs.map(function (item) { return item.id; }).sort(),
          note:clean(session.note), sourceRow:Number(session.sourceRow) || 0
        };
      }).filter(Boolean).sort(function (a,b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });
      registry = new Map(groups.map(function (group) { return [group.id, group]; }));
      return;
    }
    var byDate = new Map();
    var periods = (state.courseData && state.courseData[PROJECT]) || {};
    Object.keys(periods).forEach(function (period) {
      (periods[period] || []).forEach(function (row) {
        if (!isShared(row)) return;
        var stamp = parseTime(row.time);
        if (!stamp) return;
        if (!byDate.has(stamp.date)) byDate.set(stamp.date, []);
        byDate.get(stamp.date).push({ project:PROJECT, period:period, id:row.id, row:row, time:stamp.time });
      });
    });
    groups = Array.from(byDate.entries()).map(function (entry) {
      var date = entry[0], refs = entry[1];
      var periodList = Array.from(new Set(refs.map(function (item) { return item.period; }))).sort(function (a,b) { return a.localeCompare(b,'zh-CN'); });
      var names = Array.from(new Set(refs.map(function (item) { return clean(item.row.lesson); })));
      var types = Array.from(new Set(refs.map(function (item) { return typeOf(item.row.lesson); })));
      var type = types.length > 1 ? '纠音 / 语聊' : (types[0] || '纠音');
      var times = refs.map(function (item) { return item.time; });
      var time = times.sort(function (a,b) { return times.filter(function(v){return v===b;}).length - times.filter(function(v){return v===a;}).length; })[0] || '20:00';
      var stableIds = refs.map(function (item) { return item.id; }).sort();
      var id = 'YS-' + stableIds[0].replace(/[^a-zA-Z0-9]+/g,'-') + '-' + stableIds.length;
      var name = names.length > 1 ? '杨老师共同课（各期班按课表课型）' : (names[0] || (type === '语聊' ? '语聊交流房' : '纠音课'));
      return { id:id, date:date, time:time, type:type, name:name, names:names, periods:periodList, refs:refs, stableIds:stableIds };
    }).sort(function (a,b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });
    registry = new Map(groups.map(function (group) { return [group.id, group]; }));
  }
  function filteredGroups() {
    var query = view.search.toLowerCase();
    var today = todayKey();
    return groups.filter(function (group) {
      if (view.type && group.type.indexOf(view.type) < 0) return false;
      if (view.range === 'future' && group.date < today) return false;
      if (view.range === 'past' && group.date >= today) return false;
      if (!query) return true;
      return [group.date,group.time,group.type,group.name,group.names.join(' '),group.periods.join(' ')].join(' ').toLowerCase().indexOf(query) >= 0;
    });
  }
  function renderStats() {
    var periods = new Set(), lessons = 0;
    groups.forEach(function (group) { group.periods.forEach(function (period) { periods.add(period); }); lessons += group.refs.length; });
    var next = groups.find(function (group) { return group.date >= todayKey(); });
    document.getElementById('statSessions').textContent = groups.length;
    document.getElementById('statPeriods').textContent = periods.size;
    document.getElementById('statLessons').textContent = lessons;
    document.getElementById('statNext').textContent = next ? next.date.slice(5).replace('-','/') + ' · ' + next.time : '—';
    document.getElementById('statNextName').textContent = next ? next.name + ' · ' + next.periods.join('、') : '暂无待上安排';
    document.getElementById('revisionChip').textContent = '修订 ' + (state.revision || 1);
    var source = state.source || {};
    document.getElementById('sourceNote').textContent = '数据源：' + (source.fileName || '语言事业部主课表') + (source.modifiedAt ? ' · ' + source.modifiedAt.slice(0,10) : '');
  }
  function renderTable() {
    var visible = filteredGroups();
    document.getElementById('scheduleBody').innerHTML = visible.map(function (group) {
      var status = statusOf(group.date);
      var statusClass = status === '今日待上' ? ' is-today' : (status === '待上' ? ' is-future' : '');
      var warnings = [];
      if (group.note) warnings.push(group.note);
      if (!group.refs.length) warnings.push('当前没有在读期班关联，修改只更新共同课基准');
      var warning = warnings.length ? '<span class="lesson-warning">' + escapeHtml(warnings.join(' · ')) + '</span>' : '';
      return '<tr data-group-id="' + escapeHtml(group.id) + '">' +
        '<td><input class="shared-input" type="date" value="' + escapeHtml(group.date) + '" data-date></td>' +
        '<td><input class="shared-input" type="time" step="60" value="' + escapeHtml(group.time) + '" data-time></td>' +
        '<td><span class="type-chip' + (group.type.indexOf('语聊') >= 0 ? ' is-chat' : '') + '">' + escapeHtml(group.type) + '</span></td>' +
        '<td><div class="lesson-name">' + escapeHtml(group.name) + '</div>' + warning + '</td>' +
        '<td><div class="period-list">' + group.periods.map(function (period) { return '<span class="period-chip">' + escapeHtml(period) + '</span>'; }).join('') + '</div></td>' +
        '<td><span class="link-count">' + group.refs.length + ' 节课</span></td>' +
        '<td><span class="status-badge' + statusClass + '">' + status + '</span></td>' +
        '<td><button class="save-row" type="button" data-save disabled>保存联动</button></td>' +
      '</tr>';
    }).join('');
    document.getElementById('emptyState').hidden = visible.length > 0;
  }
  function render() { buildGroups(); renderStats(); renderTable(); }
  function validateTargetDate(group, date) {
    return !groups.some(function (other) { return other.id !== group.id && other.date === date; });
  }
  function saveRow(row) {
    var group = registry.get(row.dataset.groupId);
    if (!group) return;
    var date = row.querySelector('[data-date]').value;
    var time = row.querySelector('[data-time]').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) { toast('请输入完整日期与开始时间'); return; }
    if (!validateTargetDate(group,date)) { toast('该日期已有另一场共同课，请避免合并覆盖'); return; }
    confirmAction({ title:'确认更新共同课？', message:group.name + ' 将调整为 ' + date + ' ' + time + (group.periods.length ? '，关联期班：' + group.periods.join('、') : '；当前暂无关联期班，将先更新共同课基准') + '。', confirmText:'确认联动' }).then(function (confirmed) {
      if (!confirmed) return;
      state = store.updateSharedScheduleSessions([{id:group.id,date:date,time:time}], { kind:'yang-shared-time-update', label:'杨老师共同课 · ' + date + ' ' + time + ' · 联动 ' + group.refs.length + ' 节课' });
      toast(group.refs.length ? '已联动更新 ' + group.refs.length + ' 节课' : '共同课基准已更新'); render();
    });
  }
  function exportWorkbook() {
    if (!window.XLSX) { toast('XLSX 组件未加载'); return; }
    var rows = groups.map(function (group) { return { '联动组ID':group.id, '课程类型':group.type, '课节名称（只读）':group.name, '行课日期':group.date, '开始时间':group.time, '关联期班（只读）':group.periods.join('、'), '关联课节数':group.refs.length, '备注':group.note || '', '关联稳定ID（勿修改）':group.stableIds.join('|') }; });
    var sheet = XLSX.utils.json_to_sheet(rows, { header:['联动组ID','课程类型','课节名称（只读）','行课日期','开始时间','关联期班（只读）','关联课节数','备注','关联稳定ID（勿修改）'] });
    sheet['!cols'] = [{wch:34},{wch:10},{wch:38},{wch:14},{wch:12},{wch:38},{wch:12},{wch:22},{wch:80}];
    var book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'杨老师纠音与语聊');
    XLSX.writeFile(book,'杨老师纠音与语聊联动课表_' + todayKey().replace(/-/g,'') + '.xlsx');
    toast('已导出 XLSX；请勿修改稳定 ID 列');
  }
  function normalizeExcelDate(value) {
    var text = clean(value).replace(/[./]/g,'-');
    var match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return match ? match[1] + '-' + String(match[2]).padStart(2,'0') + '-' + String(match[3]).padStart(2,'0') : '';
  }
  function normalizeExcelTime(value) {
    var text = clean(value); var match = text.match(/^(\d{1,2}):(\d{2})/);
    return match ? String(match[1]).padStart(2,'0') + ':' + match[2] : '';
  }
  function importWorkbook(file) {
    if (!window.XLSX) { toast('XLSX 组件未加载'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var workbook = XLSX.read(reader.result,{type:'array'});
        var rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:'',raw:false});
        if (!rows.length) throw new Error('表格没有可导入的数据');
        var index = rowsById(), seen = new Set(), targetDates = new Set(), changes = [], sessionUpdates = [];
        rows.forEach(function (row, rowIndex) {
          var groupId = clean(row['联动组ID']);
          var group = registry.get(groupId);
          var date = normalizeExcelDate(row['行课日期']);
          var time = normalizeExcelTime(row['开始时间']);
          var ids = clean(row['关联稳定ID（勿修改）']).split('|').map(clean).filter(Boolean);
          if (!group) throw new Error('第 ' + (rowIndex+2) + ' 行联动组 ID 不存在');
          if (!date || !time) throw new Error('第 ' + (rowIndex+2) + ' 行缺少日期或时间');
          if (ids.slice().sort().join('|') !== group.stableIds.slice().sort().join('|')) throw new Error('第 ' + (rowIndex+2) + ' 行关联稳定 ID 已被修改');
          if (targetDates.has(date)) throw new Error('第 ' + (rowIndex+2) + ' 行与其他共同课使用了同一日期');
          targetDates.add(date);
          sessionUpdates.push({id:groupId,date:date,time:time});
          ids.forEach(function (id) {
            if (seen.has(id)) throw new Error('稳定 ID 重复：' + id);
            seen.add(id);
            var found = index.get(id);
            if (!found || !isShared(found.row)) throw new Error('稳定 ID 不存在或不是杨老师共同课：' + id);
            changes.push({ project:PROJECT, period:found.period, id:id, patch:{time:date + ' ' + time} });
          });
        });
        confirmAction({ title:'确认导入并联动？', message:'将按 ' + rows.length + ' 场共同课更新 ' + changes.length + ' 节关联课。导入写入为一次修订，可撤销。', confirmText:'确认导入' }).then(function (confirmed) {
          if (!confirmed) return;
          state = store.updateSharedScheduleSessions(sessionUpdates,{kind:'yang-shared-xlsx-import',label:'导入杨老师共同课 XLSX · ' + rows.length + ' 场 · ' + changes.length + ' 节'});
          toast('导入成功：已联动 ' + changes.length + ' 节课'); render();
        });
      } catch (error) { toast('导入未写入：' + error.message); }
      document.getElementById('importInput').value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  document.getElementById('scheduleBody').addEventListener('input',function (event) {
    var row = event.target.closest('tr'); if (row) row.querySelector('[data-save]').disabled = false;
  });
  document.getElementById('scheduleBody').addEventListener('click',function (event) { var button=event.target.closest('[data-save]'); if(button) saveRow(button.closest('tr')); });
  document.getElementById('searchInput').addEventListener('input',function(){view.search=this.value;renderTable();});
  document.getElementById('typeSelect').addEventListener('change',function(){view.type=this.value;renderTable();});
  document.getElementById('rangeSelect').addEventListener('change',function(){view.range=this.value;renderTable();});
  document.getElementById('exportButton').addEventListener('click',exportWorkbook);
  document.getElementById('importButton').addEventListener('click',function(){document.getElementById('importInput').click();});
  document.getElementById('importInput').addEventListener('change',function(){if(this.files[0]) importWorkbook(this.files[0]);});
  document.getElementById('undoButton').addEventListener('click',function(){var previous=store.undo();if(!previous){toast('当前页面没有可撤销步骤');return;}state=previous;toast('已撤销上一步联动');render();});
  document.getElementById('syncButton').addEventListener('click',function(){document.getElementById('cloudChip').dataset.status='syncing';document.getElementById('cloudChip').textContent='同步中';store.syncCloud().then(function(next){state=next||store.read();render();});});
  window.addEventListener('yara:master-schedule-cloud',function(event){var detail=event.detail||{},chip=document.getElementById('cloudChip');chip.dataset.status=detail.status||'local';chip.textContent=detail.message||'本机已保存';});
  store.subscribe(function(next){state=next;render();});
  render();
  if (window.YaraBridge) window.YaraBridge.route('杨老师纠音与语聊',3,{source:'master-schedule'});
})();
