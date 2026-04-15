/* ── DOM Utilities ─────────────────────────────────────────────────── */

/**
 * show - Shows an element by id (sets display to '' or specified value).
 *
 * @param {string} id      - DOM element id
 * @param {string} [display=''] - display value ('flex', 'block', etc.)
 */
function show(id, display) {
  var el = document.getElementById(id);
  if (el) el.style.display = display || '';
}

/**
 * hide - Hides an element by id (sets display to 'none').
 *
 * @param {string} id - DOM element id
 */
function hide(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

/**
 * setHtml - Sets innerHTML of an element by id.
 *
 * @param {string} id   - DOM element id
 * @param {string} html - HTML content
 */
function setHtml(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/**
 * setText - Sets textContent of an element by id.
 *
 * @param {string} id   - DOM element id
 * @param {string} text - Text content
 */
function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * showError - Shows an error message in an element, or hides it.
 *
 * @param {string} id  - DOM element id
 * @param {string} [msg] - error message; if falsy, hides the element
 */
function showError(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}
