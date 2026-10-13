ALTER TABLE tasks ADD COLUMN feasibility TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE tasks ADD COLUMN estimated_delivery_date TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN qa_owner TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN review_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN stage_confirmed_at TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN qa_passed_stage_at TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN workflow_revision INTEGER NOT NULL DEFAULT 0;
-- Preserve the established phase of existing tasks; new requests still require review.
UPDATE tasks SET feasibility='Confirmed' WHERE development_status NOT IN ('New Request','Under Review','On Hold');
UPDATE tasks SET stage_confirmed_at=updated_at WHERE development_status IN ('On Stage','Approved for Production','Awaiting Production Deploy','On Production','Closed');
UPDATE tasks SET qa_passed_stage_at=stage_confirmed_at WHERE qa_status='Passed' AND stage_confirmed_at<>'';
UPDATE tasks SET qa_owner=next_action_owner WHERE development_status='On Stage' AND next_action_owner IN (SELECT email FROM users WHERE enabled=1 AND groups_json LIKE '%QA%' AND groups_json NOT LIKE '%Management%');
