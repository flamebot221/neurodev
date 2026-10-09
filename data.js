(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NeuroDevData = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'neurodev-dashboard-v2';
  const LEGACY_KEY = 'neurodev-os';
  const id = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emptyState = () => ({ schema: 2, projects: [], tasks: [], backlog: [], learning: [], subjects: [], archive: {} });
  function normalizeState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The file must contain a NeuroDev data object.');
    if (value.format === 'neurodev-recovery-export') throw new Error('This is a recovery copy of raw storage, not an importable dashboard backup.');
    if (value.schema !== 2) throw new Error('This JSON is not a current dashboard backup.');
    for (const key of ['projects', 'tasks', 'backlog', 'learning', 'subjects']) {
      if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error(`Invalid ${key} list in the data file.`);
    }
    const state = { ...emptyState(), ...value };
    state.projects = state.projects.map(p => ({
      id: String(p.id || id()), name: String(p.name || 'Untitled project'), problem: String(p.problem || ''),
      objective: String(p.objective || ''), deliverable: String(p.deliverable || ''),
      status: ['active', 'queued', 'completed', 'abandoned'].includes(p.status) ? p.status : 'queued',
      currentMilestone: String(p.currentMilestone || ''), milestones: Array.isArray(p.milestones) ? p.milestones.map(String) : [],
      prerequisites: String(p.prerequisites || ''), blockers: String(p.blockers || ''),
      links: { repository: '', dataset: '', documentation: '', other: '', ...(p.links || {}) }, notes: String(p.notes || '')
    }));
    const active = state.projects.findIndex(p => p.status === 'active');
    state.projects.forEach((p, i) => { if (p.status === 'active' && i !== active) p.status = 'queued'; });
    state.tasks = state.tasks.map(t => ({ id: String(t.id || id()), title: String(t.title || ''), dueDate: String(t.dueDate || ''), done: Boolean(t.done), projectId: String(t.projectId || ''), milestone: String(t.milestone || '') }));
    state.backlog = state.backlog.map(x => ({ id: String(x.id || id()), title: String(x.title || ''), note: String(x.note || ''), link: String(x.link || ''), category: String(x.category || 'Other') }));
    state.learning = state.learning.map(x => ({ id: String(x.id || id()), kind: x.kind === 'paper' ? 'paper' : 'topic', title: String(x.title || ''), topic: String(x.topic || ''), status: ['queued', 'reading', 'done'].includes(x.status) ? x.status : 'queued', link: String(x.link || ''), question: String(x.question || '') }));
    state.subjects = state.subjects.map(s => ({ id: String(s.id || id()), name: String(s.name || 'Untitled subject'), examDate: String(s.examDate || ''), topics: Array.isArray(s.topics) ? s.topics.map(t => ({ id: String(t.id || id()), title: String(t.title || ''), done: Boolean(t.done), projectId: String(t.projectId || '') })) : [] }));
    if (!state.archive || typeof state.archive !== 'object' || Array.isArray(state.archive)) state.archive = {};
    return state;
  }

  function migrateLegacyLocal(old) {
    const state = emptyState();
    state.archive.legacyLocalStorage = old;
    const source = Array.isArray(old.projects) ? old.projects : [];
    let activeUsed = false;
    state.projects = source.map(p => {
      let status = p.status === 'In Progress' || p.status === 'active' ? 'active' :
        p.status === 'Completed' || p.status === 'completed' ? 'completed' :
        p.status === 'Maintenance' || p.status === 'abandoned' ? 'abandoned' : 'queued';
      if (status === 'active' && activeUsed) status = 'queued';
      if (status === 'active') activeUsed = true;
      return { id: id(), name: p.title || p.name || 'Untitled project', problem: p.desc || p.description || '', objective: '', deliverable: '', status,
        currentMilestone: '', milestones: [], prerequisites: '', blockers: '',
        links: { repository: p.github || p.github_link || '', dataset: '', documentation: '', other: p.live || p.live_link || '' }, notes: p.stack || p.tech_stack || '' };
    });
    state.tasks = (old.tasks || []).map(t => ({ id: id(), title: t.title || '', dueDate: t.date || '', done: Boolean(t.done), projectId: '', milestone: '' }));
    return normalizeState(state);
  }

  function isLegacyLocal(value) {
    return Boolean(value && typeof value === 'object' && ['logs', 'projects', 'tasks', 'bp', 'gates'].some(key => Array.isArray(value[key]) || (value[key] && typeof value[key] === 'object')));
  }

  function loadState(storage) {
    const current = storage.getItem(STORAGE_KEY);
    if (current !== null) return normalizeState(JSON.parse(current));
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const migrated = migrateLegacyLocal(JSON.parse(legacy));
      storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return emptyState();
  }

  function isSqliteMigration(value) { return value?.format === 'neurodev-sqlite-migration' && Array.isArray(value.projects) && Array.isArray(value.tasks) && value.archive; }

  function mergeSqliteMigration(state, imported) {
    const next = normalizeState(state);
    if (next.archive.legacySqlite && JSON.stringify(next.archive.legacySqlite) === JSON.stringify(imported.archive)) return next;
    const incoming = normalizeState({ ...emptyState(), projects: imported.projects, tasks: imported.tasks });
    next.archive.legacySqlite = imported.archive;
    const hasActive = next.projects.some(p => p.status === 'active');
    incoming.projects.forEach(p => { p.id = id(); if (p.status === 'active' && hasActive) p.status = 'queued'; next.projects.push(p); });
    incoming.tasks.forEach(t => { t.id = id(); next.tasks.push(t); });
    return normalizeState(next);
  }

  return { STORAGE_KEY, LEGACY_KEY, emptyState, normalizeState, migrateLegacyLocal, isLegacyLocal, loadState, isSqliteMigration, mergeSqliteMigration };
});
