import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/database";
import { getPublicEnv } from "@/lib/env";

export function createAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
