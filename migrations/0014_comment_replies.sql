ALTER TABLE comments ADD COLUMN reply_to TEXT REFERENCES comments(id);
CREATE INDEX comments_reply_to_idx ON comments(reply_to);
