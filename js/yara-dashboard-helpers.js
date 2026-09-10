/**
 * yara-dashboard-helpers.js — 首页仪表盘的无状态辅助函数
 */
function normalizeDateString(timeStr){
  if(typeof timeStr !== 'string') return '';
  var match = timeStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(!match) return '';
  return match[1]+'-'+match[2].padStart(2,'0')+'-'+match[3].padStart(2,'0');
}

function extractTime(timeStr){
  if(typeof timeStr !== 'string') return '';
  var match = timeStr.match(/(\d{1,2}:\d{2})/);
  return match ? match[1] : '';
}

function stableTimeCompare(a, b){
  var aTime = String(a && a.time || '');
  var bTime = String(b && b.time || '');
  return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
}

function safeEsc(value){
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function statCardHTML(cssClass, num, label, subText, ariaLabel){
  return '<div class="stat-card '+safeEsc(cssClass)+'" role="status" aria-label="'+safeEsc(ariaLabel || label+' '+num)+'">'
    + '<div class="stat-num">'+safeEsc(num)+'</div>'
    + '<div class="stat-label">'+safeEsc(label)+'</div>'
    + '<div class="stat-sub">'+safeEsc(subText)+'</div>'
    + '</div>';
}
