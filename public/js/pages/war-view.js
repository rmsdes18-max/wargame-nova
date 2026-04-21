// ── WARS LIST ─────────────────────────────────────────────────────────────
function renderWarsList(){
  var wars = loadWars();
  var el = document.getElementById('wars-list');
  if(!wars.length){
    var isEditor = _userRole === 'admin' || _userRole === 'editor';
    el.className = '';
    el.innerHTML = EmptyState({
      icon: '⚔', title: 'No wars recorded yet',
      description: 'Upload a party screenshot to start tracking your guild wars and stats.',
      buttonText: isEditor ? '+ Add First War' : '', buttonAction: 'startNewWar()',
      padding: '80px 20px'
    });
    return;
  }
  // Count members + stats per war
  var partyDotColors = PARTY_DOT_COLORS;
  el.className = 'war-timeline';
  el.innerHTML = wars.map(function(w,i){
    var totalMembers = 0, totalParties = 0;
    var totalK=0, totalA=0, totalDmg=0, totalHeal=0;
    if(w.parties) w.parties.forEach(function(p){
      if(!isExtrasParty(p)){
        totalParties++;
        p.members.forEach(function(m){
          totalMembers++;
          totalK   += m.defeat||0;
          totalA   += m.assist||0;
          totalDmg += m.dmg_dealt||0;
          totalHeal+= m.healed||0;
        });
      }
    });

    var partyDotsHtml = '';
    if(w.parties){
      partyDotsHtml = '<div class="war-card-parties">';
      var dotIdx = 0;
      w.parties.forEach(function(p){
        if(!isExtrasParty(p)){
          partyDotsHtml += '<div class="war-card-party-dot" style="background:'+partyDotColors[dotIdx % partyDotColors.length]+';"></div>';
          dotIdx++;
        }
      });
      partyDotsHtml += '</div>';
    }

    return '<div class="war-timeline-item">'
      +'<div class="war-timeline-date">'+escHtml(w.date)+'</div>'
      +'<div class="inner-card war-card" onclick="viewWar('+w.id+')">'
      +'<div class="war-card-header">'
        +'<span class="war-card-title">vs '+escHtml(w.opponent)+'</span>'
      +'</div>'
      +'<div class="war-card-stats">'
        +'<div class="war-card-stat"><span class="war-card-stat-label">Kills</span><span class="war-card-stat-value">'+totalK+'</span></div>'
        +'<div class="war-card-stat"><span class="war-card-stat-label">Assists</span><span class="war-card-stat-value">'+totalA+'</span></div>'
        +'<div class="war-card-stat"><span class="war-card-stat-label">Dmg Dealt</span><span class="war-card-stat-value">'+fmtShort(totalDmg)+'</span></div>'
        +'<div class="war-card-stat"><span class="war-card-stat-label">Healed</span><span class="war-card-stat-value">'+fmtShort(totalHeal)+'</span></div>'
      +'</div>'
      +partyDotsHtml
      +'</div>'
      +'</div>';
  }).join('');
}


async function confirmDeleteWar(warId){
  try{
    console.log('[DELETE] warId:', warId, 'guildId:', _currentGuildId);
    var r = await apiDelete('/api/wars/'+warId);
    if(!r.ok){
      var errBody = await r.text().catch(function(){return '';});
      console.error('[DELETE] Error:', r.status, errBody);
      throw new Error('HTTP '+r.status+' — '+(errBody||'unknown'));
    }
    if(_warsCache!==null) _warsCache = _warsCache.filter(function(w){ return String(w.id)!==String(warId); });
  } catch(e){ Toast.error('Eroare la ștergere: '+e.message); return; }
  showPage('wars');
}

var _vwEditMode = false;
var _vwWarId = null;
var _isPublicView = false;
var _publicWarData = null;

function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// roleColor(), roleClass() moved to js/utils/party-helpers.js
function getWar(warId){ var wars=loadWars(); return wars.find(function(x){return x.id===warId;}); }

function editableCell(cls, val, warId, pi, mi, field){
  return '<td class="num '+cls+'"><span class="editable-val" data-war="'+warId+'" data-pi="'+pi+'" data-mi="'+mi+'" data-field="'+field+'" onclick="makeEditable(this)" style="cursor:pointer;">'+val+'</span></td>';
}

function makeEditable(span){
  var val = span.textContent.replace(/,/g,'');
  var input = document.createElement('input');
  input.type = 'number';
  input.value = parseInt(val)||0;
  input.style.cssText = 'width:80px;background:var(--bg-tertiary);border:1px solid var(--accent-primary);border-radius:4px;color:var(--text-primary);font-size:13px;font-family:JetBrains Mono,monospace;text-align:right;padding:2px 6px;outline:none;';
  input.onblur = function(){
    var newVal = +input.value || 0;
    var warId = +span.dataset.war;
    var pi = +span.dataset.pi;
    var mi = +span.dataset.mi;
    var field = span.dataset.field;
    var w = getWar(warId);
    if(w && w.parties[pi] && w.parties[pi].members[mi]){
      w.parties[pi].members[mi][field] = newVal;
    }
    span.textContent = newVal ? newVal.toLocaleString() : '0';
    input.replaceWith(span);
  };
  input.onkeydown = function(e){ if(e.key==='Enter') input.blur(); };
  span.replaceWith(input);
  input.focus();
  input.select();
}

function viewWar(warId){
  _vwWarId = warId;
  var w;
  if(_isPublicView && _publicWarData){
    w = _publicWarData;
    _vwEditMode = false;
  } else {
    var wars = loadWars();
    w = wars.find(function(x){ return x.id===warId; });
  }
  if(!w) return;

  // Compute aggregates from parties
  var totalDefeats=0, totalAssists=0, totalDmg=0, totalTaken=0, totalHealed=0;
  var allMembers = [];
  w.parties.forEach(function(p){ if(p._isExtras||p.name==='_Extras') return; p.members.forEach(function(m){
    totalDefeats += m.defeat||0;
    totalAssists += m.assist||0;
    totalDmg     += m.dmg_dealt||0;
    totalTaken   += m.dmg_taken||0;
    totalHealed  += m.healed||0;
    allMembers.push(m);
  }); });

  // ── War header ──
  var guildName = _isPublicView ? (w.guild_name || '') : _currentGuildName;
  var html = '<div class="war-header">';
  html += '<div class="war-title">';
  if(!_isPublicView && _vwEditMode){
    html += '<h2>'+escHtml(guildName)+' vs <span contenteditable="true" style="outline:none;border-bottom:1px dashed var(--accent);cursor:text;" onblur="document.getElementById(\'edit-opponent\').value=this.textContent.trim()">'+escHtml(w.opponent)+'</span></h2>';
    html += '<span class="date" contenteditable="true" style="outline:none;border-bottom:1px dashed var(--accent);cursor:text;" onblur="document.getElementById(\'edit-date\').value=this.textContent.trim()">'+escHtml(w.date)+'</span>';
  } else {
    html += '<h2>'+escHtml(guildName)+' vs '+escHtml(w.opponent)+'</h2>';
    html += '<span class="date">'+escHtml(w.date)+'</span>';
  }
  html += '</div>';
  html += '<div class="war-actions">';
  if(_isPublicView){
    html += '<a href="/api/auth/discord" class="btn btn-primary">Login with Discord</a>';
  } else {
    html += '<input id="edit-opponent" type="hidden" value="'+escHtml(w.opponent)+'">';
    html += '<input id="edit-date" type="hidden" value="'+escHtml(w.date)+'">';
    html += '<button class="btn btn-secondary" onclick="addToCompare('+w.id+')">&#x2261; Compare</button>';
    html += '<button class="btn btn-secondary" onclick="shareWar('+w.id+')">&#x1F517; Share</button>';
    html += '<button class="btn btn-secondary" onclick="exportWarImage()">&#x1F4F8; Export</button>';
    if(_vwEditMode){
      html += '<button class="btn btn-secondary" onclick="cancelEditMode()">Cancel</button>';
      if(_userRole === 'admin' || _userRole === 'editor'){
        html += '<button class="btn btn-danger" onclick="if(confirm(\'Delete this war?\'))confirmDeleteWar('+w.id+')">Delete</button>';
      }
      html += '<button class="btn btn-primary" onclick="saveWarEdits('+w.id+')">Save</button>';
    } else {
      if(_userRole === 'admin' || _userRole === 'editor'){
        html += '<button class="btn btn-secondary" onclick="enterEditMode('+w.id+')">&#x270E; Edit</button>';
      }
    }
  }
  html += '</div>';
  html += '</div>';

  // ── Stat cards ──
  html += StatsRow(
    { defeat: totalDefeats, assist: totalAssists, dmg_dealt: totalDmg, dmg_taken: totalTaken, healed: totalHealed },
    { emptyText: '—' }
  );

  // ── Tabs ──
  html += '<div class="tabs">';
  html += '<div class="tab active" onclick="showVwTab(\'parties\',this)">Parties</div>';
  html += '<div class="tab" onclick="showVwTab(\'leaderboard\',this)">Leaderboard</div>';
  html += '</div>';

  var partyDotColorsVw = PARTY_DOT_COLORS;

  // ── Extras data ──
  var extrasParty = getExtrasParty(w);
  var extrasMembers = extrasParty ? extrasParty.members : [];

  // ── Parties tab ──
  var hasExtras = extrasMembers && extrasMembers.length > 0;
  html += '<div id="vw-tab-parties" style="display:grid;grid-template-columns:'+(hasExtras?'1fr 280px':'1fr')+';gap:16px;">';
  html += '<div class="parties-grid"><div id="vw-parties-grid" style="display:contents;">';

  w.parties.forEach(function(p, pi){
    if(isExtrasParty(p)) return;
    var pKills=0, pAssists=0, pDmg=0, pTaken=0, pHealed=0;
    p.members.forEach(function(m){ pKills+=m.defeat||0; pAssists+=m.assist||0; pDmg+=m.dmg_dealt||0; pTaken+=m.dmg_taken||0; pHealed+=m.healed||0; });
    var dotColor = partyDotColorsVw[pi % partyDotColorsVw.length];

    html += '<div class="inner-card party-card" data-pi="'+pi+'">';
    html += '<div class="party-card-header">';
    if(_vwEditMode){
      html += '<div class="party-card-name"><span contenteditable="true" data-pi="'+pi+'" style="outline:none;cursor:text;" onblur="updatePartyNameInWar('+w.id+','+pi+',this.textContent)">'+escHtml(p.name)+'</span></div>';
    } else {
      html += '<div class="party-card-name">'+p.members.length+' members</div>';
    }
    html += '<div class="party-meta">'
      +(_vwEditMode ? ' <button onclick="deletePartyFromWar('+w.id+','+pi+')" style="background:transparent;border:none;color:var(--dps);cursor:pointer;font-size:11px;margin-left:8px;" title="Delete party">\u2715 Delete</button>' : '')
      +'</div>';
    html += '</div>';

    html += '<div style="overflow-x:auto;">';
    html += '<table class="data-table">';
    html += '<thead><tr>'
      +'<th style="width:28%;">Player</th>'
      +'<th class="num">K</th><th class="num">A</th>'
      +'<th class="num">DMG</th><th class="num">TAKEN</th><th class="num">HEAL</th>'
      +(_vwEditMode?'<th class="action-cell"></th>':'')
      +'</tr></thead>';
    html += '<tbody data-pi="'+pi+'" class="vw-party-body">';

    p.members.forEach(function(m, mi){
      // Auto-detect role from roster if not set
      var memberRole = m.role || 'DPS';
      if(!m.role && _rosterCache){
        var rMatch = _rosterCache.find(function(r){ return namesMatch(r.name, m.name); });
        if(!rMatch){
          for(var ak in _memberAliases){
            if(namesMatch(_memberAliases[ak], m.name)){
              rMatch = _rosterCache.find(function(r){ return normalizeName(r.name)===ak; });
              if(rMatch) break;
            }
          }
        }
        if(rMatch) memberRole = rMatch.role;
      }
      var rc = roleColor(memberRole);
      var nc = roleClass(memberRole);
      var roleLabel = memberRole==='TANK'?'TANK':memberRole==='HEALER'?'HEAL':'DPS';
      var badgeCls = memberRole === 'TANK' ? 'tank' : memberRole === 'HEALER' ? 'heal' : 'dps';
      var isDimmed = !(m.defeat||m.assist||m.dmg_dealt);

      html += '<tr class="vw-row'+(isDimmed?' player-dimmed':'')+'" draggable="'+(_vwEditMode?'true':'false')+'" data-pi="'+pi+'" data-mi="'+mi+'" data-is-missing="'+(isDimmed?'1':'0')+'">';

      // Player name cell with rank number
      html += '<td>';
      html += '<div class="player-cell">';
      var rankNum = mi + 1;
      html += '<span style="color:var(--text-muted);font-size:11px;min-width:20px;text-align:right;margin-right:6px;">' + rankNum + '</span>';
      if(_vwEditMode){
        html += '<span class="player-name" style="color:var(--text);outline:none;cursor:text;" contenteditable="true" data-pi="'+pi+'" data-mi="'+mi+'" onblur="updatePlayerNameInWar('+w.id+','+pi+','+mi+',this.textContent)">'+escHtml(m.name)+'</span>';
      } else {
        html += '<span class="player-name" style="color:var(--text);">'+escHtml(m.name)+'</span>';
      }
      html += '</div></td>';

      // Stat cells
      if(_vwEditMode){
        html += editableCell('num-k', (m.defeat||0), w.id, pi, mi, 'defeat');
        html += editableCell('', (m.assist||0), w.id, pi, mi, 'assist');
        html += editableCell('num-dmg', fmtFull(m.dmg_dealt), w.id, pi, mi, 'dmg_dealt');
        html += editableCell('num-taken', fmtFull(m.dmg_taken), w.id, pi, mi, 'dmg_taken');
        html += editableCell('num-heal', fmtFull(m.healed), w.id, pi, mi, 'healed');
        html += '<td class="action-cell"><button class="btn-icon" onclick="removeWarMember('+w.id+','+pi+','+mi+')">×</button></td>';
      } else {
        html += '<td class="num num-k">'+(m.defeat||0)+'</td>';
        html += '<td class="num">'+(m.assist||0)+'</td>';
        html += '<td class="num num-dmg">'+fmtFull(m.dmg_dealt)+'</td>';
        html += '<td class="num num-taken">'+fmtFull(m.dmg_taken)+'</td>';
        html += '<td class="num num-heal">'+fmtFull(m.healed)+'</td>';
      }

      html += '</tr>';
    });

    // Total row
    html += '</tbody><tbody><tr class="total-row">'
      +'<td>Total</td>'
      +'<td class="num num-k">'+pKills+'</td>'
      +'<td class="num">'+pAssists+'</td>'
      +'<td class="num num-dmg">'+pDmg.toLocaleString()+'</td>'
      +'<td class="num num-taken">'+pTaken.toLocaleString()+'</td>'
      +'<td class="num num-heal">'+pHealed.toLocaleString()+'</td>'
      +(_vwEditMode?'<td></td>':'')+'</tr></tbody>';

    html += '</table>';
    html += '</div>';

    html += '</div>';
  });

  html += '</div>'; // vw-parties-grid
  html += '</div>'; // parties-grid

  // ── Extras panel ──
  if(hasExtras){
    html += '<div class="extras-panel">';
    html += '<div class="extras-panel-header">Extra Players'+(extrasMembers.length?' ('+extrasMembers.length+')':'')+'</div>';
    extrasMembers.forEach(function(ex, ei){
      // Try to find role from roster (by name or alias)
      var extraRole = ex.role || 'DPS';
      if(_rosterCache){
        var rosterMatch = _rosterCache.find(function(r){ return namesMatch(r.name, ex.name); });
        if(!rosterMatch){
          // Try alias reverse lookup
          for(var ak in _memberAliases){
            if(namesMatch(_memberAliases[ak], ex.name)){
              rosterMatch = _rosterCache.find(function(r){ return normalizeName(r.name) === ak; });
              if(rosterMatch) break;
            }
          }
        }
        if(rosterMatch) extraRole = rosterMatch.role || extraRole;
      }
      var extraSafeName = encodeURIComponent(ex.name);
      html += '<div class="extra-player-card" draggable="true" data-extra-idx="'+ei+'">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">'
          +'<span class="dot" style="background:'+roleColor(extraRole)+';cursor:pointer;" onclick="cycleExtraRole('+JSON.stringify(w.id)+','+ei+')" title="Click to change role"></span>'
          +'<span style="font-weight:600;color:var(--text);font-size:13px;">'+escHtml(ex.name)+'</span>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:11px;">'
          +'<div><span style="color:var(--text-muted);">K</span> <span style="color:var(--dps);">'+(ex.defeat||0)+'</span></div>'
          +'<div><span style="color:var(--text-muted);">A</span> <span>'+(ex.assist||0)+'</span></div>'
          +'<div><span style="color:var(--text-muted);">DMG</span> <span style="color:var(--color-assists);">'+fmtFull(ex.dmg_dealt)+'</span></div>'
          +'<div><span style="color:var(--text-muted);">TKN</span> <span style="color:var(--color-dmg-taken);">'+fmtFull(ex.dmg_taken)+'</span></div>'
          +'<div><span style="color:var(--text-muted);">HEAL</span> <span style="color:var(--heal);">'+fmtFull(ex.healed)+'</span></div>'
        +'</div>'
        +'</div>';
    });
    html += '</div>'; // extras-panel
  }

  html += '</div>'; // vw-tab-parties

  // ── Leaderboard tab (hidden) ──
  var topByKills = allMembers.slice().sort(function(a,b){return (b.defeat||0)-(a.defeat||0);}).slice(0,5);
  var topByHeal = allMembers.slice().sort(function(a,b){return (b.healed||0)-(a.healed||0);}).slice(0,5);
  var topByDmg = allMembers.slice().sort(function(a,b){return (b.dmg_dealt||0)-(a.dmg_dealt||0);}).slice(0,5);
  html += '<div id="vw-tab-leaderboard" style="display:none;">';
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">';
  function renderPodium(title, list, statKey, statColor){
    var h = '<div class="inner-card party-card"><div class="party-card-header" style="border-bottom:1px solid var(--border);"><div class="party-card-name" style="font-size:13px;">'+title+'</div></div>';
    h += '<div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;">';
    var medals = ['var(--accent-primary)','#b0b0b0','#a07030','var(--text-secondary)','var(--text-muted)'];
    list.forEach(function(m,idx){
      var val = m[statKey]||0;
      h += '<div style="display:flex;align-items:center;gap:10px;">'
        +'<span style="font-size:'+(idx===0?'18':'16')+'px;font-weight:'+(idx===0?'800':'700')+';color:'+medals[idx]+';width:24px;">'+(idx+1)+'</span>'
        +'<div style="flex:1;"><div style="font-weight:600;color:'+(idx===0?'var(--text)':'var(--text-primary)')+';font-size:13px;">'+escHtml(m.name)+'</div>'
        +'<div style="font-family:JetBrains Mono,monospace;font-size:12px;color:'+(statColor||'var(--text-secondary)')+';">'+val.toLocaleString()+'</div></div>'
        +'<span class="dot" style="background:'+roleColor(m.role)+';width:8px;height:8px;border-radius:50%;"></span>'
        +'</div>';
    });
    h += '</div></div>';
    return h;
  }
  html += renderPodium('Top Damage', topByDmg, 'dmg_dealt', 'var(--color-assists)');
  html += renderPodium('Top Healed', topByHeal, 'healed', 'var(--heal)');
  html += renderPodium('Top Kills', topByKills, 'defeat', 'var(--accent-primary)');
  html += '</div></div>';

  // Member picker panel
  html += '<div id="member-picker" class="hidden" style="width:260px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;position:fixed;right:16px;top:70px;max-height:calc(100vh - 100px);overflow-y:auto;z-index:40;">'
    +'<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;">'
      +'<span style="font-size:14px;font-weight:700;color:var(--accent);flex:1;">Selectează membru</span>'
      +'<button onclick="closeMemberPicker()" style="background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;">×</button>'
    +'</div>'
    +'<div style="padding:8px 10px;">'
      +'<input id="picker-search" type="text" placeholder="Caută..." oninput="filterPicker()" style="width:100%;background:var(--bg-hover);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;outline:none;">'
    +'</div>'
    +'<div id="picker-list" style="padding:4px 6px;"></div>'
  +'</div>';

  document.getElementById('view-war-content').innerHTML = html;
  var pl = document.getElementById('picker-list');
  if(pl) pl.addEventListener('click', function(e){
    var item = e.target.closest('[data-name]');
    if(item) pickMember(item.getAttribute('data-name'), item.getAttribute('data-role'));
  });
  if(_vwEditMode){
    bindWarDragDrop(warId);
    bindExtrasDragDrop(warId);
  }
  showPage('view-war');
}

// ── Tab switching for view war ──
function showVwTab(tabId, el){
  document.querySelectorAll('#page-view-war .tab').forEach(function(t){ t.classList.remove('active'); });
  if(el) el.classList.add('active');
  ['parties','leaderboard'].forEach(function(id){
    var tab = document.getElementById('vw-tab-'+id);
    if(tab) tab.style.display = (id===tabId) ? '' : 'none';
  });
}

// ── VIEW WAR: Member picker panel ────────────────────────────────────────
var _pickerWarId = null, _pickerPi = null, _pickerMi = null;

function openMemberPicker(warId, pi, mi){
  _pickerWarId = warId; _pickerPi = pi; _pickerMi = mi;

  // Show panel
  document.getElementById('member-picker').classList.remove('hidden');

  renderPickerList();
  document.getElementById('picker-search').value = '';
  document.getElementById('picker-search').focus();
}

function closeMemberPicker(){
  document.getElementById('member-picker').classList.add('hidden');
  _pickerWarId = null;
}

function filterPicker(){
  renderPickerList();
}

function renderPickerList(){
  var roster = loadMembriRoster();
  var wars = loadWars();
  var w = wars.find(function(x){ return x.id===_pickerWarId; });
  if(!w){ closeMemberPicker(); return; }

  var search = (document.getElementById('picker-search').value||'').toLowerCase();

  // Get names already in war (for highlighting, not filtering — allow duplicates if needed)
  var usedNames = {};
  w.parties.forEach(function(p){ p.members.forEach(function(m){ usedNames[normalizeName(m.name)]=true; }); });

  var listHtml = '';
  var roles = {TANK:[], HEALER:[], DPS:[]};
  roster.forEach(function(r){
    if(search && r.name.toLowerCase().indexOf(search)===-1) return;
    if(roles[r.role]) roles[r.role].push(r);
  });

  ['TANK','HEALER','DPS'].forEach(function(role){
    if(!roles[role].length) return;
    var rc = roleColor(role);
    listHtml += '<div style="font-size:10px;color:'+rc+';font-weight:700;padding:6px 8px 3px;letter-spacing:.06em;">'+role+'</div>';
    roles[role].forEach(function(r){
      var used = usedNames[normalizeName(r.name)];
      listHtml += '<div data-name="'+escHtml(r.name)+'" data-role="'+r.role+'" class="picker-item" style="color:'+(used?'var(--text-muted)':'var(--text)')+';'+(used?'opacity:.5;':'')+'">'
        +'<span style="width:7px;height:7px;border-radius:50%;background:'+rc+';"></span>'
        +escHtml(r.name)
        +(used?'<span style="margin-left:auto;font-size:9px;color:var(--text-muted);">in war</span>':'')
        +'</div>';
    });
  });

  if(!listHtml) listHtml = '<div style="padding:12px;color:var(--text-muted);font-size:12px;text-align:center;">Niciun rezultat</div>';
  document.getElementById('picker-list').innerHTML = listHtml;
}

function pickMember(name, role){
  var wars = loadWars();
  var w = wars.find(function(x){ return x.id===_pickerWarId; });
  if(!w || _pickerPi===null) return;

  var party = w.parties[_pickerPi];
  if(!party) return;

  if(_pickerMi >= 0 && party.members[_pickerMi]){
    // Replace existing member (keep stats)
    party.members[_pickerMi].name = name;
    party.members[_pickerMi].role = role;
  } else {
    // Add new member
    party.members.push({name:name, role:role, defeat:0, assist:0, dmg_dealt:0, dmg_taken:0, healed:0});
  }

  closeMemberPicker();
  viewWar(_pickerWarId);
}

// ── VIEW WAR: Drag & Drop helpers ────────────────────────────────────────
var _vwDrag = null; // { warId, fromPi, fromMi }

function captureAllLiveInputs(warId){
  var wars = loadWars();
  var w = wars.find(function(x){ return x.id===warId; });
  if(!w) return;
  w.parties.forEach(function(p, pi){
    p.members.forEach(function(m, mi){
      var inputs = document.querySelectorAll('input[data-pi="'+pi+'"][data-mi="'+mi+'"]');
      inputs.forEach(function(inp){
        var f = inp.getAttribute('data-field');
        if(f && f!=='name') m[f] = +inp.value || 0;
      });
    });
  });
}

function clearAllDropIndicators(){
  document.querySelectorAll('.vw-drop-above,.vw-drop-below,.vw-drop-target').forEach(function(el){
    el.classList.remove('vw-drop-above','vw-drop-below','vw-drop-target');
  });
}

function performDragMove(warId, fromPi, fromMi, toPi, toIndex){
  // No-op: dropping onto self (same index, or just-after-self)
  if(fromPi===toPi && (fromMi===toIndex || fromMi+1===toIndex)) return;
  var wars = loadWars();
  var w = wars.find(function(x){ return x.id===warId; });
  if(!w) return;
  // Preserve live edits in all inputs before re-render wipes DOM
  captureAllLiveInputs(warId);
  var member = w.parties[fromPi].members[fromMi];
  if(!member) return;
  w.parties[fromPi].members.splice(fromMi, 1);
  // Adjust target index when removing earlier in the same party
  if(fromPi===toPi && fromMi < toIndex) toIndex--;
  w.parties[toPi].members.splice(toIndex, 0, member);
  viewWar(warId);
}

function bindWarDragDrop(warId){
  var grid = document.getElementById('vw-parties-grid');
  if(!grid) return;

  grid.querySelectorAll('.vw-row').forEach(function(row){
    row.addEventListener('dragstart', function(e){
      var pi = +row.getAttribute('data-pi');
      var mi = +row.getAttribute('data-mi');
      _vwDrag = { warId: warId, fromPi: pi, fromMi: mi };
      row.classList.add('vw-dragging');
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', pi+':'+mi);
      } catch(_){}
    });
    row.addEventListener('dragend', function(){
      row.classList.remove('vw-dragging');
      clearAllDropIndicators();
      _vwDrag = null;
    });
    row.addEventListener('dragover', function(e){
      if(!_vwDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var rect = row.getBoundingClientRect();
      var above = (e.clientY - rect.top) < rect.height/2;
      clearAllDropIndicators();
      row.classList.add(above ? 'vw-drop-above' : 'vw-drop-below');
    });
    row.addEventListener('drop', function(e){
      if(!_vwDrag) return;
      e.preventDefault();
      e.stopPropagation();
      var toPi = +row.getAttribute('data-pi');
      var toMi = +row.getAttribute('data-mi');
      var rect = row.getBoundingClientRect();
      var above = (e.clientY - rect.top) < rect.height/2;
      var insertAt = above ? toMi : toMi + 1;
      performDragMove(warId, _vwDrag.fromPi, _vwDrag.fromMi, toPi, insertAt);
    });
  });

  grid.querySelectorAll('.vw-dropzone-end').forEach(function(zone){
    zone.addEventListener('dragover', function(e){
      if(!_vwDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearAllDropIndicators();
      zone.classList.add('vw-drop-target');
    });
    zone.addEventListener('drop', function(e){
      if(!_vwDrag) return;
      e.preventDefault();
      e.stopPropagation();
      var toPi = +zone.getAttribute('data-pi');
      var wars = loadWars();
      var w = wars.find(function(x){ return x.id===warId; });
      if(!w) return;
      var insertAt = w.parties[toPi].members.length;
      performDragMove(warId, _vwDrag.fromPi, _vwDrag.fromMi, toPi, insertAt);
    });
  });
}

function bindExtrasDragDrop(warId){
  var extras = document.querySelectorAll('.extra-player-card[draggable]');
  var _extraDrag = null;

  extras.forEach(function(card){
    card.addEventListener('dragstart', function(e){
      _extraDrag = +card.getAttribute('data-extra-idx');
      card.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'extra:'+_extraDrag);
    });
    card.addEventListener('dragend', function(){
      card.style.opacity = '';
      _extraDrag = null;
      document.querySelectorAll('.vw-drop-above,.vw-drop-below').forEach(function(el){
        el.classList.remove('vw-drop-above','vw-drop-below');
      });
    });
  });

  // Make dimmed (missing) rows accept extra drops → replace
  document.querySelectorAll('.vw-row[data-is-missing="1"]').forEach(function(row){
    row.addEventListener('dragover', function(e){
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('vw-drop-above');
    });
    row.addEventListener('dragleave', function(){
      row.classList.remove('vw-drop-above');
    });
    row.addEventListener('drop', function(e){
      e.preventDefault();
      row.classList.remove('vw-drop-above');
      var data = e.dataTransfer.getData('text/plain');
      if(!data.startsWith('extra:')) return;
      var extraIdx = +data.split(':')[1];
      var toPi = +row.getAttribute('data-pi');
      var toMi = +row.getAttribute('data-mi');
      replaceWithExtra(warId, extraIdx, toPi, toMi);
    });
  });

  // Make ALL party cards accept extra drops → append to end
  document.querySelectorAll('.party-card[data-pi]').forEach(function(card){
    card.addEventListener('dragover', function(e){
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.style.boxShadow = 'inset 0 -3px 0 0 var(--accent-primary)';
    });
    card.addEventListener('dragleave', function(){
      card.style.boxShadow = '';
    });
    card.addEventListener('drop', function(e){
      e.preventDefault();
      card.style.boxShadow = '';
      var data = e.dataTransfer.getData('text/plain');
      if(!data.startsWith('extra:')) return;
      var extraIdx = +data.split(':')[1];
      var toPi = +card.getAttribute('data-pi');
      appendExtraToParty(warId, extraIdx, toPi);
    });
  });
}

function replaceWithExtra(warId, extraIdx, toPi, toMi){
  var w = getWar(warId);
  if(!w) return;
  var extrasParty = getExtrasParty(w);
  if(!extrasParty || !extrasParty.members[extraIdx]) return;
  var extra = extrasParty.members[extraIdx];
  // Replace the missing player with the extra
  if(w.parties[toPi] && w.parties[toPi].members[toMi]){
    w.parties[toPi].members[toMi] = {
      name: extra.name,
      role: extra.role || w.parties[toPi].members[toMi].role,
      defeat: extra.defeat||0,
      assist: extra.assist||0,
      dmg_dealt: extra.dmg_dealt||0,
      dmg_taken: extra.dmg_taken||0,
      healed: extra.healed||0
    };
  }
  // Remove from extras
  extrasParty.members.splice(extraIdx, 1);
  if(!extrasParty.members.length){
    w.parties = w.parties.filter(function(p){ return !isExtrasParty(p); });
  }
  viewWar(warId);
}

function appendExtraToParty(warId, extraIdx, toPi){
  var w = getWar(warId);
  if(!w) return;
  var extrasParty = getExtrasParty(w);
  if(!extrasParty || !extrasParty.members[extraIdx]) return;
  var extra = extrasParty.members[extraIdx];
  if(w.parties[toPi]){
    w.parties[toPi].members.push({
      name: extra.name,
      role: extra.role||'DPS',
      defeat: extra.defeat||0,
      assist: extra.assist||0,
      dmg_dealt: extra.dmg_dealt||0,
      dmg_taken: extra.dmg_taken||0,
      healed: extra.healed||0
    });
  }
  extrasParty.members.splice(extraIdx, 1);
  if(!extrasParty.members.length){
    w.parties = w.parties.filter(function(p){ return !isExtrasParty(p); });
  }
  viewWar(warId);
}

function movePlayerToParty(warId, fromPi, mi, targetPartyName){
  if(!targetPartyName || targetPartyName==='→') return;
  var wars = loadWars();
  var w = wars.find(function(x){ return x.id===warId; });
  if(!w) return;
  var toPi = w.parties.findIndex(function(p){ return p.name===targetPartyName; });
  if(toPi<0) return;
  var toIndex = w.parties[toPi].members.length;
  performDragMove(warId, fromPi, mi, toPi, toIndex);
}

function updatePartyNameInWar(warId, pi, newName){
  var w = getWar(warId);
  if(w && w.parties[pi]) w.parties[pi].name = newName.trim();
}

function updatePlayerNameInWar(warId, pi, mi, newName){
  var w = getWar(warId);
  if(w && w.parties[pi] && w.parties[pi].members[mi]) w.parties[pi].members[mi].name = newName.trim();
}

function cycleWarMemberRole(warId, pi, mi){
  if(!_warsCache) return;
  var war = _warsCache.find(function(w){ return w.id === warId; });
  if(!war || !war.parties[pi] || !war.parties[pi].members[mi]) return;
  war.parties[pi].members[mi].role = nextRole(war.parties[pi].members[mi].role);
  viewWar(warId);
}

function cycleExtraRole(warId, extraIdx){
  if(!_warsCache) return;
  var war = _warsCache.find(function(w){ return w.id === warId; });
  if(!war) return;
  var extras = getExtrasParty(war);
  if(!extras || !extras.members[extraIdx]) return;
  extras.members[extraIdx].role = nextRole(extras.members[extraIdx].role);
  viewWar(warId);
}

function deletePartyFromWar(warId, partyIndex){
  if(!_warsCache) return;
  var war = _warsCache.find(function(w){ return w.id === warId; });
  if(!war) return;
  var partyName = war.parties[partyIndex] ? war.parties[partyIndex].name : 'Party';
  if(!confirm('Delete '+partyName+'? Members will be removed from this war.')) return;
  war.parties.splice(partyIndex, 1);
  viewWar(warId); // re-render
}

function enterEditMode(warId){
  _vwEditMode = true;
  _vwWarId = warId;
  viewWar(warId);
}

function cancelEditMode(){
  _vwEditMode = false;
  // Reload from API/cache to discard changes
  if(_vwWarId){
    // Re-fetch to discard in-memory edits
    apiGet('/api/wars').then(function(wars){
      if(wars) _warsCache = wars;
      viewWar(_vwWarId);
    });
  }
}

function cycleRole(warId, pi, mi){
  var w = getWar(warId);
  if(!w || !w.parties[pi] || !w.parties[pi].members[mi]) return;
  w.parties[pi].members[mi].role = nextRole(w.parties[pi].members[mi].role);
  viewWar(warId);
}

function removeWarMember(warId, pi, mi){
  var w = getWar(warId);
  if(!w) return;
  w.parties[pi].members.splice(mi, 1);
  viewWar(warId);
}

function moveExtraToParty(warId, extraIdx){
  var w = getWar(warId);
  if(!w) return;

  // Find _Extras party
  var extrasParty = getExtrasParty(w);
  if(!extrasParty || !extrasParty.members[extraIdx]) return;

  var partyName = document.getElementById('extra-party-'+extraIdx).value;
  var targetParty = w.parties.find(function(p){ return p.name===partyName && !p._isExtras; });
  if(!targetParty) return;

  var ex = extrasParty.members[extraIdx];
  // Read possibly edited values from inputs
  ex.defeat    = +(document.getElementById('extra-k-'+extraIdx).value)||0;
  ex.assist    = +(document.getElementById('extra-a-'+extraIdx).value)||0;
  ex.dmg_dealt = +(document.getElementById('extra-d-'+extraIdx).value)||0;
  ex.dmg_taken = +(document.getElementById('extra-t-'+extraIdx).value)||0;
  ex.healed    = +(document.getElementById('extra-h-'+extraIdx).value)||0;

  targetParty.members.push(ex);
  extrasParty.members.splice(extraIdx, 1);
  if(!extrasParty.members.length){
    w.parties = w.parties.filter(function(p){ return !isExtrasParty(p); });
  }
  viewWar(warId);
}

async function saveWarEdits(warId){
  var wars = loadWars();
  var w = wars.find(function(x){ return x.id===warId; });
  if(!w) return;
  var opp = document.getElementById('edit-opponent').value.trim() || w.opponent;
  var dt  = document.getElementById('edit-date').value || w.date;
  w.opponent = opp; w.date = dt;

  // Force any active editable input to blur (triggers its onblur save handler)
  if(document.activeElement && document.activeElement.tagName === 'INPUT'){
    document.activeElement.blur();
  }
  // Names and stats are already saved to war object via onblur handlers
  // (updatePlayerNameInWar for names, makeEditable onblur for stats)
  document.querySelectorAll('#view-war-content select[data-field="color"]').forEach(function(sel){
    var pi=+sel.dataset.pi;
    if(w.parties[pi]) w.parties[pi].color = sel.value;
  });
  try{
    var r = await apiPut('/api/wars/'+warId,{opponent:w.opponent,date:w.date,parties:w.parties,extras:w.extras||[]},{admin:true});
    if(!r.ok) throw new Error('HTTP '+r.status);
  } catch(e){ Toast.error('Eroare la salvare: '+e.message); return; }
  _vwEditMode = false;
  viewWar(warId); // re-render with updated data
}

// ── ROLE-BASED UI ─────────────────────────────────────────────────────────
function updateUIForRole(){
  var isAdmin = _userRole === 'admin';
  var isEditor = _userRole === 'admin' || _userRole === 'editor';

  // New War — editor+ only
  var nwTab = document.getElementById('new-war-tab');
  if(nwTab) nwTab.style.display = isEditor ? '' : 'none';
  var nwBtn = document.querySelector('.topbar-actions .btn-primary');
  if(nwBtn) nwBtn.style.display = isEditor ? '' : 'none';

  // Guild settings — admin only
  var gsTab = document.getElementById('guild-settings-tab');
  if(gsTab) gsTab.style.display = isAdmin ? '' : 'none';

  // Topbar user area
  var userEl = document.getElementById('topbar-user');
  if(userEl){
    if(_userName && _authToken){
      var avatarHtml = _userAvatar
        ? '<img src="'+_userAvatar+'" style="width:34px;height:34px;border-radius:50%;">'
        : '<div style="width:34px;height:34px;border-radius:50%;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--text-muted);">'+_userName.charAt(0).toUpperCase()+'</div>';
      var userRoleBadge = _userRole === 'admin' ? '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(212,225,87,.15);color:var(--accent);font-weight:600;">ADMIN</span>'
        : _userRole === 'editor' ? '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(91,143,255,.15);color:var(--color-info);font-weight:600;">EDITOR</span>'
        : '';
      userEl.innerHTML = avatarHtml
        +'<div style="display:flex;flex-direction:column;gap:2px;">'
          +'<span style="font-size:13px;font-weight:600;color:var(--text);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escHtml(_userName)+'</span>'
          +userRoleBadge
        +'</div>'
        +'<button onclick="logout()" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:4px 6px;" title="Logout">\u2715</button>';
    } else {
      userEl.innerHTML = '';
    }
  }
}
