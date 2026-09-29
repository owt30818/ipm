"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toKoreanError } from "@/lib/errors";

interface AdminUpdatePasswordResult {
    success: boolean;
    error?: string;
}

export async function adminUpdatePassword(
    userId: string,
    newPassword: string
): Promise<AdminUpdatePasswordResult> {
    // Verify current user is admin
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "인증되지 않은 사용자입니다." };
    }

    // Check admin role
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    // Explicitly casting or checking to avoid type inference issues
    // The lint error suggests 'role' doesn't exist on type 'never', which implies Type inference failed.
    // We'll trust the database schema but add a runtime check.
    const userProfile = profile as { role: string } | null;

    if (!userProfile || userProfile.role !== "admin") {
        return { success: false, error: "관리자만 비밀번호를 변경할 수 있습니다." };
    }

    // Update password with admin client
    const adminClient = createAdminClient();

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
        userId,
        { password: newPassword }
    );

    if (updateError) {
        console.error("Failed to update user password:", updateError);
        return { success: false, error: toKoreanError(updateError) };
    }

    return { success: true };
}
