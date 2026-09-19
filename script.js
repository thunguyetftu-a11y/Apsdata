const SHEET_ID = '1uS-22GKtiiWrawzIUwsqrW6wOODuYDWwo3bbD_TFK48';
const MAIN_GID = '0';
const SETTINGS_GID = '0';
const DEFAULT_PASSCODE = '123456';

const state = {
  columns: [],
  rows: [],
  passcode: DEFAULT_PASSCODE,
};

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const passcodeInput = document.getElementById('passcode');

const filtersContainer = document.getElementById('filters-container');
const resultsHead = document.getElementById('results-head');
const resultsBody = document.getElementById('results-body');
const resultsStatus = document.getElementById('results-status');
const resultTitle = document.getElementById('result-title');

const searchBtn = document.getElementById('search-btn');
const resetSearchBtn = document.getElementById('reset-search-btn');
const logoutBtn = document.getElementById('logout-btn');

const GOOGLE_SHEET_CSV_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=`;

async function loadData() {
  try {
    resultsStatus.textContent = 'Loading data from Google Sheet...';

    const [settingsCsv, mainCsv] = await Promise.all([
      fetchCsv(SETTINGS_GID),
      fetchCsv(MAIN_GID),
    ]);

    const settingsRows = Papa.parse(settingsCsv, { skipEmptyLines: true }).data;
    const mainRows = Papa.parse(mainCsv, { skipEmptyLines: true }).data;

    const passcodeFromSheet = readPasscodeFromSheet(settingsRows);
    if (passcodeFromSheet) state.passcode = passcodeFromSheet;

    if (!mainRows.length) {
      throw new Error('The Google Sheet is empty.');
    }

    const headers = mainRows[0]
      .map((header) => String(header || '').trim())
      .filter(Boolean);

    const rows = mainRows.slice(1).map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index] ?? '';
      });
      return item;
    });

    state.columns = headers;
    state.rows = rows;

    renderFilters();
    resultTitle.textContent = `${rows.length} records loaded`;
    resultsStatus.textContent = 'Ready for keyword and date search.';
  } catch (error) {
    console.error(error);
    resultTitle.textContent = 'Data not available';
    resultsStatus.textContent = 'Unable to load data. Please check the Google Sheet link, permissions, and gid values.';
  }
}

function fetchCsv(gid) {
  return fetch(`${GOOGLE_SHEET_CSV_BASE}${gid}`, { cache: 'no-store' }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unable to load sheet with gid ${gid}.`);
    }
    return response.text();
  });
}

function readPasscodeFromSheet(rows) {
  const normalized = rows
    .map((row) => row.map((cell) => String(cell || '').trim()))
    .filter((row) => row.some(Boolean));

  for (const row of normalized) {
    if (row[0] && row[0].toLowerCase() === 'passcode') {
      return row[1] || null;
    }
  }

  for (const row of normalized) {
    if (row[0] && row[0].toLowerCase().includes('passcode')) {
      return row[1] || null;
    }
  }

  return null;
}

function renderFilters() {
  filtersContainer.innerHTML = '';

  state.columns.forEach((columnName) => {
    const filterGroup = document.createElement('div');
    filterGroup.className = 'filter-group';

    const title = document.createElement('h4');
    title.textContent = columnName;
    filterGroup.appendChild(title);

    const filterInputs = document.createElement('div');
    filterInputs.className = 'filter-inputs';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = `Search ${columnName}`;
    textInput.dataset.column = columnName;
    textInput.setAttribute('aria-label', `Search ${columnName}`);
    filterInputs.appendChild(textInput);

    const valueOptions = getColumnValueOptions(columnName);
    if (valueOptions.length) {
      const optionsBox = document.createElement('div');
      optionsBox.className = 'field-options';

      valueOptions.forEach((value) => {
        const label = document.createElement('label');
        label.className = 'option-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = value;
        checkbox.dataset.column = columnName;

        const text = document.createElement('span');
        text.textContent = value;

        label.appendChild(checkbox);
        label.appendChild(text);
        optionsBox.appendChild(label);
      });

      filterInputs.appendChild(optionsBox);
    }

    if (looksLikeDateColumn(columnName)) {
      const startDate = document.createElement('input');
      startDate.type = 'date';
      startDate.dataset.dateStart = columnName;
      startDate.setAttribute('aria-label', `${columnName} start date`);

      const endDate = document.createElement('input');
      endDate.type = 'date';
      endDate.dataset.dateEnd = columnName;
      endDate.setAttribute('aria-label', `${columnName} end date`);

      filterInputs.appendChild(startDate);
      filterInputs.appendChild(endDate);
    }

    filterGroup.appendChild(filterInputs);
    filtersContainer.appendChild(filterGroup);
  });
}

function getColumnValueOptions(columnName) {
  const values = new Set();

  state.rows.forEach((row) => {
    const value = String(row[columnName] ?? '').trim();
    if (value) values.add(value);
  });

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function looksLikeDateColumn(columnName) {
  const normalized = columnName.toLowerCase();
  return (
    normalized.includes('date') ||
    normalized.includes('time') ||
    normalized.includes('created') ||
    normalized.includes('updated')
  );
}

function handleSearch() {
  resetResultsDisplay();

  const criteria = collectSearchCriteria();
  const filteredRows = state.rows.filter((row) => matchesFilters(row, criteria));

  renderResults(filteredRows);
}

function collectSearchCriteria() {
  const criteria = {};

  state.columns.forEach((columnName) => {
    const textInput = document.querySelector(`input[type='text'][data-column='${columnName}']`);
    const selectedValues = Array.from(
      document.querySelectorAll(`input[type='checkbox'][data-column='${columnName}']:checked`)
    ).map((checkbox) => checkbox.value.trim());

    const startDateInput = document.querySelector(`input[data-date-start='${columnName}']`);
    const endDateInput = document.querySelector(`input[data-date-end='${columnName}']`);

    criteria[columnName] = {
      searchText: textInput ? textInput.value.trim() : '',
      selectedValues,
      dateStart: startDateInput ? startDateInput.value : '',
      dateEnd: endDateInput ? endDateInput.value : '',
    };
  });

  return criteria;
}

function matchesFilters(row, criteria) {
  return state.columns.every((columnName) => {
    const filter = criteria[columnName] || {};
    const rawValue = String(row[columnName] ?? '').trim();
    const normalizedValue = normalizeText(rawValue);

    const searchTerms = splitKeywords(filter.searchText);
    if (searchTerms.length) {
      const matchesText = searchTerms.some((term) => normalizedValue.includes(term));
      if (!matchesText) return false;
    }

    if (filter.selectedValues.length) {
      const matchesSelected = filter.selectedValues.some(
        (selected) => normalizeText(selected) === normalizedValue
      );
      if (!matchesSelected) return false;
    }

    if (filter.dateStart || filter.dateEnd) {
      const dateValue = parseFlexibleDate(rawValue);
      if (!dateValue) return false;

      if (filter.dateStart && dateValue < filter.dateStart) return false;
      if (filter.dateEnd && dateValue > filter.dateEnd) return false;
    }

    return true;
  });
}

function splitKeywords(value) {
  if (!value) return [];
  return value
    .split(/[ ,\n;|]+/)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseFlexibleDate(dateString) {
  const value = String(dateString || '').trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function renderResults(rows) {
  if (!rows.length) {
    resultTitle.textContent = 'No results';
    resultsStatus.textContent = 'No matching records were found. Please try different filters.';
    resultsHead.innerHTML = '';
    resultsBody.innerHTML = '<tr><td colspan="100%"><div class="empty-state">No matching data found.</div></td></tr>';
    return;
  }

  resultTitle.textContent = `${rows.length} result${rows.length === 1 ? '' : 's'}`;
  resultsStatus.textContent = 'Results updated.';

  const headerRow = document.createElement('tr');
  state.columns.forEach((columnName) => {
    const th = document.createElement('th');
    th.textContent = columnName;
    headerRow.appendChild(th);
  });

  resultsHead.innerHTML = '';
  resultsHead.appendChild(headerRow);

  resultsBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    state.columns.forEach((columnName) => {
      const td = document.createElement('td');
      td.textContent = row[columnName] ?? '';
      tr.appendChild(td);
    });
    resultsBody.appendChild(tr);
  });
}

function resetResultsDisplay() {
  resultsHead.innerHTML = '';
  resultsBody.innerHTML = '';
  resultsStatus.textContent = 'Searching...';
}

function resetFilters() {
  state.columns.forEach((columnName) => {
    const textInput = document.querySelector(`input[type='text'][data-column='${columnName}']`);
    if (textInput) textInput.value = '';

    document.querySelectorAll(`input[type='checkbox'][data-column='${columnName}']`).forEach((checkbox) => {
      checkbox.checked = false;
    });

    const startDateInput = document.querySelector(`input[data-date-start='${columnName}']`);
    const endDateInput = document.querySelector(`input[data-date-end='${columnName}']`);
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
  });

  resultsHead.innerHTML = '';
  resultsBody.innerHTML = '';
  resultsStatus.textContent = 'Filters reset.';
}

function showApp() {
  loginScreen.classList.remove('active');
  appScreen.classList.add('active');
}

function showLogin() {
  appScreen.classList.remove('active');
  loginScreen.classList.add('active');
  passcodeInput.value = '';
  passcodeInput.focus();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const entered = passcodeInput.value.trim();

  if (!entered) {
    loginMessage.textContent = 'Please enter the passcode.';
    return;
  }

  if (String(entered) !== String(state.passcode)) {
    loginMessage.textContent = 'The passcode is incorrect. Please try again.';
    return;
  }

  loginMessage.textContent = '';
  showApp();
});

searchBtn.addEventListener('click', handleSearch);

resetSearchBtn.addEventListener('click', () => {
  resetFilters();
  resultsHead.innerHTML = '';
  resultsBody.innerHTML = '';
  resultsStatus.textContent = 'Filters cleared. Search again when ready.';
});

logoutBtn.addEventListener('click', showLogin);

passcodeInput.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && appScreen.classList.contains('active')) {
    handleSearch();
  }
});

(async function start() {
  await loadData();
  showLogin();
})();
