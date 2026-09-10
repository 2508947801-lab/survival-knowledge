/**
 * yara-hub-incremental.js — 不重建模块卡片的徽标更新
 * 依赖：外壳中的 hubBadges() 与 YARA_MODULES。
 */
function updateHubBadges(){
  if(typeof hubBadges !== 'function' || typeof YARA_MODULES === 'undefined') return;
  var badges = hubBadges();
  var moduleBySrc = {};
  YARA_MODULES.forEach(function(mod){ moduleBySrc[mod.src] = mod; });

  document.querySelectorAll('.hub-tile').forEach(function(tile){
    var mod = moduleBySrc[tile.dataset.src];
    if(!mod || !mod.badge) return;
    var value = Object.prototype.hasOwnProperty.call(badges, mod.badge) ? badges[mod.badge] : 0;
    var existing = tile.querySelector('.hub-badge');
    if(value === -1){
      if(!existing){ existing = document.createElement('span'); tile.appendChild(existing); }
      existing.className = 'hub-badge is-error';
      existing.dataset.badge = mod.badge;
      existing.title = '数据读取失败';
      existing.textContent = '!';
      return;
    }
    if(value <= 0){
      if(existing) existing.remove();
      return;
    }
    if(!existing){ existing = document.createElement('span'); tile.appendChild(existing); }
    existing.className = 'hub-badge';
    existing.dataset.badge = mod.badge;
    existing.removeAttribute('title');
    existing.textContent = value > 99 ? '99+' : String(value);
  });
}
