-- Preserve existing comments and QA activity records; new replies link to their source feedback.
ALTER TABLE comments ADD COLUMN reply_to_activity TEXT REFERENCES activities(id);
CREATE INDEX comments_activity_reply_idx ON comments(task_id,reply_to_activity,created_at);
