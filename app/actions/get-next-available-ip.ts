"use server";

import { createClient } from "@/lib/supabase/server";

export async function getNextAvailableIp(subnetId: string): Promise<{ ip: string | null; error?: string }> {
  try {
    const supabase = await createClient();

    // Computed in the database (get_next_available_ip): client-side scans hit the API row cap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (supabase.rpc as any)("get_next_available_ip", {
      p_subnet_id: subnetId,
    })) as { data: string | null; error: { message: string } | null };

    if (error) {
      console.error("getNextAvailableIp rpc error:", error);
      return { ip: null, error: "IP 조회 중 오류가 발생했습니다." };
    }

    if (!data) {
      return { ip: null, error: "사용 가능한 IP가 없습니다." };
    }

    return { ip: data };
  } catch (e) {
    console.error("getNextAvailableIp error:", e);
    return { ip: null, error: "IP 조회 중 오류가 발생했습니다." };
  }
}
