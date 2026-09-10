/**
 * yara-data-migration.js — 注册式、可追踪的数据迁移框架
 * 依赖：StorageGuard、ErrorMonitor（均可降级）
 */
var DataMigration = (function(){
  'use strict';

  var META_KEY = 'yara_data_meta_v1';
  var INDEX_KEY = 'yara_data_index_v1';
  var migrations = [];

  function readJSON(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(error){ return fallback; }
  }

  function safeSet(key, value){
    if(typeof StorageGuard !== 'undefined') return StorageGuard.safeSet(key, value);
    localStorage.setItem(key, value);
    return true;
  }

  function getVersion(){
    var meta = readJSON(META_KEY, {});
    return Number.isFinite(Number(meta.version)) ? Number(meta.version) : 0;
  }

  function setVersion(version){
    if(!safeSet(META_KEY, JSON.stringify({ version:version, migratedAt:new Date().toISOString() }))){
      throw new Error('无法写入数据迁移元数据');
    }
  }

  function register(fromVersion, toVersion, description, migrateFn){
    migrations.push({ from:fromVersion, to:toVersion, desc:description, fn:migrateFn });
    migrations.sort(function(a,b){ return a.from - b.from; });
  }

  function run(){
    var current = getVersion();
    var applied = [];
    var failed = null;
    for(var i = 0; i < migrations.length; i++){
      var migration = migrations[i];
      if(migration.from < current) continue;
      if(migration.from !== current) continue;
      try{
        migration.fn();
        setVersion(migration.to);
        current = migration.to;
        applied.push({ from:migration.from, to:migration.to, desc:migration.desc });
        console.info('[Lysie] Migration v'+migration.from+' → v'+migration.to+': '+migration.desc);
      }catch(error){
        failed = { from:migration.from, to:migration.to, error:error };
        console.error('[Lysie] Migration failed v'+migration.from+' → v'+migration.to, error);
        if(typeof ErrorMonitor !== 'undefined') ErrorMonitor.log(error, 'data-migration:v'+migration.from+'-v'+migration.to);
        break;
      }
    }
    return { current:current, applied:applied, failed:failed };
  }

  function getMigrationHistory(){
    return migrations.map(function(migration){
      return { from:migration.from, to:migration.to, desc:migration.desc };
    });
  }

  // v0 → v1 只初始化迁移框架。禁止猜测或重写既有业务数据结构。
  register(0, 1, '初始化迁移元数据（不改写业务数据）', function(){});

  // v1 → v2 只建立只读索引，便于容量审计；不修改任何被索引的数据。
  register(1, 2, '生成本地数据键索引', function(){
    var indexedAt = new Date().toISOString();
    var keys = [];
    for(var i = 0; i < localStorage.length; i++){
      var key = localStorage.key(i);
      if(key && key.indexOf('yara_') === 0 && key !== META_KEY && key !== INDEX_KEY){
        var value = localStorage.getItem(key);
        keys.push({ key:key, sizeBytes:(key.length + (value ? value.length : 0)) * 2, indexed:indexedAt });
      }
    }
    if(!safeSet(INDEX_KEY, JSON.stringify(keys))) throw new Error('无法写入数据索引');
  });

  return { register:register, run:run, getVersion:getVersion, getMigrationHistory:getMigrationHistory };
})();
