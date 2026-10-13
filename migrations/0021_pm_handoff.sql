-- Add PM handoffs to existing task records; never copy or replace task data.
ALTER TABLE tasks ADD COLUMN pm_owner TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pm_stage TEXT NOT NULL DEFAULT 'Draft';
ALTER TABLE tasks ADD COLUMN pm_engineer TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pm_solution TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pm_resume_stage TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pm_resume_owner TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pm_request_comment TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pm_transition_token TEXT NOT NULL DEFAULT '';
UPDATE tasks SET pm_owner=assignee,pm_stage=CASE WHEN work_status='Completed' OR development_status='Closed' THEN 'Completed' ELSE 'Draft' END WHERE work_kind='PM Task';
CREATE TABLE pm_handoffs(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),actor_email TEXT NOT NULL,action TEXT NOT NULL,from_stage TEXT NOT NULL,to_stage TEXT NOT NULL,notes TEXT NOT NULL,solution TEXT NOT NULL,engineer_email TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE INDEX pm_handoffs_task_idx ON pm_handoffs(task_id,recorded_at);
CREATE TRIGGER pm_handoffs_no_update BEFORE UPDATE ON pm_handoffs BEGIN SELECT RAISE(ABORT,'PM handoff history is immutable'); END;
CREATE TRIGGER pm_handoffs_no_delete BEFORE DELETE ON pm_handoffs BEGIN SELECT RAISE(ABORT,'PM handoff history is immutable'); END;
-- New discussions carry the actor's PM/Engineering role on PM work.
DROP TRIGGER comments_work_after_insert;
CREATE TRIGGER comments_work_after_insert AFTER INSERT ON comments BEGIN
 INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,environment,result,notes,created_at,is_work,comment_id,work_role)
 SELECT NEW.id,NEW.task_id,NEW.actor_email,'Requirement',
 date(NEW.created_at,CASE
 WHEN NEW.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ',strftime('%Y',NEW.created_at)||'-03-01','weekday 0','+7 days','+10 hours')
  AND NEW.created_at < strftime('%Y-%m-%dT%H:%M:%fZ',strftime('%Y',NEW.created_at)||'-11-01','weekday 0','+9 hours')
 THEN '-7 hours' ELSE '-8 hours' END),
 current_environment,'Requirement discussion',NEW.body,NEW.created_at,1,NEW.id,
 CASE WHEN work_kind='PM Task' AND NEW.actor_email=pm_owner THEN 'PM' WHEN work_kind='PM Task' AND NEW.actor_email=pm_engineer THEN 'Engineering' ELSE '' END
 FROM tasks WHERE id=NEW.task_id;
END;
