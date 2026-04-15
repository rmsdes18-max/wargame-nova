/* ── MemberDropdown ────────────────────────────────────────────────── */

/**
 * Renders a context-menu style dropdown for a party member.
 *
 * Uses the playground-defined classes (.pg-dropdown-*) or works
 * standalone with inline styles when those classes aren't available.
 *
 * @param {object} config
 * @param {string}  config.memberName       - display name on the toggle button
 * @param {string}  [config.currentRole='DPS'] - current role (for highlighting)
 * @param {Array}   [config.parties]        - [{name,index}] for "Move to" items
 * @param {boolean} [config.showRemove=true]  - show "Remove from war" item
 * @param {string}  [config.onRoleChange]   - JS template: use {role} placeholder
 * @param {string}  [config.onMove]         - JS template: use {partyIndex} placeholder
 * @param {string}  [config.onRemove]       - JS expression for remove action
 * @param {boolean} [config.open=false]     - render menu visible
 * @returns {string} HTML string
 */
function MemberDropdown(config) {
  var cfg = config || {};
  var name = cfg.memberName || 'Player';
  var role = (cfg.currentRole || 'DPS').toUpperCase();
  var parties = cfg.parties || [];
  var showRemove = cfg.showRemove !== false;
  var isOpen = cfg.open ? 'display:block;' : 'display:none;';

  var roles = ['TANK', 'HEALER', 'DPS'];

  // Toggle button
  var html = '<div class="pg-dropdown" style="position:relative;display:inline-block;">';
  html += '<button class="pg-dropdown-toggle" onclick="MemberDropdown._toggle(this)">';
  html += escHtml(name);
  html += ' <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  html += '</button>';

  // Menu
  html += '<div class="pg-dropdown-menu" style="' + isOpen + '">';

  // Role items
  for (var i = 0; i < roles.length; i++) {
    var r = roles[i];
    var active = r === role ? 'font-weight:800;' : '';
    var onclick = cfg.onRoleChange ? ' onclick="' + cfg.onRoleChange.replace('{role}', r) + '"' : '';
    html += '<div class="pg-dropdown-item" style="' + active + '"' + onclick + '>'
      + RoleBadge(r, { pill: false })
      + ' Set ' + r
      + '</div>';
  }

  // Move to party items
  if (parties.length) {
    html += '<div style="border-top:1px solid var(--border-subtle,#333);margin-top:4px;padding-top:4px;">';
    for (var p = 0; p < parties.length; p++) {
      var onclick2 = cfg.onMove ? ' onclick="' + cfg.onMove.replace('{partyIndex}', parties[p].index) + '"' : '';
      html += '<div class="pg-dropdown-item"' + onclick2 + '>Move to ' + escHtml(parties[p].name) + '</div>';
    }
    html += '</div>';
  }

  // Remove
  if (showRemove) {
    var onclick3 = cfg.onRemove ? ' onclick="' + cfg.onRemove + '"' : '';
    html += '<div class="pg-dropdown-item danger" style="border-top:1px solid var(--border-subtle,#333);margin-top:4px;padding-top:6px;"' + onclick3 + '>'
      + 'Remove from war</div>';
  }

  html += '</div></div>';
  return html;
}

/**
 * Toggle menu visibility. Called by the toggle button.
 * @param {HTMLElement} btn
 */
MemberDropdown._toggle = function(btn) {
  var menu = btn.nextElementSibling;
  if (!menu) return;
  var visible = menu.style.display === 'block';
  // Close all open dropdowns first
  document.querySelectorAll('.pg-dropdown-menu').forEach(function(m) {
    m.style.display = 'none';
  });
  if (!visible) menu.style.display = 'block';
};

// Close dropdown on outside click
document.addEventListener('click', function(e) {
  if (!e.target.closest('.pg-dropdown')) {
    document.querySelectorAll('.pg-dropdown-menu').forEach(function(m) {
      m.style.display = 'none';
    });
  }
});
