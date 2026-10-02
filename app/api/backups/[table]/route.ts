import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { exportIpsToCsv } from "@/app/actions/export-ips";
import { generateCsv } from "@/lib/csv";
import { toKoreanError } from "@/lib/errors";
import { formatDateTimeKst } from "@/lib/utils";

// Admin-only CSV backups of the main tables, downloaded from /about.
// The IP CSV is the same as the unfiltered IP list export, so it can be re-imported via CSV upload.

const PAGE_SIZE = 1000;
const MAX_ROWS = 100000;

type Supabase = Awaited<ReturnType<typeof createClient>>;
type CsvResult = { csv: string; count: number } | { error: string };

const actionLabels: Record<string, string> = {
  create: "생성",
  update: "수정",
  delete: "삭제",
  allocate: "할당",
  release: "해제",
};

function dateKst(iso: string | null): string {
  return iso ? formatDateTimeKst(iso) : "";
}

async function subnetsCsv(supabase: Supabase): Promise<CsvResult> {
  const { data, error } = await supabase
    .from("subnets")
    .select("name, cidr, description, created_at")
    .order("cidr");

  if (error) return { error: toKoreanError(error, "서브넷을 불러오는데 실패했습니다.") };

  const rows = (data ?? []).map((s) => [s.name, s.cidr, s.description || "", dateKst(s.created_at)]);
  return { csv: generateCsv(["이름", "CIDR", "설명", "등록 일시"], rows), count: rows.length };
}

interface AuditRow {
  created_at: string | null;
  action_type: string;
  old_value: unknown;
  new_value: unknown;
  user: { email: string } | null;
  ip_address: { ip_address: string } | null;
}

async function auditLogsCsv(supabase: Supabase): Promise<CsvResult> {
  const data: AuditRow[] = [];

  while (data.length < MAX_ROWS) {
    const { data: page, error } = await supabase
      .from("audit_logs")
      .select("created_at, action_type, old_value, new_value, user:profiles(email), ip_address:ip_addresses(ip_address)")
      .order("created_at", { ascending: false })
      .order("id")
      .range(data.length, data.length + PAGE_SIZE - 1);

    if (error) return { error: toKoreanError(error, "감사 로그를 불러오는데 실패했습니다.") };
    if (!page || page.length === 0) break;

    data.push(...(page as unknown as AuditRow[]));
    if (page.length < PAGE_SIZE) break;
  }

  // Deleted IPs no longer join, so fall back to the address kept in the logged row
  const ipOf = (row: AuditRow) => {
    const logged = (row.old_value ?? row.new_value) as { ip_address?: string } | null;
    return String(row.ip_address?.ip_address ?? logged?.ip_address ?? "").replace(/\/32$/, "");
  };

  const rows = data.map((row) => [
    dateKst(row.created_at),
    actionLabels[row.action_type] || row.action_type,
    ipOf(row),
    row.user?.email || "",
    row.old_value ? JSON.stringify(row.old_value) : "",
    row.new_value ? JSON.stringify(row.new_value) : "",
  ]);

  return {
    csv: generateCsv(["일시", "작업", "IP 주소", "사용자", "변경 전", "변경 후"], rows),
    count: rows.length,
  };
}

const exporters: Record<string, (supabase: Supabase) => Promise<CsvResult>> = {
  subnets: subnetsCsv,
  "ip-addresses": () => exportIpsToCsv({}),
  "audit-logs": auditLogsCsv,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const session = await getSessionProfile();

  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "관리자만 백업을 다운로드할 수 있습니다." }, { status: 403 });
  }

  const { table } = await params;
  const exporter = exporters[table];
  if (!exporter) {
    return NextResponse.json({ error: "알 수 없는 백업 항목입니다." }, { status: 404 });
  }

  const result = await exporter(await createClient());
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // BOM so Excel opens the Korean text as UTF-8
  return new NextResponse("﻿" + result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Row-Count": String(result.count),
    },
  });
}
