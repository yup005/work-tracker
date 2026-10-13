ALTER TABLE tasks ADD COLUMN next_step TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS task_removals (
 id TEXT PRIMARY KEY,
 task_id TEXT NOT NULL,
 actor_email TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('Deleted','Archived','Restored')),
 contributor_count INTEGER NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
