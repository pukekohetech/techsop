const PRESETS = {
  cupboard: {
    label: 'Cupboard 80 × 90 mm — centred',
    cols: 2, rows: 3,
    labelW: 80, labelH: 90,
    gapX: 2, gapY: 2,
    padL: 24, padR: 24, padT: 11.5, padB: 11.5,
    tone: 'cupboard'
  },
  'student-fit': {
    label: 'Student 99.1 × 38.1 mm — centred',
    cols: 2, rows: 7,
    labelW: 99.1, labelH: 38.1,
    gapX: 1.8, gapY: 0,
    padL: 5, padR: 5, padT: 15.15, padB: 15.15,
    tone: 'student'
  },
  custom: {
    label: 'Custom label sheet',
    cols: 2, rows: 7,
    labelW: 99.1, labelH: 38.1,
    gapX: 3, gapY: 0,
    padL: 4.4, padR: 4.4, padT: 15.15, padB: 15.15,
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
  showGuides: true,
  custom: {
    cols: 2, rows: 7,
    labelW: 99.1, labelH: 38.1,
    gapX: 3, gapY: 0,
    leftGap: 4.4, topGap: 15.15,
    autoCentre: true
  }
};

const els = {
  sheets: document.getElementById('printSheets'),
  picker: document.getElementById('qrPicker'),
  search: document.getElementById('qrSearch'),
  department: document.getElementById('qrDepartment'),
  preset: document.getElementById('labelPreset'),
  customFields: document.getElementById('customPresetFields'),
  customLabelW: document.getElementById('customLabelWidth'),
  customLabelH: document.getElementById('customLabelHeight'),
  customCols: document.getElementById('customColumns'),
  customRows: document.getElementById('customRows'),
  customGapX: document.getElementById('customGapX'),
  customGapY: document.getElementById('customGapY'),
  customAutoCentre: document.getElementById('customAutoCentre'),
  customLeftGap: document.getElementById('customLeftGap'),
  customRightGap: document.getElementById('customRightGap'),
  customTopGap: document.getElementById('customTopGap'),
  customBottomGap: document.getElementById('customBottomGap'),
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

function parseToolRequest() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const multiple = params.get('tools');
  if (multiple) {
    return {
      ids: [...new Set(multiple.split(',').map(id => id.trim()).filter(Boolean))],
      restrictList: false
    };
  }
  const single = params.get('tool');
  return { ids: single ? [single] : [], restrictList: Boolean(single) };
}

function currentPreset() {
  if (state.presetId === 'custom') {
    return {
      ...PRESETS.custom,
      ...state.custom,
      padL: state.custom.leftGap,
      padR: 0,
      padT: state.custom.topGap,
      padB: 0,
      tone: state.custom.labelH >= 60 ? 'cupboard' : 'student'
    };
  }
  return PRESETS[state.presetId] || PRESETS['student-fit'];
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

function numberFrom(input, fallback, min, max, whole = false) {
  let value = Number(input.value);
  if (!Number.isFinite(value)) value = fallback;
  value = Math.min(max, Math.max(min, value));
  return whole ? Math.round(value) : rounded(value);
}

function calculateCentredGaps(custom = state.custom) {
  const gridW = custom.cols * custom.labelW + (custom.cols - 1) * custom.gapX;
  const gridH = custom.rows * custom.labelH + (custom.rows - 1) * custom.gapY;
  return {
    leftGap: rounded(Math.max(0, (210 - gridW) / 2)),
    topGap: rounded(Math.max(0, (297 - gridH) / 2))
  };
}

function positionedGaps(preset = currentPreset()) {
  const gridW = preset.cols * preset.labelW + (preset.cols - 1) * preset.gapX;
  const gridH = preset.rows * preset.labelH + (preset.rows - 1) * preset.gapY;
  return {
    gridW,
    gridH,
    leftGap: preset.padL,
    rightGap: rounded(210 - preset.padL - gridW),
    topGap: preset.padT,
    bottomGap: rounded(297 - preset.padT - gridH)
  };
}

function syncCustomControls() {
  const custom = state.custom;
  els.customLabelW.value = custom.labelW;
  els.customLabelH.value = custom.labelH;
  els.customCols.value = custom.cols;
  els.customRows.value = custom.rows;
  els.customGapX.value = custom.gapX;
  els.customGapY.value = custom.gapY;
  els.customAutoCentre.checked = custom.autoCentre;
  els.customLeftGap.readOnly = custom.autoCentre;
  els.customTopGap.readOnly = custom.autoCentre;
  els.customLeftGap.value = rounded(custom.leftGap);
  els.customTopGap.value = rounded(custom.topGap);
  const positioned = positionedGaps(currentPreset());
  els.customRightGap.value = rounded(positioned.rightGap);
  els.customBottomGap.value = rounded(positioned.bottomGap);
  els.customFields.classList.toggle('hidden', state.presetId !== 'custom');
}

function readCustomControls() {
  const previous = state.custom;
  const next = {
    cols: numberFrom(els.customCols, previous.cols, 1, 8, true),
    rows: numberFrom(els.customRows, previous.rows, 1, 20, true),
    labelW: numberFrom(els.customLabelW, previous.labelW, 10, 210),
    labelH: numberFrom(els.customLabelH, previous.labelH, 10, 297),
    gapX: numberFrom(els.customGapX, previous.gapX, 0, 50),
    gapY: numberFrom(els.customGapY, previous.gapY, 0, 50),
    leftGap: numberFrom(els.customLeftGap, previous.leftGap, 0, 200),
    topGap: numberFrom(els.customTopGap, previous.topGap, 0, 140),
    autoCentre: els.customAutoCentre.checked
  };
  if (next.autoCentre) Object.assign(next, calculateCentredGaps(next));
  state.custom = next;
  syncCustomControls();
}

function presetCapacity() {
  const preset = currentPreset();
  return preset.cols * preset.rows;
}

function layoutFit(preset = currentPreset()) {
  const placed = positionedGaps(preset);
  const overflowLeft = Math.max(0, -placed.leftGap);
  const overflowRight = Math.max(0, -placed.rightGap);
  const overflowTop = Math.max(0, -placed.topGap);
  const overflowBottom = Math.max(0, -placed.bottomGap);
  return {
    fits: overflowLeft <= 0.001 && overflowRight <= 0.001 && overflowTop <= 0.001 && overflowBottom <= 0.001,
    ...placed,
    overflowW: overflowLeft + overflowRight,
    overflowH: overflowTop + overflowBottom
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function customContentLayout(preset = currentPreset()) {
  const width = preset.labelW;
  const height = preset.labelH;
  const stacked = width < 62 || height > width * 1.08;
  const areaScale = Math.sqrt((width * height) / (99.1 * 38.1));
  const shapeScale = stacked
    ? areaScale
    : Math.min((width / 99.1) * 1.08, height / 38.1);
  const scale = clamp(shapeScale, .5, 1.75);
  const brandH = clamp(height * (stacked ? .13 : .19), 4.8, 10.5);
  const bodyH = Math.max(1, height - brandH - 2.2);
  const qrSize = stacked
    ? clamp(Math.min(width * .54, bodyH * .58), 8, 70)
    : clamp(Math.min(width * .34, bodyH - 4.2), 8, 70);
  const titlePt = clamp(11 * scale, 5.6, 22);
  const gap = clamp(Math.min(width, height) * .035, .55, 3);
  const density = height < 22 || width < 40
    ? 'micro'
    : height < 42 || width < 68
      ? 'compact'
      : 'roomy';
  return {
    stacked,
    density,
    brandH: rounded(brandH),
    qrSize: rounded(qrSize),
    titlePt: rounded(titlePt),
    brandPt: rounded(clamp(7.4 * scale, 5.1, 13)),
    sublinePt: rounded(clamp(6.6 * scale, 4.8, 11)),
    deptPt: rounded(clamp(7 * scale, 5.2, 11.5)),
    statusPt: rounded(clamp(6.65 * scale, 5.1, 10.5)),
    instructionPt: rounded(clamp(7.4 * scale, 5.5, 12.5)),
    qrCaptionPt: rounded(clamp(7.2 * scale, 5.2, 12)),
    padX: rounded(clamp(width * .018, .7, 3.2)),
    padY: rounded(clamp(height * .032, .55, 2.7)),
    gap: rounded(gap),
    qrColumn: rounded(qrSize + 1),
    borderTop: rounded(clamp(brandH * .13, .7, 1.65)),
    radius: rounded(clamp(brandH * .22, 1, 2.5)),
    brandImageW: rounded(brandH * .55),
    brandImageH: rounded(brandH * .68),
    brandGap: rounded(clamp(gap * .7, .55, 1.7)),
    titleMargin: rounded(clamp(gap * .35, .25, 1.5)),
    statusPadY: rounded(clamp(gap * .28, .25, .9)),
    statusPadX: rounded(clamp(gap * .5, .45, 1.4)),
    qrGap: rounded(clamp(gap * .2, .15, 1)),
    instructionMargin: rounded(clamp(gap * .5, .4, 1.5)),
    contentComfortable: qrSize >= 16 && titlePt >= 7.2 && width >= 32 && height >= 18
  };
}

function customLayoutStyle(layout) {
  return [
    `--custom-brand-h-mm:${layout.brandH}`,
    `--custom-qr-mm:${layout.qrSize}`,
    `--custom-title-pt:${layout.titlePt}`,
    `--custom-brand-pt:${layout.brandPt}`,
    `--custom-subline-pt:${layout.sublinePt}`,
    `--custom-dept-pt:${layout.deptPt}`,
    `--custom-status-pt:${layout.statusPt}`,
    `--custom-instruction-pt:${layout.instructionPt}`,
    `--custom-qr-caption-pt:${layout.qrCaptionPt}`,
    `--custom-pad-x-mm:${layout.padX}`,
    `--custom-pad-y-mm:${layout.padY}`,
    `--custom-content-gap-mm:${layout.gap}`,
    `--custom-qr-column-mm:${layout.qrColumn}`,
    `--custom-border-top-mm:${layout.borderTop}`,
    `--custom-radius-mm:${layout.radius}`,
    `--custom-brand-image-w-mm:${layout.brandImageW}`,
    `--custom-brand-image-h-mm:${layout.brandImageH}`,
    `--custom-brand-gap-mm:${layout.brandGap}`,
    `--custom-title-margin-mm:${layout.titleMargin}`,
    `--custom-status-pad-y-mm:${layout.statusPadY}`,
    `--custom-status-pad-x-mm:${layout.statusPadX}`,
    `--custom-qr-gap-mm:${layout.qrGap}`,
    `--custom-instruction-margin-mm:${layout.instructionMargin}`
  ].join(';');
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved.presetId === 'student-original') state.presetId = 'custom';
    else if (PRESETS[saved.presetId]) state.presetId = saved.presetId;
    state.startPosition = Math.max(1, Number(saved.startPosition) || 1);
    state.copies = Math.min(20, Math.max(1, Number(saved.copies) || 1));
    state.showGuides = saved.showGuides !== false;
    if (saved.custom && typeof saved.custom === 'object') {
      const migrated = {
        ...saved.custom,
        leftGap: saved.custom.leftGap ?? saved.custom.sideGap ?? state.custom.leftGap
      };
      delete migrated.sideGap;
      state.custom = { ...state.custom, ...migrated };
      if (state.custom.autoCentre !== false) Object.assign(state.custom, calculateCentredGaps(state.custom));
    }
  } catch {}
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      presetId: state.presetId,
      startPosition: state.startPosition,
      copies: state.copies,
      showGuides: state.showGuides,
      custom: state.custom
    }));
  } catch {}
}

function applyPresetVariables() {
  syncCustomControls();
  const preset = currentPreset();
  const fit = layoutFit(preset);
  const root = document.documentElement;
  for (const [name, value] of Object.entries({
    '--label-cols': preset.cols,
    '--label-rows': preset.rows,
    '--label-width-mm': preset.labelW,
    '--label-height-mm': preset.labelH,
    '--label-gap-x-mm': preset.gapX,
    '--label-gap-y-mm': preset.gapY,
    '--page-offset-left-mm': fit.leftGap,
    '--page-offset-top-mm': fit.topGap
  })) root.style.setProperty(name, value);

  els.specs.innerHTML = `
    <span><strong>${preset.cols} × ${preset.rows}</strong> labels</span>
    <span><strong>${preset.labelW} × ${preset.labelH} mm</strong> each</span>
    <span><strong>${rounded(fit.leftGap)} / ${rounded(fit.rightGap)} mm</strong> left/right gaps</span>
    <span><strong>${rounded(fit.topGap)} / ${rounded(fit.bottomGap)} mm</strong> top/bottom gaps</span>
    <span><strong>${preset.gapX} mm</strong> centre/column gap</span>
    <span><strong>${preset.gapY} mm</strong> gap between rows</span>`;

  const centred = state.presetId !== 'custom' || state.custom.autoCentre;
  const contentLayout = state.presetId === 'custom' ? customContentLayout(preset) : null;
  const contentFits = !contentLayout || contentLayout.contentComfortable;
  els.fit.className = `fit-notice ${fit.fits && contentFits ? 'good' : 'warning'}`;
  if (!fit.fits) {
    els.fit.innerHTML = `<strong>These measurements do not fit A4.</strong> Reduce the label size, number of labels, or gaps by ${Math.max(fit.overflowW, fit.overflowH).toFixed(1)} mm or more.`;
  } else {
    const positionMessage = centred
      ? `The outside gaps are equal on both sides and equal at the top and bottom.`
      : `The custom left and top starting position is being used; right and bottom gaps are calculated automatically.`;
    const contentMessage = contentLayout
      ? contentLayout.contentComfortable
        ? ` Content will use a ${contentLayout.stacked ? 'stacked' : 'side-by-side'} layout with an approximately ${contentLayout.qrSize} mm QR code and ${contentLayout.titlePt} pt heading.`
        : ` The sheet fits, but the labels are too small for a reliably readable QR and heading. Increase each label to about 60 × 35 mm or use a similarly roomy shape.`
      : '';
    const fitHeading = contentFits
      ? centred ? 'Centred and fits A4 at 100%.' : 'Fits A4 at 100%.'
      : 'A4 layout fits, but label content is too small.';
    els.fit.innerHTML = `<strong>${fitHeading}</strong> ${positionMessage}${contentMessage}`;
  }

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

  const toolRequest = parseToolRequest();
  const validIds = new Set(state.items.map(item => item.id));
  toolRequest.ids.filter(id => validIds.has(id)).forEach(id => state.selected.add(id));
  state.filterTool = toolRequest.restrictList && toolRequest.ids.length === 1 && validIds.has(toolRequest.ids[0])
    ? toolRequest.ids[0]
    : null;
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

function compactAccessLabel(item, density) {
  if (density === 'roomy') return item.access.label;
  if (item.access.tone === 'danger') return 'REFERENCE ONLY';
  if (item.access.tone === 'caution') return 'TEACHER PERMISSION';
  return 'STUDENT SOP';
}

function labelHtml(item, contentLayout = null) {
  const density = contentLayout?.density || 'roomy';
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
          <span class="print-label-status">${esc(compactAccessLabel(item, density))}</span>
          <p class="print-label-instruction">Scan for the Student SOP. Follow teacher instructions and supervision.</p>
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
  const contentLayout = state.presetId === 'custom' ? customContentLayout(preset) : null;
  const customClasses = contentLayout
    ? `preset-custom custom-${contentLayout.stacked ? 'stacked' : 'side'} custom-${contentLayout.density}`
    : '';
  const customStyle = contentLayout ? ` style="${customLayoutStyle(contentLayout)}"` : '';
  const capacity = preset.cols * preset.rows;
  const firstOffset = state.startPosition - 1;
  const totalSlots = firstOffset + labels.length;
  const pageCount = Math.ceil(totalSlots / capacity);
  const slots = Array(firstOffset).fill(null).concat(labels);
  while (slots.length < pageCount * capacity) slots.push(null);

  els.sheets.innerHTML = Array.from({ length: pageCount }, (_, pageIndex) => {
    const pageSlots = slots.slice(pageIndex * capacity, (pageIndex + 1) * capacity);
    return `
      <section class="print-sheet preset-${preset.tone} ${customClasses}"${customStyle} aria-label="Label sheet ${pageIndex + 1} of ${pageCount}">
        <div class="print-label-grid ${state.showGuides ? 'show-guides' : ''}">
          ${pageSlots.map((item, slotIndex) => `
            <div class="print-label-slot ${item ? 'filled' : 'empty'}" data-position="${slotIndex + 1}">
              ${item ? labelHtml(item, contentLayout) : ''}
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

function updateCustomPreset() {
  readCustomControls();
  state.startPosition = Math.min(state.startPosition, presetCapacity());
  applyPresetVariables();
  saveSettings();
  renderSheets();
}

[
  els.customLabelW,
  els.customLabelH,
  els.customCols,
  els.customRows,
  els.customGapX,
  els.customGapY,
  els.customLeftGap,
  els.customTopGap
].forEach(input => input.addEventListener('change', updateCustomPreset));
els.customAutoCentre.addEventListener('change', updateCustomPreset);

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
