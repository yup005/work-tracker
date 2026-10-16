# Pre Task ID / Urgent checkpoint

Checkpoint before task identifiers and urgency tracking. Historical backup table names are retained for compatibility.

Migration 0030 creates infrastructure-only, exact copies of all 32 existing user tables and captures the original schema, indexes and triggers. Each manifest row has a CHECK constraint that aborts on any content difference; snapshot is created before task-number/reminder migrations. Application exports never include infrastructure backups. They contain private/auth data and must remain inside the existing database access boundary.

Verify: system_backup_v85_manifest has 32 rows, every verified=1, row_count=snapshot_count. The local rehearsal compares all columns using EXCEPT in both directions and exercises restoring a modified task field.

For rollback, use a verified compatible application checkpoint. Number/reminder additions are additive; old primary keys, histories and fields remain compatible. Keep new registries and acknowledgement tables intact so issued IDs remain reserved. Never replay older migrations or reset data.

Data recovery if corruption is observed: stop workspace writes first, take an additional current checkpoint, compare the affected old columns with system_backup_v85_<table>, and restore only verified affected fields through an infrastructure migration. Do not wholesale replace tables or roll back activity, QA or release history created after the checkpoint. Original DDL is in system_backup_v85_schema. Rehearse the exact recovery on a copy before production. Database-wide disaster recovery should use infrastructure-level restoration, never the permission-scoped Admin export.

Attachment/avatar objects and their object keys are untouched by this update. No object deletions or rewrites are part of migration or rollback. The database checkpoint preserves every original reference.

Task-number migration 0031 also captures the immediately preceding shared/private task rows and verifies that every old column is unchanged. identifier_verification records five assertions: original shared fields, original private fields, shared coverage, private Task coverage and global uniqueness. Number creation and urgency updates use database triggers/atomic batches, not client-generated sequence guesses. No production reminder is marked as a test.
