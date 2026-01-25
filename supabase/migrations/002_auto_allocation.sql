-- Function to allocate contiguous IPs
CREATE OR REPLACE FUNCTION allocate_contiguous_ips(
  p_subnet_id UUID,
  p_quantity INT,
  p_description TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  ip_address INET
) AS $$
DECLARE
  v_rec RECORD;
  v_count INT := 0;
  v_target_ids UUID[];
  v_current_ip INET;
BEGIN
  -- Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  -- 1. Lock the subnet to handle concurrency simply
  PERFORM 1 FROM subnets WHERE subnets.id = p_subnet_id FOR UPDATE;

  -- 2. Find a contiguous block
  v_count := 0;
  v_target_ids := ARRAY[]::UUID[];

  -- Iterate through available IPs (ordered) and find the first contiguous block of size N
  FOR v_rec IN 
    SELECT i.id, i.ip_address 
    FROM ip_addresses i
    WHERE i.subnet_id = p_subnet_id 
      AND i.status = 'available'
    ORDER BY i.ip_address ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    -- If first item or not contiguous with previous
    IF v_count = 0 OR (v_rec.ip_address - v_current_ip) != 1 THEN
      v_count := 1;
      v_target_ids := ARRAY[v_rec.id];
    ELSE
      -- Contiguous
      v_count := v_count + 1;
      v_target_ids := array_append(v_target_ids, v_rec.id);
    END IF;

    v_current_ip := v_rec.ip_address;

    -- Found enough IPs?
    IF v_count = p_quantity THEN
      EXIT;
    END IF;
  END LOOP;

  IF v_count < p_quantity THEN
    RAISE EXCEPTION 'Insufficient contiguous IP space available';
  END IF;

  -- 3. Update the found IPs
  UPDATE ip_addresses
  SET 
    status = 'allocated',
    description = p_description,
    allocated_to = (SELECT email FROM profiles WHERE profiles.id = p_user_id),
    allocated_at = NOW()
  WHERE ip_addresses.id = ANY(v_target_ids);

  RETURN QUERY 
    SELECT i.id, i.ip_address 
    FROM ip_addresses i 
    WHERE i.id = ANY(v_target_ids)
    ORDER BY i.ip_address ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
