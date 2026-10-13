-- Initial submissions are work, including existing records. Preserve immutable activities and edits.
DROP VIEW effective_work_activities;
CREATE VIEW effective_work_activities AS SELECT a.id,a.task_id,a.actor_email,a.action_type,
 COALESCE((SELECT e.activity_date FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.activity_date) activity_date,
 a.environment,a.result,COALESCE((SELECT e.notes FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.notes) notes,
 a.github_pr_url,a.created_at,CASE WHEN EXISTS(SELECT 1 FROM excluded_activities x WHERE x.activity_id=a.id) THEN 0 WHEN a.action_type='Requirement' AND a.result='New request submitted' AND a.id=(SELECT id FROM activities initial WHERE initial.task_id=a.task_id ORDER BY initial.rowid LIMIT 1) AND EXISTS(SELECT 1 FROM tasks t WHERE t.id=a.task_id AND t.created_by=a.actor_email) THEN 1 ELSE a.is_work END is_work,a.acknowledges_comments,a.comment_id,a.work_role,
 COALESCE((SELECT e.minutes FROM activity_edits e WHERE e.activity_id=a.id ORDER BY e.rowid DESC LIMIT 1),a.minutes) minutes FROM activities a;
