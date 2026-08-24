const PRESETS = {
  cupboard: {
    label: 'Cupboard 80 × 90 mm',
    cols: 2, rows: 3,
    labelW: 80, labelH: 90,
    gapX: 2, gapY: 2,
    padL: 10, padR: 10, padT: 10, padB: 10,
    tone: 'cupboard'
  },
  'student-fit': {
    label: 'Student 99.1 × 38.1 mm — A4 fit',
    cols: 2, rows: 7,
    labelW: 99.1, labelH: 38.1,
    gapX: 1.8, gapY: 0,
    padL: 5, padR: 5, padT: 15, padB: 15,
    tone: 'student'
  },
  'student-original': {
    label: 'Student 99.1 × 38.1 mm — supplied settings',
    cols: 2, rows: 7,
    labelW: 99.1, labelH: 38.1,
    gapX: 3, gapY: 0,
    padL: 5, padR: 5, padT: 15, padB: 15,
    tone: 'student'
  }
};

const STORAGE_KEY = 'phs-techsop-qr-label-printer-v1';
const state = {
  items: [],
  visible: [],
  selected: new Set(),
  search: '',
  department: 'all',
  filterTool: null,
  presetId: 'student-fit',
  startPosition: 1,
  copies: 1,
  showGuides: true
};

const els = {
  sheets: document.getElementById('printSheets'),
  picker: document.getElementById('qrPicker'),
  search: document.getElementById('qrSearch'),
  department: document.getElementById('qrDepartment'),
  preset: document.getElementById('labelPreset'),
  specs: document.getElementById('presetSpecs'),
  fit: document.getElementById('fitNotice'),
  start: document.getElementById('startPosition'),
  copies: document.getElementById('copiesPerSop'),
  guides: document.getElementById('showGuides'),
  selectedCount: document.getElementById('selectedCount'),
  visibleCount: document.getElementById('visibleCount'),
  sheetCount: document.getElementById('sheetCount'),
  labelCount: document.getElementById('labelCount'),
  selectVisible: document.getElementById('selectVisibleBtn'),
  clear: document.getElementById('clearSelectionBtn'),
  printButtons: [document.getElementById('printLabelsBtn'), document.getElementById('printLabelsSecondaryBtn')]
};

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function studentVisible(tool, modes) {
  return modes.includes('student') && Boolean(tool.student);
}

function accessStatus(tool) {
  const local = tool.local || {};
  if (tool.sourceAccess === 'teacher-only' || local.studentUseApproved === false) {
    return { tone: 'danger', label: 'REFERENCE ONLY • STUDENTS DO NOT OPERATE' };
  }
  if (tool.sourceAccess === 'age-or-maturity-restricted') {
    return { tone: 'caution', label: 'TEACHER PERMISSION REQUIRED' };
  }
  if (local.studentUseCandidate === false) {
    return { tone: 'caution', label: 'TEACHER DIRECTION REQUIRED' };
  }
  return { tone: 'published', label: 'PUBLISHED STUDENT SOP' };
}

function parseToolFilter() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  return params.get('tool');
}

function currentPreset() {
  return PRESETS[state.presetId] || PRESETS['student-fit'];
}

function presetCapacity() {
  const preset = currentPreset();
  return preset.cols * preset.rows;
}

function layoutFit(preset = currentPreset()) {
  const gridW = preset.cols * preset.labelW + (preset.cols - 1) * preset.gapX;
  const gridH = preset.rows * preset.labelH + (preset.rows - 1) * preset.gapY;
  const usableW = 210 - preset.padL - preset.padR;
  const usableH = 297 - preset.padT - preset.padB;
  return {
    fits: gridW <= usableW + 0.001 && gridH <= usableH + 0.001,
    gridW, gridH, usableW, usableH,
    overflowW: Math.max(0, gridW - usableW),
    overflowH: Math.max(0, gridH - usableH)
  };
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (PRESETS[saved.presetId]) state.presetId = saved.presetId;
    state.startPosition = Math.max(1, Number(saved.startPosition) || 1);
    state.copies = Math.min(20, Math.max(1, Number(saved.copies) || 1));
    state.showGuides = saved.showGuides !== false;
  } catch {}
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      presetId: state.presetId,
      startPosition: state.startPosition,
      copies: state.copies,
      showGuides: state.showGuides
    }));
  } catch {}
}

function applyPresetVariables() {
  const preset = currentPreset();
  const root = document.documentElement;
  for (const [name, value] of Object.entries({
    '--label-cols': preset.cols,
    '--label-rows': preset.rows,
    '--label-width-mm': preset.labelW,
    '--label-height-mm': preset.labelH,
    '--label-gap-x-mm': preset.gapX,
    '--label-gap-y-mm': preset.gapY,
    '--page-pad-left-mm': preset.padL,
    '--page-pad-right-mm': preset.padR,
    '--page-pad-top-mm': preset.padT,
    '--page-pad-bottom-mm': preset.padB
  })) root.style.setProperty(name, value);

  els.specs.innerHTML = `
    <span><strong>${preset.cols} × ${preset.rows}</strong> labels</span>
    <span><strong>${preset.labelW} × ${preset.labelH} mm</strong> each</span>
    <span><strong>${preset.padL}/${preset.padT} mm</strong> left/top</span>
    <span><strong>${preset.gapX}/${preset.gapY} mm</strong> horizontal/vertical gap</span>`;

  const fit = layoutFit(preset);
  els.fit.className = `fit-notice ${fit.fits ? 'good' : 'warning'}`;
  els.fit.innerHTML = fit.fits
    ? `<strong>Fits A4 at 100%.</strong> Grid ${fit.gridW.toFixed(1)} × ${fit.gridH.toFixed(1)} mm inside ${fit.usableW.toFixed(1)} × ${fit.usableH.toFixed(1)} mm usable space.`
    : `<strong>Supplied measurements exceed A4 by ${fit.overflowW.toFixed(1)} mm.</strong> Use this only if it matches the old program/printer driver; otherwise choose the A4-fit preset.`;

  renderStartPositions();
}

function renderStartPositions() {
  const capacity = presetCapacity();
  state.startPosition = Math.min(capacity, Math.max(1, state.startPosition));
  els.start.innerHTML = Array.from({ length: capacity }, (_, index) => {
    const position = index + 1;
    const row = Math.floor(index / currentPreset().cols) + 1;
    const col = (index % currentPreset().cols) + 1;
    return `<option value="${position}" ${position === state.startPosition ? 'selected' : ''}>${position} — row ${row}, column ${col}</option>`;
  }).join('');
}

async function init() {
  loadSettings();
  els.preset.value = state.presetId;
  els.copies.value = state.copies;
  els.guides.checked = state.showGuides;

  const manifest = await loadJson('data/manifest.json');
  const datasets = (manifest.datasets || []).filter(entry => entry.enabled !== false && (entry.modes || ['student', 'teacher']).includes('student'));
  const loaded = await Promise.all(datasets.map(async entry => ({
    entry,
    data: await loadJson(`data/${entry.file}`)
  })));

  state.items = loaded.flatMap(({ entry, data }) => {
    const modes = entry.modes || ['student', 'teacher'];
    return (data.tools || []).filter(tool => studentVisible(tool, modes)).map(tool => ({
      ...tool,
      department: data.department,
      slug: tool.slug || tool.id,
      access: accessStatus(tool),
      qr: `assets/qrcodes/student/${tool.id}.svg`,
      route: `#/${data.department.id}/${tool.slug || tool.id}`,
      search: `${tool.name} ${tool.category || ''} ${(tool.aliases || []).join(' ')} ${data.department.name}`.toLowerCase()
    }));
  });

  const departments = [...new Map(state.items.map(item => [item.department.id, item.department])).values()];
  els.department.innerHTML = '<option value="all">All departments</option>' + departments
    .map(department => `<option value="${esc(department.id)}">${esc(department.name)}</option>`).join('');

  state.filterTool = parseToolFilter();
  if (state.filterTool && state.items.some(item => item.id === state.filterTool)) state.selected.add(state.filterTool);
  applyPresetVariables();
  applyFilters();
}

function applyFilters() {
  const query = state.search.trim().toLowerCase();
  state.visible = state.items.filter(item => {
    const filterMatch = !state.filterTool || item.id === state.filterTool;
    const departmentMatch = state.department === 'all' || item.department.id === state.department;
    const searchMatch = !query || item.search.includes(query);
    return filterMatch && departmentMatch && searchMatch;
  });
  renderPicker();
  renderSheets();
}

function renderPicker() {
  els.visibleCount.textContent = `${state.visible.length} shown`;
  els.picker.innerHTML = state.visible.length ? state.visible.map(item => `
    <label class="picker-item ${state.selected.has(item.id) ? 'selected' : ''}">
      <input type="checkbox" value="${esc(item.id)}" ${state.selected.has(item.id) ? 'checked' : ''}>
      <span class="picker-copy">
        <strong>${esc(item.name)}</strong>
        <small>${esc(item.department.name)} • ${esc(item.access.label)}</small>
      </span>
    </label>`).join('') : document.getElementById('emptyPickerTemplate').innerHTML;

  els.picker.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) state.selected.add(input.value);
      else state.selected.delete(input.value);
      renderPicker();
      renderSheets();
    });
  });
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const selected = state.selected.size;
  const printed = selected * state.copies;
  els.selectedCount.textContent = `${selected} SOP${selected === 1 ? '' : 's'} selected`;
  els.printButtons.forEach(button => { button.disabled = !selected; });
  if (!selected) return;
  els.labelCount.textContent = `${printed} label${printed === 1 ? '' : 's'} prepared${state.startPosition > 1 ? `, beginning at position ${state.startPosition}` : ''}.`;
}

function expandedSelection() {
  const selectedItems = state.items.filter(item => state.selected.has(item.id));
  return selectedItems.flatMap(item => Array.from({ length: state.copies }, () => item));
}

function labelHtml(item) {
  return `
    <article class="print-label-card ${item.access.tone}">
      <header class="print-label-brand">
        <img src="assets/phs-shield.svg" alt="">
        <span><strong>PUKEKOHE HIGH SCHOOL</strong><small>Technology Safety Hub</small></span>
      </header>
      <div class="print-label-body">
        <div class="print-label-copy">
          <small class="print-label-dept">${esc(item.department.name)}</small>
          <h2>${esc(item.name)}</h2>
          <span class="print-label-status">${esc(item.access.label)}</span>
          <p class="print-label-instruction">Scan for the Student safety SOP. Teacher permission and supervision are still required.</p>
        </div>
        <div class="print-label-qr">
          <img src="${esc(item.qr)}" alt="QR code for ${esc(item.name)}">
          <strong>STUDENT SOP</strong>
        </div>
      </div>
    </article>`;
}

function renderSheets() {
  const labels = expandedSelection();
  updateSelectionSummary();
  if (!labels.length) {
    els.sheets.innerHTML = document.getElementById('emptySheetsTemplate').innerHTML;
    els.sheetCount.textContent = 'No sheets';
    els.labelCount.textContent = 'Select SOPs to build the print sheet.';
    return;
  }

  const preset = currentPreset();
  const capacity = preset.cols * preset.rows;
  const firstOffset = state.startPosition - 1;
  const totalSlots = firstOffset + labels.length;
  const pageCount = Math.ceil(totalSlots / capacity);
  const slots = Array(firstOffset).fill(null).concat(labels);
  while (slots.length < pageCount * capacity) slots.push(null);

  els.sheets.innerHTML = Array.from({ length: pageCount }, (_, pageIndex) => {
    const pageSlots = slots.slice(pageIndex * capacity, (pageIndex + 1) * capacity);
    return `
      <section class="print-sheet preset-${preset.tone}" aria-label="Label sheet ${pageIndex + 1} of ${pageCount}">
        <div class="print-label-grid ${state.showGuides ? 'show-guides' : ''}">
          ${pageSlots.map((item, slotIndex) => `
            <div class="print-label-slot ${item ? 'filled' : 'empty'}" data-position="${slotIndex + 1}">
              ${item ? labelHtml(item) : ''}
            </div>`).join('')}
        </div>
      </section>`;
  }).join('');

  els.sheetCount.textContent = `${pageCount} A4 sheet${pageCount === 1 ? '' : 's'}`;
  updateSelectionSummary();
}

function printSelected() {
  if (!state.selected.size) return;
  window.print();
}

els.search.addEventListener('input', () => {
  state.search = els.search.value;
  state.filterTool = null;
  applyFilters();
});

els.department.addEventListener('change', () => {
  state.department = els.department.value;
  state.filterTool = null;
  applyFilters();
});

els.preset.addEventListener('change', () => {
  state.presetId = els.preset.value;
  state.startPosition = 1;
  applyPresetVariables();
  saveSettings();
  renderSheets();
});

els.start.addEventListener('change', () => {
  state.startPosition = Number(els.start.value) || 1;
  saveSettings();
  renderSheets();
});

els.copies.addEventListener('change', () => {
  state.copies = Math.min(20, Math.max(1, Number(els.copies.value) || 1));
  els.copies.value = state.copies;
  saveSettings();
  renderSheets();
});

els.guides.addEventListener('change', () => {
  state.showGuides = els.guides.checked;
  saveSettings();
  renderSheets();
});

els.selectVisible.addEventListener('click', () => {
  state.visible.forEach(item => state.selected.add(item.id));
  renderPicker();
  renderSheets();
});

els.clear.addEventListener('click', () => {
  state.selected.clear();
  renderPicker();
  renderSheets();
});

els.printButtons.forEach(button => button.addEventListener('click', printSelected));

init().catch(error => {
  els.picker.innerHTML = `<div class="empty-card">${esc(error.message)}</div>`;
  els.sheets.innerHTML = `<div class="empty-sheet-message"><strong>Could not load labels</strong><span>${esc(error.message)}</span></div>`;
});
