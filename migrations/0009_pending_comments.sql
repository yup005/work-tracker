ALTER TABLE activities ADD COLUMN acknowledges_comments INTEGER NOT NULL DEFAULT 0;

CREATE TABLE pending_task_comments (
 comment_id TEXT PRIMARY KEY REFERENCES comments(id),
 task_id TEXT NOT NULL REFERENCES tasks(id)
);
CREATE INDEX pending_task_comments_task_idx ON pending_task_comments(task_id);

-- Preserve unresolved existing comments; historical work uses its recording time,
-- not its optionally backdated work date.
INSERT INTO pending_task_comments(comment_id,task_id)
SELECT c.id,c.task_id FROM comments c
WHERE NOT EXISTS (
 SELECT 1 FROM activities a
 WHERE a.task_id=c.task_id AND a.is_work=1 AND a.created_at>c.created_at
);

-- Both triggers run with the event insert, so even events with identical
-- timestamps follow insertion order without clearing a later comment.
CREATE TRIGGER comments_pending_after_insert AFTER INSERT ON comments BEGIN
 INSERT INTO pending_task_comments(comment_id,task_id) VALUES(NEW.id,NEW.task_id);
END;
CREATE TRIGGER activities_acknowledge_comments AFTER INSERT ON activities
WHEN NEW.is_work=1 OR NEW.acknowledges_comments=1 BEGIN
 DELETE FROM pending_task_comments WHERE task_id=NEW.task_id;
END;
