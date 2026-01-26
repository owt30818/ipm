"use server";

import { createClient } from "@/lib/supabase/server";

export async function getNextAvailableIp(subnetId: string): Promise<{ ip: string | null; error?: string }> {
  try {
    const supabase = await createClient();

    // Get subnet CIDR
    const { data: subnet, error: subnetError } = await supabase
      .from("subnets")
      .select("cidr")
      .eq("id", subnetId)
      .single();

    if (subnetError || !subnet) {
      return { ip: null, error: "서브넷을 찾을 수 없습니다." };
    }

    // Get all used IPs in this subnet
    const { data: usedIps } = await supabase
      .from("ip_addresses")
      .select("ip_address")
      .eq("subnet_id", subnetId);

    const usedSet = new Set(
      usedIps?.map((r) => {
        const ipStr = String(r.ip_address);
        return ipStr.includes("/") ? ipStr.split("/")[0] : ipStr;
      }) || []
    );

    // Parse CIDR and find next available IP
    const cidr = String(subnet.cidr);
    const [network, prefixStr] = cidr.split("/");
    const prefix = parseInt(prefixStr);

    const networkParts = network.split(".").map(Number);
    // Use unsigned right shift to handle as unsigned 32-bit
    const networkInt = ((networkParts[0] << 24) >>> 0) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];

    const hostBits = 32 - prefix;
    const numHosts = Math.pow(2, hostBits);

    // Skip network address (first) and broadcast (last)
    for (let i = 1; i < numHosts - 1; i++) {
      const ipInt = networkInt + i;
      const ip = [
        (ipInt >>> 24) & 255,
        (ipInt >>> 16) & 255,
        (ipInt >>> 8) & 255,
        ipInt & 255,
      ].join(".");

      if (!usedSet.has(ip)) {
        return { ip };
      }
    }

    return { ip: null, error: "사용 가능한 IP가 없습니다." };
  } catch (e) {
    console.error("getNextAvailableIp error:", e);
    return { ip: null, error: "IP 조회 중 오류가 발생했습니다." };
  }
}
