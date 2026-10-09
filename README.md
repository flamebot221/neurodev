# NeuroDev

A small, static learning dashboard for choosing one project, taking the next concrete action, and keeping academic work visible. It uses plain HTML, CSS, and JavaScript; there is no build step or runtime service.

## Use locally

Open `index.html` from a local static server so browser storage and file loading work consistently:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Deploy to GitHub Pages

1. Push the repository to GitHub on the `main` or `master` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the deployment source.
3. The workflow in `.github/workflows/pages.yml` deploys the static site after a push. The published URL appears in Pages settings.

The workflow copies only `index.html`, `style.css`, `data.js`, and `app.js` into the Pages artifact. Python files, the local SQLite database, migration exports, and the old roadmap source are not published. Asset URLs are relative, so they work at the repository subpath used by GitHub Pages. The app has no client-side URL routing.

## Dashboard areas

- **Today:** active project, milestone, next action, due tasks, and near-term exam dates.
- **Projects:** one active project, queued/past projects, milestones, tasks, prerequisites, blockers, links, and short experiment notes.
- **Backlog:** a parking place for ideas. Promoting an item creates a queued project; it does not make it active.
- **Theory & research:** a small current list of topics and papers.
- **Academics:** subjects, exam dates, syllabus topics, and optional project links.

## Data, import, and export

Data is stored in this browser's `localStorage` and survives reloads. It is private to the browser profile and device; GitHub Pages does not synchronize it between a laptop and phone. **Sync site** checks for a new published version of the code only. Use **Export** and **Import** to move a dashboard JSON backup manually. Importing a regular dashboard backup replaces current dashboard data; the app asks before doing so and reports malformed files without replacing data.

The former Streamlit app stored data in `neurodev.db`. The database is kept locally and is not included in the Pages artifact. To make a migration package, run:

```sh
python3 sqlite_to_json.py neurodev.db neurodev-sqlite-migration.json
```

Import that JSON through the dashboard. Projects and tasks are added to the current browser data, while every SQLite table is retained in the exported dashboard's archive. Study logs, applications, certificates, sprint state, goals, and detailed blueprint progress remain available in that archive; they are not shown in the simplified interface. Keep the migration JSON private because it contains your personal records.

Data from the earlier static dashboard is migrated automatically on first load. Its original local-storage key remains intact, and the original fields are copied into the export archive.

## Security and limitations

This static app makes no authenticated GitHub API calls and needs no secrets. A previous test script included a hardcoded GitHub credential and has been removed; revoke that credential in GitHub because removing the file does not invalidate it. Never put credentials in this repository or a static site.

The former roadmap is retained in `blueprint_data.py` and `blueprint.json` as reference material but is not loaded by the dashboard. The SQLite database is also retained for migration. Neither file is published by the Pages workflow.

## Checks

Run the dependency-free data and asset checks with:

```sh
node --test test_static.js
node --check app.js
node --check data.js
python3 -m unittest test_sqlite_migration.py
```
