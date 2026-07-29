(function () {
  'use strict';

  var STORAGE_KEY = 'yara_career_center_v1';
  var SB_URL = 'https://yyqnugidfwgstlcgvnep.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cW51Z2lkZndnc3RsY2d2bmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzEzNTAsImV4cCI6MjEwMDgwNzM1MH0.ufK55TfjlF4w98x6Fj28oFjUnYGz4lsY7MRaHVV2aIA';
  var SB_TABLE = 'yara_todo';
  var SB_ROW = 'career_v1';
  var SB_POLL_MS = 15000;
  var cloudReady = false;
  var cloudSaveTimer = null;
  var lastCloudSync = 0;
  var syncChannel = null;
  var hadLocalState = false;
  var state = {
    activeView: 'overview',
    activeJobId: 'opc',
    resumeTargetId: 'opc',
    currentResumeId: 'master-v1',
    versions: [],
    evidence: [],
    customJobs: [],
    updatedAt: 0,
    generatedMarkdown: '',
    generatedHtml: ''
  };

  var MASTER_RESUME_TEXT = [
    '刘颖，本科，求职意向：交付运营 / 课程产品运营 / 运营效率方向。',
    '雅识教育科技有限公司，交付运营，2025.03至今。',
    '累计向产研提报25项产品需求，15项落地，每项包含问题背景、方案设计和ROI量化。',
    '设计6大模块19个流程节点的SOP架构，建立完课数据P0/P1归因框架。',
    '主导7项APP端需求收集、评估和推进，完成销售需求、运营评估、产研可行性、排期落地闭环。',
    '独立设计课表批量生成工具，覆盖99节每期、3个产品、3个模块和复杂节假日规则。',
    '搭建排课接量统筹系统，覆盖18期班、每期5名辅导，完成44人到50坑位分配。',
    '独立搭建交付运营一体化数据平台，整合课表管理、对账看板、日报系统和能力地图。',
    '统筹正价双线三档产品与引流三品的全链路获客交付，负责课程上线、开班、陪跑、结营复盘。',
    '设计订单驱动批量开课流程，完成小鹅通筛选、金额和手机号双键匹配、雅识后台批量开课。',
    '每月处理约420单退费跨平台路由，每周4天直播跟播，实时处理账号冲突。',
    '建立完课率、退费率、环比、同比、业绩、试听数六项指标的运营周报体系。',
    '跨系统数据对账并定位导入来源、账号绑定、渠道差异三维根因。',
    '运营AI外呼、AI口语测评和扩科支付链路三条AI工具线，参与ASR评分策略调优。',
    '杭州顺佳教育科技有限公司，教务管理，2023.09至2025.02。',
    '负责编排早自习、正课、周测、补课等多类型课表，确保多班级并行零冲突。',
    '突发调课30分钟内完成教师、学生、家长三方通知。',
    '使用Excel在10分钟内完成班级排名、进步幅度和学科分布报告。',
    '负责考试成绩统计、教师工作量报表、学员档案数字化管理及销售交付协同。',
    '技能：Excel透视表、VLOOKUP、XLOOKUP、SUMIFS、环比同比、ROI量化、数据归因、SOP、用户生命周期运营、课程运营、小鹅通、飞书、企业微信、ChatGPT、Gemini、Codex、AI外呼、ASR。',
    '教育：安徽建筑大学城市建设学院，财务管理本科；金融投资创新大赛省级三等奖、财税技能大赛三等奖、初级会计职称、CET-4。'
  ].join('\n');

  var DEFAULT_EVIDENCE = [
    {id:'ev-1',type:'产品需求',title:'25项需求提报，15项落地',detail:'完整覆盖问题背景、方案设计、ROI量化与排期推进。',tags:['产品思维','产研协同']},
    {id:'ev-2',type:'系统建设',title:'独立搭建6套运营效率工具',detail:'课表生成、接量统筹、对账、日报、能力地图与一体化入口。',tags:['0→1','AI协作']},
    {id:'ev-3',type:'课程交付',title:'正价双线×三档产品矩阵',detail:'覆盖规划、建课、账号核查、开课、陪跑、结营与复盘。',tags:['全生命周期','在线教育']},
    {id:'ev-4',type:'规模数据',title:'月均198节课、约420单退费路由',detail:'在多产品、多期班和多系统之间保证交付准确性。',tags:['复杂度','执行力']},
    {id:'ev-5',type:'数据运营',title:'六项核心指标周报体系',detail:'完课率、退费率、环比、同比、业绩、试听数逐项核验。',tags:['数据分析','经营意识']},
    {id:'ev-6',type:'教务管理',title:'多班级排课与30分钟应急调度',detail:'教师、学生、家长三方同步，保证教学秩序。',tags:['教务','沟通']},
    {id:'ev-7',type:'流程体系',title:'6模块19节点SOP架构',detail:'每个节点包含目标、流程、风险点和改造方向。',tags:['结构化','标准化']},
    {id:'ev-8',type:'AI应用',title:'三条AI工具线并行运营',detail:'AI外呼、AI口语测评、扩科支付链路及ASR策略调优。',tags:['AI','新技术']},
    {id:'ev-9',type:'数据治理',title:'跨系统对账三维归因',detail:'定位导入来源、账号绑定与渠道差异，为业绩核算提供依据。',tags:['归因','风险控制']},
    {id:'ev-10',type:'教学数据',title:'10分钟输出教学分析报告',detail:'利用Excel完成班级排名、进步幅度和学科分布分析。',tags:['Excel','教学质量']}
  ];

  var JOBS = [
    {
      id:'course-product',
      title:'课程产品运营',
      company:'BOSS直聘 · 公司待补充',
      subtitle:'大学生考证 / 升学 / 职业技能 · C端在线教育',
      tags:['课程运营','C端产品','内容运营','数据分析'],
      summary:'偏“选品＋产品包装＋日常运营＋转化优化”的课程产品岗，要求把用户需求、课程卖点与经营数据串成闭环。',
      hard:[
        req('用户调研与竞品分析','partial',['用户需求','调研','竞品','需求收集'],'你有用户需求、销售需求和课程反馈的结构化收集经验，但缺少正式竞品报告或选品结论。','补一份大学生职业教育赛道的5品竞品分析与选品结论。'),
        req('低价引流课与正价课产品形态设计','matched',['正价','引流','产品矩阵','课程'],'你已统筹正价双线×三档和引流三品，并参与新品上线复用。','把产品矩阵画成“引流—转化—交付—续费”漏斗图。'),
        req('课程上架、资源排期与直播配置','matched',['课程上线','建课','直播','排课'],'你有课程创建、权限配置、直播跟播、多期班排课和上线测试的直接证据。','补充一次完整上线项目的时间线与风险清单。'),
        req('课程详情页、宣传素材与PUSH文案','partial',['文案','素材','PUSH','卖点'],'你有信息流素材拆解和卖点优化经历，但最新简历未集中呈现课程文案样本。','制作1页课程详情页卖点文案＋3条PUSH样稿。'),
        req('流量、点击、转化与留存分析','partial',['点击率','转化率','留存率','完课率','退费率'],'你有完课率、退费率、试听数和ROI经验；点击—付费转化漏斗证据仍不足。','建立曝光→点击→试听→付费→完课→续费的指标看板。'),
        req('1—3年在线教育产品运营','matched',['在线教育','课程运营','交付运营'],'你具备连续教育行业经验和多产品课程运营经历。','在简历开头明确写出教育行业年限与产品矩阵规模。')
      ],
      soft:[
        req('用户思维与商业敏感度','matched',['用户生命周期','ROI','退费率'],'你能把用户表现、退费风险与ROI连接到业务决策。','准备一个“用户问题如何变成产品需求”的STAR故事。'),
        req('强学习力与好奇心','matched',['AI','Codex','产品需求'],'你持续学习AI工具并将其变成真实运营系统。','把工具建设沉淀为可展示作品集。'),
        req('细节、责任心与执行力','matched',['核验','准确','风险'],'多系统权限、排课和数据核验都是高准确度场景。','准备一次发现高风险异常并闭环处理的案例。'),
        req('文案、表达与归纳能力','matched',['SOP','结构化','报告'],'你有SOP、周报、PRD和规则引擎等结构化输出。','补充可公开的文案/PRD截图作为附件证据。')
      ],
      raw:'【岗位职责】\n1. 围绕大学生考证、升学、职业技能等赛道开展用户需求调研与竞品分析，输出选品结论，支撑新课立项决策。\n2. 独立完成低价引流课及正价课的产品形态、权益体系设计，输出课程详情页、宣传素材的核心卖点文案。\n3. 负责课程上架、资源位排期、直播配置、月度财务结算对接、PUSH文案撰写等基础运营工作。\n4. 跟踪课程流量、点击、转化等核心数据，持续优化转化路径，提升课程付费转化率与用户留存率。\n\n【任职要求】\n本科及以上，1—3年在线教育C端产品运营经验；熟悉在线教育付费课程商业模式与大学生用户；学习力、细节、责任心、执行力、文案与归纳能力强。',
      stories:['从销售需求到产品需求落地','正价与引流产品矩阵交付','六项指标周报如何驱动决策']
    },
    {
      id:'service-ops',
      title:'服务运营（教务管理）',
      company:'杭州萧山区 · 公司待补充',
      subtitle:'本地学校服务 · 教师管理 · 教学质量',
      tags:['教务管理','师资协同','教学质量','转化扩科'],
      summary:'偏本地校区教务与师资运营，核心是教师供给、教学质量、学情跟进及转化扩科。',
      hard:[
        req('试听、试讲与示范课支持','partial',['试听','教学质量','课程上线'],'你跟踪试听数、课程上线和教学质量，但简历里没有明确“示范课打造”案例。','整理一次试听课或公开课从准备到复盘的项目卡。'),
        req('本地师资招聘与储备','missing',['教师招聘','师资招聘','人才库'],'目前没有教师招聘、兼职师资池或面试筛选的直接证据。','学习师资招聘漏斗，并设计候选人登记表、试讲评分表和储备池。'),
        req('教师培训与教学质量跟进','matched',['教师工作量','教学进度','教学质量','教研'],'你有教师工作量报表、教学进度监控及教研协同经验。','补充一次发现教学异常并推动改进的案例。'),
        req('学情反馈与日常入校质检','partial',['学员档案','学习状态','质量'],'你有学员档案和学习状态跟踪；“入校质检”属于新场景。','设计一张入校教学质检清单，建立可迁移证明。'),
        req('转化、扩科等经营指标','partial',['转化','扩科','业绩','试听数'],'你跟踪业绩、试听数，并参与扩科支付链路，但缺少亲自承担转化指标的数字。','补充转化目标、动作与结果；没有结果时不要虚构。'),
        req('两年以上教务/教学管理经验','matched',['教务管理','排课','教学'],'你在顺佳教育与雅识教育积累了连续教务与交付运营经验。','把两个阶段合并成清晰的“教育交付能力主线”。')
      ],
      soft:[
        req('耐心与亲和力','partial',['学员','家长','教师'],'三方通知、学员跟进可证明沟通耐心，但亲和力需要面试故事支撑。','准备一个安抚学员或协调教师冲突的故事。'),
        req('沟通与文案写作','matched',['周报','通知','SOP'],'你能输出周报、SOP并完成教师学生家长多方通知。','准备两类沟通文本：突发通知与教学反馈。'),
        req('适应能力与团队配合','matched',['跨部门','协同','突发'],'你长期处理临时调课、跨系统问题和产研协同。','用30分钟应急调度案例证明。'),
        req('长期教育行业意愿','matched',['教育行业','在线教育','教务'],'你的职业轨迹连续聚焦教育交付与教务。','面试中讲清从教务到运营系统建设的长期路径。')
      ],
      raw:'【岗位职责】\n1. 协助支撑本地学校的试听、试讲、示范课打造等工作。\n2. 进行本地师资招募、兼职师资池储备，协同做好全职、兼职老师培训与培养。\n3. 协助完成日常入校教学质检，关注学情反馈，保证教学质量。\n4. 与运营经理共同负责转化、扩科等经营指标。\n\n【岗位要求】\n本科及以上，两年以上一线教学、教务管理、教师培训经验，有大型机构教务或教师管理经验优先；耐心、亲和力、沟通与文案能力强；适应力和学习力好、团队配合度高；热爱教育行业。',
      stories:['30分钟完成三方应急调课','教学数据报告支持教学决策','学员从报名到结课的信息流转']
    },
    {
      id:'opc',
      title:'初芯 OPC 培训产品 / 训练营运营',
      company:'初芯 · OPC',
      subtitle:'培训产品策划 · 课程内容 · 训练营全周期',
      tags:['训练营运营','课程产品','AI工具','内容结构化'],
      summary:'与你当前经历最接近：既要求课程产品思维，也要求开营、陪跑、作业、数据与复盘的完整训练营运营能力。',
      hard:[
        req('主题规划、课程结构与学习路径','matched',['产品规划','课程结构','学习路径','SOP'],'你已做产品规划、课程全周期和19节点SOP，具备拆解复杂流程的能力。','把现有交付流程转译成一张训练营学习路径图。'),
        req('大纲、课件、作业与学习资料打磨','partial',['大纲','作业','学习资料','课程内容'],'你负责课程配置与交付，但内容打磨作品在简历中不够明确。','选一个主题完成课程大纲、1节课件和1份作业样例。'),
        req('报名转化、开营、陪跑、答疑、结营复盘','matched',['报名','开课','陪跑','结营','复盘'],'你有课程全生命周期和多产品营期管控的直接证据。','将流程写成“规模—动作—结果—风险”的项目案例。'),
        req('短课、主题营、实战营等产品策划','partial',['引流','主题','产品矩阵'],'你有引流与正价产品矩阵经验，但短课/实战营独立策划样本不足。','设计一个7天AI效率训练营MVP。'),
        req('学员作品、案例与可复用素材沉淀','partial',['案例','SOP','复用','素材'],'你擅长SOP复用，但学员作品与优秀案例库证据较少。','建立学员案例采集模板、授权规则和案例标签体系。'),
        req('报名、完课、作业、满意度数据优化','matched',['完课率','退费率','数据','满意度'],'你建立了完课等六项指标体系并做异常归因。','补齐作业提交率和满意度两项训练营指标。'),
        req('1—3年课程/训练营/知识付费经验','matched',['课程运营','在线教育','交付运营'],'你具备在线教育课程交付与运营系统建设经验。','标题直接定位为“课程产品与训练营运营”。')
      ],
      soft:[
        req('课程产品思维','matched',['产品需求','产品规划','课程'],'25项产品需求和课程矩阵是强证据。','面试展示需求文档、路线图或系统原型。'),
        req('AI与内容创作兴趣','matched',['AI','ChatGPT','Codex'],'你已将AI用于外呼、测评和系统搭建。','整理一个“AI如何提升交付效率”的作品集页面。'),
        req('内容理解与结构化能力','matched',['SOP','归因框架','结构化'],'6模块19节点SOP和P0/P1归因框架证明结构化能力。','准备5分钟白板拆课演示。'),
        req('执行与多方协同','matched',['产研','讲师','学员','跨部门'],'你能跟进产研、辅导、学员、系统和项目节点。','用三方API或跨部门需求落地案例证明。')
      ],
      raw:'【岗位职责】\n1. 负责培训产品和训练营策划，包括主题规划、课程结构、学习路径、活动节奏和交付形式设计。\n2. 协助讲师或合作伙伴完成课程内容打磨，包括大纲梳理、课件结构、作业设计和学习资料整理。\n3. 负责训练营日常运营，包括报名转化、开营准备、学习陪跑、作业跟进、用户答疑、结营复盘等。\n4. 根据用户需求策划短课、主题营、实战营、线上分享等学习产品。\n5. 跟进学员学习过程和作品产出，整理优秀案例、用户反馈和可复用课程素材。\n6. 跟踪报名、转化、完课、作业提交、满意度等数据，持续优化课程内容和运营流程。\n\n【任职要求】\n1—3年课程运营、训练营运营、知识付费、在线教育、社群教育或用户成长项目经验；具备课程产品思维；对AI工具、内容创作、个人成长、创作者经济有兴趣；内容理解和结构化能力强；熟悉训练营开营、陪跑、作业、点评、结营和复盘；执行力强。',
      stories:['6模块19节点SOP如何形成','课程全生命周期营期管控','AI工具线如何落地教育场景']
    }
  ];

  function req(title, status, keywords, evidence, action) {
    return {title:title,status:status,keywords:keywords,evidence:evidence,action:action};
  }

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (error) { return fallback; }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
  }

  function dateLabel() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  }

  function ensureMasterVersion() {
    if (!state.versions.some(function (version) { return version.id === 'master-v1'; })) {
      state.versions.unshift({
        id:'master-v1',
        name:'V1 · 运营效率进阶版',
        source:'刘颖_简历_20260725.docx',
        created:'2026-07-25',
        text:MASTER_RESUME_TEXT
      });
    }
  }

  function stateSnapshot() {
    return {
      versions:state.versions,
      evidence:state.evidence,
      customJobs:state.customJobs,
      currentResumeId:state.currentResumeId,
      activeJobId:state.activeJobId,
      resumeTargetId:state.resumeTargetId,
      updatedAt:state.updatedAt
    };
  }

  function applySnapshot(saved) {
    saved = saved || {};
    state.versions = Array.isArray(saved.versions) ? saved.versions : [];
    state.evidence = Array.isArray(saved.evidence) && saved.evidence.length ? saved.evidence : DEFAULT_EVIDENCE.slice();
    state.customJobs = Array.isArray(saved.customJobs) ? saved.customJobs : [];
    state.currentResumeId = saved.currentResumeId || 'master-v1';
    state.activeJobId = saved.activeJobId || 'opc';
    state.resumeTargetId = saved.resumeTargetId || state.activeJobId;
    state.updatedAt = Number(saved.updatedAt) || 0;
    ensureMasterVersion();
  }

  function loadState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    hadLocalState = !!raw;
    var saved = safeParse(raw, {});
    applySnapshot(saved);
    if (!state.updatedAt && hadLocalState) state.updatedAt = Date.now();
    saveState({preserveTimestamp:true,skipCloud:true,skipBroadcast:true});
  }

  function saveState(options) {
    options = options || {};
    if (!options.preserveTimestamp) state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateSnapshot()));
    } catch (error) {
      toast('本机存储空间不足，请先导出重要版本');
    }
    if (!options.skipBroadcast && syncChannel) {
      try { syncChannel.postMessage(stateSnapshot()); } catch (error) {}
    }
    if (!options.skipCloud && cloudReady) {
      setSyncStatus('syncing','正在同步');
      scheduleCloudSave();
    }
  }

  function setSyncStatus(status, text) {
    var wrapper = document.getElementById('careerSyncStatus');
    var label = document.getElementById('careerSyncText');
    if (!wrapper || !label) return;
    wrapper.dataset.state = status;
    label.textContent = text;
    wrapper.title = text;
  }

  function sbHeaders(extra) {
    var headers = {
      apikey:SB_KEY,
      Authorization:'Bearer ' + SB_KEY,
      'Content-Type':'application/json'
    };
    Object.keys(extra || {}).forEach(function (key) { headers[key] = extra[key]; });
    return headers;
  }

  function cloudLoad() {
    return fetch(SB_URL + '/rest/v1/' + SB_TABLE + '?id=eq.' + SB_ROW + '&select=data,updated_at', {
      headers:sbHeaders()
    }).then(function (response) {
      if (!response.ok) throw new Error('cloud-load-' + response.status);
      return response.json();
    }).then(function (rows) {
      return rows && rows.length ? rows[0] : null;
    });
  }

  function cloudSave() {
    var iso = new Date(state.updatedAt || Date.now()).toISOString();
    return fetch(SB_URL + '/rest/v1/' + SB_TABLE, {
      method:'POST',
      headers:sbHeaders({Prefer:'resolution=merge-duplicates'}),
      body:JSON.stringify({id:SB_ROW,data:stateSnapshot(),updated_at:iso})
    }).then(function (response) {
      if (!response.ok) throw new Error('cloud-save-' + response.status);
      lastCloudSync = Date.parse(iso) || Date.now();
      hadLocalState = true;
      setSyncStatus('synced','云端已同步');
      return true;
    }).catch(function () {
      setSyncStatus(navigator.onLine ? 'error' : 'offline',navigator.onLine ? '云同步失败' : '离线使用中');
      return false;
    });
  }

  function scheduleCloudSave() {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(cloudSave,700);
  }

  function adoptRemote(row) {
    if (!row || !row.data) return false;
    var remoteTime = Number(row.data.updatedAt) || Date.parse(row.updated_at) || 0;
    if (remoteTime <= state.updatedAt) return false;
    applySnapshot(row.data);
    state.updatedAt = remoteTime;
    lastCloudSync = remoteTime;
    saveState({preserveTimestamp:true,skipCloud:true,skipBroadcast:false});
    renderAll();
    setSyncStatus('synced','已同步其他设备更新');
    return true;
  }

  function pollCloud() {
    cloudLoad().then(function (row) {
      if (!row) {
        if (!state.updatedAt) state.updatedAt = Date.now();
        saveState({preserveTimestamp:true,skipCloud:true,skipBroadcast:true});
        return cloudSave();
      }
      var remoteTime = Number(row.data && row.data.updatedAt) || Date.parse(row.updated_at) || 0;
      if (!hadLocalState || remoteTime > state.updatedAt) {
        hadLocalState = true;
        adoptRemote(row);
      }
      else if (state.updatedAt > remoteTime && state.updatedAt > lastCloudSync) cloudSave();
      else setSyncStatus('synced','云端已同步');
    }).catch(function () {
      setSyncStatus(navigator.onLine ? 'error' : 'offline',navigator.onLine ? '云端暂不可用' : '离线使用中');
    });
  }

  function initCrossDeviceSync() {
    cloudReady = true;
    setSyncStatus('connecting','正在连接云端');
    if ('BroadcastChannel' in window) {
      syncChannel = new BroadcastChannel('yara-career-center-v1');
      syncChannel.addEventListener('message',function (event) {
        var incoming = event.data || {};
        if ((Number(incoming.updatedAt) || 0) <= state.updatedAt) return;
        applySnapshot(incoming);
        saveState({preserveTimestamp:true,skipCloud:true,skipBroadcast:true});
        renderAll();
        setSyncStatus('synced','本机标签页已同步');
      });
    }
    window.addEventListener('storage',function (event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      var incoming = safeParse(event.newValue,{});
      if ((Number(incoming.updatedAt) || 0) <= state.updatedAt) return;
      applySnapshot(incoming);
      renderAll();
      setSyncStatus('synced','本机数据已同步');
    });
    window.addEventListener('online',function () {
      setSyncStatus('connecting','正在恢复同步');
      pollCloud();
    });
    window.addEventListener('offline',function () {
      setSyncStatus('offline','离线使用中');
    });
    pollCloud();
    setInterval(pollCloud,SB_POLL_MS);
  }

  function allJobs() {
    return JOBS.concat(state.customJobs);
  }

  function currentResume() {
    return state.versions.find(function (version) { return version.id === state.currentResumeId; }) || state.versions[0];
  }

  function currentJob(id) {
    return allJobs().find(function (job) { return job.id === (id || state.activeJobId); }) || allJobs()[0];
  }

  function statusValue(status) {
    return status === 'matched' ? 1 : status === 'partial' ? .55 : 0;
  }

  function upgradedStatus(requirement, resumeText) {
    var text = String(resumeText || '').toLowerCase();
    var hits = (requirement.keywords || []).filter(function (keyword) {
      return text.indexOf(String(keyword).toLowerCase()) >= 0;
    }).length;
    if (requirement.status === 'missing' && hits >= 2) return 'partial';
    if (requirement.status === 'partial' && hits >= Math.min(3, requirement.keywords.length)) return 'matched';
    return requirement.status;
  }

  function jobAnalysis(job) {
    var resume = currentResume();
    var text = (resume ? resume.text : '') + '\n' + state.evidence.map(function (item) {
      return item.title + ' ' + item.detail + ' ' + (item.tags || []).join(' ');
    }).join('\n');
    var hard = (job.hard || []).map(function (item) {
      return Object.assign({}, item, {resolvedStatus:upgradedStatus(item,text)});
    });
    var soft = (job.soft || []).map(function (item) {
      return Object.assign({}, item, {resolvedStatus:upgradedStatus(item,text)});
    });
    var hardScore = hard.length ? hard.reduce(function (sum,item) {
      return sum + statusValue(item.resolvedStatus);
    },0) / hard.length : 0;
    var softScore = soft.length ? soft.reduce(function (sum,item) {
      return sum + statusValue(item.resolvedStatus);
    },0) / soft.length : 0;
    var evidenceBonus = Math.min(4, Math.floor(state.evidence.length / 4));
    var score = Math.min(98, Math.round(
      soft.length ? hardScore * 72 + softScore * 24 + evidenceBonus : hardScore * 96 + evidenceBonus
    ));
    return {
      score:score,
      hard:hard,
      soft:soft,
      strengths:hard.concat(soft).filter(function (item) { return item.resolvedStatus === 'matched'; }),
      gaps:hard.concat(soft).filter(function (item) { return item.resolvedStatus !== 'matched'; })
    };
  }

  function renderAll() {
    renderOverview();
    renderJobs();
    renderVersions();
    renderEvidence();
    renderTargetSwitch();
    renderGrowth();
  }

  function renderOverview() {
    var jobs = allJobs();
    var results = jobs.map(function (job) {
      return {job:job,analysis:jobAnalysis(job)};
    }).sort(function (a,b) { return b.analysis.score - a.analysis.score; });
    var best = results[0];
    document.getElementById('heroResumeVersion').textContent = currentResume() ? currentResume().name.split('·')[0].trim() : 'V1';
    document.getElementById('heroJobCount').textContent = jobs.length;
    document.getElementById('heroEvidenceCount').textContent = state.evidence.length;
    document.getElementById('bestScore').textContent = best ? best.analysis.score : '--';
    document.getElementById('bestJobTitle').textContent = best ? best.job.title : '暂无目标岗位';
    document.getElementById('bestJobReason').textContent = best ?
      '已有 ' + best.analysis.strengths.length + ' 项直接证据，优先补齐 ' + best.analysis.gaps.length + ' 项薄弱证明。' : '请先新增岗位。';
    document.querySelector('.score-orbit').style.background =
      'conic-gradient(var(--mint) 0 ' + (best ? best.analysis.score : 0) + '%,rgba(255,255,255,.07) ' + (best ? best.analysis.score : 0) + '%)';
    document.getElementById('bestJobButton').dataset.jobId = best ? best.job.id : '';

    document.getElementById('overviewJobs').innerHTML = results.map(function (result,index) {
      return '<article class="job-card" tabindex="0" role="button" data-open-job="'+escapeHtml(result.job.id)+'">'+
        '<div class="job-card-top"><span class="job-index">0'+(index+1)+' / TARGET</span><span class="job-score">'+result.analysis.score+'<small>%</small></span></div>'+
        '<h3>'+escapeHtml(result.job.title)+'</h3><p class="company">'+escapeHtml(result.job.company)+'</p>'+
        '<div class="match-track"><i style="width:'+result.analysis.score+'%"></i></div>'+
        '<div class="job-tags">'+result.job.tags.slice(0,4).map(function(tag){return '<span>'+escapeHtml(tag)+'</span>';}).join('')+'</div>'+
      '</article>';
    }).join('');

    var strengthPool = [];
    results.forEach(function (result) {
      result.analysis.strengths.forEach(function (item) {
        if (!strengthPool.some(function (existing) { return existing.title === item.title; })) strengthPool.push(item);
      });
    });
    document.getElementById('globalStrengths').innerHTML = strengthPool.slice(0,5).map(function (item,index) {
      return '<div class="strength-item"><span class="mark">'+(index+1)+'</span><div><strong>'+escapeHtml(item.title)+'</strong><p>'+escapeHtml(item.evidence)+'</p></div></div>';
    }).join('');

    var priorityPool = [];
    results.forEach(function (result) {
      result.analysis.gaps.forEach(function (item) {
        if (!priorityPool.some(function (existing) { return existing.title === item.title; })) priorityPool.push(item);
      });
    });
    document.getElementById('priorityActions').innerHTML = priorityPool.slice(0,5).map(function (item,index) {
      return '<div class="priority-item"><span class="mark">'+(index+1)+'</span><div><strong>'+escapeHtml(item.title)+'</strong><p>'+escapeHtml(item.action)+'</p></div></div>';
    }).join('');
  }

  function renderJobs() {
    var jobs = allJobs();
    document.getElementById('jobSelector').innerHTML = jobs.map(function (job) {
      var analysis = jobAnalysis(job);
      return '<button type="button" class="job-select-btn '+(job.id===state.activeJobId?'active':'')+'" data-select-job="'+escapeHtml(job.id)+'">'+
        '<strong>'+escapeHtml(job.title)+'</strong><span>'+analysis.score+'% · '+escapeHtml(job.company)+'</span></button>';
    }).join('');
    var job = currentJob();
    if (!job) return;
    var analysis = jobAnalysis(job);
    document.getElementById('jobHero').innerHTML =
      '<div><span class="section-no">TARGET ROLE</span><h2>'+escapeHtml(job.title)+'</h2><p>'+escapeHtml(job.summary)+'</p>'+
      '<div class="job-summary-tags">'+job.tags.map(function(tag){return '<span>'+escapeHtml(tag)+'</span>';}).join('')+'</div></div>'+
      '<div class="score-box"><strong>'+analysis.score+'%</strong><span>简历证据覆盖度</span></div>';
    renderRequirements('hardSkillList', analysis.hard);
    renderRequirements('softSkillList', analysis.soft);
    document.getElementById('jobGapPlan').innerHTML = analysis.gaps.slice(0,6).map(function (item,index) {
      return '<article class="gap-card"><span class="priority">P'+(index<2?'0':index<4?'1':'2')+' · '+escapeHtml(item.resolvedStatus==='missing'?'缺少直接证据':'证据需要加强')+'</span>'+
        '<h3>'+escapeHtml(item.title)+'</h3><p>'+escapeHtml(item.evidence)+'</p><span class="deliverable">交付物：'+escapeHtml(item.action)+'</span></article>';
    }).join('') || '<div class="center-empty">当前岗位要求均有直接证据。</div>';
    document.getElementById('jobRawText').textContent = job.raw || '';
  }

  function renderRequirements(id, list) {
    var labels = {matched:'直接匹配',partial:'可迁移',missing:'待补强'};
    var icons = {matched:'✓',partial:'↗',missing:'!'};
    document.getElementById(id).innerHTML = list.map(function (item) {
      return '<div class="requirement-row '+item.resolvedStatus+'"><span class="requirement-status">'+icons[item.resolvedStatus]+'</span>'+
        '<div><strong>'+escapeHtml(item.title)+'</strong><p>'+escapeHtml(item.evidence)+'</p></div>'+
        '<span class="requirement-label">'+labels[item.resolvedStatus]+'</span></div>';
    }).join('');
  }

  function renderVersions() {
    document.getElementById('resumeVersions').innerHTML = state.versions.map(function (version) {
      return '<button type="button" class="version-item '+(version.id===state.currentResumeId?'active':'')+'" data-version-id="'+escapeHtml(version.id)+'">'+
        '<strong>'+escapeHtml(version.name)+'</strong><span>'+escapeHtml(version.created)+' · '+escapeHtml(version.source || '手动录入')+'</span></button>';
    }).join('');
    var current = currentResume();
    if (current && document.activeElement !== document.getElementById('resumeTextInput')) {
      document.getElementById('resumeTextInput').value = current.text || '';
    }
  }

  function renderEvidence() {
    document.getElementById('evidenceVault').innerHTML = state.evidence.map(function (item) {
      return '<article class="evidence-card"><span class="type">'+escapeHtml(item.type)+'</span><strong>'+escapeHtml(item.title)+'</strong>'+
        '<p>'+escapeHtml(item.detail)+'</p><button type="button" aria-label="删除证据" data-delete-evidence="'+escapeHtml(item.id)+'">×</button></article>';
    }).join('');
  }

  function renderTargetSwitch() {
    document.getElementById('resumeTargetSwitch').innerHTML = allJobs().map(function (job) {
      return '<button type="button" class="'+(job.id===state.resumeTargetId?'active':'')+'" data-resume-target="'+escapeHtml(job.id)+'">'+escapeHtml(job.title)+'</button>';
    }).join('');
  }

  function renderGrowth() {
    var job = currentJob(state.resumeTargetId);
    if (!job) return;
    var analysis = jobAnalysis(job);
    document.getElementById('growthTarget').innerHTML = '当前目标：<strong>'+escapeHtml(job.title)+'</strong> · '+analysis.score+'%';
    var gaps = analysis.gaps.concat(analysis.strengths).slice(0,9);
    var phases = [
      {day:'30',title:'补齐岗位语言与作品样本',items:gaps.slice(0,3)},
      {day:'60',title:'把能力变成可验证项目',items:gaps.slice(3,6)},
      {day:'90',title:'定向投递与面试转化',items:gaps.slice(6,9)}
    ];
    document.getElementById('growthRoadmap').innerHTML = phases.map(function (phase,phaseIndex) {
      return '<article class="phase-card"><span class="phase-day">'+phase.day+' DAYS</span><h3>'+escapeHtml(phase.title)+'</h3>'+
        phase.items.map(function(item,index){
          var output = phaseIndex===2 ? '形成STAR面试稿＋岗位定向简历' : item.action;
          return '<div class="phase-task"><strong>'+(index+1)+'. '+escapeHtml(item.title)+'</strong><p>'+escapeHtml(item.evidence)+'</p><span>完成标准：'+escapeHtml(output)+'</span></div>';
        }).join('')+'</article>';
    }).join('');
    document.getElementById('interviewStories').innerHTML = (job.stories || []).map(function (story,index) {
      var prompts = ['背景与目标是什么？你做了哪三个关键动作？结果如何量化？','最大的约束或冲突是什么？你如何做判断？','如果重做一次，你会怎样优化流程或指标？'];
      return '<article class="story-card"><strong>故事 '+(index+1)+' · '+escapeHtml(story)+'</strong><p>'+escapeHtml(prompts[index%prompts.length])+'</p></article>';
    }).join('');
  }

  function switchView(view) {
    state.activeView = view;
    document.querySelectorAll('.view').forEach(function (section) {
      section.classList.toggle('active', section.id === 'view-' + view);
    });
    document.querySelectorAll('.section-nav [data-nav]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.nav === view);
    });
    window.scrollTo({top:0,behavior:'smooth'});
    if (window.YaraBridge) YaraBridge.route(document.querySelector('[data-nav="'+view+'"]').textContent.trim(),3);
  }

  function openJob(jobId) {
    state.activeJobId = jobId;
    state.resumeTargetId = jobId;
    saveState();
    renderJobs();
    renderTargetSwitch();
    renderGrowth();
    switchView('jobs');
  }

  async function extractFile(file, onProgress) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    onProgress(8,'正在读取 '+file.name);
    if (['txt','md','json','csv'].indexOf(ext) >= 0) {
      var text = await file.text();
      onProgress(100,'文字读取完成');
      return text;
    }
    if (ext === 'pdf') {
      if (!window.pdfjsLib) throw new Error('PDF解析组件未加载，请检查网络后重试，或直接粘贴文字。');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      var pdf = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      var pages = [];
      for (var i=1;i<=pdf.numPages;i+=1) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        pages.push(content.items.map(function (item) { return item.str; }).join(' '));
        onProgress(Math.round(i/pdf.numPages*92),'正在解析 PDF · '+i+'/'+pdf.numPages+' 页');
      }
      onProgress(100,'PDF读取完成');
      return pages.join('\n');
    }
    if (ext === 'docx') {
      if (!window.mammoth) throw new Error('Word解析组件未加载，请检查网络后重试，或直接粘贴文字。');
      var result = await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
      onProgress(100,'Word读取完成');
      return result.value;
    }
    if (ext === 'doc') {
      throw new Error('旧版 .doc 暂不能稳定提取，请在 Word 中另存为 .docx，或直接粘贴文字。');
    }
    if (['jpg','jpeg','png','webp'].indexOf(ext) >= 0) {
      if (!window.Tesseract) throw new Error('图片识别组件未加载，请检查网络后重试。');
      var ocr = await Tesseract.recognize(file,'chi_sim+eng',{
        logger:function (message) {
          if (message.status === 'recognizing text') onProgress(Math.round(message.progress*88)+8,'正在识别图片文字 · '+Math.round(message.progress*100)+'%');
        }
      });
      onProgress(100,'图片文字识别完成');
      return ocr.data.text;
    }
    throw new Error('暂不支持该文件类型，请转换为 PDF、DOCX、TXT、Markdown 或图片。');
  }

  function setImportProgress(percent, message) {
    var wrapper = document.getElementById('importProgress');
    wrapper.hidden = false;
    document.getElementById('importProgressBar').style.width = percent + '%';
    document.getElementById('importProgressText').textContent = message;
    if (percent >= 100) setTimeout(function () { wrapper.hidden = true; },1200);
  }

  async function handleResumeFile(file) {
    if (!file) return;
    try {
      var text = await extractFile(file,setImportProgress);
      document.getElementById('resumeTextInput').value = text.trim();
      document.getElementById('resumeVersionName').value = file.name.replace(/\.[^.]+$/,'') + ' · 导入版';
      toast('简历已在本机解析，请确认文字后保存版本');
    } catch (error) {
      setImportProgress(0,'读取未完成');
      toast(error.message || '文件读取失败');
    }
  }

  function saveResumeVersion() {
    var text = document.getElementById('resumeTextInput').value.trim();
    if (!text) return toast('请先导入或粘贴简历内容');
    var name = document.getElementById('resumeVersionName').value.trim() || ('简历版本 · ' + dateLabel());
    var version = {id:uid('resume'),name:name,source:'本机导入 / 手动更新',created:dateLabel(),text:text};
    state.versions.unshift(version);
    state.currentResumeId = version.id;
    saveState();
    renderAll();
    document.getElementById('resumeVersionName').value = '';
    toast('新简历版本已保存，匹配结果已重算');
  }

  function addEvidence() {
    var title = window.prompt('写下一个可验证的工作成果或项目事实：');
    if (!title) return;
    var detail = window.prompt('补充规模、动作、结果或证据位置：') || '';
    state.evidence.unshift({id:uid('ev'),type:'新增事实',title:title.trim(),detail:detail.trim(),tags:[]});
    saveState();
    renderAll();
    toast('工作证据已加入匹配模型');
  }

  function deleteEvidence(id) {
    if (!window.confirm('确定删除这条工作证据吗？')) return;
    state.evidence = state.evidence.filter(function (item) { return item.id !== id; });
    saveState();
    renderAll();
    toast('工作证据已删除');
  }

  function parseCustomRequirements(raw, resumeText) {
    var lines = raw.split(/\n|。|；/).map(function (line) {
      return line.replace(/^[\s\d、.（）()【】]+/,'').trim();
    }).filter(function (line) { return line.length > 8; }).slice(0,10);
    var resumeTokens = new Set(String(resumeText || '').match(/[\u4e00-\u9fa5]{2,6}|[A-Za-z]{2,}/g) || []);
    return lines.map(function (line) {
      var tokens = line.match(/[\u4e00-\u9fa5]{2,6}|[A-Za-z]{2,}/g) || [];
      var hits = tokens.filter(function (token) { return resumeTokens.has(token); }).length;
      var status = hits >= 3 ? 'matched' : hits >= 1 ? 'partial' : 'missing';
      return req(line.slice(0,26),status,tokens.slice(0,8),
        status==='matched'?'当前简历存在相近关键词，请在面试前确认对应项目证据。':status==='partial'?'存在可迁移经历，但需要补充更直接的案例和结果。':'当前简历未发现直接证据。',
        '围绕“'+line.slice(0,20)+'”产出一个可展示案例或STAR故事。');
    });
  }

  async function handleNewJobFile(file) {
    if (!file) return;
    try {
      var text = await extractFile(file,function (percent,message) {
        toast(message + (percent < 100 ? '' : ''));
      });
      document.getElementById('newJobText').value = text.trim();
      toast('JD文字已读取，请确认后保存');
    } catch (error) {
      toast(error.message || 'JD读取失败');
    }
  }

  function saveNewJob() {
    var title = document.getElementById('newJobTitle').value.trim();
    var company = document.getElementById('newJobCompany').value.trim() || '公司待补充';
    var raw = document.getElementById('newJobText').value.trim();
    if (!title || !raw) return toast('请填写岗位名称和JD原文');
    var resume = currentResume();
    var requirements = parseCustomRequirements(raw,resume ? resume.text : '');
    var job = {
      id:uid('job'),title:title,company:company,subtitle:'自定义意向岗位',
      tags:['自定义JD','实时匹配'],summary:'根据你导入的JD原文建立的初步关键词匹配。后续可继续由我进行更深层的人工拆解。',
      hard:requirements,soft:[],raw:raw,stories:['最接近岗位要求的项目','一次复杂问题的结构化解决','跨部门协同与结果复盘']
    };
    state.customJobs.unshift(job);
    state.activeJobId = job.id;
    state.resumeTargetId = job.id;
    saveState();
    closeJdModal();
    renderAll();
    openJob(job.id);
    toast('新岗位已加入把把必中');
  }

  function resumeBulletsFor(jobId) {
    var common = [
      '累计向产研提报25项产品需求，15项落地；以问题背景、方案设计和ROI量化推动从一线痛点到系统方案的闭环。',
      '独立搭建交付运营一体化数据平台及6套效率工具，将分散在5个以上表格中的课表、对账、日报和能力数据整合为统一入口。',
      '统筹正价双线×三档及引流产品的全生命周期交付，覆盖规划、建课、账号核查、开课、陪跑、结营与复盘。',
      '建立完课率、退费率、环比、同比、业绩与试听数六项指标体系，结合异常归因支撑运营与教学决策。'
    ];
    var tailored = {
      'course-product':[
        '参与正价与引流课程产品矩阵运营，完成课程上线、权益与权限配置、资源排期和直播跟进；具备从产品形态到交付验证的完整视角。',
        '曾负责信息流素材拆解与A/B测试，从前三秒吸引点、叙事节奏和核心卖点优化点击及转化表现，熟悉“素材—点击—转化—ROI”链路。'
      ],
      'service-ops':[
        '负责多班级课表与教学调度，覆盖早自习、正课、周测、补课；突发调课30分钟内完成教师、学生、家长三方通知。',
        '建立学员档案及学习状态跟进机制，输出教师工作量、成绩对比和进步幅度报告，协同教研与交付保障教学质量。'
      ],
      'opc':[
        '设计6大模块19节点SOP体系，每个节点均明确目标、流程、风险点与改造方向，可直接迁移至训练营学习路径和运营节奏设计。',
        '运营AI外呼、AI口语测评、扩科支付三条工具线，持续研究AI在学习陪跑、评测反馈和运营效率中的应用。'
      ]
    };
    return (tailored[jobId] || []).concat(common).slice(0,6);
  }

  function generateResume() {
    var job = currentJob(state.resumeTargetId);
    if (!job) return toast('请先选择目标岗位');
    var analysis = jobAnalysis(job);
    var summaryMap = {
      'course-product':'2年以上教育行业课程交付与产品运营经验，兼具正价/引流产品矩阵、课程上线、数据分析与产品需求落地能力。能够把用户反馈、一线流程与经营指标转译为可执行的课程产品方案。',
      'service-ops':'2年以上教育行业教务与交付运营经验，熟悉多班级排课、教学数据、学情跟进与跨部门协同。擅长在复杂人员和课程约束下保障教学秩序，并用数据与SOP提升教务效率。',
      'opc':'2年以上在线教育课程与交付运营经验，覆盖产品规划、开营准备、学习陪跑、数据监控与结营复盘。独立搭建6套运营工具，具备课程结构化、训练营全周期和AI应用落地能力。'
    };
    var summary = summaryMap[job.id] || ('教育行业运营从业者，当前简历对“'+job.title+'”的证据覆盖度为'+analysis.score+'%，擅长结构化流程、数据运营与跨部门协同。');
    var bullets = resumeBulletsFor(job.id);
    var extraEvidence = state.evidence.filter(function (item) {
      return DEFAULT_EVIDENCE.every(function (seed) { return seed.id !== item.id; });
    }).slice(0,3);
    extraEvidence.forEach(function (item) {
      bullets.push(item.title + (item.detail ? '：' + item.detail : ''));
    });

    var markdown = '# 刘颖\n\n电话：15256247805｜本科｜目标岗位：'+job.title+'\n\n## 个人概述\n\n'+summary+
      '\n\n## 工作经历\n\n### 雅识教育科技有限公司｜交付运营 · 成人英语教育｜2025.03—至今\n\n'+
      bullets.map(function (item) { return '- '+item; }).join('\n')+
      '\n\n### 杭州顺佳教育科技有限公司｜教务管理 · 升学教育｜2023.09—2025.02\n\n'+
      '- 负责多类型课表编排与日常调度，确保多班级并行零冲突；突发调课30分钟内完成教师、学生、家长三方通知。\n'+
      '- 使用Excel在10分钟内完成班级排名、进步幅度和学科分布报告，支撑教学与教务决策。\n'+
      '- 对接销售、教研与交付，保障学员从报名、分班、上课到结课的全流程信息准确流转。\n\n'+
      '## 核心技能\n\nExcel数据分析｜课程产品与交付｜训练营运营｜SOP体系｜产品需求规划｜用户生命周期运营｜跨系统对账｜AI工具应用\n\n'+
      '## 教育经历\n\n安徽建筑大学城市建设学院｜财务管理 · 本科｜2018.09—2022.07\n\n'+
      '省级金融投资创新大赛三等奖｜财税技能大赛三等奖｜初级会计职称｜CET-4';

    state.generatedMarkdown = markdown;
    state.generatedHtml = markdownToResumeHtml(markdown);
    document.getElementById('resumePreview').innerHTML = state.generatedHtml;
    document.getElementById('generationStatus').textContent = '已生成 · '+job.title;
    toast('进阶版简历已生成，可继续核对并导出');
  }

  function markdownToResumeHtml(markdown) {
    var lines = markdown.split('\n');
    var html = '<article class="resume-sheet">';
    var inList = false;
    lines.forEach(function (line) {
      if (line.indexOf('# ') === 0) {
        html += '<h1 class="resume-name">'+escapeHtml(line.slice(2))+'</h1>';
      } else if (line.indexOf('## ') === 0) {
        if (inList) { html += '</ul>'; inList=false; }
        html += '<h3>'+escapeHtml(line.slice(3))+'</h3>';
      } else if (line.indexOf('### ') === 0) {
        if (inList) { html += '</ul>'; inList=false; }
        var parts = line.slice(4).split('｜');
        html += '<h4>'+escapeHtml(parts.slice(0,2).join('｜'))+'<span>'+escapeHtml(parts.slice(2).join('｜'))+'</span></h4>';
      } else if (line.indexOf('- ') === 0) {
        if (!inList) { html += '<ul>'; inList=true; }
        html += '<li>'+escapeHtml(line.slice(2))+'</li>';
      } else if (line.trim()) {
        if (inList) { html += '</ul>'; inList=false; }
        var cls = line.indexOf('电话：') === 0 ? 'contact' : line.indexOf('2年以上') === 0 || line.indexOf('教育行业') === 0 ? 'summary' : 'skills';
        html += '<p class="'+cls+'">'+escapeHtml(line)+'</p>';
      }
    });
    if (inList) html += '</ul>';
    return html + '</article>';
  }

  function exportWord() {
    if (!state.generatedHtml) return toast('请先生成进阶版简历');
    var styles = '<style>body{font-family:Microsoft YaHei,Arial;color:#202331;margin:42px}h1{font-size:28px;letter-spacing:4px;margin:0}.contact{color:#666;font-size:11px}.summary{padding:12px;border-left:3px solid #655ec9;background:#f3f2fb;line-height:1.7}h3{color:#35315d;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:22px}h4{margin:13px 0 4px}li,p{font-size:11px;line-height:1.65;margin:5px 0}</style>';
    var html = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="UTF-8">'+styles+'</head><body>'+state.generatedHtml+'</body></html>';
    downloadBlob(new Blob(['\ufeff',html],{type:'application/msword'}),'刘颖_'+currentJob(state.resumeTargetId).title+'_进阶简历_'+dateLabel()+'.doc');
    toast('Word 简历已导出');
  }

  function exportPdf() {
    if (!state.generatedHtml) return toast('请先生成进阶版简历');
    document.body.classList.add('print-resume');
    window.print();
    setTimeout(function () { document.body.classList.remove('print-resume'); },500);
  }

  function exportMarkdown() {
    if (!state.generatedMarkdown) return toast('请先生成进阶版简历');
    downloadBlob(new Blob([state.generatedMarkdown],{type:'text/markdown;charset=utf-8'}),'刘颖_'+currentJob(state.resumeTargetId).title+'_进阶简历_'+dateLabel()+'.md');
    toast('Markdown 简历已导出');
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); },1000);
  }

  function copyResume() {
    if (!state.generatedMarkdown) return toast('请先生成进阶版简历');
    navigator.clipboard.writeText(state.generatedMarkdown).then(function () {
      toast('进阶简历全文已复制');
    }).catch(function () {
      toast('复制失败，请在预览中手动复制');
    });
  }

  function openJdModal() {
    document.getElementById('jdModal').classList.add('open');
    document.getElementById('jdModal').setAttribute('aria-hidden','false');
    document.getElementById('newJobTitle').focus();
  }

  function closeJdModal() {
    document.getElementById('jdModal').classList.remove('open');
    document.getElementById('jdModal').setAttribute('aria-hidden','true');
  }

  var toastTimer;
  function toast(message) {
    var el = document.getElementById('careerToast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); },2600);
  }

  function bindEvents() {
    document.addEventListener('click',function (event) {
      var nav = event.target.closest('[data-nav]');
      if (nav) switchView(nav.dataset.nav);

      var open = event.target.closest('[data-open-job]');
      if (open) openJob(open.dataset.openJob);
      var select = event.target.closest('[data-select-job]');
      if (select) {
        state.activeJobId = select.dataset.selectJob;
        saveState();
        renderJobs();
      }
      var version = event.target.closest('[data-version-id]');
      if (version) {
        state.currentResumeId = version.dataset.versionId;
        saveState();
        renderAll();
        toast('已切换简历版本，匹配结果已重算');
      }
      var target = event.target.closest('[data-resume-target]');
      if (target) {
        state.resumeTargetId = target.dataset.resumeTarget;
        saveState();
        renderTargetSwitch();
        renderGrowth();
      }
      var remove = event.target.closest('[data-delete-evidence]');
      if (remove) deleteEvidence(remove.dataset.deleteEvidence);

      var action = event.target.closest('[data-action]');
      if (!action) return;
      var type = action.dataset.action;
      if (type === 'open-jd-modal') openJdModal();
      if (type === 'close-jd-modal') closeJdModal();
      if (type === 'save-new-jd') saveNewJob();
      if (type === 'save-resume-version') saveResumeVersion();
      if (type === 'new-manual-version') {
        document.getElementById('resumeTextInput').value = '';
        document.getElementById('resumeVersionName').value = '';
        document.getElementById('resumeTextInput').focus();
      }
      if (type === 'add-evidence') addEvidence();
      if (type === 'generate-resume') generateResume();
      if (type === 'copy-resume') copyResume();
      if (type === 'export-word') exportWord();
      if (type === 'export-pdf') exportPdf();
      if (type === 'export-md') exportMarkdown();
      if (type === 'go-growth') switchView('growth');
    });
    document.addEventListener('keydown',function (event) {
      var open = event.target.closest('[data-open-job]');
      if (open && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openJob(open.dataset.openJob);
      }
    });

    document.getElementById('bestJobButton').addEventListener('click',function () {
      if (this.dataset.jobId) openJob(this.dataset.jobId);
    });
    document.getElementById('resumeFile').addEventListener('change',function () {
      handleResumeFile(this.files && this.files[0]);
      this.value = '';
    });
    document.getElementById('newJobFile').addEventListener('change',function () {
      handleNewJobFile(this.files && this.files[0]);
      this.value = '';
    });
    var zone = document.getElementById('resumeDropZone');
    ['dragenter','dragover'].forEach(function (name) {
      zone.addEventListener(name,function (event) { event.preventDefault(); zone.classList.add('dragging'); });
    });
    ['dragleave','drop'].forEach(function (name) {
      zone.addEventListener(name,function (event) { event.preventDefault(); zone.classList.remove('dragging'); });
    });
    zone.addEventListener('drop',function (event) {
      handleResumeFile(event.dataTransfer.files && event.dataTransfer.files[0]);
    });
    document.getElementById('jdModal').addEventListener('click',function (event) {
      if (event.target === this) closeJdModal();
    });
    document.addEventListener('keydown',function (event) {
      if (event.key === 'Escape') closeJdModal();
    });
  }

  if (new URLSearchParams(location.search).get('entry') === 'mobile') {
    document.body.classList.add('mobile-entry');
  }
  loadState();
  bindEvents();
  renderAll();
  initCrossDeviceSync();
})();
