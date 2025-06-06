const { computeMetrics, similarity, fetchPlayerAndSimilar } = require('../script');

describe('metrics utilities', () => {
  test('computeMetrics for hitter', () => {
    const stat = {
      avg: '0.280',
      obp: '0.350',
      ops: '0.800',
      plateAppearances: '100',
      baseOnBalls: '10',
      strikeOuts: '20',
      war: '3.2'
    };
    const m = computeMetrics(stat, false);
    expect(m).toEqual({
      AVG: 0.28,
      WAR: 3.2,
      OBP: 0.35,
      OPS: 0.8,
      BBp: 10,
      Kp: 20
    });
  });

  test('computeMetrics for pitcher', () => {
    const stat = {
      era: '3.00',
      battersFaced: '100',
      baseOnBalls: '5',
      strikeOuts: '25',
      war: '2'
    };
    const m = computeMetrics(stat, true);
    expect(m).toEqual({
      ERA: 3,
      WAR: 2,
      BBp: 5,
      SOp: 25
    });
  });
});

describe('similarity search', () => {
  test('fetchPlayerAndSimilar selects the closest player', async () => {
    document.body.innerHTML = '<input id="year" value="2023"><div id="playerStats"></div>';
    const responses = {
      'https://statsapi.mlb.com/api/v1/people/1': { people: [{ primaryPosition: { abbreviation: 'P' }, fullName: 'Pitcher One' }] },
      'https://statsapi.mlb.com/api/v1/people/1/stats?stats=season&group=pitching&season=2023': {
        stats: [{ splits: [{ stat: { era: '3.00', battersFaced: '100', baseOnBalls: '10', strikeOuts: '20', war: '2' } }] }]
      },
      'https://statsapi.mlb.com/api/v1/stats?stats=season&group=pitching&season=2022&playerPool=qualified&limit=300': {
        stats: [{ splits: [{ player: { id: 2, fullName: 'Pitcher Two' }, stat: { era: '3.05', battersFaced: '100', baseOnBalls: '11', strikeOuts: '21', war: '1.9' } }] }]
      }
    };
    const fetchMock = jest.fn(async url => {
      const data = responses[url] || { stats: [{ splits: [] }] };
      return { json: async () => data };
    });

    await fetchPlayerAndSimilar(1, fetchMock);
    expect(document.getElementById('playerStats').innerHTML).toContain('Pitcher Two (2022)');
  });
});

