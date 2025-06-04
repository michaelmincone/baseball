# Baseball Player Autocomplete

This simple web page lets you search for any baseball player by name and shows suggestions as you type. The search is powered by the public [MLB Stats API](https://statsapi.mlb.com/).

## Usage

Open `index.html` in your browser. The page now loads its JavaScript from `script.js`. Type a player's name and you'll see autocomplete suggestions. Use the year box to set the season you're interested in. Once you click a suggestion the page will fetch that player's stats for the selected season and show the most similar qualified player from the same year.

To serve locally (optional):

```bash
python3 -m http.server
```

Then visit `http://localhost:8000` in your browser.

## Running tests

Install dependencies once with:

```bash
npm install
```

Then run the test suite:

```bash
npm test
```
