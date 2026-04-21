/**
 * classify-unrostered.js
 *
 * Finds all players from wars who are NOT in roster_members,
 * classifies them by appearance count, and generates:
 * 1. A markdown report (scripts/output/classification-report.md)
 * 2. A SQL file to insert them (scripts/output/insert-classified.sql)
 *
 * Usage: node scripts/classify-unrostered.js
 * Requires DATABASE_URL env var.
 */

var { Pool } = require('pg');
var fs = require('fs');
var path = require('path');

var pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  // 1. Find Nova guild
  var { rows: guilds } = await pool.query(
    "SELECT id, name FROM guilds WHERE LOWER(name) = 'nova' LIMIT 1"
  );
  if (!guilds.length) { console.error('Guild Nova not found'); process.exit(1); }
  var guildId = guilds[0].id;
  console.log('Guild:', guilds[0].name, '(' + guildId + ')');

  // 2. Get roster names
  var { rows: roster } = await pool.query(
    'SELECT name FROM roster_members WHERE guild_id = $1', [guildId]
  );
  var rosterSet = {};
  roster.forEach(function(r) { rosterSet[r.name.toLowerCase()] = true; });
  console.log('Roster members:', roster.length);

  // 3. Get all wars and extract player names
  var { rows: wars } = await pool.query(
    'SELECT id, opponent, date, parties FROM wars WHERE guild_id = $1 ORDER BY id DESC LIMIT 10', [guildId]
  );
  console.log('Wars analyzed:', wars.length);

  var playerWars = {}; // name → Set of war descriptions
  wars.forEach(function(w) {
    (w.parties || []).forEach(function(p) {
      (p.members || []).forEach(function(m) {
        if (!m.name) return;
        if (!playerWars[m.name]) playerWars[m.name] = new Set();
        playerWars[m.name].add(w.opponent + ' ' + w.date);
      });
    });
  });

  // 4. Find unrostered players
  var unrostered = [];
  Object.keys(playerWars).forEach(function(name) {
    if (!rosterSet[name.toLowerCase()]) {
      unrostered.push({ name: name, warCount: playerWars[name].size, wars: Array.from(playerWars[name]) });
    }
  });
  unrostered.sort(function(a, b) { return b.warCount - a.warCount; });

  // 5. Classify
  var inactive = unrostered.filter(function(p) { return p.warCount >= 5; });
  var external = unrostered.filter(function(p) { return p.warCount < 5; });

  console.log('\nClassification:');
  console.log('  Inactive (5+ wars):', inactive.length);
  console.log('  External (1-4 wars):', external.length);
  console.log('  Total unrostered:', unrostered.length);

  // 6. Generate markdown report
  var md = '# Classification Report\n\n';
  md += 'Generated: ' + new Date().toISOString() + '\n';
  md += 'Guild: ' + guilds[0].name + '\n';
  md += 'Wars analyzed: ' + wars.length + '\n';
  md += 'Roster members: ' + roster.length + '\n';
  md += 'Unrostered players: ' + unrostered.length + '\n\n';

  md += '## Proposed INACTIVE (' + inactive.length + ' players, 5+ wars)\n\n';
  md += 'These appear frequently — likely former Nova members or regulars.\n\n';
  md += '| # | Player | Wars | Appeared in |\n';
  md += '|---|--------|------|-------------|\n';
  inactive.forEach(function(p, i) {
    md += '| ' + (i + 1) + ' | ' + p.name + ' | ' + p.warCount + ' | ' + p.wars.slice(0, 3).join(', ') + ' |\n';
  });

  md += '\n## Proposed EXTERNAL (' + external.length + ' players, 1-4 wars)\n\n';
  md += 'These appear rarely — likely opponents or one-time participants.\n\n';
  md += '| # | Player | Wars | Appeared in |\n';
  md += '|---|--------|------|-------------|\n';
  external.forEach(function(p, i) {
    md += '| ' + (i + 1) + ' | ' + p.name + ' | ' + p.warCount + ' | ' + p.wars.slice(0, 3).join(', ') + ' |\n';
  });

  // 7. Generate SQL
  var sql = '-- Auto-generated classification SQL\n';
  sql += '-- Review before running! Some "external" players might be Nova members.\n\n';
  sql += "DO $$\nDECLARE\n  gid UUID;\nBEGIN\n";
  sql += "  SELECT id INTO gid FROM guilds WHERE LOWER(name) = 'nova' LIMIT 1;\n";
  sql += "  IF gid IS NULL THEN RAISE NOTICE 'Nova not found'; RETURN; END IF;\n\n";

  function escapeSql(s) { return s.replace(/'/g, "''"); }

  if (inactive.length) {
    sql += '  -- INACTIVE members (' + inactive.length + ')\n';
    inactive.forEach(function(p) {
      sql += "  INSERT INTO roster_members (name, role, guild_id, active, status) VALUES ('" + escapeSql(p.name) + "', 'DPS', gid, false, 'inactive') ON CONFLICT (guild_id, name) DO NOTHING;\n";
    });
  }

  if (external.length) {
    sql += '\n  -- EXTERNAL members (' + external.length + ')\n';
    external.forEach(function(p) {
      sql += "  INSERT INTO roster_members (name, role, guild_id, active, status) VALUES ('" + escapeSql(p.name) + "', 'DPS', gid, false, 'external') ON CONFLICT (guild_id, name) DO NOTHING;\n";
    });
  }

  sql += '\nEND $$;\n';

  // 8. Write files
  var outDir = path.join(__dirname, 'output');
  fs.writeFileSync(path.join(outDir, 'classification-report.md'), md);
  fs.writeFileSync(path.join(outDir, 'insert-classified.sql'), sql);

  console.log('\nFiles written:');
  console.log('  scripts/output/classification-report.md');
  console.log('  scripts/output/insert-classified.sql');
  console.log('\nReview the report, then run the SQL manually if approved.');

  await pool.end();
}

run().catch(function(e) { console.error(e); process.exit(1); });
