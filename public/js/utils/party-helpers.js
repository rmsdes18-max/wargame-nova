/* ── Party Helpers ─────────────────────────────────────────────────── */

/**
 * Standard party dot colors used across the app.
 * Index with: PARTY_DOT_COLORS[pi % PARTY_DOT_COLORS.length]
 */
var PARTY_DOT_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#4f46e5', '#ea580c', '#16a34a', '#9333ea'
];

/**
 * Shorter palette variant used in the smart-match panel.
 */
var PARTY_DOT_COLORS_SM3 = [
  '#5b8fff', '#3ecf6e', '#e84040', '#d4e157', '#8B5CF6', '#f97316', '#0891b2'
];

/**
 * roleColor - Returns the CSS variable for a combat role.
 *
 * @param {string} role - 'DPS' | 'TANK' | 'HEALER'
 * @returns {string} CSS var expression
 */
function roleColor(role) {
  return role === 'TANK' ? 'var(--tank)' : role === 'HEALER' ? 'var(--heal)' : 'var(--dps)';
}

/**
 * roleHex - Returns the hex color for a combat role.
 *
 * @param {string} role - 'DPS' | 'TANK' | 'HEALER'
 * @returns {string} Hex color
 */
function roleHex(role) {
  return role === 'TANK' ? '#8B5CF6' : role === 'HEALER' ? '#3ecf6e' : '#e84040';
}

/**
 * roleClass - Returns the CSS class suffix for a combat role.
 *
 * @param {string} role - 'DPS' | 'TANK' | 'HEALER'
 * @returns {string} Class name
 */
function roleClass(role) {
  return role === 'TANK' ? 'name-tank' : role === 'HEALER' ? 'name-heal' : 'name-dps';
}

/**
 * nextRole - Cycles to the next combat role: DPS → TANK → HEALER → DPS.
 *
 * @param {string} current - current role
 * @returns {string} next role
 */
function nextRole(current) {
  var roles = ['DPS', 'TANK', 'HEALER'];
  var idx = roles.indexOf(current || 'DPS');
  return roles[(idx + 1) % 3];
}

/**
 * isExtrasParty - Checks if a party is the _Extras bucket.
 *
 * @param {object} party - party object
 * @returns {boolean}
 */
function isExtrasParty(party) {
  return !!(party._isExtras || party.name === '_Extras');
}

/**
 * forEachPartyMember - Iterates over all non-extras party members.
 *
 * @param {object} war          - war object with .parties array
 * @param {function} callback   - fn(party, member, memberIndex, partyIndex)
 */
function forEachPartyMember(war, callback) {
  if (!war || !war.parties) return;
  war.parties.forEach(function(p, pi) {
    if (isExtrasParty(p)) return;
    p.members.forEach(function(m, mi) {
      callback(p, m, mi, pi);
    });
  });
}

/**
 * getExtrasParty - Returns the _Extras party from a war, or null.
 *
 * @param {object} war - war object
 * @returns {object|null}
 */
function getExtrasParty(war) {
  if (!war || !war.parties) return null;
  return war.parties.find(function(p) { return isExtrasParty(p); }) || null;
}
