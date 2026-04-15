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
 * @param {object} options
 * @param {string}  options.title       - modal title text
 * @param {string}  [options.subtitle]  - small text below title
 * @param {string}  [options.body]      - HTML for the body area
 * @param {string}  [options.footer]    - HTML for the footer/actions area
 * @param {string}  [options.id]        - id for the overlay element
 * @param {'sm'|'md'|'lg'} [options.size='md'] - width preset
 * @param {boolean} [options.open=false]  - render with .open class (visible)
 * @param {string}  [options.onClose]     - JS expression for close button onclick
 * @param {string}  [options.extraClass]  - additional class on .modal-card
 * @returns {string} HTML string
 */
function Modal(options) {
  var opts = options || {};
  var id = opts.id || '';
  var size = opts.size || 'md';
  var open = opts.open ? ' open' : '';
  var onClose = opts.onClose || (id ? "document.getElementById('" + id + "').classList.remove('open')" : 'closeModal()');

  var widths = { sm: 'var(--modal-width-sm)', md: 'var(--modal-width-md)', lg: 'var(--modal-width-lg)' };
  var maxW = widths[size] || widths.md;

  var cardCls = 'modal-card' + (opts.extraClass ? ' ' + opts.extraClass : '');

  var html = '<div class="modal-overlay' + open + '"' + (id ? ' id="' + id + '"' : '') + '>';
  html += '<div class="' + cardCls + '" style="width:min(' + maxW + ',92vw);">';

  // Title bar
  html += '<div class="modal-title">';
  html += '<span>' + (opts.title || '') + '</span>';
  html += '<span style="cursor:pointer;color:var(--text-muted);font-size:var(--font-size-3xl);line-height:1;" onclick="' + onClose + '">&times;</span>';
  html += '</div>';

  // Subtitle
  if (opts.subtitle) {
    html += '<div class="modal-sub">' + opts.subtitle + '</div>';
  }

  // Body
  if (opts.body) {
    html += '<div class="modal-body">' + opts.body + '</div>';
  }

  // Footer / actions
  if (opts.footer) {
    html += '<div class="modal-actions">' + opts.footer + '</div>';
  }

  html += '</div></div>';
  return html;
}

/* ── Imperative show / close ──────────────────────────────────────── */

var _modalContainerId = '__nova-modal-host';

/**
 * Injects a modal into the DOM and shows it.
 *
 * @param {object} options - Same as Modal(), plus:
 * @param {function} [options.onOpen]  - called after modal is in the DOM
 * @param {function} [options.onCloseCallback] - called when modal is closed
 */
function showModal(options) {
  closeModal(); // remove any existing modal first
  var opts = Object.assign({}, options, { open: true, id: _modalContainerId });
  opts.onClose = 'closeModal()';

  var host = document.createElement('div');
  host.id = _modalContainerId + '-wrap';
  host.innerHTML = Modal(opts);
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
  window._modalCloseCallback = options.onCloseCallback || null;

  if (options.onOpen) options.onOpen();
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
 * @param {object} options
 * @param {string}  options.id          - required DOM id
 * @param {string}  options.title       - header title
 * @param {string}  [options.body]      - inner HTML (or use bodyId for dynamic content)
 * @param {string}  [options.bodyId]    - id for the body container div
 * @param {string}  [options.footer]    - footer HTML (buttons)
 * @param {'sm'|'md'|'lg'} [options.size='md']
 * @param {boolean} [options.scrollable=false] - allow overlay scroll
 * @returns {string} HTML string (initially hidden via display:none)
 */
Modal.inline = function(options) {
  var opts = options || {};
  var widths = { sm: 'var(--modal-width-sm)', md: '520px', lg: '640px' };
  var maxW = widths[opts.size || 'md'] || widths.md;
  var closeFn = "document.getElementById('" + opts.id + "').style.display='none'";
  var scrollable = opts.scrollable ? 'overflow-y:auto;' : '';

  var html = '<div id="' + opts.id + '" style="display:none;position:fixed;inset:0;background:var(--overlay-bg);z-index:var(--z-modal);align-items:center;justify-content:center;' + scrollable + '">';
  html += '<div style="background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:var(--radius-xl);padding:var(--spacing-2xl);width:min(' + maxW + ',92vw);max-height:' + (opts.scrollable ? '85' : '80') + 'vh;overflow-y:auto;' + (opts.scrollable ? 'margin:var(--spacing-xl) auto;' : '') + '">';

  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:' + (opts.scrollable ? 'start' : 'center') + ';margin-bottom:var(--spacing-lg);">';
  if (opts.title) {
    html += '<div style="font-family:var(--font-display);font-size:var(--font-size-2xl);font-weight:var(--font-weight-bold);color:var(--text);">' + opts.title + '</div>';
  }
  if (opts.bodyId && !opts.title) {
    html += '<div id="' + opts.bodyId + '-header"></div>';
  }
  html += '<button onclick="' + closeFn + '" style="background:none;border:none;color:var(--text-muted);font-size:var(--font-size-3xl);cursor:pointer;line-height:1;">&times;</button>';
  html += '</div>';

  // Body
  if (opts.body) {
    html += opts.body;
  }
  if (opts.bodyId) {
    html += '<div id="' + opts.bodyId + '"></div>';
  }

  // Footer
  if (opts.footer) {
    html += '<div style="display:flex;gap:var(--spacing-sm);margin-top:var(--spacing-lg);">' + opts.footer + '</div>';
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
