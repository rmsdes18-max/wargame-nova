/* ── RoleBadge ────────────────────────────────────────────────────── */

/**
 * RoleBadge - Displays a player combat role (DPS / TANK / HEALER).
 *
 * Combines the role-dot indicator and the role-pill label into a single
 * reusable HTML fragment.  Mirrors the CSS classes already defined in
 * nova.css (.role-dot, .dot-{ROLE}, .role-pill, .role-{ROLE}).
 *
 * @param {string} role          - 'DPS' | 'TANK' | 'HEALER'
 * @param {object} [options]
 * @param {boolean} [options.clickable=false]  - adds cursor:pointer + hover effect
 * @param {'small'|'normal'} [options.size='normal'] - 'small' shrinks dot + pill
 * @param {boolean} [options.dot=true]   - include the colored dot
 * @param {boolean} [options.pill=true]  - include the text pill
 * @param {string}  [options.label]      - override display text (e.g. 'HEAL')
 * @returns {string} HTML string
 */
function RoleBadge(role, options) {
  var opts = options || {};
  var r = (role || 'DPS').toUpperCase();
  if (r !== 'TANK' && r !== 'HEALER' && r !== 'DPS') r = 'DPS';

  var showDot  = opts.dot  !== false;
  var showPill = opts.pill !== false;
  var label    = opts.label || (r === 'HEALER' ? 'HEAL' : r);
  var small    = opts.size === 'small';
  var clickable = !!opts.clickable;

  var dotSize = small ? 'width:6px;height:6px;' : '';
  var pillSize = small ? 'font-size:var(--font-size-2xs);padding:0 var(--spacing-xs);' : '';
  var clickCls = clickable ? ' role-pill-btn' : '';

  var html = '';

  if (showDot) {
    html += '<div class="role-dot dot-' + r + '"'
      + (dotSize ? ' style="' + dotSize + '"' : '')
      + (clickable ? ' onclick' : '')
      + '></div>';
  }

  if (showPill) {
    html += '<span class="role-pill role-' + r + clickCls + '"'
      + (pillSize ? ' style="' + pillSize + '"' : '')
      + '>' + label + '</span>';
  }

  return html;
}

/**
 * Inline-style variant used inside the smart-match panels.
 * Returns a self-contained badge that doesn't depend on nova.css role classes.
 *
 * @param {string} role - 'DPS' | 'TANK' | 'HEALER'
 * @returns {string} HTML string
 */
RoleBadge.inline = function(role) {
  var r = (role || 'DPS').toUpperCase();
  var rc = r === 'TANK' ? 'tank' : r === 'HEALER' ? 'heal' : 'dps';
  var label = r === 'HEALER' ? 'HEAL' : r;

  var colors = {
    dps:  'background:var(--role-dps-bg);color:var(--dps);',
    tank: 'background:var(--role-tank-bg);color:var(--tank);',
    heal: 'background:var(--role-heal-bg);color:var(--heal);'
  };

  return '<span style="padding:var(--spacing-2xs) var(--spacing-sm);border-radius:var(--radius-sm);font-size:var(--font-size-xs);'
    + 'font-weight:var(--font-weight-bold);min-width:36px;text-align:center;display:inline-block;'
    + colors[rc] + '">' + label + '</span>';
};
