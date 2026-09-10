(function () {
  'use strict';

  var deferredInstallPrompt = null;
  var refreshing = false;
  var registrationRef = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function createInstallUI() {
    var actions = document.querySelector('.top-actions');
    if (!actions || document.getElementById('pwaInstallButton')) return;
    var button = document.createElement('button');
    button.id = 'pwaInstallButton';
    button.type = 'button';
    button.className = 'icon-btn pwa-install-button';
    button.hidden = true;
    button.setAttribute('aria-label', '安装 Lysie 到桌面');
    button.setAttribute('title', '安装到桌面');
    button.innerHTML = '<span aria-hidden="true">⇩</span><span class="pwa-install-label">安装</span>';
    var firstAction = actions.querySelector('.search-toggle');
    actions.insertBefore(button, firstAction || actions.firstChild);

    var backdrop = document.createElement('div');
    backdrop.id = 'pwaInstallDialog';
    backdrop.className = 'pwa-dialog-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = '<section class="pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="pwaDialogTitle">' +
      '<div class="pwa-dialog-head"><span class="pwa-dialog-icon" aria-hidden="true">🌱</span>' +
      '<div class="pwa-dialog-copy"><h2 id="pwaDialogTitle">把 Lysie 装到桌面</h2><p id="pwaDialogIntro">像 App 一样独立打开，Web 与手机仍共用同一套数据。</p></div>' +
      '<button class="pwa-dialog-close" type="button" aria-label="关闭">×</button></div>' +
      '<div class="pwa-install-steps" id="pwaInstallSteps"></div>' +
      '<div class="pwa-dialog-actions"><button type="button" data-pwa-cancel>稍后</button><button type="button" class="pwa-primary" data-pwa-confirm>安装到桌面</button></div>' +
      '</section>';
    document.body.appendChild(backdrop);

    function closeDialog() {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
      button.focus();
    }

    button.addEventListener('click', function () {
      var steps = backdrop.querySelector('#pwaInstallSteps');
      var confirm = backdrop.querySelector('[data-pwa-confirm]');
      if (deferredInstallPrompt) {
        steps.innerHTML = '<div class="pwa-install-step"><strong>1</strong><span>点击下方“安装到桌面”。</span></div>' +
          '<div class="pwa-install-step"><strong>2</strong><span>安装后从桌面图标启动，系统会以独立窗口打开。</span></div>';
        confirm.hidden = false;
      } else if (isIOS()) {
        steps.innerHTML = '<div class="pwa-install-step"><strong>1</strong><span>点击浏览器底部或顶部的“分享”按钮。</span></div>' +
          '<div class="pwa-install-step"><strong>2</strong><span>向下找到“添加到主屏幕”，再点击右上角“添加”。</span></div>';
        confirm.hidden = true;
      } else {
        steps.innerHTML = '<div class="pwa-install-step"><strong>1</strong><span>打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。</span></div>' +
          '<div class="pwa-install-step"><strong>2</strong><span>确认安装后，从系统桌面或应用列表启动。</span></div>';
        confirm.hidden = true;
      }
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
      backdrop.querySelector('.pwa-dialog-close').focus();
    });

    backdrop.querySelector('.pwa-dialog-close').addEventListener('click', closeDialog);
    backdrop.querySelector('[data-pwa-cancel]').addEventListener('click', closeDialog);
    backdrop.addEventListener('click', function (event) { if (event.target === backdrop) closeDialog(); });
    backdrop.querySelector('[data-pwa-confirm]').addEventListener('click', async function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      button.hidden = true;
      closeDialog();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && backdrop.classList.contains('open')) closeDialog();
    });

    if (!isStandalone() && isIOS()) {
      button.hidden = false;
      button.classList.add('is-ready');
    }
  }

  function showUpdate(registration) {
    if (document.getElementById('pwaUpdateToast')) return;
    var toast = document.createElement('div');
    toast.id = 'pwaUpdateToast';
    toast.className = 'pwa-update-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<span>Lysie 有新版本，更新不会修改你的数据。</span><button type="button">立即更新</button>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    toast.querySelector('button').addEventListener('click', function () {
      var waiting = registration.waiting;
      if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    try {
      var registration = await navigator.serviceWorker.register('./service-worker.js', {
        scope: './',
        updateViaCache: 'none'
      });
      registrationRef = registration;
      if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration);
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration);
        });
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') registration.update().catch(function () {});
      });
      window.setInterval(function () { registration.update().catch(function () {}); }, 60 * 60 * 1000);
    } catch (error) {
      console.warn('[Yara PWA] Service Worker 注册失败：', error);
    }
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    var button = document.getElementById('pwaInstallButton');
    if (button && !isStandalone()) {
      button.hidden = false;
      button.classList.add('is-ready');
    }
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    var button = document.getElementById('pwaInstallButton');
    if (button) button.hidden = true;
  });

  navigator.serviceWorker && navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('online', function () {
    if (registrationRef) registrationRef.update().catch(function () {});
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { createInstallUI(); registerServiceWorker(); });
  } else {
    createInstallUI();
    registerServiceWorker();
  }
})();
