"use server";

import { createClient } from "@/lib/supabase/server";

interface ExportFilters {
  status?: string;
  subnetId?: string;
  description?: string;
}

const statusLabels: Record<string, string> = {
  available: "사용 가능",
  allocated: "할당됨",
  reserved: "예약됨",
  deprecated: "사용 안 함",
};

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function generateCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function exportIpsToCsv(filters: ExportFilters) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다." };
  }

  const { status, subnetId, description } = filters;

  let query = supabase
    .from("ip_addresses")
    .select(
      `
      *,
      subnet:subnets(id, cidr, name)
    `
    )
    .order("ip_address", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  if (subnetId) {
    query = query.eq("subnet_id", subnetId);
  }

  if (description) {
    query = query.or(
      `description.ilike.%${description}%,allocated_to.ilike.%${description}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching IP addresses:", error);
    return { error: "IP 주소를 불러오는데 실패했습니다." };
  }

  if (!data || data.length === 0) {
    return { error: "내보낼 IP 주소가 없습니다." };
  }

  const headers = ["IP 주소", "상태", "서브넷", "CIDR", "설명", "할당 대상", "할당일", "생성일"];

  const rows = data.map((ip) => [
    ip.ip_address,
    statusLabels[ip.status] || ip.status,
    ip.subnet?.name || "-",
    ip.subnet?.cidr || "-",
    ip.description || "",
    ip.allocated_to || "",
    ip.allocated_at ? new Date(ip.allocated_at).toLocaleDateString("ko-KR") : "",
    new Date(ip.created_at).toLocaleDateString("ko-KR"),
  ]);

  const csv = generateCsv(headers, rows);

  return { csv, count: data.length };
}
