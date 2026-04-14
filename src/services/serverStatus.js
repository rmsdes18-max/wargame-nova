// TL Server Status — scrape from official site with in-memory cache

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback data if scraping fails
const FALLBACK = {
  regions: [
    { name: 'Americas', slug: 'americas', servers: [
      {name:'Enforcer',status:'online'},{name:'Ascension',status:'online'},
      {name:'Enchanted',status:'online'},{name:'Distortion',status:'online'},
      {name:'Despair',status:'online'},{name:'Eclipse',status:'online'}
    ]},
    { name: 'Europe', slug: 'europe', servers: [
      {name:'Sacred',status:'online'},{name:'Fearless',status:'online'},
      {name:'Usurper',status:'online'},{name:'Indomitable',status:'online'},
      {name:'Sophia',status:'online'}
    ]},
    { name: 'Japan, Oceania', slug: 'japan-oceania', servers: [
      {name:'Prophecy',status:'online'},{name:'Virtue',status:'online'}
    ]}
  ],
  lastUpdated: null,
  source: 'fallback'
};

async function fetchServerStatus() {
  // Return cache if fresh
  if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) {
    return _cache;
  }

  try {
    const resp = await fetch('https://www.playthroneandliberty.com/en-us/support/server-status');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html = await resp.text();

    // Parse regions and servers from HTML
    const regions = [];
    let currentRegion = null;

    // Extract data-regionid and server names
    const lines = html.split('\n');
    for (const line of lines) {
      const regionMatch = line.match(/data-regionid="([^"]+)"/);
      if (regionMatch && line.includes('serverStatuses-region')) {
        const slug = regionMatch[1];
        const nameMap = { americas: 'Americas', europe: 'Europe', 'japan-oceania': 'Japan, Oceania' };
        currentRegion = { name: nameMap[slug] || slug, slug, servers: [] };
        regions.push(currentRegion);
      }

      const serverMatch = line.match(/serverStatuses-server-item-label">([^<]+)/);
      if (serverMatch && currentRegion) {
        currentRegion.servers.push({ name: serverMatch[1].trim(), status: 'online' });
      }

      // Try to detect status from class
      const statusMatch = line.match(/server-item-status--(\w+)/);
      if (statusMatch && currentRegion && currentRegion.servers.length) {
        currentRegion.servers[currentRegion.servers.length - 1].status = statusMatch[1].toLowerCase();
      }
    }

    if (!regions.length) throw new Error('No regions parsed');

    _cache = { regions, lastUpdated: new Date().toISOString(), source: 'live' };
    _cacheTime = Date.now();
    return _cache;
  } catch (e) {
    console.error('[ServerStatus] Scrape failed:', e.message);
    // Return stale cache or fallback
    if (_cache) return { ..._cache, source: 'stale-cache' };
    return { ...FALLBACK, source: 'fallback' };
  }
}

module.exports = { fetchServerStatus };
