/**
 * yara-config.js — 全局可调参数集中管理
 * 加载顺序：最先加载，无外部依赖
 */
var YARA_CONFIG = (function(){
  'use strict';

  var defaults = {
    iframeLoadTimeout: 15000,
    iframePoolMax: 8,
    backDebounce: 600,
    routeDebounce: 90,
    toastDuration: 1800,
    companionDelay: 260,
    lockReleaseDelay: 270,
    setupReleaseDelay: 320,
    rippleDuration: 620,
    sidebarFocusDelay: 30,
    scrollThreshold: 24,
    chatHistoryMax: 40,
    chatDisplayMax: 20,
    actionsDisplayMax: 7,
    risksDisplayMax: 6,
    commandResultsMax: 50,
    maxAuthAttempts: 5,
    lockoutBaseMs: 5000,
    confirmRateLimitMs: 3000,
    backRateLimitMs: 500,
    undoMaxLength: 50000,
    undoMinLength: 2,
    knownSourceTotal: 6,
    errorLogMaxEntries: 50,
    storageWarningPct: 70,
    storageCriticalPct: 90,
    dashboardRelatedKeys: [
      'yara_daily_todo_v1',
      'yara_life_todo_v1',
      'yara_ledger_v1',
      'yara_flash_notes_v1',
      'yara_ops_os_v1',
      'yara_master_schedule_v1'
    ]
  };

  var overrides = {};
  try {
    overrides = JSON.parse(localStorage.getItem('yara_config_overrides') || '{}');
    if(!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) overrides = {};
  } catch(error) {
    overrides = {};
  }

  var config = {};
  Object.keys(defaults).forEach(function(key){
    var value = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : defaults[key];
    config[key] = Array.isArray(value) ? value.slice() : value;
  });

  config.set = function(key, value){
    if(Object.prototype.hasOwnProperty.call(defaults, key)){
      config[key] = Array.isArray(value) ? value.slice() : value;
    }
  };

  config.reset = function(){
    Object.keys(defaults).forEach(function(key){
      config[key] = Array.isArray(defaults[key]) ? defaults[key].slice() : defaults[key];
    });
  };

  config.saveOverrides = function(){
    var diff = {};
    Object.keys(defaults).forEach(function(key){
      if(JSON.stringify(config[key]) !== JSON.stringify(defaults[key])) diff[key] = config[key];
    });
    try{ localStorage.setItem('yara_config_overrides', JSON.stringify(diff)); }
    catch(error){}
  };

  Object.freeze(defaults);
  return config;
})();
