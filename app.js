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
  let selectedDate = today(), calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
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

  function dateLabel(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
    if (!iso) return '';
    return new Intl.DateTimeFormat(undefined, opts).format(new Date(`${iso}T12:00:00`));
  }
  function daysRemaining(iso) {
    return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000);
  }
  function dayWord(iso) {
    const n = daysRemaining(iso);
    return n < 0 ? `${Math.abs(n)}d overdue` : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
  }
  function calendarItems() {
    const out = state.events.map(e => ({ id: e.id, title: e.title, date: e.date, time: e.time, category: e.category, note: e.note, type: 'event' }));
    state.subjects.filter(s => s.examDate).forEach(s => out.push({ id: `exam-${s.id}`, title: `${s.name} exam`, date: s.examDate, category: 'Academics', type: 'exam' }));
    state.tasks.filter(t => !t.done && t.dueDate).forEach(t => out.push({ id: `task-${t.id}`, title: t.title, date: t.dueDate, category: 'Project', type: 'task', milestone: t.milestone, projectId: t.projectId }));
    return out.filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  }
  function monthCalendar(compact = false) {
    const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
    const first = new Date(y, m, 1), startOffset = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const items = calendarItems();
    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += '<span class="calendar-empty" aria-hidden="true"></span>';
    for (let day = 1; day <= days; day++) {
      const iso = toISO(new Date(y, m, day));
      const hasItems = items.some(e => e.date === iso);
      cells += `<button type="button" class="calendar-day ${iso === today() ? 'is-today' : ''} ${iso === selectedDate ? 'is-selected' : ''} ${hasItems ? 'has-items' : ''}" data-select-date="${iso}" aria-label="${esc(dateLabel(iso, { weekday: 'long', month: 'long', day: 'numeric' }))}${hasItems ? ', has events' : ''}">${day}${hasItems ? '<i></i>' : ''}</button>`;
    }
    const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(calendarMonth);
    return `<section class="calendar-widget ${compact ? 'compact' : ''}"><div class="calendar-head"><h2>${compact ? 'Calendar' : esc(monthName)}</h2><div class="calendar-controls"><button type="button" data-month="-1" aria-label="Previous month">‹</button>${compact ? `<span>${esc(monthName)}</span>` : ''}<button type="button" data-month="1" aria-label="Next month">›</button></div></div><div class="calendar-grid calendar-weekdays">${['M','T','W','T','F','S','S'].map(d => `<span>${d}</span>`).join('')}</div><div class="calendar-grid">${cells}</div>${compact ? `<div class="selected-calendar-events"><h3>${esc(dateLabel(selectedDate))}</h3>${eventList(selectedDate)}</div><button class="text-button calendar-open" type="button" data-page="calendar">Open calendar →</button>` : ''}</section>`;
  }
  function itemsForDate(date) { return calendarItems().filter(e => e.date === date).sort((a,b) => (a.time || '').localeCompare(b.time || '')); }
  function eventList(date, editable = false) {
    const items = itemsForDate(date);
    if (!items.length) return blank('Nothing scheduled for this day.');
    return `<ul class="event-list">${items.map(e => `<li><div class="event-time">${esc(e.time || e.category || e.type)}</div><div class="event-copy"><b>${esc(e.title)}</b>${e.note ? `<span>${esc(e.note)}</span>` : ''}${e.milestone ? `<small>${esc(e.milestone)}</small>` : ''}</div>${editable && e.type === 'event' ? `<button class="text-button" type="button" data-edit-event="${esc(e.id)}">Edit</button>` : ''}${editable && e.type === 'event' ? `<button class="text-button danger-text" type="button" data-delete-event="${esc(e.id)}">Delete</button>` : ''}</li>`).join('')}</ul>`;
  }
  function deadlinePanel() {
    const now = today();
    const exams = state.subjects.filter(s => s.examDate && daysRemaining(s.examDate) >= 0).sort((a,b) => a.examDate.localeCompare(b.examDate)).slice(0, 4);
    return `<section class="rail-section"><div class="rail-title"><h2>Deadlines</h2><button class="text-button" type="button" data-page="academics">All →</button></div>${exams.length ? exams.map(s => `<div class="deadline-row"><span><b>${esc(s.name)}</b><small>${dateLabel(s.examDate)}</small></span><span class="days-left">${dayWord(s.examDate)}</span></div>`).join('') : blank('No upcoming exam dates.')}</section>`;
  }
  function milestonesPanel(project) {
    const upcoming = state.tasks.filter(t => !t.done && t.dueDate && t.milestone).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
    const fallback = project?.currentMilestone ? `<div class="milestone-row"><span class="milestone-dot"></span><span><b>${esc(project.currentMilestone)}</b><small>Current milestone</small></span></div>` : '';
    return `<section class="rail-section"><div class="rail-title"><h2>Milestones</h2><button class="text-button" type="button" data-page="projects">Projects →</button></div>${upcoming.length ? upcoming.map(t => `<div class="milestone-row"><span class="milestone-dot"></span><span><b>${esc(t.milestone)}</b><small>${esc(t.title)} · ${dateLabel(t.dueDate)}</small></span></div>`).join('') : fallback || blank('Add dated milestone tasks to see them here.')}</section>`;
  }
  function todayPage() {
    const project = activeProject(), now = today();
    const nextTask = project && state.tasks.find(t => !t.done && t.projectId === project.id && (!project.currentMilestone || t.milestone === project.currentMilestone));
    const urgent = state.tasks.filter(t => !t.done && t.dueDate && t.dueDate <= now).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
    const projectTasksToday = project ? state.tasks.filter(t => !t.done && t.projectId === project.id && (!t.dueDate || t.dueDate <= now) && t.id !== nextTask?.id) : [];
    const plan = [...(nextTask ? [nextTask] : []), ...urgent.filter(t => t.id !== nextTask?.id), ...projectTasksToday].filter((t,i,a) => a.findIndex(x => x.id === t.id) === i).slice(0, 6);
    const dated = state.subjects.filter(s => s.examDate && daysRemaining(s.examDate) >= 0).sort((a,b) => a.examDate.localeCompare(b.examDate))[0];
    return `<div class="home-heading"><div><p class="eyebrow">${esc(dateLabel(now, { weekday: 'long', month: 'long', day: 'numeric' }))}</p><h1>Today</h1></div><span class="focus-tag">FOCUS ON THE NEXT STEP</span></div>
      <div class="dashboard-grid"><div class="home-main">
        <section class="focus-card"><div class="focus-top"><div><p class="eyebrow">ACTIVE PROJECT</p>${project ? `<h2>${esc(project.name)}</h2>` : '<h2>Choose your active project</h2>'}</div><button class="text-button" type="button" data-page="projects">${project ? 'Open project ↗' : 'Set up project →'}</button></div>
          ${project ? `<p class="focus-problem">${esc(project.problem || project.objective || 'Add the problem you are trying to solve.')}</p><div class="focus-stats"><div><small>CURRENT MILESTONE</small><b>${esc(project.currentMilestone || 'Not set yet')}</b></div><div><small>BLOCKER</small><b class="${project.blockers ? 'blocker-text' : 'muted'}">${esc(project.blockers || 'No blocker recorded')}</b></div></div><div class="next-action"><span class="action-icon">↗</span><span><small>NEXT ACTION</small><b>${esc(nextTask?.title || 'Add one concrete task for this milestone')}</b></span></div>` : '<p class="focus-problem">Keep one project active and leave other interests in the backlog.</p>'}
        </section>
        <section class="plan-section"><div class="section-head"><div><p class="eyebrow">YOUR WORKDAY</p><h2>Today's plan</h2></div><span class="muted">${plan.length} ${plan.length === 1 ? 'priority' : 'priorities'}</span></div>
          ${plan.length ? `<ul class="plan-list">${plan.map((t,i) => `<li class="plan-item"><span class="plan-time">${i === 0 ? '01' : String(i + 1).padStart(2,'0')}</span><label class="plan-check"><input type="checkbox" data-task-done="${esc(t.id)}"><span class="checkmark"></span><span class="plan-copy"><b>${esc(t.title)}</b><small>${esc(t.milestone || projectLabel(t.projectId) || 'Learning task')}${t.dueDate ? ` · ${dayWord(t.dueDate)}` : ''}</small></span></label></li>`).join('')}</ul>` : `<div class="empty-plan"><span>✓</span><p>No urgent tasks today. Pick one small next action and begin.</p></div>`}
          ${project ? `<form id="quick-task-form" class="quick-add">${field('Add a concrete action', 'title', '', { placeholder: 'e.g. Run the baseline experiment', required: true })}${button('Add task')}</form>` : ''}
        </section>
        ${urgent.some(t => !plan.find(p => p.id === t.id)) ? `<section class="rail-section overdue-list"><h2>Other tasks needing attention</h2>${urgent.filter(t => !plan.find(p => p.id === t.id)).slice(0,3).map(t => `<div class="deadline-row"><span><b>${esc(t.title)}</b><small>${esc(projectLabel(t.projectId) || 'Personal task')}</small></span><label class="mini-check"><input type="checkbox" data-task-done="${esc(t.id)}"><span>Done</span></label></div>`).join('')}</section>` : ''}
        <section class="backlog-strip"><div><p class="eyebrow">LATER, NOT TODAY</p><b>Keep new interests out of your active plan.</b></div><button class="text-button" type="button" data-page="backlog">Backlog (${state.backlog.length}) →</button></section>
      </div><aside class="right-rail">${monthCalendar(true)}${deadlinePanel()}${milestonesPanel(project)}${dated ? `<section class="next-deadline"><span class="deadline-icon">⌁</span><div><small>NEXT ACADEMIC DEADLINE</small><b>${esc(dated.name)}</b><span>${dayWord(dated.examDate)} · ${dateLabel(dated.examDate)}</span></div></section>` : ''}</aside></div>`;
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
  function calendarPage() {
    const dayItems = itemsForDate(selectedDate);
    const editId = new URLSearchParams(location.search).get('edit');
    const editEvent = state.events.find(e => e.id === editId);
    return `${heading('Calendar', 'Project work, exams, and saved events in one place.')}
      <div class="calendar-page-grid">${monthCalendar(false)}<section class="selected-day-panel"><div class="selected-day-head"><div><p class="eyebrow">SELECTED DAY</p><h2>${esc(dateLabel(selectedDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</h2></div><button class="button" type="button" data-new-event>+ Add event</button></div>
      ${eventList(selectedDate, true)}${editEvent ? eventForm(editEvent) : ''}<div class="new-event-slot" id="event-form-slot"></div></section></div>`;
  }
  function eventForm(event = null) {
    const e = event || { title: '', date: selectedDate, time: '', category: 'Project', note: '' };
    return `<form class="event-form form-grid" data-event-form="${esc(event?.id || '')}"><p class="eyebrow wide">${event ? 'EDIT EVENT' : 'NEW EVENT'}</p>${field('Title', 'title', e.title, { required: true })}${select('Type', 'category', e.category, [['Project','Project'],['Theory','Theory'],['Academics','Academics'],['Research','Research'],['Other','Other']])}${field('Date', 'date', e.date, { type: 'date', required: true })}${field('Time (optional)', 'time', e.time, { type: 'time' })}${area('Note (optional)', 'note', e.note, true)}<div class="form-actions wide"><button class="button" type="submit">${event ? 'Save event' : 'Create event'}</button>${event ? `<button class="quiet-button" type="button" data-cancel-event>Cancel</button>` : ''}</div></form>`;
  }
  function notesPage() {
    return `${heading('Notes', 'Short working notes. Keep detailed documentation with your project.')}
      <form id="note-form" class="note-compose"><label class="field"><span>Title</span><input name="title" required placeholder="What are you figuring out?"></label><label class="field"><span>Note</span><textarea name="body" rows="4" required placeholder="A key question, result, or decision…"></textarea></label><button class="button" type="submit">Save note</button></form>
      <section class="note-list">${state.notes.slice().sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(n => `<article class="note-card"><div><h2>${esc(n.title)}</h2><small>${esc(n.updatedAt ? dateLabel(n.updatedAt.slice(0,10), { month:'short', day:'numeric' }) : '')}</small></div><p>${esc(n.body)}</p><button class="text-button danger-text" type="button" data-delete-note="${esc(n.id)}">Delete</button></article>`).join('') || blank('No notes yet. Save a short takeaway or decision when it helps the next work session.')}</section>`;
  }
  const views = { today: todayPage, projects: projectsPage, academics: academicsPage, learning: learningPage, calendar: calendarPage, backlog: backlogPage, notes: notesPage };
  const navItems = [['today', '⌂', 'Home'], ['projects', '◫', 'Projects'], ['academics', '▤', 'Academics'], ['learning', '⌘', 'Theory & Research'], ['calendar', '▦', 'Calendar'], ['backlog', '↳', 'Backlog'], ['notes', '▧', 'Notes']];
  function render() {
    document.body.dataset.theme = state.theme || 'light';
    $('meta[name="theme-color"]').content = state.theme === 'dark' ? '#0B0B0B' : '#F7F4EC';
    const themeButton = $('#theme-toggle'); themeButton.innerHTML = `<span aria-hidden="true">${state.theme === 'dark' ? '☼' : '◐'}</span><span>${state.theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>`;
    $('#nav').innerHTML = navItems.map(([key, icon, label]) => `<button type="button" class="nav-link ${page === key ? 'selected' : ''}" data-page="${key}" ${page === key ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('');
    $('#app').innerHTML = `${storageBlocked ? '<p class="notice error" role="alert">Saved data could not be read. It has not been overwritten. Export the raw recovery copy or import a valid dashboard backup to continue.</p>' : ''}${views[page]()}`;
    if (storageBlocked) $('#app').querySelectorAll('button:not([data-page]), input, textarea, select').forEach(el => { el.disabled = true; });
    bind();
  }
  function bind() {
    document.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => { page = el.dataset.page; render(); $('#app').focus(); }));
    document.querySelectorAll('[data-task-done]').forEach(el => el.addEventListener('change', () => { const task = state.tasks.find(t => t.id === el.dataset.taskDone); if (task) task.done = el.checked; persist(); render(); }));
    document.querySelectorAll('[data-select-date]').forEach(el => el.addEventListener('click', () => { selectedDate = el.dataset.selectDate; if (page !== 'calendar') page = 'today'; render(); }));
    document.querySelectorAll('[data-month]').forEach(el => el.addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() + Number(el.dataset.month)); render(); }));
    const themeToggle = $('#theme-toggle'); themeToggle.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; persist('Theme saved'); render(); });
    document.querySelectorAll('[data-new-event]').forEach(el => el.addEventListener('click', () => { const slot = $('#event-form-slot'); slot.innerHTML = eventForm(); slot.scrollIntoView({behavior:'smooth', block:'nearest'}); bindForms(slot); }));
    document.querySelectorAll('[data-edit-event]').forEach(el => el.addEventListener('click', () => { page = 'calendar'; render(); const slot = $('#event-form-slot'); const item = state.events.find(e => e.id === el.dataset.editEvent); slot.innerHTML = eventForm(item); bindForms(slot); }));
    document.querySelectorAll('[data-delete-event]').forEach(el => el.addEventListener('click', () => { state.events = state.events.filter(e => e.id !== el.dataset.deleteEvent); persist(); render(); }));
    document.querySelectorAll('[data-delete-note]').forEach(el => el.addEventListener('click', () => { state.notes = state.notes.filter(n => n.id !== el.dataset.deleteNote); persist(); render(); }));
    document.querySelectorAll('[data-cancel-event]').forEach(el => el.addEventListener('click', () => { render(); }));
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
    root.querySelectorAll('[data-cancel-event]').forEach(el => el.addEventListener('click', () => render()));
    root.querySelectorAll('[data-event-form]').forEach(form => form.addEventListener('submit', event => {
      event.preventDefault(); const f = new FormData(form), id = form.dataset.eventForm; const old = state.events.find(e => e.id === id);
      const next = { id: old?.id || uid(), title: f.get('title').trim(), date: f.get('date'), time: f.get('time'), category: f.get('category'), note: f.get('note').trim() };
      if (old) Object.assign(old, next); else state.events.push(next); selectedDate = next.date; calendarMonth = new Date(`${next.date}T12:00:00`); persist('Event saved'); render();
    }));
    const noteForm = $('#note-form', root); if (noteForm) noteForm.addEventListener('submit', event => { event.preventDefault(); const f = new FormData(noteForm); state.notes.push({ id: uid(), title: f.get('title').trim(), body: f.get('body').trim(), updatedAt: new Date().toISOString() }); persist('Note saved'); render(); });
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
