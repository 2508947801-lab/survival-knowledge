/**
 * yara-timers.js — 统一的定时器注册与注销
 * 依赖：无
 */
var YaraTimers = (function(){
  'use strict';

  var registry = {};

  function set(name, callback, intervalMs, type){
    clear(name);
    var isInterval = type === 'interval';
    var id = isInterval ? setInterval(callback, intervalMs) : setTimeout(callback, intervalMs);
    registry[name] = {
      id: id,
      type: isInterval ? 'interval' : 'timeout',
      interval: intervalMs,
      started: Date.now(),
      callback: callback
    };
    return name;
  }

  function clear(name){
    var entry = registry[name];
    if(!entry) return;
    if(entry.type === 'interval') clearInterval(entry.id);
    else clearTimeout(entry.id);
    delete registry[name];
  }

  function clearAll(){
    Object.keys(registry).forEach(function(name){ clear(name); });
  }

  function has(name){ return !!registry[name]; }

  function list(){
    var now = Date.now();
    return Object.keys(registry).map(function(name){
      var entry = registry[name];
      return {
        name: name,
        type: entry.type,
        interval: entry.interval,
        uptimeMs: now - entry.started
      };
    });
  }

  if(typeof window !== 'undefined'){
    window.addEventListener('beforeunload', clearAll);
    if(typeof document !== 'undefined'){
      document.addEventListener('visibilitychange', function(){
        if(document.visibilityState === 'hidden'){
          Object.keys(registry).forEach(function(name){
            var entry = registry[name];
            if(entry.type === 'interval'){
              clearInterval(entry.id);
              entry._paused = true;
            }
          });
        }else{
          Object.keys(registry).forEach(function(name){
            var entry = registry[name];
            if(entry._paused){
              entry.id = setInterval(entry.callback, entry.interval);
              entry._paused = false;
            }
          });
        }
      });
    }
  }

  return { set:set, clear:clear, clearAll:clearAll, has:has, list:list };
})();
