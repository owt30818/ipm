"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function allocateIps(
    subnetId: string,
    quantity: number,
    description: string
) {
    const supabase = await createClient();

    // Get current user
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        const { data, error } = await supabase.rpc("allocate_contiguous_ips", {
            p_subnet_id: subnetId,
            p_quantity: quantity,
            p_description: description,
            p_user_id: user.id,
        } as any);

        if (error) {
            console.error("Allocation error:", error);
            return { error: error.message };
        }

        revalidatePath("/dashboard");
        revalidatePath("/allocate");

        return {
            success: true,
            data: data as { id: string; ip_address: string }[]
        };
    } catch (e) {
        console.error("Unexpected error:", e);
        return { error: "An unexpected error occurred" };
    }
}
