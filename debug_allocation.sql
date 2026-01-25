DO $$
DECLARE
  v_subnet_id UUID;
  v_user_id UUID;
BEGIN
  -- Get Gap Subnet ID
  SELECT id INTO v_subnet_id FROM subnets WHERE name = 'Gap Subnet';
  
  -- Get Admin User ID
  SELECT id INTO v_user_id FROM profiles WHERE email = 'admin@example.com';
  
  -- Try to call the function
  PERFORM allocate_contiguous_ips(v_subnet_id, 1, 'Debug Allocation', v_user_id);
END $$;
