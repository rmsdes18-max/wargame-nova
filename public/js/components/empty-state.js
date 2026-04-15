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
 * @param {string}  [options.padding='60px 20px'] - container padding
 * @returns {string} HTML string
 */
function EmptyState(options) {
  var opts = options || {};
  var padding = opts.padding || '60px 20px';

  var html = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:' + padding + ';text-align:center;">';

  if (opts.icon) {
    html += '<div style="font-size:48px;opacity:.15;margin-bottom:16px;">' + opts.icon + '</div>';
  }

  if (opts.title) {
    html += '<div style="font-size:18px;font-weight:600;color:#fff;margin-bottom:8px;">' + opts.title + '</div>';
  }

  if (opts.description) {
    html += '<div style="font-size:13px;color:var(--text-muted);max-width:340px;margin-bottom:24px;">' + opts.description + '</div>';
  }

  if (opts.buttonHtml) {
    html += opts.buttonHtml;
  } else if (opts.buttonText && opts.buttonAction) {
    html += '<button onclick="' + opts.buttonAction + '" class="btn btn-primary" style="padding:12px 28px;font-size:14px;">' + opts.buttonText + '</button>';
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
  return '<div style="color:var(--text-muted);font-size:13px;padding:20px;text-align:center;">' + (text || 'No data') + '</div>';
};
