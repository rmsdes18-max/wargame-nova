var { pool } = require('../db');

/**
 * logTokenUsage - Loghează consumul de tokens Anthropic în baza de date
 * @param {object} opts - Opțiuni
 * @param {string} [opts.guild_id] - Guild ID
 * @param {string} [opts.user_id] - User ID
 * @param {string} opts.model - Model folosit
 * @param {number} opts.input_tokens - Tokens input
 * @param {number} opts.output_tokens - Tokens output
 * @param {number} [opts.cache_read_input_tokens] - Cache read tokens
 * @param {number} [opts.cache_creation_input_tokens] - Cache creation tokens
 * @param {string} [opts.endpoint] - Endpoint (e.g. 'ocr')
 */
function logTokenUsage(opts) {
  var sql = 'INSERT INTO token_usage (guild_id, user_id, model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, endpoint) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
  var params = [
    opts.guild_id || null,
    opts.user_id || null,
    opts.model || 'unknown',
    opts.input_tokens || 0,
    opts.output_tokens || 0,
    opts.cache_read_input_tokens || 0,
    opts.cache_creation_input_tokens || 0,
    opts.endpoint || null
  ];
  pool.query(sql, params).catch(function(e) {
    console.error('[TokenLog] Failed to log:', e.message);
  });
}

module.exports = { logTokenUsage };
