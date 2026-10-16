-- Owner requested simpler CURRENT QA labels. Retain the original value here;
-- activities, QA rounds, stage-change snapshots, dates and workflow revisions stay intact.
-- Need Explanation stays distinct because it can represent a discussion without a verdict.
CREATE TABLE IF NOT EXISTS qa_result_label_changes (
 task_id TEXT PRIMARY KEY REFERENCES tasks(id),
 previous_result TEXT NOT NULL,
 current_result TEXT NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO qa_result_label_changes(task_id,previous_result,current_result)
SELECT id,qa_status,'Not Passed' FROM tasks
WHERE deleted=0 AND qa_status IN ('Changes Required','No Visible Changes','Unable to Test');
DROP TRIGGER IF EXISTS stage_changes_capture;
UPDATE tasks SET qa_status='Not Passed'
WHERE deleted=0 AND qa_status IN ('Changes Required','No Visible Changes','Unable to Test')
AND EXISTS(SELECT 1 FROM qa_result_label_changes m WHERE m.task_id=tasks.id AND m.previous_result=tasks.qa_status);

-- Restore the original task-history trigger after this one-time normalization.
CREATE TRIGGER stage_changes_capture AFTER UPDATE ON tasks WHEN NEW.development_status<>OLD.development_status OR NEW.qa_status<>OLD.qa_status OR NEW.work_status<>OLD.work_status OR NEW.pr_reviewer<>OLD.pr_reviewer OR NEW.pr_review_merged_at<>OLD.pr_review_merged_at BEGIN
 INSERT INTO stage_changes(task_id,from_revision,to_revision,before_json,after_json,recorded_at)
 VALUES(OLD.id,OLD.workflow_revision,NEW.workflow_revision,
 json_object('development_status',OLD.development_status,'qa_status',OLD.qa_status,'work_status',OLD.work_status,'planning_status',OLD.planning_status,'next_action_owner',OLD.next_action_owner,'assignee',OLD.assignee,'qa_owner',OLD.qa_owner,'current_environment',OLD.current_environment,'stage_confirmed_at',OLD.stage_confirmed_at,'qa_passed_stage_at',OLD.qa_passed_stage_at,'estimated_delivery_date',OLD.estimated_delivery_date,'engineering_completed_date',OLD.engineering_completed_date,'qa_due_date',OLD.qa_due_date,'qa_completed_date',OLD.qa_completed_date,'completed_date',OLD.completed_date,'delivery_reset_required',OLD.delivery_reset_required,'feasibility',OLD.feasibility,'production_completed_date',OLD.production_completed_date,'pr_submitted_date',OLD.pr_submitted_date,'pr_review_completed_date',OLD.pr_review_completed_date,'pr_reviewer',OLD.pr_reviewer,'pr_review_merged_at',OLD.pr_review_merged_at,'pr_review_confirmed_by',OLD.pr_review_confirmed_by),
 json_object('development_status',NEW.development_status,'qa_status',NEW.qa_status,'work_status',NEW.work_status,'planning_status',NEW.planning_status,'pr_submitted_date',NEW.pr_submitted_date,'pr_review_completed_date',NEW.pr_review_completed_date,'pr_reviewer',NEW.pr_reviewer,'pr_review_merged_at',NEW.pr_review_merged_at,'pr_review_confirmed_by',NEW.pr_review_confirmed_by),NEW.updated_at);
END;
