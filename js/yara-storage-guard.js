/**
 * yara-storage-guard.js — localStorage 容量检测与安全写入
 * 依赖：YARA_CONFIG、ErrorMonitor（均可降级）
 */
var StorageGuard = (function(){
  'use strict';

  var WARN_PCT = (typeof YARA_CONFIG !== 'undefined') ? YARA_CONFIG.storageWarningPct : 70;
  var CRIT_PCT = (typeof YARA_CONFIG !== 'undefined') ? YARA_CONFIG.storageCriticalPct : 90;
  var SAFE_QUOTA = 5 * 1024 * 1024;

  function estimateUsage(){
    var total = 0;
    try{
      for(var i = 0; i < localStorage.length; i++){
        var key = localStorage.key(i);
        var value = localStorage.getItem(key);
        total += (key.length + (value ? value.length : 0)) * 2;
      }
    }catch(error){}
    return total;
  }

  function estimateQuota(){
    if(typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate){
      return navigator.storage.estimate().then(function(estimate){ return estimate.quota || SAFE_QUOTA; });
    }
    return Promise.resolve(SAFE_QUOTA);
  }

  function check(){
    var usage = estimateUsage();
    var pct = Math.round(usage / SAFE_QUOTA * 100);
    if(pct >= CRIT_PCT){
      return { level:'critical', pct:pct, usageKB:Math.round(usage/1024), message:'本地存储即将用尽（'+pct+'%），请尽快导出备份' };
    }
    if(pct >= WARN_PCT){
      return { level:'warning', pct:pct, usageKB:Math.round(usage/1024), message:'本地存储已使用 '+pct+'%，建议清理旧数据' };
    }
    return { level:'ok', pct:pct, usageKB:Math.round(usage/1024) };
  }

  function safeSet(key, value){
    try{
      localStorage.setItem(key, value);
      return true;
    }catch(error){
      if(error.name === 'QuotaExceededError' || (error.code && (error.code === 22 || error.code === 1014))){
        if(typeof ErrorMonitor !== 'undefined') ErrorMonitor.log(error, 'storage-quota-exceeded:' + key);
        return false;
      }
      throw error;
    }
  }

  function getBreakdown(){
    var items = [];
    try{
      for(var i = 0; i < localStorage.length; i++){
        var key = localStorage.key(i);
        var value = localStorage.getItem(key);
        items.push({ key:key, sizeKB:Math.round((key.length + (value ? value.length : 0)) * 2 / 1024 * 10) / 10 });
      }
    }catch(error){}
    items.sort(function(a,b){ return b.sizeKB - a.sizeKB; });
    return items;
  }

  return { estimateUsage:estimateUsage, estimateQuota:estimateQuota, check:check, safeSet:safeSet, getBreakdown:getBreakdown };
})();
