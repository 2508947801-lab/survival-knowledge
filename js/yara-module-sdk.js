/**
 * yara-module-sdk.js — 子模块共享能力的薄适配层
 * 复用既有 YaraBridge / YaraModuleUI，不注册第二套消息监听或路由协议。
 */
var YaraModule = (function(){
  'use strict';

  var moduleId = '';
  var allowedStorageKeys = {};

  function init(options){
    options = typeof options === 'string' ? {moduleId:options} : (options || {});
    moduleId = String(options.moduleId || document.body.dataset.yaraModule || 'unknown');
    allowedStorageKeys = {};
    (Array.isArray(options.storageKeys) ? options.storageKeys : []).forEach(function(key){
      if(typeof key === 'string' && key.indexOf('yara_') === 0) allowedStorageKeys[key] = true;
    });
    return api;
  }

  function reportRoute(payload){
    payload = payload || {};
    if(window.YaraBridge && typeof YaraBridge.route === 'function'){
      var meta = {};
      Object.keys(payload).forEach(function(key){
        if(key !== 'label' && key !== 'level') meta[key] = payload[key];
      });
      var label = String(payload.label || '').replace(/\s+/g,' ').trim().slice(0,48);
      YaraBridge.route(label, payload.level || 3, meta);
    }
  }

  function reportSnapshot(data){
    if(window.YaraBridge && typeof YaraBridge.emit === 'function'){
      YaraBridge.emit('snapshot', data || {});
    }
  }

  function toast(message, options){
    options = options || {};
    if(window.top === window && window.YaraModuleUI){
      YaraModuleUI.notify(message, options.type || options.status);
      return;
    }
    if(window.YaraBridge && typeof YaraBridge.operation === 'function'){
      YaraBridge.operation(options.kind || 'notice', options.status || 'success', String(message || ''), options);
    }
  }

  function confirm(options){
    if(window.YaraModuleUI && typeof YaraModuleUI.confirm === 'function'){
      options = options || {};
      return YaraModuleUI.confirm({
        title:options.title || '确认操作？',
        message:options.message || options.body || '',
        confirmText:options.confirmText || '确认'
      });
    }
    return Promise.resolve(false);
  }

  function backRequest(){
    if(window.YaraBridge && typeof YaraBridge.emit === 'function') YaraBridge.emit('back-request', {});
  }

  function assertStorageKey(key){
    if(!allowedStorageKeys[key]) throw new Error('未登记的数据键：' + key);
  }

  function readData(key, fallback){
    try{
      assertStorageKey(key);
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    }catch(error){
      if(error && /^未登记的数据键/.test(error.message || '')) throw error;
      return fallback;
    }
  }

  function writeData(key, value){
    assertStorageKey(key);
    var serialized = JSON.stringify(value);
    if(window.StorageGuard) return StorageGuard.safeSet(key, serialized);
    localStorage.setItem(key, serialized);
    return true;
  }

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function todayStr(){
    var date = new Date();
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }

  function debounce(fn, delay){
    var timer = 0;
    return function(){
      var args = arguments;
      var context = this;
      clearTimeout(timer);
      timer = setTimeout(function(){ fn.apply(context, args); }, delay);
    };
  }

  var api = {
    init:init,
    reportRoute:reportRoute,
    reportSnapshot:reportSnapshot,
    toast:toast,
    confirm:confirm,
    backRequest:backRequest,
    readData:readData,
    writeData:writeData,
    escape:escapeHtml,
    todayStr:todayStr,
    debounce:debounce
  };
  Object.defineProperties(api, {
    inShell:{get:function(){ try{return window.parent !== window;}catch(error){return false;} }},
    moduleId:{get:function(){return moduleId;}},
    theme:{get:function(){return document.documentElement.dataset.yaraTheme || 'dawn';}}
  });
  return api;
})();
