-- Drop existing restricted policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;

-- Create new policy allowing admins to view all, and others to view only their own
CREATE POLICY "View audit logs" ON audit_logs
  FOR SELECT USING (
    get_my_role() = 'admin' OR user_id = auth.uid()
  );
