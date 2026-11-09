CREATE TABLE IF NOT EXISTS tenants (
 id text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO tenants (id)
SELECT DISTINCT tenant_id
FROM (
 SELECT tenant_id FROM documents
 UNION ALL
 SELECT tenant_id FROM feedback
 UNION ALL
 SELECT tenant_id FROM audit_events
 UNION ALL
 SELECT tenant_id FROM approvals
 UNION ALL
 SELECT tenant_id FROM chat_messages
) AS existing_tenant_ids
WHERE tenant_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'documents_tenant_id_fkey'
    AND conrelid = 'documents'::regclass
 ) THEN
  ALTER TABLE documents
   ADD CONSTRAINT documents_tenant_id_fkey
   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'feedback_tenant_id_fkey'
    AND conrelid = 'feedback'::regclass
 ) THEN
  ALTER TABLE feedback
   ADD CONSTRAINT feedback_tenant_id_fkey
   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'audit_events_tenant_id_fkey'
    AND conrelid = 'audit_events'::regclass
 ) THEN
  ALTER TABLE audit_events
   ADD CONSTRAINT audit_events_tenant_id_fkey
   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'approvals_tenant_id_fkey'
    AND conrelid = 'approvals'::regclass
 ) THEN
  ALTER TABLE approvals
   ADD CONSTRAINT approvals_tenant_id_fkey
   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
 END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'chat_messages_tenant_id_fkey'
    AND conrelid = 'chat_messages'::regclass
 ) THEN
  ALTER TABLE chat_messages
   ADD CONSTRAINT chat_messages_tenant_id_fkey
   FOREIGN KEY (tenant_id) REFERENCES tenants(id);
 END IF;
END
$$;
