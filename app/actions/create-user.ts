"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type UserRole = "sub_admin" | "user";

interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
}

interface CreateUserResult {
  success: boolean;
  error?: string;
}

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  // Verify current user is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "인증되지 않은 사용자입니다." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "관리자만 사용자를 추가할 수 있습니다." };
  }

  // Validate input
  if (!input.email || !input.password) {
    return { success: false, error: "이메일과 비밀번호를 입력해주세요." };
  }

  if (input.password.length < 6) {
    return { success: false, error: "비밀번호는 최소 6자 이상이어야 합니다." };
  }

  // Create user with admin client
  const adminClient = createAdminClient();

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message.includes("already been registered")) {
      return { success: false, error: "이미 등록된 이메일입니다." };
    }
    return { success: false, error: createError.message };
  }

  if (!newUser.user) {
    return { success: false, error: "사용자 생성에 실패했습니다." };
  }

  // Update profile with role
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ role: input.role })
    .eq("id", newUser.user.id);

  if (profileError) {
    console.error("Failed to update profile role:", profileError);
  }

  return { success: true };
}
