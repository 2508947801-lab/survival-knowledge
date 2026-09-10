/**
 * yara-data-export.js — 本机业务数据的受控导出与恢复
 * 明确排除门禁、云配置、错误日志、缓存和迁移元数据。
 */
var DataManager = (function(){
  'use strict';

  var KIND = 'lysie-local-backup';
  var SCHEMA_VERSION = 1;
  var MAX_FILE_BYTES = 25 * 1024 * 1024;
  var DATA_KEYS = [
    'yara_daily_todo_v1','yara_life_todo_v1','yara_ledger_v1','yara_ops_os_v1',
    'yara_growth_center_v1','yara_growth_game_v1','yara_career_center_v1',
    'yara_master_schedule_v1','yara_companion_chat_v1','yara_flash_notes_v1',
    'yara_knowledge_assets_v1','yara_venture_center_v1','yara_cat_care_v1'
  ];
  var allowed = {};
  DATA_KEYS.forEach(function(key){ allowed[key] = true; });

  function download(blob, filename){
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 600);
  }

  function dateStr(){ return new Date().toISOString().slice(0,10); }

  function exportAll(){
    var entries = {};
    DATA_KEYS.forEach(function(key){
      var raw = localStorage.getItem(key);
      if(raw === null) return;
      try{ entries[key] = JSON.parse(raw); }
      catch(error){ entries[key] = raw; }
    });
    var pack = {
      kind: KIND,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      privacy: '包含本机个人业务数据，请加密保存，不要上传公开仓库或公开网盘。',
      entries: entries
    };
    download(new Blob([JSON.stringify(pack, null, 2)], {type:'application/json;charset=utf-8'}), 'lysie-local-backup-' + dateStr() + '.json');
    return Object.keys(entries).length;
  }

  function csvCell(value){
    var text = String(value == null ? '' : value);
    if(/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportLedgerCSV(){
    var ledger = null;
    try{ ledger = JSON.parse(localStorage.getItem('yara_ledger_v1') || 'null'); }
    catch(error){}
    var transactions = ledger && Array.isArray(ledger.transactions) ? ledger.transactions : [];
    if(!transactions.length) return 0;
    var rows = [['日期','类型','金额','分类','账户','备注']];
    transactions.forEach(function(row){
      rows.push([row.date,row.type,row.amount,row.category,row.account,row.note]);
    });
    var csv = rows.map(function(row){ return row.map(csvCell).join(','); }).join('\r\n');
    download(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'}), 'lysie-ledger-' + dateStr() + '.csv');
    return transactions.length;
  }

  function readFile(file){
    return new Promise(function(resolve, reject){
      if(!file) return reject(new Error('请选择备份文件'));
      if(file.size > MAX_FILE_BYTES) return reject(new Error('备份文件超过 25MB，已停止读取'));
      var reader = new FileReader();
      reader.onload = function(event){ resolve(String(event.target.result || '')); };
      reader.onerror = function(){ reject(new Error('文件读取失败')); };
      reader.readAsText(file);
    });
  }

  function inspectImport(file){
    return readFile(file).then(function(text){
      var pack;
      try{ pack = JSON.parse(text); }
      catch(error){ throw new Error('文件不是有效的 JSON 备份'); }
      if(!pack || pack.kind !== KIND || pack.schemaVersion !== SCHEMA_VERSION || !pack.entries || typeof pack.entries !== 'object'){
        throw new Error('不是当前版本的 Lysie 本机备份');
      }
      var entries = {};
      var skippedKeys = [];
      Object.keys(pack.entries).forEach(function(key){
        if(!allowed[key]){ skippedKeys.push(key); return; }
        if(pack.entries[key] === null || typeof pack.entries[key] !== 'object'){
          throw new Error('备份中的 '+key+' 数据结构无效，已停止恢复');
        }
        entries[key] = pack.entries[key];
      });
      if(!Object.keys(entries).length) throw new Error('备份中没有可恢复的业务数据');
      return {
        kind:KIND,
        schemaVersion:SCHEMA_VERSION,
        exportedAt:pack.exportedAt || '',
        entries:entries,
        skippedKeys:skippedKeys,
        count:Object.keys(entries).length
      };
    });
  }

  function applyImport(prepared, mode){
    mode = mode === 'replace' ? 'replace' : 'missing-only';
    if(!prepared || prepared.kind !== KIND || !prepared.entries) throw new Error('导入计划无效');
    var originals = {};
    var touched = [];
    var imported = 0;
    var skipped = 0;
    try{
      Object.keys(prepared.entries).forEach(function(key){
        if(!allowed[key]){ skipped++; return; }
        var existing = localStorage.getItem(key);
        if(mode === 'missing-only' && existing !== null){ skipped++; return; }
        originals[key] = existing;
        if(prepared.entries[key] === null || typeof prepared.entries[key] !== 'object'){
          throw new Error(key+' 数据结构无效，恢复已回滚');
        }
        var serialized = JSON.stringify(prepared.entries[key]);
        var ok = window.StorageGuard ? StorageGuard.safeSet(key, serialized) : (localStorage.setItem(key, serialized), true);
        if(!ok) throw new Error('本机存储空间不足，恢复已回滚');
        touched.push(key);
        imported++;
      });
    }catch(error){
      touched.forEach(function(key){
        if(originals[key] === null) localStorage.removeItem(key);
        else localStorage.setItem(key, originals[key]);
      });
      throw error;
    }
    window.dispatchEvent(new CustomEvent('yara:data-imported', {detail:{mode:mode,keys:touched.slice()}}));
    return {imported:imported, skipped:skipped, total:Object.keys(prepared.entries).length};
  }

  function importData(file, mode){
    return inspectImport(file).then(function(prepared){ return applyImport(prepared, mode); });
  }

  function getUsageReport(){
    if(window.StorageGuard) return StorageGuard.check();
    var bytes = 0;
    DATA_KEYS.forEach(function(key){
      var value = localStorage.getItem(key);
      if(value !== null) bytes += (key.length + value.length) * 2;
    });
    return {level:'ok', pct:0, usageKB:Math.round(bytes/1024)};
  }

  return {
    exportAll:exportAll,
    exportLedgerCSV:exportLedgerCSV,
    inspectImport:inspectImport,
    applyImport:applyImport,
    importData:importData,
    getUsageReport:getUsageReport,
    dataKeys:DATA_KEYS.slice()
  };
})();
