-- 012: sortable IP search
--
-- search_ip_addresses gets a p_sort argument (default 'ip_asc', the previous behaviour):
--   ip_asc       IP address, ascending
--   issued_desc  newest issued first  (issued time = allocated_at, or created_at when it is null)
--   issued_asc   oldest issued first
-- Ties (e.g. IPs created by one auto-allocation share a timestamp) fall back to IP address order.
-- An unknown value behaves like ip_asc. No dynamic SQL is used.
--
-- The old 6-argument signature is dropped so a call without p_sort still resolves to a single
-- function: the app image deployed before this migration keeps working, and the new image needs
-- this migration applied first.

BEGIN;

DROP FUNCTION IF EXISTS search_ip_addresses(TEXT, UUID, TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION search_ip_addresses(
  p_status TEXT DEFAULT NULL,
  p_subnet_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_sort TEXT DEFAULT 'ip_asc'
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
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
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
    ORDER BY
      CASE WHEN p_sort = 'issued_desc' THEN COALESCE(ip.allocated_at, ip.created_at) END DESC,
      CASE WHEN p_sort = 'issued_asc' THEN COALESCE(ip.allocated_at, ip.created_at) END ASC,
      ip.ip_address ASC
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
$$;

REVOKE EXECUTE ON FUNCTION search_ip_addresses(TEXT, UUID, TEXT, TEXT, INT, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION search_ip_addresses(TEXT, UUID, TEXT, TEXT, INT, INT, TEXT) TO authenticated;

COMMIT;
