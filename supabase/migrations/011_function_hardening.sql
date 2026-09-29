-- 011: Supabase security advisor cleanup (function search_path + API exposure)
--
-- Left as-is on purpose (advisor 0029 "signed-in users can execute SECURITY DEFINER"):
--   * get_my_role(): RLS policies evaluate it as the calling role, so `authenticated` needs EXECUTE.
--     It only returns the caller's own role. It must stay SECURITY DEFINER to avoid RLS recursion on profiles.
--   * allocate_contiguous_ips(): called by the app as the signed-in user; it verifies auth.uid(),
--     admin/sub_admin role and quantity inside the function (migration 009).

BEGIN;

-- Pin search_path (advisor 0011). All three reference only objects in `public`.
ALTER FUNCTION search_ip_addresses(TEXT, UUID, TEXT, TEXT, INT, INT) SET search_path = public;
ALTER FUNCTION get_my_role() SET search_path = public;
ALTER FUNCTION handle_new_user() SET search_path = public;

-- handle_new_user() is a trigger function on auth.users; nobody should reach it via /rest/v1/rpc.
-- Trigger execution does not check EXECUTE at fire time, so signups keep creating profiles.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;

-- get_my_role(): signed-out callers have no use for it (advisor 0028)
REVOKE EXECUTE ON FUNCTION get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;

COMMIT;
