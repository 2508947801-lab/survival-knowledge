/**
 * yara-tests.js — 只读浏览器冒烟测试
 * 仅当外壳使用 ?test=1 打开时由管理系统动态载入。
 */
(function(){
  'use strict';
  if(new URLSearchParams(location.search).get('test') !== '1') return;

  var results = { pass:0, fail:0, skip:0, errors:[] };
  function check(name, fn){
    try{
      var outcome = fn();
      if(outcome === 'skip'){ results.skip++; return; }
      if(outcome !== true) throw new Error('assertion returned false');
      results.pass++;
    }catch(error){
      results.fail++;
      results.errors.push({name:name, message:error && error.message ? error.message : String(error)});
    }
  }
  function equal(actual, expected){ return actual === expected; }

  function run(){
    results = { pass:0, fail:0, skip:0, errors:[] };
    check('日期补零', function(){ return equal(normalizeDateString('2026-9-8'), '2026-09-08'); });
    check('非法日期', function(){ return equal(normalizeDateString('not-a-date'), ''); });
    check('时间提取', function(){ return equal(extractTime('2026-09-08T09:30:00'), '09:30'); });
    check('稳定排序', function(){ return stableTimeCompare({time:'09:00'}, {time:'10:00'}) < 0; });
    check('HTML 转义', function(){ return equal(safeEsc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;'); });
    check('存储容量查询', function(){
      if(!window.StorageGuard) return 'skip';
      var state = StorageGuard.check();
      return !!state && ['ok','warning','critical'].indexOf(state.level) >= 0;
    });
    check('错误摘要只读', function(){
      if(!window.ErrorMonitor) return 'skip';
      var summary = ErrorMonitor.getSummary();
      return !!summary && typeof summary.count === 'number';
    });
    check('迁移版本只读', function(){
      if(!window.DataMigration) return 'skip';
      return typeof DataMigration.getVersion() === 'number' && Array.isArray(DataMigration.getMigrationHistory());
    });
    check('键盘导航已绑定', function(){
      if(!window.YaraKeyboardNav) return 'skip';
      var status = YaraKeyboardNav.getStatus();
      return status.bound && status.hasRoot && status.tileCount > 0;
    });
    check('模块注册表有效', function(){ return Array.isArray(window.YARA_MODULES) && YARA_MODULES.length > 0; });
    check('自查总系统已退役', function(){
      return !YARA_MODULES.some(function(mod){ return mod.src.indexOf('交付运营总系统') >= 0 || mod.name === '自查总系统'; });
    });
    check('分类页返回上下文可用', function(){
      return typeof showHubCluster === 'function' && typeof hubClusterById === 'function' && !!hubClusterById('growth');
    });
    check('日报与把把必中固定归属成长与事业', function(){
      var daily = YARA_MODULES.find(function(mod){ return mod.name === 'Lysie 知识雷达'; });
      var career = YARA_MODULES.find(function(mod){ return mod.name === '把把必中'; });
      return typeof hubModuleClusterId === 'function' && daily && daily.cluster === 'growth' &&
        hubModuleClusterId(daily.src) === 'growth' && career && career.cluster === 'growth';
    });
    check('知识雷达使用单一首页入口', function(){
      return document.querySelectorAll('.knowledge-radar-home').length === 1 &&
        YARA_MODULES.filter(function(mod){ return mod.name === 'Lysie 知识雷达'; }).length === 1;
    });
    check('知识雷达仅含 7 条已核验卡片', function(){
      return Array.isArray(window.LYSIE_RADAR_CARDS) && window.LYSIE_RADAR_CARDS.length === 7 &&
        window.LYSIE_RADAR_CARDS.every(function(card){
          return /^2026-09-0[1-7]$/.test(String(card.id || '')) && /^https:\/\//.test(String(card.sourceUrl || '')) &&
            /^生存知识日报_2026-09-0[1-7]\.html$/.test(String(card.report || ''));
        });
    });
    check('知识闭环键已加入首页刷新范围', function(){
      return window.YARA_CONFIG && Array.isArray(YARA_CONFIG.dashboardRelatedKeys) &&
        YARA_CONFIG.dashboardRelatedKeys.indexOf('lysie_daily_knowledge_loop_v1') >= 0;
    });
    check('分类链路覆盖全部模块且不重复', function(){
      var seen = {};
      Object.keys(YARA_CLUSTER_LANES || {}).forEach(function(clusterId){
        (YARA_CLUSTER_LANES[clusterId] || []).forEach(function(lane){
          (lane.srcs || []).forEach(function(src){ seen[src] = (seen[src] || 0) + 1; });
        });
      });
      return YARA_MODULES.every(function(mod){ return seen[mod.src] === 1; }) && Object.keys(seen).length === YARA_MODULES.length;
    });
    check('首页高频入口为 8 个', function(){ return document.querySelectorAll('#homeQuickTools .hub-tile').length === 8; });
    check('全部工具完整', function(){ return document.querySelectorAll('#hubLaunchpad .hub-tile').length === YARA_MODULES.length; });
    check('首页行动不超过 5 项', function(){ return document.querySelectorAll('#dashActions .action-item').length <= 5; });
    check('首页默认只展开 2 项行动', function(){ return document.querySelectorAll('#dashActions > .action-item').length <= 2; });
    check('手机核心区 DOM 顺序为今天到知识雷达', function(){
      var grid=document.querySelector('.command-center-grid');
      var children=grid?Array.from(grid.children):[];
      return children[0]&&children[0].classList.contains('action-center')&&children[1]&&children[1].classList.contains('knowledge-radar-home');
    });
    check('最近继续与周复盘已登记', function(){
      return !!document.getElementById('recentModuleStrip')&&!!document.getElementById('weeklyReviewHome')&&
        YARA_CONFIG.dashboardRelatedKeys.indexOf('lysie_recent_module_v1')>=0&&
        YARA_CONFIG.dashboardRelatedKeys.indexOf('lysie_weekly_workspace_review_v1')>=0;
    });
    check('跨模块临时草稿协议已接入', function(){ return typeof sanitizeRoutePayload==='function'&&document.documentElement.innerHTML.indexOf('open-module-request')>=0; });
    render();
    console.info('[Lysie Tests]', JSON.parse(JSON.stringify(results)));
    return results;
  }

  function render(){
    var old = document.getElementById('yaraTestPanel');
    if(old) old.remove();
    var panel = document.createElement('aside');
    panel.id = 'yaraTestPanel';
    panel.className = 'yara-test-panel ' + (results.fail ? 'has-failures' : 'is-passing');
    panel.setAttribute('role','status');
    var summary = document.createElement('strong');
    summary.textContent = '浏览器测试：' + results.pass + ' 通过 · ' + results.fail + ' 失败 · ' + results.skip + ' 跳过';
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '关闭';
    close.addEventListener('click', function(){ panel.remove(); });
    panel.appendChild(summary);
    panel.appendChild(close);
    if(results.errors.length){
      var list = document.createElement('ul');
      results.errors.forEach(function(item){
        var li = document.createElement('li');
        li.textContent = item.name + '：' + item.message;
        list.appendChild(li);
      });
      panel.appendChild(list);
    }
    document.body.appendChild(panel);
  }

  window.YaraTest = { run:run, results:function(){ return JSON.parse(JSON.stringify(results)); } };
  window.setTimeout(run, 0);
})();
