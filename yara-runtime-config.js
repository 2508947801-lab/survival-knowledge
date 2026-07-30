(function () {
  'use strict';

  if (window.YaraRuntimeConfig) return;

  var KEY = 'yara_runtime_config_v1';

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; }
    catch (error) { return fallback; }
  }

  function load() {
    var local = {};
    try { local = safeParse(localStorage.getItem(KEY), {}); } catch (error) {}
    var injected = window.__YARA_RUNTIME_CONFIG__ || {};
    return {
      supabaseUrl: String(injected.supabaseUrl || local.supabaseUrl || '').replace(/\/+$/, ''),
      supabaseAnonKey: String(injected.supabaseAnonKey || local.supabaseAnonKey || ''),
      configuredAt: injected.configuredAt || local.configuredAt || ''
    };
  }

  function save(config) {
    var normalized = {
      supabaseUrl: String((config && config.supabaseUrl) || '').trim().replace(/\/+$/, ''),
      supabaseAnonKey: String((config && config.supabaseAnonKey) || '').trim(),
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
