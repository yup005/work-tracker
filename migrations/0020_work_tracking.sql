-- Additive work tracking: retain original tasks, activities, attachments and releases.
ALTER TABLE tasks ADD COLUMN work_kind TEXT NOT NULL DEFAULT 'Engineering' CHECK(work_kind IN ('Engineering','Quick Task','PM Task'));
ALTER TABLE tasks ADD COLUMN work_status TEXT NOT NULL DEFAULT 'To Do';
ALTER TABLE tasks ADD COLUMN work_category TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN planning_status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE tasks ADD COLUMN primary_owner TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN collaborators_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN original_delivery_date TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN engineering_completed_date TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN qa_due_date TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN qa_completed_date TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN delivery_reset_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN blocked_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN follow_up_date TEXT NOT NULL DEFAULT '';
UPDATE tasks SET primary_owner=assignee, original_delivery_date=estimated_delivery_date;
CREATE TABLE activity_edits(id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES activities(id), actor_email TEXT NOT NULL, notes TEXT NOT NULL, activity_date TEXT NOT NULL, minutes INTEGER NOT NULL DEFAULT 0 CHECK(minutes>=0 AND minutes<=1440), recorded_at TEXT NOT NULL);
CREATE INDEX activity_edits_activity_idx ON activity_edits(activity_id,recorded_at);
ALTER TABLE activities ADD COLUMN minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE activities ADD COLUMN work_role TEXT NOT NULL DEFAULT '';
ALTER TABLE office_logs ADD COLUMN minutes INTEGER NOT NULL DEFAULT 0;
CREATE TABLE stage_changes(id INTEGER PRIMARY KEY AUTOINCREMENT,task_id TEXT NOT NULL,from_revision INTEGER NOT NULL,to_revision INTEGER NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,activity_id TEXT,recorded_at TEXT NOT NULL,undone INTEGER NOT NULL DEFAULT 0,undo_actor TEXT NOT NULL DEFAULT '',undo_reason TEXT NOT NULL DEFAULT '',undo_token TEXT NOT NULL DEFAULT '');
CREATE TABLE excluded_activities(activity_id TEXT PRIMARY KEY,reason TEXT NOT NULL,actor_email TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TABLE qa_rounds(id TEXT PRIMARY KEY,task_id TEXT NOT NULL,entered_at TEXT NOT NULL,engineering_due TEXT NOT NULL,engineering_completed_date TEXT NOT NULL,due_date TEXT NOT NULL,completed_date TEXT NOT NULL DEFAULT '',result TEXT NOT NULL DEFAULT '',is_undone INTEGER NOT NULL DEFAULT 0);
CREATE TABLE discussion_actions(id TEXT PRIMARY KEY,task_id TEXT NOT NULL,comment_id TEXT NOT NULL,owner_email TEXT NOT NULL,resolved INTEGER NOT NULL DEFAULT 0,resolved_by TEXT NOT NULL DEFAULT '',resolved_at TEXT NOT NULL DEFAULT '');
CREATE INDEX discussion_actions_owner_idx ON discussion_actions(owner_email,resolved);
CREATE TABLE discussion_action_history(id TEXT PRIMARY KEY,action_id TEXT NOT NULL,actor_email TEXT NOT NULL,action TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TABLE task_collaborator_work(task_id TEXT NOT NULL,email TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Open',PRIMARY KEY(task_id,email));
CREATE TABLE work_links(pm_task_id TEXT NOT NULL,engineering_task_id TEXT NOT NULL,actor_email TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(pm_task_id,engineering_task_id));
CREATE TRIGGER activity_edits_no_update BEFORE UPDATE ON activity_edits BEGIN SELECT RAISE(ABORT,'Activity edit history is immutable'); END;
CREATE TRIGGER activity_edits_no_delete BEFORE DELETE ON activity_edits BEGIN SELECT RAISE(ABORT,'Activity edit history is immutable'); END;
CREATE TRIGGER stage_changes_capture AFTER UPDATE ON tasks WHEN NEW.development_status<>OLD.development_status OR NEW.qa_status<>OLD.qa_status OR NEW.work_status<>OLD.work_status BEGIN
 INSERT INTO stage_changes(task_id,from_revision,to_revision,before_json,after_json,recorded_at)
 VALUES(OLD.id,OLD.workflow_revision,NEW.workflow_revision,
 json_object('development_status',OLD.development_status,'qa_status',OLD.qa_status,'work_status',OLD.work_status,'planning_status',OLD.planning_status,'next_action_owner',OLD.next_action_owner,'assignee',OLD.assignee,'qa_owner',OLD.qa_owner,'current_environment',OLD.current_environment,'stage_confirmed_at',OLD.stage_confirmed_at,'qa_passed_stage_at',OLD.qa_passed_stage_at,'estimated_delivery_date',OLD.estimated_delivery_date,'engineering_completed_date',OLD.engineering_completed_date,'qa_due_date',OLD.qa_due_date,'qa_completed_date',OLD.qa_completed_date,'completed_date',OLD.completed_date,'delivery_reset_required',OLD.delivery_reset_required,'feasibility',OLD.feasibility),
 json_object('development_status',NEW.development_status,'qa_status',NEW.qa_status,'work_status',NEW.work_status,'planning_status',NEW.planning_status),NEW.updated_at);
END;
CREATE TRIGGER stage_changes_activity AFTER INSERT ON activities WHEN NEW.action_type<>'Requirement' OR NEW.acknowledges_comments=1 BEGIN
 UPDATE stage_changes SET activity_id=NEW.id WHERE id=(SELECT id FROM stage_changes WHERE task_id=NEW.task_id AND activity_id IS NULL AND to_revision=(SELECT workflow_revision FROM tasks WHERE id=NEW.task_id) ORDER BY id DESC LIMIT 1);
END;

CREATE VIEW effective_work_activities AS SELECT a.id,a.task_id,a.actor_email,a.action_type,
 COALESCE((SELECT e.activity_date FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.activity_date) activity_date,
 a.environment,a.result,COALESCE((SELECT e.notes FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.notes) notes,
 a.github_pr_url,a.created_at,CASE WHEN EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) THEN 0 ELSE a.is_work END is_work,a.acknowledges_comments,a.comment_id,a.work_role,
 COALESCE((SELECT e.minutes FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.minutes) minutes FROM activities a;

CREATE TABLE attachment_change_history(id INTEGER PRIMARY KEY AUTOINCREMENT,attachment_id TEXT NOT NULL,activity_id TEXT,actor_email TEXT NOT NULL,action TEXT NOT NULL,filename TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TRIGGER attachment_tracking_insert AFTER INSERT ON attachments WHEN NEW.activity_id IS NOT NULL BEGIN
 INSERT INTO attachment_change_history(attachment_id,activity_id,actor_email,action,filename,recorded_at) VALUES(NEW.id,NEW.activity_id,NEW.owner_email,'Added',NEW.filename,NEW.created_at);
END;
CREATE TRIGGER attachment_tracking_delete AFTER UPDATE OF deleted ON attachments WHEN NEW.deleted=1 AND OLD.deleted=0 AND OLD.activity_id IS NOT NULL BEGIN
 INSERT INTO attachment_change_history(attachment_id,activity_id,actor_email,action,filename,recorded_at) VALUES(OLD.id,OLD.activity_id,NEW.deleted_by,'Removed',OLD.filename,NEW.deleted_at);
END;
CREATE TRIGGER attachment_history_no_update BEFORE UPDATE ON attachment_change_history BEGIN SELECT RAISE(ABORT,'Attachment history is immutable'); END;
CREATE TRIGGER attachment_history_no_delete BEFORE DELETE ON attachment_change_history BEGIN SELECT RAISE(ABORT,'Attachment history is immutable'); END;

-- Preserve the known current QA entry; earlier rounds remain in original Activity history.
UPDATE tasks SET qa_due_date=date(stage_confirmed_at,'+7 days'),engineering_completed_date=date(stage_confirmed_at)
WHERE stage_confirmed_at<>'' AND date(stage_confirmed_at) IS NOT NULL;
INSERT INTO qa_rounds(id,task_id,entered_at,engineering_due,engineering_completed_date,due_date,completed_date,result)
SELECT lower(hex(randomblob(16))),id,stage_confirmed_at,estimated_delivery_date,engineering_completed_date,qa_due_date,'',
 CASE WHEN qa_status='Passed' THEN 'Passed' ELSE '' END FROM tasks WHERE stage_confirmed_at<>'' AND qa_due_date<>'';
