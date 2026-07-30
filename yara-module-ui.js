(function () {
  'use strict';
  if (window.YaraModuleUI) return;

  var toastTimer = 0;

  function ensureToast() {
    var toast = document.getElementById('yaraModuleToast');
    if (toast) return toast;
    toast = document.createElement('div');
    toast.id = 'yaraModuleToast';
    toast.className = 'yara-module-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
    return toast;
  }

  function notify(message, type) {
    // 嵌入总系统时由外层统一反馈，避免内外同时弹出两条提示。
    if (window.top !== window) return;
    var toast = ensureToast();
    clearTimeout(toastTimer);
    toast.textContent = String(message || '操作已完成');
    toast.dataset.type = type || 'success';
    toast.classList.add('show');
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2200);
  }

  function confirmAction(options) {
    options = options || {};
    return new Promise(function (resolve) {
      var backdrop = document.createElement('div');
      backdrop.className = 'yara-module-dialog-backdrop';
      backdrop.innerHTML =
        '<div class="yara-module-dialog" role="dialog" aria-modal="true" aria-labelledby="yaraDialogTitle">' +
          '<div class="yara-dialog-icon" aria-hidden="true">!</div>' +
          '<h2 id="yaraDialogTitle">' + escapeHtml(options.title || '确认删除？') + '</h2>' +
          '<p>' + escapeHtml(options.message || '删除后将同步到其他设备，请确认是否继续。') + '</p>' +
          '<div class="yara-dialog-actions">' +
            '<button type="button" class="yara-dialog-cancel">取消</button>' +
            '<button type="button" class="yara-dialog-confirm">' + escapeHtml(options.confirmText || '确认删除') + '</button>' +
          '</div>' +
        '</div>';

      function finish(value) {
        document.removeEventListener('keydown', onKeydown);
        backdrop.classList.remove('show');
        setTimeout(function () { backdrop.remove(); }, 160);
        resolve(value);
      }
      function onKeydown(event) {
        if (event.key === 'Escape') finish(false);
      }

      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop || event.target.closest('.yara-dialog-cancel')) finish(false);
        if (event.target.closest('.yara-dialog-confirm')) finish(true);
      });
      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(backdrop);
      requestAnimationFrame(function () {
        backdrop.classList.add('show');
        backdrop.querySelector('.yara-dialog-cancel').focus();
      });
    });
  }

  function requestDelete(control, options, callback) {
    if (control && control.dataset.yaraConfirmed === 'true') {
      callback();
      return;
    }
    confirmAction(options).then(function (confirmed) {
      if (confirmed) callback();
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.YaraModuleUI = {
    notify: notify,
    confirm: confirmAction,
    requestDelete: requestDelete
  };
})();
