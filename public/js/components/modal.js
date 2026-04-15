/* ── Modal ─────────────────────────────────────────────────────────── */

/**
 * Generates a modal dialog HTML string.
 *
 * Can be used either:
 *   a) As a static HTML fragment (e.g. for playground preview)
 *   b) Via showModal() / closeModal() for dynamic display
 *
 * Uses nova.css classes when available (.modal-overlay, .modal-card,
 * .modal-title) and falls back to inline styles otherwise.
 *
 * @param {object} config
 * @param {string}  config.title       - modal title text
 * @param {string}  [config.subtitle]  - small text below title
 * @param {string}  [config.body]      - HTML for the body area
 * @param {string}  [config.footer]    - HTML for the footer/actions area
 * @param {string}  [config.id]        - id for the overlay element
 * @param {'sm'|'md'|'lg'} [config.size='md'] - width preset
 * @param {boolean} [config.open=false]  - render with .open class (visible)
 * @param {string}  [config.onClose]     - JS expression for close button onclick
 * @param {string}  [config.extraClass]  - additional class on .modal-card
 * @returns {string} HTML string
 */
function Modal(config) {
  var cfg = config || {};
  var id = cfg.id || '';
  var size = cfg.size || 'md';
  var open = cfg.open ? ' open' : '';
  var onClose = cfg.onClose || (id ? "document.getElementById('" + id + "').classList.remove('open')" : 'closeModal()');

  var widths = { sm: '400px', md: '560px', lg: '720px' };
  var maxW = widths[size] || widths.md;

  var cardCls = 'modal-card' + (cfg.extraClass ? ' ' + cfg.extraClass : '');

  var html = '<div class="modal-overlay' + open + '"' + (id ? ' id="' + id + '"' : '') + '>';
  html += '<div class="' + cardCls + '" style="width:min(' + maxW + ',92vw);">';

  // Title bar
  html += '<div class="modal-title">';
  html += '<span>' + (cfg.title || '') + '</span>';
  html += '<span style="cursor:pointer;color:var(--text-muted);font-size:20px;line-height:1;" onclick="' + onClose + '">&times;</span>';
  html += '</div>';

  // Subtitle
  if (cfg.subtitle) {
    html += '<div class="modal-sub">' + cfg.subtitle + '</div>';
  }

  // Body
  if (cfg.body) {
    html += '<div class="modal-body">' + cfg.body + '</div>';
  }

  // Footer / actions
  if (cfg.footer) {
    html += '<div class="modal-actions">' + cfg.footer + '</div>';
  }

  html += '</div></div>';
  return html;
}

/* ── Imperative show / close ──────────────────────────────────────── */

var _modalContainerId = '__nova-modal-host';

/**
 * Injects a modal into the DOM and shows it.
 *
 * @param {object} config - Same as Modal(), plus:
 * @param {function} [config.onOpen]  - called after modal is in the DOM
 * @param {function} [config.onCloseCallback] - called when modal is closed
 */
function showModal(config) {
  closeModal(); // remove any existing modal first
  var cfg = Object.assign({}, config, { open: true, id: _modalContainerId });
  cfg.onClose = 'closeModal()';

  var host = document.createElement('div');
  host.id = _modalContainerId + '-wrap';
  host.innerHTML = Modal(cfg);
  document.body.appendChild(host);

  // Close on overlay click (but not card click)
  var overlay = document.getElementById(_modalContainerId);
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
  }

  // Close on Escape
  window._modalEscHandler = function(e) {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', window._modalEscHandler);

  // Store callback
  window._modalCloseCallback = config.onCloseCallback || null;

  if (config.onOpen) config.onOpen();
}

/**
 * Closes and removes the current modal from the DOM.
 */
function closeModal() {
  var wrap = document.getElementById(_modalContainerId + '-wrap');
  if (wrap) wrap.remove();

  if (window._modalEscHandler) {
    document.removeEventListener('keydown', window._modalEscHandler);
    window._modalEscHandler = null;
  }

  if (window._modalCloseCallback) {
    window._modalCloseCallback();
    window._modalCloseCallback = null;
  }
}

/* ── Inline-style modal (for existing csv-modal / member-profile pattern) ── */

/**
 * Generates an inline-style modal that doesn't depend on nova.css modal classes.
 * Matches the existing pattern used by csv-modal and member-profile-modal.
 *
 * @param {object} config
 * @param {string}  config.id          - required DOM id
 * @param {string}  config.title       - header title
 * @param {string}  [config.body]      - inner HTML (or use bodyId for dynamic content)
 * @param {string}  [config.bodyId]    - id for the body container div
 * @param {string}  [config.footer]    - footer HTML (buttons)
 * @param {'sm'|'md'|'lg'} [config.size='md']
 * @param {boolean} [config.scrollable=false] - allow overlay scroll
 * @returns {string} HTML string (initially hidden via display:none)
 */
Modal.inline = function(config) {
  var cfg = config || {};
  var widths = { sm: '400px', md: '520px', lg: '640px' };
  var maxW = widths[cfg.size || 'md'] || widths.md;
  var closeFn = "document.getElementById('" + cfg.id + "').style.display='none'";
  var scrollable = cfg.scrollable ? 'overflow-y:auto;' : '';

  var html = '<div id="' + cfg.id + '" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999;align-items:center;justify-content:center;' + scrollable + '">';
  html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:28px;width:min(' + maxW + ',92vw);max-height:' + (cfg.scrollable ? '85' : '80') + 'vh;overflow-y:auto;' + (cfg.scrollable ? 'margin:20px auto;' : '') + '">';

  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:' + (cfg.scrollable ? 'start' : 'center') + ';margin-bottom:16px;">';
  if (cfg.title) {
    html += '<div style="font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;color:#fff;">' + cfg.title + '</div>';
  }
  if (cfg.bodyId && !cfg.title) {
    html += '<div id="' + cfg.bodyId + '-header"></div>';
  }
  html += '<button onclick="' + closeFn + '" style="background:none;border:none;color:var(--text-muted);font-size:' + (cfg.scrollable ? '22' : '20') + 'px;cursor:pointer;line-height:1;">&times;</button>';
  html += '</div>';

  // Body
  if (cfg.body) {
    html += cfg.body;
  }
  if (cfg.bodyId) {
    html += '<div id="' + cfg.bodyId + '"></div>';
  }

  // Footer
  if (cfg.footer) {
    html += '<div style="display:flex;gap:8px;margin-top:16px;">' + cfg.footer + '</div>';
  }

  html += '</div></div>';
  return html;
};

/**
 * Opens an inline-style modal by id (sets display to flex).
 * @param {string} id
 */
Modal.open = function(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'flex';
};

/**
 * Closes an inline-style modal by id (sets display to none).
 * @param {string} id
 */
Modal.close = function(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
};
