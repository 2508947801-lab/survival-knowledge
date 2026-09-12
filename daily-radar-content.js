(function () {
  'use strict';
  if (window.LYSIE_RADAR_CARDS) return;

  // 这里只收录已经在正式日报中核验过的常青知识，不把预设主题或未来内容冒充事实。
  // fact/source/verifiedOn 与对应日报保持一致；why/boundary/action 明确属于应用建议。
  window.LYSIE_RADAR_CARDS = [
    {
      id: '2026-09-01',
      focus: '教务与工作',
      title: '交付出故障时，先稳住影响再寻找原因',
      fact: 'Google SRE 将事件处置区分为恢复服务与协调响应，并建议预先明确指挥、沟通和执行角色。',
      why: '适合用来检查教务交付、课程异常和跨部门协作：先降低影响，再补根因分析。',
      boundary: '这是可靠性工程方法，不代表你的具体工作流程已经验证有效；应用前仍要结合权限和责任人。',
      action: '写下一个最近异常的“影响范围、临时负责人、下一次更新时间、替代方案”。',
      sourceLabel: 'Google SRE Workbook · Incident Response',
      sourceUrl: 'https://sre.google/workbook/incident-response/',
      verifiedOn: '2026-09-07',
      report: '生存知识日报_2026-09-01.html',
      readMinutes: 4
    },
    {
      id: '2026-09-02',
      focus: '数据分析学习',
      title: 'AI 上线前先建评测集，再谈模型更聪明',
      fact: 'OpenAI 的评测指南把 eval 定义为对模型输出进行测试和改进的流程；评测需要测试条件、数据源和判定方式。',
      why: '适合你的数据分析与 AI 工作流学习：先定义合格结果，避免只凭“感觉不错”判断工具。',
      boundary: '指南说明的是评测方法，不证明任何具体模型或提示词一定适合你的任务。',
      action: '挑 3 个脱敏任务，分别写出输入、合格标准和必须人工复核的条件。',
      sourceLabel: 'OpenAI · Working with evals',
      sourceUrl: 'https://developers.openai.com/api/docs/guides/evals',
      verifiedOn: '2026-09-07',
      report: '生存知识日报_2026-09-02.html',
      readMinutes: 4
    },
    {
      id: '2026-09-03',
      focus: '生活与财务',
      title: '现金流韧性：先确保能活过时间错配',
      fact: '工信部指南建议中小企业建立稳健现金流制度、突发事件储备、风险预警，并关注应收应付等关键点。',
      why: '适合连接记账本和副业判断：把“账面有钱”与“什么时候真正到账”分开看。',
      boundary: '这是通用管理建议，不构成个人投资、借贷或税务意见，也不替代你的真实账户数据。',
      action: '只列未来 4 周三项：确定到账、必须支出、最低保留金额。',
      sourceLabel: '工信部 · 工业中小企业管理提升指南（试行）',
      sourceUrl: 'https://wap.miit.gov.cn/jgsj/qyj/wjfb/art/2024/art_1f55b59197e64519bfbd592bfb1c747c.html',
      verifiedOn: '2026-09-07',
      report: '生存知识日报_2026-09-03.html',
      readMinutes: 5
    },
    {
      id: '2026-09-04',
      focus: '教务与工作',
      title: '困难沟通：把立场冲突还原为事实与请求',
      fact: 'AHRQ 的 SBAR 用 Situation、Background、Assessment、Recommendation/Request 组织关键信息，并强调复述确认。',
      why: '适合教务沟通、异常升级和跨部门协作：让对方知道发生了什么、你缺什么决定。',
      boundary: 'SBAR 来源于医疗沟通；这里只借鉴表达结构，不能把医疗研究直接当作企业成效证明。',
      action: '为一段困难沟通写四行：现状、背景、判断与不确定、希望对方何时做什么。',
      sourceLabel: 'AHRQ TeamSTEPPS · SBAR',
      sourceUrl: 'https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/sbar.html',
      verifiedOn: '2026-09-07',
      report: '生存知识日报_2026-09-04.html',
      readMinutes: 4
    },
    {
      id: '2026-09-05',
      focus: '个人成长',
      title: '可持续节奏：把疲劳当作系统风险信号',
      fact: 'NIOSH 说明工作疲劳会减慢反应、降低注意与短期记忆，并损害判断；来源可能包括非标准工时、压力和高认知负荷。',
      why: '适合用来安排工作、学习和副业的承诺上限，而不是把疲劳理解成意志力不足。',
      boundary: '这是职业健康信息，不替代医疗诊断；持续或严重不适需要寻求专业帮助。',
      action: '把今天最需要判断力的一件事移动到相对清醒的时间，并写下复核点。',
      sourceLabel: 'CDC/NIOSH · Fatigue and Work',
      sourceUrl: 'https://www.cdc.gov/niosh/fatigue/about/index.html',
      verifiedOn: '2026-09-07',
      report: '生存知识日报_2026-09-05.html',
      readMinutes: 4
    },
    {
      id: '2026-09-06',
      focus: '个人成长',
      title: '数据最小化：少收一项，就少背一项风险',
      fact: 'NIST Privacy Framework 是用于识别和管理隐私风险的自愿工具，并把数据生命周期与系统生命周期对齐作为管理方向。',
      why: '适合检查你的个人系统、猫咪上门和教务资料：不是所有“以后可能有用”的数据都值得保存。',
      boundary: '这是风险管理框架，不等同于具体法律意见；不同数据仍需结合实际用途和法规判断。',
      action: '任选一个表单，为其中一列写清用途、谁能看、保留多久；解释不清就先停止新增。',
      sourceLabel: 'NIST · Privacy Framework',
      sourceUrl: 'https://www.nist.gov/privacy-framework',
      verifiedOn: '2026-09-07',
      report: '生存知识日报_2026-09-06.html',
      readMinutes: 4
    },
    {
      id: '2026-09-07',
      focus: '职业发展',
      title: '周度组合复盘：让运营、钱、AI 与精力互相校验',
      fact: 'GOV.UK 指南建议用绩效数据发现用户旅程中的掉队阶段，并结合用户研究理解原因。',
      why: '适合把雅识工作记录、求职证据和能力地图连起来：任务数量不能替代真实完成结果。',
      boundary: '跨行业方法只能作为分析框架，不代表它已经在你的工作中产生了可写入简历的结果。',
      action: '选一项工作，只记录三个状态：完成、未完成、需要人工接管，并补一条证据。',
      sourceLabel: 'GOV.UK · Using performance data to improve your service',
      sourceUrl: 'https://www.gov.uk/service-manual/measuring-success/using-data-to-improve-your-service-an-introduction',
      verifiedOn: '2026-09-07',
      report: '生存知识日报_2026-09-07.html',
      readMinutes: 5
    }
  ];
})();
