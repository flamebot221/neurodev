(() => {
  'use strict';
  const D = window.NeuroDevData;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const toISO = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = () => toISO(new Date());
  const uid = () => crypto.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const url = value => /^https?:\/\//i.test(String(value || '')) ? esc(value) : '';
  let page = 'today', state, storageBlocked = false, deployedVersion = '';
  try { state = D.loadState(localStorage); }
  catch (error) { state = D.emptyState(); storageBlocked = true; }
  const activeProject = () => state.projects.find(p => p.status === 'active');

  function persist(message = 'Saved in this browser') {
    if (storageBlocked) { setStatus('Saved data could not be read. Export/import it before continuing.', true); return false; }
    try { localStorage.setItem(D.STORAGE_KEY, JSON.stringify(state)); setStatus(message); return true; }
    catch { setStatus('Browser storage is unavailable or full. Export your data before leaving.', true); return false; }
  }
  function setStatus(message, bad = false) { const el = $('#save-status'); el.textContent = message; el.classList.toggle('error', bad); }
  function field(label, name, value = '', options = {}) {
    const { type = 'text', wide = false, placeholder = '', required = false } = options;
    return `<label class="field ${wide ? 'wide' : ''}"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''}></label>`;
  }
  function area(label, name, value = '', wide = false, placeholder = '') {
    return `<label class="field ${wide ? 'wide' : ''}"><span>${esc(label)}</span><textarea name="${esc(name)}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
  }
  function select(label, name, value, choices, wide = false) {
    return `<label class="field ${wide ? 'wide' : ''}"><span>${esc(label)}</span><select name="${esc(name)}">${choices.map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  }
  function heading(title, description = '') { return `<header class="page-heading"><div><p class="eyebrow">NEURODEV / ${esc(title)}</p><h1>${esc(title)}</h1>${description ? `<p class="description">${esc(description)}</p>` : ''}</div></header>`; }
  function button(text, type = 'submit', extra = '') { return `<button class="button" type="${type}" ${extra}>${esc(text)}</button>`; }
  function blank(message) { return `<p class="empty">${esc(message)}</p>`; }
  function projectLabel(projectId) { return state.projects.find(p => p.id === projectId)?.name || ''; }

  function todayPage() {
    const project = activeProject();
    const now = today();
    const tasks = state.tasks.filter(t => !t.done && t.dueDate && t.dueDate <= now && (!t.projectId || t.projectId === project?.id));
    const deadlines = state.subjects.filter(s => s.examDate && s.examDate >= now && s.examDate <= addDays(now, 21)).sort((a, b) => a.examDate.localeCompare(b.examDate));
    const nextTask = project && state.tasks.find(t => !t.done && t.projectId === project.id && (!project.currentMilestone || t.milestone === project.currentMilestone));
    return `${heading('Today', new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))}
      <section class="today-focus" aria-labelledby="focus-title"><div class="eyebrow">ACTIVE PROJECT</div>
        ${project ? `<h2 id="focus-title">${esc(project.name)}</h2><p class="muted">${esc(project.problem || project.objective || 'Add a short problem statement in Projects.')}</p>
          <div class="focus-line"><b>Current milestone</b><span>${esc(project.currentMilestone || 'Set the current milestone in Projects.')}</span></div>
          <div class="focus-line"><b>Next action</b><span>${nextTask ? esc(nextTask.title) : 'Add one concrete task for this milestone.'}</span></div>
          <button class="text-button" type="button" data-page="projects">Open project →</button>`
          : `<h2 id="focus-title">Choose one project to work on</h2><p class="muted">Only one project can be active. Keep everything else queued.</p><button class="button" type="button" data-page="projects">Set active project</button>`}
      </section>
      <section class="section-block"><div class="section-head"><h2>Needs attention today</h2><button class="text-button" type="button" data-page="academics">Academics →</button></div>
        ${tasks.length ? `<ul class="task-list">${tasks.map(t => `<li><label><input type="checkbox" data-task-done="${esc(t.id)}"><span>${esc(t.title)}</span></label><small>${t.dueDate && t.dueDate < now ? 'Overdue' : t.dueDate ? 'Due today' : 'No date'}${t.projectId ? ` · ${esc(projectLabel(t.projectId))}` : ''}</small></li>`).join('')}</ul>` : blank('No tasks due today. Add one small next action to the active project.')}
        ${project ? `<form id="quick-task-form" class="inline-form">${field('Next concrete action', 'title', '', { placeholder: 'e.g. Train the baseline model', required: true })}${button('Add task')}</form>` : ''}
      </section>
      ${deadlines.length ? `<section class="section-block"><div class="section-head"><h2>Upcoming exams</h2><button class="text-button" type="button" data-page="academics">View subjects →</button></div><ul class="simple-list">${deadlines.map(s => `<li><b>${esc(s.name)}</b><span>${esc(s.examDate)}${s.examDate < now ? ' · overdue' : ''}</span></li>`).join('')}</ul></section>` : ''}
      <section class="section-block backlog-preview"><div class="section-head"><h2>Backlog</h2><button class="text-button" type="button" data-page="backlog">${state.backlog.length} saved · Review →</button></div><p class="muted">Capture ideas here; they are not commitments until you promote one.</p></section>`;
  }

  function projectForm(p = null) {
    const x = p || { name: '', problem: '', objective: '', deliverable: '', status: 'queued', currentMilestone: '', milestones: [], prerequisites: '', blockers: '', links: {}, notes: '' };
    return `<form class="project-form form-grid" data-project-form="${esc(p?.id || '')}">
      ${field('Project name', 'name', x.name, { required: true })}${select('Status', 'status', x.status, [['active', 'Active'], ['queued', 'Queued'], ['completed', 'Completed'], ['abandoned', 'Abandoned']])}
      ${area('Problem statement', 'problem', x.problem, true, 'What problem are you solving, and for whom?')}
      ${area('Objective', 'objective', x.objective, true, 'What should this project demonstrate?')}
      ${field('Expected deliverable', 'deliverable', x.deliverable, { wide: true, placeholder: 'A working prototype, report, benchmark…' })}
      ${field('Current milestone', 'currentMilestone', x.currentMilestone, { placeholder: 'One milestone in focus' })}
      ${area('Milestones (one per line)', 'milestones', (x.milestones || []).join('\n'))}
      ${area('Relevant prerequisites', 'prerequisites', x.prerequisites)}${area('Current blockers', 'blockers', x.blockers)}
      ${field('Repository link', 'repository', x.links?.repository, { type: 'url' })}${field('Dataset link', 'dataset', x.links?.dataset, { type: 'url' })}
      ${field('Documentation link', 'documentation', x.links?.documentation, { type: 'url' })}${field('Other resource', 'other', x.links?.other, { type: 'url' })}
      ${area('Experiment / results notes', 'notes', x.notes, true, 'Brief result and what it changes about the next step.')}
      <div class="form-actions wide">${button(p ? 'Save project' : 'Add queued project')}${p ? `<button class="quiet-button" type="button" data-cancel-edit>Cancel</button>` : ''}</div>
    </form>`;
  }

  function projectTasks(project) {
    const tasks = state.tasks.filter(t => t.projectId === project.id);
    return `${tasks.length ? `<ul class="task-list">${tasks.map(t => `<li><label><input type="checkbox" data-task-done="${esc(t.id)}" ${t.done ? 'checked' : ''}><span class="${t.done ? 'done' : ''}">${esc(t.title)}</span></label><small>${esc(t.milestone || 'No milestone')}${t.dueDate ? ` · ${esc(t.dueDate)}` : ''} <button class="text-button" type="button" data-delete-task="${esc(t.id)}" aria-label="Delete ${esc(t.title)}">Delete</button></small></li>`).join('')}</ul>` : blank('No tasks yet. Add the next observable action, not a broad intention.')}
      <form class="inline-form project-task-form" data-task-form="${esc(project.id)}">${field('Task', 'title', '', { required: true, placeholder: 'One action you can complete' })}${select('Milestone', 'milestone', project.currentMilestone || '', [['', 'Unassigned'], ...(project.milestones || []).map(m => [m, m])])}${field('Due date', 'dueDate', today(), { type: 'date' })}${button('Add task')}</form>`;
  }

  function projectsPage() {
    const active = state.projects.filter(p => p.status === 'active');
    const others = state.projects.filter(p => p.status !== 'active');
    return `${heading('Projects', 'One active project. Queue the rest until you deliberately switch.')}
      ${active.map(p => `<section class="project-card active-project"><div class="section-head"><div><span class="status-pill">ACTIVE</span><h2>${esc(p.name)}</h2></div><button class="quiet-button" type="button" data-edit-project="${esc(p.id)}">Edit</button></div>
        <p class="muted">${esc(p.problem || p.objective || 'Add a problem statement and objective.')}</p>
        <div class="project-meta"><div><b>Objective</b><span>${esc(p.objective || 'Not set')}</span></div><div><b>Deliverable</b><span>${esc(p.deliverable || 'Not set')}</span></div><div><b>Milestone</b><span>${esc(p.currentMilestone || 'Not set')}</span></div></div>
        <details><summary>Tasks, prerequisites, blockers, and notes</summary>${projectTasks(p)}<div class="project-meta"><div><b>Prerequisites</b><span>${esc(p.prerequisites || 'None listed')}</span></div><div><b>Blockers</b><span>${esc(p.blockers || 'None listed')}</span></div></div>${linksFor(p)}${p.notes ? `<p class="notes">${esc(p.notes)}</p>` : ''}</details>
        <div class="edit-slot" id="edit-${esc(p.id)}"></div></section>`).join('') || `<section class="project-card">${blank('No active project yet. Add a project below, then set it active when you are ready to commit.')}</section>`}
      <section class="section-block"><h2>Queued and past projects</h2>${others.map(p => `<details class="project-row"><summary><span class="status-pill ${esc(p.status)}">${esc(p.status)}</span> ${esc(p.name)}</summary><div class="project-detail"><p class="muted">${esc(p.problem || 'No problem statement yet.')}</p><div class="project-meta"><div><b>Objective</b><span>${esc(p.objective || 'Not set')}</span></div><div><b>Milestone</b><span>${esc(p.currentMilestone || 'Not set')}</span></div></div><details><summary>Tasks and working notes</summary>${projectTasks(p)}<div class="project-meta"><div><b>Prerequisites</b><span>${esc(p.prerequisites || 'None listed')}</span></div><div><b>Blockers</b><span>${esc(p.blockers || 'None listed')}</span></div></div>${linksFor(p)}${p.notes ? `<p class="notes">${esc(p.notes)}</p>` : ''}</details><div class="row-actions"><button class="quiet-button" type="button" data-edit-project="${esc(p.id)}">Edit</button>${p.status !== 'completed' && p.status !== 'abandoned' ? `<button class="quiet-button" type="button" data-activate-project="${esc(p.id)}">Make active</button>` : ''}<button class="quiet-button" type="button" data-delete-project="${esc(p.id)}">Delete</button></div><div class="edit-slot" id="edit-${esc(p.id)}"></div></div></details>`).join('') || blank('No other projects. Keep the queue short.')}</section>
      <details class="add-project"><summary>Add a project to the queue</summary>${projectForm()}</details>`;
  }
  function linksFor(p) {
    const links = Object.entries(p.links || {}).filter(([, href]) => url(href));
    return links.length ? `<p class="links">${links.map(([key, href]) => `<a href="${url(href)}" target="_blank" rel="noopener noreferrer">${esc({ repository: 'Repository', dataset: 'Dataset', documentation: 'Documentation', other: 'Resource' }[key] || key)}</a>`).join(' · ')}</p>` : '';
  }

  function backlogPage() {
    const categories = ['Project', 'Theory', 'Research paper', 'Academic', 'Tool/course', 'Other interest'];
    return `${heading('Backlog', 'Capture ideas without turning them into active commitments.')}
      <form id="backlog-form" class="form-grid compact-form">${field('Title', 'title', '', { required: true })}${select('Category', 'category', 'Project', categories.map(x => [x, x]))}${field('Link (optional)', 'link', '', { type: 'url' })}${field('Short note (optional)', 'note', '')}${button('Save to backlog')}</form>
      <section class="section-block">${state.backlog.map(x => `<article class="list-row"><div><b>${esc(x.title)}</b><span class="status-pill">${esc(x.category)}</span>${x.note ? `<p class="muted">${esc(x.note)}</p>` : ''}${url(x.link) ? `<a href="${url(x.link)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ''}</div><div class="row-actions"><button class="quiet-button" type="button" data-promote="${esc(x.id)}">Promote to queued project</button><button class="quiet-button" type="button" data-delete-backlog="${esc(x.id)}">Delete</button></div></article>`).join('') || blank('Nothing in the backlog. Capture an idea only when it appears; no need to fill this list.')}</section>`;
  }

  function learningPage() {
    const choices = [['topic', 'Topic'], ['paper', 'Research paper']];
    return `${heading('Theory & research', 'Keep only the few topics or papers you are working through now.')}
      <form id="learning-form" class="form-grid compact-form">${select('Type', 'kind', 'topic', choices)}${field('Title', 'title', '', { required: true })}${field('Topic area', 'topic', '')}${field('Link (optional)', 'link', '', { type: 'url' })}${area('Question or short takeaway', 'question', '', true, 'One sentence is enough.')}${button('Add to current reading')}</form>
      <section class="section-block">${state.learning.map(x => `<article class="list-row"><div><div><b>${esc(x.title)}</b> <span class="status-pill">${x.kind === 'paper' ? 'PAPER' : 'TOPIC'}</span></div><p class="muted">${esc(x.topic || '')}${x.question ? ` · ${esc(x.question)}` : ''}</p>${url(x.link) ? `<a href="${url(x.link)}" target="_blank" rel="noopener noreferrer">Open resource</a>` : ''}</div><div class="row-actions">${select('Status', `learning-status-${x.id}`, x.status, [['queued', 'Queued'], ['reading', 'Reading'], ['done', 'Done']])}<button class="quiet-button" type="button" data-delete-learning="${esc(x.id)}">Delete</button></div></article>`).join('') || blank('No current readings. Leave future resources in the backlog.')}</section>`;
  }

  function academicsPage() {
    const projectOptions = [['', 'No linked project'], ...state.projects.filter(p => !['completed', 'abandoned'].includes(p.status)).map(p => [p.id, p.name])];
    return `${heading('Academics', 'Subjects, syllabus topics, and exam dates. Keep this separate from project work.')}
      <form id="subject-form" class="inline-form">${field('Subject', 'name', '', { required: true })}${field('Exam date', 'examDate', '', { type: 'date' })}${button('Add subject')}</form>
      <section class="section-block">${state.subjects.map(s => `<article class="subject-card"><div class="section-head"><div><h2>${esc(s.name)}</h2><span class="muted">${s.examDate ? `Exam: ${esc(s.examDate)}` : 'No exam date set'}</span></div><button class="quiet-button" type="button" data-delete-subject="${esc(s.id)}">Delete subject</button></div>
        <form class="exam-form inline-form" data-exam-form="${esc(s.id)}">${field('Exam date', 'examDate', s.examDate, { type: 'date' })}${button('Save date')}</form>
        <ul class="topic-list">${s.topics.map(t => `<li><label><input type="checkbox" data-topic-done="${esc(s.id)}:${esc(t.id)}" ${t.done ? 'checked' : ''}><span class="${t.done ? 'done' : ''}">${esc(t.title)}</span></label>${t.projectId ? `<small>Related project: ${esc(projectLabel(t.projectId))}</small>` : ''}</li>`).join('') || '<li class="muted">No syllabus topics yet.</li>'}</ul>
        <form class="inline-form topic-form" data-topic-form="${esc(s.id)}">${field('Syllabus topic', 'title', '', { required: true })}${select('Related project (optional)', 'projectId', '', projectOptions)}${button('Add topic')}</form></article>`).join('') || blank('Add only the subjects you currently need to prepare for.')}</section>`;
  }

  function addDays(date, days) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return toISO(d); }
  const views = { today: todayPage, projects: projectsPage, backlog: backlogPage, learning: learningPage, academics: academicsPage };
  const navItems = [['today', 'Today'], ['projects', 'Projects'], ['backlog', 'Backlog'], ['learning', 'Theory & research'], ['academics', 'Academics']];
  function render() {
    $('#nav').innerHTML = navItems.map(([key, label]) => `<button type="button" class="nav-link ${page === key ? 'selected' : ''}" data-page="${key}" ${page === key ? 'aria-current="page"' : ''}>${label}</button>`).join('');
    $('#app').innerHTML = `${storageBlocked ? '<p class="notice error" role="alert">Saved data could not be read. It has not been overwritten. Export the raw recovery copy or import a valid dashboard backup to continue.</p>' : ''}${views[page]()}`;
    if (storageBlocked) $('#app').querySelectorAll('button:not([data-page]), input, textarea, select').forEach(el => { el.disabled = true; });
    bind();
  }
  function bind() {
    document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => { page = el.dataset.page; render(); $('#app').focus(); }));
    document.querySelectorAll('[data-task-done]').forEach(el => el.addEventListener('change', () => { const task = state.tasks.find(t => t.id === el.dataset.taskDone); if (task) task.done = el.checked; persist(); render(); }));
    document.querySelectorAll('[data-topic-done]').forEach(el => el.addEventListener('change', () => { const [sid, tid] = el.dataset.topicDone.split(':'); const topic = state.subjects.find(s => s.id === sid)?.topics.find(t => t.id === tid); if (topic) topic.done = el.checked; persist(); render(); }));
    document.querySelectorAll('[data-edit-project]').forEach(el => el.addEventListener('click', () => { const p = state.projects.find(x => x.id === el.dataset.editProject); const slot = $(`#edit-${CSS.escape(p.id)}`); slot.innerHTML = projectForm(p); bindForms(slot); slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }));
    document.querySelectorAll('[data-cancel-edit]').forEach(el => el.addEventListener('click', () => { const form = el.closest('form'); form.remove(); }));
    document.querySelectorAll('[data-activate-project]').forEach(el => el.addEventListener('click', () => { state.projects.forEach(p => p.status = p.id === el.dataset.activateProject ? 'active' : p.status === 'active' ? 'queued' : p.status); persist(); render(); }));
    document.querySelectorAll('[data-delete-project]').forEach(el => el.addEventListener('click', () => { if (!confirm('Delete this project and its tasks?')) return; state.projects = state.projects.filter(p => p.id !== el.dataset.deleteProject); state.tasks = state.tasks.filter(t => t.projectId !== el.dataset.deleteProject); persist(); render(); }));
    document.querySelectorAll('[data-delete-task]').forEach(el => el.addEventListener('click', () => { state.tasks = state.tasks.filter(t => t.id !== el.dataset.deleteTask); persist(); render(); }));
    document.querySelectorAll('[data-delete-backlog]').forEach(el => el.addEventListener('click', () => { state.backlog = state.backlog.filter(x => x.id !== el.dataset.deleteBacklog); persist(); render(); }));
    document.querySelectorAll('[data-promote]').forEach(el => el.addEventListener('click', () => { const x = state.backlog.find(item => item.id === el.dataset.promote); if (!x) return; state.projects.push({ id: uid(), name: x.title, problem: x.note, objective: '', deliverable: '', status: 'queued', currentMilestone: '', milestones: [], prerequisites: '', blockers: '', links: { repository: '', dataset: '', documentation: '', other: x.link }, notes: '' }); state.backlog = state.backlog.filter(item => item.id !== x.id); persist(); render(); }));
    document.querySelectorAll('[data-delete-learning]').forEach(el => el.addEventListener('click', () => { state.learning = state.learning.filter(x => x.id !== el.dataset.deleteLearning); persist(); render(); }));
    document.querySelectorAll('[data-delete-subject]').forEach(el => el.addEventListener('click', () => { state.subjects = state.subjects.filter(x => x.id !== el.dataset.deleteSubject); persist(); render(); }));
    document.querySelectorAll('[name^="learning-status-"]').forEach(el => el.addEventListener('change', () => { const item = state.learning.find(x => x.id === el.name.slice('learning-status-'.length)); if (item) item.status = el.value; persist(); }));
    bindForms();
  }
  function bindForms(root = document) {
    root.querySelectorAll('[data-project-form]').forEach(form => form.addEventListener('submit', event => {
      event.preventDefault(); const f = new FormData(form), id = form.dataset.projectForm; const old = state.projects.find(p => p.id === id);
      const next = { id: old?.id || uid(), name: f.get('name').trim(), problem: f.get('problem').trim(), objective: f.get('objective').trim(), deliverable: f.get('deliverable').trim(), status: f.get('status'), currentMilestone: f.get('currentMilestone').trim(), milestones: f.get('milestones').split('\n').map(x => x.trim()).filter(Boolean), prerequisites: f.get('prerequisites').trim(), blockers: f.get('blockers').trim(), links: { repository: f.get('repository').trim(), dataset: f.get('dataset').trim(), documentation: f.get('documentation').trim(), other: f.get('other').trim() }, notes: f.get('notes').trim() };
      if (next.status === 'active') state.projects.forEach(p => { if (p.id !== next.id && p.status === 'active') p.status = 'queued'; });
      if (old) Object.assign(old, next); else state.projects.push(next);
      persist(); render();
    }));
    root.querySelectorAll('[data-task-form]').forEach(form => form.addEventListener('submit', event => {
      event.preventDefault(); const f = new FormData(form); state.tasks.push({ id: uid(), title: f.get('title').trim(), dueDate: f.get('dueDate'), done: false, projectId: form.dataset.taskForm, milestone: f.get('milestone') }); persist(); render();
    }));
    const quick = $('#quick-task-form', root); if (quick) quick.addEventListener('submit', event => { event.preventDefault(); const p = activeProject(), f = new FormData(quick); if (!p) return; state.tasks.push({ id: uid(), title: f.get('title').trim(), dueDate: today(), done: false, projectId: p.id, milestone: p.currentMilestone }); persist(); render(); });
    const backlog = $('#backlog-form', root); if (backlog) backlog.addEventListener('submit', event => { event.preventDefault(); const f = new FormData(backlog); state.backlog.push({ id: uid(), title: f.get('title').trim(), category: f.get('category'), link: f.get('link').trim(), note: f.get('note').trim() }); persist(); render(); });
    const learning = $('#learning-form', root); if (learning) learning.addEventListener('submit', event => { event.preventDefault(); const f = new FormData(learning); state.learning.push({ id: uid(), kind: f.get('kind'), title: f.get('title').trim(), topic: f.get('topic').trim(), link: f.get('link').trim(), question: f.get('question').trim(), status: 'reading' }); persist(); render(); });
    const subject = $('#subject-form', root); if (subject) subject.addEventListener('submit', event => { event.preventDefault(); const f = new FormData(subject); state.subjects.push({ id: uid(), name: f.get('name').trim(), examDate: f.get('examDate'), topics: [] }); persist(); render(); });
    root.querySelectorAll('[data-exam-form]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); const s = state.subjects.find(x => x.id === form.dataset.examForm); if (s) s.examDate = new FormData(form).get('examDate'); persist(); render(); }));
    root.querySelectorAll('[data-topic-form]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); const s = state.subjects.find(x => x.id === form.dataset.topicForm), f = new FormData(form); if (s) s.topics.push({ id: uid(), title: f.get('title').trim(), projectId: f.get('projectId'), done: false }); persist(); render(); }));
  }

  $('#export-button').addEventListener('click', () => {
    let payload = state;
    if (storageBlocked) {
      try { payload = { format: 'neurodev-recovery-export', storedV2: localStorage.getItem(D.STORAGE_KEY), storedLegacy: localStorage.getItem(D.LEGACY_KEY) }; }
      catch { setStatus('Browser storage is not accessible, so recovery export failed.', true); return; }
    }
    const file = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = storageBlocked ? 'neurodev-recovery.json' : 'neurodev-data.json'; link.click(); URL.revokeObjectURL(link.href);
  });
  $('#import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (D.isSqliteMigration(imported)) state = D.mergeSqliteMigration(state, imported);
      else {
        if (!confirm('Importing this backup replaces current dashboard data. Export first if you need a backup.')) return;
        state = D.isLegacyLocal(imported) ? D.migrateLegacyLocal(imported) : D.normalizeState(imported);
      }
      storageBlocked = false; persist('Import complete'); render();
    } catch (error) { setStatus(`Import failed: ${error.message}`, true); }
    finally { event.target.value = ''; }
  });
  $('#sync-button').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try {
      const response = await fetch(`version.json?check=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('No deployment version is available.');
      const latest = (await response.json()).commit;
      if (!deployedVersion || latest !== deployedVersion) location.replace(`${location.pathname}?refresh=${Date.now()}`);
      else setStatus('Site is up to date. Local data remains on this device.');
    } catch { setStatus('Could not check the deployed site. Try again later.', true); }
    finally { button.disabled = false; }
  });
  fetch('version.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(v => { deployedVersion = v.commit || ''; }).catch(() => {});
  render();
})();
