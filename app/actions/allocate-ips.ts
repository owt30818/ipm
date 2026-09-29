"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { canManage, NO_PERMISSION_MANAGE } from "@/lib/roles";
import { toKoreanError } from "@/lib/errors";
import { revalidatePath } from "next/cache";

export async function allocateIps(
    subnetId: string,
    quantity: number,
    description: string,
    status: string = "allocated",
    allocatedTo: string = ""
) {
    const session = await getSessionProfile();

    if (!session) {
        return { error: "로그인이 필요합니다. 다시 로그인해주세요." };
    }

    if (!canManage(session.role)) {
        return { error: NO_PERMISSION_MANAGE };
    }

    const user = session.user;
    const supabase = await createClient();

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)("allocate_contiguous_ips", {
            p_description: description,
            p_quantity: quantity,
            p_subnet_id: subnetId,
            p_user_id: user.id,
            p_status: status,
            p_allocated_to: allocatedTo || null
        });

        if (error) {
            console.error("Allocation error:", error);
            return { error: toKoreanError(error) };
        }

        revalidatePath("/dashboard");
        revalidatePath("/allocate");

        return {
            success: true,
            data: data as { id: string; ip_address: string }[]
        };
    } catch (e) {
        console.error("Unexpected error:", e);
        return { error: toKoreanError(e) };
    }
}
