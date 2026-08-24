const state = {
  items: [],
  visible: [],
  search: '',
  department: 'all',
  filterTool: null,
  publicationMode: 'all-sops'
};
const els = {
  grid: document.getElementById('qrGrid'),
  search: document.getElementById('qrSearch'),
  department: document.getElementById('qrDepartment'),
  count: document.getElementById('qrCount'),
  showAll: document.getElementById('showAllBtn'),
  print: document.getElementById('printLabelsBtn')
};

async function loadJson(path){ const r=await fetch(path); if(!r.ok) throw new Error(`Could not load ${path}`); return r.json(); }
function esc(value=''){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function studentVisible(tool,modes){
  return modes.includes('student') && Boolean(tool.student);
}
function accessStatus(tool){
  const local=tool.local||{};
  if(tool.sourceAccess==='teacher-only'||local.studentUseApproved===false){
    return {tone:'danger',label:'REFERENCE ONLY • STUDENTS DO NOT OPERATE'};
  }
  if(tool.sourceAccess==='age-or-maturity-restricted'){
    return {tone:'caution',label:'TEACHER PERMISSION REQUIRED'};
  }
  if(local.studentUseCandidate===false){
    return {tone:'caution',label:'TEACHER DIRECTION REQUIRED'};
  }
  return {tone:'published',label:'PUBLISHED STUDENT SOP'};
}
function parseToolFilter(){
  const raw=location.hash.replace(/^#/,'');
  const params=new URLSearchParams(raw);
  return params.get('tool');
}
async function init(){
  const manifest=await loadJson('data/manifest.json');
  state.publicationMode=manifest.site?.studentPublicationMode||'all-sops';
  const entries=(manifest.datasets||[]).filter(e=>e.enabled!==false && (e.modes||['student','teacher']).includes('student'));
  const loaded=await Promise.all(entries.map(async entry=>({entry,data:await loadJson(`data/${entry.file}`)})));
  state.items=loaded.flatMap(({entry,data})=>{
    const modes=entry.modes||['student','teacher'];
    return (data.tools||[]).filter(t=>studentVisible(t,modes)).map(t=>({
      ...t,
      department:data.department,
      slug:t.slug||t.id,
      access:accessStatus(t),
      qr:`assets/qrcodes/student/${t.id}.svg`,
      route:`#/${data.department.id}/${t.slug||t.id}`,
      search:`${t.name} ${t.category||''} ${(t.aliases||[]).join(' ')} ${data.department.name}`.toLowerCase()
    }));
  });
  const depts=[...new Map(state.items.map(i=>[i.department.id,i.department])).values()];
  els.department.innerHTML='<option value="all">All departments</option>'+depts.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
  state.filterTool=parseToolFilter();
  apply();
}
function apply(){
  const q=state.search.trim().toLowerCase();
  state.visible=state.items.filter(item=>{
    const toolOk=!state.filterTool || item.id===state.filterTool;
    const deptOk=state.department==='all'||item.department.id===state.department;
    const searchOk=!q||item.search.includes(q);
    return toolOk&&deptOk&&searchOk;
  });
  render();
}
function render(){
  els.count.textContent=`${state.visible.length} label${state.visible.length===1?'':'s'}`;
  els.grid.innerHTML=state.visible.length?state.visible.map(item=>`
    <article class="qr-label ${item.access.tone}">
      <div class="label-copy">
        <div class="label-brand"><img src="assets/phs-shield.svg" alt=""><span><strong>PUKEKOHE HIGH SCHOOL</strong><small>Technology Safety Hub</small></span></div>
        <p class="label-dept">${esc(item.department.name)}</p>
        <h2>${esc(item.name)}</h2>
        <p class="label-review ${item.access.tone}">${esc(item.access.label)}</p>
        <p class="scan-copy"><strong>Scan before use</strong><br>Open the Student safety SOP for this equipment or activity.</p>
        <p class="safety-copy">Teacher training, permission and supervision are still required. The QR code does not authorise machine use.</p>
      </div>
      <div class="qr-side">
        <img src="${esc(item.qr)}" alt="QR code for ${esc(item.name)} Student SOP">
        <strong>STUDENT SOP</strong>
        <span class="short-route">techsop/${esc(item.route)}</span>
      </div>
    </article>`).join(''):document.getElementById('emptyQrTemplate').innerHTML;
}
els.search.addEventListener('input',()=>{state.search=els.search.value;apply();});
els.department.addEventListener('change',()=>{state.department=els.department.value;apply();});
els.showAll.addEventListener('click',()=>{state.filterTool=null;state.search='';state.department='all';els.search.value='';els.department.value='all';history.replaceState(null,'',location.pathname);apply();});
els.print.addEventListener('click',()=>window.print());
init().catch(err=>{els.grid.innerHTML=`<div class="empty-card">${esc(err.message)}</div>`;});
