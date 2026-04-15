/* ── RoleBadge ────────────────────────────────────────────────────── */

/**
 * RoleBadge - Displays a player combat role (DPS / TANK / HEALER).
 *
 * Combines the dot indicator and the badge label into a single
 * reusable HTML fragment.  Uses .dot with inline background color
 * and .badge.badge-{role} classes from nova.css.
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

  var rc = r === 'TANK' ? 'tank' : r === 'HEALER' ? 'heal' : 'dps';
  var showDot  = opts.dot  !== false;
  var showPill = opts.pill !== false;
  var label    = opts.label || (r === 'HEALER' ? 'HEAL' : r);
  var small    = opts.size === 'small';
  var clickable = !!opts.clickable;

  var dotColors = {
    dps:  'var(--dps)',
    tank: 'var(--tank)',
    heal: 'var(--heal)'
  };
  var dotStyle = 'background:' + dotColors[rc] + ';';
  if (small) dotStyle += 'width:6px;height:6px;';
  var pillSize = small ? 'font-size:var(--font-size-2xs);padding:0 var(--spacing-xs);' : '';
  var clickCls = clickable ? ' role-pill-btn' : '';

  var html = '';

  if (showDot) {
    html += '<div class="dot" style="' + dotStyle + '"'
      + (clickable ? ' onclick' : '')
      + '></div>';
  }

  if (showPill) {
    html += '<span class="badge badge-' + rc + clickCls + '"'
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
