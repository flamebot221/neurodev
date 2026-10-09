"""Export the former Streamlit SQLite data for import into the static dashboard."""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def export_database(database: str | Path) -> dict:
    connection = sqlite3.connect(str(database))
    connection.row_factory = sqlite3.Row
    try:
        tables = [row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name"
        )]
        archive = {
            table: [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
            for table in tables
        }
    finally:
        connection.close()

    projects = []
    active_added = False
    for old in archive.get("projects", []):
        old_status = (old.get("status") or "").lower()
        status = "active" if old_status == "in progress" else "completed" if old_status == "completed" else "abandoned" if old_status == "maintenance" else "queued"
        if status == "active" and active_added:
            status = "queued"
        active_added |= status == "active"
        projects.append({
            "id": f"sqlite-project-{old.get('id', len(projects))}",
            "name": old.get("title") or "Untitled project",
            "problem": old.get("description") or "",
            "objective": "",
            "deliverable": "",
            "status": status,
            "currentMilestone": "",
            "milestones": [],
            "prerequisites": "",
            "blockers": "",
            "links": {"repository": old.get("github_link") or "", "dataset": "", "documentation": "", "other": old.get("live_link") or ""},
            "notes": old.get("tech_stack") or "",
        })

    tasks = [{
        "id": f"sqlite-task-{old.get('id', index)}",
        "title": old.get("title") or "",
        "dueDate": old.get("date") or "",
        "done": bool(old.get("done")),
        "projectId": "",
        "milestone": "",
    } for index, old in enumerate(archive.get("tasks", []))]

    return {"format": "neurodev-sqlite-migration", "projects": projects, "tasks": tasks, "archive": archive}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", nargs="?", default="neurodev.db", help="SQLite database file (default: neurodev.db)")
    parser.add_argument("output", nargs="?", default="neurodev-sqlite-migration.json", help="Output JSON file; keep this private")
    args = parser.parse_args()
    payload = export_database(args.database)
    destination = Path(args.output)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported {len(payload['projects'])} projects and {len(payload['tasks'])} tasks to {destination}")
    print("All source tables are included in the private archive portion of this JSON file.")


if __name__ == "__main__":
    main()
