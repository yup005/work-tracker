-- Production deployment and verification now complete the task in one step.
-- Save previous fields, preserve the original deployment history, and do not create daily work.
CREATE TABLE IF NOT EXISTS production_completion_changes (
 task_id TEXT PRIMARY KEY REFERENCES tasks(id),
 previous_development_status TEXT NOT NULL,
 previous_planning_status TEXT NOT NULL,
 previous_completed_date TEXT NOT NULL,
 previous_next_action_owner TEXT NOT NULL,
 previous_pm_stage TEXT NOT NULL,
 previous_work_status TEXT NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO production_completion_changes(task_id,previous_development_status,previous_planning_status,previous_completed_date,previous_next_action_owner,previous_pm_stage,previous_work_status)
SELECT id,development_status,planning_status,completed_date,next_action_owner,pm_stage,work_status FROM tasks
WHERE deleted=0 AND development_status='On Production';
DROP TRIGGER IF EXISTS stage_changes_capture;
UPDATE tasks SET development_status='Closed',planning_status='Completed',next_action_owner='',
 completed_date=COALESCE(NULLIF(completed_date,''),NULLIF(production_completed_date,''),
  (SELECT MAX(a.activity_date) FROM activities a WHERE a.task_id=tasks.id AND (a.result='On Production' OR a.environment='On Production') AND a.action_type IN ('Deployment','Development') AND NOT EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id)),''),
 pm_stage=CASE WHEN pm_owner<>'' THEN 'Completed' ELSE pm_stage END,
 work_status=CASE WHEN pm_owner<>'' THEN 'Completed' ELSE work_status END
WHERE deleted=0 AND development_status='On Production';

-- Restore the original task-history trigger after this one-time normalization.
CREATE TRIGGER stage_changes_capture AFTER UPDATE ON tasks WHEN NEW.development_status<>OLD.development_status OR NEW.qa_status<>OLD.qa_status OR NEW.work_status<>OLD.work_status OR NEW.pr_reviewer<>OLD.pr_reviewer OR NEW.pr_review_merged_at<>OLD.pr_review_merged_at BEGIN
 INSERT INTO stage_changes(task_id,from_revision,to_revision,before_json,after_json,recorded_at)
 VALUES(OLD.id,OLD.workflow_revision,NEW.workflow_revision,
 json_object('development_status',OLD.development_status,'qa_status',OLD.qa_status,'work_status',OLD.work_status,'planning_status',OLD.planning_status,'next_action_owner',OLD.next_action_owner,'assignee',OLD.assignee,'qa_owner',OLD.qa_owner,'current_environment',OLD.current_environment,'stage_confirmed_at',OLD.stage_confirmed_at,'qa_passed_stage_at',OLD.qa_passed_stage_at,'estimated_delivery_date',OLD.estimated_delivery_date,'engineering_completed_date',OLD.engineering_completed_date,'qa_due_date',OLD.qa_due_date,'qa_completed_date',OLD.qa_completed_date,'completed_date',OLD.completed_date,'delivery_reset_required',OLD.delivery_reset_required,'feasibility',OLD.feasibility,'production_completed_date',OLD.production_completed_date,'pr_submitted_date',OLD.pr_submitted_date,'pr_review_completed_date',OLD.pr_review_completed_date,'pr_reviewer',OLD.pr_reviewer,'pr_review_merged_at',OLD.pr_review_merged_at,'pr_review_confirmed_by',OLD.pr_review_confirmed_by),
 json_object('development_status',NEW.development_status,'qa_status',NEW.qa_status,'work_status',NEW.work_status,'planning_status',NEW.planning_status,'pr_submitted_date',NEW.pr_submitted_date,'pr_review_completed_date',NEW.pr_review_completed_date,'pr_reviewer',NEW.pr_reviewer,'pr_review_merged_at',NEW.pr_review_merged_at,'pr_review_confirmed_by',NEW.pr_review_confirmed_by),NEW.updated_at);
END;
