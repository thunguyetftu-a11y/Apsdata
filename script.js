const SHEET_ID = '1uS-22GKtiiWrawzIUwsqrW6wOODuYDWwo3bbD_TFK48';
const MAIN_GID = '0';
const SETTINGS_GID = '1384681035';

const state = { columns: [], rows: [], passcode: null };
const $ = (id) => document.getElementById(id);
const loginScreen = $('login-screen');
const appScreen = $('app-screen');
const loginForm = $('login-form');
const loginMessage = $('login-message');
const passcodeInput = $('passcode');
const filtersContainer = $('filters-container');
const resultsHead = $('results-head');
const resultsBody = $('results-body');
const resultsStatus = $('results-status');
const resultTitle = $('result-title');
const csvBase = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=`;

function clean(value) {
  return String(value ?? '').replace(/\uFEFF/g, '').trim();
}

async function fetchCsv(gid) {
  const response = await fetch(`${csvBase}${gid}&_=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Google Sheet request failed: ${response.status}`);
  return response.text();
}

function readPasscode(rows) {
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i += 1) {
      if (clean(row[i]).toLowerCase() === 'passcode') {
        const value = clean(row[i + 1]);
        if (value) return value;
      }
    }
  }
  return null;
}

async function loadData() {
  try {
    resultsStatus.textContent = 'Loading data from Google Sheet...';
    const [settingsText, mainText] = await Promise.all([fetchCsv(SETTINGS_GID), fetchCsv(MAIN_GID)]);
    const settings = Papa.parse(settingsText, { skipEmptyLines: true }).data;
    const parsedMain = Papa.parse(mainText, { skipEmptyLines: true }).data;
    state.passcode = readPasscode(settings);
    if (!state.passcode) throw new Error('Passcode was not found in the Settings sheet.');
    if (!parsedMain.length) throw new Error('Main sheet is empty.');

    state.columns = parsedMain[0].map(clean).filter(Boolean);
    state.rows = parsedMain.slice(1).map((row) => Object.fromEntries(
      state.columns.map((column, index) => [column, row[index] ?? ''])
    ));
    renderFilters();
    resultTitle.textContent = `${state.rows.length} records loaded`;
    resultsStatus.textContent = 'Ready for keyword and date search.';
  } catch (error) {
    console.error(error);
    resultTitle.textContent = 'Data unavailable';
    resultsStatus.textContent = 'Cannot read the public Google Sheet. Confirm sharing is “Anyone with the link → Viewer”.';
    loginMessage.textContent = 'The access code could not be loaded from Settings.';
  }
}

function valuesFor(column) {
  return [...new Set(state.rows.map((row) => clean(row[column])).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function isDateColumn(column) {
  return /date|time|created|updated/i.test(column);
}

function renderFilters() {
  filtersContainer.replaceChildren();
  state.columns.forEach((column) => {
    const group = document.createElement('div');
    group.className = 'filter-group';
    group.innerHTML = `<h4></h4><div class="filter-inputs"></div>`;
    group.querySelector('h4').textContent = column;
    const inputs = group.querySelector('.filter-inputs');

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = `Search ${column}`;
    search.dataset.column = column;
    inputs.appendChild(search);

    const options = document.createElement('div');
    options.className = 'field-options';
    valuesFor(column).forEach((value) => {
      const label = document.createElement('label');
      label.className = 'option-item';
      label.innerHTML = '<input type="checkbox"><span></span>';
      const checkbox = label.querySelector('input');
      checkbox.dataset.column = column;
      checkbox.value = value;
      label.querySelector('span').textContent = value;
      options.appendChild(label);
    });
    if (options.childElementCount) inputs.appendChild(options);

    if (isDateColumn(column)) {
      const from = document.createElement('input');
      from.type = 'date';
      from.dataset.dateStart = column;
      from.setAttribute('aria-label', `${column} start date`);
      const to = document.createElement('input');
      to.type = 'date';
      to.dataset.dateEnd = column;
      to.setAttribute('aria-label', `${column} end date`);
      inputs.append(from, to);
    }
    filtersContainer.appendChild(group);
  });
}

function normalize(value) { return clean(value).toLowerCase(); }
function keywords(value) { return clean(value).split(/[ ,;|\n]+/).map(normalize).filter(Boolean); }

function toDate(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function criteria() {
  return Object.fromEntries(state.columns.map((column) => {
    const search = [...document.querySelectorAll('[data-column]')].find((input) => input.type === 'text' && input.dataset.column === column);
    const selected = [...document.querySelectorAll(`input[type="checkbox"][data-column="${CSS.escape(column)}"]`)].filter((input) => input.checked).map((input) => normalize(input.value));
    const from = [...document.querySelectorAll('[data-date-start]')].find((input) => input.dataset.dateStart === column);
    const to = [...document.querySelectorAll('[data-date-end]')].find((input) => input.dataset.dateEnd === column);
    return [column, { text: keywords(search?.value), selected, from: from?.value || '', to: to?.value || '' }];
  }));
}

function matches(row, filters) {
  return state.columns.every((column) => {
    const filter = filters[column];
    const value = normalize(row[column]);
    if (filter.text.length && !filter.text.some((term) => value.includes(term))) return false;
    if (filter.selected.length && !filter.selected.includes(value)) return false;
    if (filter.from || filter.to) {
      const date = toDate(row[column]);
      if (!date || (filter.from && date < filter.from) || (filter.to && date > filter.to)) return false;
    }
    return true;
  });
}

function renderResults(rows) {
  resultsHead.replaceChildren();
  resultsBody.replaceChildren();
  if (!rows.length) {
    resultTitle.textContent = 'No results';
    resultsStatus.textContent = 'No matching records were found.';
    resultsBody.innerHTML = '<tr><td colspan="100%"><div class="empty-state">No matching data found.</div></td></tr>';
    return;
  }
  resultTitle.textContent = `${rows.length} result${rows.length === 1 ? '' : 's'}`;
  resultsStatus.textContent = 'Results updated.';
  const header = document.createElement('tr');
  state.columns.forEach((column) => { const th = document.createElement('th'); th.textContent = column; header.appendChild(th); });
  resultsHead.appendChild(header);
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    state.columns.forEach((column) => { const td = document.createElement('td'); td.textContent = row[column] ?? ''; tr.appendChild(td); });
    resultsBody.appendChild(tr);
  });
}

function search() {
  resultsHead.replaceChildren();
  resultsBody.replaceChildren();
  resultsStatus.textContent = 'Searching...';
  renderResults(state.rows.filter((row) => matches(row, criteria())));
}

function reset() {
  filtersContainer.querySelectorAll('input').forEach((input) => { input.checked = false; input.value = ''; });
  resultsHead.replaceChildren();
  resultsBody.replaceChildren();
  resultsStatus.textContent = 'Filters reset.';
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const entered = clean(passcodeInput.value);
  if (!state.passcode) { loginMessage.textContent = 'Passcode is unavailable. Check Google Sheet sharing.'; return; }
  if (entered !== state.passcode) { loginMessage.textContent = 'The passcode is incorrect. Please try again.'; return; }
  loginMessage.textContent = '';
  loginScreen.classList.remove('active');
  appScreen.classList.add('active');
});
$('search-btn').addEventListener('click', search);
$('reset-search-btn').addEventListener('click', reset);
$('logout-btn').addEventListener('click', () => { appScreen.classList.remove('active'); loginScreen.classList.add('active'); passcodeInput.value = ''; });
passcodeInput.addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6); });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && appScreen.classList.contains('active')) search();
});

loadData();
