-- Update the allocate_contiguous_ips function to accept p_status and p_allocated_to
CREATE OR REPLACE FUNCTION allocate_contiguous_ips(
  p_subnet_id UUID,
  p_quantity INT,
  p_description TEXT,
  p_user_id UUID,
  p_status TEXT DEFAULT 'allocated',
  p_allocated_to TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  ip_address INET
) AS $$
DECLARE
  v_subnet_cidr INET;
  v_network_ip INET;
  v_broadcast_ip INET;
  v_current_ip INET;
  v_count BIGINT := 0;
  v_consecutive INT := 0;
  v_used_ips INET[];
  v_target_ips INET[];
  v_target_ids UUID[];
  v_new_id UUID;
  v_allocated_at TIMESTAMP WITH TIME ZONE;
  i BIGINT;
BEGIN
  -- Disable RLS for this function
  SET LOCAL row_security = off;

  -- Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  -- Set allocated_at only if status is allocated and allocated_to has been provided
  IF p_status = 'allocated' AND p_allocated_to IS NOT NULL AND TRIM(p_allocated_to) <> '' THEN
    v_allocated_at := NOW();
  ELSE
    v_allocated_at := NULL;
  END IF;

  -- 1. Lock the subnet to handle concurrency simply and get its CIDR
  SELECT cidr INTO v_subnet_cidr FROM subnets WHERE subnets.id = p_subnet_id FOR UPDATE;

  IF v_subnet_cidr IS NULL THEN
    RAISE EXCEPTION 'Subnet not found';
  END IF;

  v_network_ip := network(v_subnet_cidr);
  v_broadcast_ip := broadcast(v_subnet_cidr);

  -- Count total IPs in the subnet
  v_count := v_broadcast_ip - v_network_ip; 

  -- 2. Get all assigned IPs in this subnet
  -- Normalize to /32 so that they match exactly with our loop values
  SELECT array_agg(set_masklen(i.ip_address, 32)) INTO v_used_ips
  FROM ip_addresses i
  WHERE i.subnet_id = p_subnet_id;

  IF v_used_ips IS NULL THEN
    v_used_ips := ARRAY[]::INET[];
  END IF;

  v_target_ips := ARRAY[]::INET[];

  -- 3. Iterate from network_ip + 1 to broadcast_ip - 1
  FOR i IN 1 .. (v_count - 1) LOOP
    -- Normalize the loop ip to a /32 host address
    v_current_ip := set_masklen(v_network_ip + i, 32);

    -- Check if v_current_ip is already in use
    IF v_current_ip = ANY(v_used_ips) THEN
      v_consecutive := 0;
      v_target_ips := ARRAY[]::INET[];
    ELSE
      v_consecutive := v_consecutive + 1;
      v_target_ips := array_append(v_target_ips, v_current_ip);

      -- Found enough IPs?
      IF v_consecutive = p_quantity THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF v_consecutive < p_quantity THEN
    RAISE EXCEPTION 'Insufficient contiguous IP space available';
  END IF;

  -- 4. Generate UUIDs and Insert the new IPs
  v_target_ids := ARRAY[]::UUID[];
  
  FOR i IN 1 .. array_length(v_target_ips, 1) LOOP
    v_new_id := gen_random_uuid();
    v_target_ids := array_append(v_target_ids, v_new_id);
    
    INSERT INTO ip_addresses (
      id, subnet_id, ip_address, status, description, allocated_to, allocated_at
    ) VALUES (
      v_new_id,
      p_subnet_id,
      v_target_ips[i],
      p_status,
      p_description,
      p_allocated_to,
      v_allocated_at
    );
  END LOOP;

  RETURN QUERY 
    SELECT i.id, i.ip_address 
    FROM ip_addresses i 
    WHERE i.id = ANY(v_target_ids)
    ORDER BY i.ip_address ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
