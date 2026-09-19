const SHEET_ID = '1uS-22GKtiiWrawzIUwsqrW6wOODuYDWwo3bbD_TFK48';
const MAIN_GID = '0';
const SETTINGS_GID = '1384681035';
const AUTH_SESSION_KEY = 'aps-data-library-authenticated';
const CACHE_KEY = 'aps-data-library-cache-v2';
const state = { columns: [], rows: [], passcode: null, ready: false };
const $ = (id) => document.getElementById(id);
const loginScreen = $('login-screen'); const appScreen = $('app-screen'); const loginForm = $('login-form');
const loginMessage = $('login-message'); const passcodeInput = $('passcode'); const filtersContainer = $('filters-container');
const resultsHead = $('results-head'); const resultsBody = $('results-body'); const resultsStatus = $('results-status'); const resultTitle = $('result-title');
const csvBase = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=`;
const DATE_COLUMNS = new Set(['INV Date', 'T&C Date', 'Ex-factory', 'Expiry date']);
const HIDDEN_FILTERS = new Set(['total quantity', 'ex-factory', 'remark', 'model type 2']);
const DROPDOWN_COLUMNS = new Set(['model type']);
function clean(value) { return String(value ?? '').replace(/\uFEFF/g, '').trim(); }
function normalize(value) { return clean(value).toLowerCase(); }
async function fetchCsv(gid) { const response = await fetch(`${csvBase}${gid}&_=${Date.now()}`, { cache: 'no-store' }); if (!response.ok) throw new Error(`Google Sheet request failed: ${response.status}`); return response.text(); }
function readPasscode(rows) { for (const row of rows) for (let i = 0; i < row.length - 1; i += 1) if (normalize(row[i]) === 'passcode' && clean(row[i + 1])) return clean(row[i + 1]); return null; }
function applyData(settingsText, mainText) {
  const settings = Papa.parse(settingsText, { skipEmptyLines: true }).data; const parsedMain = Papa.parse(mainText, { skipEmptyLines: true }).data;
  state.passcode = readPasscode(settings); if (!state.passcode) throw new Error('Passcode was not found in Settings.'); if (!parsedMain.length) throw new Error('Main sheet is empty.');
  state.columns = parsedMain[0].map(clean).filter(Boolean); state.rows = parsedMain.slice(1).map((row) => Object.fromEntries(state.columns.map((column, index) => [column, row[index] ?? '']))); state.ready = true; renderFilters(); resultTitle.textContent = `${state.rows.length} records loaded`;
}
function readCache() { try { const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); if (!cached?.settingsText || !cached?.mainText) return false; applyData(cached.settingsText, cached.mainText); resultsStatus.textContent = 'Cached data ready. Updating in background...'; return true; } catch (error) { sessionStorage.removeItem(CACHE_KEY); return false; } }
async function loadData({ preserveView = true } = {}) {
  const hadCachedData = state.ready || readCache(); if (!hadCachedData) resultsStatus.textContent = 'Loading data...';
  try { const [settingsText, mainText] = await Promise.all([fetchCsv(SETTINGS_GID), fetchCsv(MAIN_GID)]); applyData(settingsText, mainText); sessionStorage.setItem(CACHE_KEY, JSON.stringify({ settingsText, mainText })); resultsStatus.textContent = 'Live data ready.'; if (preserveView && sessionStorage.getItem(AUTH_SESSION_KEY) === 'true') showApp(); }
  catch (error) { console.error(error); if (!hadCachedData) { resultTitle.textContent = 'Data unavailable'; resultsStatus.textContent = 'Unable to load data. Check Google Sheet sharing.'; loginMessage.textContent = 'The access code could not be loaded from Settings.'; } else resultsStatus.textContent = 'Showing cached data. Live update failed.'; }
}
function valuesFor(column) { return [...new Set(state.rows.map((row) => clean(row[column])).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function isDateColumn(column) { return DATE_COLUMNS.has(column) || /date|time|created|updated/i.test(column); }
function isHiddenFilter(column) { return HIDDEN_FILTERS.has(normalize(column)); }
function isDropdownColumn(column) { return DROPDOWN_COLUMNS.has(normalize(column)) || !isDateColumn(column); }
function makeOptions(column) {
  const details = document.createElement('details'); details.className = 'value-dropdown'; const summary = document.createElement('summary'); summary.textContent = 'Select'; details.appendChild(summary);
  const options = document.createElement('div'); options.className = 'field-options';
  valuesFor(column).forEach((value) => { const label = document.createElement('label'); label.className = 'option-item'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.column = column; checkbox.value = value; const text = document.createElement('span'); text.textContent = value; label.append(checkbox, text); options.appendChild(label); });
  details.appendChild(options); return details;
}
function renderFilters() {
  filtersContainer.replaceChildren(); state.columns.forEach((column) => { if (isHiddenFilter(column)) return; const group = document.createElement('div'); group.className = 'filter-group'; const title = document.createElement('h4'); title.textContent = column; group.appendChild(title); const inputs = document.createElement('div'); inputs.className = 'filter-inputs';
    if (isDateColumn(column)) { const range = document.createElement('div'); range.className = 'date-range'; const from = document.createElement('input'); from.type = 'date'; from.dataset.dateStart = column; from.title = 'From'; const to = document.createElement('input'); to.type = 'date'; to.dataset.dateEnd = column; to.title = 'To'; range.append(from, to); inputs.appendChild(range); }
    else { const search = document.createElement('input'); search.type = 'text'; search.placeholder = `Search ${column}`; search.dataset.column = column; inputs.appendChild(search); if (isDropdownColumn(column)) inputs.appendChild(makeOptions(column)); }
    group.appendChild(inputs); filtersContainer.appendChild(group);
  });
}
function keywords(value) { return clean(value).split(/[ ,;|\n]+/).map(normalize).filter(Boolean); }
function toDate(value) { const text = clean(value); if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text; const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (match) return `${match[3]}-${match[2]}-${match[1]}`; const date = new Date(text); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10); }
function getCriteria() {
  return Object.fromEntries(state.columns.map((column) => { if (isHiddenFilter(column)) return [column, { text: [], selected: [], from: '', to: '' }]; const search = [...document.querySelectorAll('input[type="text"][data-column]')].find((input) => input.dataset.column === column); const selected = [...document.querySelectorAll('input[type="checkbox"][data-column]')].filter((input) => input.dataset.column === column && input.checked).map((input) => normalize(input.value)); const from = [...document.querySelectorAll('[data-date-start]')].find((input) => input.dataset.dateStart === column); const to = [...document.querySelectorAll('[data-date-end]')].find((input) => input.dataset.dateEnd === column); return [column, { text: keywords(search?.value), selected, from: from?.value || '', to: to?.value || '' }]; }));
}
function hasActiveCriteria(filters) { return Object.values(filters).some((filter) => filter.text.length || filter.selected.length || filter.from || filter.to); }
function matches(row, filters) { return state.columns.every((column) => { const filter = filters[column]; const value = normalize(row[column]); if (filter.text.length && !filter.text.some((term) => value.includes(term))) return false; if (filter.selected.length && !filter.selected.includes(value)) return false; if (filter.from || filter.to) { const date = toDate(row[column]); if (!date || (filter.from && date < filter.from) || (filter.to && date > filter.to)) return false; } return true; }); }
function validateExtendYear() { const column = state.columns.find((item) => normalize(item) === 'extend year'); if (!column) return true; const input = [...document.querySelectorAll('input[type="text"][data-column]')].find((item) => item.dataset.column === column); const value = clean(input?.value); if (value && !/^\d+(\.\d+)?$/.test(value)) { alert('Extend year must contain a decimal number only, for example 1 or 1.5.'); input.focus(); return false; } return true; }
function renderResults(rows) {
  resultsHead.replaceChildren(); resultsBody.replaceChildren(); if (!rows.length) { resultTitle.textContent = 'No results'; resultsStatus.textContent = 'No matching records were found.'; resultsBody.innerHTML = '<tr><td colspan="100%"><div class="empty-state">No matching data found.</div></td></tr>'; return; }
  resultTitle.textContent = `${rows.length} result${rows.length === 1 ? '' : 's'}`; resultsStatus.textContent = 'Results updated.'; const header = document.createElement('tr'); state.columns.forEach((column) => { const th = document.createElement('th'); th.textContent = column; header.appendChild(th); }); resultsHead.appendChild(header); const fragment = document.createDocumentFragment(); rows.forEach((row) => { const tr = document.createElement('tr'); state.columns.forEach((column) => { const td = document.createElement('td'); td.textContent = row[column] ?? ''; tr.appendChild(td); }); fragment.appendChild(tr); }); resultsBody.appendChild(fragment);
}
function search() { if (!state.ready) { resultsStatus.textContent = 'Data is still loading. Please try again in a moment.'; return; } if (!validateExtendYear()) return; const filters = getCriteria(); if (!hasActiveCriteria(filters)) { resultsHead.replaceChildren(); resultsBody.replaceChildren(); resultTitle.textContent = 'Enter a search criterion'; resultsStatus.textContent = 'Enter a keyword, choose a value, or select a date range before searching.'; return; } renderResults(state.rows.filter((row) => matches(row, filters))); }
function reset() { filtersContainer.querySelectorAll('input').forEach((input) => { input.checked = false; input.value = ''; }); resultsHead.replaceChildren(); resultsBody.replaceChildren(); resultTitle.textContent = 'Ready to search'; resultsStatus.textContent = 'Filters reset.'; }
function showApp() { loginScreen.classList.remove('active'); appScreen.classList.add('active'); }
function showLogin() { appScreen.classList.remove('active'); loginScreen.classList.add('active'); passcodeInput.value = ''; passcodeInput.focus(); }
loginForm.addEventListener('submit', (event) => { event.preventDefault(); const entered = clean(passcodeInput.value); if (!state.passcode) { loginMessage.textContent = 'Passcode is unavailable. Check Google Sheet sharing.'; return; } if (entered !== state.passcode) { loginMessage.textContent = 'The passcode is incorrect. Please try again.'; return; } sessionStorage.setItem(AUTH_SESSION_KEY, 'true'); loginMessage.textContent = ''; showApp(); });
$('search-btn')?.addEventListener('click', search); $('top-search-btn')?.addEventListener('click', search); $('reset-search-btn')?.addEventListener('click', reset);
$('refresh-btn')?.addEventListener('click', async () => { const button = $('refresh-btn'); button.disabled = true; button.textContent = 'Refreshing...'; await loadData({ preserveView: true }); button.disabled = false; button.textContent = 'Refresh'; });
$('logout-btn')?.addEventListener('click', () => { sessionStorage.removeItem(AUTH_SESSION_KEY); showLogin(); }); passcodeInput.addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6); }); document.addEventListener('keydown', (event) => { if (event.key === 'Enter' && appScreen.classList.contains('active')) search(); });
const usedCache = readCache(); loadData({ preserveView: true, background: usedCache });
