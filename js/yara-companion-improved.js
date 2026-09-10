/**
 * yara-companion-improved.js — 规则透明的整理助手意图匹配
 * 依赖：YaraSystem.DataHub（运行时可降级）。
 */
function companionReplyImproved(text){
  text = String(text || '').trim();
  var hub = (window.YaraSystem && YaraSystem.DataHub) ? YaraSystem.DataHub.state : {};
  var workPending = hub.work && Array.isArray(hub.work.pendingToday) ? hub.work.pendingToday.length : 0;
  var overdue = hub.work && Array.isArray(hub.work.overdue) ? hub.work.overdue.length : 0;
  var flashes = {notes:[], deletedIds:[]};
  try{
    if(window.YaraSystem && YaraSystem.DataHub) flashes = YaraSystem.DataHub.getSource('flash', null) || flashes;
  }catch(error){}
  var deleted = {};
  (Array.isArray(flashes.deletedIds) ? flashes.deletedIds : []).forEach(function(id){ deleted[id] = true; });
  var flashPending = (Array.isArray(flashes.notes) ? flashes.notes : []).filter(function(item){
    return item && !deleted[item.id] && item.status !== 'archived';
  }).length;

  var topics = [
    {key:'sleep', re:/失眠|睡不着|熬夜|睡眠/},
    {key:'fatigue', re:/焦虑|压力|难受|疲倦|崩溃|心烦|很累/},
    {key:'energy', re:/没动力|摆烂|拖延|逃避|不想动|不想做/},
    {key:'priority', re:/优先级|先做|哪个重要|纠结|取舍/},
    {key:'arrange', re:/今天|安排|待办|任务|日程|计划/},
    {key:'flash', re:/闪念|想法|灵感|创意|点子|突发奇想/},
    {key:'review', re:/复盘|总结|回顾|反思/},
    {key:'finance', re:/记账|支出|预算|花销|消费|账单/},
    {key:'english', re:/英语|口语|发音|单词|背诵/}
  ];
  var topic = topics.filter(function(item){ return item.re.test(text); })[0];
  var key = topic ? topic.key : 'default';
  var replies = {
    arrange:'我帮你看了一下：今天有 '+workPending+' 项工作待办，闪念池里还有 '+flashPending+' 条想法'+(overdue?'，另有 '+overdue+' 项历史待办需要留意。':'。')+'\n先选一件最重要、30 分钟内能推进的事；做完再决定下一件。',
    fatigue:'先把今天的要求调低一点。喝口水、离开屏幕两分钟，再只做一个最小动作：打开文件、写下标题，或处理一条消息。',
    energy:'先不评价自己，把动作缩到足够小：打开目标文件、发出一条必要消息，或整理桌面上的一样东西。只要求开始，不要求一次做完。',
    flash:'先用三句话补全：它想解决谁的问题？理想变化是什么？30 分钟内能做的最小验证是什么？记录后再判断是否推进。',
    english:'做一次“今日一句”：朗读 3 遍、换成自己的场景，再写一个例句。能自然用出来比一次写得复杂更重要。',
    review:flashPending?'先整理近 7 天闪念，再只挑一条转成行动。复盘是识别反复主题和下一步，不是把所有想法一次做完。':'先回答三个问题：今天做对了什么？哪里最消耗？明天只推进哪一步？',
    priority:'按三项判断：是否影响结果、是否有明确截止时间、是否能由你直接推动。满足两项以上优先；纯想法先记录，不立刻挤占今天。',
    finance:'先记录事实，再做判断。把今天的收支记入记账本；如果压力较大，先只看本月占比最高的一类支出。',
    sleep:'今晚先把目标改成休息：降低光线和信息刺激，暂时不处理需要重大判断的事。如果睡眠问题持续影响生活，考虑寻求专业帮助。',
    default:'我在听。你现在更需要安排优先级、开始行动，还是先恢复一点能量？给我一个具体场景，我帮你拆成下一步。'
  };
  return replies[key] || replies.default;
}
