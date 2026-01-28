-- Add text search support for IP addresses
-- This allows searching ip_addresses by partial IP text match

CREATE OR REPLACE FUNCTION search_ip_addresses(
  p_status TEXT DEFAULT NULL,
  p_subnet_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  subnet_id UUID,
  ip_address INET,
  status TEXT,
  description TEXT,
  allocated_to TEXT,
  allocated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  subnet_cidr CIDR,
  subnet_name TEXT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT 
      ip.*,
      s.cidr AS subnet_cidr,
      s.name AS subnet_name,
      COUNT(*) OVER() AS total_count
    FROM ip_addresses ip
    LEFT JOIN subnets s ON ip.subnet_id = s.id
    WHERE 
      (p_status IS NULL OR ip.status = p_status)
      AND (p_subnet_id IS NULL OR ip.subnet_id = p_subnet_id)
      AND (p_description IS NULL OR ip.description ILIKE '%' || p_description || '%' OR ip.allocated_to ILIKE '%' || p_description || '%')
      AND (p_ip_address IS NULL OR ip.ip_address::TEXT ILIKE '%' || p_ip_address || '%')
    ORDER BY ip.ip_address ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    filtered.id,
    filtered.subnet_id,
    filtered.ip_address,
    filtered.status,
    filtered.description,
    filtered.allocated_to,
    filtered.allocated_at,
    filtered.created_at,
    filtered.updated_at,
    filtered.subnet_cidr,
    filtered.subnet_name,
    filtered.total_count
  FROM filtered;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_ip_addresses TO authenticated;
