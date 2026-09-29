"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toKoreanError } from "@/lib/errors";

interface DeleteUserResult {
  success: boolean;
  error?: string;
}

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  // Verify current user is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "인증되지 않은 사용자입니다." };
  }

  // Check if trying to delete self
  if (user.id === userId) {
    return { success: false, error: "자신의 계정은 삭제할 수 없습니다." };
  }

  // Check admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "관리자만 사용자를 삭제할 수 있습니다." };
  }

  // Delete user with admin client
  const adminClient = createAdminClient();

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error("Failed to delete user:", deleteError);
    return { success: false, error: toKoreanError(deleteError) };
  }

  return { success: true };
}
