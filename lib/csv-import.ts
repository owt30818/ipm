// Validation and helpers for the bulk CSV IP import (app/(main)/allocate/csv-upload.tsx).
// Pure functions so the rules can be tested without a browser.

export type IpStatus = "available" | "allocated" | "reserved" | "deprecated";

export type RowIssue = "invalid_ip" | "invalid_status" | "duplicate" | "outside_subnet" | "exists";

export const ISSUE_LABELS: Record<RowIssue, string> = {
  invalid_ip: "IP 형식 오류",
  invalid_status: "알 수 없는 상태 값",
  duplicate: "파일 내 중복",
  outside_subnet: "서브넷 범위 밖",
  exists: "이미 등록됨",
};

export interface CsvRow {
  [key: string]: string;
}

export interface ColumnMapping {
  ip_address: string;
  status: string;
  description: string;
  allocated_to: string;
}

export interface ParsedIpRow {
  line: number; // 1-based data row number (header excluded)
  raw_ip: string;
  ip_address: string; // normalized when valid
  status: IpStatus;
  description?: string;
  allocated_to?: string;
  issue?: RowIssue;
  selected: boolean;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10000;

const DEFAULT_STATUS: IpStatus = "allocated";

const STATUS_ALIASES: Record<string, IpStatus> = {
  available: "available",
  allocated: "allocated",
  reserved: "reserved",
  deprecated: "deprecated",
  "사용 가능": "available",
  사용가능: "available",
  할당됨: "allocated",
  할당: "allocated",
  예약됨: "reserved",
  예약: "reserved",
  "사용 안 함": "deprecated",
  사용안함: "deprecated",
};

// "10.0.0.5" -> "10.0.0.5"; rejects out-of-range octets and leading zeros ("010" is ambiguous)
export function normalizeIp(input: string | undefined | null): string | null {
  const s = input?.trim();
  if (!s) return null;
  const m = s.match(/^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((p) => p <= 255) ? parts.join(".") : null;
}

// undefined: empty cell (default applies), null: value not recognized
export function parseStatus(raw: string | undefined | null): IpStatus | undefined | null {
  const s = raw?.trim().toLowerCase();
  if (!s) return undefined;
  return STATUS_ALIASES[s] ?? null;
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc * 256 + Number(o)) >>> 0, 0);
}

// Non-IPv4 CIDRs are not judged here; the database trigger validates them
export function ipInCidr(ip: string, cidr: string): boolean {
  const m = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
  if (!m) return true;
  const prefix = Number(m[2]);
  if (prefix < 0 || prefix > 32) return true;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((ipv4ToInt(ip) & mask) >>> 0) === ((ipv4ToInt(m[1]) & mask) >>> 0);
}

export function buildRows(data: CsvRow[], mapping: ColumnMapping, cidr?: string): ParsedIpRow[] {
  const seen = new Set<string>();

  return data.map((row, i) => {
    const rawIp = (mapping.ip_address ? row[mapping.ip_address] ?? "" : "").trim();
    const ip = normalizeIp(rawIp);
    const status = parseStatus(mapping.status ? row[mapping.status] : undefined);
    const description = (mapping.description ? row[mapping.description]?.trim() : "") || undefined;
    const allocatedTo = (mapping.allocated_to ? row[mapping.allocated_to]?.trim() : "") || undefined;

    let issue: RowIssue | undefined;
    if (!ip) issue = "invalid_ip";
    else if (status === null) issue = "invalid_status";
    else if (seen.has(ip)) issue = "duplicate";
    else if (cidr && !ipInCidr(ip, cidr)) issue = "outside_subnet";

    // only rows that will really be registered claim the address
    if (ip && !issue) seen.add(ip);

    return {
      line: i + 1,
      raw_ip: rawIp,
      ip_address: ip ?? rawIp,
      status: status ?? DEFAULT_STATUS,
      description,
      allocated_to: allocatedTo,
      issue,
      selected: !issue,
    };
  });
}

// Marks rows whose IP is already registered (globally unique) and deselects them
export function markExisting(rows: ParsedIpRow[], existing: Set<string>): ParsedIpRow[] {
  return rows.map((row) =>
    !row.issue && existing.has(row.ip_address)
      ? { ...row, issue: "exists" as const, selected: false }
      : row
  );
}

export function summarize(rows: ParsedIpRow[]) {
  const issues: Partial<Record<RowIssue, number>> = {};
  let ready = 0;
  for (const row of rows) {
    if (row.issue) issues[row.issue] = (issues[row.issue] ?? 0) + 1;
    else ready++;
  }
  return { total: rows.length, ready, issues, selected: rows.filter((r) => r.selected && !r.issue).length };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Row payload for the insert; allocated_at follows the manual registration form
export function toInsertRow(row: ParsedIpRow, subnetId: string, now: string) {
  return {
    subnet_id: subnetId,
    ip_address: row.ip_address,
    status: row.status,
    description: row.description ?? null,
    allocated_to: row.allocated_to ?? null,
    allocated_at: row.status === "allocated" && row.allocated_to ? now : null,
  };
}

export const CSV_TEMPLATE = "IP,상태,설명,할당 대상\n10.0.0.10,할당됨,웹 서버,홍길동\n10.0.0.11,예약됨,DB 서버 예정,\n";
