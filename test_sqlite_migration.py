import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from sqlite_to_json import export_database


class SQLiteMigrationTests(unittest.TestCase):
    def test_projects_tasks_and_other_tables_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            db = Path(directory) / "old.db"
            connection = sqlite3.connect(db)
            connection.executescript("""
                CREATE TABLE projects (id INTEGER PRIMARY KEY, title TEXT, description TEXT, tech_stack TEXT,
                    status TEXT, github_link TEXT, live_link TEXT);
                CREATE TABLE tasks (id INTEGER PRIMARY KEY, date TEXT, title TEXT, est_mins INTEGER, done INTEGER);
                CREATE TABLE study_log (id INTEGER PRIMARY KEY, subject TEXT);
                INSERT INTO projects VALUES (1, 'Study project', 'Problem', 'Python', 'In Progress', '', '');
                INSERT INTO tasks VALUES (2, '2026-10-09', 'Run baseline', 30, 0);
                INSERT INTO study_log VALUES (3, 'Math');
            """)
            connection.commit()
            connection.close()

            payload = export_database(db)
            json.dumps(payload)
            self.assertEqual(payload["format"], "neurodev-sqlite-migration")
            self.assertEqual(payload["projects"][0]["status"], "active")
            self.assertEqual(payload["projects"][0]["notes"], "Python")
            self.assertEqual(payload["tasks"][0]["title"], "Run baseline")
            self.assertEqual(payload["archive"]["study_log"][0]["subject"], "Math")


if __name__ == "__main__":
    unittest.main()
