/* ── MemberDropdown ────────────────────────────────────────────────── */

/**
 * Renders a context-menu style dropdown for a party member.
 *
 * Uses the playground-defined classes (.pg-dropdown-*) or works
 * standalone with inline styles when those classes aren't available.
 *
 * @param {object} options
 * @param {string}  options.memberName       - display name on the toggle button
 * @param {string}  [options.currentRole='DPS'] - current role (for highlighting)
 * @param {Array}   [options.parties]        - [{name,index}] for "Move to" items
 * @param {boolean} [options.showRemove=true]  - show "Remove from war" item
 * @param {string}  [options.onRoleChange]   - JS template: use {role} placeholder
 * @param {string}  [options.onMove]         - JS template: use {partyIndex} placeholder
 * @param {string}  [options.onRemove]       - JS expression for remove action
 * @param {boolean} [options.open=false]     - render menu visible
 * @returns {string} HTML string
 */
function MemberDropdown(options) {
  var opts = options || {};
  var name = opts.memberName || 'Player';
  var role = (opts.currentRole || 'DPS').toUpperCase();
  var parties = opts.parties || [];
  var showRemove = opts.showRemove !== false;
  var isOpen = opts.open ? 'display:block;' : 'display:none;';

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
    var onclick = opts.onRoleChange ? ' onclick="' + opts.onRoleChange.replace('{role}', r) + '"' : '';
    html += '<div class="pg-dropdown-item" style="' + active + '"' + onclick + '>'
      + RoleBadge(r, { pill: false })
      + ' Set ' + r
      + '</div>';
  }

  // Move to party items
  if (parties.length) {
    html += '<div style="border-top:1px solid var(--border-subtle,#333);margin-top:4px;padding-top:4px;">';
    for (var p = 0; p < parties.length; p++) {
      var onclick2 = opts.onMove ? ' onclick="' + opts.onMove.replace('{partyIndex}', parties[p].index) + '"' : '';
      html += '<div class="pg-dropdown-item"' + onclick2 + '>Move to ' + escHtml(parties[p].name) + '</div>';
    }
    html += '</div>';
  }

  // Remove
  if (showRemove) {
    var onclick3 = opts.onRemove ? ' onclick="' + opts.onRemove + '"' : '';
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
