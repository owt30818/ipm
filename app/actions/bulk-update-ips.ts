"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface BulkUpdateData {
    status: "available" | "allocated" | "reserved" | "deprecated";
}

export async function updateIps(ids: string[], data: BulkUpdateData) {
    const supabase = await createClient();

    try {
        const { error } = await supabase
            .from("ip_addresses")
            .update(data)
            .in("id", ids);

        if (error) {
            console.error("Error updating IPs:", error);
            return { error: error.message };
        }

        const { data: { user } } = await supabase.auth.getUser();

        // Audit logs would go here ideally

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("Unexpected error updating IPs:", err);
        return { error: "An unexpected error occurred" };
    }
}
