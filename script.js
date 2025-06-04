const searchInput = typeof document !== 'undefined' ? document.getElementById('search') : null;
const resultsDiv = typeof document !== 'undefined' ? document.getElementById('results') : null;

let debounceTimeout;

async function fetchWarValue(mlbId, year, isPitcher, fetchFn = fetch) {
  const url = isPitcher
    ? 'https://www.baseball-reference.com/data/war_daily_pitch.txt'
    : 'https://www.baseball-reference.com/data/war_daily_bat.txt';
  const text = await fetchFn(url).then(r => r.text());
  const lines = text.trim().split(/\n+/);
  const headers = lines[0].split(',');
  const idIdx = headers.indexOf('mlb_ID');
  const yearIdx = headers.indexOf('year_ID');
  const warIdx = headers.indexOf('WAR');
  if (idIdx === -1 || yearIdx === -1 || warIdx === -1) return null;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols[idIdx] === String(mlbId) && cols[yearIdx] === String(year)) {
      const war = parseFloat(cols[warIdx]);
      return isNaN(war) ? null : war;
    }
  }
  return null;
}

if (searchInput) {
  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    clearTimeout(debounceTimeout);
    if (query.length === 0) {
      resultsDiv.innerHTML = '';
      return;
    }
    debounceTimeout = setTimeout(() => searchPlayers(query), 300);
  });
}

function searchPlayers(query) {
  fetch(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(query)}&sportId=1&limit=10`)
    .then(response => response.json())
    .then(data => {
      resultsDiv.innerHTML = '';
      if (Array.isArray(data.people)) {
        data.people.forEach(person => {
          const div = document.createElement('div');
          div.textContent = person.fullFMLName || person.fullName;
          div.addEventListener('click', () => {
            searchInput.value = div.textContent;
            resultsDiv.innerHTML = '';
            fetchPlayerAndSimilar(person.id);
          });
          resultsDiv.appendChild(div);
        });
      }
    })
      .catch(err => console.error(err));
}

async function fetchPlayerAndSimilar(id, fetchFn = fetch) {
  const yearInput = typeof document !== 'undefined' ? document.getElementById('year') : null;
  const year = yearInput ? yearInput.value || '2023' : '2023';
  const statsDiv = typeof document !== 'undefined' ? document.getElementById('playerStats') : null;
  if (statsDiv) statsDiv.textContent = 'Loading stats...';
  try {
    const personData = await fetchFn(`https://statsapi.mlb.com/api/v1/people/${id}`).then(r => r.json());
    const person = personData.people[0];
    const isPitcher = person.primaryPosition && person.primaryPosition.abbreviation === 'P';
    const group = isPitcher ? 'pitching' : 'hitting';
    const statsData = await fetchFn(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&group=${group}&season=${year}`)
      .then(r => r.json());
    const statsObj = statsData.stats[0];
    if (!statsObj || !statsObj.splits.length) throw new Error('No stats');
    const playerMetrics = computeMetrics(statsObj.splits[0].stat, isPitcher);
    if (playerMetrics.WAR == null) {
      playerMetrics.WAR = await fetchWarValue(id, year, isPitcher, fetchFn);
    }
    let best;
    for (let y = 1901; y <= 2023; y++) {
      const allData = await fetchFn(`https://statsapi.mlb.com/api/v1/stats?stats=season&group=${group}&season=${y}&playerPool=qualified&limit=300`).then(r => r.json());
      if (!allData.stats || !allData.stats[0] || !allData.stats[0].splits) continue;
      allData.stats[0].splits.forEach(split => {
        if (split.player.id === id && y.toString() === year) return;
        const m = computeMetrics(split.stat, isPitcher);
        const diff = similarity(playerMetrics, m, isPitcher);
        if (!best || diff < best.diff) {
          best = { diff, player: split.player, metrics: m, year: y };
        }
      });
    }
    if (best) {
      if (best.metrics.WAR == null) {
        best.metrics.WAR = await fetchWarValue(best.player.id, best.year, isPitcher, fetchFn);
      }
      if (playerMetrics.WAR == null) {
        playerMetrics.WAR = await fetchWarValue(id, year, isPitcher, fetchFn);
      }
      displayStats(person, playerMetrics, best, year);
    }
    else if (statsDiv) statsDiv.textContent = 'No similar player found.';
  } catch (err) {
    if (statsDiv) statsDiv.textContent = 'Error loading stats.';
    console.error(err);
  }
}

function parseWar(stat) {
  const val = stat.war ?? stat.winsAboveReplacement;
  if (val === undefined || val === null) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function computeMetrics(stat, isPitcher) {
  if (isPitcher) {
    const bf = Number(stat.battersFaced) || 0;
    const bbRate = bf ? (Number(stat.baseOnBalls) / bf) * 100 : 0;
    const soRate = bf ? (Number(stat.strikeOuts) / bf) * 100 : 0;
    return {
      ERA: parseFloat(stat.era),
      WAR: parseWar(stat),
      BBp: bbRate,
      SOp: soRate
    };
  } else {
    const pa = Number(stat.plateAppearances) || 0;
    const bbRate = pa ? (Number(stat.baseOnBalls) / pa) * 100 : 0;
    const kRate = pa ? (Number(stat.strikeOuts) / pa) * 100 : 0;
    return {
      AVG: parseFloat(stat.avg),
      WAR: parseWar(stat),
      OBP: parseFloat(stat.obp),
      OPS: parseFloat(stat.ops),
      BBp: bbRate,
      Kp: kRate
    };
  }
}

function similarity(a, b, isPitcher) {
  let sum = 0;
  if (isPitcher) {
    sum += Math.abs(a.ERA - b.ERA);
    if (a.WAR != null && b.WAR != null) sum += Math.abs(a.WAR - b.WAR);
    sum += Math.abs(a.BBp - b.BBp);
    sum += Math.abs(a.SOp - b.SOp);
  } else {
    sum += Math.abs(a.AVG - b.AVG);
    if (a.WAR != null && b.WAR != null) sum += Math.abs(a.WAR - b.WAR);
    sum += Math.abs(a.OBP - b.OBP);
    sum += Math.abs(a.OPS - b.OPS);
    sum += Math.abs(a.BBp - b.BBp);
    sum += Math.abs(a.Kp - b.Kp);
  }
  return sum;
}

function displayStats(player, metrics, best, year) {
  let table = `<h2>Similarity Results (${year})</h2><table border="1" cellpadding="5"><tr><th>Stat</th><th>${player.fullName}</th><th>${best.player.fullName} (${best.year})</th></tr>`;
  if (metrics.AVG !== undefined) {
    table += `<tr><td>AVG</td><td>${metrics.AVG}</td><td>${best.metrics.AVG}</td></tr>`;
    table += `<tr><td>WAR</td><td>${metrics.WAR ?? 'N/A'}</td><td>${best.metrics.WAR ?? 'N/A'}</td></tr>`;
    table += `<tr><td>OBP</td><td>${metrics.OBP}</td><td>${best.metrics.OBP}</td></tr>`;
    table += `<tr><td>OPS</td><td>${metrics.OPS}</td><td>${best.metrics.OPS}</td></tr>`;
    table += `<tr><td>BB%</td><td>${metrics.BBp.toFixed(1)}</td><td>${best.metrics.BBp.toFixed(1)}</td></tr>`;
    table += `<tr><td>K%</td><td>${metrics.Kp.toFixed(1)}</td><td>${best.metrics.Kp.toFixed(1)}</td></tr>`;
  } else {
    table += `<tr><td>ERA</td><td>${metrics.ERA}</td><td>${best.metrics.ERA}</td></tr>`;
    table += `<tr><td>WAR</td><td>${metrics.WAR ?? 'N/A'}</td><td>${best.metrics.WAR ?? 'N/A'}</td></tr>`;
    table += `<tr><td>BB%</td><td>${metrics.BBp.toFixed(1)}</td><td>${best.metrics.BBp.toFixed(1)}</td></tr>`;
    table += `<tr><td>SO%</td><td>${metrics.SOp.toFixed(1)}</td><td>${best.metrics.SOp.toFixed(1)}</td></tr>`;
  }
  table += '</table>';
  const statsDiv = typeof document !== 'undefined' ? document.getElementById('playerStats') : null;
  if (statsDiv) statsDiv.innerHTML = table;
}

if (typeof module !== 'undefined') {
  module.exports = { computeMetrics, similarity, parseWar, fetchPlayerAndSimilar, fetchWarValue };
}
