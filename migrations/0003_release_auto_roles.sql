ALTER TABLE releases ADD COLUMN auto_excluded_json TEXT NOT NULL DEFAULT '[]';
UPDATE users SET groups_json=json_insert(groups_json,'$[#]','Management'),is_boss=1 WHERE role='viewer' AND NOT EXISTS (SELECT 1 FROM json_each(users.groups_json) WHERE value='Management');
UPDATE users SET role='member' WHERE role='viewer';
