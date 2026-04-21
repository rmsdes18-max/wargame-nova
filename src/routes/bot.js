var { Router } = require('express');
var { pool } = require('../db');
var { logActivity } = require('../services/activityLog');
var { logTokenUsage } = require('../services/tokenLog');
var router = Router();

var BOT_API_KEY = process.env.BOT_API_KEY || '8bddf9d99b264921e84f3cc9f7a01a347543703c9d509b3ad0495fcaee77f69e';

/* ── Auth: validate bot key ── */
function requireBotKey(req, res, next) {
  if (!BOT_API_KEY) {
    return res.status(503).json({ error: 'Bot integration not configured' });
  }
  var key = req.headers['x-bot-key'] || '';
  if (key !== BOT_API_KEY) {
    return res.status(401).json({ error: 'Invalid bot key' });
  }
  next();
}

/* ── Simple name normalization for matching ── */
function normalizeName(n) {
  return (n || '').toLowerCase()
    .replace(/[^\w\s\u3000-\u9fff\uff00-\uffef]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── POST /api/bot/warlog — create war from Discord bot data ── */
router.post('/warlog', requireBotKey, async function(req, res) {
  var { opponent, date, players } = req.body;

  if (!opponent || !players || !players.length) {
    return res.status(400).json({ error: 'opponent and players[] required' });
  }

  try {
    // 1. Find Nova guild
    var { rows: guildRows } = await pool.query(
      'SELECT id, name, tier FROM guilds WHERE LOWER(name) = $1 OR LOWER(slug) = $1 LIMIT 1',
      ['nova']
    );
    if (!guildRows.length) {
      return res.status(404).json({ error: 'Guild "Nova" not found in database' });
    }
    var guild = guildRows[0];

    // 2. Get roster for role assignment
    var { rows: roster } = await pool.query(
      'SELECT name, role FROM roster_members WHERE guild_id = $1 AND active = true',
      [guild.id]
    );

    // 3. Get aliases for better matching
    var { rows: aliasRows } = await pool.query(
      'SELECT normalized_key, actual_name FROM aliases WHERE guild_id = $1 AND type = $2',
      [guild.id, 'member']
    );
    var aliases = {};
    aliasRows.forEach(function(a) { aliases[a.normalized_key] = a.actual_name; });

    // 4. Map players: bot format → WARTL format + role from roster
    var rosterMap = {};
    roster.forEach(function(r) { rosterMap[normalizeName(r.name)] = r; });

    console.log('[Bot] Roster: ' + roster.length + ' members, Aliases: ' + aliasRows.length);
    console.log('[Bot] Roster names:', roster.slice(0, 5).map(function(r) { return r.name + '(' + r.role + ')'; }).join(', '));

    var matchedCount = 0;
    var unmatchedNames = [];

    var mapped = players.map(function(p) {
      var key = normalizeName(p.name);
      var rosterMember = rosterMap[key] || null;

      // Try alias reverse-lookup if direct match failed
      if (!rosterMember) {
        var aliasKeys = Object.keys(aliases);
        for (var i = 0; i < aliasKeys.length; i++) {
          var aliasVal = aliases[aliasKeys[i]];
          if (normalizeName(aliasVal) === key) {
            rosterMember = rosterMap[aliasKeys[i]] || null;
            break;
          }
        }
      }

      if (rosterMember) { matchedCount++; }
      else { unmatchedNames.push(p.name); }

      return {
        name: rosterMember ? rosterMember.name : p.name,
        role: 'DPS',
        defeat: p.kills || 0,
        assist: p.assists || 0,
        dmg_dealt: p.damage || 0,
        dmg_taken: p.damageTaken || 0,
        healed: p.heal || 0
      };
    });

    console.log('[Bot] Matched: ' + matchedCount + '/' + players.length + '. Unmatched: ' + unmatchedNames.join(', '));

    // 5. Single party — keep original order from scoreboard
    var parties = [{ name: 'Nova', label: 'All', members: mapped }];

    // 6. Create war
    var warId = Date.now();
    var warDate = date || new Date().toLocaleDateString('ro-RO');

    var { rows: warRows } = await pool.query(
      'INSERT INTO wars (id, opponent, date, parties, guild_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [warId, opponent, warDate, JSON.stringify(parties), guild.id]
    );

    logActivity(guild.id, null, 'war_created_bot', 'vs ' + opponent + ' (' + mapped.length + ' players)');

    console.log('[Bot] War created: vs ' + opponent + ', ' + mapped.length + ' Nova players');

    res.status(201).json({
      id: warId,
      opponent: opponent,
      date: warDate,
      players: mapped.length,
      url: '/#war-' + warId
    });
  } catch (e) {
    console.error('[Bot] warlog error:', e);
    if (e.code === '23505') return res.status(409).json({ error: 'War already exists' });
    res.status(500).json({ error: 'Failed to create war: ' + e.message });
  }
});



module.exports = router;
