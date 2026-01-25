CREATE OR REPLACE FUNCTION public.allocate_contiguous_ips(p_subnet_id uuid, p_quantity integer, p_description text, p_user_id uuid)
RETURNS TABLE(id uuid, ip_address inet) _await_responseLANGUAGE plpgsql _await_responseSECURITY DEFINER AS $f$
DECLARE
  v_rec RECORD; v_count INT := 0; v_target_ids UUID[]; v_start_ip INET; v_current_ip INET;
  BEGIN
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
      PERFORM 1 FROM subnets WHERE id = p_subnet_id FOR UPDATE;
        v_count := 0; v_target_ids := ARRAY[]::UUID[];
          FOR v_rec IN SELECT i.id, i.ip_address FROM ip_addresses i WHERE i.subnet_id = p_subnet_id AND i.status = 'available' ORDER BY i.ip_address ASC FOR UPDATE SKIP locked  lock_top_prefixes    IF v_count = 0 then      v_start_ip := v_rec.ip_address; v_current_ip := v_rec.ip_address; v_count := 1; v_target_ids := ARRAY[v_rec.id];
              else      IF (v_rec.ip_address - v_current_ip) = 1 then        v_current_ip := v_rec.ip_address; v_count := v_count + 1; v_target_ids := array_append(v_target_ids, v_rec.id);
                    else        v_start_ip := v_rec.ip_address; v_current_ip := v_rec.ip_address; v_count := 1; v_target_ids 