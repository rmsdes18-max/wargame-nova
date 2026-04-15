/* ── EmptyState ────────────────────────────────────────────────────── */

/**
 * EmptyState - Renders a centered empty/placeholder block with icon,
 * title, description, and optional action button.
 *
 * @param {object} options
 * @param {string}  [options.icon]          - emoji or HTML for the icon
 * @param {string}  [options.title]         - heading text
 * @param {string}  [options.description]   - body text
 * @param {string}  [options.buttonText]    - action button label
 * @param {string}  [options.buttonAction]  - onclick JS expression
 * @param {string}  [options.buttonHtml]    - raw HTML instead of a simple button
 * @param {string}  [options.padding]       - container padding override
 * @returns {string} HTML string
 */
function EmptyState(options) {
  var opts = options || {};
  var padding = opts.padding || 'var(--spacing-5xl) var(--spacing-xl)';

  var html = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:' + padding + ';text-align:center;">';

  if (opts.icon) {
    html += '<div style="font-size:48px;opacity:var(--opacity-icon-dim);margin-bottom:var(--spacing-lg);">' + opts.icon + '</div>';
  }

  if (opts.title) {
    html += '<div style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-semibold);color:#fff;margin-bottom:var(--spacing-sm);">' + opts.title + '</div>';
  }

  if (opts.description) {
    html += '<div style="font-size:var(--font-size-md);color:var(--text-muted);max-width:340px;margin-bottom:var(--spacing-2xl);">' + opts.description + '</div>';
  }

  if (opts.buttonHtml) {
    html += opts.buttonHtml;
  } else if (opts.buttonText && opts.buttonAction) {
    html += '<button onclick="' + opts.buttonAction + '" class="btn btn-primary" style="padding:var(--spacing-md) var(--spacing-2xl);font-size:var(--font-size-lg);">' + opts.buttonText + '</button>';
  }

  html += '</div>';
  return html;
}

/**
 * EmptyState.inline - A simpler one-line empty message.
 *
 * @param {string} text - message text
 * @returns {string} HTML string
 */
EmptyState.inline = function(text) {
  return '<div style="color:var(--text-muted);font-size:var(--font-size-md);padding:var(--spacing-xl);text-align:center;">' + (text || 'No data') + '</div>';
};
