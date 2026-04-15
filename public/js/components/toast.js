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
    success: { bg: 'var(--color-success-bg)', border: 'var(--color-success)', color: 'var(--color-success)', icon: '\u2713' },
    error:   { bg: 'var(--color-error-bg)',   border: 'var(--color-error)',   color: 'var(--color-error)',   icon: '\u2717' },
    warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)', color: 'var(--color-warning)', icon: '\u26A0' },
    info:    { bg: 'var(--color-info-bg)',     border: 'var(--color-info)',    color: 'var(--color-info)',    icon: '\u2139' }
  };

  function _getContainer() {
    var el = document.getElementById(_containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = _containerId;
      el.style.cssText = 'position:fixed;top:var(--spacing-lg);right:var(--spacing-lg);z-index:var(--z-toast);display:flex;flex-direction:column;gap:var(--spacing-sm);pointer-events:none;max-width:380px;';
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
    toast.style.cssText = 'pointer-events:auto;display:flex;align-items:center;gap:var(--spacing-sm);'
      + 'padding:var(--spacing-md) var(--spacing-lg);border-radius:var(--radius-lg);'
      + 'background:' + type.bg + ';border:1px solid ' + type.border + ';'
      + 'font-family:var(--font-body);font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);'
      + 'color:' + type.color + ';'
      + 'box-shadow:var(--shadow-md);'
      + 'transform:translateX(120%);transition:transform .3s ease,opacity .3s ease;opacity:0;';

    // Icon
    var icon = document.createElement('span');
    icon.style.cssText = 'font-size:var(--font-size-xl);flex-shrink:0;';
    icon.textContent = type.icon;

    // Message
    var msg = document.createElement('span');
    msg.style.cssText = 'flex:1;';
    msg.textContent = message;

    // Close button
    var close = document.createElement('span');
    close.style.cssText = 'cursor:pointer;opacity:var(--opacity-secondary);font-size:var(--font-size-xl);line-height:1;';
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
