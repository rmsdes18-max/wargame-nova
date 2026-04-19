/* ── COMPARE WARS PAGE ── */

var _compareSelected = {};
var _compareChart = null;

function initComparePage(){
  _compareSelected = {};
  renderWarSelector();
  document.getElementById('compare-table-wrap').innerHTML = '';
  document.getElementById('compare-chart-wrap').innerHTML = '';
}

/* ── War Selector ── */

function renderWarSelector(){
  var wars = loadWars();
  if(!wars || !wars.length){
    document.getElementById('compare-war-selector').innerHTML = EmptyState({
      icon: '&#9878;', title: 'No wars to compare',
      description: 'Create at least 2 wars to start comparing player performance.',
      padding: '40px 20px'
    });
    return;
  }

  var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">';
  html += '<span style="font-size:13px;font-weight:600;color:var(--text);">Select wars:</span>';
  html += '<button onclick="selectAllCompareWars()" class="btn btn-secondary" style="font-size:11px;padding:3px 10px;">All</button>';
  html += '<button onclick="deselectAllCompareWars()" class="btn btn-secondary" style="font-size:11px;padding:3px 10px;">None</button>';
  html += '</div>';

  html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
  wars.forEach(function(w){
    var sel = _compareSelected[w.id];
    var totalK = 0;
    if(w.parties) w.parties.forEach(function(p){
      p.members.forEach(function(m){ totalK += m.defeat || 0; });
    });
    html += '<label style="display:flex;align-items:center;gap:6px;padding:8px 14px;'
      + 'background:' + (sel ? 'rgba(212,225,87,.15)' : 'var(--bg-hover)') + ';'
      + 'border:1px solid ' + (sel ? 'var(--accent)' : 'var(--border)') + ';'
      + 'border-radius:8px;cursor:pointer;font-size:12px;transition:all .15s;">';
    html += '<input type="checkbox" onchange="toggleCompareWar(' + w.id + ',this.checked)"'
      + (sel ? ' checked' : '') + ' style="accent-color:var(--accent);">';
    html += '<span style="color:var(--text);font-weight:600;">' + escHtml(w.date) + '</span>';
    html += '<span style="color:var(--text-muted);">vs ' + escHtml(w.opponent) + '</span>';
    html += '<span style="color:var(--accent);font-size:11px;">' + totalK + 'K</span>';
    html += '</label>';
  });
  html += '</div>';

  document.getElementById('compare-war-selector').innerHTML = html;
}

function toggleCompareWar(warId, checked){
  if(checked) _compareSelected[warId] = true;
  else delete _compareSelected[warId];
  renderWarSelector();
  renderComparison();
}

function selectAllCompareWars(){
  var wars = loadWars();
  if(!wars) return;
  wars.forEach(function(w){ _compareSelected[w.id] = true; });
  renderWarSelector();
  renderComparison();
}

function deselectAllCompareWars(){
  _compareSelected = {};
  renderWarSelector();
  renderComparison();
}

/* ── Render Comparison Table + Chart ── */

function renderComparison(){
  var selectedIds = Object.keys(_compareSelected).map(Number);
  if(selectedIds.length < 2){
    document.getElementById('compare-table-wrap').innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px 0;">Select at least 2 wars to compare.</div>';
    document.getElementById('compare-chart-wrap').innerHTML = '';
    if(_compareChart){ _compareChart.destroy(); _compareChart = null; }
    return;
  }

  var wars = loadWars().filter(function(w){ return _compareSelected[w.id]; });
  wars.sort(function(a, b){ return (a.id || 0) - (b.id || 0); });

  var stat = document.getElementById('compare-stat-select').value || 'defeat';
  var roleFilter = document.getElementById('compare-role-filter').value || 'ALL';

  // Build player data across wars
  var playerData = {};
  var roster = loadMembriRoster();
  var rosterRoles = {};
  if(roster && roster.length){
    roster.forEach(function(r){ rosterRoles[normalizeName(r.name)] = r.role; });
  }

  wars.forEach(function(w){
    if(!w.parties) return;
    w.parties.forEach(function(p){
      p.members.forEach(function(m){
        var key = normalizeName(m.name);
        var role = m.role || rosterRoles[key] || 'DPS';
        if(roleFilter !== 'ALL' && role !== roleFilter) return;
        if(!playerData[key]) playerData[key] = {name: m.name, role: role, wars: {}};
        playerData[key].wars[w.id] = m[stat] || 0;
      });
    });
  });

  var players = Object.values(playerData).sort(function(a, b){
    var ta = 0, tb = 0;
    Object.values(a.wars).forEach(function(v){ ta += v; });
    Object.values(b.wars).forEach(function(v){ tb += v; });
    return tb - ta;
  });

  if(!players.length){
    document.getElementById('compare-table-wrap').innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:20px 0;">No ' + roleFilter + ' players found in selected wars.</div>';
    document.getElementById('compare-chart-wrap').innerHTML = '';
    if(_compareChart){ _compareChart.destroy(); _compareChart = null; }
    return;
  }

  // ── TABLE ──
  var statLabels = {defeat:'Kills', dmg_dealt:'Dmg', assist:'Assists', dmg_taken:'Taken', healed:'Healed'};
  var statLabel = statLabels[stat] || stat;
  var html = '<div style="overflow-x:auto;">';
  html += '<table class="compare-table">';
  html += '<thead><tr><th style="text-align:left;">Player</th>';
  wars.forEach(function(w){
    html += '<th style="text-align:center;font-size:11px;"><div>' + escHtml(w.date) + '</div><div style="color:var(--text-muted);font-size:10px;">vs ' + escHtml(w.opponent) + '</div></th>';
  });
  html += '<th style="text-align:center;">Trend</th></tr></thead><tbody>';

  players.forEach(function(p){
    var rc = p.role === 'TANK' ? 'var(--tank)' : p.role === 'HEALER' ? 'var(--heal)' : 'var(--dps)';
    html += '<tr>';
    html += '<td><div style="display:flex;align-items:center;gap:6px;"><div style="width:7px;height:7px;border-radius:50%;background:' + rc + ';"></div><span style="font-weight:600;font-size:13px;">' + escHtml(p.name) + '</span></div></td>';

    var values = [];
    wars.forEach(function(w){ values.push(p.wars[w.id] || 0); });

    var prevVal = null;
    values.forEach(function(v){
      var arrow = '';
      var color = 'var(--text)';
      if(prevVal !== null && v !== prevVal){
        if(v > prevVal){ arrow = ' &#8593;'; color = 'var(--heal)'; }
        else{ arrow = ' &#8595;'; color = 'var(--dps)'; }
      }
      var display = (stat === 'defeat' || stat === 'assist') ? v : fmtShort(v);
      html += '<td style="text-align:center;color:' + color + ';font-weight:600;font-size:13px;">' + display + arrow + '</td>';
      prevVal = v;
    });

    // Trend
    var first = values[0] || 0;
    var last = values[values.length - 1] || 0;
    var trendPct = first > 0 ? Math.round((last - first) / first * 100) : (last > 0 ? 100 : 0);
    var trendColor = trendPct > 0 ? 'var(--heal)' : trendPct < 0 ? 'var(--dps)' : 'var(--text-muted)';
    var trendArrow = trendPct > 0 ? '&#9650;' : trendPct < 0 ? '&#9660;' : '&#8212;';
    html += '<td style="text-align:center;"><span style="color:' + trendColor + ';font-weight:700;font-size:12px;">' + trendArrow + ' ' + (trendPct > 0 ? '+' : '') + trendPct + '%</span></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  document.getElementById('compare-table-wrap').innerHTML = html;

  // ── CHART ──
  renderCompareChart(wars, players, stat, statLabel);
}

/* ── Chart.js Line Chart ── */

function renderCompareChart(wars, players, stat, statLabel){
  var wrap = document.getElementById('compare-chart-wrap');
  wrap.innerHTML = '<canvas id="compare-chart"></canvas>';

  if(_compareChart){ _compareChart.destroy(); _compareChart = null; }

  var labels = wars.map(function(w){ return w.date + ' vs ' + w.opponent; });

  var topPlayers = players.slice(0, 10);
  var chartColors = [
    '#D4E157', '#3ECF6E', '#8B5CF6', '#EF4444', '#E8A030',
    '#3B82F6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'
  ];

  var datasets = topPlayers.map(function(p, pi){
    return {
      label: p.name,
      data: wars.map(function(w){ return p.wars[w.id] || 0; }),
      borderColor: chartColors[pi % chartColors.length],
      backgroundColor: chartColors[pi % chartColors.length] + '20',
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2
    };
  });

  var ctx = document.getElementById('compare-chart').getContext('2d');
  _compareChart = new Chart(ctx, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#999', font: { size: 11 }, boxWidth: 12 }
        },
        title: {
          display: true,
          text: statLabel + ' per War (Top 10)',
          color: '#fff',
          font: { size: 14, weight: '600' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#666', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,.05)' }
        },
        y: {
          ticks: { color: '#666' },
          grid: { color: 'rgba(255,255,255,.05)' }
        }
      }
    }
  });
}
