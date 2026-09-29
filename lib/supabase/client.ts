import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/types/database";
import { getBrowserEnv } from "@/lib/env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getBrowserEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
