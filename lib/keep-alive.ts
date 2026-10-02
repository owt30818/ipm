import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

// Supabase free-tier projects pause after 7 days without activity. The app server runs a tiny
// query once a day (started from instrumentation.ts) so the project stays active even when nobody
// logs in. The anon key is enough: RLS returns no rows, but the query still runs in the database.

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

export interface KeepAliveStatus {
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

// globalThis: instrumentation and route/page modules can be separate module instances
const store = globalThis as typeof globalThis & {
  __ipamKeepAlive?: KeepAliveStatus & { started: boolean };
};

function state() {
  store.__ipamKeepAlive ??= { started: false, lastSuccessAt: null, lastFailureAt: null };
  return store.__ipamKeepAlive;
}

export function getKeepAliveStatus(): KeepAliveStatus {
  const { lastSuccessAt, lastFailureAt } = state();
  return { lastSuccessAt, lastFailureAt };
}

async function ping() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  if (!supabaseUrl || !supabaseAnonKey) return;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.from("subnets").select("id").limit(1);

  if (error) {
    state().lastFailureAt = new Date().toISOString();
    console.error("[keep-alive] Supabase query failed:", error.message);
  } else {
    state().lastSuccessAt = new Date().toISOString();
  }
}

export function startKeepAlive() {
  const s = state();
  if (s.started) return;
  s.started = true;

  const run = () => ping().catch((e) => console.error("[keep-alive]", e));
  setTimeout(run, FIRST_RUN_DELAY_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
}
