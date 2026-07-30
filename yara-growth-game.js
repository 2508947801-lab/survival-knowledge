(function () {
  'use strict';

  if (window.YaraGame) return;

  var KEY = 'yara_growth_game_v1';
  var SB_URL = 'https://yyqnugidfwgstlcgvnep.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cW51Z2lkZndnc3RsY2d2bmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzEzNTAsImV4cCI6MjEwMDgwNzM1MH0.ufK55TfjlF4w98x6Fj28oFjUnYGz4lsY7MRaHVV2aIA';
  var SB_ROW = 'growth-game';
  var cloudTimer = 0;
  var syncing = false;
  var DEFAULT_STATE = {
    version: 1,
    xp: 0,
    coins: 24,
    water: 3,
    streak: 1,
    lastActive: '',
    plant: { stage: 0, growth: 0, name: '小芽' },
    rewarded: {},
    history: [],
    updatedAt: ''
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function dayKey(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function normalize(source) {
    var state = Object.assign(clone(DEFAULT_STATE), source || {});
    state.plant = Object.assign(clone(DEFAULT_STATE.plant), (source && source.plant) || {});
    state.rewarded = state.rewarded && typeof state.rewarded === 'object' ? state.rewarded : {};
    state.history = Array.isArray(state.history) ? state.history.slice(-80) : [];
    return state;
  }

  function load() {
    try {
      return normalize(JSON.parse(localStorage.getItem(KEY) || 'null'));
    } catch (error) {
      return normalize();
    }
  }

  function save(state, reason) {
    state = normalize(state);
    state.lastActive = dayKey();
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) {}
    window.dispatchEvent(new CustomEvent('yara:game-updated', {
      detail: { state: clone(state), reason: reason || 'sync' }
    }));
    scheduleCloudSave(state);
    return state;
  }

  function cloudHeaders(extra) {
    var headers = {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json'
    };
    Object.keys(extra || {}).forEach(function (key) { headers[key] = extra[key]; });
    return headers;
  }

  function pushCloud(state) {
    if (!window.fetch || syncing) return Promise.resolve(false);
    syncing = true;
    return fetch(SB_URL + '/rest/v1/yara_todo', {
      method: 'POST',
      headers: cloudHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ id: SB_ROW, data: state, updated_at: state.updatedAt || new Date().toISOString() })
    }).then(function (response) {
      syncing = false;
      return response.ok;
    }).catch(function () {
      syncing = false;
      return false;
    });
  }

  function scheduleCloudSave(state) {
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () { pushCloud(state); }, 650);
  }

  function syncCloud() {
    if (!window.fetch) return Promise.resolve(load());
    return fetch(SB_URL + '/rest/v1/yara_todo?id=eq.' + SB_ROW + '&select=data,updated_at', {
      headers: cloudHeaders()
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (rows) {
      var local = load();
      if (!rows || !rows.length || !rows[0].data) {
        pushCloud(local);
        return local;
      }
      var remote = normalize(rows[0].data);
      var localTime = Date.parse(local.updatedAt || 0) || 0;
      var remoteTime = Date.parse(remote.updatedAt || rows[0].updated_at || 0) || 0;
      if (remoteTime > localTime) {
        try { localStorage.setItem(KEY, JSON.stringify(remote)); } catch (error) {}
        window.dispatchEvent(new CustomEvent('yara:game-updated', {
          detail: { state: clone(remote), reason: 'cloud' }
        }));
        return remote;
      }
      if (localTime > remoteTime) pushCloud(local);
      return local;
    }).catch(function () {
      return load();
    });
  }

  function levelInfo(state) {
    var level = Math.floor(state.xp / 100) + 1;
    var current = state.xp % 100;
    return { level: level, current: current, target: 100, percent: current };
  }

  function plantInfo(state) {
    var stages = [
      { name: '刚睡醒的种子', icon: '🌰', note: '在土里悄悄蓄力' },
      { name: '探头小芽', icon: '🌱', note: '今天也向光一点点' },
      { name: '舒展绿叶', icon: '🪴', note: '你的坚持正在长大' },
      { name: '初绽花苞', icon: '🌷', note: '小进步开始有了颜色' },
      { name: '治愈花园', icon: '🌸', note: '认真生活的人会开花' }
    ];
    var stage = Math.max(0, Math.min(stages.length - 1, Math.floor(state.plant.growth / 5)));
    return Object.assign({ stage: stage, growth: state.plant.growth, nextAt: (stage + 1) * 5 }, stages[stage]);
  }

  function updateStreak(state) {
    var today = dayKey();
    if (!state.lastActive || state.lastActive === today) return state;
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    state.streak = state.lastActive === dayKey(yesterday) ? Math.max(1, state.streak + 1) : 1;
    return state;
  }

  function reward(eventKey, rewardData) {
    if (!eventKey) return { awarded: false, state: load() };
    var state = updateStreak(load());
    if (state.rewarded[eventKey]) return { awarded: false, state: state };
    var reward = Object.assign({ xp: 8, coins: 4, water: 1, label: '完成一件小事' }, rewardData || {});
    state.rewarded[eventKey] = new Date().toISOString();
    state.xp += Number(reward.xp) || 0;
    state.coins += Number(reward.coins) || 0;
    state.water += Number(reward.water) || 0;
    state.history.push({
      id: eventKey,
      at: new Date().toISOString(),
      label: reward.label,
      xp: reward.xp,
      coins: reward.coins,
      water: reward.water
    });
    save(state, 'reward');
    return { awarded: true, reward: reward, state: state };
  }

  function waterPlant() {
    var state = updateStreak(load());
    if (state.water < 1) return { ok: false, message: '水滴不够啦，完成一件小事就能获得新的水滴。', state: state };
    state.water -= 1;
    state.plant.growth += 1;
    var info = plantInfo(state);
    state.plant.stage = info.stage;
    state.plant.name = info.name;
    state.history.push({
      id: 'water-' + Date.now(),
      at: new Date().toISOString(),
      label: '给植物浇了一次水',
      xp: 0,
      coins: 0,
      water: -1
    });
    save(state, 'water');
    return { ok: true, message: info.stage >= 4 ? '花园今天也很漂亮。' : '喝到水啦，离下一次成长更近了。', state: state };
  }

  function ingestSnapshot(snapshot) {
    if (!snapshot || !snapshot.module) return [];
    var results = [];
    if (snapshot.work && snapshot.work.tasks) {
      Object.keys(snapshot.work.tasks).forEach(function (date) {
        (snapshot.work.tasks[date] || []).forEach(function (task) {
          if (!task.done) return;
          results.push(reward('work:' + date + ':' + task.id, {
            xp: 12, coins: 6, water: 1, label: '完成工作待办 · ' + (task.title || '未命名任务')
          }));
        });
      });
    }
    if (snapshot.life && Array.isArray(snapshot.life.tasks)) {
      snapshot.life.tasks.forEach(function (task) {
        if (!task.done) return;
        results.push(reward('life:' + task.id, {
          xp: 9, coins: 5, water: 1, label: '完成生活待办 · ' + (task.title || '生活小事')
        }));
      });
    }
    if (snapshot.finance && Array.isArray(snapshot.finance.transactions)) {
      snapshot.finance.transactions.forEach(function (item) {
        results.push(reward('finance:' + item.id, {
          xp: 3, coins: 1, water: 0, label: '认真记下一笔账'
        }));
      });
    }
    return results.filter(function (item) { return item.awarded; });
  }

  window.YaraGame = {
    key: KEY,
    load: load,
    save: save,
    reward: reward,
    water: waterPlant,
    ingestSnapshot: ingestSnapshot,
    levelInfo: levelInfo,
    plantInfo: plantInfo,
    dayKey: dayKey,
    syncCloud: syncCloud
  };

  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    window.dispatchEvent(new CustomEvent('yara:game-updated', {
      detail: { state: load(), reason: 'storage' }
    }));
  });

  syncCloud();
})();
