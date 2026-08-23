const sharedDefinitions = {
  ppe: {},
  sectionIcons: {},
  hazardTypes: {},
  categoryFallbacks: []
};

function genericPpeIconSvg() {
  return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="18"/><path d="m16 24 5 5 11-12 3 3-14 15-8-8 3-3Z" fill="white"/></svg>';
}

function ppeIconHtml(key) {
  const item = sharedDefinitions.ppe?.[key] || {};
  if (item.icon) {
    return `<img src="${escapeHtml(item.icon)}" alt="" aria-hidden="true">`;
  }
  return genericPpeIconSvg();
}

function sectionIconHtml(key, fallback = '') {
  const item = sharedDefinitions.sectionIcons?.[key] || {};
  if (item.icon) {
    return `<img src="${escapeHtml(item.icon)}" alt="" aria-hidden="true">`;
  }
  return escapeHtml(fallback);
}

function renderHazardTags(keys = []) {
  if (!Array.isArray(keys) || !keys.length) return '';
  const chips = keys.map(key => {
    const item = sharedDefinitions.hazardTypes?.[key] || { label: key, tone: 'warning' };
    return `<span class="hazard-tag ${escapeHtml(item.tone || 'warning')}">${escapeHtml(item.label || key)}</span>`;
  }).join('');
  return `<div class="hazard-tags" aria-label="Hazard types">${chips}</div>`;
}

const state = {
  departments: [],
  tools: [],
  visibleTools: [],
  selectedToolId: null,
  mode: 'student',
  departmentFilter: 'engineering',
  sectionFilter: 'all',
  search: '',
  defaultDepartment: 'engineering',
  defaultMode: 'student',
  studentPublicationMode: 'curated-drafts',
  view: 'home',
  publicBaseUrl: 'https://pukekohetech.github.io/techsop/',
  printSelectionMode: false,
  printSelection: new Set(),
  pendingPrintToolIds: [],
  pendingPrintMode: 'student'
};

const els = {
  homeView: document.getElementById('homeView'),
  detailView: document.getElementById('detailView'),
  departmentCards: document.getElementById('departmentCards'),
  toolGrid: document.getElementById('toolGrid'),
  emptyTools: document.getElementById('emptyTools'),
  toolsHeading: document.getElementById('toolsHeading'),
  toolCount: document.getElementById('toolCount'),
  sectionFilterPanel: document.getElementById('sectionFilterPanel'),
  sectionChips: document.getElementById('sectionChips'),
  modeHint: document.getElementById('modeHint'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  sopCard: document.getElementById('sopCard'),
  studentModeBtn: document.getElementById('studentModeBtn'),
  teacherModeBtn: document.getElementById('teacherModeBtn'),
  brandHomeBtn: document.getElementById('brandHomeBtn'),
  backHomeBtn: document.getElementById('backHomeBtn'),
  printBtn: document.getElementById('printBtn'),
  jumpPrev: document.getElementById('jumpPrev'),
  jumpNext: document.getElementById('jumpNext'),
  shareSopBtn: document.getElementById('shareSopBtn'),
  qrLabelsBtn: document.getElementById('qrLabelsBtn'),
  shareDialog: document.getElementById('shareDialog'),
  shareDialogTitle: document.getElementById('shareDialogTitle'),
  shareQrImage: document.getElementById('shareQrImage'),
  shareUrlInput: document.getElementById('shareUrlInput'),
  copyShareLinkBtn: document.getElementById('copyShareLinkBtn'),
  openShareLink: document.getElementById('openShareLink'),
  downloadQrLink: document.getElementById('downloadQrLink'),
  printQrCardLink: document.getElementById('printQrCardLink'),
  closeShareDialogBtn: document.getElementById('closeShareDialogBtn'),
  shareSafetyNote: document.getElementById('shareSafetyNote'),
  batchPrintToolbar: document.getElementById('batchPrintToolbar'),
  togglePrintSelectBtn: document.getElementById('togglePrintSelectBtn'),
  selectVisiblePrintBtn: document.getElementById('selectVisiblePrintBtn'),
  clearPrintSelectionBtn: document.getElementById('clearPrintSelectionBtn'),
  openBatchPrintBtn: document.getElementById('openBatchPrintBtn'),
  printDialog: document.getElementById('printDialog'),
  printDialogSummary: document.getElementById('printDialogSummary'),
  printDialogNote: document.getElementById('printDialogNote'),
  twoUpPrintOption: document.getElementById('twoUpPrintOption'),
  closePrintDialogBtn: document.getElementById('closePrintDialogBtn'),
  cancelPrintBtn: document.getElementById('cancelPrintBtn'),
  confirmPrintBtn: document.getElementById('confirmPrintBtn'),
  batchPrintRoot: document.getElementById('batchPrintRoot')
};

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

async function loadAllData() {
  const manifest = await fetchJson('data/manifest.json');
  const site = manifest.site || {};
  state.defaultDepartment = site.defaultDepartment || manifest.defaultDepartment || 'engineering';
  state.defaultMode = site.defaultMode === 'teacher' ? 'teacher' : 'student';
  state.studentPublicationMode = site.studentPublicationMode === 'approved-only' ? 'approved-only' : 'curated-drafts';
  state.publicBaseUrl = normaliseBaseUrl(site.publicBaseUrl || state.publicBaseUrl);
  state.departmentFilter = state.defaultDepartment;
  state.mode = state.defaultMode;

  const sharedFile = site.sharedDefinitions || manifest.sharedDefinitions;
  if (sharedFile) {
    const loadedShared = await fetchJson(`data/${sharedFile}`);
    Object.assign(sharedDefinitions, loadedShared || {});
  }

  const datasetEntries = Array.isArray(manifest.datasets)
    ? manifest.datasets
        .filter(entry => entry && entry.enabled !== false && entry.file)
        .sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000))
    : (manifest.files || []).map((file, index) => ({
        id: String(file).replace(/\.json$/i, ''),
        file,
        enabled: true,
        order: index,
        modes: ['student', 'teacher']
      }));

  const loaded = await Promise.all(datasetEntries.map(async config => ({
    config,
    data: await fetchJson(`data/${config.file}`)
  })));

  state.departments = loaded
    .map(({ config, data }) => ({
      ...data.department,
      meta: data.meta || {},
      datasetConfig: config
    }))
    .filter(dept => dept && dept.id && dept.name);

  state.tools = loaded.flatMap(({ config, data }) => (data.tools || []).map(tool => ({
    ...tool,
    slug: tool.slug || tool.id,
    department: data.department,
    datasetMeta: data.meta || {},
    datasetConfig: config,
    searchBlob: [
      tool.name,
      tool.category,
      tool.section,
      ...(tool.aliases || []),
      ...(tool.sourceSheets || []),
      data.department?.name
    ].filter(Boolean).join(' ').toLowerCase()
  })));

  restoreFromHash();
  renderAll();
}

function datasetAllowsMode(tool, mode) {
  const modes = tool.datasetConfig?.modes;
  return !Array.isArray(modes) || modes.includes(mode);
}

function canShowInStudentMode(tool) {
  // Conservative safety rule: local approval may restrict access, but it cannot
  // override a teacher-only source, a hidden tool, or an uncurated summary.
  if (!datasetAllowsMode(tool, 'student')) return false;
  if (tool.sourceAccess === 'teacher-only') return false;
  if (tool.studentVisible === false) return false;
  if (tool.student?.summaryStatus !== 'curated') return false;
  if (tool.local?.studentUseApproved === false) return false;
  if (state.studentPublicationMode === 'approved-only' && tool.local?.studentUseApproved !== true) return false;
  return true;
}

function departmentCount(departmentId) {
  return state.tools.filter(tool => {
    const deptOk = departmentId === 'all' || tool.department?.id === departmentId;
    const modeOk = state.mode === 'teacher' ? datasetAllowsMode(tool, 'teacher') : canShowInStudentMode(tool);
    return deptOk && modeOk;
  }).length;
}

function renderAll() {
  applyHomeFilters();
  renderMode();
  renderDepartments();
  renderSectionFilters();
  renderToolGrid();
  // A direct QR/hash route can restore the app straight into detail view.
  // Render the selected SOP before revealing the detail panel so it is never blank.
  if (state.view === 'detail' && state.selectedToolId) renderCurrentTool();
  renderView();
  updateHash();
}

function applyHomeFilters() {
  const q = state.search.trim().toLowerCase();
  state.visibleTools = state.tools.filter(tool => {
    const departmentOk = state.departmentFilter === 'all' || tool.department?.id === state.departmentFilter;
    const sectionOk = state.sectionFilter === 'all' || tool.section === state.sectionFilter;
    const modeOk = state.mode === 'teacher' ? datasetAllowsMode(tool, 'teacher') : canShowInStudentMode(tool);
    const searchOk = !q || tool.searchBlob.includes(q);
    return departmentOk && sectionOk && modeOk && searchOk;
  });

  const imageRank = tool => tool.image ? 0 : 1;
  state.visibleTools.sort((a,b) => imageRank(a) - imageRank(b) || (a.section || '').localeCompare(b.section || '') || (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
}

function renderMode() {
  const student = state.mode === 'student';
  els.studentModeBtn.classList.toggle('active', student);
  els.teacherModeBtn.classList.toggle('active', !student);
  els.studentModeBtn.setAttribute('aria-pressed', String(student));
  els.teacherModeBtn.setAttribute('aria-pressed', String(!student));
  els.modeHint.textContent = student
    ? (state.studentPublicationMode === 'approved-only'
        ? 'Student mode shows locally approved student SOPs only.'
        : 'Student mode shows curated SOPs; items awaiting local review remain clearly marked DRAFT.')
    : 'Teacher mode shows the full RAMS / SOP library with access and local-review status.';
  if (els.qrLabelsBtn) els.qrLabelsBtn.classList.toggle('hidden', student);
}

function renderDepartments() {
  const visibleDepartments = state.departments.filter(dept => {
    const modes = dept.datasetConfig?.modes;
    const modeAllowed = !Array.isArray(modes) || modes.includes(state.mode);
    return modeAllowed && departmentCount(dept.id) > 0;
  });
  const cards = [{ id: 'all', name: 'All departments', icon: '▦' }, ...visibleDepartments];
  els.departmentCards.innerHTML = cards.map(dept => {
    const count = departmentCount(dept.id);
    const active = dept.id === state.departmentFilter;
    const label = state.mode === 'student' ? 'student SOPs' : 'teacher items';
    return `
      <button class="department-card ${active ? 'active' : ''}" type="button" data-department="${escapeHtml(dept.id)}" aria-pressed="${active}">
        <span class="department-icon" aria-hidden="true">${escapeHtml(dept.icon || '📘')}</span>
        <strong>${escapeHtml(dept.name)}</strong>
        <span class="department-meta">${count} ${label}</span>
      </button>`;
  }).join('');

  els.departmentCards.querySelectorAll('[data-department]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.departmentFilter = btn.dataset.department;
      state.sectionFilter = 'all';
      state.selectedToolId = null;
      state.view = 'home';
      applyHomeFilters();
      renderDepartments();
      renderSectionFilters();
      renderToolGrid();
      updateHash();
    });
  });
}


function sectionOptionsForCurrentDepartment() {
  if (state.departmentFilter === 'all') return [];
  const dept = state.departments.find(d => d.id === state.departmentFilter);
  if (!dept) return [];
  const configured = Array.isArray(dept.sections) ? dept.sections : [];
  const present = [...new Set(state.tools
    .filter(tool => tool.department?.id === state.departmentFilter)
    .filter(tool => state.mode === 'teacher' ? datasetAllowsMode(tool, 'teacher') : canShowInStudentMode(tool))
    .map(tool => tool.section)
    .filter(Boolean))];
  const ordered = configured.filter(name => present.includes(name));
  present.forEach(name => { if (!ordered.includes(name)) ordered.push(name); });
  return ordered;
}

function renderSectionFilters() {
  if (!els.sectionFilterPanel || !els.sectionChips) return;
  const options = sectionOptionsForCurrentDepartment();
  if (!options.length) {
    state.sectionFilter = 'all';
    els.sectionFilterPanel.classList.add('hidden');
    els.sectionChips.innerHTML = '';
    return;
  }
  if (state.sectionFilter !== 'all' && !options.includes(state.sectionFilter)) state.sectionFilter = 'all';
  const chips = ['all', ...options];
  els.sectionChips.innerHTML = chips.map(name => {
    const active = name === state.sectionFilter;
    const label = name === 'all' ? 'All' : name;
    return `<button class="section-chip ${active ? 'active' : ''}" type="button" data-section="${escapeHtml(name)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
  }).join('');
  els.sectionFilterPanel.classList.remove('hidden');
  els.sectionChips.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.sectionFilter = btn.dataset.section;
      applyHomeFilters();
      renderSectionFilters();
      renderToolGrid();
      updateHash();
    });
  });
}

function teacherHomeStatus(tool) {
  const local = tool.local || {};
  if (tool.sourceAccess === 'teacher-only') return { label: 'Teacher only', cls: 'danger' };
  if (local.studentUseApproved === true) return { label: 'PHS approved', cls: 'safe' };
  if (local.studentUseApproved === false) return { label: 'Student use not approved', cls: 'danger' };
  if (!local.reviewed || tool.localReviewRequired) return { label: 'Local review needed', cls: 'warn' };
  return { label: 'Teacher reference', cls: 'neutral' };
}

function toolPrintableInMode(tool, mode = state.mode) {
  if (!tool) return false;
  return mode === 'teacher' ? datasetAllowsMode(tool, 'teacher') : canShowInStudentMode(tool);
}

function selectedPrintTools(mode = state.mode) {
  return state.tools.filter(tool => state.printSelection.has(tool.id) && toolPrintableInMode(tool, mode));
}

function renderBatchPrintControls() {
  if (!els.batchPrintToolbar) return;
  const validIds = new Set(state.tools.filter(tool => toolPrintableInMode(tool)).map(tool => tool.id));
  [...state.printSelection].forEach(id => {
    if (!validIds.has(id)) state.printSelection.delete(id);
  });
  const count = state.printSelection.size;
  els.togglePrintSelectBtn.setAttribute('aria-pressed', String(state.printSelectionMode));
  els.togglePrintSelectBtn.textContent = state.printSelectionMode
    ? 'Done selecting'
    : (count ? `Edit selection (${count})` : 'Select SOPs');
  els.selectVisiblePrintBtn.classList.toggle('hidden', !state.printSelectionMode);
  els.clearPrintSelectionBtn.classList.toggle('hidden', count === 0);
  els.openBatchPrintBtn.classList.toggle('hidden', count === 0);
  els.openBatchPrintBtn.disabled = count === 0;
  els.openBatchPrintBtn.textContent = `Print selected (${count})`;
  els.toolGrid.classList.toggle('selection-mode', state.printSelectionMode);
}

function setPrintSelectionMode(enabled) {
  state.printSelectionMode = !!enabled;
  renderToolGrid();
  renderBatchPrintControls();
}

function togglePrintSelection(toolId) {
  const tool = state.tools.find(item => item.id === toolId);
  if (!toolPrintableInMode(tool)) return;
  if (state.printSelection.has(toolId)) state.printSelection.delete(toolId);
  else state.printSelection.add(toolId);
  renderToolGrid();
  renderBatchPrintControls();
}

function selectAllVisibleForPrint() {
  state.visibleTools.forEach(tool => {
    if (toolPrintableInMode(tool)) state.printSelection.add(tool.id);
  });
  renderToolGrid();
  renderBatchPrintControls();
}

function clearPrintSelection() {
  state.printSelection.clear();
  renderToolGrid();
  renderBatchPrintControls();
}

function renderToolGrid() {
  const departmentName = state.departmentFilter === 'all'
    ? 'All departments'
    : (state.departments.find(d => d.id === state.departmentFilter)?.name || 'Safety SOPs');
  els.toolsHeading.textContent = departmentName;
  els.toolCount.textContent = `${state.visibleTools.length} ${state.mode === 'student' ? 'student SOP' : 'teacher item'}${state.visibleTools.length === 1 ? '' : 's'}`;
  els.clearSearchBtn.classList.toggle('hidden', !state.search);

  els.toolGrid.innerHTML = state.visibleTools.map(tool => {
    const selected = state.printSelection.has(tool.id);
    const image = tool.image
      ? `<img src="${escapeHtml(tool.image)}" alt="${escapeHtml(tool.name)}" loading="lazy" decoding="async">`
      : `<div class="tool-fallback" aria-hidden="true">${categoryIcon(tool)}</div>`;
    const source = (tool.sourceSheets || []).join(', ');
    const sourceBadge = tool.sourceLabel || 'RAMS';
    const teacherStatus = state.mode === 'teacher' ? teacherHomeStatus(tool) : null;
    return `
      <article class="tool-card-wrap ${selected ? 'selected' : ''}">
        <button class="tool-card" type="button" data-tool-id="${escapeHtml(tool.id)}"
          aria-label="${state.printSelectionMode ? `${selected ? 'Remove' : 'Add'} ${escapeHtml(tool.name)} ${selected ? 'from' : 'to'} batch print selection` : `Open ${escapeHtml(tool.name)} ${state.mode === 'student' ? 'student SOP' : 'teacher SOP'}`}"
          ${state.printSelectionMode ? `aria-pressed="${selected}"` : ''}>
          <span class="tool-card-image">
            ${image}
            <span class="tool-access ${state.mode === 'student' ? 'student' : ''}">${state.mode === 'student' ? 'Student SOP' : 'Teacher SOP'}</span>
            <span class="tool-print-marker" aria-hidden="true">${selected ? '✓' : '+'}</span>
          </span>
          <span class="tool-card-copy">
            <strong>${escapeHtml(tool.name)}</strong>
            ${tool.category ? `<span>${escapeHtml(tool.category)}</span>` : ''}
            ${state.mode === 'teacher' && teacherStatus ? `<span class="tool-teacher-status ${teacherStatus.cls}">${escapeHtml(teacherStatus.label)}</span>` : ''}
            ${source ? `<span class="tool-source">${escapeHtml(sourceBadge)} ${escapeHtml(source)}</span>` : ''}
          </span>
        </button>
      </article>`;
  }).join('');

  els.emptyTools.classList.toggle('hidden', state.visibleTools.length > 0);
  els.toolGrid.querySelectorAll('[data-tool-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.printSelectionMode) togglePrintSelection(btn.dataset.toolId);
      else openTool(btn.dataset.toolId);
    });
  });
  renderBatchPrintControls();
}

function categoryIcon(tool) {
  const haystack = `${tool.name} ${tool.category || ''}`.toLowerCase();
  for (const item of (sharedDefinitions.categoryFallbacks || [])) {
    const terms = Array.isArray(item.terms) ? item.terms : [];
    if (terms.some(term => haystack.includes(String(term).toLowerCase()))) return item.symbol || '•';
  }
  return tool.department?.icon || '•';
}

function openTool(id) {
  const tool = state.tools.find(t => t.id === id);
  if (!tool) return;
  if (state.mode === 'student' && !canShowInStudentMode(tool)) return;
  state.selectedToolId = id;
  state.departmentFilter = tool.department?.id || state.departmentFilter;
  state.sectionFilter = tool.section || 'all';
  state.view = 'detail';
  renderCurrentTool();
  renderView();
  updateHash();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function goHome() {
  state.selectedToolId = null;
  state.view = 'home';
  applyHomeFilters();
  renderDepartments();
  renderSectionFilters();
  renderToolGrid();
  renderView();
  updateHash();
  setTimeout(() => els.searchInput.focus(), 0);
}

function renderView() {
  const detail = state.view === 'detail' && !!state.selectedToolId;
  els.homeView.classList.toggle('hidden', detail);
  els.detailView.classList.toggle('hidden', !detail);
  updateShareButton();
}

function getCurrentTool() {
  return state.tools.find(t => t.id === state.selectedToolId) || null;
}

function renderCurrentTool() {
  const tool = getCurrentTool();
  if (!tool) {
    els.sopCard.innerHTML = '<section class="empty-tools"><strong>SOP not found.</strong><span>Return to the SOP home screen and choose another item.</span></section>';
    return;
  }
  els.sopCard.innerHTML = state.mode === 'student' ? renderStudentSop(tool) : renderTeacherSop(tool);
  if (state.mode === 'teacher') bindTeacherDetailControls();
}

function heroHtml(tool) {
  return tool.image
    ? `<div class="hero-card"><img src="${escapeHtml(tool.image)}" alt="${escapeHtml(tool.name)}" decoding="async"></div>`
    : `<div class="hero-card"><div class="fallback-image"><div><strong>${escapeHtml(tool.name)}</strong><span>WebP image not added yet.</span></div></div></div>`;
}

function accessBadge(tool, student = false) {
  if (tool.sourceAccess === 'teacher-only') return '<span class="access-badge danger">Source restricts student use</span>';
  if (tool.sourceAccess === 'age-or-maturity-restricted') return '<span class="access-badge caution">Teacher approval / maturity restriction</span>';
  if (!student) return '<span class="access-badge neutral">Local review required</span>';
  return '';
}

function studentPrintDensity(tool) {
  const student = tool?.student || {};
  const listKeys = ['ppe', 'hazards', 'beforeStart', 'dos', 'donts', 'stop', 'hazardTags'];
  const itemCount = listKeys.reduce((total, key) => total + (Array.isArray(student[key]) ? student[key].length : 0), 0);
  const characterCount = [student.headline, ...listKeys.flatMap(key => student[key] || [])].filter(Boolean).join(' ').length;
  const restrictionWeight = tool?.sourceAccess === 'age-or-maturity-restricted' ? 3 : 0;
  const score = itemCount + (characterCount / 180) + restrictionWeight;
  if (score <= 23.5) return 'print-density-roomy';
  if (score <= 29.5) return 'print-density-standard';
  return 'print-density-compact';
}

function renderStudentSop(tool) {
  const s = tool.student || {};
  const source = escapeHtml((tool.sourceSheets || []).join(', '));
  const reviewBadge = tool.local?.reviewed === true && tool.local?.studentUseApproved === true
    ? '<span class="student-status-badge approved">PHS approved</span>'
    : '<span class="student-status-badge draft">DRAFT • PHS review pending</span>';
  const restrictionBadge = tool.sourceAccess === 'age-or-maturity-restricted'
    ? '<span class="student-status-badge caution">Teacher approval required</span>'
    : '';
  const restrictionNote = tool.sourceAccess === 'age-or-maturity-restricted'
    ? '<div class="student-alert"><strong>Teacher check:</strong> this activity has age, maturity, training or supervision limits. Follow your teacher’s instructions.</div>'
    : '';

  return `
    <div class="student-sheet student-safety-card ${studentPrintDensity(tool)}">
      <header class="student-card-brandline">
        <div class="student-card-school">
          <img src="assets/phs-shield.svg" alt="" aria-hidden="true">
          <span><strong>Pukekohe High School</strong><small>Technology • Student SOP</small></span>
        </div>
        <div class="student-card-status">${restrictionBadge}${reviewBadge}</div>
      </header>

      <section class="student-card-hero">
        <div class="student-machine-image">${heroHtml(tool)}</div>
        <div class="student-machine-summary">
          <div class="dept-kicker">${escapeHtml(tool.department?.name || '')}</div>
          <div class="tool-title-row">
            <h2>${escapeHtml(tool.name)}</h2>
            ${tool.category ? `<span class="category-chip">${escapeHtml(tool.category)}</span>` : ''}
          </div>
          <p class="student-lead">${escapeHtml(s.headline || '')}</p>
          <div class="student-ppe-block">
            <div class="student-section-label"><span class="section-number wear">PPE</span><strong>Wear this / Get ready</strong></div>
            <div class="ppe-grid student-ppe-grid">${renderPpe(s.ppe || [])}</div>
          </div>
        </div>
      </section>

      ${restrictionNote}

      <section class="student-quick-grid">
        <div class="quick-panel watch-panel">
          <div class="quick-panel-heading"><span class="quick-icon section-art" aria-hidden="true">${sectionIconHtml('hazards', '!')}</span><span><small>WATCH OUT</small><strong>Hazards</strong></span></div>
          ${renderHazardTags(s.hazardTags || [])}
          <ul class="student-bullet-list hazard-list">${renderList(s.hazards)}</ul>
        </div>

        <div class="quick-panel ready-panel">
          <div class="quick-panel-heading"><span class="quick-icon section-art" aria-hidden="true">${sectionIconHtml('beforeStart', '1')}</span><span><small>GET READY</small><strong>Before you start</strong></span></div>
          <ul class="student-bullet-list tick-list">${renderList(s.beforeStart)}</ul>
        </div>

        <div class="quick-panel do-panel-v2">
          <div class="quick-panel-heading"><span class="quick-icon section-art" aria-hidden="true">${sectionIconHtml('safeActions', '✓')}</span><span><small>DO THIS</small><strong>Safe actions</strong></span></div>
          <ul class="student-bullet-list tick-list">${renderList(s.dos)}</ul>
        </div>

        <div class="quick-panel never-panel">
          <div class="quick-panel-heading"><span class="quick-icon section-art" aria-hidden="true">${sectionIconHtml('unsafeActions', '×')}</span><span><small>NEVER</small><strong>Unsafe actions</strong></span></div>
          <ul class="student-bullet-list cross-list">${renderList(s.donts)}</ul>
        </div>
      </section>

      <section class="student-stop-bar">
        <div class="stop-title"><span class="stop-icon" aria-hidden="true">${sectionIconHtml('stop', 'STOP')}</span><span><small>STOP THE JOB</small><strong>Tell the teacher when:</strong></span></div>
        <ul class="student-stop-list">${renderList(s.stop)}</ul>
      </section>

      <footer class="student-card-footer">
        <span>RAMS ${source || 'local source'}</span>
        <span>This quick SOP supports teacher instruction. Follow the exact machine rules in your workshop.</span>
      </footer>
    </div>`;
}

function renderStudentTwoUpSop(tool) {
  const student = tool.student || {};
  const source = escapeHtml((tool.sourceSheets || []).join(', ') || 'local source');
  const approved = tool.local?.reviewed === true && tool.local?.studentUseApproved === true;
  const restricted = tool.sourceAccess === 'age-or-maturity-restricted';
  const actionPanel = (className, iconKey, fallback, kicker, title, items, extra = '') => `
    <section class="two-up-action-panel ${className}">
      <header><span class="two-up-section-icon" aria-hidden="true">${sectionIconHtml(iconKey, fallback)}</span><span><small>${kicker}</small><strong>${title}</strong></span></header>
      ${extra}
      <ul>${renderList(items)}</ul>
    </section>`;

  return `
    <article class="student-two-up-card">
      <header class="two-up-brandline">
        <div><img src="assets/phs-shield.svg" alt="" aria-hidden="true"><span><strong>Pukekohe High School</strong><small>Technology • Student SOP</small></span></div>
        <span class="two-up-status ${approved ? 'approved' : 'draft'}">${approved ? 'PHS approved' : 'DRAFT • Review pending'}</span>
      </header>

      <section class="two-up-hero">
        <div class="two-up-machine-image">${heroHtml(tool)}</div>
        <div class="two-up-summary">
          <small>${escapeHtml(tool.department?.name || '')}</small>
          <h2>${escapeHtml(tool.name)}</h2>
          <p>${escapeHtml(student.headline || '')}</p>
        </div>
      </section>

      <section class="two-up-ppe">
        <header><strong>PPE • Wear this / Get ready</strong></header>
        <div class="ppe-grid">${renderPpe(student.ppe || [])}</div>
      </section>

      ${restricted ? '<p class="two-up-alert"><strong>Teacher approval required:</strong> follow all training, maturity and supervision limits.</p>' : ''}

      <section class="two-up-action-grid">
        ${actionPanel('watch', 'hazards', '!', 'WATCH OUT', 'Hazards', student.hazards, renderHazardTags(student.hazardTags || []))}
        ${actionPanel('ready', 'beforeStart', '1', 'GET READY', 'Before you start', student.beforeStart)}
        ${actionPanel('safe', 'safeActions', '✓', 'DO THIS', 'Safe actions', student.dos)}
        ${actionPanel('unsafe', 'unsafeActions', '×', 'NEVER', 'Unsafe actions', student.donts)}
      </section>

      <section class="two-up-stop">
        <span class="two-up-stop-icon" aria-hidden="true">${sectionIconHtml('stop', 'STOP')}</span>
        <div><strong>STOP THE JOB • Tell the teacher when:</strong><ul>${renderList(student.stop)}</ul></div>
      </section>

      <footer class="two-up-footer"><span>RAMS ${source}</span><span>Follow teacher instruction, training and the exact workshop rules.</span></footer>
    </article>`;
}

function namespaceTeacherPrintHtml(html, toolId) {
  const prefix = String(toolId || 'sop').replace(/[^a-z0-9_-]/gi, '-');
  return html
    .replaceAll('id="teacher', `id="${prefix}-teacher`)
    .replaceAll('data-teacher-jump="teacher-', `data-teacher-jump="${prefix}-teacher-`);
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function renderPrintSheets(tools, mode, layout) {
  if (layout === 'two-up' && mode === 'student') {
    return chunkItems(tools, 2).map(pair => `
      <section class="batch-print-sheet two-up-print-sheet">
        ${pair.map(tool => renderStudentTwoUpSop(tool)).join('')}
      </section>`).join('');
  }
  return tools.map(tool => {
    const sop = mode === 'teacher'
      ? namespaceTeacherPrintHtml(renderTeacherSop(tool), tool.id)
      : renderStudentSop(tool);
    return `<section class="batch-print-sheet full-print-sheet ${mode}-print-sheet" data-print-tool="${escapeHtml(tool.id)}">${sop}</section>`;
  }).join('');
}

function closePrintDialog() {
  if (typeof els.printDialog?.close === 'function') els.printDialog.close();
  else els.printDialog?.removeAttribute('open');
}

function openPrintDialog(scope = 'current') {
  const requested = scope === 'selected'
    ? selectedPrintTools()
    : [getCurrentTool()].filter(tool => toolPrintableInMode(tool));
  if (!requested.length || !els.printDialog) return;

  state.pendingPrintToolIds = requested.map(tool => tool.id);
  state.pendingPrintMode = state.mode;
  const count = requested.length;
  const noun = state.mode === 'student'
    ? (count === 1 ? 'student SOP' : 'student SOPs')
    : (count === 1 ? 'teacher SOP / RAMS' : 'teacher SOPs / RAMS records');
  els.printDialogSummary.textContent = count === 1
    ? `${requested[0].name} • ${noun}`
    : `${count} selected ${noun} in one print job`;

  const allowTwoUp = state.mode === 'student' && count > 1;
  els.twoUpPrintOption.classList.toggle('hidden', !allowTwoUp);
  const fullOption = els.printDialog.querySelector('input[name="printLayout"][value="full"]');
  if (fullOption) fullOption.checked = true;
  els.printDialogNote.textContent = state.mode === 'teacher'
    ? 'Teacher SOP / RAMS content is always printed at full width and may continue onto extra pages.'
    : (allowTwoUp
        ? 'Both layouts retain every student safety section. One-per-page provides the clearest classroom copy.'
        : 'This SOP will expand to use the printable A4 page while retaining all safety content.');

  if (typeof els.printDialog.showModal === 'function') els.printDialog.showModal();
  else els.printDialog.setAttribute('open', '');
}

function installPrintPageStyle(layout) {
  document.getElementById('dynamicPrintPageStyle')?.remove();
  const style = document.createElement('style');
  style.id = 'dynamicPrintPageStyle';
  style.media = 'print';
  style.textContent = layout === 'two-up'
    ? '@page { size: A4 landscape; margin: 6mm; }'
    : '@page { size: A4 portrait; margin: 7mm; }';
  document.head.append(style);
}

function preparePrintSession(tools, mode, layout) {
  els.batchPrintRoot.innerHTML = renderPrintSheets(tools, mode, layout);
  els.batchPrintRoot.className = `batch-print-root ${layout === 'two-up' ? 'two-up-layout' : 'full-layout'} ${mode}-batch`;
  els.batchPrintRoot.setAttribute('aria-hidden', 'false');
  els.batchPrintRoot.querySelectorAll('details.teacher-accordion').forEach(item => { item.open = true; });
  document.body.classList.remove('print-layout-full', 'print-layout-two-up', 'print-mode-student', 'print-mode-teacher');
  document.body.classList.add('print-session-active', `print-layout-${layout}`, `print-mode-${mode}`);
  document.documentElement.classList.remove('print-layout-full', 'print-layout-two-up');
  document.documentElement.classList.add(`print-layout-${layout}`);
  installPrintPageStyle(layout);
}

function clearPrintSession() {
  document.body.classList.remove('print-session-active', 'print-layout-full', 'print-layout-two-up', 'print-mode-student', 'print-mode-teacher');
  document.documentElement.classList.remove('print-layout-full', 'print-layout-two-up');
  els.batchPrintRoot.className = 'batch-print-root';
  els.batchPrintRoot.innerHTML = '';
  els.batchPrintRoot.setAttribute('aria-hidden', 'true');
  document.getElementById('dynamicPrintPageStyle')?.remove();
}

async function waitForPrintImages(root) {
  const images = [...root.querySelectorAll('img')];
  const waiting = images.map(image => {
    if (image.complete) return Promise.resolve();
    return new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  });
  await Promise.race([
    Promise.all(waiting),
    new Promise(resolve => setTimeout(resolve, 4000))
  ]);
  if (document.fonts?.ready) await document.fonts.ready;
}

async function confirmPrintRequest() {
  const mode = state.pendingPrintMode;
  const tools = state.pendingPrintToolIds
    .map(id => state.tools.find(tool => tool.id === id))
    .filter(tool => toolPrintableInMode(tool, mode));
  if (!tools.length) return;
  const requestedLayout = els.printDialog.querySelector('input[name="printLayout"]:checked')?.value || 'full';
  const layout = requestedLayout === 'two-up' && mode === 'student' && tools.length > 1 ? 'two-up' : 'full';
  closePrintDialog();
  preparePrintSession(tools, mode, layout);
  await waitForPrintImages(els.batchPrintRoot);
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

function teacherAccessStatus(tool) {
  const local = tool.local || {};
  if (tool.sourceAccess === 'teacher-only') {
    return { label: 'Teacher only', tone: 'danger', detail: 'The source material restricts student use.' };
  }
  if (local.studentUseApproved === true) {
    return { label: 'Student use approved', tone: 'safe', detail: local.minimumYear ? `Local minimum: ${local.minimumYear}` : 'Locally approved for student use.' };
  }
  if (local.studentUseApproved === false) {
    return { label: 'Student use not approved', tone: 'danger', detail: 'Do not treat this as a student-use SOP.' };
  }
  if (tool.sourceAccess === 'age-or-maturity-restricted') {
    return { label: 'Teacher approval required', tone: 'warn', detail: local.minimumYear ? `Minimum year: ${local.minimumYear}` : 'Age, maturity or supervision restriction applies.' };
  }
  if (local.studentUseCandidate || tool.studentVisible) {
    return { label: 'Local approval needed', tone: 'warn', detail: 'Curated student summary exists, but PHS review is still required.' };
  }
  return { label: 'Teacher reference', tone: 'neutral', detail: 'Not currently presented as a student-use SOP.' };
}

function teacherListHtml(items = [], className = 'teacher-list') {
  if (!items?.length) return '<p class="teacher-empty">No separate items are recorded in this source section.</p>';
  return `<ul class="${className}">${renderList(items)}</ul>`;
}

function teacherAccordion({ id, icon, title, subtitle = '', items = [], tone = '', open = false, body = '' }) {
  if (!items?.length && !body) return '';
  const count = items?.length || 0;
  return `
    <details class="teacher-accordion ${tone}" id="${escapeHtml(id)}" ${open ? 'open' : ''}>
      <summary>
        <span class="teacher-accordion-icon" aria-hidden="true">${icon}</span>
        <span class="teacher-accordion-title"><strong>${escapeHtml(title)}</strong>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}</span>
        ${count ? `<span class="teacher-accordion-count">${count}</span>` : ''}
        <span class="teacher-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="teacher-accordion-body">${body || teacherListHtml(items)}</div>
    </details>`;
}

function localStatusCopy(tool) {
  const local = tool.local || {};
  if (local.reviewed) return 'Local PHS review recorded';
  return 'Local PHS review still required';
}

function renderTeacherSop(tool) {
  const t = tool.teacher || {};
  const local = tool.local || {};
  const meta = tool.datasetMeta || {};
  const access = teacherAccessStatus(tool);
  const sourceSheets = tool.sourceSheets || [];
  const sourceLabel = sourceSheets.length ? sourceSheets.join(', ') : 'local source';
  const sourceBadge = tool.sourceLabel || 'RAMS';
  const sourceNote = meta.legalContextNote || 'Review this material against current local requirements before use.';
  const localNotes = local.notes || [];
  const supervision = local.supervision || t.supervision || 'Set locally';
  const training = t.training || 'Confirm competency and local authorisation before use.';
  const restrictionItems = t.restrictions || [];

  const hazardRiskBody = `
    <div class="teacher-two-column-detail">
      <section><h4>Hazards identified</h4>${teacherListHtml(t.hazards)}</section>
      <section><h4>Risk assessment notes</h4>${teacherListHtml(t.riskAssessment)}</section>
    </div>`;

  const storageBody = `
    <div class="teacher-two-column-detail">
      <section><h4>Storage</h4>${teacherListHtml(t.storage)}</section>
      <section><h4>Disposal</h4>${teacherListHtml(t.disposal)}</section>
    </div>
    ${t.furtherInformation?.length ? `<section class="teacher-subsection"><h4>Further information</h4>${teacherListHtml(t.furtherInformation)}</section>` : ''}`;

  const localBody = `
    <div class="teacher-local-grid">
      <div class="teacher-local-status ${local.reviewed ? 'reviewed' : 'pending'}">
        <strong>${local.reviewed ? 'Reviewed locally' : 'Review pending'}</strong>
        <span>${local.studentUseApproved === true ? 'Student use approved locally.' : local.studentUseApproved === false ? 'Student use is not approved locally.' : 'Student-use approval has not yet been recorded.'}</span>
        ${local.minimumYear ? `<span>Minimum year: ${escapeHtml(local.minimumYear)}</span>` : ''}
      </div>
      <div>
        <h4>Local notes</h4>
        ${teacherListHtml(localNotes)}
      </div>
      <div>
        <h4>Teacher checks</h4>
        ${teacherListHtml(t.teacherChecks)}
      </div>
    </div>`;

  const referenceBody = `
    ${teacherListHtml(t.references, 'reference-list')}
    ${meta.sourceTitle ? `<p class="teacher-source-meta"><strong>Dataset source:</strong> ${escapeHtml(meta.sourceTitle)}</p>` : ''}
    ${meta.sourceEdition ? `<p class="teacher-source-meta"><strong>Dataset note:</strong> ${escapeHtml(meta.sourceEdition)}</p>` : ''}`;

  return `
    <div class="teacher-layout teacher-safety-card">
      <header class="teacher-card-brandline">
        <div class="teacher-card-school">
          <img src="assets/phs-shield.svg" alt="" aria-hidden="true">
          <span><strong>Pukekohe High School</strong><small>Technology • Teacher SOP / RAMS reference</small></span>
        </div>
        <div class="teacher-card-source"><span>${escapeHtml(sourceBadge)}</span><strong>${escapeHtml(sourceLabel)}</strong></div>
      </header>

      <section class="teacher-hero">
        <div class="teacher-machine-image">${heroHtml(tool)}</div>
        <div class="teacher-machine-summary">
          <div class="dept-kicker">${escapeHtml(tool.department?.name || '')}</div>
          <div class="tool-title-row">
            <h2>${escapeHtml(tool.name)}</h2>
            ${tool.category ? `<span class="category-chip">${escapeHtml(tool.category)}</span>` : ''}
          </div>
          <p class="teacher-lead">${escapeHtml(t.overview || '')}</p>

          <div class="teacher-status-grid">
            <div class="teacher-status-card ${access.tone}"><small>Student access</small><strong>${escapeHtml(access.label)}</strong><span>${escapeHtml(access.detail)}</span></div>
            <div class="teacher-status-card"><small>Supervision</small><strong>${escapeHtml(supervision)}</strong></div>
            <div class="teacher-status-card"><small>Training</small><strong>${escapeHtml(training)}</strong></div>
            <div class="teacher-status-card ${local.reviewed ? 'safe' : 'warn'}"><small>PHS review</small><strong>${escapeHtml(localStatusCopy(tool))}</strong></div>
          </div>
        </div>
      </section>

      <section class="teacher-ppe-strip">
        <div class="teacher-strip-heading"><span class="teacher-strip-icon">PPE</span><span><small>PROTECTION</small><strong>Required PPE / preparation</strong></span></div>
        <div class="ppe-grid teacher-ppe-grid">${renderPpe(t.ppe?.length ? t.ppe : (tool.student?.ppe || []))}</div>
      </section>

      ${restrictionItems.length || tool.sourceAccess === 'teacher-only' ? `
        <section class="teacher-critical-banner ${tool.sourceAccess === 'teacher-only' ? 'danger' : ''}">
          <div><span class="teacher-critical-icon" aria-hidden="true">!</span><span><small>CHECK BEFORE USE</small><strong>${tool.sourceAccess === 'teacher-only' ? 'Student use is restricted by the source' : 'Restrictions apply'}</strong></span></div>
          ${restrictionItems.length ? teacherListHtml(restrictionItems, 'teacher-critical-list') : '<p>Keep this item in Teacher mode unless a current PHS-specific assessment explicitly permits otherwise.</p>'}
        </section>` : ''}

      <section class="teacher-local-warning">
        <strong>Local adaptation required</strong>
        <span>${escapeHtml(sourceNote)}</span>
      </section>

      <nav class="teacher-jump-nav no-print" aria-label="Jump to teacher SOP section">
        <span>Jump to:</span>
        <button type="button" data-teacher-jump="teacher-before">Before use</button>
        <button type="button" data-teacher-jump="teacher-controls">Safe use</button>
        ${t.shutdown?.length ? '<button type="button" data-teacher-jump="teacher-shutdown">Shutdown</button>' : ''}
        <button type="button" data-teacher-jump="teacher-hazards">Hazards</button>
        ${restrictionItems.length ? '<button type="button" data-teacher-jump="teacher-restrictions">Restrictions</button>' : ''}
        ${t.firstAid?.length ? '<button type="button" data-teacher-jump="teacher-first-aid">First aid</button>' : ''}
        <button type="button" data-teacher-jump="teacher-local">PHS review</button>
        <button type="button" data-teacher-jump="teacher-sources">Sources</button>
        <span class="teacher-nav-spacer"></span>
        <button id="teacherExpandAll" type="button" class="teacher-nav-action">Open all</button>
        <button id="teacherCollapseAll" type="button" class="teacher-nav-action">Close details</button>
      </nav>

      <section class="teacher-accordion-stack">
        ${teacherAccordion({ id: 'teacher-before', icon: '1', title: 'Before use', subtitle: 'Pre-start checks and setup controls', items: t.preStart, tone: 'priority', open: true })}
        ${teacherAccordion({ id: 'teacher-controls', icon: '✓', title: 'Safe use controls', subtitle: 'Controls to apply while the activity is underway', items: t.safeUse, tone: 'priority', open: true })}
        ${teacherAccordion({ id: 'teacher-shutdown', icon: '■', title: 'Shutdown & housekeeping', subtitle: 'What must happen before the area is left', items: t.shutdown, tone: 'priority', open: true })}
        ${teacherAccordion({ id: 'teacher-restrictions', icon: '!', title: 'Restrictions', subtitle: 'Source limits, competency limits and prohibited use', items: restrictionItems, tone: 'restriction', open: restrictionItems.length > 0 })}
        ${teacherAccordion({ id: 'teacher-hazards', icon: '⚠', title: 'Hazards & risk reasoning', subtitle: 'Fuller source-derived hazard and risk notes', body: hazardRiskBody })}
        ${teacherAccordion({ id: 'teacher-storage', icon: '⌂', title: 'Storage, disposal & further information', subtitle: 'Supporting source information', body: storageBody })}
        ${teacherAccordion({ id: 'teacher-first-aid', icon: '+', title: 'Immediate remedial measures / source first aid', subtitle: 'Source text for incident response — follow current school emergency procedures', items: t.firstAid, tone: 'first-aid' })}
        ${teacherAccordion({ id: 'teacher-local', icon: 'PHS', title: 'Pukekohe High School local review', subtitle: 'Approval, local notes and teacher checks', body: localBody, tone: 'local', open: !local.reviewed })}
        ${teacherAccordion({ id: 'teacher-sources', icon: '↗', title: 'Source references', subtitle: 'Source references and dataset provenance', body: referenceBody })}
      </section>

      <footer class="teacher-card-footer">
        <span><strong>${escapeHtml(tool.name)}</strong> • ${escapeHtml(sourceBadge)} ${escapeHtml(sourceLabel)}</span>
        <span>This teacher view preserves the fuller source material; no safety text is shortened to fit the page.</span>
      </footer>
    </div>`;
}

function bindTeacherDetailControls() {
  const root = els.sopCard;
  if (!root) return;

  root.querySelectorAll('[data-teacher-jump]').forEach(button => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.teacherJump);
      if (!target) return;
      if (target.tagName === 'DETAILS') target.open = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  root.querySelector('#teacherExpandAll')?.addEventListener('click', () => {
    root.querySelectorAll('details.teacher-accordion').forEach(item => { item.open = true; });
  });

  root.querySelector('#teacherCollapseAll')?.addEventListener('click', () => {
    root.querySelectorAll('details.teacher-accordion').forEach(item => { item.open = false; });
    root.querySelector('.teacher-accordion-stack')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderPpe(keys) {
  if (!keys?.length) return '<p class="tag-line">Check the full SOP and teacher instructions for required PPE.</p>';
  return keys.map(key => {
    const item = sharedDefinitions.ppe?.[key] || { label: key };
    return `<div class="ppe-item"><div class="ppe-icon">${ppeIconHtml(key)}</div><div><strong>${escapeHtml(item.label || key)}</strong></div></div>`;
  }).join('');
}

function renderList(items = []) {
  if (!items?.length) return '';
  return items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function setMode(mode) {
  const modeChanged = state.mode !== mode;
  state.mode = mode;
  if (modeChanged) {
    state.printSelection.clear();
    state.printSelectionMode = false;
  }
  const current = getCurrentTool();
  if (state.view === 'detail' && mode === 'student' && current && !canShowInStudentMode(current)) {
    state.selectedToolId = null;
    state.view = 'home';
  }
  const departmentHasItems = state.tools.some(tool => {
    const deptOk = state.departmentFilter === 'all' || tool.department?.id === state.departmentFilter;
    const modeOk = mode === 'teacher' ? datasetAllowsMode(tool, 'teacher') : canShowInStudentMode(tool);
    return deptOk && modeOk;
  });
  if (!departmentHasItems) {
    state.departmentFilter = state.defaultDepartment;
    state.sectionFilter = 'all';
  }
  renderMode();
  renderDepartments();
  renderSectionFilters();
  applyHomeFilters();
  renderToolGrid();
  if (state.view === 'detail') renderCurrentTool();
  renderView();
  updateHash();
}

function jumpSelection(delta) {
  const current = getCurrentTool();
  if (!current) return;
  const siblings = state.tools.filter(tool => {
    const deptOk = tool.department?.id === current.department?.id;
    const modeOk = state.mode === 'teacher' ? datasetAllowsMode(tool, 'teacher') : canShowInStudentMode(tool);
    return deptOk && modeOk;
  });
  siblings.sort((a,b) => a.name.localeCompare(b.name));
  const index = siblings.findIndex(t => t.id === current.id);
  const next = siblings[(index + delta + siblings.length) % siblings.length];
  if (next) openTool(next.id);
}

function normaliseBaseUrl(value) {
  const base = String(value || '').trim();
  return base.endsWith('/') ? base : `${base}/`;
}

function routeSlug(tool) {
  return tool?.slug || tool?.id || '';
}

function findToolByRoute(departmentId, slugOrId) {
  return state.tools.find(tool => tool.department?.id === departmentId && (routeSlug(tool) === slugOrId || tool.id === slugOrId)) || null;
}

function hashForTool(tool, mode = 'student') {
  const dept = encodeURIComponent(tool.department?.id || state.defaultDepartment);
  const slug = encodeURIComponent(routeSlug(tool));
  return mode === 'teacher' ? `#/teacher/${dept}/${slug}` : `#/${dept}/${slug}`;
}

function hashForDepartment(departmentId, mode = 'student') {
  if (!departmentId) return mode === 'teacher' ? '#/teacher' : '#/';
  const dept = encodeURIComponent(departmentId);
  return mode === 'teacher' ? `#/teacher/${dept}` : `#/${dept}`;
}

function publicUrlForTool(tool, mode = 'student') {
  return `${state.publicBaseUrl}${hashForTool(tool, mode)}`;
}

function updateHash() {
  let hash;
  if (state.view === 'detail' && state.selectedToolId) {
    const tool = getCurrentTool();
    hash = tool ? hashForTool(tool, state.mode) : hashForDepartment(state.departmentFilter, state.mode);
  } else {
    hash = hashForDepartment(state.departmentFilter, state.mode);
  }
  history.replaceState(null, '', hash);
}

function restoreLegacyHash(raw) {
  const params = new URLSearchParams(raw);
  const hashMode = params.get('mode');
  state.mode = hashMode === 'teacher' ? 'teacher' : (hashMode === 'student' ? 'student' : state.defaultMode);
  state.search = params.get('search') || '';
  state.selectedToolId = params.get('tool');
  const tool = state.selectedToolId ? state.tools.find(t => t.id === state.selectedToolId) : null;
  state.departmentFilter = params.get('department') || tool?.department?.id || state.defaultDepartment;
  const toolAllowed = tool && (state.mode === 'teacher' ? datasetAllowsMode(tool, 'teacher') : canShowInStudentMode(tool));
  state.view = toolAllowed ? 'detail' : 'home';
  if (state.view === 'home') state.selectedToolId = null;
}

function restoreFromHash() {
  const raw = location.hash.replace(/^#/, '');
  state.search = '';
  state.selectedToolId = null;
  state.view = 'home';

  if (!raw || raw === '/') {
    state.mode = state.defaultMode;
    state.departmentFilter = state.defaultDepartment;
    els.searchInput.value = '';
    return;
  }

  // Backwards compatibility with the Step 4 query-style hashes.
  if (raw.includes('=')) {
    restoreLegacyHash(raw);
    els.searchInput.value = state.search;
    return;
  }

  const parts = raw.replace(/^\/+/, '').split('/').filter(Boolean).map(part => {
    try { return decodeURIComponent(part); } catch { return part; }
  });

  let index = 0;
  state.mode = state.defaultMode;
  if (parts[0] === 'teacher') {
    state.mode = 'teacher';
    index = 1;
  } else if (parts[0] === 'student') {
    state.mode = 'student';
    index = 1;
  }

  const departmentId = parts[index] || state.defaultDepartment;
  const slug = parts[index + 1] || '';
  state.departmentFilter = departmentId === 'all' || state.departments.some(d => d.id === departmentId) ? departmentId : state.defaultDepartment;

  if (slug) {
    const tool = findToolByRoute(state.departmentFilter, slug);
    const allowed = tool && (state.mode === 'teacher' ? datasetAllowsMode(tool, 'teacher') : canShowInStudentMode(tool));
    if (allowed) {
      state.selectedToolId = tool.id;
      state.view = 'detail';
    }
  }
  els.searchInput.value = '';
}

function updateShareButton() {
  if (!els.shareSopBtn) return;
  const tool = getCurrentTool();
  const canShareStudent = !!tool && canShowInStudentMode(tool);
  els.shareSopBtn.classList.toggle('hidden', !canShareStudent || state.view !== 'detail');
  if (canShareStudent) {
    els.shareSopBtn.textContent = 'QR / Link';
    els.shareSopBtn.title = 'Open the direct Student SOP link and QR code';
  }
}

function openShareDialog() {
  const tool = getCurrentTool();
  if (!tool || !canShowInStudentMode(tool) || !els.shareDialog) return;
  const url = publicUrlForTool(tool, 'student');
  const qrPath = `assets/qrcodes/student/${tool.id}.svg`;
  els.shareDialogTitle.textContent = `${tool.name} — Student SOP`;
  els.shareQrImage.src = qrPath;
  els.shareQrImage.alt = `QR code for the ${tool.name} Student SOP`;
  els.shareUrlInput.value = url;
  els.openShareLink.href = url;
  els.downloadQrLink.href = qrPath;
  els.downloadQrLink.download = `${routeSlug(tool)}-student-sop-qr.svg`;
  els.printQrCardLink.href = `qr-labels.html#tool=${encodeURIComponent(tool.id)}`;
  els.shareSafetyNote.textContent = 'This QR opens the Student SOP only. It does not replace teacher instruction, training, permission or supervision.';
  if (typeof els.shareDialog.showModal === 'function') els.shareDialog.showModal();
  else els.shareDialog.setAttribute('open', '');
}

async function copyShareLink() {
  const value = els.shareUrlInput?.value || '';
  if (!value) return;
  let copied = false;
  try {
    await navigator.clipboard.writeText(value);
    copied = true;
  } catch {
    els.shareUrlInput.focus();
    els.shareUrlInput.select();
    copied = document.execCommand('copy');
  }
  if (copied && els.copyShareLinkBtn) {
    const old = els.copyShareLinkBtn.textContent;
    els.copyShareLinkBtn.textContent = 'Copied';
    setTimeout(() => { els.copyShareLinkBtn.textContent = old; }, 1200);
  }
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}


let teacherPrintOpenState = null;
window.addEventListener('beforeprint', () => {
  if (state.mode !== 'teacher') return;
  const details = [...document.querySelectorAll('details.teacher-accordion')];
  teacherPrintOpenState = details.map(item => item.open);
  details.forEach(item => { item.open = true; });
});
window.addEventListener('afterprint', () => {
  if (teacherPrintOpenState) {
    const details = [...document.querySelectorAll('details.teacher-accordion')];
    details.forEach((item, index) => { item.open = !!teacherPrintOpenState[index]; });
  }
  teacherPrintOpenState = null;
  clearPrintSession();
});

els.searchInput.addEventListener('input', () => {
  state.search = els.searchInput.value;
  applyHomeFilters();
  renderToolGrid();
  updateHash();
});
els.clearSearchBtn.addEventListener('click', () => {
  state.search = '';
  els.searchInput.value = '';
  applyHomeFilters();
  renderToolGrid();
  updateHash();
  els.searchInput.focus();
});
els.studentModeBtn.addEventListener('click', () => setMode('student'));
els.teacherModeBtn.addEventListener('click', () => setMode('teacher'));
els.brandHomeBtn.addEventListener('click', goHome);
els.backHomeBtn.addEventListener('click', goHome);
els.printBtn.addEventListener('click', () => openPrintDialog('current'));
els.togglePrintSelectBtn?.addEventListener('click', () => setPrintSelectionMode(!state.printSelectionMode));
els.selectVisiblePrintBtn?.addEventListener('click', selectAllVisibleForPrint);
els.clearPrintSelectionBtn?.addEventListener('click', clearPrintSelection);
els.openBatchPrintBtn?.addEventListener('click', () => openPrintDialog('selected'));
els.closePrintDialogBtn?.addEventListener('click', closePrintDialog);
els.cancelPrintBtn?.addEventListener('click', closePrintDialog);
els.confirmPrintBtn?.addEventListener('click', confirmPrintRequest);
els.printDialog?.addEventListener('click', event => {
  if (event.target === els.printDialog) closePrintDialog();
});
els.shareSopBtn?.addEventListener('click', openShareDialog);
els.copyShareLinkBtn?.addEventListener('click', copyShareLink);
els.closeShareDialogBtn?.addEventListener('click', () => {
  if (typeof els.shareDialog?.close === 'function') els.shareDialog.close();
  else els.shareDialog?.removeAttribute('open');
});
els.shareDialog?.addEventListener('click', event => {
  if (event.target === els.shareDialog && typeof els.shareDialog.close === 'function') els.shareDialog.close();
});
els.jumpPrev.addEventListener('click', () => jumpSelection(-1));
els.jumpNext.addEventListener('click', () => jumpSelection(1));
window.addEventListener('hashchange', () => { restoreFromHash(); renderAll(); });

loadAllData().catch(err => {
  console.error(err);
  els.toolGrid.innerHTML = `<section class="empty-tools"><strong>Could not load the SOP data.</strong><span>${escapeHtml(err.message)}</span></section>`;
});
