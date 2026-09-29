-- 010: data integrity + automatic audit trail
--
-- Preflight (read-only). Only #2 blocks this migration; #1 and #3 are informational.
--   -- 1) IPs that lie outside their subnet (legacy rows are left alone; the new trigger only checks new/changed rows)
--   SELECT i.ip_address, s.cidr FROM ip_addresses i JOIN subnets s ON s.id = i.subnet_id
--   WHERE NOT (set_masklen(i.ip_address, 32) <<= s.cidr);
--   -- 2) overlapping subnets (must be empty)
--   SELECT a.cidr, b.cidr FROM subnets a JOIN subnets b ON a.id < b.id AND a.cidr && b.cidr;
--   -- 3) IPs stored with a mask other than /32
--   SELECT count(*) FROM ip_addresses WHERE masklen(ip_address) <> 32;
--
-- Note: audit rows are written for every ip_addresses change, including bulk maintenance
-- such as populate_subnet_hosts_fn (one row per IP).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. IP must lie inside its subnet (checked on insert and when ip/subnet change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_ip_in_subnet()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cidr CIDR;
BEGIN
  SELECT cidr INTO v_cidr FROM subnets WHERE id = NEW.subnet_id;

  IF v_cidr IS NULL THEN
    RAISE EXCEPTION 'Subnet not found' USING ERRCODE = '23503';
  END IF;

  IF NOT (
    set_masklen(NEW.ip_address, CASE family(NEW.ip_address) WHEN 4 THEN 32 ELSE 128 END) <<= v_cidr
  ) THEN
    RAISE EXCEPTION 'IP address % is outside subnet %', host(NEW.ip_address), v_cidr
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ip_addresses_enforce_subnet ON ip_addresses;
CREATE TRIGGER ip_addresses_enforce_subnet
  BEFORE INSERT OR UPDATE OF ip_address, subnet_id ON ip_addresses
  FOR EACH ROW EXECUTE FUNCTION enforce_ip_in_subnet();

-- ---------------------------------------------------------------------------
-- 2. Subnets must not overlap
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subnets_no_overlap') THEN
    FOR r IN
      SELECT a.cidr AS a_cidr, b.cidr AS b_cidr
      FROM subnets a JOIN subnets b ON a.id < b.id AND a.cidr && b.cidr
    LOOP
      RAISE EXCEPTION 'Overlapping subnets exist: % and % (resolve them before applying)', r.a_cidr, r.b_cidr;
    END LOOP;

    ALTER TABLE subnets
      ADD CONSTRAINT subnets_no_overlap EXCLUDE USING gist (cidr inet_ops WITH &&);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Automatic audit trail for ip_addresses (covers RPC, bulk actions, CSV, cascades)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_ip_address_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID;
BEGIN
  -- NULL for SQL-editor / service-role changes, and for users without a profile row
  SELECT id INTO v_user FROM profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (ip_address_id, user_id, action_type, old_value, new_value)
    VALUES (NEW.id, v_user, 'create', NULL, to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- ignore no-op updates (only updated_at differs)
    IF (to_jsonb(OLD) - 'updated_at') = (to_jsonb(NEW) - 'updated_at') THEN
      RETURN NEW;
    END IF;
    INSERT INTO audit_logs (ip_address_id, user_id, action_type, old_value, new_value)
    VALUES (NEW.id, v_user, 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;

  ELSE
    -- BEFORE DELETE: the audit row must reference the IP while it still exists;
    -- the FK (ON DELETE SET NULL) detaches it afterwards and old_value keeps the full row
    INSERT INTO audit_logs (ip_address_id, user_id, action_type, old_value, new_value)
    VALUES (OLD.id, v_user, 'delete', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS ip_addresses_audit_write ON ip_addresses;
CREATE TRIGGER ip_addresses_audit_write
  AFTER INSERT OR UPDATE ON ip_addresses
  FOR EACH ROW EXECUTE FUNCTION log_ip_address_change();

DROP TRIGGER IF EXISTS ip_addresses_audit_delete ON ip_addresses;
CREATE TRIGGER ip_addresses_audit_delete
  BEFORE DELETE ON ip_addresses
  FOR EACH ROW EXECUTE FUNCTION log_ip_address_change();

-- Clients can no longer write audit rows directly (previously any logged-in user could forge them)
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_logs FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION enforce_ip_in_subnet() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_ip_address_change() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. First free host IP of a subnet (same skip rule as allocate_contiguous_ips: *.0 and *.255)
--    Walks the used IPs in order instead of loading them all client-side (PostgREST caps rows).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_next_available_ip(p_subnet_id UUID)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_cidr CIDR;
  v_cur INET;
  v_last INET;
  r RECORD;
BEGIN
  SELECT cidr INTO v_cidr FROM subnets WHERE id = p_subnet_id;

  IF v_cidr IS NULL OR family(v_cidr) <> 4 OR masklen(v_cidr) >= 31 THEN
    RETURN NULL;
  END IF;

  v_cur  := set_masklen(network(v_cidr)::INET, 32) + 1;
  v_last := set_masklen(broadcast(v_cidr), 32) - 1;

  FOR r IN
    SELECT DISTINCT set_masklen(ip_address, 32) AS ip
    FROM ip_addresses
    WHERE subnet_id = p_subnet_id
    ORDER BY 1
  LOOP
    WHILE v_cur <= v_last AND (host(v_cur) LIKE '%.0' OR host(v_cur) LIKE '%.255') LOOP
      v_cur := v_cur + 1;
    END LOOP;

    EXIT WHEN v_cur > v_last;
    CONTINUE WHEN r.ip < v_cur;  -- used IP below the cursor (e.g. the network address)
    EXIT WHEN r.ip > v_cur;      -- gap: v_cur is free
    v_cur := v_cur + 1;          -- r.ip = v_cur: taken, move on
  END LOOP;

  WHILE v_cur <= v_last AND (host(v_cur) LIKE '%.0' OR host(v_cur) LIKE '%.255') LOOP
    v_cur := v_cur + 1;
  END LOOP;

  IF v_cur > v_last THEN
    RETURN NULL;
  END IF;

  RETURN host(v_cur);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_next_available_ip(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_next_available_ip(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Per-subnet counts in one query (replaces 5 count queries per subnet)
--    total_capacity = usable hosts (network/broadcast excluded for /30 and larger);
--    network/broadcast rows that were registered (populate_subnet_hosts_fn) are not counted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_subnet_stats()
RETURNS TABLE (
  id UUID,
  name TEXT,
  cidr CIDR,
  total_capacity BIGINT,
  registered BIGINT,
  available BIGINT,
  allocated BIGINT,
  reserved BIGINT,
  deprecated BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.cidr,
    CASE
      WHEN family(s.cidr) <> 4 THEN 0::BIGINT
      WHEN masklen(s.cidr) >= 31 THEN (1::BIGINT << (32 - masklen(s.cidr)))
      ELSE (1::BIGINT << (32 - masklen(s.cidr))) - 2
    END,
    count(i.id),
    count(i.id) FILTER (WHERE i.status = 'available'),
    count(i.id) FILTER (WHERE i.status = 'allocated'),
    count(i.id) FILTER (WHERE i.status = 'reserved'),
    count(i.id) FILTER (WHERE i.status = 'deprecated')
  FROM subnets s
  LEFT JOIN ip_addresses i
    ON i.subnet_id = s.id
   AND (
     masklen(s.cidr) >= 31
     OR (
       set_masklen(i.ip_address, 32) <> set_masklen(network(s.cidr)::INET, 32)
       AND set_masklen(i.ip_address, 32) <> set_masklen(broadcast(s.cidr), 32)
     )
   )
  GROUP BY s.id, s.name, s.cidr
  ORDER BY s.name;
$$;

REVOKE EXECUTE ON FUNCTION get_subnet_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_subnet_stats() TO authenticated;

COMMIT;
