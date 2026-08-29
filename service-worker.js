/* Yara PWA service worker. 20260829183843 is replaced by the release script. */
const YARA_BUILD = '20260829183843';
const CACHE_PREFIX = 'yara-pwa-';
const CACHE_NAME = CACHE_PREFIX + YARA_BUILD;
const OFFLINE_URL = './离线.html';
const CORE_ASSETS = [
  './管理系统.html',
  './手机端.html',
  './离线.html',
  './manifest.webmanifest',
  './yara-pwa.css',
  './yara-pwa.js',
  './yara-system-theme.css',
  './yara-system-core.js',
  './yara-system-bridge.js',
  './yara-runtime-config.js',
  './yara-growth-game.js',
  './yara-master-schedule.js',
  './yara-master-schedule-seed.js',
  './icons/yara-192.png',
  './icons/yara-512.png',
  './icons/yara-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.allSettled(CORE_ASSETS.map(function (asset) {
        return cache.add(new Request(asset, { cache: 'reload' }));
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME) {
          return caches.delete(key);
        }
        return Promise.resolve(false);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function shouldUseNetworkFirst(request) {
  if (request.mode === 'navigate') return true;
  return ['document', 'script', 'style', 'worker', 'manifest'].indexOf(request.destination) >= 0;
}

async function networkFirst(request) {
  var cache = await caches.open(CACHE_NAME);
  try {
    var response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    var cached = await cache.match(request, { ignoreSearch: false });
    if (!cached && request.mode === 'navigate') cached = await cache.match(request.url.split('?')[0]);
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match(OFFLINE_URL);
    throw error;
  }
}

async function cacheFirst(request) {
  var cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;
  var response = await fetch(request);
  if (response && response.ok) {
    var cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(shouldUseNetworkFirst(request) ? networkFirst(request) : cacheFirst(request));
});
