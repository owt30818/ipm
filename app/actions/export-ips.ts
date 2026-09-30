"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { toKoreanError } from "@/lib/errors";
import { formatDateTimeKst } from "@/lib/utils";
import { parseIpSort } from "@/lib/ip-sort";

interface ExportFilters {
  status?: string;
  subnetId?: string;
  description?: string;
  ipAddress?: string;
  sort?: string;
}

const statusLabels: Record<string, string> = {
  available: "사용 가능",
  allocated: "할당됨",
  reserved: "예약됨",
  deprecated: "사용 안 함",
};

// Spreadsheets run cells that start with = + - @ as formulas (CSV injection), so neutralize them
function escapeCsvField(value: string): string {
  let field = value;
  if (/^[=+\-@\t\r]/.test(field)) {
    field = `'${field}`;
  }
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function generateCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function dateKst(iso: string | null): string {
  return iso ? formatDateTimeKst(iso) : "";
}

// Same search function as the IP list, so the export always matches what is on screen.
// A single response is capped by the API (default 1000 rows), so page by what was actually returned.
const PAGE_SIZE = 1000;
const MAX_ROWS = 100000;

interface ExportRow {
  ip_address: string;
  status: string;
  description: string | null;
  allocated_to: string | null;
  allocated_at: string | null;
  created_at: string;
  subnet_name: string | null;
  subnet_cidr: string | null;
  total_count: number | string;
}

export async function exportIpsToCsv(filters: ExportFilters) {
  const session = await getSessionProfile();

  if (!session) {
    return { error: "인증이 필요합니다." };
  }

  const supabase = await createClient();
  const { status, subnetId, description, ipAddress, sort } = filters;
  const data: ExportRow[] = [];
  let total = Infinity;

  while (data.length < total) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: page, error } = (await (supabase.rpc as any)("search_ip_addresses", {
      p_status: status || null,
      p_subnet_id: subnetId || null,
      p_description: description || null,
      p_ip_address: ipAddress || null,
      p_limit: PAGE_SIZE,
      p_offset: data.length,
      p_sort: parseIpSort(sort),
    })) as { data: ExportRow[] | null; error: { message: string } | null };

    if (error) {
      console.error("Error fetching IP addresses:", error);
      return { error: toKoreanError(error, "IP 주소를 불러오는데 실패했습니다.") };
    }

    if (!page || page.length === 0) break;

    if (data.length === 0) {
      total = Number(page[0].total_count);
      if (total > MAX_ROWS) {
        return { error: `내보낼 항목이 ${MAX_ROWS.toLocaleString()}개를 넘습니다. 필터로 범위를 좁혀주세요.` };
      }
    }

    data.push(...page);
  }

  if (data.length === 0) {
    return { error: "내보낼 IP 주소가 없습니다." };
  }

  const headers = ["IP 주소", "상태", "서브넷", "CIDR", "설명", "할당 대상", "할당 일시", "등록 일시"];

  const rows = data.map((ip) => [
    String(ip.ip_address).replace(/\/32$/, ""),
    statusLabels[ip.status] || ip.status,
    ip.subnet_name || "-",
    ip.subnet_cidr || "-",
    ip.description || "",
    ip.allocated_to || "",
    dateKst(ip.allocated_at),
    dateKst(ip.created_at),
  ]);

  const csv = generateCsv(headers, rows);

  return { csv, count: data.length };
}
