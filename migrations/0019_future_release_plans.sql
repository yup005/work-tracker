ALTER TABLE releases ADD COLUMN is_auto INTEGER NOT NULL DEFAULT 1 CHECK(is_auto IN (0,1));
ALTER TABLE releases ADD COLUMN plan_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE releases ADD COLUMN deferred_task_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE releases ADD COLUMN rollover_release_id TEXT NOT NULL DEFAULT '';

UPDATE releases SET is_auto=0 WHERE status='Planned' AND id<>(SELECT id FROM releases WHERE status='Planned' ORDER BY planned_date,created_at,id LIMIT 1);
CREATE UNIQUE INDEX releases_one_automatic_plan ON releases(is_auto) WHERE status='Planned' AND is_auto=1;
