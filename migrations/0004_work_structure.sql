ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT NOT NULL DEFAULT '';
ALTER TABLE office_logs ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE office_logs ADD COLUMN work_item_id TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS private_work (
 id TEXT PRIMARY KEY,
 owner_email TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('Project','Task')),
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 parent_id TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'In Progress' CHECK(status IN ('In Progress','Waiting','Completed')),
 deleted INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX private_work_owner ON private_work(owner_email,deleted);
CREATE TABLE IF NOT EXISTS private_work_revisions (
 id TEXT PRIMARY KEY,
 work_id TEXT NOT NULL,
 actor_email TEXT NOT NULL,
 change_type TEXT NOT NULL,
 details TEXT NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
