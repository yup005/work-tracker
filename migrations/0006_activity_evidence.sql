ALTER TABLE tasks ADD COLUMN current_environment TEXT NOT NULL DEFAULT '—';
UPDATE tasks SET current_environment=CASE
 WHEN development_status='In Development' THEN 'Local'
 WHEN development_status IN ('PR Submitted','Merged / Awaiting Stage') THEN 'PR'
 WHEN development_status IN ('On Stage','Approved for Production','Awaiting Production Deploy') THEN 'Stage'
 WHEN development_status='On Production' THEN 'Production'
 ELSE '—' END;
ALTER TABLE activities ADD COLUMN is_work INTEGER NOT NULL DEFAULT 1;
DROP TRIGGER IF EXISTS activities_no_update;
UPDATE activities SET is_work=0 WHERE notes='Task updated' OR result='New request submitted' OR actor_email='github-sync' OR action_type='Status Change';
CREATE TRIGGER activities_no_update BEFORE UPDATE ON activities BEGIN SELECT RAISE(ABORT,'Activities are immutable'); END;
ALTER TABLE attachments ADD COLUMN comment_id TEXT;
ALTER TABLE attachments ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attachments ADD COLUMN deleted_by TEXT;
ALTER TABLE attachments ADD COLUMN deleted_at TEXT;
