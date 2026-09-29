"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { canManage, NO_PERMISSION_MANAGE } from "@/lib/roles";
import { toKoreanError } from "@/lib/errors";
import { revalidatePath } from "next/cache";

const STATUSES = ["available", "allocated", "reserved", "deprecated"] as const;

interface BulkUpdateData {
    status: (typeof STATUSES)[number];
}

export async function updateIps(ids: string[], data: BulkUpdateData) {
    const session = await getSessionProfile();

    if (!session) {
        return { error: "로그인이 필요합니다. 다시 로그인해주세요." };
    }

    if (!canManage(session.role)) {
        return { error: NO_PERMISSION_MANAGE };
    }

    if (ids.length === 0) {
        return { error: "선택된 IP가 없습니다." };
    }

    if (!STATUSES.includes(data.status)) {
        return { error: "올바르지 않은 상태 값입니다." };
    }

    const supabase = await createClient();

    try {
        // Rows filtered out by RLS are skipped without an error, so count what was really updated
        const { data: updated, error } = await supabase
            .from("ip_addresses")
            .update(data)
            .in("id", ids)
            .select("id");

        if (error) {
            console.error("Error updating IPs:", error);
            return { error: toKoreanError(error) };
        }

        const count = updated?.length ?? 0;

        if (count === 0) {
            return { error: "변경된 IP가 없습니다. 권한을 확인하거나 목록을 새로고침해주세요." };
        }

        revalidatePath("/dashboard");
        return { success: true, count };
    } catch (err) {
        console.error("Unexpected error updating IPs:", err);
        return { error: toKoreanError(err) };
    }
}
