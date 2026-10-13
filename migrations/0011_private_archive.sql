ALTER TABLE private_work ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1));
CREATE INDEX private_work_archive ON private_work(owner_email,deleted,archived);
