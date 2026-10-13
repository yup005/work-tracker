-- Handoff uses the original record in the ordinary Engineering task workflow.
UPDATE tasks SET work_kind='Engineering'
WHERE work_kind='PM Task' AND pm_engineer<>'' AND pm_stage IN ('Engineer Review','Implementation','Completed');

DROP TRIGGER comments_work_after_insert;
CREATE TRIGGER comments_work_after_insert AFTER INSERT ON comments BEGIN
 INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,environment,result,notes,created_at,is_work,comment_id,work_role)
 SELECT NEW.id,NEW.task_id,NEW.actor_email,'Requirement',
 date(NEW.created_at,CASE
 WHEN NEW.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ',strftime('%Y',NEW.created_at)||'-03-01','weekday 0','+7 days','+10 hours')
  AND NEW.created_at < strftime('%Y-%m-%dT%H:%M:%fZ',strftime('%Y',NEW.created_at)||'-11-01','weekday 0','+9 hours')
 THEN '-7 hours' ELSE '-8 hours' END),
 current_environment,'Requirement discussion',NEW.body,NEW.created_at,1,NEW.id,
 CASE WHEN pm_owner<>'' AND NEW.actor_email=pm_owner THEN 'PM' WHEN pm_owner<>'' AND NEW.actor_email=pm_engineer THEN 'Engineering' ELSE '' END
 FROM tasks WHERE id=NEW.task_id;
END;
