/* ── Number formatting ─────────────────────────────────────────────── */

/**
 * Format a large number for compact display.
 *   2100000 → "2.1M"   ·   15000 → "15K"   ·   800 → "800"
 *
 * @param {number} n
 * @returns {string}
 */
function fmtShort(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return n || 0;
}

/**
 * Format with locale separators.
 *   1234567 → "1,234,567"
 *
 * @param {number} n
 * @returns {string}
 */
function fmtFull(n) {
  return n ? n.toLocaleString() : '0';
}

/* ── Stat definitions ─────────────────────────────────────────────── */

var STAT_DEFS = {
  kills:     { key: 'defeat',    label: 'Kills',     shortLabel: 'K', color: 'var(--color-kills)' },
  assists:   { key: 'assist',    label: 'Assists',   shortLabel: 'A', color: 'var(--color-assists)' },
  dmg_dealt: { key: 'dmg_dealt', label: 'Dmg Dealt', shortLabel: 'D', color: 'var(--color-dmg-dealt)' },
  dmg_taken: { key: 'dmg_taken', label: 'Dmg Taken', shortLabel: 'TKN', color: 'var(--color-dmg-taken)' },
  healed:    { key: 'healed',    label: 'Healed',    shortLabel: 'H', color: 'var(--color-healed)' },
  heal_cd:   { key: 'heal_cd',   label: 'Heal CD',   shortLabel: 'HC', color: 'var(--color-healed)' }
};

/* ── StatsRow ─────────────────────────────────────────────────────── */

/**
 * StatsRow - Renders a row of stat-cards (kills, assists, damage, healing …).
 *
 * Uses the `.stats-row` / `.stat-card` CSS classes from nova.css.
 *
 * @param {object} stats   - Raw stat values keyed by canonical name:
 *                           { defeat, assist, dmg_dealt, dmg_taken, healed }
 * @param {object} [options]
 * @param {boolean}  [options.compact=false]   - use compact (short) number format
 * @param {boolean}  [options.showLabels=true]  - show the label above each value
 * @param {string[]} [options.fields]           - which stats to show, in order
 *                                                default: ['kills','assists','dmg_dealt','dmg_taken','healed']
 * @param {string}   [options.emptyText='—']    - placeholder when value is 0/undefined
 * @param {object}   [options.ids]              - optional id map, e.g. {kills:'sm3-total-kills'}
 * @returns {string} HTML string
 */
function StatsRow(stats, options) {
  var opts   = options || {};
  var fields = opts.fields || ['kills', 'assists', 'dmg_dealt', 'dmg_taken', 'healed', 'heal_cd'];
  var compact    = !!opts.compact;
  var showLabels = opts.showLabels !== false;
  var emptyText  = opts.emptyText !== undefined ? opts.emptyText : '—';
  var ids        = opts.ids || {};
  var fmt        = compact ? fmtShort : fmtFull;

  var html = '<div class="stats-row">';
  for (var i = 0; i < fields.length; i++) {
    var def = STAT_DEFS[fields[i]];
    if (!def) continue;
    var raw = stats[def.key] || 0;
    var display = raw ? fmt(raw) : emptyText;
    var idAttr = ids[fields[i]] ? ' id="' + ids[fields[i]] + '"' : '';
    html += '<div class="stat-card">';
    if (showLabels) html += '<div class="label">' + def.label + '</div>';
    html += '<div class="value" style="color:' + def.color + ';"' + idAttr + '>' + display + '</div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

/**
 * StatsRow.inline — Compact inline stats string: "K:12 A:30 D:540K H:0"
 *
 * Used inside party-member rows, attention items, etc.
 *
 * @param {object} stats          - { defeat, assist, dmg_dealt, healed, … }
 * @param {object} [options]
 * @param {string[]} [options.fields] - default: ['kills','assists','dmg_dealt','healed']
 * @param {boolean}  [options.colored=false] - wrap each value in a colored span
 * @returns {string} Plain text or HTML string
 */
StatsRow.inline = function(stats, options) {
  var opts   = options || {};
  var fields = opts.fields || ['kills', 'assists', 'dmg_dealt', 'healed'];
  var colored = !!opts.colored;

  var parts = [];
  for (var i = 0; i < fields.length; i++) {
    var def = STAT_DEFS[fields[i]];
    if (!def) continue;
    var val = fmtShort(stats[def.key] || 0);
    if (colored) {
      parts.push('<span style="color:' + def.color + ';">' + def.shortLabel + ':' + val + '</span>');
    } else {
      parts.push(def.shortLabel + ':' + val);
    }
  }
  return parts.join(' ');
};

/**
 * StatsRow.summary — The 4-card totals grid used in the smart-match panel.
 *
 * Self-contained inline styles (doesn't rely on .stats-row/.stat-card).
 *
 * @param {object} totals   - { defeat, assist, dmg_dealt, healed }
 * @param {object} [options]
 * @param {object} [options.ids] - e.g. { kills:'sm3-total-kills', … }
 * @returns {string} HTML string
 */
StatsRow.summary = function(totals, options) {
  var opts = options || {};
  var ids  = opts.ids || {};
  var items = [
    { key: 'defeat',    label: 'Total Kills',   color: 'var(--color-kills)',  id: ids.kills   || '' },
    { key: 'assist',    label: 'Total Assists',  color: 'var(--color-assists)', id: ids.assists  || '' },
    { key: 'dmg_dealt', label: 'Total Damage',   color: 'var(--color-dmg-dealt)', id: ids.damage   || '' },
    { key: 'healed',    label: 'Total Healed',   color: 'var(--color-healed)', id: ids.healed   || '' }
  ];

  var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--spacing-sm);margin-bottom:var(--spacing-lg);">';
  for (var i = 0; i < items.length; i++) {
    var it  = items[i];
    var val = fmtShort(totals[it.key] || 0);
    html += '<div style="background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:var(--spacing-md) var(--spacing-lg);text-align:center;">'
      + '<div style="font-size:var(--font-size-sm);color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:var(--spacing-xs);">' + it.label + '</div>'
      + '<div style="font-size:var(--font-size-3xl);font-weight:var(--font-weight-bold);color:' + it.color + ';font-family:var(--font-mono);"'
        + (it.id ? ' id="' + it.id + '"' : '') + '>' + val + '</div>'
      + '</div>';
  }
  html += '</div>';
  return html;
};
