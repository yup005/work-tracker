ALTER TABLE activities ADD COLUMN comment_id TEXT REFERENCES comments(id);
CREATE UNIQUE INDEX activities_comment_idx ON activities(comment_id) WHERE comment_id IS NOT NULL;

-- Discussions are work, but posting one must not clear unanswered comments.
DROP TRIGGER activities_acknowledge_comments;
CREATE TRIGGER activities_acknowledge_comments AFTER INSERT ON activities
WHEN (NEW.is_work=1 AND NEW.comment_id IS NULL) OR NEW.acknowledges_comments=1 BEGIN
 DELETE FROM pending_task_comments WHERE task_id=NEW.task_id;
END;

-- Preserve each historical comment's recording time and Los Angeles work date.
-- US daylight saving starts on March's second Sunday at 10:00 UTC and ends
-- on November's first Sunday at 09:00 UTC (all supported app dates are modern).
INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,environment,result,notes,created_at,is_work,comment_id)
SELECT c.id,c.task_id,c.actor_email,'Requirement',
 date(c.created_at,CASE
 WHEN c.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ',strftime('%Y',c.created_at)||'-03-01','weekday 0','+7 days','+10 hours')
  AND c.created_at < strftime('%Y-%m-%dT%H:%M:%fZ',strftime('%Y',c.created_at)||'-11-01','weekday 0','+9 hours')
 THEN '-7 hours' ELSE '-8 hours' END),
 t.current_environment,'Requirement discussion',c.body,c.created_at,1,c.id
FROM comments c JOIN tasks t ON t.id=c.task_id;

CREATE TRIGGER comments_work_after_insert AFTER INSERT ON comments BEGIN
 INSERT INTO activities(id,task_id,actor_email,action_type,activity_date,environment,result,notes,created_at,is_work,comment_id)
 SELECT NEW.id,NEW.task_id,NEW.actor_email,'Requirement',
 date(NEW.created_at,CASE
 WHEN NEW.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ',strftime('%Y',NEW.created_at)||'-03-01','weekday 0','+7 days','+10 hours')
  AND NEW.created_at < strftime('%Y-%m-%dT%H:%M:%fZ',strftime('%Y',NEW.created_at)||'-11-01','weekday 0','+9 hours')
 THEN '-7 hours' ELSE '-8 hours' END),
 current_environment,'Requirement discussion',NEW.body,NEW.created_at,1,NEW.id
 FROM tasks WHERE id=NEW.task_id;
END;
