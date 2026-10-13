CREATE TABLE IF NOT EXISTS users (
 email TEXT PRIMARY KEY,
 display_name TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL CHECK(role IN ('admin','member','viewer')),
 groups_json TEXT NOT NULL DEFAULT '[]',
 is_boss INTEGER NOT NULL DEFAULT 0,
 identity_id TEXT UNIQUE,
 enabled INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 type TEXT NOT NULL CHECK(type IN ('Bug Fix','New Feature','Improvement','UI/UX','Investigation')),
 priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High','Urgent')),
 sort_order INTEGER NOT NULL DEFAULT 1000 CHECK(sort_order BETWEEN 1 AND 1000000),
 development_status TEXT NOT NULL DEFAULT 'New Request',
 qa_status TEXT NOT NULL DEFAULT 'Not Tested',
 assignee TEXT NOT NULL DEFAULT '',
 next_action_owner TEXT NOT NULL DEFAULT '',
 project TEXT NOT NULL DEFAULT 'CRM',
 github_pr_url TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS activities (
 id TEXT PRIMARY KEY,
 task_id TEXT NOT NULL REFERENCES tasks(id),
 actor_email TEXT NOT NULL,
 action_type TEXT NOT NULL CHECK(action_type IN ('Requirement','Development','PR','Merge','Deployment','QA Testing','Feedback','Status Change','Other')),
 activity_date TEXT NOT NULL,
 environment TEXT NOT NULL DEFAULT '',
 result TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 github_pr_url TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS comments (
 id TEXT PRIMARY KEY,
 task_id TEXT NOT NULL REFERENCES tasks(id),
 actor_email TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS office_logs (
 id TEXT PRIMARY KEY,
 owner_email TEXT NOT NULL,
 work_date TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'Office',
 title TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'In Progress',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS attachments (
 id TEXT PRIMARY KEY,
 task_id TEXT,
 activity_id TEXT,
 office_id TEXT,
 owner_email TEXT NOT NULL,
 filename TEXT NOT NULL,
 content_type TEXT NOT NULL,
 object_key TEXT NOT NULL,
 byte_size INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS activities_task_date_idx ON activities(task_id,created_at);
CREATE INDEX IF NOT EXISTS activities_actor_date_idx ON activities(actor_email,activity_date);
CREATE INDEX IF NOT EXISTS office_owner_date_idx ON office_logs(owner_email,work_date);
CREATE INDEX IF NOT EXISTS tasks_stage_idx ON tasks(development_status,qa_status);
CREATE TRIGGER IF NOT EXISTS activities_no_update BEFORE UPDATE ON activities BEGIN SELECT RAISE(ABORT,'Activities are immutable'); END;
CREATE TRIGGER IF NOT EXISTS activities_no_delete BEFORE DELETE ON activities BEGIN SELECT RAISE(ABORT,'Activities are immutable'); END;
CREATE TRIGGER IF NOT EXISTS comments_no_update BEFORE UPDATE ON comments BEGIN SELECT RAISE(ABORT,'Comments are immutable'); END;
CREATE TRIGGER IF NOT EXISTS comments_no_delete BEFORE DELETE ON comments BEGIN SELECT RAISE(ABORT,'Comments are immutable'); END;
CREATE TABLE IF NOT EXISTS office_revisions (
 id TEXT PRIMARY KEY,
 office_id TEXT NOT NULL REFERENCES office_logs(id),
 actor_email TEXT NOT NULL,
 change_type TEXT NOT NULL,
 details TEXT NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER IF NOT EXISTS office_revisions_no_update BEFORE UPDATE ON office_revisions BEGIN SELECT RAISE(ABORT,'Office revisions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS office_revisions_no_delete BEFORE DELETE ON office_revisions BEGIN SELECT RAISE(ABORT,'Office revisions are immutable'); END;
