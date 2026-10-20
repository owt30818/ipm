-- 013: explicit table grants
--
-- From 2026-10-30 Supabase no longer grants Data API access to new tables in "public"
-- automatically, also for existing projects. Existing tables keep their grants, but a schema
-- rebuilt from these migrations (new project, preview branch, `supabase db reset`) would end up
-- without any table privileges and every query would fail with "permission denied".
--
-- GRANT is idempotent: on the production project this only repeats what is already there.
--   anon           nothing. The app is login-only and the RPCs are already revoked from anon.
--   authenticated  read/write on the data tables, row access is still decided by the RLS policies.
--                  audit_logs is read-only: 010 removed the write rights, the audit trigger writes it.
--   service_role   everything (admin client).
--
-- Any future migration that creates a table in "public" must add its GRANTs in the same file.

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles, subnets, ip_addresses TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;

GRANT ALL ON profiles, subnets, ip_addresses, audit_logs TO service_role;

COMMIT;
