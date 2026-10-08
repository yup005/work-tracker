CREATE TABLE IF NOT EXISTS releases (
 id TEXT PRIMARY KEY,
 version TEXT NOT NULL UNIQUE,
 planned_date TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Planned' CHECK(status IN ('Planned','Released')),
 released_date TEXT,
 notes TEXT NOT NULL DEFAULT '',
 task_ids_json TEXT NOT NULL DEFAULT '[]',
 snapshot_json TEXT NOT NULL DEFAULT '[]',
 created_by TEXT NOT NULL,
 published_by TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
