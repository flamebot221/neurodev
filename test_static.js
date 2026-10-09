const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('./data.js');

test('static page references local assets that exist', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    assert.ok(fs.existsSync(path.join(__dirname, asset)), `${asset} should exist`);
  }
});

test('old browser data is migrated and remains in the archive', () => {
  const old = { logs: [{ subject: 'retained' }], projects: [{ title: 'Model', status: 'In Progress' }, { title: 'Queued', status: 'Idea' }], tasks: [{ title: 'Train', date: '2026-10-09' }], bp: { C0: { status: 'in_progress' } } };
  const migrated = D.migrateLegacyLocal(old);
  assert.equal(migrated.projects.filter(p => p.status === 'active').length, 1);
  assert.equal(migrated.projects[0].name, 'Model');
  assert.equal(migrated.tasks[0].title, 'Train');
  assert.equal(migrated.archive.legacyLocalStorage.bp.C0.status, 'in_progress');
  assert.equal(migrated.archive.legacyLocalStorage.logs[0].subject, 'retained');
});

test('normalization keeps at most one active project', () => {
  const normalized = D.normalizeState({ schema: 2, projects: [{ id: 'a', name: 'A', status: 'active' }, { id: 'b', name: 'B', status: 'active' }] });
  assert.deepEqual(normalized.projects.map(p => p.status), ['active', 'queued']);
});

test('bad imports fail without being accepted as empty data', () => {
  assert.throws(() => D.normalizeState({ schema: 2, projects: 'not a list' }), /Invalid projects/);
  assert.throws(() => D.normalizeState(null), /data object/);
  assert.throws(() => D.normalizeState({}), /current dashboard backup/);
  assert.throws(() => D.normalizeState({ format: 'neurodev-recovery-export' }), /recovery copy/);
});

test('SQLite migration merges projects and preserves every source table', () => {
  const existing = D.emptyState();
  const packageData = { format: 'neurodev-sqlite-migration', projects: [{ id: 'old', name: 'Old', status: 'active' }], tasks: [], archive: { study_log: [{ id: 1 }] } };
  assert.ok(D.isSqliteMigration(packageData));
  const merged = D.mergeSqliteMigration(existing, packageData);
  assert.equal(merged.projects[0].name, 'Old');
  assert.equal(merged.archive.legacySqlite.study_log[0].id, 1);
  const importedTwice = D.mergeSqliteMigration(merged, packageData);
  assert.equal(importedTwice.projects.length, 1);
});

test('storage migration only happens once and leaves old key intact', () => {
  const map = new Map([[D.LEGACY_KEY, JSON.stringify({ projects: [{ title: 'Legacy', status: 'Idea' }], logs: [] })]]);
  const storage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  assert.equal(D.loadState(storage).projects[0].name, 'Legacy');
  assert.ok(map.has(D.LEGACY_KEY));
  assert.ok(map.has(D.STORAGE_KEY));
});

test('saved data reloads from the current browser storage format', () => {
  const saved = { schema: 2, projects: [{ id: 'active', name: 'Baseline project', status: 'active' }], tasks: [], backlog: [], learning: [], subjects: [], archive: {} };
  const storage = { getItem: key => key === D.STORAGE_KEY ? JSON.stringify(saved) : null, setItem() {} };
  assert.equal(D.loadState(storage).projects[0].name, 'Baseline project');
});

test('Pages workflow only stages the static runtime assets', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /cp index\.html app\.js data\.js style\.css _site\//);
  assert.doesNotMatch(workflow, /neurodev\.db|blueprint\.json|sqlite_to_json/);
});
