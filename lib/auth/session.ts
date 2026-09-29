import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUserRole, type UserRole } from "@/lib/roles";

// Current user + role, computed once per request (layout and pages share the result).
// A missing profile row is treated as the least-privileged role.
export const getSessionProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const rawRole = (data as unknown as { role?: unknown } | null)?.role;
  const role: UserRole = isUserRole(rawRole) ? rawRole : "user";

  return { user, role };
});
