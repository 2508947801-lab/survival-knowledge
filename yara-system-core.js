(function () {
  'use strict';

  var CACHE_KEY = 'yara_data_hub_cache_v1';
  var SOURCE_KEYS = {
    work: 'yara_daily_todo_v1',
    life: 'yara_life_todo_v1',
    finance: 'yara_ledger_v1',
    capability: 'yara_ops_os_v1',
    growth: 'yara_growth_center_v1'
  };

  function safeJson(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (error) { return fallback; }
  }

  function readSource(key, fallback) {
    try { return safeJson(localStorage.getItem(key), fallback); }
    catch (error) { return fallback; }
  }

  function isoDate(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function monthKey(date) {
    return isoDate(date).slice(0, 7);
  }

  function flatCourses(courseData) {
    var rows = [];
    Object.keys(courseData || {}).forEach(function (project) {
      Object.keys(courseData[project] || {}).forEach(function (period) {
        (courseData[project][period] || []).forEach(function (lesson) {
          rows.push({
            project: project,
            period: period,
            chapter: lesson.chapter || '',
            lesson: lesson.lesson || '未命名课程',
            time: lesson.time || '',
            status: lesson.status || '',
            lessonId: lesson.lessonId || ''
          });
        });
      });
    });
    return rows;
  }

  function buildCourseSummary(courseData, today) {
    var rows = flatCourses(courseData);
    var todayRows = rows.filter(function (row) {
      return row.time.slice(0, 10) === today;
    });
    var overdue = rows.filter(function (row) {
      return row.time && row.time.slice(0, 10) < today && row.status !== '已完成';
    });
    var projects = {};
    rows.forEach(function (row) {
      if (!projects[row.project]) projects[row.project] = { total: 0, done: 0, periods: {} };
      projects[row.project].total += 1;
      if (row.status === '已完成') projects[row.project].done += 1;
      projects[row.project].periods[row.period] = true;
    });
    return {
      total: rows.length,
      done: rows.filter(function (row) { return row.status === '已完成'; }).length,
      today: todayRows,
      overdue: overdue,
      projects: projects
    };
  }

  function buildWorkSummary(work, today) {
    var tasksByDate = work && work.tasks ? work.tasks : {};
    var todayTasks = (tasksByDate[today] || []).slice();
    var overdue = [];
    Object.keys(tasksByDate).forEach(function (date) {
      if (date >= today) return;
      (tasksByDate[date] || []).forEach(function (task) {
        if (!task.done) overdue.push(Object.assign({ date: date }, task));
      });
    });
    overdue.sort(function (a, b) { return a.date.localeCompare(b.date); });
    return {
      today: todayTasks,
      pendingToday: todayTasks.filter(function (task) { return !task.done; }),
      overdue: overdue
    };
  }

  function buildFinanceSummary(finance, now) {
    var ym = monthKey(now);
    var transactions = finance && Array.isArray(finance.transactions) ? finance.transactions : [];
    var monthRows = transactions.filter(function (row) {
      return String(row.date || '').slice(0, 7) === ym;
    });
    var income = 0;
    var expense = 0;
    var spentByCategory = {};
    monthRows.forEach(function (row) {
      var amount = Number(row.amount) || 0;
      if (row.type === 'income') income += amount;
      else {
        expense += amount;
        spentByCategory[row.category || '其他'] = (spentByCategory[row.category || '其他'] || 0) + amount;
      }
    });
    var budgetAlerts = [];
    Object.keys((finance && finance.budgets) || {}).forEach(function (category) {
      var budget = Number(finance.budgets[category]) || 0;
      var spent = spentByCategory[category] || 0;
      if (budget > 0 && spent > budget) {
        budgetAlerts.push({ category: category, budget: budget, spent: spent });
      }
    });
    return { month: ym, income: income, expense: expense, budgetAlerts: budgetAlerts };
  }

  function buildCapabilitySummary(capability) {
    var values = Object.values((capability && capability.scores) || {})
      .map(Number)
      .filter(function (value) { return value > 0; });
    return {
      count: values.length,
      average: values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : null
    };
  }

  function buildGrowthSummary(growth, today) {
    var plans = growth && Array.isArray(growth.plans) ? growth.plans : [];
    var english = growth && Array.isArray(growth.english) ? growth.english : [];
    var reviews = growth && Array.isArray(growth.reviews) ? growth.reviews : [];
    return {
      plans: plans,
      pendingPlans: plans.filter(function (item) { return !item.done; }),
      englishToday: english.some(function (item) { return item.date === today; }),
      reviewToday: reviews.some(function (item) { return item.date === today; })
    };
  }

  function createAction(id, level, title, detail, target) {
    return { id: id, level: level, title: title, detail: detail, target: target };
  }

  var DataHub = {
    state: {
      version: 1,
      updatedAt: '',
      sources: {},
      courses: {},
      work: {},
      life: {},
      finance: {},
      capability: {},
      growth: {},
      reconcile: null,
      actions: [],
      risks: []
    },

    refresh: function (courseData) {
      var now = new Date();
      var today = isoDate(now);
      var work = readSource(SOURCE_KEYS.work, { tasks: {} });
      var life = readSource(SOURCE_KEYS.life, { tasks: [] });
      var finance = readSource(SOURCE_KEYS.finance, { transactions: [], budgets: {} });
      var capability = readSource(SOURCE_KEYS.capability, { scores: {} });
      var growth = readSource(SOURCE_KEYS.growth, { plans: [], english: [], reviews: [] });
      var courses = buildCourseSummary(courseData || {}, today);
      var workSummary = buildWorkSummary(work, today);
      var lifeTasks = Array.isArray(life.tasks) ? life.tasks : [];
      var financeSummary = buildFinanceSummary(finance, now);
      var capabilitySummary = buildCapabilitySummary(capability);
      var growthSummary = buildGrowthSummary(growth, today);
      var cached = readSource(CACHE_KEY, {});
      var reconcile = this.state.reconcile || cached.reconcile || null;
      var actions = [];
      var risks = [];

      workSummary.overdue.slice(0, 3).forEach(function (task) {
        actions.push(createAction(
          'work-overdue-' + task.id,
          'high',
          task.title || '逾期待办',
          task.date + ' 未完成',
          { src: '工作管理/每日工作待办.html', name: '每日工作待办', group: '工作管理' }
        ));
      });
      workSummary.pendingToday.slice(0, 4).forEach(function (task) {
        actions.push(createAction(
          'work-today-' + task.id,
          'medium',
          task.title || '今日待办',
          (task.minutes ? task.minutes + ' 分钟 · ' : '') + '今日工作',
          { src: '工作管理/每日工作待办.html', name: '每日工作待办', group: '工作管理' }
        ));
      });
      courses.today.filter(function (row) { return row.status !== '已完成'; }).slice(0, 4).forEach(function (row) {
        actions.push(createAction(
          'course-' + row.project + '-' + row.period + '-' + row.time,
          'medium',
          row.lesson,
          row.time.slice(11, 16) + ' · ' + row.project + ' · ' + row.period,
          { src: '运营能力地图/academic-system.html', name: '建课系统', group: '教务管理' }
        ));
      });
      if (!capabilitySummary.count) {
        actions.push(createAction(
          'capability-empty',
          'low',
          '完成一次运营能力自评',
          '建立本周能力基线',
          { src: '运营能力地图/交付运营总系统.html', name: '自查总系统', group: '运营能力' }
        ));
      }
      if (growthSummary.pendingPlans.length) {
        actions.push(createAction(
          'growth-plan-' + growthSummary.pendingPlans[0].id,
          'low',
          growthSummary.pendingPlans[0].title || '继续学习计划',
          (growthSummary.pendingPlans[0].minutes || 15) + ' 分钟 · 成长花园',
          { src: '成长花园.html#plan', name: '学习计划', group: '成长花园' }
        ));
      }
      if (!growthSummary.englishToday) {
        actions.push(createAction(
          'growth-english-today',
          'low',
          '完成一次英语输出',
          '今日一句 · 约 5 分钟',
          { src: '成长花园.html#english', name: '英语练习', group: '成长花园' }
        ));
      }
      if (!growthSummary.reviewToday && now.getHours() >= 18) {
        actions.push(createAction(
          'growth-review-today',
          'low',
          '为今天做一次温柔复盘',
          '记录收获、消耗与明日一步',
          { src: '成长花园.html#review', name: '每日复盘', group: '成长花园' }
        ));
      }

      if (workSummary.overdue.length) {
        risks.push({ level: 'high', title: '工作待办逾期', value: workSummary.overdue.length, unit: '项', detail: '最早 ' + workSummary.overdue[0].date });
      }
      if (courses.overdue.length) {
        risks.push({ level: 'high', title: '历史课程状态待核验', value: courses.overdue.length, unit: '节', detail: '课程时间已过但状态未完成' });
      }
      financeSummary.budgetAlerts.forEach(function (alert) {
        risks.push({
          level: 'medium',
          title: alert.category + '预算超额',
          value: Math.round(alert.spent - alert.budget),
          unit: '元',
          detail: '本月支出 ¥' + Math.round(alert.spent) + ' / 预算 ¥' + Math.round(alert.budget)
        });
      });
      if (reconcile && (reconcile.unbound || reconcile.conflicts)) {
        var ownerHint = (reconcile.owners || []).slice(0, 2).map(function (owner) {
          return owner.name + ' ' + owner.count;
        }).join(' · ');
        risks.push({
          level: reconcile.conflicts ? 'high' : 'medium',
          title: '账号异常待处理',
          value: reconcile.abnormal == null ? (reconcile.unbound || 0) + (reconcile.conflicts || 0) : reconcile.abnormal,
          unit: '条',
          detail: '未绑定 ' + (reconcile.unbound || 0) + ' · 冲突 ' + (reconcile.conflicts || 0) +
            (ownerHint ? ' · 负责人：' + ownerHint : '')
        });
      }

      this.state = {
        version: 1,
        updatedAt: now.toISOString(),
        today: today,
        sources: {
          courses: !!courses.total,
          work: !!localStorage.getItem(SOURCE_KEYS.work),
          life: !!localStorage.getItem(SOURCE_KEYS.life),
          finance: !!localStorage.getItem(SOURCE_KEYS.finance),
          capability: !!localStorage.getItem(SOURCE_KEYS.capability),
          reconcile: !!reconcile,
          growth: !!localStorage.getItem(SOURCE_KEYS.growth)
        },
        courses: courses,
        work: workSummary,
        life: {
          pending: lifeTasks.filter(function (task) { return !task.done; }),
          done: lifeTasks.filter(function (task) { return task.done; })
        },
        finance: financeSummary,
        capability: capabilitySummary,
        growth: growthSummary,
        reconcile: reconcile,
        actions: actions,
        risks: risks
      };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          version: 1,
          updatedAt: this.state.updatedAt,
          reconcile: reconcile
        }));
      } catch (error) {}
      window.dispatchEvent(new CustomEvent('yara:data-updated', { detail: this.state }));
      return this.state;
    },

    mergeModuleSnapshot: function (snapshot, courseData) {
      if (!snapshot || !snapshot.module) return this.refresh(courseData);
      if (snapshot.module === 'reconcile' && snapshot.reconcile) {
        this.state.reconcile = snapshot.reconcile;
      }
      return this.refresh(courseData);
    }
  };

  var Router = {
    current: { group: '首页', name: '首页', src: '', child: '', level: 1 },

    open: function (route) {
      this.current = Object.assign({ child: '', level: 2 }, route || {});
      this.render();
      window.dispatchEvent(new CustomEvent('yara:route-changed', { detail: this.current }));
    },

    child: function (route) {
      if (!route) return;
      this.current.child = route.label || '';
      this.current.level = Math.max(2, Number(route.level) || 3);
      this.render();
      window.dispatchEvent(new CustomEvent('yara:route-changed', { detail: this.current }));
    },

    home: function () {
      this.current = { group: '首页', name: '首页', src: '', child: '', level: 1 };
      this.render();
    },

    render: function () {
      var el = document.getElementById('breadcrumb');
      if (!el) return;
      if (this.current.level === 1) {
        el.innerHTML = '<strong>首页</strong>';
        el.title = '首页';
        return;
      }
      var pieces = [this.current.group, this.current.name];
      if (this.current.child && this.current.child !== this.current.name) pieces.push(this.current.child);
      el.innerHTML = pieces.map(function (piece, index) {
        return index === pieces.length - 1 ? '<strong>' + UI.escape(piece) + '</strong>' : UI.escape(piece);
      }).join(' <span class="route-separator">/</span> ');
      el.title = pieces.join(' / ');
    }
  };

  var UI = {
    escape: function (value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    toastTimer: null,

    toast: function (message, options) {
      var toast = document.getElementById('toast');
      if (!toast) return;
      options = options || {};
      toast.innerHTML = '<span>' + this.escape(message) + '</span>';
      if (typeof options.action === 'function' && options.actionLabel) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'toast-action';
        button.textContent = options.actionLabel;
        button.addEventListener('click', function () {
          options.action();
          toast.classList.remove('show');
        }, { once: true });
        toast.appendChild(button);
      }
      toast.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(function () { toast.classList.remove('show'); }, options.duration || 2600);
    },

    confirm: function (options) {
      options = options || {};
      var existing = document.getElementById('yaraConfirmBackdrop');
      if (existing) existing.remove();
      return new Promise(function (resolve) {
        var backdrop = document.createElement('div');
        backdrop.id = 'yaraConfirmBackdrop';
        backdrop.className = 'yara-confirm-backdrop';
        backdrop.innerHTML =
          '<div class="yara-confirm-card" role="dialog" aria-modal="true" aria-labelledby="yaraConfirmTitle">' +
            '<div class="yara-confirm-mark">' + (options.danger ? '!' : '✓') + '</div>' +
            '<div><h3 id="yaraConfirmTitle">' + UI.escape(options.title || '确认操作') + '</h3>' +
            '<p>' + UI.escape(options.message || '请确认是否继续。') + '</p></div>' +
            '<div class="yara-confirm-actions">' +
              '<button type="button" data-confirm="cancel">取消</button>' +
              '<button type="button" class="' + (options.danger ? 'danger' : 'primary') + '" data-confirm="ok">' + UI.escape(options.confirmText || '确认') + '</button>' +
            '</div>' +
          '</div>';
        function finish(value) {
          document.removeEventListener('keydown', onKey);
          backdrop.remove();
          resolve(value);
        }
        function onKey(event) {
          if (event.key === 'Escape') finish(false);
        }
        backdrop.addEventListener('click', function (event) {
          if (event.target === backdrop || event.target.dataset.confirm === 'cancel') finish(false);
          if (event.target.dataset.confirm === 'ok') finish(true);
        });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(backdrop);
        backdrop.querySelector('[data-confirm="ok"]').focus();
      });
    }
  };

  window.YaraSystem = {
    DataHub: DataHub,
    Router: Router,
    UI: UI,
    sourceKeys: SOURCE_KEYS
  };
})();
