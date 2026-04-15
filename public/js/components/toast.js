/* ── Toast ─────────────────────────────────────────────────────────── */

/**
 * Lightweight toast notification system.
 *
 * Usage:
 *   Toast.show('Saved!');
 *   Toast.show('Error', { type: 'error' });
 *   Toast.show('Deleted', { type: 'warning', duration: 5000 });
 *
 * Replaces raw alert() calls with non-blocking notifications.
 */
var Toast = (function() {

  var _containerId = '__nova-toast-container';
  var _counter = 0;

  var TYPES = {
    success: { bg: 'rgba(62,207,110,.15)', border: '#3ecf6e', color: '#3ecf6e', icon: '\u2713' },
    error:   { bg: 'rgba(232,64,64,.15)',   border: '#e84040', color: '#e84040', icon: '\u2717' },
    warning: { bg: 'rgba(240,192,64,.15)',   border: '#f0c040', color: '#f0c040', icon: '\u26A0' },
    info:    { bg: 'rgba(91,143,255,.15)',    border: '#5b8fff', color: '#5b8fff', icon: '\u2139' }
  };

  function _getContainer() {
    var el = document.getElementById(_containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = _containerId;
      el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:380px;';
      document.body.appendChild(el);
    }
    return el;
  }

  function _show(message, options) {
    var opts = options || {};
    var type = TYPES[opts.type] || TYPES.info;
    var duration = opts.duration || 3500;
    var id = 'toast-' + (++_counter);

    var toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = 'pointer-events:auto;display:flex;align-items:center;gap:10px;'
      + 'padding:12px 16px;border-radius:8px;'
      + 'background:' + type.bg + ';border:1px solid ' + type.border + ';'
      + 'font-family:"Plus Jakarta Sans",sans-serif;font-size:13px;font-weight:600;'
      + 'color:' + type.color + ';'
      + 'box-shadow:0 4px 16px rgba(0,0,0,.3);'
      + 'transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;opacity:0;';

    // Icon
    var icon = document.createElement('span');
    icon.style.cssText = 'font-size:16px;flex-shrink:0;';
    icon.textContent = type.icon;

    // Message
    var msg = document.createElement('span');
    msg.style.cssText = 'flex:1;';
    msg.textContent = message;

    // Close button
    var close = document.createElement('span');
    close.style.cssText = 'cursor:pointer;opacity:.6;font-size:16px;line-height:1;';
    close.textContent = '\u00D7';
    close.onclick = function() { _dismiss(id); };

    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(close);

    var container = _getContainer();
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
      });
    });

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(function() { _dismiss(id); }, duration);
    }

    return id;
  }

  function _dismiss(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }

  return {
    show: _show,
    dismiss: _dismiss,
    success: function(msg, opts) { return _show(msg, Object.assign({}, opts, { type: 'success' })); },
    error:   function(msg, opts) { return _show(msg, Object.assign({}, opts, { type: 'error' })); },
    warning: function(msg, opts) { return _show(msg, Object.assign({}, opts, { type: 'warning' })); },
    info:    function(msg, opts) { return _show(msg, Object.assign({}, opts, { type: 'info' })); }
  };
})();
