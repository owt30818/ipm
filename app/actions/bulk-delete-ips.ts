"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { canDelete, NO_PERMISSION_DELETE } from "@/lib/roles";
import { toKoreanError } from "@/lib/errors";
import { revalidatePath } from "next/cache";

export async function deleteIps(ids: string[]) {
    const session = await getSessionProfile();

    if (!session) {
        return { error: "로그인이 필요합니다. 다시 로그인해주세요." };
    }

    if (!canDelete(session.role)) {
        return { error: NO_PERMISSION_DELETE };
    }

    if (ids.length === 0) {
        return { error: "선택된 IP가 없습니다." };
    }

    const supabase = await createClient();

    try {
        // Rows filtered out by RLS are skipped without an error, so count what was really deleted
        const { data: deleted, error } = await supabase
            .from("ip_addresses")
            .delete()
            .in("id", ids)
            .select("id");

        if (error) {
            console.error("Error deleting IPs:", error);
            return { error: toKoreanError(error) };
        }

        const count = deleted?.length ?? 0;

        if (count === 0) {
            return { error: "삭제된 IP가 없습니다. 이미 삭제되었거나 권한이 없습니다." };
        }

        revalidatePath("/dashboard");
        return { success: true, count };
    } catch (err) {
        console.error("Unexpected error deleting IPs:", err);
        return { error: toKoreanError(err) };
    }
}
