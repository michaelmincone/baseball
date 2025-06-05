import json, requests

SEASON = 2023

API_BASE = 'https://statsapi.mlb.com/api/v1/stats'
WAR_BAT_URL = 'https://www.baseball-reference.com/data/war_daily_bat.txt'
WAR_PIT_URL = 'https://www.baseball-reference.com/data/war_daily_pitch.txt'


def fetch_stats(group):
    url = f"{API_BASE}?stats=season&group={group}&season={SEASON}&playerPool=all&limit=10000"
    r = requests.get(url)
    r.raise_for_status()
    data = r.json()
    splits = data['stats'][0]['splits']
    arr = []
    for s in splits:
        stat = s['stat']
        entry = {
            'id': s['player']['id'],
            'name': s['player']['fullName'],
            'stat': {
                'avg': stat.get('avg'),
                'obp': stat.get('obp'),
                'ops': stat.get('ops'),
                'plateAppearances': stat.get('plateAppearances'),
                'baseOnBalls': stat.get('baseOnBalls'),
                'strikeOuts': stat.get('strikeOuts'),
                'era': stat.get('era'),
                'battersFaced': stat.get('battersFaced')
            }
        }
        arr.append(entry)
    return arr

def fetch_war(url):
    r = requests.get(url)
    r.raise_for_status()
    lines = r.text.strip().split('\n')
    headers = lines[0].split(',')
    id_idx = headers.index('mlb_ID')
    year_idx = headers.index('year_ID')
    war_idx = headers.index('WAR')
    war_map = {}
    for line in lines[1:]:
        cols = line.split(',')
        if cols[year_idx] == str(SEASON):
            war_map[cols[id_idx]] = cols[war_idx]
    return war_map

def main():
    hitters = fetch_stats('hitting')
    pitchers = fetch_stats('pitching')
    bat_war = fetch_war(WAR_BAT_URL)
    pit_war = fetch_war(WAR_PIT_URL)

    for p in hitters:
        war = bat_war.get(str(p['id']))
        p['stat']['war'] = war
    for p in pitchers:
        war = pit_war.get(str(p['id']))
        p['stat']['war'] = war

    db = {
        'hitting': {str(SEASON): hitters},
        'pitching': {str(SEASON): pitchers}
    }
    with open('statsDatabase.json', 'w') as f:
        json.dump(db, f, indent=2)

if __name__ == '__main__':
    main()
