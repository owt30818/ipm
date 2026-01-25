-- Function to populate IPs for a subnet
CREATE OR REPLACE FUNCTION populate_subnet_hosts_fn(p_subnet_id UUID) 
RETURNS VOID AS $$
DECLARE
  v_cidr CIDR;
  v_net INET;
  v_count BIGINT;
BEGIN
  -- Get CIDR
  SELECT cidr INTO v_cidr FROM subnets WHERE id = p_subnet_id;
  
  IF v_cidr IS NULL THEN
    RAISE NOTICE 'Subnet not found';
    RETURN;
  END IF;

  v_net := network(v_cidr);
  v_count := (broadcast(v_cidr) - v_net)::BIGINT;

  -- Safety check: limit to /16 (65536 IPs) to prevent explosion
  IF v_count > 65536 THEN
    RAISE EXCEPTION 'Subnet too large for auto-population (max /16)';
  END IF;

  -- Insert IPs
  -- Force /32 masklen to ensure consistency (host address only)
  INSERT INTO ip_addresses (subnet_id, ip_address, status)
  SELECT 
    p_subnet_id, 
    set_masklen((v_net + i::INT)::inet, 32), 
    'available'
  FROM generate_series(0, v_count::INT) as i
  ON CONFLICT (ip_address) DO NOTHING;

END;
$$ LANGUAGE plpgsql;
