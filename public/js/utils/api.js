/* ── API Utilities ─────────────────────────────────────────────────── */

/**
 * apiHeaders - Builds standard request headers with auth token and guild id.
 *
 * @param {boolean} [isAdmin=false] - include admin secret header
 * @returns {object} Headers object
 */
function apiHeaders(isAdmin) {
  var h = {'Content-Type': 'application/json'};
  var token = localStorage.getItem('nova_token');
  if (token) h['Authorization'] = 'Bearer ' + token;
  if (_currentGuildId) h['X-Guild-ID'] = _currentGuildId;
  if (isAdmin) {
    var s = localStorage.getItem('nova_admin_secret') || '';
    if (s) h['X-Admin-Secret'] = s;
  }
  return h;
}

/**
 * safeFetch - Fetch with automatic JSON parsing and error handling.
 * Returns null on failure instead of throwing.
 *
 * @param {string} url       - API endpoint
 * @param {object} [options] - fetch options (method, headers, body)
 * @returns {Promise<*|null>} Parsed JSON or null on error
 */
function safeFetch(url, options) {
  return fetch(url, options || {headers: apiHeaders()})
    .then(function(r) { return r.ok ? r.json() : null; })
    .catch(function() { return null; });
}

/**
 * apiGet - GET request with auth headers.
 *
 * @param {string} endpoint  - API path (e.g. '/api/wars')
 * @param {object} [options] - extra options
 * @param {*}      [options.fallback=null] - value returned on failure
 * @returns {Promise<*>}
 */
function apiGet(endpoint, options) {
  var opts = options || {};
  var fallback = opts.fallback !== undefined ? opts.fallback : null;
  return fetch(endpoint, {headers: apiHeaders()})
    .then(function(r) { return r.ok ? r.json() : fallback; })
    .catch(function() { return fallback; });
}

/**
 * apiPost - POST request with JSON body.
 *
 * @param {string} endpoint - API path
 * @param {*}      data     - request body (will be JSON.stringified)
 * @param {object} [options]
 * @param {boolean} [options.admin=false] - use admin headers
 * @returns {Promise<Response>}
 */
function apiPost(endpoint, data, options) {
  var opts = options || {};
  return fetch(endpoint, {
    method: 'POST',
    headers: apiHeaders(opts.admin),
    body: JSON.stringify(data)
  });
}

/**
 * apiPut - PUT request with JSON body.
 *
 * @param {string} endpoint - API path
 * @param {*}      data     - request body
 * @param {object} [options]
 * @param {boolean} [options.admin=false] - use admin headers
 * @returns {Promise<Response>}
 */
function apiPut(endpoint, data, options) {
  var opts = options || {};
  return fetch(endpoint, {
    method: 'PUT',
    headers: apiHeaders(opts.admin),
    body: JSON.stringify(data)
  });
}

/**
 * apiPatch - PATCH request with JSON body.
 *
 * @param {string} endpoint - API path
 * @param {*}      data     - request body
 * @returns {Promise<Response>}
 */
function apiPatch(endpoint, data) {
  return fetch(endpoint, {
    method: 'PATCH',
    headers: apiHeaders(),
    body: JSON.stringify(data)
  });
}

/**
 * apiDelete - DELETE request.
 *
 * @param {string} endpoint - API path
 * @returns {Promise<Response>}
 */
function apiDelete(endpoint) {
  return fetch(endpoint, {
    method: 'DELETE',
    headers: apiHeaders(true)
  });
}
