-- Promote the existing activity explicitly requested by its owner. Reuse an
-- existing task with the same owner/title if one was created in the meantime.
-- The original activity, work date, evidence, and revisions remain intact.
INSERT INTO private_work(id,owner_email,kind,title,description,status,created_at,updated_at)
SELECT o.id,o.owner_email,'Task',o.title,'',
 CASE WHEN o.status IN ('Waiting','Completed') THEN o.status ELSE 'In Progress' END,
 o.created_at,o.updated_at
FROM office_logs o
WHERE o.id='93852b66-746f-45b3-bdf4-b29cd3e1a901'
 AND o.deleted=0 AND o.work_item_id=''
 AND NOT EXISTS (SELECT 1 FROM private_work p WHERE p.id=o.id)
 AND NOT EXISTS (SELECT 1 FROM private_work p WHERE p.owner_email=o.owner_email AND p.kind='Task' AND p.title=o.title AND p.deleted=0);

INSERT INTO private_work_revisions(id,work_id,actor_email,change_type,details)
SELECT lower(hex(randomblob(16))),p.id,p.owner_email,'Created',
 json_object('title',p.title,'kind','Task','source_office_id',o.id)
FROM private_work p JOIN office_logs o ON o.id=p.id AND o.owner_email=p.owner_email AND o.title=p.title
WHERE o.id='93852b66-746f-45b3-bdf4-b29cd3e1a901'
 AND o.deleted=0 AND o.work_item_id='' AND p.kind='Task' AND p.deleted=0
 AND NOT EXISTS (SELECT 1 FROM private_work_revisions r WHERE r.work_id=p.id);

INSERT INTO office_revisions(id,office_id,actor_email,change_type,details)
SELECT lower(hex(randomblob(16))),o.id,o.owner_email,'Edited',
 json_object('field','work_item_id','old','','new',
  (SELECT p.id FROM private_work p WHERE p.owner_email=o.owner_email AND p.kind='Task' AND p.title=o.title AND p.deleted=0 ORDER BY p.created_at,p.id LIMIT 1))
FROM office_logs o
WHERE o.id='93852b66-746f-45b3-bdf4-b29cd3e1a901'
 AND o.deleted=0 AND o.work_item_id=''
 AND EXISTS (SELECT 1 FROM private_work p WHERE p.owner_email=o.owner_email AND p.kind='Task' AND p.title=o.title AND p.deleted=0);

UPDATE office_logs SET work_item_id=
 (SELECT p.id FROM private_work p WHERE p.owner_email=office_logs.owner_email AND p.kind='Task' AND p.title=office_logs.title AND p.deleted=0 ORDER BY p.created_at,p.id LIMIT 1),
 updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id='93852b66-746f-45b3-bdf4-b29cd3e1a901'
 AND deleted=0 AND work_item_id=''
 AND EXISTS (SELECT 1 FROM private_work p WHERE p.owner_email=office_logs.owner_email AND p.kind='Task' AND p.title=office_logs.title AND p.deleted=0);
