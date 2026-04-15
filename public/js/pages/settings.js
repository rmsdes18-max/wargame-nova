
function logout(){
  localStorage.removeItem('nova_token');
  localStorage.removeItem('nova_user');
  localStorage.removeItem('nova_guild_id');
  _userRole = 'viewer';
  _userName = '';
  _userAvatar = '';
  _authToken = '';
  _currentGuildId = '';
  _guilds = [];
  // Hide guild nav items
  document.querySelectorAll('.guild-nav').forEach(function(el){ el.style.display = 'none'; });
  updateUIForRole();
  showAppShell(false);
}

// ── SHARE WAR ─────────────────────────────────────────────────────────────
function shareWar(warId){
  var url = window.location.origin + window.location.pathname + '#war-' + warId;
  navigator.clipboard.writeText(url).then(function(){
    // Brief visual feedback
    var btn = event.target;
    var orig = btn.textContent;
    btn.textContent = '\u2713 Copied!';
    setTimeout(function(){ btn.textContent = orig; }, 1500);
  }).catch(function(){
    prompt('Copy this link:', url);
  });
}

// ── EXPORT WAR AS IMAGE ───────────────────────────────────────────────────
function exportWarImage(){
  var el = document.getElementById('view-war-content');
  if(!el) return;
  html2canvas(el, {backgroundColor:'var(--bg)', scale:2}).then(function(canvas){
    var link = document.createElement('a');
    link.download = 'war-export.png';
    link.href = canvas.toDataURL();
    link.click();
  });
}

// ── USER MANAGEMENT ───────────────────────────────────────────────────────
function renderUsersList(){
  if(_userRole !== 'admin') return;
  var section = document.getElementById('users-section');
  if(section) section.style.display = '';
  apiGet('/api/users', {fallback: []}).then(function(users){
      var html = '';
      users.forEach(function(u){
        var avatarHtml = u.avatar
          ? '<img src="'+escHtml(u.avatar)+'" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;">'
          : '<div style="width:32px;height:32px;border-radius:50%;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--text-muted);flex-shrink:0;">'+escHtml(u.username.charAt(0).toUpperCase())+'</div>';

        var discordBadge = u.discord_id
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="#5865F2" style="flex-shrink:0;" title="Discord"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>'
          : '';

        var dateStr = '';
        if(u.created_at){
          var d = new Date(u.created_at);
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          dateStr = d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear();
        }

        var roleSelect = '';
        if(u.role !== 'admin'){
          roleSelect = '<select class="select" onchange="changeUserRole('+u.id+',this.value)">'
            +'<option value="viewer"'+(u.role==='viewer'?' selected':'')+'>Viewer</option>'
            +'<option value="editor"'+(u.role==='editor'?' selected':'')+'>Editor</option>'
            +'</select>';
        } else {
          roleSelect = '<span class="badge badge-pill badge-admin">ADMIN</span>';
        }

        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);">'
          +avatarHtml
          +'<div style="flex:1;min-width:0;">'
            +'<div style="display:flex;align-items:center;gap:6px;">'
              +'<span style="font-weight:600;color:var(--text);font-size:13px;">'+escHtml(u.username)+'</span>'
              +discordBadge
            +'</div>'
            +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Joined '+dateStr+'</div>'
          +'</div>'
          +roleSelect
          +(u.role!=='admin'?'<button onclick="deleteUser('+u.id+')" style="background:transparent;border:none;color:var(--dps);cursor:pointer;font-size:16px;padding:2px 6px;" title="Remove user">\u00d7</button>':'')
          +'</div>';
      });
      document.getElementById('users-list').innerHTML = html || '<div style="color:var(--text-muted);font-size:12px;">No users yet</div>';
    });
}

function changeUserRole(id, newRole){
  apiPatch('/api/users/'+id,{role:newRole})
    .then(function(r){ if(!r.ok) Toast.error('Failed to update role'); })
    .then(function(){ renderUsersList(); });
}

function deleteUser(id){
  if(!confirm('Delete this user?')) return;
  apiDelete('/api/users/'+id)
    .then(function(){ renderUsersList(); });
}

// ── AUTH ──────────────────────────────────────────────────────────────────
// ── GUILD MANAGEMENT ─────────────────────────────────────────────────────
var _tlServers = null;

function showOnboardForm(type){
  document.getElementById('onboard-create-form').style.display = type==='create' ? '' : 'none';
  document.getElementById('onboard-join-form').style.display = type==='join' ? '' : 'none';
  document.getElementById('onboard-create').style.borderColor = type==='create' ? 'var(--accent)' : '';
  document.getElementById('onboard-join').style.borderColor = type==='join' ? 'var(--accent)' : '';
  if(type==='create') loadTlServers();
}

async function loadTlServers(){
  if(_tlServers) return;
  try{
    var r = await fetch('/api/guilds/servers');
    if(r.ok) _tlServers = await r.json();
  }catch(e){}
  var sel = document.getElementById('create-guild-region');
  if(!_tlServers || !_tlServers.regions){ sel.innerHTML='<option value="">Failed to load</option>'; return; }
  sel.innerHTML = '<option value="">— Select Region —</option>';
  _tlServers.regions.forEach(function(reg){
    sel.innerHTML += '<option value="'+reg.slug+'">'+reg.name+' ('+reg.servers.length+' servers)</option>';
  });
}

function loadServersForRegion(){
  var region = document.getElementById('create-guild-region').value;
  var btn = document.getElementById('create-next-1');
  btn.disabled = !region;
  var serverSel = document.getElementById('create-guild-server');
  serverSel.innerHTML = '<option value="">Select server...</option>';
  if(!region || !_tlServers) return;
  var reg = _tlServers.regions.find(function(r){ return r.slug === region; });
  if(!reg) return;
  reg.servers.forEach(function(s){
    var statusIcon = s.status==='online'?'🟢':s.status==='busy'?'🟡':s.status==='full'?'🔴':'⚪';
    serverSel.innerHTML += '<option value="'+s.name+'">'+statusIcon+' '+s.name+'</option>';
  });
}

function showCreateStep(step){
  document.getElementById('create-step-1').style.display = step===1?'':'none';
  document.getElementById('create-step-2').style.display = step===2?'':'none';
  document.getElementById('create-step-3').style.display = step===3?'':'none';
}

async function doCreateGuild(){
  var name = document.getElementById('create-guild-name').value.trim();
  var region = document.getElementById('create-guild-region').value;
  var server = document.getElementById('create-guild-server').value;
  showError('create-guild-error');
  if(!name){ showError('create-guild-error','Guild name required'); return; }
  try{
    var r = await apiPost('/api/guilds',{name:name,region:region||undefined,server:server||undefined});
    var data = await r.json();
    if(r.status===401){ handleExpiredSession(); return; }
    if(!r.ok){ showError('create-guild-error',data.error||'Failed'); return; }
    setCurrentGuild(data.id);
    _guilds.push(data);
    enterGuild(data);
  }catch(e){ showError('create-guild-error',e.message); }
}

async function doJoinGuild(){
  var code = document.getElementById('join-guild-code').value.trim();
  showError('join-guild-error');
  if(!code){ showError('join-guild-error','Invite code required'); return; }
  try{
    var r = await apiPost('/api/guilds/join',{code:code});
    var data = await r.json();
    if(r.status===401){ handleExpiredSession(); return; }
    if(!r.ok){ showError('join-guild-error',data.error||'Failed'); return; }
    setCurrentGuild(data.guild.id);
    await loadGuilds();
    enterGuild(data.guild);
  }catch(e){ showError('join-guild-error',e.message); }
}

async function loadGuilds(){
  try{
    var r = await fetch('/api/guilds',{headers:apiHeaders()});
    if(r.status===401){ handleExpiredSession(); return; }
    if(r.ok) _guilds = await r.json();
    else _guilds = [];
  }catch(e){ _guilds = []; }
}

function enterGuild(guild){
  setCurrentGuild(guild.id);
  _currentGuildName = guild.name || 'Guild';
  // Update topbar guild name
  var nameEl = document.getElementById('topbar-guild-name');
  if(nameEl) nameEl.textContent = _currentGuildName;
  // Show guild nav items
  document.querySelectorAll('.guild-nav').forEach(function(el){ el.style.display = ''; });
  // Find user's role in this guild
  var guildData = _guilds.find(function(g){ return g.id === guild.id; });
  if(guildData) _userRole = guildData.role || 'viewer';
  updateUIForRole();
  // Show sidebar + topbar, remove sidebar-hidden
  var sidebar = document.getElementById('sidebar');
  var topbar = document.querySelector('.topbar');
  if(sidebar) sidebar.style.display = '';
  if(topbar) topbar.style.display = '';
  document.body.classList.remove('sidebar-hidden');
  showPage('wars');
  loadGuildData();
}

async function loadGuildData(){
  try{
    var results = await Promise.all([
      apiGet('/api/wars'),
      apiGet('/api/aliases/war'),
      apiGet('/api/roster'),
      apiGet('/api/aliases/member')
    ]);
    if(results[0]) _warsCache   = results[0];
    if(results[1]) _aliasCache  = results[1];
    if(results[2]) _rosterCache = results[2];
    if(results[3]){ _mAliasCache = results[3]; _memberAliases = results[3]; }
  }catch(e){ console.warn('Failed to load guild data',e); }
  renderWarsList();
}

function hideAppChrome(){
  var sidebar = document.getElementById('sidebar');
  var topbar = document.querySelector('.topbar');
  if(sidebar) sidebar.style.display = 'none';
  if(topbar) topbar.style.display = 'none';
  document.body.classList.add('sidebar-hidden');
}

async function handleGuildRouting(){
  await loadGuilds();
  if(!_guilds.length){
    hideAppChrome();
    showPage('guild-onboarding');
    return;
  }
  var saved = _guilds.find(function(g){ return g.id === _currentGuildId; });
  if(saved){
    enterGuild(saved);
    return;
  }
  if(_guilds.length === 1){
    enterGuild(_guilds[0]);
    return;
  }
  hideAppChrome();
  renderGuildPicker();
  showPage('guild-picker');
}

function renderGuildPicker(){
  var el = document.getElementById('guild-picker-list');
  if(!el) return;
  el.innerHTML = _guilds.map(function(g){
    return '<div onclick="enterGuild({id:\''+g.id+'\',name:\''+escHtml(g.name)+'\'})" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'\'">'
      +'<div style="width:40px;height:40px;border-radius:8px;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-family:Rajdhani,sans-serif;font-size:18px;font-weight:700;color:var(--accent);">'+escHtml(g.name.charAt(0).toUpperCase())+'</div>'
      +'<div style="flex:1;">'
        +'<div style="font-weight:600;color:var(--text);font-size:14px;">'+escHtml(g.name)+'</div>'
        +'<div style="font-size:11px;color:var(--text-muted);">'+g.member_count+' members · '+g.role+'</div>'
      +'</div>'
      +'<span style="font-size:10px;padding:2px 8px;border-radius:3px;font-weight:600;'
        +(g.tier==='pro'?'background:rgba(212,225,87,.15);color:var(--accent);':'background:rgba(255,255,255,.06);color:var(--text-muted);')
      +'">'+g.tier.toUpperCase()+'</span>'
      +'</div>';
  }).join('');
}

// ── GUILD SETTINGS ──
async function initGuildSettings(){
  if(!_currentGuildId) return;
  try{
    var r = await fetch('/api/guilds/'+_currentGuildId,{headers:apiHeaders()});
    if(!r.ok) return;
    var data = await r.json();
    document.getElementById('gs-guild-name').value = data.name;
    document.getElementById('gs-invite-code').textContent = data.invite_code;
    // Set default invite role
    var defRole = (data.settings && data.settings.default_invite_role) || 'viewer';
    var defRoleSel = document.getElementById('gs-default-role');
    if(defRoleSel) defRoleSel.value = defRole;
    var tierEl = document.getElementById('gs-tier');
    tierEl.textContent = data.tier.toUpperCase();
    tierEl.style.background = data.tier==='pro'?'rgba(212,225,87,.15)':'rgba(255,255,255,.06)';
    tierEl.style.color = data.tier==='pro'?'var(--accent)':'var(--text-muted)';

    // Render members
    var html = '';
    (data.members||[]).forEach(function(m){
      var avatarHtml = m.avatar
        ? '<img src="'+escHtml(m.avatar)+'" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;">'
        : '<div style="width:32px;height:32px;border-radius:50%;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--text-muted);flex-shrink:0;">'+escHtml(m.username.charAt(0).toUpperCase())+'</div>';

      var discordBadge = m.discord_id ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>' : '';

      var d = m.joined_at ? new Date(m.joined_at) : null;
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var dateStr = d ? d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear() : '';

      var roleSelect = '';
      if(m.role !== 'admin' || data.your_role === 'admin'){
        if(m.id !== data.owner_id && data.your_role === 'admin'){
          roleSelect = '<select class="select" onchange="changeGuildMemberRole('+m.id+',this.value)">'
            +'<option value="viewer"'+(m.role==='viewer'?' selected':'')+'>Viewer</option>'
            +'<option value="editor"'+(m.role==='editor'?' selected':'')+'>Editor</option>'
            +'<option value="admin"'+(m.role==='admin'?' selected':'')+'>Admin</option>'
            +'</select>';
        } else {
          var roleCls = m.role === 'admin' ? 'admin' : m.role === 'editor' ? 'editor' : 'viewer';
          roleSelect = '<span class="badge badge-' + roleCls + '">'+m.role.toUpperCase()+'</span>';
        }
      }

      var kickBtn = '';
      if(data.your_role === 'admin' && m.id !== data.owner_id && m.id !== (typeof _userId!=='undefined'?_userId:null)){
        kickBtn = '<button onclick="kickGuildMember('+m.id+',\''+escHtml(m.username)+'\')" style="background:transparent;border:none;color:var(--dps);cursor:pointer;font-size:14px;padding:2px 6px;" title="Kick">\u00d7</button>';
      }

      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);">'
        +avatarHtml
        +'<div style="flex:1;min-width:0;">'
          +'<div style="display:flex;align-items:center;gap:5px;">'
            +'<span style="font-weight:600;color:var(--text);font-size:13px;">'+escHtml(m.username)+'</span>'
            +discordBadge
            +(m.id===data.owner_id?'<span class="badge badge-pill badge-admin">OWNER</span>':'')
          +'</div>'
          +'<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Joined '+dateStr+'</div>'
        +'</div>'
        +roleSelect
        +kickBtn
        +'</div>';
    });
    document.getElementById('gs-members-list').innerHTML = html || EmptyState.inline('No members');
  }catch(e){ console.error('Guild settings error',e); }
}


// ── Additional Guild Settings functions ──
async function updateDefaultInviteRole(role){
  try{
    var r = await apiPatch('/api/guilds/'+_currentGuildId,{settings:{default_invite_role:role}});
    if(!r.ok){ var d=await r.json(); Toast.error(d.error||'Failed'); }
  }catch(e){ Toast.error(e.message); }
}

async function renameGuild(){
  var name = document.getElementById('gs-guild-name').value.trim();
  if(!name) return;
  try{
    var r = await apiPatch('/api/guilds/'+_currentGuildId,{name:name});
    if(!r.ok){ var d=await r.json(); Toast.error(d.error||'Failed'); return; }
    // Update topbar
    var nameEl = document.getElementById('topbar-guild-name');
    if(nameEl) nameEl.textContent = name;
    // Update guilds cache
    var g = _guilds.find(function(g){ return g.id === _currentGuildId; });
    if(g) g.name = name;
  }catch(e){ Toast.error(e.message); }
}

async function changeGuildMemberRole(userId, newRole){
  if(newRole === 'admin'){
    if(!confirm('Are you sure you want to make this member an ADMIN?\n\nAdmins have full control over the guild: manage members, settings, and data.\n\nThis action can only be reversed by another admin.')) return;
  }
  try{
    var r = await apiPost('/api/guilds/'+_currentGuildId+'/members/'+userId+'/role',{role:newRole});
    if(!r.ok){ var d=await r.json(); Toast.error(d.error||'Failed'); }
    initGuildSettings();
  }catch(e){ Toast.error(e.message); }
}

async function kickGuildMember(userId, username){
  if(!confirm('Kick '+username+' from guild?')) return;
  try{
    await apiDelete('/api/guilds/'+_currentGuildId+'/members/'+userId);
    initGuildSettings();
  }catch(e){ Toast.error(e.message); }
}

function copyInviteCode(){
  var code = document.getElementById('gs-invite-code').textContent;
  navigator.clipboard.writeText(code).then(function(){
    document.getElementById('gs-invite-code').style.color='var(--heal)';
    setTimeout(function(){ document.getElementById('gs-invite-code').style.color='var(--accent)'; },1000);
  });
}

async function generateInviteLink(){
  var hours = document.getElementById('invite-expires').value;
  var role = document.getElementById('invite-link-role').value || 'viewer';
  var resEl = document.getElementById('invite-link-result');
  try{
    var body = { default_role: role };
    if(hours) body.expires_hours = parseInt(hours);
    var r = await apiPost('/api/guilds/'+_currentGuildId+'/invite',body);
    var data = await r.json();
    if(!r.ok){ resEl.style.display='';resEl.innerHTML='<span style="color:var(--dps);">'+escHtml(data.error)+'</span>'; return; }
    resEl.style.display='';
    resEl.innerHTML='<div style="color:var(--accent);margin-bottom:4px;">Invite code: <code style="color:var(--text);background:var(--bg);padding:2px 6px;border-radius:3px;">'+escHtml(data.code)+'</code> <span style="font-size:10px;color:var(--text-muted);">(joins as '+escHtml(data.default_role||'viewer')+')</span></div>'
      +(data.expires_at?'<div style="font-size:10px;color:var(--text-muted);">Expires: '+new Date(data.expires_at).toLocaleString()+'</div>':'');
  }catch(e){ resEl.style.display='';resEl.textContent=e.message; }
}

async function leaveCurrentGuild(){
  if(!confirm('Leave this guild? You will lose access to all guild data.')) return;
  try{
    var r = await apiPost('/api/guilds/'+_currentGuildId+'/leave',{});
    if(!r.ok){ var d=await r.json(); Toast.error(d.error||'Failed'); return; }
    localStorage.removeItem('nova_guild_id');
    _currentGuildId = '';
    handleGuildRouting();
  }catch(e){ Toast.error(e.message); }
}

function showAppShell(loggedIn){
  if(loggedIn){
    // handleGuildRouting decides what to show
    handleGuildRouting();
  } else {
    hideAppChrome();
    showPage('login');
  }
}

function checkAuth(){
  // Check if Discord just redirected back with a token
  var hash = window.location.hash;
  if(hash.startsWith('#auth=')){
    var token = hash.replace('#auth=','');
    localStorage.setItem('nova_token', token);
    window.location.hash = ''; // clean URL
  }

  // Load stored token
  _authToken = localStorage.getItem('nova_token') || '';
  if(_authToken){
    // Verify token with API
    safeFetch('/api/auth/me', {headers:{'Authorization':'Bearer '+_authToken}})
      .then(function(u){
        if(u){
          _userRole = u.role || 'viewer';
          _userName = u.username || '';
          _userAvatar = u.avatar || '';
          showAppShell(true);
        } else {
          // Invalid token
          localStorage.removeItem('nova_token');
          _authToken = '';
          _userRole = 'viewer';
          showAppShell(false);
        }
        updateUIForRole();
      }).catch(function(){ showAppShell(false); updateUIForRole(); });
  } else {
    // Check legacy admin secret
    var sec = localStorage.getItem('nova_admin_secret');
    if(sec){
      _userRole = 'admin';
      _userName = 'Admin';
      _authToken = sec;
      showAppShell(true);
    } else {
      showAppShell(false);
    }
    updateUIForRole();
  }
}

