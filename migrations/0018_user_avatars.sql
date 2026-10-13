ALTER TABLE users ADD COLUMN avatar_id TEXT NOT NULL DEFAULT '';
CREATE TABLE user_avatars (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, object_key TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX user_avatars_owner ON user_avatars(owner_email);
