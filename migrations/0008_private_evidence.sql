ALTER TABLE attachments ADD COLUMN private_work_id TEXT;
CREATE INDEX attachments_office_active_idx ON attachments(office_id,deleted);
CREATE INDEX attachments_private_active_idx ON attachments(private_work_id,deleted);
ALTER TABLE private_work ADD COLUMN recurrence_rule TEXT NOT NULL DEFAULT 'none';
ALTER TABLE private_work ADD COLUMN next_due_date TEXT NOT NULL DEFAULT '';
ALTER TABLE private_work ADD COLUMN recurrence_anchor_day INTEGER NOT NULL DEFAULT 0;
CREATE INDEX private_work_due_idx ON private_work(owner_email,next_due_date,deleted);
ALTER TABLE office_logs ADD COLUMN complete_occurrence INTEGER NOT NULL DEFAULT 0;
