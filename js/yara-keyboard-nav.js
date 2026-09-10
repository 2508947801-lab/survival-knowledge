/**
 * yara-keyboard-nav.js — 首页网格与当前模块的键盘导航
 * 依赖：无（由外壳注入当前 iframe 获取器）
 */
var YaraKeyboardNav = (function(){
  'use strict';

  var root = null;
  var getActiveFrame = function(){ return null; };
  var bound = false;

  function editable(target){
    return !!(target && target.matches('input,textarea,select,[contenteditable="true"]'));
  }

  function center(rect, axis){
    return axis === 'x' ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
  }

  function directionalTarget(current, tiles, key){
    var from = current.getBoundingClientRect();
    var fromX = center(from, 'x');
    var fromY = center(from, 'y');
    var best = null;
    var bestScore = Infinity;
    tiles.forEach(function(tile){
      if(tile === current) return;
      var rect = tile.getBoundingClientRect();
      var dx = center(rect, 'x') - fromX;
      var dy = center(rect, 'y') - fromY;
      var primary = 0;
      var cross = 0;
      if(key === 'ArrowRight' && dx > 4){ primary = dx; cross = Math.abs(dy); }
      else if(key === 'ArrowLeft' && dx < -4){ primary = -dx; cross = Math.abs(dy); }
      else if(key === 'ArrowDown' && dy > 4){ primary = dy; cross = Math.abs(dx); }
      else if(key === 'ArrowUp' && dy < -4){ primary = -dy; cross = Math.abs(dx); }
      else return;
      var score = primary + cross * 3;
      if(score < bestScore){ best = tile; bestScore = score; }
    });
    return best;
  }

  function onRootKeydown(event){
    if(event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    var tile = event.target && event.target.closest ? event.target.closest('.hub-tile') : null;
    if(!tile || !root || !root.contains(tile)) return;
    var grid = tile.closest('.hub-grid');
    if(!grid) return;
    var tiles = Array.prototype.slice.call(grid.querySelectorAll('.hub-tile:not([disabled])'));
    var next = null;
    if(event.key === 'Home') next = tiles[0] || null;
    else if(event.key === 'End') next = tiles[tiles.length - 1] || null;
    else if(/^Arrow(Left|Right|Up|Down)$/.test(event.key)) next = directionalTarget(tile, tiles, event.key);
    if(!next) return;
    event.preventDefault();
    next.focus();
  }

  function onDocumentKeydown(event){
    if(event.defaultPrevented || !event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== 'm') return;
    if(editable(event.target)) return;
    var frame = getActiveFrame();
    if(!frame || !frame.contentWindow) return;
    event.preventDefault();
    try{
      var doc = frame.contentDocument;
      var first = doc && doc.querySelector('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if(first) first.focus();
      else frame.contentWindow.focus();
    }catch(error){
      try{ frame.contentWindow.focus(); }catch(ignore){}
    }
  }

  function init(options){
    options = options || {};
    var nextRoot = typeof options.root === 'string' ? document.querySelector(options.root) : options.root;
    if(!nextRoot) return false;
    if(root && root !== nextRoot) root.removeEventListener('keydown', onRootKeydown);
    root = nextRoot;
    getActiveFrame = typeof options.getActiveFrame === 'function' ? options.getActiveFrame : getActiveFrame;
    if(!root.__yaraKeyboardBound){
      root.__yaraKeyboardBound = true;
      root.addEventListener('keydown', onRootKeydown);
    }
    if(!bound){
      document.addEventListener('keydown', onDocumentKeydown);
      bound = true;
    }
    return true;
  }

  function getStatus(){
    return { bound:bound, hasRoot:!!root, tileCount:root ? root.querySelectorAll('.hub-tile').length : 0 };
  }

  return { init:init, getStatus:getStatus };
})();
