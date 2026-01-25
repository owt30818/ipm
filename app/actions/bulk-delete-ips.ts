"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteIps(ids: string[]) {
    const supabase = await createClient();

    try {
        const { error } = await supabase.from("ip_addresses").delete().in("id", ids);

        if (error) {
            console.error("Error deleting IPs:", error);
            return { error: error.message };
        }

        revalidatePath("/dashboard");
        return { success: true };
    } catch (err) {
        console.error("Unexpected error deleting IPs:", err);
        return { error: "An unexpected error occurred" };
    }
}
