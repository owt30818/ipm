"use server";

import { createClient } from "@/lib/supabase/server";

interface UpdatePasswordResult {
  success: boolean;
  error?: string;
}

export async function updatePassword(
  newPassword: string
): Promise<UpdatePasswordResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "인증되지 않은 사용자입니다." };
  }

  if (newPassword.length < 6) {
    return { success: false, error: "비밀번호는 최소 6자 이상이어야 합니다." };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
