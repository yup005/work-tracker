ALTER TABLE tasks ADD COLUMN pr_submitted_date TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pr_review_completed_date TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pr_reviewer TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pr_review_merged_at TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN pr_review_confirmed_by TEXT NOT NULL DEFAULT '';
DROP TRIGGER stage_changes_capture;
CREATE TRIGGER stage_changes_capture AFTER UPDATE ON tasks WHEN NEW.development_status<>OLD.development_status OR NEW.qa_status<>OLD.qa_status OR NEW.work_status<>OLD.work_status OR NEW.pr_reviewer<>OLD.pr_reviewer OR NEW.pr_review_merged_at<>OLD.pr_review_merged_at BEGIN
 INSERT INTO stage_changes(task_id,from_revision,to_revision,before_json,after_json,recorded_at)
 VALUES(OLD.id,OLD.workflow_revision,NEW.workflow_revision,
 json_object('development_status',OLD.development_status,'qa_status',OLD.qa_status,'work_status',OLD.work_status,'planning_status',OLD.planning_status,'next_action_owner',OLD.next_action_owner,'assignee',OLD.assignee,'qa_owner',OLD.qa_owner,'current_environment',OLD.current_environment,'stage_confirmed_at',OLD.stage_confirmed_at,'qa_passed_stage_at',OLD.qa_passed_stage_at,'estimated_delivery_date',OLD.estimated_delivery_date,'engineering_completed_date',OLD.engineering_completed_date,'qa_due_date',OLD.qa_due_date,'qa_completed_date',OLD.qa_completed_date,'completed_date',OLD.completed_date,'delivery_reset_required',OLD.delivery_reset_required,'feasibility',OLD.feasibility,'production_completed_date',OLD.production_completed_date,'pr_submitted_date',OLD.pr_submitted_date,'pr_review_completed_date',OLD.pr_review_completed_date,'pr_reviewer',OLD.pr_reviewer,'pr_review_merged_at',OLD.pr_review_merged_at,'pr_review_confirmed_by',OLD.pr_review_confirmed_by),
 json_object('development_status',NEW.development_status,'qa_status',NEW.qa_status,'work_status',NEW.work_status,'planning_status',NEW.planning_status,'pr_submitted_date',NEW.pr_submitted_date,'pr_review_completed_date',NEW.pr_review_completed_date,'pr_reviewer',NEW.pr_reviewer,'pr_review_merged_at',NEW.pr_review_merged_at,'pr_review_confirmed_by',NEW.pr_review_confirmed_by),NEW.updated_at);
END;
CREATE INDEX IF NOT EXISTS activities_task_work_date ON activities(task_id,is_work,activity_date);
CREATE INDEX IF NOT EXISTS activities_work_date ON activities(is_work,activity_date,created_at);
CREATE INDEX IF NOT EXISTS stage_changes_current ON stage_changes(task_id,undone,recorded_at);
CREATE INDEX IF NOT EXISTS comments_task_order ON comments(task_id,created_at);
CREATE INDEX IF NOT EXISTS attachments_task_active ON attachments(task_id,deleted,created_at);
