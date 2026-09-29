"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Subnet } from "@/lib/types/database";
import { toKoreanError } from "@/lib/errors";
import {
  CSV_TEMPLATE,
  ISSUE_LABELS,
  MAX_FILE_BYTES,
  MAX_ROWS,
  buildRows,
  chunk,
  markExisting,
  summarize,
  toInsertRow,
  type ColumnMapping,
  type CsvRow,
  type ParsedIpRow,
  type RowIssue,
} from "@/lib/csv-import";

interface CsvUploadProps {
  subnets: Subnet[];
}

const PREVIEW_LIMIT = 10;
const PROBLEM_LIMIT = 20;
const EXISTS_CHUNK = 200; // keeps the request URL short
const EXISTS_PARALLEL = 4;
const INSERT_CHUNK = 500;

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: "ip_address", label: "IP 주소 (필수)", required: true },
  { key: "status", label: "상태" },
  { key: "description", label: "설명" },
  { key: "allocated_to", label: "할당 대상" },
];

const EMPTY_MAPPING: ColumnMapping = { ip_address: "", status: "", description: "", allocated_to: "" };

// IPs already registered anywhere (ip_address is unique across all subnets)
async function findExistingIps(ips: string[]): Promise<Set<string>> {
  const supabase = createClient();
  const found = new Set<string>();
  const parts = chunk(ips, EXISTS_CHUNK);

  for (let i = 0; i < parts.length; i += EXISTS_PARALLEL) {
    const results = await Promise.all(
      parts.slice(i, i + EXISTS_PARALLEL).map(async (part) => {
        const { data, error } = await supabase
          .from("ip_addresses")
          .select("ip_address")
          .in("ip_address", part);
        if (error) throw new Error(toKoreanError(error));
        return (data ?? []) as unknown as { ip_address: string }[];
      })
    );
    for (const rows of results) {
      for (const r of rows) found.add(String(r.ip_address).replace(/\/32$/, ""));
    }
  }

  return found;
}

// 헤더 자동 매핑
function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };

  const ipKeywords = ["ip", "ip_address", "ipaddress", "address", "ip주소"];
  const statusKeywords = ["status", "상태", "state"];
  const descKeywords = ["description", "desc", "설명", "note", "비고"];
  const allocatedKeywords = ["allocated_to", "allocatedto", "할당", "owner", "user", "담당"];

  headers.forEach((h) => {
    const lower = h.toLowerCase();
    if (!mapping.ip_address && ipKeywords.some((k) => lower.includes(k))) mapping.ip_address = h;
    if (!mapping.status && statusKeywords.some((k) => lower.includes(k))) mapping.status = h;
    if (!mapping.description && descKeywords.some((k) => lower.includes(k))) mapping.description = h;
    if (!mapping.allocated_to && allocatedKeywords.some((k) => lower.includes(k))) mapping.allocated_to = h;
  });

  // IP 열을 찾지 못한 경우 첫 번째 열 사용
  if (!mapping.ip_address && headers.length > 0) {
    mapping.ip_address = headers[0];
  }

  return mapping;
}

function downloadTemplate() {
  const blob = new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ip-import-template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const issueClass: Record<RowIssue, string> = {
  invalid_ip: "bg-red-100 text-red-800 hover:bg-red-100",
  invalid_status: "bg-red-100 text-red-800 hover:bg-red-100",
  duplicate: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  outside_subnet: "bg-red-100 text-red-800 hover:bg-red-100",
  exists: "bg-gray-100 text-gray-800 hover:bg-gray-100",
};

export function CsvUpload({ subnets }: CsvUploadProps) {
  const [subnetId, setSubnetId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [parsedRows, setParsedRows] = useState<ParsedIpRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const summary = useMemo(() => summarize(parsedRows), [parsedRows]);
  const selectableCount = summary.ready;
  const allSelected = selectableCount > 0 && summary.selected === selectableCount;
  const previewRows = parsedRows.slice(0, PREVIEW_LIMIT);
  const problemRows = useMemo(() => parsedRows.filter((r) => r.issue), [parsedRows]);
  const selectedSubnet = subnets.find((s) => s.id === subnetId);

  // 매핑/서브넷 변경 시 행 검증 후, 이미 등록된 IP 확인
  useEffect(() => {
    if (rawData.length === 0 || !columnMapping.ip_address) {
      setParsedRows([]);
      return;
    }

    const rows = buildRows(rawData, columnMapping, selectedSubnet ? String(selectedSubnet.cidr) : undefined);
    setParsedRows(rows);

    const candidates = rows.filter((r) => !r.issue).map((r) => r.ip_address);
    if (candidates.length === 0) return;

    let cancelled = false;
    setIsChecking(true);
    findExistingIps(candidates)
      .then((existing) => {
        if (!cancelled) setParsedRows((prev) => markExisting(prev, existing));
      })
      .catch((error) => {
        if (!cancelled) {
          toast({
            title: "등록 여부 확인 실패",
            description: toKoreanError(error),
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, columnMapping, selectedSubnet]);

  const handleFile = (selected: File) => {
    if (selected.size > MAX_FILE_BYTES) {
      toast({
        title: "파일이 너무 큽니다",
        description: `${MAX_FILE_BYTES / 1024 / 1024}MB 이하의 CSV 파일만 업로드할 수 있습니다.`,
        variant: "destructive",
      });
      return;
    }

    setFile(selected);

    const parse = (encoding?: string) =>
      Papa.parse<CsvRow>(selected, {
        header: true,
        skipEmptyLines: true,
        encoding,
        complete: (results) => {
          const headers = results.meta.fields || [];

          // 엑셀 "CSV(쉼표로 분리)"는 EUC-KR(CP949)로 저장되어 UTF-8로 읽으면 글자가 깨진다
          if (!encoding && headers.some((h) => h.includes("�"))) {
            parse("euc-kr");
            return;
          }

          if (results.data.length > MAX_ROWS) {
            toast({
              title: "행이 너무 많습니다",
              description: `한 번에 최대 ${MAX_ROWS.toLocaleString()}행까지 업로드할 수 있습니다. 파일을 나눠서 올려주세요.`,
              variant: "destructive",
            });
            resetForm();
            return;
          }

          setCsvHeaders(headers);
          setRawData(results.data);
          setColumnMapping(autoDetectMapping(headers));
        },
        error: () => {
          toast({
            title: "파일 파싱 오류",
            description: "CSV 파일을 읽을 수 없습니다. 파일 형식을 확인해주세요.",
            variant: "destructive",
          });
        },
      });

    parse();
  };

  const updateMapping = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRow = (line: number) => {
    setParsedRows((prev) =>
      prev.map((row) => (row.line === line && !row.issue ? { ...row, selected: !row.selected } : row))
    );
  };

  const toggleAll = () => {
    const next = !allSelected;
    setParsedRows((prev) => prev.map((row) => (row.issue ? row : { ...row, selected: next })));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "text/csv" || droppedFile?.name.endsWith(".csv")) {
      handleFile(droppedFile);
    } else {
      toast({
        title: "잘못된 파일 형식",
        description: "CSV 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFile(null);
    setRawData([]);
    setCsvHeaders([]);
    setColumnMapping(EMPTY_MAPPING);
    setParsedRows([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subnetId) {
      toast({
        title: "서브넷 필요",
        description: "서브넷을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    const selectedRows = parsedRows.filter((r) => r.selected && !r.issue);

    if (selectedRows.length === 0) {
      toast({
        title: "선택된 항목 없음",
        description: "등록할 IP 주소를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    let inserted = 0;

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      for (const part of chunk(selectedRows, INSERT_CHUNK)) {
        // 그 사이 다른 사용자가 먼저 등록한 IP는 건너뛰고(ignoreDuplicates), 실제 등록된 행만 센다
        const { data, error } = await supabase
          .from("ip_addresses")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .upsert(part.map((row) => toInsertRow(row, subnetId, now)) as any, {
            onConflict: "ip_address",
            ignoreDuplicates: true,
          })
          .select("id");

        if (error) {
          const note = inserted > 0 ? ` (앞서 ${inserted}개는 이미 등록되었습니다.)` : "";
          throw new Error(toKoreanError(error) + note);
        }

        inserted += data?.length ?? 0;
      }

      const skipped = selectedRows.length - inserted;

      toast({
        title: "업로드 완료",
        description:
          `${inserted}개의 IP 주소가 등록되었습니다.` +
          (skipped > 0 ? ` (${skipped}개는 이미 등록되어 건너뜀)` : ""),
      });

      resetForm();
      router.refresh();
    } catch (error) {
      if (inserted > 0) router.refresh();
      toast({
        title: "업로드 실패",
        description: toKoreanError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fileInputHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">서브넷</label>
        <Select value={subnetId} onValueChange={setSubnetId}>
          <SelectTrigger>
            <SelectValue placeholder="서브넷을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {subnets.length === 0 ? (
              <SelectItem value="none" disabled>
                서브넷이 없습니다
              </SelectItem>
            ) : (
              subnets.map((subnet) => (
                <SelectItem key={subnet.id} value={subnet.id}>
                  {subnet.name} ({subnet.cidr})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Drag & Drop Zone */}
      <div
        className={`hidden md:flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-gray-300 dark:border-gray-700"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <svg
          className="w-12 h-12 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-sm text-muted-foreground mb-2">
          CSV 파일을 드래그하여 놓거나
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          파일 선택
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={fileInputHandler}
        />
      </div>

      {/* Mobile: File Picker Button */}
      <div className="md:hidden space-y-2">
        <label className="text-sm font-medium">CSV 파일</label>
        <Input type="file" accept=".csv" onChange={fileInputHandler} />
      </div>

      {file && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>선택된 파일: {file.name}</span>
          <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
            초기화
          </Button>
        </div>
      )}

      {/* 열 매핑 UI */}
      {csvHeaders.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <p className="text-sm font-medium">열 매핑 설정</p>
          <p className="text-xs text-muted-foreground">
            CSV 파일의 열을 각 필드에 매핑하세요. 상태 열이 없거나 비어 있으면 &apos;할당됨&apos;으로 등록됩니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MAPPING_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="space-y-1">
                <label className={`text-xs font-medium ${required ? "text-red-600" : ""}`}>{label}</label>
                <Select
                  value={columnMapping[key] || (required ? "" : "_none_")}
                  onValueChange={(v) => updateMapping(key, v === "_none_" ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={required ? "열 선택" : "열 선택 (선택사항)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {!required && (
                      <SelectItem value="_none_" className="text-xs text-muted-foreground">
                        사용 안함
                      </SelectItem>
                    )}
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 검증 요약 */}
      {parsedRows.length > 0 && (
        <div className="space-y-2" data-testid="csv-summary">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">총 {summary.total}행</span>
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              등록 가능 {summary.ready}
            </Badge>
            {(Object.keys(ISSUE_LABELS) as RowIssue[]).map((issue) =>
              summary.issues[issue] ? (
                <Badge key={issue} className={issueClass[issue]}>
                  {ISSUE_LABELS[issue]} {summary.issues[issue]}
                </Badge>
              ) : null
            )}
            {isChecking && (
              <span className="text-xs text-muted-foreground">이미 등록된 IP 확인 중...</span>
            )}
          </div>
          {!subnetId && (
            <p className="text-xs text-muted-foreground">
              서브넷을 선택하면 IP가 서브넷 범위 안에 있는지도 검사합니다.
            </p>
          )}
          {problemRows.length > 0 && (
            <details className="text-xs border rounded-lg p-3" open>
              <summary className="cursor-pointer font-medium">
                등록에서 제외되는 행 {problemRows.length}개
              </summary>
              <ul className="mt-2 space-y-1">
                {problemRows.slice(0, PROBLEM_LIMIT).map((row) => (
                  <li key={row.line} className="flex gap-2">
                    <span className="text-muted-foreground w-16 shrink-0">{row.line}번째 행</span>
                    <span className="font-mono">{row.raw_ip || "(비어 있음)"}</span>
                    <span className="text-muted-foreground">— {ISSUE_LABELS[row.issue!]}</span>
                  </li>
                ))}
              </ul>
              {problemRows.length > PROBLEM_LIMIT && (
                <p className="mt-2 text-muted-foreground">... 외 {problemRows.length - PROBLEM_LIMIT}개</p>
              )}
            </details>
          )}
        </div>
      )}

      {/* 미리보기 테이블 */}
      {parsedRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              등록 가능 {selectableCount}개 중 {summary.selected}개 선택됨
              {parsedRows.length > PREVIEW_LIMIT && (
                <span className="text-muted-foreground ml-1">
                  (미리보기: 처음 {PREVIEW_LIMIT}행)
                </span>
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAll}
              disabled={selectableCount === 0}
            >
              {allSelected ? "전체 해제" : "전체 선택"}
            </Button>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left border-b w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      disabled={selectableCount === 0}
                    />
                  </th>
                  <th className="px-3 py-2 text-left border-b">IP 주소</th>
                  <th className="px-3 py-2 text-left border-b">상태</th>
                  <th className="px-3 py-2 text-left border-b">설명</th>
                  <th className="px-3 py-2 text-left border-b">할당 대상</th>
                  <th className="px-3 py-2 text-left border-b">검증</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.line}
                    className={`${row.issue ? "opacity-60" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"} ${
                      row.selected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                    onClick={() => toggleRow(row.line)}
                  >
                    {/* Radix renders a hidden input inside forms and clicks it when `checked` changes
                        (e.g. "전체 해제"). That click must not reach the row's onClick, or the row
                        toggles itself back and the update loops forever. */}
                    <td className="px-3 py-2 border-b" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={row.selected}
                        disabled={!!row.issue}
                        onCheckedChange={() => toggleRow(row.line)}
                      />
                    </td>
                    <td className="px-3 py-2 border-b font-mono">
                      {row.raw_ip || "-"}
                    </td>
                    <td className="px-3 py-2 border-b">
                      {row.status}
                    </td>
                    <td className="px-3 py-2 border-b truncate max-w-[150px]">
                      {row.description || "-"}
                    </td>
                    <td className="px-3 py-2 border-b truncate max-w-[150px]">
                      {row.allocated_to || "-"}
                    </td>
                    <td className="px-3 py-2 border-b">
                      {row.issue ? (
                        <Badge className={issueClass[row.issue]}>{ISSUE_LABELS[row.issue]}</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">정상</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > PREVIEW_LIMIT && (
            <p className="text-xs text-muted-foreground text-center">
              ... 외 {parsedRows.length - PREVIEW_LIMIT}개 행
            </p>
          )}
        </div>
      )}

      {csvHeaders.length === 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium">CSV 파일 형식:</p>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              템플릿 다운로드
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            헤더가 있는 CSV 파일을 업로드하세요. 열 이름은 자유롭게 지정할 수 있으며,
            상태는 영문(allocated 등)과 한글(할당됨, 예약됨, 사용 가능, 사용 안 함)을 모두 인식합니다.
            최대 {MAX_ROWS.toLocaleString()}행, {MAX_FILE_BYTES / 1024 / 1024}MB까지 업로드할 수 있습니다.
          </p>
          <code className="text-xs block bg-gray-100 dark:bg-gray-900 p-2 rounded">
            IP,상태,설명,담당자
            <br />
            10.161.48.100,allocated,웹서버,홍길동
          </code>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || isChecking || summary.selected === 0}
      >
        {isLoading ? "업로드 중..." : `선택한 ${summary.selected}개 IP 등록`}
      </Button>
    </form>
  );
}
