// ── NAV ───────────────────────────────────────────────────────────────────
// ── SETTINGS ACCESS (admin-only, no PIN) ──────────────────────────────────
function promptPin(){
  if(_userRole !== 'admin'){ return; }
  showPage('guild-settings');
}

function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if(id==='wars'){ renderWarsList(); document.querySelectorAll('.nav-tab')[0].classList.add('active'); }
  if(id==='settings'){ initSettingsPage(); }
  if(id==='new-war'){ document.getElementById('new-war-tab').classList.add('active'); }
  if(id==='members'){ renderMembersPage(); }
  if(id==='guild-settings'){ initGuildSettings(); }
  if(id==='guild-picker'){ renderGuildPicker(); }
  // Reveal app shell (hidden until first showPage to prevent flash)
  var shell = document.getElementById('app-shell');
  if(shell) shell.style.opacity = '1';
}

function startNewWar(){
  state = {step:1, partyImg:null,
           parties: JSON.parse(JSON.stringify(DEFAULT_PARTIES)),
           opponent:'', date:''};
  document.getElementById('opponent-input').value='';
  document.getElementById('date-input').value='';
  document.getElementById('party-upload-zone').style.display='';
  document.getElementById('party-split-view').style.display='none';
  document.getElementById('party-img-input').value='';
  document.getElementById('step1-btns').style.display='none';
  document.getElementById('party-confirm-display').innerHTML='';
  document.getElementById('step1-confirm-btns').innerHTML='';
  var pme = document.getElementById('party-manual-editor');
  pme.innerHTML=''; pme.style.display='';
  showPage('new-war');
}

// ── STEP NAV (single-step wizard — no-op) ─────────────────────────────────
function goStep(n){ /* single-step wizard */ }

// ── ALIAS-AWARE MATCHING ──────────────────────────────────────────────────
function findStatsByNameOrAlias(confirmed, memberName){
  if(!confirmed || !confirmed.length) return null;
  // 1. Direct name match
  var direct = confirmed.find(function(c){ return namesMatch(c.name, memberName); });
  if(direct) return direct;
  // 2. Match via alias: member's alias value = confirmed player's name
  var key = normalizeName(memberName);
  var alias = _memberAliases[key];
  if(alias){
    var aliasMatch = confirmed.find(function(c){ return namesMatch(c.name, alias); });
    if(aliasMatch) return aliasMatch;
  }
  // 3. Try all aliases — find any alias value that matches a confirmed name
  for(var k in _memberAliases){
    if(normalizeName(k) === key || namesMatch(k, memberName)){
      var val = _memberAliases[k];
      var found = confirmed.find(function(c){ return namesMatch(c.name, val); });
      if(found) return found;
    }
  }
  // 4. Reverse: confirmed name is an alias value, find which TLGM member it maps to
  for(var k2 in _memberAliases){
    var v = _memberAliases[k2];
    if(namesMatch(v, memberName)){
      // This alias maps to us — find confirmed by the alias value
      var found2 = confirmed.find(function(c){ return namesMatch(c.name, v) || namesMatch(c.name, k2); });
      if(found2) return found2;
    }
  }
  return null;
}

// ── SAVE WAR (simplified) ─────────────────────────────────────────────────
async function saveWarSimple(){
  var opp = (document.getElementById('opponent-input').value||'').trim() || 'Unknown';
  var dt  = document.getElementById('date-input').value || new Date().toLocaleDateString('ro-RO');
  // Merge stats din confirmed players înapoi în parties (match by name + alias)
  if(state.confirmed && state.confirmed.length){
    state.parties.forEach(function(p){
      p.members.forEach(function(m){
        var stats = findStatsByNameOrAlias(state.confirmed, m.name);
        if(stats){
          m.defeat    = stats.defeat    || 0;
          m.assist    = stats.assist    || 0;
          m.dmg_dealt = stats.dmg_dealt || 0;
          m.dmg_taken = stats.dmg_taken || 0;
          m.healed    = stats.healed    || 0;
        }
      });
    });
  }
  // Add unassigned extras as a special party "_Extras"
  if(state._unassignedExtras && state._unassignedExtras.length){
    state.parties.push({name:'_Extras', label:'', members:state._unassignedExtras, _isExtras:true});
  }
  if(state._saving) return; // prevent double save
  state._saving = true;
  var war = {id:Date.now(), opponent:opp, date:dt, parties:state.parties};
  try{
    var r = await apiPost('/api/wars',war,{admin:true});
    if(!r.ok) throw new Error('HTTP '+r.status);
    if(_warsCache!==null) _warsCache.unshift(war);
    showPage('wars');
  } catch(e){ Toast.error('Eroare la salvare: '+e.message); state._saving = false; }
}

// ── STEP 1: PARTY UPLOAD ──────────────────────────────────────────────────
function handlePartyUpload(e){
  var file = e.target.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){
    state.partyImg = ev.target.result;
    document.getElementById('party-preview-img').src = ev.target.result;
    document.getElementById('party-upload-zone').style.display='none';
    document.getElementById('party-split-view').style.display='';
    renderPartyEditor();
    document.getElementById('step1-btns').style.display='flex';
  };
  reader.readAsDataURL(file);
}

// Default parties extracted from the standard TL screenshot format
// User edits these to match what they see in the image
var DEFAULT_PARTIES = [
  {name:'Party 1', label:'Main', members:[]},
  {name:'Party 2', label:'Main', members:[]},
  {name:'Party 3', label:'Support', members:[]},
  {name:'Party 4', label:'Flex', members:[]},
  {name:'Party 5', label:'Reserve', members:[]},
  {name:'Party 6', label:'Reserve', members:[]},
  {name:'Party 7', label:'Reserve', members:[]}
];

function renderPartyEditor(){
  state.parties = matchPartiesAgainstRoster(JSON.parse(JSON.stringify(DEFAULT_PARTIES)));
  var html = '<div style="margin-top:16px;">';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Editează dacă party-urile din poză sunt diferite față de cele de mai jos:</div>';
  html += '<div class="parties-confirm" id="party-editor-cards">';
  state.parties.forEach(function(p,pi){
    html += '<div class="inner-card party-card">';
    html += '<div class="party-card-header">';
    html += '<input type="text" value="'+p.name+'" style="background:transparent;border:none;color:var(--text);font-family:Rajdhani,sans-serif;font-size:14px;font-weight:700;width:80px;outline:none;" onchange="updatePartyName('+pi+',this.value)">';
    html += '<input type="text" value="'+p.label+'" style="background:rgba(255,255,255,.08);border:none;color:var(--tank);font-size:10px;padding:1px 7px;border-radius:99px;outline:none;width:110px;" onchange="updatePartyLabel('+pi+',this.value)">';
    html += '</div>';
    p.members.forEach(function(m,mi){
      var matchDot = m.tlgmKey
        ? '<span title="TLGM: '+m.tlgmName+(m.matchedVia==='alias'?' (alias)':'')+'" style="width:7px;height:7px;border-radius:50%;background:var(--heal);flex-shrink:0;display:inline-block;margin-left:4px;"></span>'
        : '<span title="Nu e în roster TLGM" style="width:7px;height:7px;border-radius:50%;background:var(--muted);flex-shrink:0;display:inline-block;margin-left:4px;"></span>';
      html += '<div class="party-card-member">';
      html += RoleBadge(m.role, {pill:false});
      html += '<input type="text" value="'+m.name+'" style="flex:1;background:transparent;border:none;color:var(--text);font-size:12px;font-weight:600;outline:none;border-bottom:1px solid transparent;padding:1px 0;" onfocus="this.style.borderBottomColor=\'var(--gold)\'" onblur="this.style.borderBottomColor=\'transparent\'" onchange="updateMemberName('+pi+','+mi+',this.value)">';
      html += '<select onchange="updateMemberRole('+pi+','+mi+',this.value)" style="background:var(--bg);border:1px solid var(--border2);color:'+roleColor(m.role)+';font-size:10px;border-radius:4px;padding:2px 4px;cursor:pointer;">';
      ['TANK','HEALER','DPS'].forEach(function(r){
        html += '<option value="'+r+'"'+(r===m.role?' selected':'')+'>'+r+'</option>';
      });
      html += '</select>'+matchDot+'</div>';
    });
    html += '</div>';
  });
  html += '</div></div>';
  document.getElementById('party-manual-editor').innerHTML = html;
}

function updatePartyName(pi,v){ state.parties[pi].name=v; }
function updatePartyLabel(pi,v){ state.parties[pi].label=v; }
function updateMemberName(pi,mi,v){ state.parties[pi].members[mi].name=v; }
function updateMemberRole(pi,mi,v){ state.parties[pi].members[mi].role=v; updateRoleDot(pi,mi,v); }
function updateRoleDot(pi,mi,v){
  var dots = document.querySelectorAll('.party-card-member .dot');
  // rebuild is simpler — re-render confirm display
}

function confirmParties(){
  // show confirmed view
  var html='';
  state.parties.forEach(function(p){
    html += PartyCard(p);
  });
  document.getElementById('party-confirm-display').innerHTML = html;
  document.getElementById('party-manual-editor').style.display='none';
  document.getElementById('step1-btns').style.display='none';
  var total    = state.parties.reduce(function(a,p){return a+p.members.length;},0);
  var matched  = state.parties.reduce(function(a,p){return a+p.members.filter(function(m){return !!m.tlgmKey;}).length;},0);
  var unmatched= total-matched;
  var summary  = '<span style="color:var(--heal);">✓ '+matched+' identificați</span>'
               + (unmatched ? ' · <span style="color:var(--muted);">'+unmatched+' neidentificați</span>' : '')
               + ' · '+total+' total';
  document.getElementById('step1-confirm-btns').innerHTML =
    '<div class="btn-row" style="margin-top:16px;"><div style="font-size:12px;margin-right:auto;">'+summary+'</div>'
    +'<button class="btn btn-secondary" onclick="saveWarSimple()">💾 Salvează fără stats</button>'
    +'<button class="btn btn-primary" onclick="goToStep2()">Scoreboard → </button></div>';
}

// ── STEP 2: SCOREBOARD UPLOAD ─────────────────────────────────────────────
function handleScoreUpload(e){
  var files = Array.from(e.target.files);
  files.forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(ev){
      var idx = state.scoreImgs.length;
      state.scoreImgs.push({dataUrl:ev.target.result, name:file.name});
      renderScoreGrid();
    };
    reader.readAsDataURL(file);
  });
}

function renderScoreGrid(){
  var grid = document.getElementById('score-grid');
  var html = '';
  state.scoreImgs.forEach(function(img,i){
    html += '<div class="score-thumb"><img src="'+img.dataUrl+'"><button class="rm" onclick="removeScore('+i+')">×</button></div>';
  });
  html += '<div class="score-add" onclick="document.getElementById(\'score-add-input\').click()"><input type="file" accept="image/*" multiple id="score-add-input" onchange="handleScoreUpload(event)" style="display:none;"><div class="score-add-icon">+</div><div class="score-add-txt">Adaugă</div></div>';
  grid.innerHTML = html;
  document.getElementById('step2-next').disabled = state.scoreImgs.length === 0;
}

function removeScore(i){
  state.scoreImgs.splice(i,1);
  renderScoreGrid();
}

// ── STEP 2: EXCEL UPLOAD ──────────────────────────────────────────────────
function handleExcelUpload(e){
  var file = e.target.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){
    try{
      var wb = XLSX.read(ev.target.result, {type:'binary'});
      var sheet = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(sheet, {defval:''});
      if(!rows.length) throw new Error('Fișierul e gol sau formatat greșit');

      var headers = Object.keys(rows[0]);
      function findCol(variants){
        return headers.find(function(h){
          var lh = h.toLowerCase().replace(/[_\s]/g,'');
          return variants.some(function(v){ return lh.indexOf(v.replace(/[_\s]/g,''))!==-1; });
        });
      }
      var colName   = findCol(['name','player','username','jucator']);
      var colDefeat = findCol(['defeat','kill','def']);
      var colAssist = findCol(['assist','ast']);
      var colDealt  = findCol(['dmgdealt','damagedealt','damage','dealt']);
      var colTaken  = findCol(['dmgtaken','damagetaken','taken']);
      var colHealed = findCol(['healed','heal','healing','amounthealed']);

      if(!colName) throw new Error('Nu am găsit coloana cu numele jucătorilor. Headers găsite: '+headers.join(', '));

      state.excelData = rows.map(function(r){
        return {
          name:      String(r[colName]||'').trim(),
          defeat:    parseInt(String(r[colDefeat]||'0').replace(/[^0-9]/g,''))||0,
          assist:    parseInt(String(r[colAssist]||'0').replace(/[^0-9]/g,''))||0,
          dmg_dealt: parseInt(String(r[colDealt] ||'0').replace(/[^0-9]/g,''))||0,
          dmg_taken: parseInt(String(r[colTaken] ||'0').replace(/[^0-9]/g,''))||0,
          healed:    parseInt(String(r[colHealed] ||'0').replace(/[^0-9]/g,''))||0,
        };
      }).filter(function(r){ return r.name; });

      if(!state.excelData.length) throw new Error('Nu am găsit niciun jucător în fișier');

      var prev = document.getElementById('excel-preview');
      prev.style.display='block';
      prev.innerHTML =
        '<div style="background:rgba(62,207,110,.08);border:1px solid rgba(62,207,110,.2);border-radius:8px;padding:10px 14px;">'
        +'<span style="color:var(--heal);font-size:13px;font-weight:600;">✓ '+state.excelData.length+' jucători încărcați</span>'
        +'<span style="font-size:11px;color:var(--muted);margin-left:12px;">Coloane: '
        +[colName,colDefeat,colAssist,colDealt,colTaken,colHealed].filter(Boolean).join(' · ')
        +'</span></div>';
      document.getElementById('step2-next').disabled = false;
    } catch(err){
      state.excelData = null;
      document.getElementById('step2-next').disabled = true;
      document.getElementById('excel-preview').style.display='block';
      document.getElementById('excel-preview').innerHTML =
        '<div style="background:rgba(232,64,64,.08);border:1px solid rgba(232,64,64,.2);border-radius:8px;padding:10px 14px;color:var(--dps);font-size:12px;">✗ '+err.message+'</div>';
    }
  };
  reader.readAsBinaryString(file);
}

// ── STEP 3: FROM EXCEL ────────────────────────────────────────────────────
function goStep3FromExcel(){
  goStep(3);
  var allMembers = [];
  state.parties.forEach(function(p){
    p.members.forEach(function(m){
      if(!allMembers.find(function(x){return x.name===m.name;})){
        allMembers.push({name:m.name,party:p.name,role:m.role,
          defeat:0,assist:0,dmg_dealt:0,dmg_taken:0,healed:0,checked:true});
      }
    });
  });
  state.novaPlayers = allMembers;

  if(!state.excelData || !state.excelData.length){
    var s3 = document.getElementById('step3-status');
    s3.innerHTML = '⚠ Niciun fișier Excel încărcat. '
      +'<button onclick="goStep(2)" style="background:transparent;border:1px solid var(--gold);color:var(--gold);font-size:11px;padding:3px 10px;border-radius:5px;cursor:pointer;margin-left:8px;">← Înapoi la Step 2</button>';
    s3.style.display='block';
    s3.style.background='rgba(240,192,64,.08)';
    s3.style.borderColor='rgba(240,192,64,.2)';
    s3.style.color='var(--gold)';
    renderStatsList();
    return;
  }

  // Merge cu fuzzy matching + alias
  var aliases = loadAliases();
  var matchedKeys = {};
  state.novaPlayers.forEach(function(p){
    var alias = aliases[normalizeName(p.name)];
    var found = state.excelData.find(function(r){
      return namesMatch(p.name, r.name) || (alias && namesMatch(alias, r.name));
    });
    if(found){
      p.defeat    = found.defeat;
      p.assist    = found.assist;
      p.dmg_dealt = found.dmg_dealt;
      p.dmg_taken = found.dmg_taken;
      p.healed    = found.healed;
      matchedKeys[found.name.toLowerCase().trim()] = true;
    }
  });

  // Jucători extra — în Excel dar fără party
  state.excelData.forEach(function(r){
    var key = r.name.toLowerCase().trim();
    if(!matchedKeys[key] && r.name){
      state.novaPlayers.push({
        name:r.name, party:'?', role:'DPS',
        defeat:r.defeat, assist:r.assist,
        dmg_dealt:r.dmg_dealt, dmg_taken:r.dmg_taken, healed:r.healed,
        checked:false, extra:true
      });
    }
  });

  // Status
  state.novaPlayers.forEach(function(p){
    if(p.extra) p.status='extra';
    else if(p.defeat===0&&p.assist===0&&p.dmg_dealt===0) p.status='missing';
    else p.status='confirmed';
  });

  var cC = state.novaPlayers.filter(function(p){return p.status==='confirmed';}).length;
  var mC = state.novaPlayers.filter(function(p){return p.status==='missing';}).length;
  var eC = state.novaPlayers.filter(function(p){return p.status==='extra';}).length;
  var statusEl = document.getElementById('step3-status');
  statusEl.style.display='block';
  statusEl.innerHTML =
    '<span style="color:var(--heal);">✅ '+cC+' confirmați</span>'
    +'  <span style="color:var(--color-assists);">⚠ '+mC+' lipsă</span>'
    +'  <span style="color:var(--gold);">➕ '+eC+' extra</span>'
    +'  <button onclick="goStep(2)" style="background:transparent;border:1px solid var(--gold);color:var(--gold);font-size:11px;padding:3px 10px;border-radius:5px;cursor:pointer;margin-left:8px;">← Schimbă fișier</button>';
  statusEl.style.background='rgba(10,16,32,.6)';
  statusEl.style.borderColor='rgba(255,255,255,.08)';
  statusEl.style.color='var(--text)';
  renderStatsList();
}

// ── STEP 3: NOVA PLAYERS ──────────────────────────────────────────────────
function renderStatsRow(p, i){
  var dot = roleColor(p.role);
  var status = p.status || (p.extra ? 'extra' : 'missing');

  var rowStyle = '';
  var statusBadge = '';
  if(status === 'confirmed'){
    rowStyle = '';
    statusBadge = '<span style="font-size:10px;color:var(--heal);">✅</span>';
  } else if(status === 'missing'){
    rowStyle = 'background:rgba(232,160,48,.05);border-left:2px solid rgba(232,160,48,.35);';
    statusBadge = '<span style="font-size:10px;color:var(--color-assists);">⚠ lipsă</span>';
  } else { // extra
    rowStyle = 'background:rgba(240,192,64,.05);border-left:2px solid rgba(240,192,64,.3);';
    statusBadge = '<span style="font-size:10px;color:var(--gold);">➕ extra</span>';
  }

  // Party cell: dropdown pentru extra, text pentru ceilalți
  var partyCell = '';
  if(status === 'extra'){
    var opts = '<option value="">— fără party —</option>';
    state.parties.forEach(function(pt){
      opts += '<option value="'+pt.name+'"'+(p.party===pt.name?' selected':'')+'>'+pt.name+'</option>';
    });
    partyCell = '<select onchange="assignExtraToParty('+i+',this.value)" style="background:var(--bg3);border:1px solid var(--border2);color:var(--gold);font-size:10px;border-radius:4px;padding:2px 4px;cursor:pointer;max-width:90px;">'+opts+'</select>';
  } else {
    partyCell = '<span style="font-size:10px;color:var(--muted);">'+p.party+'</span>';
  }

  var html = '<div class="nova-row" style="'+rowStyle+'">';
  html += '<div class="nova-row-name" style="display:flex;align-items:center;gap:5px;">';
  html += '<div class="dot" style="background:'+dot+'"></div>';
  html += '<input type="checkbox" class="player-check" '+(p.checked?'checked':'')+' onchange="togglePlayer('+i+',this.checked)">';
  html += '<span style="font-size:12px;font-weight:600;color:var(--text);">'+p.name+'</span>';
  html += partyCell;
  html += statusBadge;
  html += '</div>';
  html += '<div class="stat-num" style="text-align:center;"><input type="number" min="0" value="'+p.defeat+'" style="width:60px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--accent);font-size:12px;text-align:center;padding:3px;" onchange="setPlayerStat('+i+',\'defeat\',+this.value)"></div>';
  html += '<div class="stat-num" style="text-align:center;"><input type="number" min="0" value="'+p.assist+'" style="width:60px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text-muted);font-size:12px;text-align:center;padding:3px;" onchange="setPlayerStat('+i+',\'assist\',+this.value)"></div>';
  html += '<div class="stat-num"><input type="number" min="0" value="'+p.dmg_dealt+'" style="width:100px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--color-assists);font-size:12px;text-align:right;padding:3px;" onchange="setPlayerStat('+i+',\'dmg_dealt\',+this.value)"></div>';
  html += '<div class="stat-num"><input type="number" min="0" value="'+p.dmg_taken+'" style="width:100px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--color-dmg-taken);font-size:12px;text-align:right;padding:3px;" onchange="setPlayerStat('+i+',\'dmg_taken\',+this.value)"></div>';
  html += '<div class="stat-num"><input type="number" min="0" value="'+p.healed+'" style="width:100px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--heal);font-size:12px;text-align:right;padding:3px;" onchange="setPlayerStat('+i+',\'healed\',+this.value)"></div>';
  html += '</div>';
  return html;
}

function renderStatsList(){
  console.log('[renderStatsList] _rosterCache:', _rosterCache?_rosterCache.length:'null', 'novaPlayers:', state.novaPlayers?state.novaPlayers.length:'null', '_memberAliases keys:', Object.keys(_memberAliases).length);
  // Use new matching engine if roster is available
  if(_rosterCache && _rosterCache.length && state.novaPlayers && state.novaPlayers.length){
    var matchResults = matchOcrToMembers(state.novaPlayers, _rosterCache, _memberAliases);
    window._currentMatchResults = matchResults;
    document.getElementById('nova-list-wrap').innerHTML = renderStatsMatchingUI(matchResults);
    return;
  }
  // Fallback to old render
  var hdr = '<div class="nova-list-hdr"><span>Player</span><span style="text-align:center;">Defeat</span><span style="text-align:center;">Assist</span><span style="text-align:right;">Dmg Dealt</span><span style="text-align:right;">Dmg Taken</span><span style="text-align:right;">Healed</span></div>';
  var sorted = state.novaPlayers.slice().sort(function(a, b){
    var order = {confirmed:0, missing:1, extra:2};
    var sa = order[a.status||'missing'];
    var sb = order[b.status||'missing'];
    if(sa !== sb) return sa - sb;
    return (b.defeat||0) - (a.defeat||0);
  });
  var html = '<div class="nova-list">'+hdr;
  sorted.forEach(function(p){
    html += renderStatsRow(p, state.novaPlayers.indexOf(p));
  });
  html += '</div>';
  document.getElementById('nova-list-wrap').innerHTML = html;
}


// STATS MATCHING UI V3 — moved to js/pages/smart-match.js


// ── STEP 4: MATCH PREVIEW ─────────────────────────────────────────────────
function renderMatchPreview(){
  var html='';
  state.parties.forEach(function(p){
    var matched = p.members.map(function(m){
      var stats = findStatsByNameOrAlias(state.confirmed, m.name);
      return Object.assign({},m,stats||{defeat:0,assist:0,dmg_dealt:0,dmg_taken:0,healed:0});
    });
    var tot_def = matched.reduce(function(a,m){return a+m.defeat;},0);
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">';
    html += '<div style="font-family:Rajdhani,sans-serif;font-size:14px;font-weight:700;color:var(--text);min-width:80px;">'+p.name+'</div>';
    html += '<div style="font-size:11px;color:var(--muted);">'+p.label+'</div>';
    html += '<div style="margin-left:auto;display:flex;gap:16px;align-items:center;">';
    p.members.forEach(function(m){
      var dot=roleColor(m.role);
      var has = findStatsByNameOrAlias(state.confirmed, m.name);
      html += '<div style="display:flex;align-items:center;gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:'+dot+'"></div><span style="font-size:11px;color:'+(has?'var(--text)':'var(--muted)')+';">'+m.name+'</span>'+(has?'<span style="color:var(--heal);font-size:10px;">✓</span>':'')+'</div>';
    });
    html += '</div>';
    html += '<div style="font-size:13px;font-weight:700;color:var(--gold);min-width:60px;text-align:right;">'+tot_def+' kills</div>';
    html += '</div>';
  });
  document.getElementById('match-preview').innerHTML = html;
}

// ── STEP 5: PREVIEW ───────────────────────────────────────────────────────
function fmtF(n){ return n?n.toLocaleString():'—'; }

function renderPreview(){
  var totalDef = state.confirmed.reduce(function(a,p){return a+p.defeat;},0);
  var html='';
  state.parties.forEach(function(p){
    var members = p.members.map(function(m){
      var s = findStatsByNameOrAlias(state.confirmed, m.name);
      return Object.assign({},m,s||{defeat:0,assist:0,dmg_dealt:0,dmg_taken:0,healed:0});
    });
    var td=members.reduce(function(a,m){return a+m.defeat;},0);
    var ta=members.reduce(function(a,m){return a+m.assist;},0);
    var tdd=members.reduce(function(a,m){return a+m.dmg_dealt;},0);
    var tdt=members.reduce(function(a,m){return a+m.dmg_taken;},0);
    var th=members.reduce(function(a,m){return a+m.healed;},0);
    html += '<div class="result-party">';
    html += '<div class="result-party-hdr"><span style="font-family:Rajdhani,sans-serif;font-size:13px;font-weight:700;color:var(--text);">'+p.name+'</span><span style="font-size:10px;color:var(--tank);background:rgba(255,255,255,.08);padding:1px 8px;border-radius:99px;">'+p.label+'</span></div>';
    html += '<table class="result-tbl"><thead><tr><th style="text-align:left;">Name</th><th>Def</th><th>Ast</th><th>Dmg Dealt</th><th>Dmg Taken</th><th>Healed</th><th style="color:var(--gold);">Kill Part.</th></tr></thead><tbody>';
    members.forEach(function(m){
      var dot=roleColor(m.role);
      var kpv = totalDef>0&&m.defeat>0 ? (m.defeat/totalDef*100) : 0;
      var bw = Math.min(100,kpv*6).toFixed(0);
      var dc = m.defeat>=20?'var(--accent)':(m.defeat>0?'var(--text-muted)':'var(--text-label)');
      var hc = m.healed>500000?'var(--heal)':'var(--text-muted)';
      var kc = m.defeat>0?'var(--accent)':'var(--text-label)';
      html += '<tr>';
      html += '<td><div style="display:flex;align-items:center;gap:7px;"><div style="width:7px;height:7px;border-radius:50%;background:'+dot+'"></div><span style="font-size:12px;font-weight:600;color:var(--text);">'+m.name+'</span></div></td>';
      html += '<td style="color:'+dc+';font-weight:700;">'+fmtF(m.defeat)+'</td>';
      html += '<td style="color:var(--text-muted);">'+fmtF(m.assist)+'</td>';
      html += '<td style="color:var(--color-assists);">'+fmtF(m.dmg_dealt)+'</td>';
      html += '<td style="color:var(--color-dmg-taken);">'+fmtF(m.dmg_taken)+'</td>';
      html += '<td style="color:'+hc+';">'+fmtF(m.healed)+'</td>';
      html += '<td><div style="display:flex;align-items:center;gap:5px;justify-content:flex-end;"><div class="kp-bar-wrap"><div class="kp-bar-fill" style="width:'+bw+'%"></div></div><span style="font-size:11px;font-weight:700;color:'+kc+';min-width:36px;text-align:right;">'+(kpv>0?kpv.toFixed(1)+'%':'—')+'</span></div></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += '<div class="result-footer">';
    html += '<div class="rf-item"><div class="rf-label">Defeats</div><div class="rf-val" style="color:var(--accent);">'+td+'</div></div>';
    html += '<div class="rf-item"><div class="rf-label">Assists</div><div class="rf-val" style="color:var(--text-muted);">'+ta+'</div></div>';
    html += '<div class="rf-item"><div class="rf-label">Dmg Dealt</div><div class="rf-val" style="color:var(--color-assists);">'+fmtShort(tdd)+'</div></div>';
    html += '<div class="rf-item"><div class="rf-label">Dmg Taken</div><div class="rf-val" style="color:var(--dps);">'+fmtShort(tdt)+'</div></div>';
    html += '<div class="rf-item"><div class="rf-label">Healed</div><div class="rf-val" style="color:var(--heal);">'+fmtShort(th)+'</div></div>';
    html += '</div></div>';
  });
  document.getElementById('preview-content').innerHTML = html;
}


// ── Vision/OCR and Init (moved from bottom of index.html) ──
// ── INIT ──────────────────────────────────────────────────────────────────
async function initApp(){
  // Auth first, then guild routing loads data
  checkAuth();

  // Hash routing: #war-{id} opens that war
  function checkHashRoute(){
    var hash = window.location.hash;
    if(hash.startsWith('#war-')){
      var warId = +hash.replace('#war-','');
      if(warId && _currentGuildId) setTimeout(function(){ viewWar(warId); }, 500);
    }
  }
  checkHashRoute();
  window.addEventListener('hashchange', checkHashRoute);
}
// initApp() is called from index.html after all scripts load
// Apply translations to ALL data-t elements (text) and data-tp elements (placeholders)
function applyTranslations(){
  document.querySelectorAll('[data-t]').forEach(function(el){
    var k=el.getAttribute('data-t');
    if(_t[_lang][k]) el.textContent=_t[_lang][k];
  });
  document.querySelectorAll('[data-tp]').forEach(function(el){
    var k=el.getAttribute('data-tp');
    if(_t[_lang][k]) el.placeholder=_t[_lang][k];
  });
}
applyTranslations();



function exportData(){
  var keys=['nova_wars','nova_membri_roster','nova_membri_aliases','nova_aliases','nova_api_key','nova_membri_screenshots_meta'];
  var data={};
  keys.forEach(function(k){ var v=localStorage.getItem(k); if(v) data[k]=v; });
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='nova-data-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
  URL.revokeObjectURL(url);
}
function importData(input){
  var file=input.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      Object.keys(data).forEach(function(k){ localStorage.setItem(k,data[k]); });
      var s=document.getElementById('import-status');
      if(s){ s.style.display='block'; s.style.background='rgba(62,207,110,.1)'; s.style.color='var(--heal)'; s.textContent='✓ Date importate — reîncărcare...'; }
      setTimeout(function(){ location.reload(); },1000);
    } catch(err){
      var s=document.getElementById('import-status');
      if(s){ s.style.display='block'; s.style.background='rgba(232,64,64,.1)'; s.style.color='var(--dps)'; s.textContent='Fișier invalid.'; }
    }
  };
  reader.readAsText(file);
}

// API key functions removed — key is now server-side env var only
// ── ALIAS JUCĂTORI ────────────────────────────────────────────────────────
function renderAliasTable(){
  var aliases = loadAliases();
  var keys = Object.keys(aliases);
  var html = '';
  if(!keys.length){
    html = '<div style="font-size:11px;color:var(--muted);padding:6px 0;">Niciun alias definit.</div>';
  } else {
    html = '<div style="display:flex;flex-direction:column;gap:6px;">';
    keys.forEach(function(k){
      var safeK = k.replace(/'/g,"\\'");
      html += '<div style="display:flex;gap:8px;align-items:center;">'
        +'<input type="text" value="'+k+'" placeholder="Nume Guild Manager" '
        +'style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;padding:5px 8px;" '
        +'onchange="renameAliasKey(\''+safeK+'\',this.value)">'
        +'<span style="color:var(--muted);font-size:14px;">→</span>'
        +'<input type="text" value="'+aliases[k]+'" placeholder="Nume în joc" '
        +'style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--gold);font-size:12px;padding:5px 8px;" '
        +'onchange="updateAliasValue(\''+safeK+'\',this.value)">'
        +'<button onclick="removeAlias(\''+safeK+'\')" style="background:transparent;border:none;color:var(--dps);font-size:18px;cursor:pointer;padding:0 4px;line-height:1;">×</button>'
        +'</div>';
    });
    html += '</div>';
  }
  var el = document.getElementById('alias-table');
  if(el) el.innerHTML = html;
}

function addAlias(){
  var aliases = loadAliases();
  var newKey = 'jucator'+(Object.keys(aliases).length+1);
  while(aliases[newKey]) newKey += '_';
  aliases[newKey] = '';
  saveAliases(aliases);
  renderAliasTable();
}

function removeAlias(key){
  var aliases = loadAliases();
  delete aliases[key];
  saveAliases(aliases);
  renderAliasTable();
}

function renameAliasKey(oldKey, newRaw){
  var newKey = newRaw.trim().toLowerCase().replace(/[^\w\s]/g,'').replace(/\s+/g,' ').trim();
  if(!newKey || newKey === oldKey) return;
  var aliases = loadAliases();
  var val = aliases[oldKey];
  delete aliases[oldKey];
  aliases[newKey] = val;
  saveAliases(aliases);
  renderAliasTable();
}

function updateAliasValue(key, val){
  var aliases = loadAliases();
  aliases[key] = val.trim();
  saveAliases(aliases);
}

function initSettingsPage(){
  // Settings page removed — redirect to guild settings
  showPage('guild-settings');
}

// ── IMAGE COMPRESSION ─────────────────────────────────────────────────────
function compressImage(dataUrl, maxWidth, quality){
  maxWidth = maxWidth || 1600;
  quality  = quality  || 0.82;
  return new Promise(function(resolve){
    var img = new Image();
    img.onload = function(){
      var w = img.width, h = img.height;
      if(w > maxWidth){ h = Math.round(h * maxWidth / w); w = maxWidth; }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// ── CLAUDE API CALL (via server proxy) ─────────────────────────────────────
async function callClaude(prompt, imageDataUrl){
  var compressed = await compressImage(imageDataUrl);
  var b64 = compressed.split(',')[1];
  console.log('[OCR] Sending request, image size:', Math.round(b64.length/1024)+'kb');
  var resp = await fetch('/api/ocr',{
    method:'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ prompt: prompt, image_base64: b64, image_mime: 'image/jpeg' })
  });
  console.log('[OCR] Response status:', resp.status);
  if(!resp.ok){
    var errText = await resp.text();
    console.error('[OCR] Error response:', errText);
    try{ var errObj = JSON.parse(errText); throw new Error(errObj.error || 'OCR error '+resp.status); }
    catch(e){ if(e.message.startsWith('OCR') || e.message.startsWith('Anthropic')) throw e; throw new Error('OCR error '+resp.status+': '+errText.substring(0,200)); }
  }
  var data = await resp.json();
  console.log('[OCR] Success, response length:', (data.text||'').length);
  return data.text;
}

// ── STEP 1: VISION PARTY EXTRACT ──────────────────────────────────────────
async function extractPartiesFromImage(dataUrl){
  var prompt = `You are analyzing a screenshot from TL Guild Manager (Throne & Liberty game).

The image shows party cards arranged in a GRID of columns. Each column is ONE party card.

STEP 1 - IDENTIFY EACH PARTY CARD:
- Each party card has a header at the top: "Party N (Label)" e.g. "Party 1 (Mainball)" or "Party 5 (Main/Cap)"
- Cards are arranged LEFT to RIGHT in columns
- Process each column/card INDEPENDENTLY — do NOT mix players between cards

STEP 2 - FOR EACH PARTY CARD, read TOP to BOTTOM:
- Each row is ONE player
- The player name is the text AFTER the circular avatar icon
- Read the EXACT name visible in THAT specific card column — do NOT use names from other columns

STEP 3 - ROLE DETECTION BY LEFT VERTICAL COLOR BAR:
Each player row has a thin VERTICAL COLOR BAR on its LEFT EDGE.
Do NOT look at the row background color. Look ONLY at this left-side vertical bar.

There are exactly 3 possible bar colors:
- PURPLE / VIOLET bar (#8B5CF6) → role: "TANK"
- GREEN bar (#22C55E) → role: "HEALER"
- RED / BROWN bar (#EF4444) → role: "DPS"

The bar is a thin colored stripe on the very left of each player row. It is always clearly visible.

CRITICAL RULES:
- Process ONE card/column at a time, left to right
- Each player name belongs ONLY to the card they appear in — never copy names between cards
- Read names character by character from the image — names may include: letters, numbers, dots, ✗, ✦, ·, Japanese chars
- Skip any "Not Assigned" section at the bottom of a card
- The party label is in parentheses: "Party 3 (Portal Camp)" → label = "Portal Camp"
- Usually 5-6 players per party, but can be more or fewer
- Return ALL parties visible in the image

Respond with ONLY a JSON array, no markdown, no explanation:
[
  {"name":"Party 1","label":"Mainball","members":[
    {"name":"ExactPlayerName","role":"TANK"},
    {"name":"AnotherPlayer","role":"HEALER"},
    {"name":"ThirdPlayer","role":"DPS"}
  ]},
  {"name":"Party 2","label":"Main","members":[...]}
]`;

  var raw = await callClaude(prompt, dataUrl);
  var clean = raw.replace(/```json\n?|```/g,'').trim();
  var match = clean.match(/\[[\s\S]*\]/);
  if(match) clean = match[0];
  return JSON.parse(clean);
}

// ── STEP 2: VISION SCOREBOARD EXTRACT ────────────────────────────────────
async function extractScoreboardFromImage(dataUrl, guildNames){
  var prompt = `You are analyzing a Throne & Liberty war scoreboard screenshot.

CRITICAL: Extract EVERY visible row. Do NOT skip any player. Count the rows you see and make sure your output has the same count.

Each row contains these columns (left to right):
1. Rank number (ignore)
2. Weapon icons (ignore)
3. Guild name/badge text (e.g. "カNova ミ", "Faith メ", "TheExpendables")
4. Player name — PRESERVE special chars exactly: ✗ • ↗ ↙ ✦ · メ 〆 ぞ ゜
5. Team color indicator (ignore)
6. Defeat count (integer)
7. Assist count (integer)
8. Damage Dealt (integer, may have comma separators like 1,234,567)
9. Damage Taken (integer, may have comma separators)
10. Amount Healed (integer, may have comma separators)

IMPORTANT RULES:
- Remove comma/dot separators from numbers: 1,234,567 → 1234567
- If a number is hard to read, make your BEST GUESS — do NOT default to 0 unless the cell clearly shows 0
- Extract ALL rows visible in the image, even partially visible ones at the top/bottom
- Double-check each row: count that you have exactly 5 numeric values (defeat, assist, dmg_dealt, dmg_taken, healed)
- Guild names contain decorative Unicode characters — copy them exactly

Return ONLY a valid JSON array, no markdown fences, no explanation:
[{"name":"PlayerName","guild":"GuildName","defeat":15,"assist":23,"dmg_dealt":1234567,"dmg_taken":456789,"healed":0}]`;

  var raw = await callClaude(prompt, dataUrl);
  var clean = raw.replace(/```json\n?|```/g,'').trim();
  var match = clean.match(/\[[\s\S]*\]/);
  if(match) clean = match[0];
  return JSON.parse(clean);
}

// ── STEP 2 FLOW: Scoreboard upload & extraction ──────────────────────────
function confirmAndGoStep2(){
  // Parties sunt deja în state.parties — mergi direct la Step 2
  goToStep2();
}

function goToStep2(){
  document.getElementById('step-1').style.display='none';
  document.getElementById('step-2').style.display='';
  document.getElementById('ws-1').classList.remove('active');
  document.getElementById('ws-1').classList.add('done');
  document.getElementById('ws-2').classList.add('active');
  state.scoreImgs = [];
  renderScoreGrid();
}

function goBackToStep1(){
  document.getElementById('step-2').style.display='none';
  document.getElementById('step-1').style.display='';
  document.getElementById('ws-2').classList.remove('active');
  document.getElementById('ws-1').classList.add('active');
  document.getElementById('ws-1').classList.remove('done');
}

function handleScoreUpload(e){
  Array.from(e.target.files).forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(ev){
      state.scoreImgs.push({dataUrl:ev.target.result, name:file.name});
      renderScoreGrid();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

function renderScoreGrid(){
  var el = document.getElementById('score-grid');
  el.innerHTML = state.scoreImgs.map(function(s,i){
    return '<div class="score-thumb">'
      +'<img src="'+s.dataUrl+'">'
      +'<button class="rm" onclick="removeScoreImg('+i+')">✕</button>'
      +'<div style="position:absolute;bottom:4px;left:4px;font-size:9px;color:var(--text);background:rgba(0,0,0,.7);padding:1px 5px;border-radius:3px;">'+(i+1)+'</div>'
      +'</div>';
  }).join('');
  var btn = document.getElementById('score-extract-btn');
  if(btn) btn.disabled = state.scoreImgs.length === 0;
}

function removeScoreImg(i){
  state.scoreImgs.splice(i,1);
  renderScoreGrid();
}

async function extractAllScoreboards(){
  var btn = document.getElementById('score-extract-btn');
  btn.disabled = true; btn.textContent = '⏳ Se procesează...';
  var statusEl = document.getElementById('score-extract-status');
  var resultsEl = document.getElementById('score-results');

  // Collect party member names + aliases for matching
  var guildNames = [];
  state.parties.forEach(function(p){ p.members.forEach(function(m){
    guildNames.push(m.name);
    if(m.tlgmName) guildNames.push(m.tlgmName);
  }); });
  // Also add all alias values (in-game names) to matching pool
  Object.values(_memberAliases).forEach(function(v){ if(v && guildNames.indexOf(v)===-1) guildNames.push(v); });
  var mAliases = loadMembriAliases(); // {normalizedName: "GameName with ✗"}
  var wAliases = loadAliases();       // war aliases

  // Helper: check if extracted name matches a guild member (including aliases)
  function isGuildPlayer(extractedName){
    if(guildNames.some(function(n){ return namesMatch(n, extractedName); })) return true;
    // Check aliases: any alias value matches extracted name
    var aKeys = Object.keys(mAliases);
    for(var a=0;a<aKeys.length;a++){
      if(namesMatch(mAliases[aKeys[a]], extractedName)) return true;
    }
    aKeys = Object.keys(wAliases);
    for(var a=0;a<aKeys.length;a++){
      if(namesMatch(wAliases[aKeys[a]], extractedName)) return true;
    }
    return false;
  }

  var allExtracted = {}; // keyed by normalized name → stats object (MAX merge)
  var errors = [];

  for(var i=0; i<state.scoreImgs.length; i++){
    statusEl.innerHTML = '<div class="processing"><span class="spin">◌</span> Se procesează imaginea '+(i+1)+' din '+state.scoreImgs.length+'...</div>';
    try{
      var players = await extractScoreboardFromImage(state.scoreImgs[i].dataUrl, guildNames);
      if(!Array.isArray(players)) throw new Error('Răspuns invalid');

      // Filter for guild members or name matches (including aliases)
      var guildPattern = _currentGuildName ? new RegExp(_currentGuildName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i') : null;
      players.forEach(function(p){
        var isGuild = p.guild && guildPattern && guildPattern.test(p.guild);
        var isMatch = isGuildPlayer(p.name);
        if(!isGuild && !isMatch) return;

        var key = normalizeName(p.name);
        if(!allExtracted[key]){
          allExtracted[key] = {name:p.name, guild:p.guild, defeat:0, assist:0, dmg_dealt:0, dmg_taken:0, healed:0};
        }
        // MAX merge — if same player in multiple screenshots, take highest
        var e = allExtracted[key];
        e.defeat    = Math.max(e.defeat,    p.defeat||0);
        e.assist    = Math.max(e.assist,    p.assist||0);
        e.dmg_dealt = Math.max(e.dmg_dealt, p.dmg_dealt||0);
        e.dmg_taken = Math.max(e.dmg_taken, p.dmg_taken||0);
        e.healed    = Math.max(e.healed,    p.healed||0);
      });
      statusEl.innerHTML = '<span style="color:var(--heal);">✓ Imaginea '+(i+1)+' procesată — '+players.length+' rânduri extrase</span>';
    } catch(err){
      errors.push('Img '+(i+1)+': '+err.message);
      statusEl.innerHTML = '<span style="color:var(--dps);">✗ Eroare imaginea '+(i+1)+': '+err.message+'</span>';
    }
  }

  // Build novaPlayers from parties + extracted stats (with alias matching)
  state.novaPlayers = [];
  state.parties.forEach(function(p){
    p.members.forEach(function(m){
      var found = null;
      var foundKey = null;
      var keys = Object.keys(allExtracted);
      for(var j=0;j<keys.length;j++){
        var ex = allExtracted[keys[j]];
        // 1. Direct name match
        if(namesMatch(m.name, ex.name)){ foundKey = keys[j]; break; }
        // 2. tlgmName match (from roster matching, e.g. "Nyx ✗")
        if(m.tlgmName && namesMatch(m.tlgmName, ex.name)){ foundKey = keys[j]; break; }
        // 3. Member alias: normalizeName(m.name) → alias value matches extracted
        var mAlias = mAliases[normalizeName(m.name)] || wAliases[normalizeName(m.name)];
        if(mAlias && namesMatch(mAlias, ex.name)){ foundKey = keys[j]; break; }
        // 4. Reverse: extracted name's alias points to member
        var rAlias = mAliases[normalizeName(ex.name)] || wAliases[normalizeName(ex.name)];
        if(rAlias && namesMatch(rAlias, m.name)){ foundKey = keys[j]; break; }
        // 5. tlgmName alias
        if(m.tlgmName){
          var tAlias = mAliases[normalizeName(m.tlgmName)] || wAliases[normalizeName(m.tlgmName)];
          if(tAlias && namesMatch(tAlias, ex.name)){ foundKey = keys[j]; break; }
        }
      }
      if(foundKey){ found = allExtracted[foundKey]; delete allExtracted[foundKey]; }
      state.novaPlayers.push({
        name: m.name, party: p.name, role: m.role,
        defeat: found ? found.defeat : 0,
        assist: found ? found.assist : 0,
        dmg_dealt: found ? found.dmg_dealt : 0,
        dmg_taken: found ? found.dmg_taken : 0,
        healed: found ? found.healed : 0,
        checked: true,
        status: found ? 'confirmed' : 'missing',
        extra: false
      });
    });
  });
  // Add extra players (in scoreboard but not in parties)
  Object.keys(allExtracted).forEach(function(k){
    var e = allExtracted[k];
    state.novaPlayers.push({
      name: e.name, party: '?', role: 'DPS',
      defeat: e.defeat, assist: e.assist, dmg_dealt: e.dmg_dealt,
      dmg_taken: e.dmg_taken, healed: e.healed,
      checked: false, status: 'extra', extra: true
    });
  });

  // ═══ STATS MATCHING UI V3 ═══
  var matchResults = (_rosterCache && _rosterCache.length)
    ? matchOcrToMembers(state.novaPlayers, _rosterCache, _memberAliases)
    : {matched:[], needsReview:[], notInScoreboard:[]};
  // If no roster, put all confirmed as matched, all missing/extra as review
  if(!_rosterCache || !_rosterCache.length){
    state.novaPlayers.forEach(function(p){
      if(p.status==='confirmed') matchResults.matched.push({ocrName:p.name,member:{name:p.name,role:p.role||'DPS'},stats:p,confidence:'exact'});
      else if(p.status==='extra') matchResults.needsReview.push({ocrName:p.name,stats:p,suggestions:[]});
    });
  }
  window._currentMatchResults = matchResults;

  var out = renderStatsMatchingV3(matchResults);

  resultsEl.innerHTML = out;
  statusEl.innerHTML = '<span style="color:var(--heal);font-weight:600;">Extragere completă! Verifică matches și salvează.</span>';

  btn.textContent = '🔍 Extrage din nou';
  btn.disabled = false;
  // Hide the old save button — v3 has its own inline save
  document.getElementById('score-save-btn').style.display = 'none';
}


function saveWarWithStats(){
  // Delegate to v3 save if available
  if(window._currentMatchResults){
    saveWarWithStatsV3();
    return;
  }
  // Fallback: Add extra players with assigned party to their respective parties
  var unassigned = [];
  state.novaPlayers.forEach(function(p){
    if(p.status==='extra' && p.party && p.party!=='?'){
      var targetParty = state.parties.find(function(pt){ return pt.name===p.party; });
      if(targetParty){
        targetParty.members.push({name:p.name, role:p.role||'DPS', defeat:p.defeat||0, assist:p.assist||0, dmg_dealt:p.dmg_dealt||0, dmg_taken:p.dmg_taken||0, healed:p.healed||0});
        p.status = 'confirmed';
      }
    } else if(p.status==='extra' && (!p.party || p.party==='?')){
      // Save unassigned extras with stats
      if(p.defeat||p.assist||p.dmg_dealt||p.dmg_taken||p.healed){
        unassigned.push({name:p.name, role:p.role||'DPS', defeat:p.defeat||0, assist:p.assist||0, dmg_dealt:p.dmg_dealt||0, dmg_taken:p.dmg_taken||0, healed:p.healed||0});
      }
    }
  });
  state.confirmed = state.novaPlayers.filter(function(p){ return p.status==='confirmed'; });

  // Test matching engine
  if(_rosterCache && state.confirmed.length){
    var matchResults = matchOcrToMembers(state.confirmed, _rosterCache, _memberAliases);
    console.log('[MatchEngine] Results:', matchResults);
    console.log('[MatchEngine] Matched:', matchResults.matched.length, '/ Needs Review:', matchResults.needsReview.length, '/ Not in scoreboard:', matchResults.notInScoreboard.length);
  }

  // Store unassigned extras on state so saveWarSimple can include them
  state._unassignedExtras = unassigned;
  saveWarSimple();
}

// ── UPDATED PARTY UPLOAD HANDLER ──────────────────────────────────────────
async function handlePartyUploadWithVision(e){
  var file = e.target.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = async function(ev){
    state.partyImg = ev.target.result;
    document.getElementById('party-preview-img').src = ev.target.result;
    document.getElementById('party-upload-zone').style.display='none';
    document.getElementById('party-split-view').style.display='';
    var sb = document.getElementById('step1-btns');
    sb.style.display='flex';
    sb.style.gap='8px';
    document.getElementById('step1-btns').querySelector('.btn-primary').disabled=true;
    document.getElementById('step1-btns').querySelector('.btn-primary').textContent='Se procesează...';

    var hasKey = true; // OCR key is server-side
    if(hasKey){
      document.getElementById('party-manual-editor').innerHTML =
        '<div class="processing"><span class="spin">◌</span> Claude analizează culorile și extrage party-urile...</div>';
      try{
        var extracted = await extractPartiesFromImage(ev.target.result);
        console.log('[OCR] Extracted parties:', JSON.stringify(extracted).substring(0,500));
        if(!extracted || !extracted.length){
          throw new Error('OCR returned empty result');
        }
        state.parties = matchPartiesAgainstRoster(extracted);
        renderPartyEditorFromData(state.parties);
      } catch(err){
        console.error('[OCR] Failed:', err);
        document.getElementById('party-manual-editor').innerHTML =
          '<div style="color:var(--dps);font-size:13px;padding:14px;background:rgba(232,64,64,.1);border:1px solid rgba(232,64,64,.2);border-radius:8px;margin-bottom:10px;">'
          +'<b>OCR Error:</b> '+escHtml(err.message)
          +'<br><span style="font-size:11px;color:var(--text-muted);">Add members manually below or try a different screenshot.</span></div>';
        state.parties = JSON.parse(JSON.stringify(DEFAULT_PARTIES));
        renderPartyEditorFromData(state.parties);
      }
    } else {
      document.getElementById('party-manual-editor').innerHTML =
        '<div style="color:var(--gold);font-size:11px;padding:8px 10px;background:rgba(240,192,64,.06);border-radius:6px;margin-bottom:10px;">Fără API key — party-uri default. <a href="#" onclick="showPage(\'settings\')" style="color:var(--gold);">Settings →</a></div>';
      state.parties = matchPartiesAgainstRoster(JSON.parse(JSON.stringify(DEFAULT_PARTIES)));
      renderPartyEditorFromData(state.parties);
    }
    document.getElementById('step1-btns').querySelector('.btn-primary').disabled=false;
    document.getElementById('step1-btns').querySelector('.btn-primary').textContent='Confirm Parties →';
  };
  reader.readAsDataURL(file);
}

function deleteParty(index){
  if(!confirm('Delete '+state.parties[index].name+'?')) return;
  state.parties.splice(index, 1);
  renderPartyEditorFromData(state.parties);
}

function renderPartyEditorFromData(parties){
  var partyDotColors = PARTY_DOT_COLORS;
  var html = '';
  parties.forEach(function(p,pi){
    var dotColor = partyDotColors[pi % partyDotColors.length];
    html += '<div class="party-edit-card">';
    html += '<div class="party-edit-header" style="display:flex;align-items:center;gap:8px;"><div class="party-color-dot" style="background:'+dotColor+';width:10px;height:10px;border-radius:3px;"></div><span style="flex:1;">'+escHtml(p.name)+'</span>'
      +(p.members.length===0||pi>=4 ? '<button onclick="deleteParty('+pi+')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;opacity:.6;" title="Delete party">\u2715</button>' : '')
      +'</div>';
    p.members.forEach(function(m,mi){
      var role = m.role||'DPS';
      var roleClass = role==='TANK'?'tank':role==='HEALER'?'heal':'dps';
      html += '<div class="party-edit-member">';
      html += '<span class="role-tag '+roleClass+'" onclick="var roles=[\'TANK\',\'HEALER\',\'DPS\'];var ci=roles.indexOf(\''+role+'\');var nr=roles[(ci+1)%3];updateMemberRole('+pi+','+mi+',nr);renderPartyEditorFromData(state.parties);" style="cursor:pointer;">'+role.replace('ER','')+'</span>';
      html += '<span style="color:var(--text);flex:1;">'+escHtml(m.name||'')+'</span>';
      html += '</div>';
    });
    html += '</div>';
  });
  document.getElementById('party-manual-editor').innerHTML = html;
}

// ── NAME NORMALIZATION ────────────────────────────────────────────────────
function normalizeName(n){
  return (n||'').toLowerCase()
    .replace(/[^\w\s\u3000-\u9fff\uff00-\uffef]/g,'')  // keep alphanumeric + CJK + fullwidth
    .replace(/\s+/g,' ')
    .trim();
}
// Aggressive normalize for fuzzy CJK matching — strips everything except core chars
function normalizeAggressive(n){
  return (n||'').toLowerCase()
    .replace(/[\s\|\u4e28\-\_\:\.\,\·\•\✗\✦\↗\↙\/\\]/g,'')  // remove separators
    .replace(/[\uff01-\uff5e]/g, function(c){ return String.fromCharCode(c.charCodeAt(0)-0xFEE0); }) // fullwidth→ascii
    .trim();
}
function namesMatch(a, b){
  if(!a || !b) return false;
  var na = normalizeName(a);
  var nb = normalizeName(b);
  if(na && nb && na === nb) return true;
  // Aggressive match for CJK names
  var aa = normalizeAggressive(a);
  var ab = normalizeAggressive(b);
  if(aa && ab && aa === ab) return true;
  // Prefix/contains match
  if(na && nb){
    var shorter = na.length <= nb.length ? na : nb;
    var longer  = na.length <= nb.length ? nb : na;
    if(longer.startsWith(shorter+' ') || longer.startsWith(shorter)) return true;
  }
  if(aa && ab){
    var shorter2 = aa.length <= ab.length ? aa : ab;
    var longer2  = aa.length <= ab.length ? ab : aa;
    if(longer2.startsWith(shorter2)) return true;
  }
  return false;
}

// ── MATCHING ENGINE ───────────────────────────────────────────────────────
function normalizeForMatch(str){
  if(!str) return '';
  return str.toLowerCase()
    .replace(/[\s\|\u4e28\-\_\:\·\•\(\)\[\]]/g,'')
    .replace(/[\uff01-\uff5e]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);})
    .trim();
}

function levenshteinDistance(a,b){
  var m=[];
  for(var i=0;i<=b.length;i++) m[i]=[i];
  for(var j=0;j<=a.length;j++) m[0][j]=j;
  for(var i=1;i<=b.length;i++){
    for(var j=1;j<=a.length;j++){
      m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:Math.min(m[i-1][j-1]+1,m[i][j-1]+1,m[i-1][j]+1);
    }
  }
  return m[b.length][a.length];
}

function similarityScore(a,b){
  var na=normalizeForMatch(a), nb=normalizeForMatch(b);
  if(!na||!nb) return 0;
  if(na===nb) return 100;
  if(na.indexOf(nb)!==-1||nb.indexOf(na)!==-1) return 85;
  var d=levenshteinDistance(na,nb);
  var maxLen=Math.max(na.length,nb.length);
  return Math.max(0,Math.round(100-(d/maxLen*100)));
}

function findSuggestions(ocrName,roster,aliases,usedIds){
  var suggestions=[];
  roster.forEach(function(m){
    if(usedIds[m.name]) return;
    var score=similarityScore(m.name,ocrName);
    if(score>40) suggestions.push({member:m,score:score,matchedOn:'tlgm_name'});
  });
  for(var k in aliases){
    var score=similarityScore(aliases[k],ocrName);
    if(score>40){
      var m=roster.find(function(r){return normalizeName(r.name)===k;});
      if(m && !usedIds[m.name] && !suggestions.find(function(s){return s.member.name===m.name;})){
        suggestions.push({member:m,score:score,matchedOn:'alias'});
      }
    }
  }
  return suggestions.sort(function(a,b){return b.score-a.score;}).slice(0,3);
}

function matchOcrToMembers(ocrResults,roster,aliases){
  var matched=[], needsReview=[];
  var usedMembers={}, usedOcr={};

  // PASUL 1: Pentru membrii cu ALIAS setat, caută alias în OCR PRIMUL
  roster.forEach(function(member){
    if(usedMembers[member.name] || member.active===false) return;
    var memberKey = normalizeName(member.name);
    var aliasValue = aliases[memberKey];
    if(!aliasValue) return;

    var aliasNorm = normalizeForMatch(aliasValue);
    for(var oi=0; oi<ocrResults.length; oi++){
      var ocr = ocrResults[oi];
      if(usedOcr[ocr.name]) continue;
      var ocrNorm = normalizeForMatch(ocr.name);
      var score = similarityScore(aliasValue, ocr.name);
      if(aliasNorm===ocrNorm || score>70){
        matched.push({ocrName:ocr.name, member:member, stats:ocr, confidence:aliasNorm===ocrNorm?'alias':'fuzzy'});
        usedMembers[member.name]=true;
        usedOcr[ocr.name]=true;
        break;
      }
    }
  });

  // PASUL 2: Pentru OCR results rămase, caută TLGM name exact
  ocrResults.forEach(function(ocr){
    if(usedOcr[ocr.name]) return;
    var ocrNorm = normalizeForMatch(ocr.name);

    // Exact match pe TLGM name
    var member = roster.find(function(m){ return !usedMembers[m.name] && m.active!==false && normalizeForMatch(m.name)===ocrNorm; });
    if(member){
      matched.push({ocrName:ocr.name, member:member, stats:ocr, confidence:'exact'});
      usedMembers[member.name]=true; usedOcr[ocr.name]=true;
      return;
    }

    // Fuzzy match pe TLGM name
    var bestMatch=null, bestScore=0;
    roster.forEach(function(m){
      if(usedMembers[m.name] || m.active===false) return;
      var score = similarityScore(m.name, ocr.name);
      if(score>70 && score>bestScore){ bestMatch=m; bestScore=score; }
    });
    if(bestMatch && bestScore>80){
      matched.push({ocrName:ocr.name, member:bestMatch, stats:ocr, confidence:'fuzzy'});
      usedMembers[bestMatch.name]=true; usedOcr[ocr.name]=true;
      return;
    }

    // Nu s-a găsit match → NEEDS REVIEW
    var suggestions = findSuggestions(ocr.name, roster, aliases, usedMembers);
    needsReview.push({ocrName:ocr.name, stats:ocr, suggestions:suggestions});
  });

  // PASUL 3: Membri din roster care nu apar în OCR
  var notInScoreboard = roster.filter(function(m){ return m.active!==false && !usedMembers[m.name]; })
    .map(function(m){ return{member:m, reason:'not_found_in_ocr'}; });

  return{matched:matched, needsReview:needsReview, notInScoreboard:notInScoreboard};
}

// ── UPDATED STEP 3: VISION SCOREBOARD ────────────────────────────────────
async function goStep3WithVision(){
  goStep(3);
  var allMembers = [];
  state.parties.forEach(function(p){
    p.members.forEach(function(m){
      if(!allMembers.find(function(x){return x.name===m.name;})){
        allMembers.push({name:m.name,party:p.name,role:m.role,defeat:0,assist:0,dmg_dealt:0,dmg_taken:0,healed:0,checked:true});
      }
    });
  });
  state.novaPlayers = allMembers;

  var hasKey = true; // OCR key is server-side
  if(!hasKey){
    var s3 = document.getElementById('step3-status');
    s3.innerHTML = '⚠ Fără API key — <b>introdu manual statisticile în tabelul de mai jos</b>. '
      +'<a href="#" onclick="showPage(\'settings\')" style="color:var(--gold);">Configurează API →</a>';
    s3.style.display='block';
    s3.style.background='rgba(240,192,64,.08)';
    s3.style.borderColor='rgba(240,192,64,.2)';
    s3.style.color='var(--gold)';
    renderStatsList();
    return;
  }
  if(state.scoreImgs.length===0){
    document.getElementById('step3-status').textContent = '⚠ Nicio poză de scoreboard încărcată la Step 2.';
    document.getElementById('step3-status').style.display='block';
    renderStatsList();
    return;
  }

  var guildNames = allMembers.map(function(m){return m.name;});
  var allExtracted = {};
  var log = [];

  for(var i=0;i<state.scoreImgs.length;i++){
    document.getElementById('nova-list-wrap').innerHTML =
      '<div class="processing"><span class="spin">◌</span> Procesez poza '+(i+1)+' din '+state.scoreImgs.length+'...'
      +(log.length?'<br><small style="color:var(--text-muted);">'+log.join(' | ')+'</small>':'')
      +'</div>';
    try{
      var players = await extractScoreboardFromImage(state.scoreImgs[i].dataUrl, guildNames);
      if(!Array.isArray(players)) throw new Error('Răspuns invalid — nu e array');

      // Filter: keep only guild members (guild name match or party name match)
      var guildRe = _currentGuildName ? new RegExp(_currentGuildName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i') : null;
      var guildPlayers = players.filter(function(p){
        var guildMatch = p.guild && guildRe && guildRe.test(p.guild);
        var nameMatchesParty = guildNames.some(function(n){ return namesMatch(n, p.name); });
        return guildMatch || nameMatchesParty;
      });

      log.push('P'+(i+1)+': '+guildPlayers.length+'/'+players.length+' guild');
      guildPlayers.forEach(function(p){
        if(!p.name) return;
        var key = p.name.toLowerCase().trim();
        if(!allExtracted[key]) allExtracted[key] = p;
        else {
          allExtracted[key].defeat    = Math.max(allExtracted[key].defeat,    +p.defeat||0);
          allExtracted[key].assist    = Math.max(allExtracted[key].assist,    +p.assist||0);
          allExtracted[key].dmg_dealt = Math.max(allExtracted[key].dmg_dealt, +p.dmg_dealt||0);
          allExtracted[key].dmg_taken = Math.max(allExtracted[key].dmg_taken, +p.dmg_taken||0);
          allExtracted[key].healed    = Math.max(allExtracted[key].healed,    +p.healed||0);
        }
      });
    } catch(err){
      log.push('P'+(i+1)+': ERR '+err.message.substring(0,120));
    }
  }

  // ── Merge cu fuzzy matching ─────────────────────────────────────────────
  var extractedKeys = Object.keys(allExtracted);
  var matchedKeys = {};

  state.novaPlayers.forEach(function(p){
    for(var k=0;k<extractedKeys.length;k++){
      if(namesMatch(p.name, extractedKeys[k])){
        var found = allExtracted[extractedKeys[k]];
        p.defeat    = +found.defeat||0;
        p.assist    = +found.assist||0;
        p.dmg_dealt = +found.dmg_dealt||0;
        p.dmg_taken = +found.dmg_taken||0;
        p.healed    = +found.healed||0;
        matchedKeys[extractedKeys[k]] = true;
        break;
      }
    }
  });

  // Extra guild players — in scoreboard but no party assignment
  extractedKeys.forEach(function(k){
    if(!matchedKeys[k]){
      var ep = allExtracted[k];
      state.novaPlayers.push({
        name: ep.name || k,
        party: '?',
        role: 'DPS',
        defeat:    +ep.defeat||0,
        assist:    +ep.assist||0,
        dmg_dealt: +ep.dmg_dealt||0,
        dmg_taken: +ep.dmg_taken||0,
        healed:    +ep.healed||0,
        checked: false,
        extra: true
      });
    }
  });

  // ── Setează status pe fiecare player ────────────────────────────────────
  state.novaPlayers.forEach(function(p){
    if(p.extra) p.status = 'extra';
    else if(p.defeat===0 && p.assist===0 && p.dmg_dealt===0) p.status = 'missing';
    else p.status = 'confirmed';
  });

  // ── Status message sumar ─────────────────────────────────────────────────
  var confirmedCount = state.novaPlayers.filter(function(p){return p.status==='confirmed';}).length;
  var missingCount   = state.novaPlayers.filter(function(p){return p.status==='missing';}).length;
  var extraCount     = state.novaPlayers.filter(function(p){return p.status==='extra';}).length;
  var statusEl = document.getElementById('step3-status');
  statusEl.style.display='block';
  var retryBtn = ' <button onclick="goStep3WithVision()" style="background:transparent;border:1px solid var(--gold);color:var(--gold);font-size:11px;padding:3px 10px;border-radius:5px;cursor:pointer;margin-left:8px;">↺ Reîncearcă</button>';

  var totalFound = confirmedCount + extraCount;
  if(totalFound > 0){
    var hadErrors = log.some(function(l){ return l.indexOf('ERR') !== -1; });
    statusEl.innerHTML =
      '<span style="color:var(--heal);">✅ '+confirmedCount+' confirmați</span>'
      +'  <span style="color:var(--color-assists);">⚠ '+missingCount+' lipsă</span>'
      +'  <span style="color:var(--gold);">➕ '+extraCount+' extra</span>'
      +'  <small style="color:var(--text-label);">'+log.join(' | ')+'</small>'
      +retryBtn;
    statusEl.style.background='rgba(10,16,32,.6)';
    statusEl.style.borderColor='rgba(255,255,255,.08)';
    statusEl.style.color='var(--text)';
  } else {
    statusEl.innerHTML = '✗ 0 jucători găsiți în scoreboard. <small>'+log.join(' | ')+'</small>'+retryBtn;
    statusEl.style.background='rgba(232,64,64,.08)';
    statusEl.style.borderColor='rgba(232,64,64,.2)';
    statusEl.style.color='var(--dps)';
  }
  renderStatsList();
}

