# APS Data Library

This project is a lightweight website that reads a Google Sheet and lets users search its rows using multiple filters.

## Features included

- Google Sheet data source
- Keyword search across each column
- Multiple keyword values in a single field (comma or semicolon separated)
- Date range filters
- Multiple-value selection from available values in each column
- Previous results are replaced whenever a new search is run
- 6-digit passcode gate
- Passcode is read from the Google Sheet owner account so it can be changed there

## Files

- `index.html` — app shell
- `styles.css` — visual design
- `script.js` — Google Sheets loading and search logic

## Required setup

1. Open the Google Sheet in the browser.
2. Set up a sheet named `Settings` (or keep the default `gid` value if your passcode is in the first sheet).
3. Add a row like this:
   - `Passcode` in column A
   - `123456` in column B
4. The app reads the passcode from that sheet automatically.
5. Update the values in `script.js` if you use a different main sheet or settings sheet:

```js
const SHEET_ID = '1uS-22GKtiiWrawzIUwsqrW6wOODuYDWwo3bbD_TFK48';
const MAIN_GID = '0';
const SETTINGS_GID = '0';
```

## Running locally

Open `index.html` directly in a browser, or serve the folder with a local web server:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Notes

- The sheet must be publicly accessible or accessible to the browser via the Share setting.
- If the Google Sheet needs a different tab, update `MAIN_GID` and `SETTINGS_GID` to the relevant sheet IDs.
- This version is designed for a static web app and does not store the passcode in a backend database.
