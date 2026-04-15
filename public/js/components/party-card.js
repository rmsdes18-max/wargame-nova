/* ── PartyMemberRow ────────────────────────────────────────────────── */

/**
 * Renders a single member row inside a party card.
 *
 * @param {object} member          - { name, role, defeat, assist, dmg_dealt, dmg_taken, healed }
 * @param {object} [options]
 * @param {boolean}  [options.showStats=false]  - append inline stats after name
 * @param {object}   [options.stats]            - override stats object (e.g. from matched results)
 * @param {boolean}  [options.clickableRole=false] - role badge responds to clicks
 * @param {string}   [options.roleVariant='css'] - 'css' uses nova.css classes, 'inline' uses inline styles
 * @param {boolean}  [options.isNew=false]       - show NEW badge
 * @param {string}   [options.extraClass='']     - additional CSS class on the row div
 * @param {string}   [options.nameSuffix='']     - HTML appended after name (e.g. match dot)
 * @returns {string} HTML string
 */
function PartyMemberRow(member, options) {
  var opts = options || {};
  var role = member.role || 'DPS';
  var stats = opts.stats || member;
  var showStats = !!opts.showStats;
  var clickableRole = !!opts.clickableRole;
  var isNew = !!opts.isNew;
  var cls = 'party-member' + (opts.extraClass ? ' ' + opts.extraClass : '');

  var html = '<div class="' + cls + '">';

  // Role badge
  if (opts.roleVariant === 'inline') {
    if (clickableRole) {
      html += '<span class="sm3-party-role-badge" style="cursor:pointer;">'
        + RoleBadge.inline(role) + '</span>';
    } else {
      html += RoleBadge.inline(role);
    }
  } else {
    html += RoleBadge(role, { clickable: clickableRole });
  }

  // Name
  html += '<span class="member-name">' + (member.name || '') + '</span>';
  if (opts.nameSuffix) html += opts.nameSuffix;

  // Stats
  if (showStats && stats) {
    var hasStats = (stats.defeat || stats.assist || stats.dmg_dealt || stats.healed);
    if (hasStats) {
      html += '<span class="stats" style="font-family:var(--font-mono);font-size:var(--font-size-sm);color:var(--text-muted);">'
        + 'K:' + (stats.defeat || 0)
        + ' D:' + fmtShort(stats.dmg_dealt || 0)
        + ' H:' + fmtShort(stats.healed || 0)
        + '</span>';
    } else {
      html += '<span class="stats" style="color:var(--text-muted);">--</span>';
    }
  }

  // NEW badge
  if (isNew) {
    html += '<span style="font-size:var(--font-size-2xs);background:var(--gold);color:#000;padding:1px var(--spacing-xs);border-radius:var(--radius-xs);font-weight:var(--font-weight-bold);">NEW</span>';
  }

  html += '</div>';
  return html;
}

/* ── PartyCard ────────────────────────────────────────────────────── */

/**
 * Renders a full party card: header + list of members.
 *
 * Uses the `.party-card` / `.party-card-hdr` / `.party-member` classes
 * from nova.css for the "simple" variant, or builds a different layout
 * depending on options.variant.
 *
 * @param {object} party           - { name, label, members: [{name, role, ...}] }
 * @param {object} [options]
 * @param {'simple'|'confirm'|'sm3'} [options.variant='simple']
 *   - 'simple'   – basic card (party editor confirm view)
 *   - 'confirm'  – same as simple but read-only (confirmParties)
 *   - 'sm3'      – smart-match preview with inline stats + role cycling
 * @param {boolean}   [options.showStats=false]   - show inline stats per member
 * @param {number}    [options.partyIndex]         - used for DOM ids / callbacks
 * @param {string}    [options.dotColor]           - colored dot in header
 * @param {object}    [options.memberStatsLookup]  - { memberName: statsObj } for sm3
 * @param {object}    [options.newMembers]         - { memberName: true } for NEW badges
 * @param {string}    [options.membersContainerId] - custom id for the members container
 * @param {string}    [options.countId]            - id for the match count span
 * @returns {string} HTML string
 */
function PartyCard(party, options) {
  var opts = options || {};
  var variant = opts.variant || 'simple';
  var showStats = !!opts.showStats;
  var pi = opts.partyIndex;

  if (variant === 'sm3') {
    return _renderSm3PartyCard(party, opts);
  }

  // ── simple / confirm variant ──
  var html = '<div class="party-card">';

  // Header
  html += '<div class="party-card-hdr">';
  html += '<span>' + (party.name || '') + '</span>';
  if (party.label) html += '<span class="ptag">' + party.label + '</span>';
  html += '</div>';

  // Members
  var members = party.members || [];
  for (var i = 0; i < members.length; i++) {
    html += PartyMemberRow(members[i], {
      showStats: showStats,
      roleVariant: 'css'
    });
  }

  if (!members.length) {
    html += '<div style="font-size:var(--font-size-base);color:var(--text-muted);padding:var(--spacing-sm) var(--spacing-md);">No members</div>';
  }

  html += '</div>';
  return html;
}

/* ── SM3 (Smart-Match V3) party card ─────────────────────────────── */

function _renderSm3PartyCard(party, opts) {
  var pi = opts.partyIndex;
  var dotColor = opts.dotColor || '#7c3aed';
  var statsLookup = opts.memberStatsLookup || {};
  var newMembers = opts.newMembers || {};
  var membersId = opts.membersContainerId || (pi !== undefined ? 'sm3-party-members-' + pi : '');
  var countId = opts.countId || (pi !== undefined ? 'sm3-party-count-' + pi : '');

  var html = '<div class="sm3-party-card">'
    + '<div class="sm3-party-card-header">'
      + '<span class="sm3-party-card-title">'
        + '<span class="sm3-party-dot" style="background:' + dotColor + ';"></span> '
        + escHtml(party.name) + (party.label ? ' &#8212; ' + escHtml(party.label) : '')
      + '</span>'
      + '<span style="font-size:var(--font-size-base);color:var(--text-muted);"' + (countId ? ' id="' + countId + '"' : '') + '></span>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:var(--spacing-sm);"' + (membersId ? ' id="' + membersId + '"' : '') + '>';

  var members = party.members || [];
  var matchedCount = 0;

  for (var i = 0; i < members.length; i++) {
    var pm = members[i];
    var memberStats = statsLookup[pm.name] || null;
    if (memberStats) matchedCount++;
    var isNew = !!newMembers[pm.name];

    html += '<div class="sm3-party-member' + (isNew ? ' new-match' : '') + '">';

    // Clickable role badge (inline variant)
    if (pi !== undefined) {
      html += '<span class="sm3-party-role-badge" onclick="cyclePartyRoleV3(' + pi + ',' + i + ')" title="Click to cycle role" style="cursor:pointer;">'
        + RoleBadge.inline(pm.role || 'DPS')
        + '</span>';
    } else {
      html += RoleBadge.inline(pm.role || 'DPS');
    }

    html += '<span class="name">' + escHtml(pm.name) + '</span>';

    // Stats
    if (memberStats) {
      html += '<span class="stats">K:' + (memberStats.defeat || 0)
        + ' D:' + fmtShort(memberStats.dmg_dealt || 0)
        + ' H:' + fmtShort(memberStats.healed || 0) + '</span>';
    } else {
      html += '<span class="stats" style="color:var(--text-muted);">--</span>';
    }

    // NEW badge
    if (isNew) {
      html += '<span style="font-size:var(--font-size-2xs);background:var(--gold);color:#000;padding:1px var(--spacing-xs);border-radius:var(--radius-xs);font-weight:var(--font-weight-bold);">NEW</span>';
    }

    html += '</div>';
  }

  if (!members.length) {
    html += '<div style="font-size:var(--font-size-base);color:var(--text-muted);padding:var(--spacing-xs) 0;">No members</div>';
  }

  html += '</div></div>';

  return { html: html, matchedCount: matchedCount };
}

/**
 * Renders only the SM3 member rows (no card wrapper).
 * Used by updatePartyPreviewV3 to update existing container innerHTML.
 *
 * @param {object} party           - { members: [...], ... }
 * @param {object} [options]
 * @param {number}  [options.partyIndex]
 * @param {object}  [options.memberStatsLookup]
 * @param {object}  [options.newMembers]
 * @returns {{ html: string, matchedCount: number }}
 */
PartyCard.sm3Members = function(party, options) {
  var opts = options || {};
  var pi = opts.partyIndex;
  var statsLookup = opts.memberStatsLookup || {};
  var newMembers = opts.newMembers || {};
  var members = party.members || [];
  var matchedCount = 0;
  var html = '';

  for (var i = 0; i < members.length; i++) {
    var pm = members[i];
    var memberStats = statsLookup[pm.name] || null;
    if (memberStats) matchedCount++;
    var isNew = !!newMembers[pm.name];

    html += '<div class="sm3-party-member' + (isNew ? ' new-match' : '') + '">';

    if (pi !== undefined) {
      html += '<span class="sm3-party-role-badge" onclick="cyclePartyRoleV3(' + pi + ',' + i + ')" title="Click to cycle role" style="cursor:pointer;">'
        + RoleBadge.inline(pm.role || 'DPS')
        + '</span>';
    } else {
      html += RoleBadge.inline(pm.role || 'DPS');
    }

    html += '<span class="name">' + escHtml(pm.name) + '</span>';

    if (memberStats) {
      html += '<span class="stats">K:' + (memberStats.defeat || 0)
        + ' D:' + fmtShort(memberStats.dmg_dealt || 0)
        + ' H:' + fmtShort(memberStats.healed || 0) + '</span>';
    } else {
      html += '<span class="stats" style="color:var(--text-muted);">--</span>';
    }

    if (isNew) {
      html += '<span style="font-size:var(--font-size-2xs);background:var(--gold);color:#000;padding:1px var(--spacing-xs);border-radius:var(--radius-xs);font-weight:var(--font-weight-bold);">NEW</span>';
    }

    html += '</div>';
  }

  if (!members.length) {
    html = '<div style="font-size:var(--font-size-base);color:var(--text-muted);padding:var(--spacing-xs) 0;">No members</div>';
  }

  return { html: html, matchedCount: matchedCount };
};
