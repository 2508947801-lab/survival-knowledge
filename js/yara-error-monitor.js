/**
 * yara-error-monitor.js — 全局错误捕获与本地日志
 * 依赖：YARA_CONFIG（可选）
 */
var ErrorMonitor = (function(){
  'use strict';

  var LOG_KEY = 'yara_error_log_v1';
  var MAX_ENTRIES = (typeof YARA_CONFIG !== 'undefined') ? YARA_CONFIG.errorLogMaxEntries : 50;

  function getLog(){
    try{
      var parsed = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    }catch(error){ return []; }
  }

  function save(entries){
    try{ localStorage.setItem(LOG_KEY, JSON.stringify(entries)); }
    catch(error){}
  }

  function log(error, context){
    var entries = getLog();
    entries.push({
      at: new Date().toISOString(),
      message: (error && error.message) ? error.message : String(error),
      stack: (error && error.stack) ? error.stack.split('\n').slice(0, 5).join('\n') : '',
      context: context || '',
      url: (typeof location !== 'undefined') ? location.href : '',
      ua: (typeof navigator !== 'undefined') ? navigator.userAgent.slice(0, 100) : ''
    });
    if(entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    save(entries);
  }

  function clear(){
    try{ localStorage.removeItem(LOG_KEY); }
    catch(error){}
  }

  function getSummary(){
    var entries = getLog();
    if(!entries.length) return { count:0, text:'无错误记录', last:null };
    var last = entries[entries.length - 1];
    return {
      count: entries.length,
      text: entries.length + ' 条记录，最近一次：' + last.message.slice(0, 60) + '（' + last.at + '）',
      last: last
    };
  }

  function exportLog(){
    var entries = getLog();
    var blob = new Blob([JSON.stringify(entries, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'lysie-error-log-' + new Date().toISOString().slice(0,10) + '.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if(typeof window !== 'undefined'){
    window.addEventListener('error', function(event){
      var error = event.error || new Error(event.message || 'Unknown error');
      log(error, 'global:' + (event.filename || '').split('/').pop() + ':' + event.lineno);
    });
    window.addEventListener('unhandledrejection', function(event){
      var error = (event.reason instanceof Error) ? event.reason : new Error(String(event.reason));
      log(error, 'unhandled-promise');
    });
  }

  return { log:log, clear:clear, getLog:getLog, getSummary:getSummary, exportLog:exportLog };
})();
