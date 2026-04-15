// ══════════════════════════════════════════════════════════════════════════
// STATS MATCHING UI V3 — complete rendering + interaction functions
// ══════════════════════════════════════════════════════════════════════════

// Global v3 state
window._v3ResolvedItems = {};  // idx -> {type:'existing'|'new'|'skip', memberName, member, isNew}
window._v3ManuallyAssigned = {}; // memberName -> true (for NEW badge in party preview)

function renderStatsMatchingV3(results){
  var roleClass = function(r){ return (r||'DPS')==='TANK'?'tank':(r||'DPS')==='HEALER'?'heal':'dps'; };

  window._v3ResolvedItems = {};
  window._v3ManuallyAssigned = {};

  var html = '';

  // ── CSS for v3 (injected inline) ──
  html += '<style id="stats-v3-css">'
    +'.sm3-matched-banner{background:linear-gradient(135deg,rgba(62,207,110,.1) 0%,rgba(62,207,110,.05) 100%);border:1px solid rgba(62,207,110,.3);border-radius:10px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:all .2s;}'
    +'.sm3-matched-banner:hover{background:linear-gradient(135deg,rgba(62,207,110,.15) 0%,rgba(62,207,110,.08) 100%);}'
    +'.sm3-matched-list{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;margin-bottom:16px;margin-top:-8px;display:none;max-height:250px;overflow-y:auto;}'
    +'.sm3-matched-list.show{display:block;}'
    +'.sm3-matched-item{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;}'
    +'.sm3-matched-item:last-child{border-bottom:none;}'
    +'.sm3-attention-section{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:24px;}'
    +'.sm3-attention-header{background:linear-gradient(135deg,rgba(240,192,64,.15) 0%,rgba(240,192,64,.05) 100%);padding:14px 20px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);}'
    +'.sm3-attention-header.done{background:linear-gradient(135deg,rgba(62,207,110,.15) 0%,rgba(62,207,110,.05) 100%);}'
    +'.sm3-attention-header.done .sm3-att-title{color:var(--heal);}'
    +'.sm3-att-title{font-size:14px;font-weight:600;color:var(--accent);}'
    +'.sm3-att-count{background:var(--accent);color:#000;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;}'
    +'.sm3-attention-item{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.06);transition:all .2s;}'
    +'.sm3-attention-item:last-child{border-bottom:none;}'
    +'.sm3-attention-item:hover{background:rgba(255,255,255,.02);}'
    +'.sm3-attention-item.resolved{background:rgba(62,207,110,.05);opacity:.7;}'
    +'.sm3-attention-ocr{font-family:monospace;font-size:15px;font-weight:600;color:var(--accent);min-width:140px;}'
    +'.sm3-attention-stats{display:flex;gap:16px;font-size:13px;font-family:monospace;}'
    +'.sm3-attention-stats .k{color:var(--dps);} .sm3-attention-stats .d{color:var(--color-assists);} .sm3-attention-stats .h{color:var(--heal);}'
    +'.sm3-action-row{display:flex;align-items:center;gap:10px;}'
    +'.sm3-action-row label{font-size:12px;color:var(--text-muted);min-width:90px;}'
    +'.sm3-member-dropdown{flex:1;max-width:260px;background:var(--bg-hover);border:1px solid var(--border);border-radius:6px;padding:10px 14px;color:var(--text);font-size:13px;cursor:pointer;}'
    +'.sm3-member-dropdown:focus{outline:none;border-color:var(--accent);}'
    +'.sm3-btn-confirm{background:var(--accent);color:#000;border:none;border-radius:6px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;}'
    +'.sm3-btn-confirm:hover{background:var(--accent-hover);}'
    +'.sm3-btn-confirm:disabled{background:var(--bg-hover);color:var(--text-muted);cursor:not-allowed;}'
    +'.sm3-toggle-options{display:flex;gap:16px;margin-top:8px;padding-top:12px;border-top:1px dashed var(--border);}'
    +'.sm3-toggle-option{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);cursor:pointer;padding:6px 12px;border-radius:6px;transition:all .15s;}'
    +'.sm3-toggle-option:hover{background:var(--bg-hover);color:var(--text);}'
    +'.sm3-toggle-option.active{background:rgba(240,192,64,.15);color:var(--accent);}'
    +'.sm3-toggle-option input{accent-color:var(--accent);}'
    +'.sm3-new-member-form{display:none;margin-top:12px;padding:14px;background:var(--bg-hover);border-radius:8px;border:1px solid var(--border);}'
    +'.sm3-new-member-form.show{display:block;}'
    +'.sm3-form-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}'
    +'.sm3-form-row:last-child{margin-bottom:0;}'
    +'.sm3-form-row label{font-size:12px;color:var(--text-muted);min-width:70px;}'
    +'.sm3-form-input{flex:1;max-width:200px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:13px;}'
    +'.sm3-form-input:focus{outline:none;border-color:var(--accent);}'
    +'.sm3-form-select{background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:13px;min-width:100px;}'
    +'.sm3-form-checkbox{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);}'
    +'.sm3-form-checkbox input{accent-color:var(--accent);width:16px;height:16px;}'
    +'.sm3-suggestion-hint{margin-top:8px;font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:6px;}'
    +'.sm3-suggestion-hint .match{color:var(--heal);font-weight:600;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;}'
    +'.sm3-suggestion-hint .match:hover{text-decoration-style:solid;}'
    +'.sm3-resolved-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(62,207,110,.2);color:var(--heal);padding:8px 14px;border-radius:6px;font-size:13px;font-weight:600;}'
    +'.sm3-resolved-badge .new-tag{background:var(--accent);color:#000;font-size:9px;padding:2px 6px;border-radius:4px;margin-left:4px;}'
    +'.sm3-all-done{text-align:center;padding:30px 20px;display:none;}'
    +'.sm3-all-done.show{display:block;}'
    +'.sm3-all-done h3{font-size:16px;font-weight:600;color:var(--heal);margin-bottom:4px;}'
    +'.sm3-all-done p{font-size:13px;color:var(--text-muted);}'
    +'.sm3-party-preview{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;margin-bottom:24px;}'
    +'.sm3-party-preview-header{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}'
    +'.sm3-party-preview-header h3{font-size:14px;font-weight:600;color:var(--text);}'
    +'.sm3-party-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--border);}'
    +'.sm3-party-card{background:var(--bg-card);padding:14px;}'
    +'.sm3-party-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border);}'
    +'.sm3-party-card-title{font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;}'
    +'.sm3-party-dot{width:10px;height:10px;border-radius:50%;display:inline-block;}'
    +'.sm3-party-member{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;}'
    +'.sm3-party-member .name{flex:1;}'
    +'.sm3-party-member .stats{font-family:monospace;font-size:10px;color:var(--text-muted);}'
    +'.sm3-party-member.new-match{background:rgba(240,192,64,.1);margin:0 -8px;padding:4px 8px;border-radius:4px;}'
    +'.sm3-footer{display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid var(--border);}'
    +'.sm3-btn-save{background:#3ecf6e;color:#000;border:none;border-radius:8px;padding:14px 32px;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;}'
    +'.sm3-btn-save:hover{transform:scale(1.02);box-shadow:0 4px 20px rgba(62,207,110,.3);}'
    +'.sm3-btn-save.pulse{animation:sm3pulse 2s infinite;}'
    +'@keyframes sm3pulse{0%,100%{box-shadow:0 0 0 0 rgba(62,207,110,.4);}50%{box-shadow:0 0 0 10px rgba(62,207,110,0);}}'
    +'.sm3-btn-secondary{background:transparent;border:1px solid var(--border);color:var(--text-muted);border-radius:8px;padding:14px 20px;font-size:13px;cursor:pointer;}'
    +'.sm3-btn-secondary:hover{border-color:var(--text-muted);color:var(--text);}'
    +'.sm3-editable-stat{cursor:pointer;padding:1px 3px;border-radius:3px;transition:background .15s;}'
    +'.sm3-editable-stat:hover{background:rgba(240,192,64,.15);}'
    +'.sm3-party-role-badge:hover span{filter:brightness(1.3);}'
    +'</style>';

  // ── MATCHED BANNER (green gradient, collapsed by default) ──
  html += '<div class="sm3-matched-banner" onclick="toggleMatchedV3()">'
    +'<div style="display:flex;align-items:center;gap:12px;">'
      +'<div style="width:40px;height:40px;background:rgba(62,207,110,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;">&#10003;</div>'
      +'<div>'
        +'<h3 style="font-size:15px;font-weight:600;color:var(--heal);margin:0 0 2px 0;">'+results.matched.length+' players matched automatically</h3>'
        +'<p style="font-size:12px;color:var(--text-muted);margin:0;">Stats linked to roster members</p>'
      +'</div>'
    +'</div>'
    +'<div style="color:var(--text-muted);font-size:12px;display:flex;align-items:center;gap:4px;">'
      +'<span id="sm3-expand-text">View all</span>'
      +'<span id="sm3-expand-arrow">&#9660;</span>'
    +'</div>'
  +'</div>';

  // ── MATCHED LIST (hidden by default, with editable stats) ──
  html += '<div class="sm3-matched-list" id="sm3-matched-list">';
  var maxShow = 7;
  results.matched.forEach(function(m, mi){
    if(mi >= maxShow) return;
    var role = m.member.role||'DPS';
    html += '<div class="sm3-matched-item">'
      +RoleBadge.inline(role)
      +'<span style="font-weight:600;min-width:100px;">'+escHtml(m.member.name)+'</span>'
      +'<span style="color:var(--text-muted);font-size:11px;font-family:monospace;margin-left:auto;">'
        +'<span class="sm3-editable-stat" onclick="editStatV3('+mi+',\'defeat\',this)" title="Click to edit">K:'+(m.stats.defeat||0)+'</span> '
        +'<span class="sm3-editable-stat" onclick="editStatV3('+mi+',\'assist\',this)" title="Click to edit">A:'+(m.stats.assist||0)+'</span> '
        +'<span class="sm3-editable-stat" onclick="editStatV3('+mi+',\'dmg_dealt\',this)" title="Click to edit">D:'+fmtShort(m.stats.dmg_dealt||0)+'</span> '
        +'<span class="sm3-editable-stat" onclick="editStatV3('+mi+',\'healed\',this)" title="Click to edit">H:'+fmtShort(m.stats.healed||0)+'</span>'
      +'</span>'
    +'</div>';
  });
  if(results.matched.length > maxShow){
    html += '<div style="padding:10px 16px;text-align:center;color:var(--text-muted);font-size:12px;">+ '+(results.matched.length - maxShow)+' more players</div>';
  }
  html += '</div>';

  // ── STATS SUMMARY TOTALS ──
  var totalKills=0, totalAssists=0, totalDamage=0, totalHealed=0;
  results.matched.forEach(function(m){
    totalKills += (m.stats.defeat||0);
    totalAssists += (m.stats.assist||0);
    totalDamage += (m.stats.dmg_dealt||0);
    totalHealed += (m.stats.healed||0);
  });
  html += StatsRow.summary(
    { defeat: totalKills, assist: totalAssists, dmg_dealt: totalDamage, healed: totalHealed },
    { ids: { kills: 'sm3-total-kills', assists: 'sm3-total-assists', damage: 'sm3-total-damage', healed: 'sm3-total-healed' } }
  );

  // ── NEEDS YOUR ATTENTION section ──
  html += '<div class="sm3-attention-section" id="sm3-attention-section">';
  html += '<div class="sm3-attention-header" id="sm3-attention-header">'
    +'<span style="font-size:18px;">&#9888;&#65039;</span>'
    +'<h3 class="sm3-att-title" id="sm3-attention-title">Needs your attention</h3>'
    +'<span class="sm3-att-count" id="sm3-attention-count">'+results.needsReview.length+'</span>'
  +'</div>';

  html += '<div id="sm3-attention-list">';
  results.needsReview.forEach(function(r,idx){
    // Build dropdown options
    var sugOpts = '';
    if(r.suggestions && r.suggestions.length){
      sugOpts += '<optgroup label="&#127919; Suggested">';
      r.suggestions.forEach(function(s){
        sugOpts += '<option value="'+escHtml(s.member.name)+'">'+escHtml(s.member.name)+' ('+s.matchedOn+')</option>';
      });
      sugOpts += '</optgroup>';
    }
    var allOpts = '<optgroup label="All members">';
    var usedNames = {};
    results.matched.forEach(function(m){ usedNames[m.member.name]=true; });
    if(_rosterCache) _rosterCache.forEach(function(m){
      if(m.active!==false && !usedNames[m.name]) allOpts += '<option value="'+escHtml(m.name)+'">'+escHtml(m.name)+'</option>';
    });
    allOpts += '</optgroup>';

    html += '<div class="sm3-attention-item" id="sm3-item-'+idx+'">'
      +'<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">'
        +'<span class="sm3-attention-ocr">'+escHtml(r.ocrName)+'</span>'
        +'<div class="sm3-attention-stats">'
          +'<span class="k">K:'+(r.stats.defeat||0)+'</span>'
          +'<span>A:'+(r.stats.assist||0)+'</span>'
          +'<span class="d">D:'+fmtShort(r.stats.dmg_dealt||0)+'</span>'
          +'<span class="h">H:'+fmtShort(r.stats.healed||0)+'</span>'
        +'</div>'
      +'</div>'
      +'<div class="sm3-attention-action" id="sm3-action-'+idx+'">'
        +'<div class="sm3-action-row">'
          +'<label>Assign to:</label>'
          +'<select class="sm3-member-dropdown" id="sm3-dropdown-'+idx+'" onchange="handleDropdownV3('+idx+')">'
            +'<option value="">Select member...</option>'
            +sugOpts+allOpts
          +'</select>'
          +'<button class="sm3-btn-confirm" id="sm3-btn-'+idx+'" disabled onclick="resolveItemV3('+idx+',\'existing\')">Confirm</button>'
        +'</div>'
        +'<div class="sm3-toggle-options">'
          +'<label class="sm3-toggle-option" onclick="toggleNewMemberV3('+idx+')">'
            +'<input type="radio" name="sm3-opt-'+idx+'" id="sm3-radio-new-'+idx+'">'
            +'<span>&#10133; Add as new member</span>'
          +'</label>'
          +'<label class="sm3-toggle-option" onclick="skipItemV3('+idx+')">'
            +'<input type="radio" name="sm3-opt-'+idx+'">'
            +'<span>&#9193;&#65039; Skip this player</span>'
          +'</label>'
        +'</div>'
        +'<div class="sm3-new-member-form" id="sm3-form-'+idx+'">'
          +'<div class="sm3-form-row">'
            +'<label>Name:</label>'
            +'<input type="text" class="sm3-form-input" id="sm3-name-'+idx+'" placeholder="Enter name..." value="'+escHtml(r.ocrName)+'">'
            +'<select class="sm3-form-select" id="sm3-role-'+idx+'">'
              +'<option value="DPS">DPS</option>'
              +'<option value="TANK">Tank</option>'
              +'<option value="HEALER">Healer</option>'
            +'</select>'
          +'</div>'
          +'<div class="sm3-form-row">'
            +'<label></label>'
            +'<label class="sm3-form-checkbox">'
              +'<input type="checkbox" id="sm3-alias-'+idx+'" checked>'
              +'Save "'+escHtml(r.ocrName)+'" as alias for auto-match next time'
            +'</label>'
          +'</div>'
          +'<div class="sm3-form-row">'
            +'<label></label>'
            +'<button class="sm3-btn-confirm" onclick="resolveItemV3('+idx+',\'new\')">Add &amp; Assign Stats</button>'
          +'</div>'
        +'</div>'
        +(r.suggestions&&r.suggestions.length
          ?'<div class="sm3-suggestion-hint">&#128161; This looks like <span class="match" onclick="selectSuggestionV3('+idx+',\''+escHtml(r.suggestions[0].member.name)+'\')">'+escHtml(r.suggestions[0].member.name)+'</span> &#8212; click to assign</div>'
          :'')
      +'</div>'
    +'</div>';
  });
  html += '</div>';

  // All Done State
  html += '<div class="sm3-all-done" id="sm3-all-done">'
    +'<div style="font-size:40px;margin-bottom:10px;">&#127881;</div>'
    +'<h3>All players identified!</h3>'
    +'<p>Review the party breakdown below and save</p>'
  +'</div>';

  html += '</div>'; // close attention section

  // ── PARTY BREAKDOWN (grid 2 columns) ──
  html += '<div class="sm3-party-preview" id="sm3-party-preview">';
  html += '<div class="sm3-party-preview-header">'
    +'<span style="font-size:18px;">&#128203;</span>'
    +'<h3>Party Breakdown</h3>'
  +'</div>';
  html += '<div class="sm3-party-grid">';
  var partyDotColors = PARTY_DOT_COLORS_SM3;
  // Build a lookup of matched stats by member name for party breakdown
  var matchedStatsLookup = {};
  results.matched.forEach(function(m){
    matchedStatsLookup[m.member.name] = m.stats;
    // Also index by normalized name for fuzzy matching
    matchedStatsLookup[normalizeName(m.member.name)] = m.stats;
  });

  state.parties.forEach(function(party,pi){
    if(isExtrasParty(party)) return;
    var dotColor = partyDotColors[pi % partyDotColors.length];

    // Build a fully-resolved stats lookup for this party (name → stats)
    var partyStatsLookup = {};
    party.members.forEach(function(pm){
      var s = matchedStatsLookup[pm.name] || matchedStatsLookup[normalizeName(pm.name)] || null;
      if(!s){
        for(var k=0;k<results.matched.length;k++){
          if(namesMatch(pm.name, results.matched[k].member.name)){ s = results.matched[k].stats; break; }
        }
      }
      if(s) partyStatsLookup[pm.name] = s;
    });

    var result = PartyCard(party, {
      variant: 'sm3', partyIndex: pi, dotColor: dotColor,
      memberStatsLookup: partyStatsLookup,
      newMembers: window._v3ManuallyAssigned
    });
    html += result.html;

    // Inject count after render via setTimeout
    setTimeout((function(idx, mc, total){
      return function(){
        var el = document.getElementById('sm3-party-count-'+idx);
        if(el) el.textContent = mc+'/'+total;
      };
    })(pi, result.matchedCount, party.members.length), 10);
  });
  html += '</div></div>';

  // ── FOOTER ──
  html += '<div class="sm3-footer">'
    +'<button class="sm3-btn-secondary" onclick="goBackToStep1()">&#8592; Back to Party Setup</button>'
    +'<div style="display:flex;gap:16px;align-items:center;">'
      +'<span style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;">&#128190; New aliases saved automatically</span>'
      +'<button class="sm3-btn-save" id="sm3-save-btn" onclick="saveWarWithStatsV3()">Save War &#8594;</button>'
    +'</div>'
  +'</div>';

  // Handle case where no needsReview items
  if(!results.needsReview.length){
    setTimeout(function(){
      var attHeader = document.getElementById('sm3-attention-header');
      var attList = document.getElementById('sm3-attention-list');
      var allDone = document.getElementById('sm3-all-done');
      var countEl = document.getElementById('sm3-attention-count');
      var titleEl = document.getElementById('sm3-attention-title');
      if(attHeader) attHeader.classList.add('done');
      if(attList) attList.style.display = 'none';
      if(allDone) allDone.classList.add('show');
      if(countEl) countEl.style.display = 'none';
      if(titleEl) titleEl.textContent = 'All done!';
      var saveBtn = document.getElementById('sm3-save-btn');
      if(saveBtn) saveBtn.classList.add('pulse');
    }, 50);
  }

  return html;
}

// ── V3 Interaction Functions ──

function toggleMatchedV3(){
  var list = document.getElementById('sm3-matched-list');
  var text = document.getElementById('sm3-expand-text');
  var arrow = document.getElementById('sm3-expand-arrow');
  if(!list) return;
  list.classList.toggle('show');
  if(text) text.textContent = list.classList.contains('show') ? 'Hide' : 'View all';
  if(arrow) arrow.innerHTML = list.classList.contains('show') ? '&#9650;' : '&#9660;';
}

function handleDropdownV3(idx){
  var dropdown = document.getElementById('sm3-dropdown-'+idx);
  var btn = document.getElementById('sm3-btn-'+idx);
  if(!dropdown || !btn) return;
  btn.disabled = !dropdown.value;
  // Hide new member form if showing
  var form = document.getElementById('sm3-form-'+idx);
  var radio = document.getElementById('sm3-radio-new-'+idx);
  if(form) form.classList.remove('show');
  if(radio) radio.checked = false;
}

function toggleNewMemberV3(idx){
  var form = document.getElementById('sm3-form-'+idx);
  var radio = document.getElementById('sm3-radio-new-'+idx);
  if(!form) return;
  if(form.classList.contains('show')){
    form.classList.remove('show');
    if(radio) radio.checked = false;
  } else {
    form.classList.add('show');
    if(radio) radio.checked = true;
    // Clear dropdown
    var dropdown = document.getElementById('sm3-dropdown-'+idx);
    var btn = document.getElementById('sm3-btn-'+idx);
    if(dropdown) dropdown.value = '';
    if(btn) btn.disabled = true;
  }
}

function selectSuggestionV3(idx, memberName){
  var dropdown = document.getElementById('sm3-dropdown-'+idx);
  if(!dropdown) return;
  dropdown.value = memberName;
  handleDropdownV3(idx);
  setTimeout(function(){ resolveItemV3(idx, 'existing'); }, 300);
}

function skipItemV3(idx){
  var item = document.getElementById('sm3-item-'+idx);
  var action = document.getElementById('sm3-action-'+idx);
  if(!item || !action) return;
  action.innerHTML = '<span class="sm3-resolved-badge" style="background:rgba(136,136,136,.2);color:var(--text-muted);">&#9193;&#65039; Skipped</span>';
  item.classList.add('resolved');
  window._v3ResolvedItems[idx] = {type:'skip'};
  updateAttentionCountV3();
}

function resolveItemV3(idx, type){
  var item = document.getElementById('sm3-item-'+idx);
  var action = document.getElementById('sm3-action-'+idx);
  if(!item || !action || !window._currentMatchResults) return;
  var review = window._currentMatchResults.needsReview[idx];
  if(!review) return;

  var memberName = '';
  var isNew = false;
  var member = null;

  if(type === 'existing'){
    var dropdown = document.getElementById('sm3-dropdown-'+idx);
    if(!dropdown || !dropdown.value) return;
    memberName = dropdown.value;
    member = _rosterCache ? _rosterCache.find(function(m){return m.name===memberName;}) : null;

    // Save alias if it's a match
    if(member){
      var key = normalizeName(member.name);
      if(!_memberAliases[key] || _memberAliases[key] !== review.ocrName){
        _memberAliases[key] = review.ocrName;
        // Save aliases to backend
        try{ apiPut('/api/aliases/member',_memberAliases); }catch(e){}
      }
    }

    // Move to matched in results
    window._currentMatchResults.matched.push({
      ocrName: review.ocrName, member: member || {name:memberName,role:'DPS'}, stats: review.stats, confidence: 'manual'
    });
    window._currentMatchResults.notInScoreboard = window._currentMatchResults.notInScoreboard.filter(function(n){return n.member.name!==memberName;});

    // Update novaPlayers
    var np = state.novaPlayers.find(function(p){return p.name===review.ocrName;});
    if(np){ np.name = memberName; np.status='confirmed'; np.checked=true; }

    window._v3ManuallyAssigned[memberName] = true;
  } else {
    // New member
    var nameInput = document.getElementById('sm3-name-'+idx);
    var roleSelect = document.getElementById('sm3-role-'+idx);
    var aliasCheck = document.getElementById('sm3-alias-'+idx);
    memberName = (nameInput && nameInput.value) ? nameInput.value.trim() : review.ocrName;
    var role = (roleSelect && roleSelect.value) ? roleSelect.value : 'DPS';
    isNew = true;

    // Create new member object
    member = {name: memberName, role: role, active: true};

    // Save alias if checked
    if(aliasCheck && aliasCheck.checked){
      var key2 = normalizeName(memberName);
      _memberAliases[key2] = review.ocrName;
      try{ apiPut('/api/aliases/member',_memberAliases); }catch(e){}
    }

    // Add to roster cache
    if(_rosterCache){
      _rosterCache.push(member);
      // Also save roster
      try{ apiPut('/api/roster',_rosterCache); }catch(e){}
    }

    // Move to matched
    window._currentMatchResults.matched.push({
      ocrName: review.ocrName, member: member, stats: review.stats, confidence: 'manual'
    });

    // Update novaPlayers
    var np2 = state.novaPlayers.find(function(p){return p.name===review.ocrName;});
    if(np2){ np2.name = memberName; np2.role = role; np2.status='confirmed'; np2.checked=true; }

    window._v3ManuallyAssigned[memberName] = true;
  }

  action.innerHTML = '<span class="sm3-resolved-badge">&#10003; Assigned to '+escHtml(memberName)+(isNew?'<span class="new-tag">NEW</span>':'')+'</span>';
  item.classList.add('resolved');
  window._v3ResolvedItems[idx] = {type:type, memberName:memberName, member:member, isNew:isNew};

  updateAttentionCountV3();
  updatePartyPreviewV3();
}

function updateAttentionCountV3(){
  if(!window._currentMatchResults) return;
  var total = window._currentMatchResults.needsReview.length;
  var resolved = Object.keys(window._v3ResolvedItems).length;
  var remaining = total - resolved;

  var countEl = document.getElementById('sm3-attention-count');
  if(countEl) countEl.textContent = remaining;

  if(remaining <= 0){
    var attList = document.getElementById('sm3-attention-list');
    var allDone = document.getElementById('sm3-all-done');
    var attHeader = document.getElementById('sm3-attention-header');
    var titleEl = document.getElementById('sm3-attention-title');
    var iconEl = attHeader ? attHeader.querySelector('span') : null;

    if(attList) attList.style.display = 'none';
    if(allDone) allDone.classList.add('show');
    if(attHeader) attHeader.classList.add('done');
    if(countEl) countEl.style.display = 'none';
    if(titleEl) titleEl.textContent = 'All done!';
    if(iconEl) iconEl.textContent = '\u2705';
    var saveBtn = document.getElementById('sm3-save-btn');
    if(saveBtn) saveBtn.classList.add('pulse');
  }
}

function updatePartyPreviewV3(){
  // Rebuild party preview based on current matched results
  if(!window._currentMatchResults) return;

  // Build matched stats lookup
  var matchedStatsLookup = {};
  window._currentMatchResults.matched.forEach(function(m){
    matchedStatsLookup[m.member.name] = m.stats;
    matchedStatsLookup[normalizeName(m.member.name)] = m.stats;
  });

  state.parties.forEach(function(party,pi){
    if(isExtrasParty(party)) return;
    var container = document.getElementById('sm3-party-members-'+pi);
    if(!container) return;

    // Build fully-resolved stats lookup for this party
    var partyStatsLookup = {};
    party.members.forEach(function(pm){
      var s = matchedStatsLookup[pm.name] || matchedStatsLookup[normalizeName(pm.name)] || null;
      if(!s){
        for(var k=0;k<window._currentMatchResults.matched.length;k++){
          if(namesMatch(pm.name, window._currentMatchResults.matched[k].member.name)){ s = window._currentMatchResults.matched[k].stats; break; }
        }
      }
      if(s) partyStatsLookup[pm.name] = s;
    });

    var result = PartyCard.sm3Members(party, {
      partyIndex: pi,
      memberStatsLookup: partyStatsLookup,
      newMembers: window._v3ManuallyAssigned
    });
    container.innerHTML = result.html;

    // Update count
    var countEl = document.getElementById('sm3-party-count-'+pi);
    if(countEl) countEl.textContent = result.matchedCount+'/'+party.members.length;
    var headerEl = container.parentElement.querySelector('.sm3-party-card-header span:last-child');
    if(headerEl) headerEl.textContent = result.matchedCount+'/'+party.members.length;
  });

  // Also update summary totals
  updateSummaryTotalsV3();
}

// ── V3: Cycle role on party member badge (DPS→TANK→HEALER→DPS) ──
function cyclePartyRoleV3(partyIdx, memberIdx){
  var party = state.parties[partyIdx];
  if(!party || !party.members[memberIdx]) return;
  var m = party.members[memberIdx];
  var cur = m.role||'DPS';
  m.role = nextRole(cur);
  // Also update in matched results if present
  if(window._currentMatchResults){
    window._currentMatchResults.matched.forEach(function(mr){
      if(mr.member.name===m.name || namesMatch(mr.member.name, m.name)){
        mr.member.role = next;
      }
    });
  }
  updatePartyPreviewV3();
}

// ── V3: Edit stat value inline in matched list ──
function editStatV3(matchIdx, field, spanEl){
  if(!window._currentMatchResults) return;
  var m = window._currentMatchResults.matched[matchIdx];
  if(!m) return;
  var labels = {defeat:'K',assist:'A',dmg_dealt:'D',healed:'H'};
  var label = labels[field]||field;
  var curVal = m.stats[field]||0;
  var input = document.createElement('input');
  input.type = 'number';
  input.value = curVal;
  input.style.cssText = 'width:60px;background:var(--bg-hover);border:1px solid var(--accent);border-radius:4px;color:var(--text);font-size:11px;font-family:monospace;padding:2px 4px;text-align:right;';
  var commit = function(){
    var val = parseInt(input.value)||0;
    if(val<0) val=0;
    m.stats[field] = val;
    spanEl.textContent = label+':'+fmtShort(val);
    updateSummaryTotalsV3();
    updatePartyPreviewV3();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', function(e){
    if(e.key==='Enter'){ e.preventDefault(); commit(); }
    if(e.key==='Escape'){ spanEl.textContent = label+':'+fmtShort(curVal); }
  });
  spanEl.textContent = '';
  spanEl.appendChild(document.createTextNode(label+':'));
  spanEl.appendChild(input);
  input.focus();
  input.select();
}

// ── V3: Update summary totals from current matched results ──
function updateSummaryTotalsV3(){
  if(!window._currentMatchResults) return;
  var totalKills=0, totalAssists=0, totalDamage=0, totalHealed=0;
  window._currentMatchResults.matched.forEach(function(m){
    totalKills += (m.stats.defeat||0);
    totalAssists += (m.stats.assist||0);
    totalDamage += (m.stats.dmg_dealt||0);
    totalHealed += (m.stats.healed||0);
  });
  var el;
  el = document.getElementById('sm3-total-kills');   if(el) el.textContent = fmtShort(totalKills);
  el = document.getElementById('sm3-total-assists'); if(el) el.textContent = fmtShort(totalAssists);
  el = document.getElementById('sm3-total-damage');  if(el) el.textContent = fmtShort(totalDamage);
  el = document.getElementById('sm3-total-healed');  if(el) el.textContent = fmtShort(totalHealed);
}

// ── Save War V3: builds confirmed state from match results ──
function saveWarWithStatsV3(){
  if(!window._currentMatchResults) return;

  // Build confirmed list from matched results
  state.confirmed = [];
  window._currentMatchResults.matched.forEach(function(m){
    var existing = state.novaPlayers.find(function(p){ return p.name === m.member.name || p.name === m.ocrName; });
    state.confirmed.push({
      name: m.member.name,
      party: existing ? existing.party : '?',
      role: m.member.role || 'DPS',
      defeat: m.stats.defeat || 0,
      assist: m.stats.assist || 0,
      dmg_dealt: m.stats.dmg_dealt || 0,
      dmg_taken: m.stats.dmg_taken || 0,
      healed: m.stats.healed || 0,
      checked: true,
      status: 'confirmed'
    });
  });

  // Merge stats into parties
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

  // Collect matched players without party assignment as unassigned extras
  var assignedNames = {};
  state.parties.forEach(function(p){
    p.members.forEach(function(m){ assignedNames[m.name.toLowerCase()] = true; });
  });

  state._unassignedExtras = [];
  state.confirmed.forEach(function(c){
    if(!assignedNames[c.name.toLowerCase()]){
      state._unassignedExtras.push(c);
    }
  });

  state.novaPlayers = state.confirmed;
  saveWarSimple();
}

// Keep backward compatibility
function assignReviewMember(idx){ resolveItemV3(idx, 'existing'); }
function cycleMatchedRole(idx){}
function assignMatchedParty(idx,partyName){}
function assignExtraToParty(i, partyName){
  if(!partyName) return;
  state.novaPlayers[i].party   = partyName;
  state.novaPlayers[i].extra   = false;
  state.novaPlayers[i].status  = 'confirmed';
  state.novaPlayers[i].checked = true;
  renderStatsList();
}

function togglePlayer(i,v){ state.novaPlayers[i].checked=v; }
function setPlayerStat(i,key,v){ state.novaPlayers[i][key]=v; }

function confirmNovaPlayers(){
  state.confirmed = state.novaPlayers.filter(function(p){return p.checked;});
  goStep(4);
}

// Alias for old renderStatsMatchingUI calls
function renderStatsMatchingUI(results){ return renderStatsMatchingV3(results); }
