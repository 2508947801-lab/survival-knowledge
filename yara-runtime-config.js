(function () {
  'use strict';

  if (window.YaraRuntimeConfig) return;

  var KEY = 'yara_runtime_config_v1';

  // 内置默认配置：源码仓库中保持为空（不写入密钥）；
  // 一键部署时由部署脚本从 private-config/supabase-client.env 注入实际值，
  // 让手机端等任意设备开箱即用云同步，无需手动配置。
  var BUILTIN_CONFIG = {
    supabaseUrl: 'https://yyqnugidfwgstlcgvnep.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cW51Z2lkZndnc3RsY2d2bmVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzEzNTAsImV4cCI6MjEwMDgwNzM1MH0.ufK55TfjlF4w98x6Fj28oFjUnYGz4lsY7MRaHVV2aIA',
    appSecret: ''
  };

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; }
    catch (error) { return fallback; }
  }

  function load() {
    var local = {};
    try { local = safeParse(localStorage.getItem(KEY), {}); } catch (error) {}
    var injected = window.__YARA_RUNTIME_CONFIG__ || {};
    return {
      supabaseUrl: String(injected.supabaseUrl || local.supabaseUrl || BUILTIN_CONFIG.supabaseUrl || '').replace(/\/+$/, ''),
      supabaseAnonKey: String(injected.supabaseAnonKey || local.supabaseAnonKey || BUILTIN_CONFIG.supabaseAnonKey || ''),
      appSecret: String(injected.appSecret || local.appSecret || BUILTIN_CONFIG.appSecret || ''),
      configuredAt: injected.configuredAt || local.configuredAt || (BUILTIN_CONFIG.supabaseUrl ? 'builtin' : '')
    };
  }

  function save(config) {
    var normalized = {
      supabaseUrl: String((config && config.supabaseUrl) || '').trim().replace(/\/+$/, ''),
      supabaseAnonKey: String((config && config.supabaseAnonKey) || '').trim(),
      appSecret: String((config && config.appSecret) || '').trim(),
      configuredAt: new Date().toISOString()
    };
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(normalized.supabaseUrl)) {
      throw new Error('Supabase URL 格式不正确');
    }
    if (normalized.supabaseAnonKey.length < 40) {
      throw new Error('Supabase anon key 格式不正确');
    }
    localStorage.setItem(KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('yara:runtime-config-updated', { detail: normalized }));
    return normalized;
  }

  function clear() {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent('yara:runtime-config-updated', { detail: {} }));
  }

  function supabase() {
    var config = load();
    return {
      url: config.supabaseUrl,
      anonKey: config.supabaseAnonKey,
      appSecret: config.appSecret,
      ready: !!(config.supabaseUrl && config.supabaseAnonKey)
    };
  }

  window.YaraRuntimeConfig = {
    key: KEY,
    load: load,
    save: save,
    clear: clear,
    supabase: supabase
  };
})();
