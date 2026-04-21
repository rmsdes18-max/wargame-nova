// ── MEMBERS PAGE ──
var _membersTab = 'active';
var _membersEditMode = false;
var _membersRoleFilter = 'ALL';
var _rosterData = [];
var _memberAliases = {}; // key: normalizedTlgmName → value: inGameName

var _membersMergeSource = null;
var _membersMergeQueue = []; // collect multiple players to merge into one

async function renderMembersPage(){
  var container = document.getElementById('members-list-container');
  var countEl = document.getElementById('members-count');
  var actionsEl = document.getElementById('members-actions');
  if(!container) return;

  if(actionsEl) actionsEl.style.display = 'none';

  container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Loading...</div>';
  try{
    var results = await Promise.all([
      apiGet('/api/roster', {fallback: []}),
      apiGet('/api/aliases/member', {fallback: {}})
    ]);
    _rosterData = results[0];
    _memberAliases = results[1];
    // Ensure wars are loaded
    if(!_warsCache){
      _warsCache = await apiGet('/api/wars', {fallback: []});
    }
    renderMembersV2();
  }catch(e){ container.innerHTML='<div style="color:var(--dps);">Error: '+e.message+'</div>'; }
}

/* ── Build unique player list from all wars ── */
function buildPlayersFromWars(){
  var wars = _warsCache || [];
  var playerData = {};
  var merges = JSON.parse(localStorage.getItem('nova_compare_merges') || '{}');

  wars.forEach(function(w){
    if(!w.parties) return;
    w.parties.forEach(function(p){
      if(!p.members) return;
      p.members.forEach(function(m){
        // Use same dedup as compare page
        var key = normalizeName(m.name);
        // Check manual merges
        if(merges[m.name]){ key = normalizeName(merges[m.name]); }
        // Check aliases
        var aliasKeys = Object.keys(_memberAliases);
        for(var a = 0; a < aliasKeys.length; a++){
          if(normalizeName(_memberAliases[aliasKeys[a]]) === normalizeName(m.name)){
            key = aliasKeys[a]; break;
          }
        }
        // Fuzzy match existing keys
        if(!playerData[key]){
          var existingKeys = Object.keys(playerData);
          for(var e = 0; e < existingKeys.length; e++){
            var ex = playerData[existingKeys[e]];
            if(typeof similarityScore === 'function' && similarityScore(m.name, ex.name) > 65){
              key = existingKeys[e]; break;
            }
            var latinA = (m.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            var latinB = (ex.name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if(latinA.length >= 4 && latinB.length >= 4 && (latinA === latinB || latinB.indexOf(latinA) === 0 || latinA.indexOf(latinB) === 0)){
              key = existingKeys[e]; break;
            }
          }
        }

        if(!playerData[key]){
          playerData[key] = {name: m.name, wars: 0, variants: [], totalK: 0, totalA: 0, totalD: 0, totalT: 0, totalH: 0, lastWar: ''};
        }
        var pd = playerData[key];
        if(m.name.length > pd.name.length) pd.name = m.name;
        if(pd.variants.indexOf(m.name) === -1 && normalizeName(m.name) !== normalizeName(pd.name)){
          // Don't add if already saved as alias
          var isAliased = false;
          var aliasKeys = Object.keys(_memberAliases);
          for(var ak = 0; ak < aliasKeys.length; ak++){
            if(normalizeName(_memberAliases[aliasKeys[ak]]) === normalizeName(m.name) || normalizeName(m.name) === aliasKeys[ak]){
              isAliased = true; break;
            }
          }
          if(!isAliased) pd.variants.push(m.name);
        }
        pd.wars++;
        pd.totalK += m.defeat || 0;
        pd.totalA += m.assist || 0;
        pd.totalD += m.dmg_dealt || 0;
        pd.totalT += m.dmg_taken || 0;
        pd.totalH += m.healed || 0;
        pd.lastWar = w.date || pd.lastWar;
      });
    });
  });

  return Object.values(playerData).sort(function(a, b){ return b.totalK - a.totalK; });
}

/* ── Render Members V2 ── */
function renderMembersV2(){
  var container = document.getElementById('members-list-container');
  var countEl = document.getElementById('members-count');
  var players = buildPlayersFromWars();
  window._membersPlayers = players;

  if(countEl) countEl.textContent = players.length + ' players from ' + (_warsCache || []).length + ' wars';

  if(!players.length){
    container.innerHTML = EmptyState({icon: '&#9878;', title: 'No players yet', description: 'Create wars via Discord bot (/warlog) to see players here.', padding: '40px 20px'});
    return;
  }

  // Search
  var html = '<input type="text" id="members-search" placeholder="Search player..." oninput="filterMembersV2()" style="width:100%;max-width:300px;background:var(--bg-hover);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;padding:8px 12px;margin-bottom:12px;">';

  // Merge status bar
  html += '<div id="members-merge-status" style="display:none;padding:8px 14px;background:rgba(212,225,87,.1);border:1px solid rgba(212,225,87,.2);border-radius:8px;margin-bottom:12px;position:sticky;top:0;z-index:50;"></div>';

  // Aliases section (collapsible)
  var aliasKeys = Object.keys(_memberAliases);
  if(aliasKeys.length){
    html += '<details style="margin-bottom:12px;"><summary style="cursor:pointer;font-size:12px;color:var(--text-muted);">Aliases (' + aliasKeys.length + ') <button onclick="event.stopPropagation();resetAllAliases()" style="background:transparent;border:1px solid rgba(232,64,64,.3);color:var(--dps);font-size:10px;padding:2px 8px;border-radius:4px;cursor:pointer;margin-left:8px;">Reset all</button></summary>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">';
    aliasKeys.forEach(function(k){
      var safeK = k.replace(/'/g, "\\'");
      html += '<span style="font-size:11px;background:var(--bg-hover);border:1px solid var(--border);border-radius:4px;padding:3px 8px;color:var(--text-muted);display:inline-flex;align-items:center;gap:4px;">'
        + escHtml(k) + ' &#8594; ' + escHtml(_memberAliases[k])
        + ' <span onclick="removeAliasMember(\'' + safeK + '\')" style="cursor:pointer;color:var(--dps);font-size:13px;line-height:1;" title="Remove">&times;</span>'
        + '</span>';
    });
    html += '</div></details>';
  }

  // Table
  html += '<div style="overflow-x:auto;">';
  html += '<table class="compare-table">';
  html += '<thead><tr><th style="text-align:left;">#</th><th style="text-align:left;">Player</th><th class="num">Wars</th><th class="num">K</th><th class="num">A</th><th class="num">DMG</th><th class="num">H</th></tr></thead>';
  html += '<tbody id="members-tbody">';

  players.forEach(function(p, idx){
    html += '<tr class="members-row" data-name="' + escHtml(p.name.toLowerCase()) + '">';
    html += '<td style="color:var(--text-muted);font-size:12px;width:30px;">' + (idx + 1) + '</td>';
    html += '<td>';
    html += '<div style="display:flex;align-items:center;gap:6px;">';
    html += '<span style="font-weight:600;font-size:13px;cursor:pointer;color:var(--text);" onclick="openPlayerProfile(' + idx + ')">' + escHtml(p.name) + '</span>';
    html += '<span onclick="memberStartMergeByIdx(' + idx + ')" style="cursor:pointer;font-size:10px;color:var(--text-muted);opacity:.4;" title="Merge with another player">&#x1F517;</span>';
    // Existing aliases for this player
    var pAliases = [];
    var aliasKeysAll = Object.keys(_memberAliases);
    aliasKeysAll.forEach(function(ak){
      if(normalizeName(_memberAliases[ak]) === normalizeName(p.name)){
        pAliases.push(ak);
      }
    });
    if(pAliases.length){
      html += '<span style="font-size:9px;color:var(--heal);background:rgba(76,175,80,.1);padding:1px 6px;border-radius:3px;">' + pAliases.length + ' alias</span>';
    }
    // Add alias button
    html += '<span onclick="toggleAddAlias(' + idx + ')" style="cursor:pointer;font-size:9px;color:var(--text-muted);opacity:.6;padding:1px 4px;" title="Add alias">+ alias</span>';
    html += '</div>';
    // Add alias input (hidden by default)
    html += '<div id="add-alias-' + idx + '" style="display:none;margin-top:4px;padding-left:26px;">';
    html += '<div style="display:flex;align-items:center;gap:6px;">';
    html += '<input id="alias-input-' + idx + '" type="text" placeholder="Type alias name..." style="width:160px;background:var(--bg-hover);border:1px solid var(--border);border-radius:4px;padding:4px 8px;color:var(--text);font-size:11px;outline:none;" onkeydown="if(event.key===\'Enter\')saveManualAliasByIdx(' + idx + ')">';
    html += '<button onclick="saveManualAliasByIdx(' + idx + ')" class="btn btn-secondary" style="font-size:9px;padding:2px 8px;">Save</button>';
    html += '</div>';
    // Show existing aliases with delete
    if(pAliases.length){
      html += '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;">';
      pAliases.forEach(function(ak){
        var safeAk = ak.replace(/'/g, "\\'");
        html += '<span style="font-size:10px;background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.2);border-radius:3px;padding:2px 6px;color:var(--heal);display:inline-flex;align-items:center;gap:3px;">'
          + escHtml(ak)
          + ' <span onclick="removeAliasMember(\'' + safeAk + '\')" style="cursor:pointer;color:var(--dps);font-size:12px;">&times;</span>'
          + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';
    if(p.variants.length){
      var varId = 'var-' + idx;
      html += '<div style="margin-top:4px;padding-left:26px;">';
      html += '<span onclick="toggleVariants(\'' + varId + '\')" style="font-size:9px;color:var(--accent);cursor:pointer;background:rgba(212,225,87,.1);padding:1px 6px;border-radius:3px;">+' + p.variants.length + ' variants</span>';
      html += '<div id="' + varId + '" style="display:none;margin-top:4px;">';
      p.variants.forEach(function(v, vi){
        html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px;">';
        html += '<span style="color:var(--text-muted);">' + escHtml(v) + '</span>';
        html += '<button onclick="saveVariantByIdx(' + idx + ',' + vi + ')" class="btn btn-secondary" style="font-size:9px;padding:1px 6px;">Save alias</button>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }
    html += '</td>';
    html += '<td style="text-align:center;color:var(--text-muted);font-size:12px;">' + p.wars + '</td>';
    html += '<td style="text-align:center;color:var(--accent);font-weight:600;">' + p.totalK + '</td>';
    html += '<td style="text-align:center;color:var(--text-muted);">' + p.totalA + '</td>';
    html += '<td style="text-align:center;color:var(--color-assists);">' + fmtShort(p.totalD) + '</td>';
    html += '<td style="text-align:center;color:var(--heal);">' + fmtShort(p.totalH) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/* ── Search filter ── */
function filterMembersV2(){
  var q = (document.getElementById('members-search').value || '').toLowerCase();
  var rows = document.querySelectorAll('.members-row');
  rows.forEach(function(row){
    var name = row.getAttribute('data-name') || '';
    row.style.display = name.indexOf(q) !== -1 ? '' : 'none';
  });
}

/* ── Index-based wrappers (safe for CJK names) ── */
function openPlayerProfile(idx){
  var p = window._membersPlayers[idx];
  if(!p) return;
  openMemberProfile(encodeURIComponent(p.name));
}

function memberStartMergeByIdx(idx){
  var p = window._membersPlayers[idx];
  if(!p) return;
  memberStartMerge(p.name);
}

function saveVariantByIdx(playerIdx, variantIdx){
  var p = window._membersPlayers[playerIdx];
  if(!p || !p.variants[variantIdx]) return;
  saveVariantAlias(p.variants[variantIdx], p.name);
}

/* ── Merge from Members page (multi-select) ── */
function memberStartMerge(playerName){
  var statusEl = document.getElementById('members-merge-status');

  // If already in queue, remove it
  var qIdx = _membersMergeQueue.indexOf(playerName);
  if(qIdx !== -1){
    _membersMergeQueue.splice(qIdx, 1);
    if(!_membersMergeQueue.length){ memberCancelMerge(); return; }
    updateMergeStatus();
    return;
  }

  _membersMergeQueue.push(playerName);
  updateMergeStatus();
}

function updateMergeStatus(){
  var statusEl = document.getElementById('members-merge-status');
  if(!_membersMergeQueue.length){ statusEl.style.display = 'none'; return; }

  var names = _membersMergeQueue.map(function(n){ return '<b>' + escHtml(n) + '</b>'; }).join(', ');
  var html = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
  html += '<span style="color:var(--accent);font-size:12px;">Selected: ' + names + '</span>';
  if(_membersMergeQueue.length >= 2){
    html += '<button onclick="memberFinishMerge()" class="btn btn-primary" style="font-size:11px;padding:4px 12px;">Merge ' + _membersMergeQueue.length + ' into one</button>';
  } else {
    html += '<span style="color:var(--text-muted);font-size:11px;">Click more players to add</span>';
  }
  html += '<button onclick="memberCancelMerge()" class="btn btn-secondary" style="font-size:11px;padding:3px 8px;">Cancel</button>';
  html += '</div>';
  statusEl.innerHTML = html;
  statusEl.style.display = 'block';
}

function memberFinishMerge(){
  if(_membersMergeQueue.length < 2) return;

  // First in queue = target (keep), rest = sources (merge into target)
  var target = _membersMergeQueue[0];
  var sources = _membersMergeQueue.slice(1);

  var merges = JSON.parse(localStorage.getItem('nova_compare_merges') || '{}');
  sources.forEach(function(src){
    merges[src] = target;
  });
  localStorage.setItem('nova_compare_merges', JSON.stringify(merges));

  // Save aliases on server: each source name → target name
  var allSet = {};
  sources.forEach(function(src){
    allSet[normalizeName(src)] = target;
  });
  apiPatch('/api/aliases/member', {set: allSet}).catch(function(e){
    console.warn('[Members Merge] alias save failed:', e);
  });

  _membersMergeQueue = [];
  document.getElementById('members-merge-status').style.display = 'none';
  renderMembersV2();
}

function memberCancelMerge(){
  _membersMergeQueue = [];
  document.getElementById('members-merge-status').style.display = 'none';
}

function removeAliasMember(key){
  apiPatch('/api/aliases/member', {delete: [key]}).then(function(){
    delete _memberAliases[key];
    _mAliasCache = _memberAliases;
    // Also remove from localStorage merges
    var merges = JSON.parse(localStorage.getItem('nova_compare_merges') || '{}');
    Object.keys(merges).forEach(function(mk){ if(normalizeName(mk) === key || normalizeName(merges[mk]) === key) delete merges[mk]; });
    localStorage.setItem('nova_compare_merges', JSON.stringify(merges));
    renderMembersV2();
  }).catch(function(e){ Toast.error('Failed: ' + e.message); });
}

function toggleVariants(id){
  var el = document.getElementById(id);
  if(el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleAddAlias(idx){
  var el = document.getElementById('add-alias-' + idx);
  if(el){
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if(el.style.display === 'block'){
      var input = document.getElementById('alias-input-' + idx);
      if(input) input.focus();
    }
  }
}

function saveManualAliasByIdx(idx){
  var p = window._membersPlayers[idx];
  if(!p) return;
  var input = document.getElementById('alias-input-' + idx);
  if(!input) return;
  var aliasName = input.value.trim();
  if(!aliasName){ Toast.warning('Scrie un alias'); return; }
  var setObj = {};
  setObj[normalizeName(aliasName)] = p.name;
  apiPatch('/api/aliases/member', {set: setObj}).then(function(){
    _memberAliases[normalizeName(aliasName)] = p.name;
    _mAliasCache = _memberAliases;
    var merges = JSON.parse(localStorage.getItem('nova_compare_merges') || '{}');
    merges[aliasName] = p.name;
    localStorage.setItem('nova_compare_merges', JSON.stringify(merges));
    renderMembersV2();
  }).catch(function(e){ Toast.error('Failed: ' + e.message); });
}

function saveVariantAlias(variant, target){
  var setObj = {};
  setObj[normalizeName(variant)] = target;
  apiPatch('/api/aliases/member', {set: setObj}).then(function(){
    _memberAliases[normalizeName(variant)] = target;
    _mAliasCache = _memberAliases;
    // Also save in localStorage merges
    var merges = JSON.parse(localStorage.getItem('nova_compare_merges') || '{}');
    merges[variant] = target;
    localStorage.setItem('nova_compare_merges', JSON.stringify(merges));
    renderMembersV2();
  }).catch(function(e){ Toast.error('Failed: ' + e.message); });
}

function resetAllAliases(){
  if(!confirm('Reset all aliases? Players will appear as duplicates again.')) return;
  apiPut('/api/aliases/member', {}, {admin: true}).then(function(){
    _memberAliases = {};
    _mAliasCache = {};
    localStorage.removeItem('nova_compare_merges');
    renderMembersV2();
  }).catch(function(e){ Toast.error('Failed: ' + e.message); });
}

function renderMembersList(){
  var container = document.getElementById('members-list-container');
  var countEl = document.getElementById('members-count');
  var isEditor = _userRole === 'admin' || _userRole === 'editor';
  var showArchived = _membersTab === 'archived';
  var filtered = _rosterData.filter(function(m){
    var tabMatch = showArchived ? m.active === false : m.active !== false;
    var roleMatch = _membersRoleFilter === 'ALL' || m.role === _membersRoleFilter;
    return tabMatch && roleMatch;
  });
  // Sort: members without alias first (need attention), then alphabetical
  filtered.sort(function(a,b){
    var aKey = a.name.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
    var bKey = b.name.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
    var aHas = _memberAliases[aKey] ? 1 : 0;
    var bHas = _memberAliases[bKey] ? 1 : 0;
    if(aHas !== bHas) return aHas - bHas; // without alias first
    return a.name.localeCompare(b.name);
  });

  var activeCount = _rosterData.filter(function(m){ return m.active !== false; }).length;
  var archivedCount = _rosterData.filter(function(m){ return m.active === false; }).length;
  countEl.textContent = activeCount + ' active' + (archivedCount ? ' · ' + archivedCount + ' archived' : '');

  if(!_rosterData.length && !showArchived){
    document.getElementById('members-tabs').style.display = 'none';
    container.innerHTML = EmptyState({
      icon: '◆', title: 'No members yet',
      description: 'Export CSV from your Telegram Guild Manager bot and import it here to set up your roster.',
      buttonHtml: isEditor ? '<label class="btn btn-primary" style="cursor:pointer;padding:12px 28px;font-size:14px;">Import TLGM CSV<input type="file" accept=".csv" onchange="importTlgmCsv(this)" style="display:none;"></label>' : ''
    });
    return;
  }
  document.getElementById('members-tabs').style.display = 'flex';

  if(!filtered.length){
    container.innerHTML = EmptyState.inline('No '+(showArchived?'archived':'active')+' members');
    return;
  }

  // roleHex() from party-helpers.js

  // Split into unmatched and matched
  var unmatchedMembers = [];
  var matchedMembers = [];
  filtered.forEach(function(m){
    var aliasKey = m.name.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
    var inGameName = _memberAliases[aliasKey] || '';
    if(!inGameName && !showArchived) unmatchedMembers.push(m);
    else matchedMembers.push(m);
  });

  var output = '';

  // ── UNMATCHED SECTION (warning box) ──
  if(unmatchedMembers.length && !showArchived){
    // Build list of available game names for dropdown (unmatched from Sync TL Game, minus already assigned)
    var usedAliasValues = {};
    Object.values(_memberAliases).forEach(function(v){ usedAliasValues[v.toLowerCase()] = true; });
    var availableGameNames = [];
    var sources = window._unmatchedGameNames || window._unmatchedNames || [];
    sources.forEach(function(gn){
      if(!usedAliasValues[gn.toLowerCase()]) availableGameNames.push(gn);
    });
    availableGameNames.sort(function(a,b){ return a.localeCompare(b); });

    output += '<div style="background:rgba(212,225,87,.06);border:1px solid rgba(212,225,87,.2);border-radius:10px;padding:14px;margin-bottom:16px;">';
    output += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="font-size:14px;">⚠</span><span style="font-size:13px;font-weight:600;color:var(--accent);">'+unmatchedMembers.length+' members need in-game name</span>'
      +(!_membersEditMode ? '<span style="font-size:11px;color:var(--text-muted);margin-left:8px;">Click Edit to assign names</span>' : '')
      +'</div>';

    if(_membersEditMode){
      // Edit mode: show inputs + dropdowns
      output += '<div style="display:flex;align-items:center;gap:10px;padding:4px 0;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">'
        +'<div style="min-width:55px;">Role</div>'
        +'<div style="flex:1;">TLGM Name</div>'
        +'<div style="width:180px;">In-Game Name</div>'
        +'<div style="width:70px;"></div>'
        +'</div>';
      // Build datalist for autosuggest
      var datalistOpts = '';
      availableGameNames.forEach(function(gn){ datalistOpts += '<option value="'+escHtml(gn)+'">'; });
      output += '<datalist id="game-names-datalist">'+datalistOpts+'</datalist>';

      unmatchedMembers.forEach(function(m){
        var safeName = encodeURIComponent(m.name);
        var nRole = nextRole(m.role);
        var roleCls = m.role === 'TANK' ? 'tank' : m.role === 'HEALER' ? 'heal' : 'dps';
        var opts = '<option value="">-- Select --</option>';
        availableGameNames.forEach(function(gn){ opts += '<option value="'+escHtml(gn)+'">'+escHtml(gn)+'</option>'; });
        output += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(212,225,87,.1);">'
          +'<span class="badge badge-' + roleCls + '" onclick="cycleRole(\''+safeName+'\',\''+nRole+'\')" style="cursor:pointer;">'+(m.role==='HEALER'?'HEAL':m.role)+'</span>'
          +'<span style="font-size:13px;font-weight:600;color:var(--text);flex:1;">'+escHtml(m.name)+'</span>'
          +'<input id="manual-'+safeName+'" list="game-names-datalist" placeholder="Type or search..." style="width:180px;background:var(--bg-hover);border:1px solid var(--border-default);border-radius:4px;padding:4px 8px;color:var(--accent);font-size:12px;outline:none;">'
          +'<button onclick="archiveMember(\''+safeName+'\')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;">Archive</button>'
          +'</div>';
      });
      // Save All button at bottom
      output += '<div style="margin-top:12px;text-align:right;">'
        +'<button onclick="saveAllUnmatched()" class="btn btn-primary" style="padding:8px 24px;font-size:13px;">Save All</button>'
        +'</div>';
    } else {
      // View mode: just list names
      output += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">';
      unmatchedMembers.forEach(function(m){
        var color = roleHex(m.role);
        output += '<span style="font-size:11px;padding:3px 8px;border-radius:4px;background:var(--bg-hover);color:var(--text-muted);display:inline-flex;align-items:center;gap:4px;">'
          +'<span style="width:6px;height:6px;border-radius:50%;background:'+color+';"></span>'
          +escHtml(m.name)+'</span>';
      });
      output += '</div>';
    }
    output += '</div>';
  }

  // ── MAIN TABLE (matched members) ──
  var rows = '';
  (showArchived ? filtered : matchedMembers).forEach(function(m){
    var safeName = encodeURIComponent(m.name);
    var nRole = nextRole(m.role);
    var roleCls = m.role === 'TANK' ? 'tank' : m.role === 'HEALER' ? 'heal' : 'dps';
    var aliasKey = m.name.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
    var inGameName = _memberAliases[aliasKey] || '';

    rows += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);">'
      // ROLE
      +(_membersEditMode&&isEditor
        ? '<span class="badge badge-' + roleCls + '" onclick="cycleRole(\''+safeName+'\',\''+nRole+'\')" style="cursor:pointer;">'+(m.role==='HEALER'?'HEAL':m.role)+'</span>'
        : '<span class="badge badge-' + roleCls + '">'+(m.role==='HEALER'?'HEAL':m.role)+'</span>')
      // TLGM NAME
      +'<div style="flex:1;min-width:0;">'
        +(_membersEditMode
          ? '<div style="display:flex;align-items:center;gap:4px;">'
            +'<input id="tlgm-'+safeName+'" value="'+escHtml(m.name)+'" style="flex:1;background:var(--bg-hover);border:1px solid var(--border-default);border-radius:4px;padding:3px 6px;color:var(--text);font-size:12px;outline:none;max-width:180px;">'
            +'<button onclick="renameMember(\''+safeName+'\')" style="background:transparent;border:none;color:var(--heal);cursor:pointer;font-size:14px;padding:2px;">&#x2713;</button>'
            +'</div>'
          : '<div onclick="openMemberProfile(\''+safeName+'\')" style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;" title="View profile">'+escHtml(m.name)+'</div>')
        +(m.guildRole?'<div style="font-size:10px;color:var(--text-muted);">'+escHtml(m.guildRole)+'</div>':'')
      +'</div>'
      // IN-GAME NAME
      +'<div style="min-width:140px;text-align:left;">'
        +(_membersEditMode
          ? '<input id="alias-'+safeName+'" value="'+escHtml(inGameName||'')+'" placeholder="—" style="width:120px;background:var(--bg-hover);border:1px solid var(--border-default);border-radius:4px;padding:3px 6px;color:var(--accent);font-size:11px;outline:none;">'
            +'<button onclick="saveInlineAlias(\''+safeName+'\')" style="background:transparent;border:none;color:var(--heal);cursor:pointer;font-size:14px;padding:2px;">&#x2713;</button>'
          : '<span style="font-size:12px;color:var(--accent);">'+escHtml(inGameName)+'</span>')
      +'</div>'
      // ACTIONS
      +(_membersEditMode && !showArchived ? '<button onclick="archiveMember(\''+safeName+'\')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:4px 8px;">Archive</button>' : '')
      +(_membersEditMode && showArchived ? '<button onclick="restoreMember(\''+safeName+'\')" style="background:transparent;border:none;color:var(--heal);cursor:pointer;font-size:11px;padding:4px 8px;">Restore</button>' : '')
      +'</div>';
  });

  if(rows || showArchived){
    var header = '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);">'
      +'<div style="min-width:55px;text-align:left;">Role</div>'
      +'<div style="flex:1;text-align:left;">TLGM Name</div>'
      +'<div style="min-width:140px;text-align:left;">In-Game Name</div>'
      +(_membersEditMode?'<div style="min-width:55px;"></div>':'')
      +'</div>';
    output += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden;">'+header+rows+'</div>';
  } else if(!unmatchedMembers.length){
    output = EmptyState.inline('No members match current filter');
  }

  container.innerHTML = output;
  updateUnmatchedFilterCount();
}

function toggleMembersEditMode(){
  _membersEditMode = !_membersEditMode;
  var btn = document.getElementById('members-edit-btn');
  var tools = document.getElementById('members-edit-tools');
  if(_membersEditMode){
    btn.textContent = 'Done';
    btn.className = 'btn btn-secondary btn-sm';
    tools.style.display = 'flex';
  } else {
    btn.textContent = 'Edit';
    btn.className = 'btn btn-primary btn-sm';
    tools.style.display = 'none';
  }
  renderMembersList();
}

function updateUnmatchedFilterCount(){
  var count = 0;
  _rosterData.forEach(function(m){
    if(m.active === false) return;
    var key = m.name.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
    if(!_memberAliases[key]) count++;
  });
  var btn = document.getElementById('rf-UNMATCHED');
  if(btn) btn.textContent = '\u26A0 '+count;
  if(btn) btn.style.display = count ? '' : 'none';
}

function setRoleFilter(role){
  _membersRoleFilter = role;
  ['ALL','TANK','HEALER','DPS'].forEach(function(r){
    var btn = document.getElementById('rf-'+r);
    if(!btn) return;
    if(r===role){
      btn.style.background = r==='ALL'?'var(--accent)':r==='TANK'?'var(--tank)':r==='HEALER'?'var(--heal)':'var(--dps)';
      btn.style.color = r==='ALL'?'#000':'#fff';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = r==='ALL'?'var(--text-muted)':r==='TANK'?'var(--tank)':r==='HEALER'?'var(--heal)':'var(--dps)';
    }
  });
  renderMembersList();
}

function switchMembersTab(tab){
  _membersTab = tab;
  document.getElementById('members-tab-active').style.borderBottomColor = tab==='active' ? 'var(--accent)' : 'transparent';
  document.getElementById('members-tab-active').style.color = tab==='active' ? 'var(--text)' : 'var(--text-muted)';
  document.getElementById('members-tab-archived').style.borderBottomColor = tab==='archived' ? 'var(--accent)' : 'transparent';
  document.getElementById('members-tab-archived').style.color = tab==='archived' ? 'var(--text)' : 'var(--text-muted)';
  renderMembersList();
}

function showAddMemberForm(){
  document.getElementById('add-member-form').style.display = '';
  document.getElementById('add-member-name').focus();
}

async function addMember(){
  var name = document.getElementById('add-member-name').value.trim();
  var role = document.getElementById('add-member-role').value;
  showError('add-member-error');
  if(!name){ showError('add-member-error','Name required'); return; }
  try{
    var r = await apiPost('/api/roster',{name:name,role:role});
    var data = await r.json();
    if(!r.ok){ showError('add-member-error',data.error||'Failed'); return; }
    document.getElementById('add-member-name').value='';
    hide('add-member-form');
    renderMembersPage();
  }catch(e){ showError('add-member-error',e.message); }
}

async function cycleRole(encodedName, newRole){
  try{
    await apiPatch('/api/roster/'+encodedName,{role:newRole});
    renderMembersPage();
  }catch(e){ Toast.error(e.message); }
}

async function archiveMember(encodedName){
  try{
    await apiPatch('/api/roster/'+encodedName,{active:false});
    renderMembersPage();
  }catch(e){ Toast.error(e.message); }
}

async function restoreMember(encodedName){
  try{
    await apiPatch('/api/roster/'+encodedName,{active:true});
    renderMembersPage();
  }catch(e){ Toast.error(e.message); }
}

async function syncRosterFromScreenshot(input){
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = async function(ev){
    var container = document.getElementById('members-list-container');
    container.innerHTML = '<div style="padding:20px;text-align:center;"><div class="processing"><span class="spin">◌</span> Reading roster from screenshot...</div></div>';
    try{
      var prompt = 'You are reading a screenshot from TL Guild Manager (Throne & Liberty). It shows party cards with player names and colored role bars.\n\nExtract ALL player names and their roles. Role is determined by the LEFT VERTICAL COLOR BAR:\n- Purple/violet bar = TANK\n- Green bar = HEALER\n- Red/brown bar = DPS\n\nReturn ONLY a JSON array, no explanation:\n[{"name":"PlayerName","role":"TANK"},{"name":"AnotherPlayer","role":"HEALER"}]';
      var raw = await callClaude(prompt, ev.target.result);
      var clean = raw.replace(/```json\n?|```/g,'').trim();
      var match = clean.match(/\[[\s\S]*\]/);
      if(match) clean = match[0];
      var extracted = JSON.parse(clean);
      if(!Array.isArray(extracted) || !extracted.length) throw new Error('No members detected');

      // Merge with existing roster
      var existing = {};
      _rosterData.forEach(function(m){ existing[m.name.toLowerCase()] = m; });
      var merged = _rosterData.slice(); // keep existing
      var added = 0;
      extracted.forEach(function(m){
        if(!m.name) return;
        var key = m.name.trim().toLowerCase();
        if(!existing[key]){
          merged.push({name:m.name.trim(), role:m.role||'DPS', guildRole:null, active:true});
          existing[key] = true;
          added++;
        }
      });

      // Save merged roster
      var r = await apiPut('/api/roster',merged);
      if(!r.ok) throw new Error('Failed to save roster');
      container.innerHTML = '<div style="padding:14px;color:var(--heal);font-size:13px;">Synced! '+added+' new members added ('+extracted.length+' detected total).</div>';
      setTimeout(function(){ renderMembersPage(); }, 1500);
    }catch(e){
      container.innerHTML = '<div style="padding:14px;color:var(--dps);font-size:13px;">Sync failed: '+escHtml(e.message)+'</div>';
      setTimeout(function(){ renderMembersPage(); }, 3000);
    }
  };
  reader.readAsDataURL(file);
  input.value = '';
}

// ── CSV IMPORT ──
var _csvMerged = null;

function closeCsvModal(){ Modal.close('csv-modal'); }

function importTlgmCsv(input){
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){
    var text = ev.target.result;
    var lines = text.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    if(lines.length<2){ Toast.warning('CSV is empty'); return; }

    // Parse CSV (skip header)
    var csvMembers = [];
    for(var i=1;i<lines.length;i++){
      var cols = lines[i].split(',');
      if(cols.length<5) continue;
      var name = cols[0].trim();
      var role = (cols[2]||'').trim().toUpperCase();
      var rank = (cols[3]||'').trim();
      var status = (cols[4]||'').trim().toLowerCase();
      if(!name) continue;
      if(!['TANK','HEALER','DPS'].includes(role)) role='DPS';
      var guildRole = null;
      if(/leader/i.test(rank)) guildRole='Leader';
      else if(/advisor/i.test(rank)) guildRole='Advisor';
      csvMembers.push({name:name, role:role, guildRole:guildRole, active:status!=='inactive'});
    }
    if(!csvMembers.length){ Toast.warning('No members found in CSV'); return; }

    // Compare with existing roster
    var existingMap = {};
    _rosterData.forEach(function(m){ existingMap[m.name.toLowerCase()] = m; });
    var csvMap = {};
    csvMembers.forEach(function(m){ csvMap[m.name.toLowerCase()] = m; });

    var newMembers=[], roleChanged=[], reactivated=[], archived=[], unchanged=[];

    // Check CSV members against roster
    csvMembers.forEach(function(cm){
      var key = cm.name.toLowerCase();
      var existing = existingMap[key];
      if(!existing){
        newMembers.push(cm);
      } else if(existing.active===false){
        reactivated.push({name:cm.name, role:cm.role, guildRole:cm.guildRole});
      } else if(existing.role!==cm.role){
        roleChanged.push({name:cm.name, from:existing.role, to:cm.role, guildRole:cm.guildRole});
      } else {
        unchanged.push(cm);
      }
    });

    // Check roster members not in CSV → archive
    _rosterData.forEach(function(m){
      if(m.active===false) return; // already archived
      var key = m.name.toLowerCase();
      if(!csvMap[key]) archived.push(m);
    });

    // Build merged roster
    var merged = [];
    // Keep all existing (update where needed)
    _rosterData.forEach(function(m){
      var key = m.name.toLowerCase();
      var inCsv = csvMap[key];
      if(inCsv){
        // In CSV → active, possibly new role
        merged.push({name:m.name, role:inCsv.role, guildRole:inCsv.guildRole||m.guildRole, active:true});
      } else {
        // Not in CSV → archive if active
        merged.push({name:m.name, role:m.role, guildRole:m.guildRole, active:false});
      }
    });
    // Add new members
    newMembers.forEach(function(m){ merged.push(m); });

    _csvMerged = merged;

    // Show preview
    var html = '';
    if(newMembers.length) html += '<div style="margin-bottom:10px;"><span style="color:var(--heal);font-weight:600;">&#x1F7E2; '+newMembers.length+' new members</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+newMembers.map(function(m){return escHtml(m.name);}).join(', ')+'</div></div>';
    if(archived.length) html += '<div style="margin-bottom:10px;"><span style="color:var(--dps);font-weight:600;">&#x1F534; '+archived.length+' will be archived</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+archived.map(function(m){return escHtml(m.name);}).join(', ')+'</div></div>';
    if(roleChanged.length) html += '<div style="margin-bottom:10px;"><span style="color:var(--accent);font-weight:600;">&#x1F7E1; '+roleChanged.length+' role changes</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+roleChanged.map(function(m){return escHtml(m.name)+' ('+m.from+'→'+m.to+')';}).join(', ')+'</div></div>';
    if(reactivated.length) html += '<div style="margin-bottom:10px;"><span style="color:var(--color-info);font-weight:600;">&#x1F504; '+reactivated.length+' reactivated</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+reactivated.map(function(m){return escHtml(m.name);}).join(', ')+'</div></div>';
    if(!newMembers.length && !archived.length && !roleChanged.length && !reactivated.length) html = '<div style="color:var(--text-muted);">No changes detected — roster is already in sync.</div>';

    var activeCount = merged.filter(function(m){return m.active!==false;}).length;
    var archivedCount = merged.filter(function(m){return m.active===false;}).length;
    html += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);font-size:12px;color:var(--text-muted);">After sync: <b style="color:var(--text);">'+activeCount+' active</b>, '+archivedCount+' archived</div>';

    document.getElementById('csv-preview-content').innerHTML = html;
    Modal.open('csv-modal');
  };
  reader.readAsText(file);
  input.value = '';
}

async function syncTlGameAliases(input){
  var files = Array.from(input.files); if(!files.length) return;
  if(files.length > 10){ Toast.warning('Max 10 screenshots at once.'); input.value=''; return; }
  if(!_rosterData.length){ Toast.warning('Import TLGM CSV first to set up your roster.'); input.value=''; return; }

  var container = document.getElementById('members-list-container');
  container.innerHTML = '<div style="padding:20px;text-align:center;"><div class="processing"><span class="spin">◌</span> Reading in-game names from '+files.length+' screenshot'+(files.length>1?'s':'')+'...</div></div>';

  try{
    // Read all files as dataURLs
    var dataUrls = await Promise.all(files.map(function(f){
      return new Promise(function(resolve,reject){
        var reader = new FileReader();
        reader.onload = function(e){ resolve(e.target.result); };
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
    }));

    // Process each image sequentially, collect all names
    var allGameNames = [];
    var prompt = 'You are reading a screenshot from TL Guild Manager (Throne & Liberty). It shows party cards with player names.\n\nExtract ALL player names visible in the image. Each party card has a header like "Party 1 (Main)" and rows of players.\n\nReturn ONLY a JSON array of unique player names, no duplicates:\n["PlayerName1","PlayerName2","PlayerName3"]';

    for(var i=0; i<dataUrls.length; i++){
      container.innerHTML = '<div style="padding:20px;text-align:center;"><div class="processing"><span class="spin">◌</span> Processing screenshot '+(i+1)+' of '+dataUrls.length+'...</div></div>';
      var raw = await callClaude(prompt, dataUrls[i]);
      var clean = raw.replace(/```json\n?|```/g,'').trim();
      var match = clean.match(/\[[\s\S]*\]/);
      if(match) clean = match[0];
      var names = JSON.parse(clean);
      if(Array.isArray(names)) names.forEach(function(n){ if(n && allGameNames.indexOf(n)===-1) allGameNames.push(n); });
    }

    var gameNames = allGameNames;
    if(!gameNames.length) throw new Error('No names detected in '+dataUrls.length+' screenshots');

      // Auto-match: for each game name, find closest TLGM name
      var rosterNames = _rosterData.filter(function(m){return m.active!==false;}).map(function(m){return m.name;});
      var matches = [];
      var unmatched = [];
      gameNames.forEach(function(gn){
        var gnLower = gn.toLowerCase().trim();
        var exact = rosterNames.find(function(rn){return rn.toLowerCase()===gnLower;});
        if(exact){ matches.push({tlgm:exact,game:gn,type:'exact'}); return; }
        var partial = rosterNames.find(function(rn){
          var rl=rn.toLowerCase();
          return rl.startsWith(gnLower)||gnLower.startsWith(rl)||rl.indexOf(gnLower)!==-1||gnLower.indexOf(rl)!==-1;
        });
        if(partial){ matches.push({tlgm:partial,game:gn,type:'fuzzy'}); return; }
        unmatched.push(gn);
      });

      // Store data for dynamic rendering
      window._pendingAliases = matches;
      window._unmatchedNames = unmatched;
      window._allRosterNames = rosterNames;
      renderAliasSyncPreview();
    }catch(e){
      container.innerHTML = '<div style="padding:14px;color:var(--dps);font-size:13px;">Sync failed: '+escHtml(e.message)+'</div>';
      setTimeout(function(){ renderMembersPage(); },3000);
    }
  input.value='';
}

function renderAliasSyncPreview(){
  var container = document.getElementById('members-list-container');
  var matches = window._pendingAliases || [];
  var unmatched = window._unmatchedNames || [];
  var rosterNames = window._allRosterNames || [];

  // Find which TLGM names are already used (by auto-match or manual selection)
  var usedTlgm = {};
  matches.forEach(function(m){ usedTlgm[m.tlgm.toLowerCase()] = true; });
  document.querySelectorAll('[id^="unmatched-"]').forEach(function(sel){
    if(sel.value) usedTlgm[sel.value.toLowerCase()] = true;
  });

  var typeColors = {exact:'var(--heal)',fuzzy:'var(--accent)',manual:'var(--color-info)'};

  // Header
  var html = '<div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:16px;">Alias Sync Preview</div>';

  // Column headers
  html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border-bottom:1px solid var(--border);">'
    +'<div style="flex:1;">TLGM Name</div>'
    +'<div style="width:20px;"></div>'
    +'<div style="flex:1;">TL Game Name</div>'
    +'<div style="width:50px;text-align:right;">Match</div>'
    +'</div>';

  // Auto-matched rows
  matches.forEach(function(m){
    var c = typeColors[m.type] || 'var(--text-muted)';
    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04);">'
      +'<div style="flex:1;font-size:12px;color:var(--text-muted);">'+escHtml(m.tlgm)+'</div>'
      +'<div style="width:20px;color:var(--text-muted);font-size:10px;text-align:center;">→</div>'
      +'<div style="flex:1;font-size:12px;color:'+c+';font-weight:600;">'+escHtml(m.game)+'</div>'
      +'<div style="width:50px;text-align:right;font-size:9px;color:'+c+';">'+m.type+'</div>'
      +'</div>';
  });

  // Unmatched rows with dynamic dropdowns
  if(unmatched.length){
    html += '<div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border);">';
    html += '<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;padding:0 12px;">'+unmatched.length+' unmatched — select TLGM member or skip</div>';
    unmatched.forEach(function(gn, idx){
      var available = rosterNames.filter(function(rn){ return !usedTlgm[rn.toLowerCase()]; });
      var currentVal = '';
      var existingSel = document.getElementById('unmatched-'+idx);
      if(existingSel) currentVal = existingSel.value;

      var opts = '<option value="">— Select —</option>';
      available.forEach(function(rn){
        var sel = (rn === currentVal) ? ' selected' : '';
        opts += '<option value="'+escHtml(rn)+'"'+sel+'>'+escHtml(rn)+'</option>';
      });
      // If currentVal is set but not in available (already used elsewhere), still show it selected
      if(currentVal && available.indexOf(currentVal)===-1){
        opts += '<option value="'+escHtml(currentVal)+'" selected>'+escHtml(currentVal)+'</option>';
      }

      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid rgba(255,255,255,.04);">'
        +'<select id="unmatched-'+idx+'" data-game="'+escHtml(gn)+'" onchange="renderAliasSyncPreview()" style="flex:1;background:var(--bg-hover);border:1px solid var(--border-default);border-radius:4px;padding:5px 8px;color:var(--text);font-size:12px;">'+opts+'</select>'
        +'<div style="width:20px;color:var(--text-muted);font-size:10px;text-align:center;">→</div>'
        +'<div style="flex:1;font-size:12px;color:var(--accent);font-weight:600;">'+escHtml(gn)+'</div>'
        +'<div style="width:50px;text-align:right;"><button onclick="this.closest(\'div\').parentElement.style.display=\'none\'" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:10px;">Skip</button></div>'
        +'</div>';
    });
    html += '</div>';
  }

  // Summary + buttons
  var manualCount = 0;
  document.querySelectorAll('[id^="unmatched-"]').forEach(function(s){ if(s.value) manualCount++; });
  var totalAliases = matches.length + manualCount;

  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">'
    +'<div style="font-size:12px;color:var(--text-muted);">'+totalAliases+' aliases total ('+matches.length+' auto + '+manualCount+' manual)</div>'
    +'<div style="display:flex;gap:8px;">'
      +'<button onclick="applyAliasSync()" class="btn btn-primary" style="padding:8px 20px;font-size:13px;">Apply '+totalAliases+' Aliases</button>'
      +'<button onclick="renderMembersPage()" class="btn btn-secondary" style="padding:8px 16px;font-size:13px;">Cancel</button>'
    +'</div>'
    +'</div>';

  container.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px;">'+html+'</div>';
}

async function clearAllMembersAndAliases(){
  if(!confirm('Șterge toți membrii și alias-urile? Vei putea reface procesul de import.')) return;
  try{
    await apiPut('/api/roster',[]);
    await apiPut('/api/aliases/member',{});
    renderMembersPage();
  }catch(e){ Toast.error(e.message); }
}

function refreshUnmatchedDropdowns(){
  // Get all currently selected values
  var selected = {};
  document.querySelectorAll('[id^="dropdown-"]').forEach(function(sel){
    if(sel.value) selected[sel.value.toLowerCase()] = sel.id;
  });
  // Get base pool
  var usedAliasValues = {};
  Object.values(_memberAliases).forEach(function(v){ usedAliasValues[v.toLowerCase()] = true; });
  var sources = window._unmatchedGameNames || window._unmatchedNames || [];
  var basePool = sources.filter(function(gn){ return !usedAliasValues[gn.toLowerCase()]; });

  // Rebuild each dropdown excluding other dropdowns' selections
  document.querySelectorAll('[id^="dropdown-"]').forEach(function(sel){
    var currentVal = sel.value;
    var available = basePool.filter(function(gn){
      var key = gn.toLowerCase();
      // Keep if: not selected by another dropdown, OR is this dropdown's current value
      return !selected[key] || selected[key] === sel.id;
    });
    available.sort(function(a,b){ return a.localeCompare(b); });
    var opts = '<option value="">-- Select --</option>';
    available.forEach(function(gn){
      opts += '<option value="'+escHtml(gn)+'"'+(gn===currentVal?' selected':'')+'>'+escHtml(gn)+'</option>';
    });
    sel.innerHTML = opts;
  });
}

async function saveAllUnmatched(){
  var aliases = Object.assign({}, _memberAliases);
  var count = 0;
  document.querySelectorAll('[id^="manual-"]').forEach(function(input){
    var encodedName = input.id.replace('manual-','');
    var name = decodeURIComponent(encodedName);
    var gameName = input.value.trim();
    if(!gameName) return;
    var key = name.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
    aliases[key] = gameName;
    count++;
  });
  if(!count){ Toast.warning('No names to save'); return; }
  try{
    var r = await apiPut('/api/aliases/member',aliases);
    if(!r.ok) throw new Error('Failed');
    _memberAliases = aliases;
    // Update game names pool
    if(window._unmatchedGameNames){
      Object.values(aliases).forEach(function(v){
        window._unmatchedGameNames = window._unmatchedGameNames.filter(function(gn){ return gn.toLowerCase()!==v.toLowerCase(); });
      });
    }
    renderMembersList();
  }catch(e){ Toast.error(e.message); }
}

function saveUnmatchedMember(encodedName){
  var name = decodeURIComponent(encodedName);
  var manualInput = document.getElementById('manual-'+encodedName);
  var gameName = manualInput ? manualInput.value.trim() : '';
  if(!gameName){ Toast.warning('Enter an in-game name'); return; }
  var key = name.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
  var aliases = Object.assign({}, _memberAliases);
  aliases[key] = gameName;
  // Remove used game name from available pool
  if(window._unmatchedGameNames){
    window._unmatchedGameNames = window._unmatchedGameNames.filter(function(gn){ return gn.toLowerCase() !== gameName.toLowerCase(); });
  }
  apiPut('/api/aliases/member',aliases)
    .then(function(r){ if(r.ok){ _memberAliases = aliases; renderMembersList(); } else Toast.error('Failed'); })
    .catch(function(e){ Toast.error(e.message); });
}

// ── MEMBER PROFILE ──
function closeMemberProfile(){ Modal.close('member-profile-modal'); }

function openMemberProfile(encodedName){
  var name = decodeURIComponent(encodedName);
  var member = _rosterData.find(function(m){ return m.name === name; });
  // If not in roster, create from war data
  if(!member){
    var wp = (window._membersPlayers || []).find(function(p){ return p.name === name; });
    member = {name: name, role: 'DPS', guildRole: null};
    if(wp) member.wars = wp.wars;
  }

  var aliasKey = normalizeName(name);
  var alias = _memberAliases[aliasKey] || '';
  // Also check all aliases for this player (reverse lookup)
  if(!alias){
    var aKeys = Object.keys(_memberAliases);
    for(var ai = 0; ai < aKeys.length; ai++){
      if(normalizeName(_memberAliases[aKeys[ai]]) === normalizeName(name)){
        alias = _memberAliases[aKeys[ai]]; break;
      }
    }
  }
  var color = roleHex(member.role);

  // Collect all name variants for matching
  var searchNames = [name];
  if(alias) searchNames.push(alias);
  // Add variants from _membersPlayers
  var wp = (window._membersPlayers || []).find(function(pp){ return pp.name === name; });
  if(wp && wp.variants) wp.variants.forEach(function(v){ if(searchNames.indexOf(v) === -1) searchNames.push(v); });

  // Find all wars this member participated in
  var wars = _warsCache || [];
  var warHistory = [];
  var totalK=0,totalA=0,totalDmg=0,totalTkn=0,totalHeal=0;

  function matchesPlayer(mName){
    for(var si = 0; si < searchNames.length; si++){
      if(namesMatch(mName, searchNames[si])) return true;
      if(typeof similarityScore === 'function' && similarityScore(mName, searchNames[si]) > 65) return true;
    }
    return false;
  }

  wars.forEach(function(w){
    if(!w.parties) return;
    var found = null;
    var partyName = '';
    w.parties.forEach(function(p){
      if(isExtrasParty(p)) return;
      p.members.forEach(function(m){
        if(matchesPlayer(m.name)){
          found = m; partyName = p.name;
        }
      });
    });
    // Also check extras
    if(!found){
      var extras = getExtrasParty(w);
      if(extras) extras.members.forEach(function(m){
        if(matchesPlayer(m.name)){
          found = m; partyName = 'Extra';
        }
      });
    }
    if(found){
      totalK += found.defeat||0;
      totalA += found.assist||0;
      totalDmg += found.dmg_dealt||0;
      totalTkn += found.dmg_taken||0;
      totalHeal += found.healed||0;
      warHistory.push({date:w.date, opponent:w.opponent, party:partyName, warId:w.id,
        k:found.defeat||0, a:found.assist||0, dmg:found.dmg_dealt||0, heal:found.healed||0});
    }
  });

  var warCount = warHistory.length;

  // Header
  document.getElementById('mp-header').innerHTML =
    '<div style="display:flex;align-items:center;gap:12px;">'
      +'<div style="width:48px;height:48px;border-radius:50%;background:'+color+'22;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:'+color+';">'+name.charAt(0).toUpperCase()+'</div>'
      +'<div>'
        +'<div style="font-size:18px;font-weight:700;color:var(--text);">'+escHtml(name)+'</div>'
        +(alias?'<div style="font-size:12px;color:var(--accent);margin-top:2px;">In-game: '+escHtml(alias)+'</div>':'')
        +'<div style="display:flex;gap:6px;margin-top:4px;">'
          +'<span class="badge badge-' + (member.role === 'TANK' ? 'tank' : member.role === 'HEALER' ? 'heal' : 'dps') + '">'+(member.role==='HEALER'?'HEAL':member.role)+'</span>'
          +(member.guildRole?'<span class="badge badge-viewer">'+escHtml(member.guildRole)+'</span>':'')
          +'<span style="font-size:10px;color:var(--text-muted);">'+warCount+' wars</span>'
        +'</div>'
      +'</div>'
    +'</div>';

  // Stats cards
  var avgK = warCount ? Math.round(totalK/warCount) : 0;
  var avgA = warCount ? Math.round(totalA/warCount) : 0;
  var avgDmg = warCount ? Math.round(totalDmg/warCount) : 0;
  var avgHeal = warCount ? Math.round(totalHeal/warCount) : 0;

  document.getElementById('mp-stats').innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;">'
      +'<div style="background:var(--bg-hover);border-radius:8px;padding:12px;text-align:center;">'
        +'<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Total Kills</div>'
        +'<div style="font-size:22px;font-weight:700;color:var(--dps);">'+totalK+'</div>'
        +'<div style="font-size:10px;color:var(--text-muted);">avg '+avgK+'/war</div>'
      +'</div>'
      +'<div style="background:var(--bg-hover);border-radius:8px;padding:12px;text-align:center;">'
        +'<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Total Assists</div>'
        +'<div style="font-size:22px;font-weight:700;color:var(--text-muted);">'+totalA+'</div>'
        +'<div style="font-size:10px;color:var(--text-muted);">avg '+avgA+'/war</div>'
      +'</div>'
      +'<div style="background:var(--bg-hover);border-radius:8px;padding:12px;text-align:center;">'
        +'<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Damage Dealt</div>'
        +'<div style="font-size:22px;font-weight:700;color:var(--accent);">'+fmtShort(totalDmg)+'</div>'
        +'<div style="font-size:10px;color:var(--text-muted);">avg '+fmtShort(avgDmg)+'/war</div>'
      +'</div>'
      +'<div style="background:var(--bg-hover);border-radius:8px;padding:12px;text-align:center;">'
        +'<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Healed</div>'
        +'<div style="font-size:22px;font-weight:700;color:var(--heal);">'+fmtShort(totalHeal)+'</div>'
        +'<div style="font-size:10px;color:var(--text-muted);">avg '+fmtShort(avgHeal)+'/war</div>'
      +'</div>'
    +'</div>';

  // Performance indicators
  if(warCount >= 2){
    var trend = 'stable';
    var trendColor = 'var(--accent)';
    if(warHistory.length >= 5){
      var recent5 = warHistory.slice(0,5); // already sorted newest first? No, let's sort
      var sorted = warHistory.slice().sort(function(a,b){ return 0; }); // keep order (added chronologically)
      var last5 = warHistory.slice(-5);
      var recentAvg = last5.reduce(function(s,w){return s+w.dmg;},0)/5;
      var overallAvg = totalDmg/warCount;
      if(recentAvg > overallAvg*1.1){ trend='improving ↑'; trendColor='var(--heal)'; }
      else if(recentAvg < overallAvg*0.9){ trend='declining ↓'; trendColor='var(--dps)'; }
      else { trend='stable →'; trendColor='var(--accent)'; }
    }
    var bestWar = warHistory.slice().sort(function(a,b){return(b.k+b.dmg)-(a.k+a.dmg);})[0];
    document.getElementById('mp-stats').innerHTML += '<div style="display:flex;gap:20px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);font-size:12px;">'
      +'<div><span style="color:var(--text-muted);">Trend: </span><span style="color:'+trendColor+';font-weight:600;">'+trend+'</span></div>'
      +(bestWar?'<div><span style="color:var(--text-muted);">Best War: </span><span style="color:var(--text);font-weight:600;">vs '+escHtml(bestWar.opponent)+' ('+bestWar.k+'K, '+fmtShort(bestWar.dmg)+' DMG)</span></div>':'')
      +'</div>';
  }

  // War history table
  var warsHtml = '';
  if(warHistory.length){
    warsHtml = '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">War History</div>';
    warsHtml += '<div style="background:var(--bg-hover);border-radius:8px;overflow:hidden;">';
    warsHtml += '<div style="display:flex;padding:6px 10px;font-size:10px;text-transform:uppercase;color:var(--text-muted);border-bottom:1px solid var(--border);">'
      +'<div style="width:80px;">Date</div><div style="flex:1;">Opponent</div><div style="width:70px;">Party</div>'
      +'<div style="width:40px;text-align:right;">K</div><div style="width:40px;text-align:right;">A</div>'
      +'<div style="width:60px;text-align:right;">DMG</div><div style="width:60px;text-align:right;">HEAL</div>'
      +'</div>';
    warHistory.forEach(function(wh){
      warsHtml += '<div onclick="closeMemberProfile();viewWar('+wh.warId+')" style="display:flex;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;font-size:12px;" title="View war">'
        +'<div style="width:80px;color:var(--text-muted);">'+escHtml(wh.date)+'</div>'
        +'<div style="flex:1;color:var(--text);font-weight:600;">vs '+escHtml(wh.opponent)+'</div>'
        +'<div style="width:70px;color:var(--text-muted);">'+escHtml(wh.party)+'</div>'
        +'<div style="width:40px;text-align:right;color:var(--dps);">'+wh.k+'</div>'
        +'<div style="width:40px;text-align:right;">'+wh.a+'</div>'
        +'<div style="width:60px;text-align:right;color:var(--accent);">'+fmtShort(wh.dmg)+'</div>'
        +'<div style="width:60px;text-align:right;color:var(--heal);">'+fmtShort(wh.heal)+'</div>'
        +'</div>';
    });
    warsHtml += '</div>';
  } else {
    warsHtml = EmptyState.inline('No war participation recorded');
  }
  document.getElementById('mp-wars').innerHTML = warsHtml;

  Modal.open('member-profile-modal');
}

function renameMember(encodedName){
  var oldName = decodeURIComponent(encodedName);
  var input = document.getElementById('tlgm-'+encodedName);
  if(!input) return;
  var newName = input.value.trim();
  if(!newName || newName === oldName){ input.style.borderColor=''; return; }
  apiPatch('/api/roster/'+encodedName,{name:newName})
    .then(function(r){ if(r.ok){ input.style.borderColor='var(--heal)'; setTimeout(function(){ renderMembersPage(); },500); } else Toast.error('Failed to rename'); })
    .catch(function(e){ Toast.error(e.message); });
}

function saveInlineAlias(encodedName){
  var name = decodeURIComponent(encodedName);
  var input = document.getElementById('alias-'+encodedName);
  if(!input) return;
  var newAlias = input.value.trim();
  var key = name.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
  var aliases = Object.assign({}, _memberAliases);
  if(newAlias) aliases[key] = newAlias;
  else delete aliases[key];
  apiPut('/api/aliases/member',aliases)
    .then(function(r){ if(r.ok){ _memberAliases = aliases; input.style.borderColor='var(--heal)'; setTimeout(function(){input.style.borderColor='';},800); } else Toast.error('Failed'); })
    .catch(function(e){ Toast.error(e.message); });
}

function skipUnmatched(btn){
  btn.closest('div').style.display='none';
}

async function applyAliasSync(){
  var aliases = Object.assign({}, _memberAliases);
  // Auto-matched
  if(window._pendingAliases){
    window._pendingAliases.forEach(function(m){
      var key = m.tlgm.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
      aliases[key] = m.game;
    });
  }
  // Manually matched from dropdowns
  document.querySelectorAll('[id^="unmatched-"]').forEach(function(sel){
    var tlgm = sel.value;
    var game = sel.getAttribute('data-game');
    if(tlgm && game){
      var key = tlgm.toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
      aliases[key] = game;
    }
  });
  // Store unmatched game names for dropdown use in Members page
  var remainingGameNames = [];
  document.querySelectorAll('[id^="unmatched-"]').forEach(function(sel){
    if(!sel.value){
      var game = sel.getAttribute('data-game');
      if(game) remainingGameNames.push(game);
    }
  });
  window._unmatchedGameNames = remainingGameNames;

  try{
    // Save aliases only (do NOT add unmatched game names to roster)
    var r = await apiPut('/api/aliases/member',aliases);
    if(!r.ok) throw new Error('Failed to save aliases');

    window._pendingAliases = null;
    renderMembersPage();
  }catch(e){ Toast.error(e.message); }
}

async function applyCsvImport(){
  if(!_csvMerged||!_csvMerged.length) return;
  try{
    var r = await apiPut('/api/roster',_csvMerged);
    if(!r.ok) throw new Error('Failed to save');
    closeCsvModal();
    renderMembersPage();
  }catch(e){ Toast.error(e.message); }
}

