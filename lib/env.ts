// Public config read at container runtime (TrueNAS app env), not baked in at build time.
// NEXT_PUBLIC_* fallbacks keep local `next dev` with .env.local working.

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  turnstileSiteKey: string;
}

declare global {
  interface Window {
    __ENV?: PublicEnv;
  }
}

// Server-side only: reads process.env at request time
export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl:
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
    turnstileSiteKey:
      process.env.TURNSTILE_SITE_KEY ||
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      "",
  };
}

// Browser-side: values injected by the root layout as window.__ENV
export function getBrowserEnv(): PublicEnv {
  if (typeof window === "undefined" || !window.__ENV) {
    throw new Error("window.__ENV is not initialized");
  }
  return window.__ENV;
}
